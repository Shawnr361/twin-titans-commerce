/**
 * Icon set.
 *
 * Inline SVG rather than an icon font or a CDN package: no extra request, no
 * FOUT, no dependency, and they inherit `currentColor` so they theme with the
 * rest of the system automatically.
 *
 * Drawn on a 24px grid with a 1.25 stroke and round caps — thin enough to sit
 * beside the type without shouting, which is how luxury retail draws icons.
 *
 * ACCESSIBILITY: every icon here is decorative (`aria-hidden`). An icon-only
 * control MUST carry its own `aria-label` on the button or link — replacing a
 * text label with a picture removes the name from the accessibility tree, and
 * that is the single most common failure when moving from text to icons.
 */

export interface IconProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
}

function Svg({
  children,
  className = '',
  size = 20,
  strokeWidth = 1.25,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

export const IconBag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 8h15l-1.1 11.2a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8L4.5 8Z" />
    <path d="M8.75 8V6.25a3.25 3.25 0 0 1 6.5 0V8" />
  </Svg>
);

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.25" />
    <path d="m20 20-3.6-3.6" />
  </Svg>
);

export const IconUser = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8.5" r="3.75" />
    <path d="M4.75 20a7.25 7.25 0 0 1 14.5 0" />
  </Svg>
);

export const IconHeart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />
  </Svg>
);

export const IconGlobe = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.25" />
    <path d="M3.75 12h16.5M12 3.75c2.1 2.3 3.2 5.2 3.2 8.25S14.1 18 12 20.25C9.9 18 8.8 15.05 8.8 12S9.9 6.05 12 3.75Z" />
  </Svg>
);

export const IconTruck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.75 6.75h10.5v9.5H2.75z" />
    <path d="M13.25 10.25h3.9l3.1 3v3h-7z" />
    <circle cx="6.5" cy="18" r="1.75" />
    <circle cx="17" cy="18" r="1.75" />
  </Svg>
);

export const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.25 19 6v5.5c0 4.2-2.9 7.6-7 9.25-4.1-1.65-7-5.05-7-9.25V6l7-2.75Z" />
    <path d="m9.25 12 2 2 3.5-3.75" />
  </Svg>
);

export const IconReturn = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9.5h11.5a4.5 4.5 0 0 1 0 9H9" />
    <path d="m7.5 6 -3.5 3.5 3.5 3.5" />
  </Svg>
);

export const IconChat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.25 12c0 3.9-3.7 7-8.25 7-1 0-1.95-.15-2.85-.45L4.5 20l1.15-3.4A6.6 6.6 0 0 1 3.75 12c0-3.9 3.7-7 8.25-7s8.25 3.1 8.25 7Z" />
  </Svg>
);

export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6.5 9.5 5.5 5 5.5-5" />
  </Svg>
);

export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9.5 6.5 5 5.5-5 5.5" />
  </Svg>
);

export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.75 12h14.5m-5.5-5.5 5.5 5.5-5.5 5.5" />
  </Svg>
);

export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6.5 6.5 11 11m0-11-11 11" />
  </Svg>
);

export const IconMenu = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.75 7h16.5M3.75 12h16.5M3.75 17h16.5" />
  </Svg>
);

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5.25v13.5M5.25 12h13.5" />
  </Svg>
);

export const IconMinus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.25 12h13.5" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
);

export const IconZoom = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.25" />
    <path d="m20 20-3.6-3.6M11 8.75v4.5M8.75 11h4.5" />
  </Svg>
);

export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.75 7h14.5M9.5 7V5.25h5V7M6.5 7l.8 12.1a1.8 1.8 0 0 0 1.8 1.65h5.8a1.8 1.8 0 0 0 1.8-1.65L17.5 7" />
  </Svg>
);

export const IconSpark = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.75 13.6 9l5.25 1.6L13.6 12.2 12 17.45 10.4 12.2 5.15 10.6 10.4 9 12 3.75Z" />
  </Svg>
);
