/*
 * The smallest service worker that makes the store installable.
 *
 * Chrome on Android will not offer "Add to home screen" — and therefore will
 * not register the share target — unless a service worker with a fetch handler
 * is present. That is the entire reason this file exists.
 *
 * IT DELIBERATELY CACHES NOTHING.
 *
 * A caching worker on an admin panel is a liability: it serves yesterday's
 * order list, hides a deploy that has already landed, and turns "I fixed it"
 * into "clear your browser data". Prices, stock and orders must never be read
 * from a stale copy. So every request goes to the network exactly as it would
 * without a worker, and the offline story is honest — there isn't one.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Present, so the app is installable. Pass-through, so nothing is ever stale.
self.addEventListener('fetch', () => {});
