/**
 * A slow running band between sections.
 *
 * The track is rendered twice and translated by exactly -50%, which is what
 * makes the loop seamless — one copy scrolls off exactly as its duplicate
 * arrives. Pure CSS animation on `transform`, so it costs nothing on the main
 * thread and pauses on hover.
 *
 * The duplicate is `aria-hidden` so screen readers hear the list once.
 */
export function Marquee({ items }: { items: string[] }) {
  const Track = ({ hidden = false }: { hidden?: boolean }) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((item, i) => (
        <li key={`${item}-${i}`} className="flex items-center whitespace-nowrap">
          <span className="label !text-greige px-8">{item}</span>
          <span className="text-brass/70" aria-hidden>
            ◆
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="marquee overflow-hidden border-y border-rule bg-bone2/40 py-4">
      <div className="marquee-track">
        <Track />
        <Track hidden />
      </div>
    </div>
  );
}
