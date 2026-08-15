import { formatMoney } from '@/lib/money';

/**
 * Every price on the site renders through this component.
 *
 * The critical bit is `data-base-minor` / `data-base-currency`: the currency
 * switcher rewrites the *text* of these elements, so any other script that
 * needs the real price must read the attributes, never the text. On the old
 * store, the PayPal button read the visible text and would have charged a
 * converted number as if it were raw naira — a live money bug caught one commit
 * before it shipped. Designing the source-of-truth attribute in from the start
 * makes that class of bug impossible here.
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
  return (
    <span
      className={`tt-price ${strike ? 'price-strike' : ''} ${className}`}
      data-base-minor={minor}
      data-base-currency={currency}
    >
      {prefix ? `${prefix} ` : ''}
      {formatMoney(minor, currency)}
    </span>
  );
}
