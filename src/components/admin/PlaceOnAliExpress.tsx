'use client';

import { useState } from 'react';
import { ALIEXPRESS_CART_URL } from '@/lib/dropship/aliexpress-cart';

/**
 * Buy a customer's order on AliExpress, in their own logged-in session.
 *
 * WHY THIS REPLACED "PLACE WITH SUPPLIER"
 * ---------------------------------------
 * The old button called the DS "Order Create and Pay" API, which spends money
 * with no confirmation screen. It has never completed a real placement — the
 * account reports auto-pay `canApply: false` — so pressing Confirm produced
 * nothing a merchant could see, on a screen whose entire job is to get a paid
 * order moving. The endpoint is still there for the day the account is
 * approved; it is no longer the thing the queue asks a person to press.
 *
 * ONE BUTTON FOR THE WHOLE PAYMENT, ACROSS SELLERS
 * ------------------------------------------------
 * The API cannot place a single order spanning two sellers, which is why
 * automatic placement looped one call per seller. The cart has no such limit,
 * so every item on one customer payment opens together here regardless of how
 * many stores it splits across — and checkout happens once, on AliExpress.
 *
 * THE ADDRESS IS COPIED ON THE SAME CLICK
 * ---------------------------------------
 * Deliberate, and the reason it happens here rather than behind its own
 * button: the clipboard is only writable inside a user gesture, and the next
 * thing the merchant does is paste an address into AliExpress. Copying it at
 * the moment the tabs open means it is already waiting.
 *
 * POPUP BLOCKING IS DETECTED, NOT ASSUMED
 * ---------------------------------------
 * Opening several tabs from one click is exactly what a popup blocker stops.
 * window.open returns null when it is blocked, so that is counted and said out
 * loud, and every link stays on the page to be opened by hand. Silently
 * opening two of five tabs would mean a customer is short three items and
 * nothing on screen would say so.
 */
export interface AliExpressLine {
  title: string;
  url: string;
  variant: string;
  sku: string;
  quantity: number;
}

export function PlaceOnAliExpress({
  orderNumber,
  lines,
  addressText,
  cost,
  sellerCount,
}: {
  orderNumber: number;
  lines: AliExpressLine[];
  /** The ship-to block, ready to paste into AliExpress checkout. */
  addressText: string;
  cost: string;
  sellerCount: number;
}) {
  const [opened, setOpened] = useState(false);
  const [copied, setCopied] = useState(false);
  const [blocked, setBlocked] = useState(0);

  const open = async () => {
    /*
     * Clipboard first. It is the part that must happen inside the gesture, and
     * a blocked popup should not cost the merchant the address as well.
     */
    try {
      await navigator.clipboard.writeText(addressText);
      setCopied(true);
    } catch {
      setCopied(false);
    }

    let refused = 0;
    for (const line of lines) {
      /*
       * No 'noopener' in the feature string: several browsers return null for
       * it whether or not the popup opened, which would make every tab look
       * blocked. The reference is severed straight afterwards instead.
       */
      const tab = window.open(line.url, '_blank');
      if (tab) tab.opener = null;
      else refused += 1;
    }

    setBlocked(refused);
    setOpened(true);
  };

  if (!opened) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={open}
          className="btn btn-primary !rounded-full px-5 py-2 text-xs"
        >
          Place on AliExpress
        </button>
        <p className="text-micro text-greige">
          Opens {lines.length === 1 ? 'the listing' : `all ${lines.length} listings`}
          {sellerCount > 1 ? ` from ${sellerCount} sellers` : ''} and copies the delivery address.
          About {cost} at cost.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 border-l-2 border-gold/60 pl-4">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={ALIEXPRESS_CART_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary !rounded-full px-5 py-2 text-xs"
        >
          Open cart &amp; check out
        </a>
        <span className="text-micro text-greige">
          {copied
            ? 'Delivery address copied — paste it at AliExpress checkout.'
            : 'Copy the address from the card below; the clipboard was blocked.'}
        </span>
      </div>

      {blocked > 0 && (
        <p className="border border-warn/40 bg-warn/5 p-3 text-micro text-warn">
          Your browser blocked {blocked} of {lines.length} tab{blocked === 1 ? '' : 's'}. Allow
          popups for this site, or open the ones below by hand — otherwise order #{orderNumber}{' '}
          goes out short.
        </p>
      )}

      {/*
        Every line stays listed with its variant and SKU. AliExpress does not
        put the chosen variant in the URL and its own share links drop it, so
        `sku_id` on these links may well be ignored — the merchant confirms the
        option on the page, and this is what they confirm it against.
      */}
      <ol className="space-y-1.5">
        {lines.map((line, i) => (
          <li key={i} className="text-micro text-greige">
            <a
              href={line.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-verdigris underline-offset-2 hover:underline"
            >
              {line.title || line.url}
            </a>
            <span className="text-quiet">
              {' — '}
              {line.variant}
              {line.sku && line.sku !== '—' ? ` · SKU ${line.sku}` : ' · no SKU recorded'}
              {' · '}
              <strong className="text-greige">Qty {line.quantity}</strong>
            </span>
          </li>
        ))}
      </ol>

      <p className="text-micro text-quiet">
        When you have paid, put the AliExpress order number into &ldquo;Mark placed&rdquo; on the
        card below — that is what lets tracking find the parcel and email the customer.
      </p>
    </div>
  );
}
