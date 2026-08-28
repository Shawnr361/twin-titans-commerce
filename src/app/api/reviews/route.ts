import { NextResponse } from 'next/server';
import { z } from 'zod';
import { MAX_BODY, MAX_RATING, MIN_RATING, createReview, reviewableProducts } from '@/lib/reviews';

/**
 * Customer review endpoints.
 *
 * Identity is "order number + the email it was placed with", the same shared
 * secret order tracking uses. No accounts exist on this store, and inventing a
 * login just to leave a review would cost more reviews than it protected.
 */

const lookupSchema = z.object({
  orderNumber: z.number().int().positive(),
  email: z.string().email(),
});

const createSchema = lookupSchema.extend({
  productId: z.string().min(1),
  rating: z.number().int().min(MIN_RATING).max(MAX_RATING),
  body: z.string().min(4).max(MAX_BODY),
  authorName: z.string().max(120).optional(),
});

/** What may this order review? Used to build the form. */
export async function PUT(request: Request) {
  const parsed = lookupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Enter your order number and the email you ordered with.' },
      { status: 400 }
    );
  }

  const result = await reviewableProducts(parsed.data.orderNumber, parsed.data.email).catch(
    () => null
  );

  /*
   * A wrong number and a wrong email give the same answer, deliberately: any
   * difference would let someone probe which order numbers exist.
   */
  if (!result) {
    return NextResponse.json(
      { error: 'We could not find that order. Check the number and email address.' },
      { status: 404 }
    );
  }

  return NextResponse.json({ products: result.products });
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please choose a rating and write a few words.' },
      { status: 400 }
    );
  }

  const result = await createReview(parsed.data).catch(() => null);
  if (!result) {
    return NextResponse.json({ error: 'Could not save your review just now.' }, { status: 500 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
