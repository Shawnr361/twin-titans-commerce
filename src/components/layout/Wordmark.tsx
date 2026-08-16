/**
 * The wordmark, struck in gold.
 *
 * The metal is a four-stop gradient clipped to the glyphs, with a highlight
 * band parked off to one side that sweeps across on hover — the same way a
 * foil-stamped mark catches light as you tilt it. A flat gold fill just looks
 * like yellow text; the ramp is what reads as metal.
 *
 * Size AND tracking both scale down on small screens. Wide tracking is what
 * makes a wordmark look expensive, but at 375px a long store name plus 0.26em
 * of tracking overflows the viewport and pushes the bag link off-screen — so
 * the tracking tightens before the type does.
 *
 * `title` keeps the plain name available to assistive tech, since the visible
 * glyphs are transparent by design.
 */
export function Wordmark({
  name,
  className = '',
  size = 'md',
}: {
  name: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const scale = {
    sm: 'text-[0.75rem] tracking-[0.14em] sm:text-[0.9375rem] sm:tracking-[0.22em]',
    md: 'text-[0.8125rem] tracking-[0.15em] sm:text-[1.0625rem] sm:tracking-[0.24em] lg:text-[1.25rem] lg:tracking-[0.26em]',
    lg: 'text-[1rem] tracking-[0.16em] sm:text-[1.375rem] sm:tracking-[0.24em] lg:text-[1.75rem] lg:tracking-[0.26em]',
  }[size];

  return (
    <span
      title={name}
      className={`gold gold-sweep font-display block select-none whitespace-nowrap leading-none ${scale} ${className}`}
    >
      {name.toUpperCase()}
    </span>
  );
}
