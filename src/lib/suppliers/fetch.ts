import { BROWSER_UA } from './parse';

/**
 * Page fetching for supplier listings.
 *
 * Reality check: AliExpress/Alibaba/1688 all actively block datacentre IPs and
 * serve a bot-wall or a login redirect a good share of the time. So the chain is
 *   direct fetch -> optional scraping gateway -> give up cleanly
 * and "give up cleanly" means the importer falls back to a manual paste form
 * rather than inventing product data. A silently-wrong import becomes a
 * mispriced live product, which is the expensive failure mode.
 */

export interface FetchResult {
  ok: boolean;
  html: string;
  status: number;
  via: 'direct' | 'gateway';
  blocked: boolean;
  error?: string;
}

const BLOCK_SIGNS = [
  'punish?',
  '_____tmd_____',
  'captcha',
  'slidecaptcha',
  'x5referer',
  'nc_1_n1z',
  'Sorry, we have detected unusual traffic',
  'baxia-punish',
];

function looksBlocked(html: string): boolean {
  if (html.length < 1500) return true;
  const head = html.slice(0, 20000).toLowerCase();
  return BLOCK_SIGNS.some((s) => head.includes(s.toLowerCase()));
}

async function rawFetch(url: string, timeoutMs: number): Promise<{ status: number; html: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': BROWSER_UA,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'no-cache',
      },
    });
    return { status: res.status, html: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchListingHtml(url: string, timeoutMs = 20000): Promise<FetchResult> {
  try {
    const { status, html } = await rawFetch(url, timeoutMs);
    if (status < 400 && !looksBlocked(html)) {
      return { ok: true, html, status, via: 'direct', blocked: false };
    }
    const gateway = await tryGateway(url, timeoutMs);
    if (gateway) return gateway;
    return {
      ok: false,
      html,
      status,
      via: 'direct',
      blocked: true,
      error:
        status >= 400
          ? `Supplier returned HTTP ${status}.`
          : 'Supplier served an anti-bot page instead of the listing.',
    };
  } catch (err) {
    const gateway = await tryGateway(url, timeoutMs);
    if (gateway) return gateway;
    return {
      ok: false,
      html: '',
      status: 0,
      via: 'direct',
      blocked: false,
      error: err instanceof Error ? err.message : 'Network error reaching the supplier.',
    };
  }
}

async function tryGateway(url: string, timeoutMs: number): Promise<FetchResult | null> {
  const endpoint = process.env.SCRAPER_ENDPOINT;
  if (!endpoint) return null;
  const target = endpoint
    .replace('{url}', encodeURIComponent(url))
    .replace('{key}', process.env.SCRAPER_API_KEY ?? '');
  try {
    const { status, html } = await rawFetch(target, timeoutMs + 15000);
    if (status < 400 && !looksBlocked(html)) {
      return { ok: true, html, status, via: 'gateway', blocked: false };
    }
    return null;
  } catch {
    return null;
  }
}
