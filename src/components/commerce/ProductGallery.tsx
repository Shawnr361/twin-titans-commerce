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
type GalleryItem = { kind: 'image' | 'video'; url: string; alt: string };

export function ProductGallery({
  images,
  videos = [],
  title,
}: {
  images: GalleryImage[];
  videos?: string[];
  title: string;
}) {
  /*
   * Video was captured from the supplier all along but had nowhere to live, so
   * the page only ever rendered stills. Images lead so the hero stays the hero;
   * clips follow.
   */
  const items: GalleryItem[] = [
    ...images.map((i) => ({ kind: 'image' as const, url: i.url, alt: i.alt })),
    ...videos.map((url) => ({ kind: 'video' as const, url, alt: title })),
  ];
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
    const index = items.findIndex((item) => item.url === activeUrl);
    if (index < 0) return;

    setActive(index);
    // The mobile filmstrip is scroll-driven, so it has to be moved to match.
    const strip = stripRef.current;
    if (strip) {
      strip.scrollTo({ left: index * strip.clientWidth, behavior: 'smooth' });
    }
  }, [activeUrl, items]);

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

  if (items.length === 0) {
    return (
      <div className="media aspect-product flex items-center justify-center">
        <span className="label">No image</span>
      </div>
    );
  }

  const current = items[Math.min(active, items.length - 1)];

  return (
    <div className="lg:flex lg:items-start lg:gap-5">
      {/* Thumbnail rail — desktop only */}
      {items.length > 1 && (
        <div
          /*
           * Capped and scrollable. A listing with 21 thumbnails made this
           * column 1920px tall, and since the frame sits beside it the frame
           * inherited that height — which is what left the picture floating in
           * a placeholder several times its size. The rail scrolls now instead
           * of setting the height of the whole row.
           */
          className="hidden max-h-[70vh] w-20 shrink-0 flex-col gap-3 overflow-y-auto lg:flex"
          role="tablist"
          aria-label="Product images"
        >
          {items.map((item, i) => (
            <button
              key={item.url + i}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`View ${item.kind} ${i + 1} of ${items.length}`}
              onClick={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
              className={`media aspect-product w-full border transition-colors duration-2 ${
                i === active ? 'border-onyx' : 'border-transparent hover:border-ruleStrong'
              }`}
            >
              {item.kind === 'video' ? (
                <span className="flex h-full items-center justify-center bg-onyx/85 text-bone">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt="" loading="lazy" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Main frame — desktop */}
      {/*
        * No fixed aspect on the frame, and deliberately not .media — that class
        * stretches its image to width:100%;height:100%, so a square frame turns
        * a wide banner into a thin strip floating in dead space. Supplier
        * galleries mix square pack shots, tall spec panels and wide banners, so
        * the frame takes the shape of whatever it is showing and is bounded by
        * a max height instead. Automatic for every product, now and later.
        */}
      <div
        ref={frameRef}
        onMouseMove={current.kind === 'image' ? onMove : undefined}
        onMouseDown={current.kind === 'image' ? () => setZooming(true) : undefined}
        onMouseUp={() => setZooming(false)}
        onMouseLeave={() => setZooming(false)}
        className={`relative hidden max-h-[70vh] min-h-[320px] flex-1 items-center justify-center overflow-hidden bg-bone2 lg:flex ${
          current.kind === 'image' ? (zooming ? 'cursor-zoom-out' : 'cursor-zoom-in') : ''
        }`}
      >
        {current.kind === 'video' ? (
          <video
            key={current.url}
            src={current.url}
            controls
            playsInline
            preload="metadata"
            className="max-h-[70vh] w-auto max-w-full"
          />
        ) : (
          <>
            {/*
              * object-contain, not cover. Supplier galleries mix square pack
              * shots with tall spec panels and wide banners, and a cover crop
              * on those shows the middle of one letter at four times its size.
              * Containing is automatic: every image, now and in future, is
              * shown whole whatever shape it arrives in.
              */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={current.alt || title}
              fetchPriority="high"
              className={`max-h-[70vh] w-auto max-w-full object-contain transition-transform duration-5 ${
                zooming ? 'scale-[2.1]' : ''
              }`}
              style={zooming ? { transformOrigin: 'var(--zx, 50%) var(--zy, 50%)' } : undefined}
            />
            {!zooming && (
              <span className="label absolute bottom-3 left-3 bg-paper/85 px-2 py-1 !text-[0.6875rem]">
                Hold to zoom
              </span>
            )}
          </>
        )}
      </div>

      {/* Filmstrip — mobile */}
      <div className="lg:hidden">
        <div
          ref={stripRef}
          className="flex snap-x snap-mandatory overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {items.map((item, i) => (
            <div
              key={item.url + i}
              className="media aspect-[4/3] w-full shrink-0 snap-center bg-bone2"
            >
              {item.kind === 'video' ? (
                <video
                  src={item.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full !object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={i === 0 ? item.alt || title : ''}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  className="!object-contain"
                />
              )}
            </div>
          ))}
        </div>

        {items.length > 1 && (
          <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
            {items.map((_, i) => (
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
