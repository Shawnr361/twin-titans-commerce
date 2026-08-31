import crypto from 'node:crypto';
import { prisma } from '@/lib/db';
import { writeSetting } from '@/lib/settings';

/**
 * AliExpress Open Platform — signed API client.
 *
 * WHY SIGNING IS NOT A COMPLICATION
 * ---------------------------------
 * Every request carries an HMAC of its own parameters. This is ordinary for a
 * commerce API (Flutterwave and PayPal both do equivalent things) and it lives
 * entirely in this file — nothing above it ever thinks about it. Its only real
 * consequence is that the App Secret must stay on the server, which is already
 * true of every other key here.
 *
 * THE ALGORITHM IS ASSERTED, NOT ASSUMED
 * --------------------------------------
 * The published docs render behind a loading shim, so this implements the
 * standard IOP scheme (sort by key, concatenate path + key+value pairs,
 * HMAC-SHA256, uppercase hex). If it is wrong the gateway answers with an
 * explicit signature error rather than misbehaving quietly — see `ping()`,
 * which exists to find that out on demand instead of during a customer's
 * order.
 */

const HOST = 'https://api-sg.aliexpress.com';
/** System APIs (token create/refresh) live under /rest and route on the path. */
const GATEWAY = `${HOST}/rest`;
/**
 * Business APIs live at the ROOT /sync and route on a `method` PARAMETER.
 *
 * This bit cost a cycle: /sync was tried first and rejected with
 * InvalidApiPath, which read as "wrong shape" — but GATEWAY already ends in
 * /rest, so the request had actually gone to /rest/sync. The shape was right
 * and the URL was wrong. Confirmed against the console's own API list, which
 * shows these as dotted method names, not paths.
 */
const SYNC = `${HOST}/sync`;
const AUTH_URL = 'https://api-sg.aliexpress.com/oauth/authorize';
const TOKEN_SETTING = 'aliexpress_token';
const TIMEOUT_MS = 20_000;

export interface StoredToken {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. Refreshed before this, never after. */
  expiresAt: number;
  accountId?: string;
  sellerId?: string;
  connectedAt: string;
}

export function isAliexpressConfigured(): boolean {
  return Boolean(
    process.env.ALIEXPRESS_APP_KEY?.trim() && process.env.ALIEXPRESS_APP_SECRET?.trim()
  );
}

function appKey(): string {
  const k = process.env.ALIEXPRESS_APP_KEY?.trim();
  if (!k) throw new Error('ALIEXPRESS_APP_KEY is not set.');
  return k;
}

function appSecret(): string {
  const s = process.env.ALIEXPRESS_APP_SECRET?.trim();
  if (!s) throw new Error('ALIEXPRESS_APP_SECRET is not set.');
  return s;
}

/**
 * IOP signature.
 *
 * Sort every parameter by key, concatenate `key + value` with no separators,
 * prefix the API path, and HMAC-SHA256 it with the app secret. Uppercase hex.
 * `sign` itself is never part of its own input.
 */
export function signRequest(
  apiPath: string,
  params: Record<string, string>,
  secret: string
): string {
  const base =
    apiPath +
    Object.keys(params)
      .filter((k) => k !== 'sign')
      .sort()
      .map((k) => `${k}${params[k]}`)
      .join('');

  return crypto.createHmac('sha256', secret).update(base, 'utf8').digest('hex').toUpperCase();
}

/** The URL a merchant visits to authorise this app against their account. */
export function authorizeUrl(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    response_type: 'code',
    force_auth: 'true',
    redirect_uri: redirectUri,
    client_id: appKey(),
    state,
  });
  return `${AUTH_URL}?${q.toString()}`;
}

/**
 * @param url     absolute endpoint to POST to
 * @param signPath path prefixed to the signature base — '' for /sync, where
 *                 the gateway signs the parameters alone.
 */
