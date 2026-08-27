'use client';

import { formatMoney } from '@/lib/money';
import { Price } from '@/components/commerce/Price';

/**
 * The announcement strip, with any money in it kept in the shopper's currency.
 *
 * The banner is free text a merchant types in admin, so the free-delivery
 * threshold inside it is just characters — "Free delivery on orders over
 * ₦30,000". Switching to USD converted every real price on the page and left
 * this line in naira, which is the first thing a visitor reads and the one
 * place an inconsistency looks like a bug rather than a rounding difference.
 *
 * Rather than force the merchant to learn a template syntax, this looks for the
 * threshold as it would be formatted in the base currency and swaps that one
 * span for a Price. Text that does not mention the amount is rendered
 * unchanged, so nothing here constrains what can be written.
 */
export function AnnouncementBar({
  text,
  freeShippingOverMinor,
  baseCurrency,
}: {
  text: string;
  freeShippingOverMinor: number;
  baseCurrency: string;
}) {
  const needle = freeShippingOverMinor > 0 ? formatMoney(freeShippingOverMinor, baseCurrency) : '';
  const at = needle ? text.indexOf(needle) : -1;

  return (
    <div className="border-b border-onyx/10 bg-onyx/10 py-2.5 text-center backdrop-blur-md">
      <p className="label !text-onyx/80 px-4">
        {at === -1 ? (
          text
        ) : (
          <>
            {text.slice(0, at)}
            <Price
              minor={freeShippingOverMinor}
              currency={baseCurrency}
              className="!text-onyx/80"
            />
            {text.slice(at + needle.length)}
          </>
        )}
      </p>
    </div>
  );
}
