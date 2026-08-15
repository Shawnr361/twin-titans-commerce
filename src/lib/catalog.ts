import { prisma } from './db';
import type { ProductCardData } from '@/components/ProductCard';

/** Shape a Prisma product row into the card data the grid components expect. */
export interface CardSource {
  handle: string;
  title: string;
  landingPageHandle: string | null;
  images: { url: string }[];
  variants: { priceMinor: number; compareAtMinor: number | null }[];
}

export function toCard(p: CardSource, currency: string): ProductCardData {
  // Show the CHEAPEST variant as the headline price, with the compare-at that
  // belongs to that same variant — mixing the two across variants is how a
  // product ends up advertising a discount it doesn't actually offer.
  const cheapest = p.variants.reduce<CardSource['variants'][number] | null>(
    (best, v) => (best === null || v.priceMinor < best.priceMinor ? v : best),
    null
  );

  return {
    handle: p.handle,
    title: p.title,
    imageUrl: p.images[0]?.url ?? null,
    priceMinor: cheapest?.priceMinor ?? 0,
    compareAtMinor: cheapest?.compareAtMinor ?? null,
    currency,
    landingPageHandle: p.landingPageHandle,
    variantCount: p.variants.length,
  };
}

export const CARD_SELECT = {
  handle: true,
  title: true,
  landingPageHandle: true,
  images: { select: { url: true }, orderBy: { position: 'asc' }, take: 1 },
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
