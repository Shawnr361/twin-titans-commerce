import { createHash } from 'node:crypto';
import { prisma } from './db';
import { readSetting, writeSetting } from './settings';
import { fromMinor } from './money';

/**
 * Ad-platform conversion tracking — Meta and TikTok.
 *
 * TWO STREAMS, ONE EVENT. The browser pixel fires from the shopper's device;
 * the Conversions/Events API fires from this server. Both send the SAME
 * `event_id` so the platforms deduplicate them into one conversion. Without
 * that id a purchase counts twice and every ROAS figure in both dashboards is
 * inflated — which is worse than no tracking at all, because it looks right.
 *
 * The server-side half is not a nicety. On Nigerian mobile a large share of
 * browser pixel calls never arrive: ad blockers, data-saver proxies, iOS
 * tracking prevention, and shoppers who close the tab the moment the bank
 * redirect completes. The server sees every paid order regardless, so it is
 * the authoritative stream and the browser is the enrichment.
 *
 * NOTHING HERE MAY THROW INTO A PAYMENT PATH. `trackPurchase` is called from
 * `markOrderPaid`, which is what routes an order to its supplier. A pixel
 * outage must never stop money or goods moving, so every failure is swallowed
 * and recorded as an order event instead.
 */

export interface TrackingSettings {
  /** Meta (Facebook/Instagram) pixel id — public, appears in the page source. */
  metaPixelId: string;
  /** Conversions API access token. SECRET — server-side only, never sent to a browser. */
  metaCapiToken: string;
  /** TikTok pixel id — public. */
  tiktokPixelId: string;
  /** TikTok Events API access token. SECRET. */
  tiktokEventsToken: string;
  /**
   * Test-event codes from each platform's Events Manager. Set while verifying,
   * then CLEAR them — events sent with a test code are diagnostic only and are
   * not counted toward optimisation or reporting.
   */
  metaTestEventCode: string;
  tiktokTestEventCode: string;
}

export const TRACKING_SETTINGS_KEY = 'tracking';

/*
 * Environment variables are the FALLBACK, not the primary source.
 *
 * The ids live in the database so they can be pasted into admin Settings and
 * take effect on the next request — no rebuild, no host env edit, no restart.
 * The env fallback exists so a deployment can be configured before anyone can
 * sign in to admin, and so the values survive a settings row being wiped.
 */
const DEFAULTS: TrackingSettings = {
  metaPixelId: process.env.META_PIXEL_ID ?? '',
  metaCapiToken: process.env.META_CAPI_TOKEN ?? '',
  tiktokPixelId: process.env.TIKTOK_PIXEL_ID ?? '',
  tiktokEventsToken: process.env.TIKTOK_EVENTS_TOKEN ?? '',
  metaTestEventCode: '',
  tiktokTestEventCode: '',
};

export function getTrackingSettings(): Promise<TrackingSettings> {
  return readSetting(TRACKING_SETTINGS_KEY, DEFAULTS);
}

export function writeTrackingSettings(value: TrackingSettings): Promise<void> {
  return writeSetting(TRACKING_SETTINGS_KEY, value);
}

/**
 * The id that joins the browser event to the server event.
 *
 * Derived from the order id rather than random, so the confirm page and the
 * payment webhook arrive at the same value without having to store or pass
 * one — and so a webhook retry cannot mint a second id for the same purchase.
 */
export function purchaseEventId(orderId: string): string {
  return `tt-purchase-${orderId}`;
}

/**
 * SHA-256 of a normalised identifier, as both platforms require.
 *
 * Normalisation is not cosmetic: " Ada@Example.COM " and "ada@example.com"
 * hash to different values, so an un-normalised hash simply never matches and
 * the match quality score silently stays poor.
 */
function hashed(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalised = value.trim().toLowerCase();
  if (!normalised) return undefined;
  return createHash('sha256').update(normalised).digest('hex');
}

/** Phone must be digits only, country code included, before hashing. */
function hashedPhone(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  let digits = value.replace(/\D/g, '');
  if (!digits) return undefined;
  // Nigerian numbers are typed as 0803… far more often than +234803…; a local
  // 0-prefixed number hashed as-is never matches anything Meta holds.
  if (digits.startsWith('0') && digits.length === 11) digits = `234${digits.slice(1)}`;
  return createHash('sha256').update(digits).digest('hex');
}

