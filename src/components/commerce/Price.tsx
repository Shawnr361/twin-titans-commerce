'use client';

import { formatMoney } from '@/lib/money';
import { useCurrency } from './CurrencyContext';

/**
 * Every price on the site renders through this component.
 *
 * `data-base-minor` / `data-base-currency` carry the untouched value. Anything
 * that needs the real number — a payment button, analytics — must read the
 * attribute and never the text. On the previous store a payment button read the
 * visible text and would have charged a converted figure as if it were raw
 * naira. Designing the source-of-truth attribute in from the start makes that
 * class of bug impossible.
 *
 * The displayed text is now derived from React state rather than rewritten in
 * the DOM afterwards. See CurrencyContext for why: the old rewriter replaced
 * React's own text node, so a price that changed after the first paint — a
 * variant being selected — updated a detached node while the shopper kept
 * seeing the previous figure.
 *
 * Conversion is presentation only. Checkout always settles in the base
 * currency, and the UI says so wherever a converted price is shown.
 */
export function Price({
  minor,
  currency = 'NGN',
  className = '',
  strike = false,
  prefix,
}: {
  minor: number;
  currency?: string;
  className?: string;
  strike?: boolean;
  prefix?: string;
}) {
  const ctx = useCurrency();
  const option =
    ctx && ctx.active !== currency ? ctx.options.find((o) => o.code === ctx.active) : null;

  let text: string;
  if (option && option.rate > 0) {
    const converted = (minor / 100) * option.rate;
    text = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: option.code,
      /*
       * Below 100 the minor units still carry meaning; above it they are noise
       * on a price tag.
       */
      maximumFractionDigits: converted >= 100 ? 0 : 2,
    }).format(converted);
  } else {
    text = formatMoney(minor, currency);
  }

  return (
    <span
      className={`tt-price tabular-nums ${strike ? 'text-quiet line-through' : ''} ${className}`}
      data-base-minor={minor}
      data-base-currency={currency}
    >
      {prefix ? <span className="text-quiet">{prefix} </span> : null}
      {text}
    </span>
  );
}
