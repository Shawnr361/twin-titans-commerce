'use client';

import { useEffect, useRef } from 'react';

/**
 * Pulls its child a few pixels toward the cursor.
 *
 * Only bound on devices that actually have a fine pointer — on touch there is
 * no cursor to be magnetic toward, and binding it would waste listeners.
 * Movement is capped so the control never leaves its own hit area, which
 * would make it harder to click rather than more inviting.
 */
export function Magnetic({
  children,
  radius = 90,
  pull = 0.28,
  className = '',
}: {
  children: React.ReactNode;
  radius?: number;
  pull?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const onMove = (event: MouseEvent) => {
      const rect = node.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);

      if (Math.hypot(dx, dy) > radius + Math.max(rect.width, rect.height) / 2) {
        node.style.setProperty('--mx', '0px');
        node.style.setProperty('--my', '0px');
        return;
      }

      node.style.setProperty('--mx', `${(dx * pull).toFixed(1)}px`);
      node.style.setProperty('--my', `${(dy * pull).toFixed(1)}px`);
    };

    const reset = () => {
      node.style.setProperty('--mx', '0px');
      node.style.setProperty('--my', '0px');
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('blur', reset);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('blur', reset);
    };
  }, [radius, pull]);

  return (
    <span ref={ref} className={`magnetic inline-block ${className}`}>
      {children}
    </span>
  );
}