/**
 * Click identifiers captured in the browser at checkout, replayed by the server.
 *
 * `_fbp`/`_fbc`/`_ttp` are first-party cookies and `fbclid`/`ttclid` arrive in
 * the ad's landing URL. The server-to-server call is made from a payment
 * webhook, which carries none of the shopper's cookies — so these are frozen
 * onto the order at checkout and read back here. They are the strongest match
 * signal there is: without them attribution falls back to hashed email alone.
 */
export interface Attribution {
  fbp?: string;
  fbc?: string;
  ttp?: string;
  ttclid?: string;
  userAgent?: string;
  ip?: string;
  sourceUrl?: string;
}

export const ATTRIBUTION_EVENT_KIND = 'ad_attribution';

/**
 * Stored as an OrderEvent rather than as columns on Order.
 *
 * OrderEvent already has a `data Json?` field designed for exactly this kind
 * of side information, and using it avoids a schema migration against the live
 * production database for what is ultimately six optional strings.
 */
export async function saveAttribution(orderId: string, attribution: Attribution): Promise<void> {
  const hasAnything = Object.values(attribution).some((v) => v);
  if (!hasAnything) return;
  try {
    await prisma.orderEvent.create({
      data: {
        orderId,
        kind: ATTRIBUTION_EVENT_KIND,
        message: 'Ad click identifiers captured at checkout.',
        data: attribution as never,
      },
    });
  } catch {
    // Attribution is an optimisation. Never let it fail a checkout.
  }
}

async function readAttribution(orderId: string): Promise<Attribution> {
  try {
    const row = await prisma.orderEvent.findFirst({
      where: { orderId, kind: ATTRIBUTION_EVENT_KIND },
      orderBy: { createdAt: 'desc' },
    });
    return ((row?.data as Attribution | null) ?? {}) as Attribution;
  } catch {
    return {};
  }
}

/**
 * POST and decide honestly whether it worked.
 *
 * BOTH platforms answer HTTP 200 to a request they rejected. TikTok returns
 * `{"code": 40002, "message": "..."}` with a 200; Meta returns 200 with an
 * `error` object. Checking only `res.ok` therefore reports success for every
 * malformed payload — the events never arrive, the dashboard stays empty, and
 * nothing anywhere says why. That is the same silent-no-op failure that once
 * let four deploys "succeed" while the site served a two-day-old build.
 *
 * So the body is parsed and a non-zero code is raised as an error, which
 * lands on the order as a `tracking_failed` event with the platform's own
 * message in it.
 */
async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 300)}`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // A 200 that is not JSON is not something to celebrate, but it is not
    // provably a rejection either. Let it pass rather than invent a failure.
    return text;
  }

  const payload = parsed as { code?: number; message?: string; error?: { message?: string } };
  // TikTok: code 0 means accepted. Anything else is a rejection wearing a 200.
  if (typeof payload.code === 'number' && payload.code !== 0) {
    throw new Error(`code ${payload.code}: ${payload.message ?? 'rejected'}`);
  }
  // Meta: an `error` object in a 200 body.
  if (payload.error) {
    throw new Error(payload.error.message ?? 'rejected');
  }
  return text;
}

interface PurchasePayload {
  eventId: string;
  eventTime: number;
  value: number;
  currency: string;
  orderNumber: number;
  email: string;
  phone: string | null;
  contents: { id: string; quantity: number; price: number; title: string }[];
  attribution: Attribution;
}

async function sendMetaPurchase(settings: TrackingSettings, p: PurchasePayload) {
  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(settings.metaPixelId)}/events`;
  // Returned, not discarded: the self-test prints the platform's own reply, and
  // "events_received" in it is the only real confirmation the call landed.
  return postJson(url, {
    access_token: settings.metaCapiToken,
    ...(settings.metaTestEventCode ? { test_event_code: settings.metaTestEventCode } : {}),
    data: [
      {
        event_name: 'Purchase',
        event_time: p.eventTime,
        event_id: p.eventId,
        action_source: 'website',
        ...(p.attribution.sourceUrl ? { event_source_url: p.attribution.sourceUrl } : {}),
        user_data: {
          em: hashed(p.email) ? [hashed(p.email)] : undefined,
          ph: hashedPhone(p.phone) ? [hashedPhone(p.phone)] : undefined,
          fbp: p.attribution.fbp,
          fbc: p.attribution.fbc,
          client_ip_address: p.attribution.ip,
          client_user_agent: p.attribution.userAgent,
        },
        custom_data: {
          currency: p.currency,
          value: p.value,
          order_id: String(p.orderNumber),
          content_type: 'product',
          content_ids: p.contents.map((c) => c.id),
          num_items: p.contents.reduce((sum, c) => sum + c.quantity, 0),
          contents: p.contents.map((c) => ({
            id: c.id,
            quantity: c.quantity,
            item_price: c.price,
          })),
        },
      },
    ],
  });
}

