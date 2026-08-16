'use client';

import { useEffect, useRef } from 'react';

/**
 * Paints a soft gold pool that follows the cursor across its area.
 *
 * On a near-black ground this is the single cheapest way to make a page feel
 * alive rather than printed — the surface reacts to you without anything
 * moving. Costs two CSS custom properties per frame and no layout.
 *
 * Skipped entirely on touch (no cursor to follow) and under reduced-motion.
 * Updates are rAF-throttled so a fast mouse cannot outrun the compositor.
 */
export function Spotlight({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section';
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let x = 0;
    let y = 0;

    const paint = () => {
      frame = 0;
      node.style.setProperty('--sx', `${x}px`);
      node.style.setProperty('--sy', `${y}px`);
    };

    const onMove = (event: MouseEvent) => {
      const rect = node.getBoundingClientRect();
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    node.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      node.removeEventListener('mousemove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <Tag ref={ref as never} className={`spotlight relative ${className}`}>
      {children}
    </Tag>
  );
}
