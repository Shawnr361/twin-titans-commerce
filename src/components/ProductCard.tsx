'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { Price } from './Price';

export interface ProductCardData {
  handle: string;
  title: string;
  imageUrl: string | null;
  priceMinor: number;
  compareAtMinor: number | null;
  currency: string;
  /** Marketing landing page, if this product has one. */
  landingPageHandle: string | null;
  variantCount: number;
  badge?: string | null;
}

/**
 * Product card.
 *
 * `href` is the important line. On the old store every card site-wide linked
 * straight to the product page, which skipped the marketing landing page and
 * dropped buyers into a checkout-adjacent page cold. Cards route to the landing
 * page whenever one exists — the funnel rule, enforced in the one component
 * every grid uses rather than remembered per-page.
 */
export function ProductCard({ product }: { product: ProductCardData }) {
  const ref = useRef<HTMLAnchorElement>(null);

  const href = product.landingPageHandle
    ? `/pages/${product.landingPageHandle}`
    : `/products/${product.handle}`;

  const onMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${px * 7}deg) rotateX(${-py * 7}deg) translateY(-4px)`;
  };

  const onLeave = () => {
    if (ref.current) ref.current.style.transform = '';
  };

  const discount =
    product.compareAtMinor && product.compareAtMinor > product.priceMinor
      ? Math.round((1 - product.priceMinor / product.compareAtMinor) * 100)
      : 0;

  return (
    <Link
      ref={ref}
      href={href}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="tilt group panel block overflow-hidden hover:border-accent/50"
    >
      <div className="relative aspect-square overflow-hidden bg-black/40">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-mut">No image</div>
        )}

        {discount > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-white shadow-glow">
            -{discount}%
          </span>
        )}
        {product.badge && (
          <span className="absolute right-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-accent2 backdrop-blur">
            {product.badge}
          </span>
        )}
      </div>

      <div className="space-y-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{product.title}</h3>
        <div className="flex items-baseline gap-2">
          <Price
            minor={product.priceMinor}
            currency={product.currency}
            className="text-base font-bold text-ink"
            prefix={product.variantCount > 1 ? 'From' : undefined}
          />
          {product.compareAtMinor && product.compareAtMinor > product.priceMinor && (
            <Price
              minor={product.compareAtMinor}
              currency={product.currency}
              className="text-xs"
              strike
            />
          )}
        </div>
      </div>
    </Link>
  );
}
