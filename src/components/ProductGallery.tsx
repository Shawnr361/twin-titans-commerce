'use client';

import { useState } from 'react';

export function ProductGallery({
  images,
  title,
}: {
  images: { url: string; alt: string }[];
  title: string;
}) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="panel grid aspect-square place-items-center text-sm text-mut">
        No images yet
      </div>
    );
  }

  const current = images[Math.min(active, images.length - 1)];

  return (
    <div className="space-y-3">
      <div className="panel relative aspect-square overflow-hidden bg-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.alt || title}
          className="h-full w-full object-cover"
          // The first image is the LCP element on this page — never lazy-load it.
          loading="eager"
          fetchPriority="high"
        />
      </div>

      {images.length > 1 && (
        <div className="scroll-x flex gap-2.5">
          {images.map((img, i) => (
            <button
              key={img.url + i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1} of ${images.length}`}
              aria-current={i === active}
              className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl border transition ${
                i === active ? 'border-accent' : 'border-line hover:border-accent/50'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
