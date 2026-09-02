'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker, which is what makes the store installable and
 * therefore what puts "Twin Titans" in the Android share sheet.
 *
 * Mounted in the ADMIN layout only. A worker registered across the storefront
 * would sit between customers and their checkout for no benefit — this one
 * caches nothing, so it would be pure risk with no offline story to show for
 * it. The share target only ever lands in admin anyway.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Failure is not worth reporting: it costs installability, nothing else.
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
