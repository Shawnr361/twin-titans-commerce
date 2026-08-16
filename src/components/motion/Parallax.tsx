'use client';

import { useEffect, useRef } from 'react';

/**
 * Drifts its content slower than the page as it passes through the viewport.
 *
 * The read happens inside a rAF tick driven by scroll, and only while the
 * element is actually on screen — an IntersectionObserver gates the listener
 * so off-screen sections cost nothing. `getBoundingClientRect` is read once
 * per frame and only `transform` is written, so there is no layout thrash.
 */
export function Parallax({
  children,
  strength = 14,
  className = '',
}: {
  children: React.ReactNode;
  /** Percent of the element's height to travel across a full pass. */
  strength?: number;
  className?: string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = outer.current;
    const target = inner.current;
    if (!host || !target) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let visible = false;
    let ticking = false;

    const apply = () => {
      ticking = false;
      const rect = host.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      // -1 when the element is just below the fold, +1 when just above it.
      const progress = (rect.top + rect.height / 2 - viewport / 2) / (viewport / 2 + rect.height / 2);
      target.style.transform = `translate3d(0, ${(progress * strength).toFixed(2)}%, 0)`;
    };

    const onScroll = () => {
      if (!visible || ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) apply();
      },
      { threshold: 0 }
    );

    observer.observe(host);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [strength]);

  return (
    <div ref={outer} className={`overflow-hidden ${className}`}>
      {/* Oversized so the drift never exposes an edge. */}
      <div ref={inner} className="h-[118%] w-full will-change-transform" style={{ marginTop: '-9%' }}>
        {children}
      </div>
    </div>
  );
}
