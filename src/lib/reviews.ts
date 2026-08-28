import { prisma } from '@/lib/db';

/**
 * Reviews, and the supplier-quality signal built on top of them.
 *
 * WHY ELIGIBILITY IS THE WHOLE DESIGN
 * -----------------------------------
 * The point of these reviews is not decoration — it is to learn which suppliers
 * are worth keeping. That only works if every review comes from someone who
 * actually received the goods, so there is deliberately no way to leave one
 * without an order that was PAID and whose supplier shipment reached DELIVERED.
 *
 * Delivery is checked PER PRODUCT, not per order. An order can split across
 * two suppliers; one parcel arriving does not entitle the customer to review
 * the item still in transit — and crediting the wrong supplier would poison the
 * exact signal this exists to produce.
 */

export const MIN_RATING = 1;
export const MAX_RATING = 5;
/** Long enough to say something useful, short enough to stay readable. */
export const MAX_BODY = 2000;

export interface ReviewableProduct {
  productId: string;
  title: string;
  handle: string | null;
  imageUrl: string | null;
  alreadyReviewed: boolean;
}

/**
 * What this order may review.
 *
 * Both the order number and the email must match, exactly as order tracking
 * requires: order numbers are sequential and guessable, so the email is the
 * shared secret that stops anyone reviewing as somebody else.
 */
export async function reviewableProducts(
  orderNumber: number,
  email: string
): Promise<{ orderId: string; products: ReviewableProduct[] } | null> {
  const order = await prisma.order.findFirst({
    where: { number: orderNumber, email: email.trim().toLowerCase() },
    select: {
      id: true,
      paymentStatus: true,
      lineItems: {
        select: {
          id: true,
          productTitle: true,
          productHandle: true,
          imageUrl: true,
          variant: { select: { productId: true } },
        },
      },
      supplierOrders: {
        select: {
          status: true,
          items: { select: { orderLineItemId: true } },
        },
      },
      reviews: { select: { productId: true } },
    },
  });

  if (!order) return null;

  // Unpaid means nothing was ever shipped, whatever the supplier rows say.
  if (order.paymentStatus !== 'PAID') {
    return { orderId: order.id, products: [] };
  }

  /* Line items whose own supplier shipment is marked delivered. */
  const deliveredLineIds = new Set(
    order.supplierOrders
      .filter((so) => so.status === 'DELIVERED')
      .flatMap((so) => so.items.map((i) => i.orderLineItemId))
  );

  const reviewed = new Set(order.reviews.map((r) => r.productId));

  const seen = new Set<string>();
  const products: ReviewableProduct[] = [];

  for (const line of order.lineItems) {
    if (!deliveredLineIds.has(line.id)) continue;

    const productId = line.variant?.productId;
    /*
     * A line whose variant was deleted cannot be attributed to a product, and
     * therefore cannot be attributed to a supplier either. Skipped rather than
     * guessed from the handle: a wrong attribution is worse than a missing one.
     */
    if (!productId) continue;

    // One card per product even if it was ordered as two separate lines.
    if (seen.has(productId)) continue;
    seen.add(productId);

    products.push({
      productId,
      title: line.productTitle,
      handle: line.productHandle,
      imageUrl: line.imageUrl,
      alreadyReviewed: reviewed.has(productId),
    });
  }

  return { orderId: order.id, products };
}

export interface CreateReviewInput {
  orderNumber: number;
  email: string;
  productId: string;
  rating: number;
  body: string;
  authorName?: string;
}

export type CreateReviewResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Record a review, re-checking eligibility at write time.
 *
 * The form already knows what is reviewable, but the form is client-side and
 * therefore only a suggestion. Every rule is enforced again here.
 */
