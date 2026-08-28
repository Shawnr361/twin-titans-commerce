'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Empty the basket once the order is confirmed.
 *
 * WHY THIS IS NOT DONE ON THE SERVER
 * ----------------------------------
 * The confirmation page used to call clearCart() while rendering, which does
 * `cookies().delete(...)`. Next only permits mutating cookies in a Server
 * Action or a Route Handler, so rendering threw — and because the call sat
 * behind `paymentStatus === 'PAID'`, it threw ONLY after a payment succeeded.
 * A customer who paid was shown "Application error"; a customer whose payment
 * failed saw the page render perfectly. The order itself was fine throughout:
 * it was recorded PAID and routed to the supplier queue.
 *
 * The basket lives in a cookie the browser owns, so a webhook cannot clear it.
 * Asking the existing DELETE route handler from the client is the supported
 * path, and it runs after the receipt is already on screen — so a failure here
 * leaves a stale basket, never a broken confirmation.
 */
export function ClearCartOnMount() {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    // Strict mode mounts effects twice in development; clearing once is enough.
    if (done.current) return;
    done.current = true;

    fetch('/api/cart', { method: 'DELETE' })
      // Refresh so the header count and the drawer stop showing a paid-for item.
      .then(() => router.refresh())
      .catch(() => {
        /* A basket that failed to clear is a nuisance, not a broken receipt. */
      });
  }, [router]);

  return null;
}
