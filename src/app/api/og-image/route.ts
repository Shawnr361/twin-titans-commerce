import { NextResponse } from 'next/server';

/**
 * Serve a supplier product image as JPEG, from our own domain, for share cards.
 *
 * THE BUG THIS FIXES
 * ------------------
 * og:image pointed straight at the AliExpress CDN. Crawlers COULD fetch it —
 * WhatsApp, Facebook and a browser all got HTTP 200 — but the CDN
 * content-negotiates and answered `content-type: image/webp` despite the URL
 * ending in .jpg. WhatsApp does not render WebP link previews, so every shared
 * product link showed a card with no picture.
 *
 * The CDN turns out to honour Accept: asking without webp returns a real JPEG
 * (66KB for the image that failed). So this needs no image processing and no
 * sharp — which matters, because sharp is only a transitive dependency here and
 * is a native binary that the deploy does not ship.
 *
 * SSRF
 * ----
 * This endpoint fetches a URL chosen by the caller, so it is an SSRF primitive
 * unless the host is constrained. Only the supplier CDNs the catalogue actually
 * uses are allowed; anything else is refused before a request is made. Without
 * that, ?src=http://169.254.169.254/ turns this route into a credential leak.
 */

/** Mirrors next.config.mjs remotePatterns — the hosts our images really come from. */
const ALLOWED_HOST_SUFFIXES = [
  '.aliexpress-media.com',
  '.alicdn.com',
  '.aliexpress.com',
  '.alibaba.com',
  '.1688.com',
  '.cloudfront.net',
  '.r2.dev',
  '.supabase.co',
];

/** WhatsApp gives up on very large previews; nothing here should approach it. */
const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 8_000;

function isAllowed(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  // https only: an http fetch could be redirected or intercepted internally.
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((s) => host.endsWith(s)) ? url : null;
}

/**
 * Ask the CDN for a share-sized copy.
 *
 * Measured across all 100 live products: originals ran to 1.8MB and the proxy
 * took 6–11 SECONDS to serve one. WhatsApp's crawler gives up long before
 * that, which is why previews appeared on some products and not others — it
 * was a race against the crawler's timeout, not a rule, and that is exactly
 * why it looked random.
 *
 * The AliExpress CDN resizes on demand from a filename suffix. The same image
 * came back in ~0.3–1s at 31KB instead of 274KB. 720px is comfortably above
 * the 600px that Facebook and WhatsApp want for a large card.
 *
 * The suffix does NOT remove the need for this proxy: tested with a WhatsApp
 * user agent and Accept: * / *, the suffixed URL still answers image/webp.
 * Only sending an explicit Accept gets JPEG, and a crawler will not do that.
 */
function shareSized(url: URL): URL {
  const host = url.hostname.toLowerCase();
  if (!host.endsWith('.aliexpress-media.com') && !host.endsWith('.alicdn.com')) return url;
  // Already carries a size suffix — leave a deliberate choice alone.
  if (/_\d+x\d+(q\d+)?\.(jpg|jpeg|png|webp)$/i.test(url.pathname)) return url;
  if (!/\.(jpg|jpeg|png)$/i.test(url.pathname)) return url;

  const sized = new URL(url.toString());
  sized.pathname = `${url.pathname}_720x720q75.jpg`;
  return sized;
}

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');
  if (!src) return new NextResponse('Missing src', { status: 400 });

  const target = isAllowed(src);
  if (!target) return new NextResponse('Host not allowed', { status: 400 });

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(shareSized(target), {
      signal: abort.signal,
      /*
       * Let Next cache the upstream body. A product image never changes, and
       * every share re-crawls this URL — without the cache each crawl pays the
       * full round trip to China on a single-worker host.
       */
      cache: 'force-cache',
      // The whole point: omit webp so the CDN returns a format WhatsApp renders.
      headers: { accept: 'image/jpeg,image/png' },
      // Never forward our cookies to a third party.
      credentials: 'omit',
      redirect: 'follow',
    });

    if (!upstream.ok) {
      return new NextResponse('Upstream failed', { status: 502 });
    }

    const type = upstream.headers.get('content-type') ?? '';
    /*
     * Refuse anything that is not an image. This response is served from our
     * own origin, so echoing back arbitrary upstream content-types would let a
     * compromised CDN path serve HTML from twintitanemporium.com.
     */
    if (!type.startsWith('image/')) {
      return new NextResponse('Not an image', { status: 415 });
    }

    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_BYTES) {
      return new NextResponse('Image too large', { status: 413 });
    }

    return new NextResponse(body, {
      headers: {
        'content-type': type,
        'content-length': String(body.byteLength),
        /*
         * Long cache: a product image does not change, and crawlers re-fetch
         * these on every share. Immutable because the URL contains the
         * supplier's own content-addressed filename.
         */
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse('Could not fetch image', { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}