export async function createReview(input: CreateReviewInput): Promise<CreateReviewResult> {
  const rating = Math.trunc(input.rating);
  if (!Number.isFinite(rating) || rating < MIN_RATING || rating > MAX_RATING) {
    return { ok: false, reason: `Choose a rating from ${MIN_RATING} to ${MAX_RATING}.` };
  }

  const body = input.body.trim();
  if (body.length < 4) return { ok: false, reason: 'Please write a little about the product.' };
  if (body.length > MAX_BODY) return { ok: false, reason: 'That review is too long.' };

  const eligible = await reviewableProducts(input.orderNumber, input.email);
  if (!eligible) {
    return { ok: false, reason: 'We could not find that order. Check the number and email.' };
  }

  const match = eligible.products.find((p) => p.productId === input.productId);
  if (!match) {
    return {
      ok: false,
      reason: 'You can review a product once it has been delivered to you.',
    };
  }
  if (match.alreadyReviewed) {
    return { ok: false, reason: 'You have already reviewed this product on this order.' };
  }

  const authorName = input.authorName?.trim().slice(0, 120) || null;

  try {
    await prisma.review.create({
      data: {
        productId: input.productId,
        orderId: eligible.orderId,
        email: input.email.trim().toLowerCase(),
        authorName,
        rating,
        body,
      },
    });
  } catch {
    /*
     * The unique index on (orderId, productId) is the real guard against a
     * double submit — two clicks can both pass the check above before either
     * has written.
     */
    return { ok: false, reason: 'You have already reviewed this product on this order.' };
  }

  return { ok: true };
}

export interface RatingSummary {
  average: number;
  count: number;
}

/** Visible reviews only — this is what the storefront and JSON-LD may claim. */
export async function productRating(productId: string): Promise<RatingSummary | null> {
  const result = await prisma.review.aggregate({
    where: { productId, hiddenAt: null },
    _avg: { rating: true },
    _count: { _all: true },
  });

  const count = result._count._all;
  if (!count || result._avg.rating == null) return null;

  return { average: Math.round(result._avg.rating * 10) / 10, count };
}

export interface SupplierQualityRow {
  supplierId: string;
  supplierName: string;
  reviews: number;
  average: number;
  /** Reviews of 2 or below — the ones that signal a supplier problem. */
  poor: number;
  products: number;
}

/**
 * Ratings rolled up to the supplier — the answer to "who do we keep?".
 *
 * Counts HIDDEN reviews too. A review taken off the storefront for its language
 * still describes a parcel that arrived badly, and suppressing that from the
 * supplier's record would defeat the purpose of collecting it.
 *
 * Read the `reviews` column before the average. Four suppliers with one review
 * each will sort in a meaningless order, and a 5.0 from a single customer is
 * not evidence of anything.
 */
export async function supplierQuality(): Promise<SupplierQualityRow[]> {
  const links = await prisma.supplierProduct.findMany({
    select: {
      productId: true,
      supplier: { select: { id: true, name: true } },
    },
  });

  if (links.length === 0) return [];

  const supplierOf = new Map(links.map((l) => [l.productId, l.supplier]));

  const grouped = await prisma.review.groupBy({
    by: ['productId'],
    _avg: { rating: true },
    _count: { _all: true },
  });

  const poorByProduct = await prisma.review.groupBy({
    by: ['productId'],
    where: { rating: { lte: 2 } },
    _count: { _all: true },
  });
  const poorMap = new Map(poorByProduct.map((p) => [p.productId, p._count._all]));

  const acc = new Map<
    string,
    { name: string; sum: number; count: number; poor: number; products: Set<string> }
  >();

  for (const row of grouped) {
    const supplier = supplierOf.get(row.productId);
    // A product with no supplier link cannot be attributed — skip, never guess.
    if (!supplier || row._avg.rating == null) continue;

    const entry =
      acc.get(supplier.id) ??
      { name: supplier.name, sum: 0, count: 0, poor: 0, products: new Set<string>() };

    // Sum of ratings, so the supplier average weights by review volume rather
    // than treating a 1-review product the same as a 40-review one.
    entry.sum += row._avg.rating * row._count._all;
    entry.count += row._count._all;
    entry.poor += poorMap.get(row.productId) ?? 0;
    entry.products.add(row.productId);
    acc.set(supplier.id, entry);
  }

  return [...acc.entries()]
    .map(([supplierId, e]) => ({
      supplierId,
      supplierName: e.name,
      reviews: e.count,
      average: Math.round((e.sum / e.count) * 10) / 10,
      poor: e.poor,
      products: e.products.size,
    }))
    .sort((a, b) => a.average - b.average || b.reviews - a.reviews);
}
