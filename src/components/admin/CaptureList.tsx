'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export interface CaptureRow {
  id: string;
  title: string;
  platform: string;
  sourceUrl: string;
  currency: string;
  variantCount: number;
  pricedVariantCount: number;
  imageCount: number;
  videoCount: number;
  reviewCount: number;
  importedProductId: string | null;
  createdAt: string;
  thumbnail: string | null;
}

/**
 * Captures waiting to be priced.
 *
 * The counts are shown prominently, and priced-vs-total is called out in red
 * when they disagree: a capture with 12 variants but 0 prices looks successful
 * at a glance and is worthless. Making that visible here stops it being
 * discovered at the pricing table.
 */
export function CaptureList({
  captures,
  onUse,
}: {
  captures: CaptureRow[];
  onUse: (id: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const remove = async (id: string) => {
    setBusy(id);
    try {
      await fetch(`/api/admin/capture/${id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  if (captures.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="text-body text-greige">
          No captures yet. Use the bookmark on a supplier product page and it will appear here.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {captures.map((c) => {
        const incomplete = c.pricedVariantCount < c.variantCount || c.pricedVariantCount === 0;
        return (
          <li
            key={c.id}
            className={`card flex flex-wrap items-center gap-4 p-4 ${busy === c.id ? 'opacity-50' : ''}`}
          >
            <div className="media aspect-product w-16 shrink-0">
              {c.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.thumbnail} alt="" loading="lazy" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-body text-onyx">{c.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-quiet">
                <span className="tag">{c.platform}</span>
                <span className={incomplete ? 'text-danger' : 'text-verdigris'}>
                  {c.pricedVariantCount}/{c.variantCount} priced
                </span>
                <span>{c.imageCount} images</span>
                {c.videoCount > 0 && <span className="text-gold">{c.videoCount} video</span>}
                {c.reviewCount > 0 && <span>{c.reviewCount} reviews</span>}
                <span>{new Date(c.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {c.importedProductId ? (
                <span className="tag border-verdigris/50 text-verdigris">Imported</span>
              ) : (
                <button type="button" onClick={() => onUse(c.id)} className="btn btn-primary px-5 py-2.5">
                  Price it
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(c.id)}
                disabled={busy === c.id}
                className="link text-label"
              >
                Delete
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
