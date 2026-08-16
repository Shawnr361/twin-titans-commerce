'use client';

import { useRef } from 'react';

/**
 * Tips toward the cursor in 3D. Fine-pointer only; the angles are tiny
 * (max ~4°) because anything more turns a product photograph into a toy.
 */
export function TiltCard({
  children,
  max = 4,
  lift = 4,
  className = '',
}: {
  children: React.ReactNode;
  max?: number;
  lift?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const rect = node.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;

    node.style.setProperty('--ry', `${(px * max * 2).toFixed(2)}deg`);
    node.style.setProperty('--rx', `${(-py * max * 2).toFixed(2)}deg`);
    node.style.setProperty('--ty', `${-lift}px`);
  };

  const reset = () => {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty('--rx', '0deg');
    node.style.setProperty('--ry', '0deg');
    node.style.setProperty('--ty', '0px');
  };

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={reset} className={`tilt-card ${className}`}>
      {children}
    </div>
  );
}