async function sendTiktokPurchase(settings: TrackingSettings, p: PurchasePayload) {
  return postJson(
    'https://business-api.tiktok.com/open_api/v1.3/event/track/',
    {
      event_source: 'web',
      event_source_id: settings.tiktokPixelId,
      ...(settings.tiktokTestEventCode ? { test_event_code: settings.tiktokTestEventCode } : {}),
      data: [
        {
          // TikTok's purchase event is called CompletePayment, not Purchase.
          // Sending "Purchase" is accepted and then optimised against nothing.
          event: 'CompletePayment',
          event_time: p.eventTime,
          event_id: p.eventId,
          user: {
            email: hashed(p.email),
            phone: hashedPhone(p.phone),
            ttp: p.attribution.ttp,
            ttclid: p.attribution.ttclid,
            ip: p.attribution.ip,
            user_agent: p.attribution.userAgent,
          },
          page: p.attribution.sourceUrl ? { url: p.attribution.sourceUrl } : undefined,
          properties: {
            currency: p.currency,
            value: p.value,
            order_id: String(p.orderNumber),
            contents: p.contents.map((c) => ({
              content_id: c.id,
              content_type: 'product',
              content_name: c.title,
              quantity: c.quantity,
              price: c.price,
            })),
          },
        },
      ],
    },
    { 'Access-Token': settings.tiktokEventsToken }
  );
}

/**
 * Send one synthetic event through the real senders, and report what the
 * platform actually said.
 *
 * Deliberately reuses `sendMetaPurchase` / `sendTiktokPurchase` rather than
 * building a sample payload of its own. A test that exercises a different
 * request shape from production proves nothing — the whole point is to find
 * out whether the exact body `trackPurchase` sends is accepted, before a real
 * order depends on the answer.
 *
 * Safe to run against live: it is a self-contained fake order with a unique
 * event id, so nothing can collide with a real purchase. Pass a test event
 * code and the platforms route it to Test Events instead of counting it.
 */
