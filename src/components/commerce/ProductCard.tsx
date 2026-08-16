import Link from 'next/link';
import { TiltCard } from '@/components/motion/TiltCard';
import { Price } from './Price';

export interface ProductCardData {
  handle: string;
  title: string;
  imageUrl: string | null;
  secondaryImageUrl?: string | null;
  priceMinor: number;
  compareAtMinor: number | null;
  currency: string;
  landingPageHandle: string | null;
  variantCount: number;
  vendor?: string | null;
}

/**
 * Product card.
 *
 * Deliberately plain: a 4:5 portrait crop, name, price. No hover lift, no
 * shadow, no rounded corners, no discount starburst. The only motion is a
 * slow image scale and a swap to the second shot — the two things luxury
 * retail actually does.
 *
 * `href` routes to the marketing landing page when one exists. That rule lives
 * here, in the single component every grid uses, so no page can forget it.
 */
export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductCardData;
  priority?: boolean;
}) {
  const href = product.landingPageHandle
    ? `/pages/${product.landingPageHandle}`
    : `/products/${product.handle}`;

  const reduced =
    product.compareAtMinor && product.compareAtMinor > product.priceMinor
      ? Math.round((1 - product.priceMinor / product.compareAtMinor) * 100)
      : 0;

  return (
    <article>
      <Link href={href} className="group block">
        <TiltCard className="media media-hover sheen relative aspect-product">
          {product.imageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.imageUrl}
                alt={product.title}
                loading={priority ? 'eager' : 'lazy'}
                fetchPriority={priority ? 'high' : 'auto'}
              />
              {product.secondaryImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.secondaryImageUrl}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  className="absolute inset-0 opacity-0 transition-opacity duration-3 ease-ease group-hover:opacity-100"
                />
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-label text-quiet">Image to follow</span>
            </div>
          )}

          {reduced > 0 && (
            <span className="tag tag-sale absolute left-3 top-3 z-[2] bg-paper">−{reduced}%</span>
          )}
        </TiltCard>

        <div className="mt-5 space-y-1.5">
          {product.vendor && <p className="text-micro uppercase tracking-label text-quiet">{product.vendor}</p>}

          <h3 className="font-sans text-body font-medium leading-snug text-onyx">
            {product.title}
          </h3>

          <div className="flex items-baseline gap-2.5">
            <Price
              minor={product.priceMinor}
              currency={product.currency}
              className="text-body text-ink"
              prefix={product.variantCount > 1 ? 'From' : undefined}
            />
            {reduced > 0 && product.compareAtMinor && (
              <Price
                minor={product.compareAtMinor}
                currency={product.currency}
                className="text-label"
                strike
              />
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
