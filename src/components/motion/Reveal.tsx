'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Reveals its children as they scroll into view.
 *
 * Three rules keep this from ever hiding content permanently — the failure
 * mode that makes scroll animation dangerous rather than merely decorative:
 *
 *  1. It renders VISIBLE. Hiding only happens after mount, in an effect, so a
 *     visitor with JS disabled or broken sees a complete page.
 *  2. Anything already on screen at mount is never hidden at all. Otherwise
 *     the hero animates out from under the visitor — or, if the observer is
 *     throttled (background tab, an embedded preview pane, some in-app
 *     browsers), never comes back.
 *  3. A failsafe timer shows the content regardless after 2.5s. If the
 *     observer never fires, the worst case is missing animation, never
 *     missing content.
 */
export function Reveal({
  children,
  stagger = false,
  className = '',
  as: Tag = 'div',
  threshold = 0.12,
}: {
  children: React.ReactNode;
  stagger?: boolean;
  className?: string;
  as?: 'div' | 'section' | 'ul' | 'header';
  threshold?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(true);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Rule 2: already on screen (or above it) — leave it alone.
    const rect = node.getBoundingClientRect();
    const viewport = window.innerHeight || 0;
    if (rect.top < viewport * 0.92) return;

    setArmed(true);
    setShown(false);

    const show = () => setShown(true);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          show();
          observer.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -6% 0px' }
    );
    observer.observe(node);

    // Rule 3: never let content stay hidden.
    const failsafe = window.setTimeout(() => {
      show();
      observer.disconnect();
    }, 2500);

    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [threshold]);

  return (
    <Tag
      ref={ref as never}
      data-shown={shown ? 'true' : 'false'}
      className={`${armed ? (stagger ? 'rise-stagger' : 'rise') : ''} ${className}`}
    >
      {children}
    </Tag>
  );
}
