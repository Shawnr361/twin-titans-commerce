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
 *
 * `animate` drops the letters into place one after another, and repeats every
 * 15 seconds. Opt-in per placement rather than baked in: the footer carries the
 * same wordmark, and an identical animation ticking away below the fold is work
 * done for nobody. One moving mark per page is the whole effect.
 *
 * WHY EACH LETTER CARRIES ITS OWN GOLD
 * ------------------------------------
 * The gold is a gradient clipped to glyphs with background-clip: text. A
 * transformed child escapes an ancestor's text clip, so letters animated inside
 * a single gold span render as nothing at all — their own colour is transparent
 * by design. Giving every letter the `gold` class instead makes each one
 * self-sufficient.
 *
 * The cost is that the metal ramp restarts per letter rather than running
 * across the word. Checked against the single-span version at wordmark size and
 * the two are indistinguishable: the letters are 20px tall and the ramp is
 * 250% wide, so no letter shows enough of it to reveal the seam. Total painted
 * area is also unchanged, which is what keeps the shimmer affordable on a
 * phone — twenty small repaints instead of one medium one, not twenty times
 * the work.
 */
export function Wordmark({
  name,
  className = '',
  size = 'md',
  animate = false,
}: {
  name: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Slide the mark down into place, and again every 15 seconds. */
  animate?: boolean;
}) {
  const scale = {
    sm: 'text-[0.75rem] tracking-[0.14em] sm:text-[0.9375rem] sm:tracking-[0.22em]',
    md: 'text-[0.8125rem] tracking-[0.15em] sm:text-[1.0625rem] sm:tracking-[0.24em] lg:text-[1.25rem] lg:tracking-[0.26em]',
    lg: 'text-[1rem] tracking-[0.16em] sm:text-[1.375rem] sm:tracking-[0.24em] lg:text-[1.75rem] lg:tracking-[0.26em]',
  }[size];

  return (
    <span
      title={name}
      className={`${
        animate ? '' : 'gold gold-sweep '
      }font-display block select-none whitespace-nowrap leading-none ${scale} ${className}`}
    >
      {animate ? (
        <>
          {/* The letters are decoration; the name is read once, from here. */}
          <span className="sr-only">{name}</span>
          <span aria-hidden="true">
            {[...name.toUpperCase()].map((character, index) => (
              <span
                key={index}
                className="gold wordmark-letter"
                style={{ '--i': index } as React.CSSProperties}
              >
                {character === ' ' ? '\u00A0' : character}
              </span>
            ))}
          </span>
        </>
      ) : (
        name.toUpperCase()
      )}
    </span>
  );
}
