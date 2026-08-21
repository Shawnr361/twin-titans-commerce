/**
 * Browser-side capture.
 *
 * WHY THIS EXISTS
 * ---------------
 * Fetching an AliExpress product page from a server returns an anti-bot shell:
 * og: tags and nothing else. No prices, no SKUs, no videos, no reviews. That is
 * not a bug in our parser — it is what the site deliberately serves to
 * datacentre IPs, and no amount of header-spoofing fixes it reliably.
 *
 * The full state DOES exist, in `window.runParams` (and its newer siblings), on
 * the rendered page, in a real browser, with the visitor's own session. So the
 * extraction runs THERE and posts structured JSON back here. This is precisely
 * how DSers, Oberlo, AutoDS and Zendrop work — every one of them ships a
 * browser extension, for exactly this reason.
 *
 * The payload below is the contract between the in-page script and the server.
 * It is deliberately permissive: capture whatever the page happens to expose,
 * validate here, and never fabricate a field that was not present.
 */
import { z } from 'zod';

export const capturedVariantSchema = z.object({
  /** Supplier's own SKU identifier, so a re-order maps to the same option. */
  skuId: z.string().optional(),
  /** e.g. { Colour: "White", Plug: "EU" } */
  options: z.record(z.string(), z.string()).default({}),
  /** Price in the SUPPLIER's currency, as a decimal number. */
  price: z.number().nonnegative(),
  /** Strike-through price, when the listing shows one. */
  compareAtPrice: z.number().nonnegative().optional(),
  stock: z.number().int().nonnegative().optional(),
  imageUrl: z.string().optional(),
});

export const capturedReviewSchema = z.object({
  author: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  body: z.string().max(4000).optional(),
  date: z.string().optional(),
  country: z.string().optional(),
  images: z.array(z.string()).default([]),
});

export const captureSchema = z.object({
  sourceUrl: z.string().min(4),
  platform: z.enum(['ALIEXPRESS', 'ALIBABA', 'C1688', 'OTHER']).default('OTHER'),
  externalId: z.string().optional(),

  title: z.string().min(1),
  descriptionHtml: z.string().default(''),

  /** Supplier currency code, e.g. USD. Costs below are in this currency. */
  currency: z.string().min(3).max(4).default('USD'),

  images: z.array(z.string()).default([]),
  /** Product videos — AliExpress exposes these but a server fetch never sees them. */
  videos: z.array(z.string()).default([]),

  variants: z.array(capturedVariantSchema).default([]),

  shippingCost: z.number().nonnegative().optional(),
  shipsFrom: z.string().optional(),
  deliveryEstimate: z.string().optional(),

  supplierName: z.string().optional(),
  supplierStoreUrl: z.string().optional(),

  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().nonnegative().optional(),
  ordersCount: z.number().int().nonnegative().optional(),
  reviews: z.array(capturedReviewSchema).default([]),

  /** Anything else the page exposed, kept verbatim for later re-mapping. */
  raw: z.unknown().optional(),
});

export type CapturedProduct = z.infer<typeof captureSchema>;

/**
 * Quality report for a capture.
 *
 * The importer refuses to price anything it cannot cost, so the single most
 * important question about a capture is "did we get real prices?". This makes
 * that explicit rather than letting a zero slip through as a 98% margin.
 */
export interface CaptureQuality {
  ok: boolean;
  variantCount: number;
  pricedVariantCount: number;
  imageCount: number;
  videoCount: number;
  reviewCount: number;
  problems: string[];
}

export function assessCapture(c: CapturedProduct): CaptureQuality {
  const problems: string[] = [];
  const priced = c.variants.filter((v) => v.price > 0);

  if (c.variants.length === 0) {
    problems.push('No variants were captured — the page may not have finished loading.');
  }
  if (priced.length === 0) {
    problems.push('No prices were captured. A product cannot be priced without its cost.');
  } else if (priced.length < c.variants.length) {
    problems.push(
      `${c.variants.length - priced.length} of ${c.variants.length} variants have no price.`
    );
  }
  /*
   * A supplier sale price is what we would pay today, not what we will pay on
   * the reorder. Pricing retail against a promotional cost is how a healthy
   * margin quietly turns into a loss the week the promotion ends — and these
   * listings run near-permanent countdown sales, so it is the normal case, not
   * an edge one.
   */
  const promo = priced.filter(
    (v) => v.compareAtPrice != null && v.compareAtPrice > v.price * 1.3
  );
  if (promo.length > 0) {
    const deepest = Math.max(
      ...promo.map((v) => Math.round((1 - v.price / (v.compareAtPrice as number)) * 100))
    );
    problems.push(
      `${promo.length} of ${priced.length} priced variant(s) are on a supplier promotion, up to ${deepest}% off. That discounted figure is the cost being priced against — confirm it still holds when you reorder.`
    );
  }

  if (c.images.length === 0) problems.push('No images were captured.');

  return {
    ok: priced.length > 0 && c.variants.length > 0,
    variantCount: c.variants.length,
    pricedVariantCount: priced.length,
    imageCount: c.images.length,
    videoCount: c.videos.length,
    reviewCount: c.reviews.length,
    problems,
  };
}
