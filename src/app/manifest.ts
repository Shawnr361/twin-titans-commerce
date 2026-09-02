import type { MetadataRoute } from 'next';

/**
 * Web app manifest, and the reason it exists: the Android share sheet.
 *
 * Installed to the home screen, the store registers itself as a share target.
 * Tapping Share on an AliExpress listing then lists "Twin Titans" alongside
 * WhatsApp, and the link arrives straight in the import screen — no copying, no
 * switching apps, no pasting. That is the whole point of this file; the
 * standalone window is a side effect.
 *
 * SHARE ARRIVES BY GET, NOT POST
 * ------------------------------
 * A POST share target must be handled by a service worker, which means the
 * share is lost whenever the worker has been evicted — and a share that
 * silently does nothing is worse than one that never appeared. A GET target is
 * an ordinary navigation: it works on a cold start, it can be bookmarked, and
 * the URL is visible if anything goes wrong.
 *
 * Android is inconsistent about WHICH field carries the link — some apps put it
 * in `url`, AliExpress usually buries it in `text` next to the product title —
 * so all three are requested and the page sorts it out.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Twin Titans Emporium',
    short_name: 'Twin Titans',
    description: 'Add products and manage your store.',
    // The share sheet lands here; the admin login guards it if signed out.
    start_url: '/admin',
    scope: '/',
    display: 'standalone',
    background_color: '#14110f',
    theme_color: '#14110f',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        // Padded artwork, or Android crops a circle straight through the mark.
        purpose: 'maskable',
      },
    ],
    share_target: {
      action: '/admin/import/share',
      method: 'GET',
      params: { title: 'title', text: 'text', url: 'url' },
    },
  } as MetadataRoute.Manifest;
}
