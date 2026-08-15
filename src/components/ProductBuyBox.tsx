'use client';

import { AddToCart, type VariantOption } from './AddToCart';

/**
 * Thin client wrapper so the product page can stay a server component while the
 * variant picker keeps its interactivity.
 */
export function ProductBuyBox({
  variants,
  currency,
}: {
  variants: VariantOption[];
  currency: string;
}) {
  return <AddToCart variants={variants} currency={currency} />;
}
