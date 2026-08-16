import { formatMoney } from '@/lib/money';

/**
 * Every price on the site renders through this component.
 *
 * `data-base-minor` / `data-base-currency` carry the untouched value. The
 * currency switcher rewrites the *text* of these elements, so anything that
 * needs the real number — a payment button, analytics — must read the
 * attribute and never the text. On the previous store a payment button read
 * the visible text and would have charged a converted figure as if it were
 * raw naira. Designing the source-of-truth attribute in from the start makes
 * that class of bug impossible.
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
      className={`tt-price tabular-nums ${strike ? 'text-quiet line-through' : ''} ${className}`}
      data-base-minor={minor}
      data-base-currency={currency}
    >
      {prefix ? <span className="text-quiet">{prefix} </span> : null}
      {formatMoney(minor, currency)}
    </span>
  );
}