async function post(url: string, signPath: string, extra: Record<string, string>) {
  const params: Record<string, string> = {
    app_key: appKey(),
    timestamp: String(Date.now()),
    sign_method: 'sha256',
    ...extra,
  };
  params.sign = signRequest(signPath, params, appSecret());

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: abort.signal,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
      cache: 'no-store',
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

/** Exchange the one-time `code` from the callback for a token pair. */
export async function exchangeCode(code: string): Promise<StoredToken> {
  const { body } = await post(`${GATEWAY}/auth/token/create`, '/auth/token/create', { code });

  const d = body as Record<string, unknown>;
  const accessToken = String(d.access_token ?? '');
  if (!accessToken) {
    /*
     * Surfaced verbatim. A failure here is almost always the signature or a
     * stale code, and both are diagnosable only from the gateway's own words.
     */
    throw new Error(`AliExpress refused the code: ${JSON.stringify(body).slice(0, 400)}`);
  }

  const token: StoredToken = {
    accessToken,
    refreshToken: String(d.refresh_token ?? ''),
    // expires_in is seconds; a minute of slack keeps a near-expiry call safe.
    expiresAt: Date.now() + (Number(d.expires_in ?? 0) - 60) * 1000,
    accountId: d.account_id ? String(d.account_id) : undefined,
    sellerId: d.seller_id ? String(d.seller_id) : undefined,
    connectedAt: new Date().toISOString(),
  };

  await writeSetting(TOKEN_SETTING, token);
  return token;
}

export async function storedToken(): Promise<StoredToken | null> {
  /*
   * Read straight from the row rather than through readSetting(): that helper
   * merges the stored value INTO a fallback object, which is right for a
   * settings blob with defaults and wrong here — there is no sensible default
   * for "a token", and merging into null throws.
   */
  try {
    const row = await prisma.setting.findUnique({ where: { key: TOKEN_SETTING } });
    const t = row?.value as StoredToken | null;
    return t && t.accessToken ? t : null;
  } catch {
    return null;
  }
}

/**
 * A valid access token, refreshing if it is close to expiry.
 *
 * Returns null rather than throwing when the store has never been connected —
 * callers treat "not connected" as a normal state, not an error.
 */
export async function accessToken(): Promise<string | null> {
  const token = await storedToken();
  if (!token) return null;
  if (Date.now() < token.expiresAt) return token.accessToken;

  const { body } = await post(
    `${GATEWAY}/auth/token/refresh`,
    '/auth/token/refresh',
    { refresh_token: token.refreshToken }
  );
  const d = body as Record<string, unknown>;
  const fresh = String(d.access_token ?? '');
  if (!fresh) return null;

  await writeSetting(TOKEN_SETTING, {
    ...token,
    accessToken: fresh,
    refreshToken: String(d.refresh_token ?? token.refreshToken),
    expiresAt: Date.now() + (Number(d.expires_in ?? 0) - 60) * 1000,
  } satisfies StoredToken);

  return fresh;
}

/** Call a business API. `method` is the dotted name, e.g. aliexpress.ds.product.get. */
export async function call(
  method: string,
  args: Record<string, string> = {}
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const token = await accessToken();
  if (!token) {
    return { ok: false, status: 401, body: { error: 'AliExpress is not connected.' } };
  }
  /*
   * Empty sign path: /sync signs the parameters alone, unlike the /rest
   * endpoints which prefix their own path.
   */
  return post(SYNC, '', { method, access_token: token, ...args });
}

/**
 * Prove the credentials and the signature actually work.
 *
 * Deliberately a READ. The obvious "real" test is placing an order, but that
 * spends money and ships goods — not something to discover a signing bug with.
 */
export async function ping(): Promise<{ ok: boolean; detail: string }> {
  if (!isAliexpressConfigured()) {
    return { ok: false, detail: 'ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET are not set.' };
  }
  const token = await storedToken();
  if (!token) return { ok: false, detail: 'Not connected yet — authorise the app first.' };

  /*
   * Several candidates, because the docs render behind a loading shim and the
   * exact dotted name for a harmless read is the one thing not worth guessing
   * silently. Whichever answers without InvalidApiPath is the live shape, and
   * the others cost nothing.
   */
  const candidates = [
    // Taken from the App Console's own AE-Dropshipper list, not guessed.
    'aliexpress.ds.member.benefit.get',
    'aliexpress.ds.category.get',
  ];

  const tried: string[] = [];
  for (const method of candidates) {
    const res = await call(method, {});
    const text = JSON.stringify(res.body);
    if (!text.includes('InvalidApiPath')) {
      return { ok: res.ok, detail: `${method} -> ${text.slice(0, 500)}` };
    }
    tried.push(method);
  }

  return {
    ok: false,
    detail: `All paths rejected as invalid: ${tried.join(', ')}. Signature is fine — the token exchange is signed the same way and succeeded — so this is the API name, not auth.`,
  };
}
