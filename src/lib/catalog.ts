import { prisma } from './db';
import type { ProductCardData } from '@/components/commerce/ProductCard';

/** The minimum a product row needs to render as a card. */
export interface CardSource {
  handle: string;
  title: string;
  vendor?: string | null;
  landingPageHandle: string | null;
  images: { url: string }[];
  variants: { priceMinor: number; compareAtMinor: number | null }[];
}

/**
 * Shape a product row into card data.
 *
 * The headline price is the CHEAPEST variant, paired with that same variant's
 * compare-at. Mixing the two across variants is how a product ends up
 * advertising a reduction it does not actually offer.
 */
export function toCard(p: CardSource, currency: string): ProductCardData {
  const cheapest = p.variants.reduce<CardSource['variants'][number] | null>(
    (best, v) => (best === null || v.priceMinor < best.priceMinor ? v : best),
    null
  );

  return {
    handle: p.handle,
    title: p.title,
    vendor: p.vendor ?? null,
    imageUrl: p.images[0]?.url ?? null,
    secondaryImageUrl: p.images[1]?.url ?? null,
    priceMinor: cheapest?.priceMinor ?? 0,
    compareAtMinor: cheapest?.compareAtMinor ?? null,
    currency,
    landingPageHandle: p.landingPageHandle,
    variantCount: p.variants.length,
  };
}

/** Two images: the second is the hover swap on the card. */
export const CARD_SELECT = {
  handle: true,
  title: true,
  vendor: true,
  landingPageHandle: true,
  images: { select: { url: true }, orderBy: { position: 'asc' }, take: 2 },
  variants: { select: { priceMinor: true, compareAtMinor: true } },
} as const;

export async function getActiveProducts(limit = 24) {
  return prisma.product.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: CARD_SELECT,
  });
}
