'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Meta and TikTok browser pixels.
 *
 * Mounted once in the root layout. Ids come from admin Settings via props, so
 * they are runtime values — pasting a pixel id into Settings takes effect on
 * the next request with no rebuild and no host env edit. An empty id renders
 * nothing at all, which is the correct behaviour before the accounts exist.
 *
 * `afterInteractive` on purpose: a pixel is never worth blocking paint for on
 * a Nigerian mobile connection, and both vendors' snippets queue calls made
 * before their script lands.
 */

type PixelParams = Record<string, unknown>;

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[] };
    ttq?: {
      track: (event: string, params?: PixelParams, options?: { event_id?: string }) => void;
      page: () => void;
      load: (id: string) => void;
      instance?: (id: string) => unknown;
    };
  }
}

/**
 * The four events that matter, named per platform.
 *
 * TikTok does not accept Meta's vocabulary: its purchase event is
 * `CompletePayment`. Sending `Purchase` to TikTok is accepted silently and
 * then optimised against nothing, which is the worst possible failure mode —
 * spend continues, the dashboard shows events, and none of them are the
 * conversion the campaign is bidding on.
 */
const TIKTOK_NAMES: Record<string, string> = {
  ViewContent: 'ViewContent',
  AddToCart: 'AddToCart',
  InitiateCheckout: 'InitiateCheckout',
  Purchase: 'CompletePayment',
};

export interface TrackedContent {
  id: string;
  quantity: number;
  price: number;
  title?: string;
}

export interface TrackPayload {
  value?: number;
  currency?: string;
  contents?: TrackedContent[];
  orderId?: string;
  /** Shared with the server-side event so the platforms deduplicate. */
  eventId?: string;
}

/**
 * Fire one commerce event on both pixels.
 *
 * Safe to call before either script has loaded and safe to call when neither
 * pixel is configured — it simply does nothing. Callers must never await it or
 * branch on it; a tracking call has no business affecting what the shopper
 * sees.
 */
export function trackClient(event: keyof typeof TIKTOK_NAMES, payload: TrackPayload = {}) {
  if (typeof window === 'undefined') return;

  const ids = payload.contents?.map((c) => c.id) ?? [];
  const numItems = payload.contents?.reduce((sum, c) => sum + c.quantity, 0) ?? undefined;

  try {
    window.fbq?.(
      'track',
      event,
      {
        currency: payload.currency,
        value: payload.value,
        content_type: 'product',
        content_ids: ids,
        num_items: numItems,
        contents: payload.contents?.map((c) => ({
          id: c.id,
          quantity: c.quantity,
          item_price: c.price,
        })),
        order_id: payload.orderId,
      },
      // Meta takes the dedup id in a fourth argument, not in the params object.
      payload.eventId ? { eventID: payload.eventId } : undefined
    );
  } catch {
    /* a pixel error must never surface to a shopper */
  }

  try {
    window.ttq?.track(
      TIKTOK_NAMES[event] ?? event,
      {
        currency: payload.currency,
        value: payload.value,
        contents: payload.contents?.map((c) => ({
          content_id: c.id,
          content_type: 'product',
          content_name: c.title,
          quantity: c.quantity,
          price: c.price,
        })),
        order_id: payload.orderId,
      },
      payload.eventId ? { event_id: payload.eventId } : undefined
    );
  } catch {
    /* as above */
  }
}

export function Pixels({
  metaPixelId,
  tiktokPixelId,
}: {
  metaPixelId: string;
  tiktokPixelId: string;
}) {
  const pathname = usePathname();
  const firstPath = useRef(pathname);

  /*
   * App Router navigations never reload the document, so the snippet's own
   * initial PageView is the ONLY one either pixel would ever see. Without this
   * effect a shopper who lands on an ad's product page and browses to three
   * more products registers a single page view, and every landing-page metric
   * in both dashboards is wrong.
   *
   * The first render is skipped because the inline snippets already fired it.
   */
  useEffect(() => {
    if (pathname === firstPath.current) return;
    try {
      window.fbq?.('track', 'PageView');
      window.ttq?.page();
    } catch {
      /* ignore */
    }
  }, [pathname]);

  return (
    <>
      {metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${metaPixelId}');fbq('track','PageView');`}
        </Script>
      )}

      {tiktokPixelId && (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`!function (w, d, t) {
w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript";n.async=!0;n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
ttq.load('${tiktokPixelId}');ttq.page();
}(window, document, 'ttq');`}
        </Script>
      )}
    </>
  );
}

/**
 * Fires one event when it mounts, and only once.
 *
 * Used for the page-level events — ViewContent on a product, InitiateCheckout
 * on the checkout page, Purchase on the receipt. React 18 mounts effects twice
 * in development, which would double-count every one of them, so the ref guard
 * is load-bearing rather than defensive.
 */
export function TrackEvent({
  event,
  ...payload
}: { event: keyof typeof TIKTOK_NAMES } & TrackPayload) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackClient(event, payload);
    // Payload is captured at mount deliberately; this is a one-shot beacon.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
