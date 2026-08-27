'use client';

import { useState } from 'react';

export interface ShippingBlock {
  name: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postcode?: string | null;
  country: string;
  phone?: string | null;
}

/**
 * One-click copy of a customer's address, laid out for a supplier checkout.
 *
 * WHY COPY AND NOT AUTOFILL
 * -------------------------
 * Driving AliExpress's checkout with a script would breach their terms and put
 * the very account the business depends on at risk. Copy-paste keeps a human in
 * the loop at the moment money is spent, which is also where a wrong address
 * costs the most. When volume justifies real automation, the answer is DSers —
 * an official partner with a supported ordering API — not a browser robot.
 *
 * Field ORDER matters: it matches the order the supplier checkout asks for
 * them, so pasting runs top to bottom without hunting.
 */
export function CopyShippingDetails({
  address,
  email,
  orderNumber,
}: {
  address: ShippingBlock;
  email: string;
  orderNumber: number;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const lines = [
    `Contact name: ${address.name}`,
    `Phone: ${address.phone ?? '—'}`,
    `Country: ${address.country}`,
    `Street address: ${address.line1}`,
    ...(address.line2 ? [`Apt / suite: ${address.line2}`] : []),
    `City: ${address.city}`,
    ...(address.state ? [`State / province: ${address.state}`] : []),
    `Postcode: ${address.postcode ?? '—'}`,
    '',
    /*
     * The customer's email is deliberately NOT part of the pasted block. A
     * supplier has no need for it, and handing a marketplace seller a customer's
     * address book entry is exactly the kind of sharing the privacy policy says
     * we keep to the minimum needed to deliver.
     */
    `— Twin Titans order #${orderNumber}`,
  ];
  const text = lines.join('\n');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
      window.setTimeout(() => setState('idle'), 2500);
    } catch {
      setState('failed');
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={copy}
        className="btn btn-secondary w-full"
        aria-label={`Copy shipping details for order ${orderNumber}`}
      >
        {state === 'copied' ? 'Copied ✓' : 'Copy shipping details'}
      </button>

      {state === 'failed' && (
        <>
          <p className="text-micro text-warn">
            The browser blocked the clipboard. Select and copy the block below.
          </p>
          {/* A textarea so it can still be selected by hand when the API is denied. */}
          <textarea
            readOnly
            rows={9}
            value={text}
            onFocus={(e) => e.currentTarget.select()}
            className="field w-full resize-none font-mono text-micro"
          />
        </>
      )}

      <p className="text-micro text-quiet">
        Paste into the supplier checkout. The customer&rsquo;s email ({email}) is left out
        deliberately &mdash; the supplier does not need it.
      </p>
    </div>
  );
}