export async function sendTestPurchase(testEventCode?: string): Promise<{
  meta: { attempted: boolean; ok: boolean; response: string };
  tiktok: { attempted: boolean; ok: boolean; response: string };
  payloadPreview: Record<string, unknown>;
  warning: string | null;
}> {
  const stored = await getTrackingSettings();
  /*
   * A test code passed here overrides the stored one for this call only.
   *
   * Without a code the platforms record the synthetic purchase as a REAL
   * conversion — a fake sale sitting in reporting forever, which is a small
   * mess in a fresh pixel and a real one in an account with live campaigns
   * optimising against purchase volume. Passing the code per-call means a
   * clean test does not require editing settings and remembering to undo it.
   */
  const settings: TrackingSettings = testEventCode
    ? { ...stored, metaTestEventCode: testEventCode, tiktokTestEventCode: testEventCode }
    : stored;
  const stamp = Date.now();

  const payload: PurchasePayload = {
    eventId: `tt-test-${stamp}`,
    eventTime: Math.floor(stamp / 1000),
    value: 1000,
    currency: 'NGN',
    orderNumber: 0,
    email: 'tracking-test@twintitansemporium.store',
    phone: '08000000000',
    contents: [{ id: 'TEST-SKU', quantity: 1, price: 1000, title: 'Tracking test item' }],
    attribution: {
      sourceUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://twintitansemporium.store'}/`,
      userAgent: 'TwinTitansTrackingSelfTest/1.0',
      // Documentation IP range, so no real visitor is ever implicated by a test.
      ip: '203.0.113.1',
    },
  };

  const run = async (ready: boolean, fn: () => Promise<string>) => {
    if (!ready) return { attempted: false, ok: false, response: 'No pixel id or token set.' };
    try {
      return { attempted: true, ok: true, response: (await fn()).slice(0, 800) };
    } catch (err) {
      return { attempted: true, ok: false, response: String(err).slice(0, 800) };
    }
  };

  const [meta, tiktok] = await Promise.all([
    run(Boolean(settings.metaPixelId && settings.metaCapiToken), () =>
      sendMetaPurchase(settings, payload)
    ),
    run(Boolean(settings.tiktokPixelId && settings.tiktokEventsToken), () =>
      sendTiktokPurchase(settings, payload)
    ),
  ]);

  const untagged = !settings.metaTestEventCode && !settings.tiktokTestEventCode;

  return {
    meta,
    tiktok,
    warning: untagged
      ? 'No test event code was used, so any accepted event counts as a REAL conversion in reporting. Pass testEventCode next time.'
      : null,
    payloadPreview: {
      event_id: payload.eventId,
      event_time: payload.eventTime,
      value: payload.value,
      currency: payload.currency,
      contents: payload.contents,
      metaTestEventCode: settings.metaTestEventCode || null,
      tiktokTestEventCode: settings.tiktokTestEventCode || null,
    },
  };
}

/**
 * Fire the authoritative server-side Purchase for a paid order.
 *
 * Called from `markOrderPaid`, which is already idempotent by payment
 * reference — so this runs once per order, not once per webhook retry.
 * Failures are recorded against the order and never rethrown.
 */
export async function trackPurchase(orderId: string): Promise<void> {
  try {
    const settings = await getTrackingSettings();
    const metaReady = Boolean(settings.metaPixelId && settings.metaCapiToken);
    const tiktokReady = Boolean(settings.tiktokPixelId && settings.tiktokEventsToken);
    if (!metaReady && !tiktokReady) return;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { lineItems: true },
    });
    if (!order) return;

    const attribution = await readAttribution(orderId);

    /*
     * Value is in BASE currency major units, matching what the pixel sends and
     * what the catalogue feed lists. Never the presentment amount: a shopper
     * browsing in USD would otherwise report a purchase of "38.99" against a
     * feed priced in naira, and the platform would optimise toward a revenue
     * figure four hundred times too small.
     */
    const payload: PurchasePayload = {
      eventId: purchaseEventId(order.id),
      eventTime: Math.floor(Date.now() / 1000),
      value: fromMinor(order.totalMinor, order.currency),
      currency: order.currency,
      orderNumber: order.number,
      email: order.email,
      phone: order.phone,
      contents: order.lineItems.map((line) => ({
        // Must equal the feed's `id` column or nothing matches in the catalogue.
        id: line.sku || line.variantId || line.id,
        quantity: line.quantity,
        price: fromMinor(line.unitPriceMinor, order.currency),
        title: line.productTitle,
      })),
      attribution,
    };

    const results = await Promise.allSettled([
      metaReady ? sendMetaPurchase(settings, payload) : Promise.resolve(),
      tiktokReady ? sendTiktokPurchase(settings, payload) : Promise.resolve(),
    ]);

    const failures = results
      .map((r, i) => (r.status === 'rejected' ? `${i === 0 ? 'Meta' : 'TikTok'}: ${r.reason}` : null))
      .filter(Boolean);

    if (failures.length) {
      await prisma.orderEvent
        .create({
          data: {
            orderId,
            kind: 'tracking_failed',
            message: `Server-side purchase event failed — ${failures.join(' | ')}`,
          },
        })
        .catch(() => {});
    }
  } catch {
    // Deliberately silent: this sits in the paid-order path.
  }
}
