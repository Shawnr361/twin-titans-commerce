'use client';

import { useEffect, useRef, useState } from 'react';
import { useVariantMedia } from './VariantMediaContext';

export interface GalleryImage {
  url: string;
  alt: string;
}

/**
 * Product gallery.
 *
 * Desktop: a vertical thumbnail rail beside a large frame with cursor-tracked
 * zoom — press and hold to magnify, which is the interaction luxury retail
 * uses instead of a modal lightbox.
 *
 * Mobile: a snap-scrolling filmstrip with dot indicators. A carousel with
 * arrows is worse than a native swipe on touch.
 *
 * Zoom is deliberately pointer-driven rather than a click-to-open overlay so
 * the customer never loses their place on the page.
 */
export function ProductGallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [active, setActive] = useState(0);
  const [zooming, setZooming] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const { activeUrl } = useVariantMedia();

  /*
   * Choosing a colour moves the gallery to that colour's photo, the way the
   * supplier's own page behaves. Variant images are merged into this list
   * upstream, so the URL is normally present; when it is not — an older import,
   * or a variant that never carried a photo — the gallery deliberately stays
   * put rather than blanking out the frame.
   */
  useEffect(() => {
    if (!activeUrl) return;
    const index = images.findIndex((image) => image.url === activeUrl);
    if (index < 0) return;

    setActive(index);
    // The mobile filmstrip is scroll-driven, so it has to be moved to match.
    const strip = stripRef.current;
    if (strip) {
      strip.scrollTo({ left: index * strip.clientWidth, behavior: 'smooth' });
    }
  }, [activeUrl, images]);

  // Keep the mobile dot indicator in step with the filmstrip.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const index = Math.round(strip.scrollLeft / strip.clientWidth);
        setActive((current) => (current === index ? current : index));
      });
    };

    strip.addEventListener('scroll', onScroll, { passive: true });
    return () => strip.removeEventListener('scroll', onScroll);
  }, []);

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const frame = frameRef.current;
    if (!frame || !zooming) return;
    const rect = frame.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    frame.style.setProperty('--zx', `${x}%`);
    frame.style.setProperty('--zy', `${y}%`);
  };

  if (images.length === 0) {
    return (
      <div className="media aspect-product flex items-center justify-center">
        <span className="label">No image</span>
      </div>
    );
  }

  const current = images[Math.min(active, images.length - 1)];

  return (
    <div className="lg:flex lg:gap-5">
      {/* Thumbnail rail — desktop only */}
      {images.length > 1 && (
        <div
          className="hidden w-20 shrink-0 flex-col gap-3 lg:flex"
          role="tablist"
          aria-label="Product images"
        >
          {images.map((image, i) => (
            <button
              key={image.url + i}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`View image ${i + 1} of ${images.length}`}
              onClick={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
              className={`media aspect-product w-full border transition-colors duration-2 ${
                i === active ? 'border-onyx' : 'border-transparent hover:border-ruleStrong'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {/* Main frame — desktop */}
      <div
        ref={frameRef}
        onMouseMove={onMove}
        onMouseDown={() => setZooming(true)}
        onMouseUp={() => setZooming(false)}
        onMouseLeave={() => setZooming(false)}
        className={`media aspect-product hidden flex-1 lg:block ${zooming ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.alt || title}
          fetchPriority="high"
          className={zooming ? 'scale-[2.1]' : ''}
          style={zooming ? { transformOrigin: 'var(--zx, 50%) var(--zy, 50%)' } : undefined}
        />
        {!zooming && (
          <span className="label absolute bottom-3 left-3 bg-paper/85 px-2 py-1 !text-[0.6875rem]">
            Hold to zoom
          </span>
        )}
      </div>

      {/* Filmstrip — mobile */}
      <div className="lg:hidden">
        <div
          ref={stripRef}
          className="flex snap-x snap-mandatory overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {images.map((image, i) => (
            <div key={image.url + i} className="media aspect-product w-full shrink-0 snap-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={i === 0 ? image.alt || title : ''}
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : 'auto'}
              />
            </div>
          ))}
        </div>

        {images.length > 1 && (
          <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-[3px] w-6 transition-colors duration-2 ${
                  i === active ? 'bg-onyx' : 'bg-ruleStrong'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
