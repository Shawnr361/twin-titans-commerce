'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export interface HeroSlide {
  handle: string;
  title: string;
  url: string;
}

/**
 * The hero image, cycling through the catalogue.
 *
 * A cross-fade rather than a hard slide: the hero is a single framed picture,
 * not a strip, so sliding one image out drags the eye sideways to nothing.
 * Fading with a slow drift keeps attention on the product and suits the rest
 * of the page.
 *
 * Every slide is a link, so the rotation is a real route into the catalogue
 * rather than decoration. It pauses on hover and on focus — nothing is more
 * irritating than a picture that changes as you reach for it — and stops
 * entirely while the tab is hidden, which also spares this host the wasted
 * repaints.
 *
 * Under prefers-reduced-motion it does not rotate at all: the first product
 * stays put, and the dots still work if someone wants to look through them.
 */
export function HeroCarousel({
  slides,
  intervalMs = 5000,
}: {
  slides: HeroSlide[];
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (slides.length < 2 || paused || reduced.current) return;

    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      setIndex((i) => (i + 1) % slides.length);
    };
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [slides.length, paused, intervalMs]);

  if (slides.length === 0) return null;

  return (
    <div
      className="media h-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured products"
    >
      {slides.map((slide, i) => {
        const isCurrent = i === index;
        return (
          <Link
            key={slide.handle}
            href={`/products/${slide.handle}`}
            tabIndex={isCurrent ? 0 : -1}
            aria-hidden={!isCurrent}
            className={`absolute inset-0 transition-opacity duration-1000 ease-ease ${
              isCurrent ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.url}
              alt={slide.title}
              loading={i === 0 ? 'eager' : 'lazy'}
              fetchPriority={i === 0 ? 'high' : 'auto'}
              className={`h-full w-full object-cover transition-transform duration-5 ${
                isCurrent ? 'scale-100' : 'scale-[1.04]'
              }`}
            />
          </Link>
        );
      })}

      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 z-[2] flex items-end justify-between gap-4 bg-gradient-to-t from-onyx/70 to-transparent px-5 pb-5 pt-12">
          <p className="line-clamp-1 text-micro uppercase tracking-label text-bone/90">
            {slides[index].title}
          </p>
          <div className="flex shrink-0 gap-1.5" role="tablist" aria-label="Choose a product">
            {slides.map((slide, i) => (
              <button
                key={slide.handle}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={slide.title}
                onClick={() => setIndex(i)}
                className={`h-[3px] w-6 transition-colors duration-2 ${
                  i === index ? 'bg-bone' : 'bg-bone/35 hover:bg-bone/70'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
