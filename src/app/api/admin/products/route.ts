import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { auditMargin } from '@/lib/pricing';
import { getPricingRules } from '@/lib/settings';
import { fileProduct } from '@/lib/filing';
import { ensureDescription } from '@/lib/copywriter';

const schema = z.object({
  productId: z.string().min(1),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
});

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    include: { variants: true },
  });
  if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });

  // Server-side guard. The UI already blocks this, but the rule that matters is
  // the one enforced where it cannot be bypassed.
  if (parsed.data.status === 'ACTIVE') {
    const rules = await getPricingRules();
    const losing = product.variants
      .map((v) => ({ v, audit: auditMargin(v.priceMinor, v.costMinor, rules) }))
      .filter((x) => x.audit.severity === 'loss');

    if (losing.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot publish: ${losing.length} variant(s) would sell at or below landed cost (${losing
            .map((x) => x.v.title)
            .join(', ')}).`,
        },
        { status: 422 }
      );
    }
  }

  await prisma.product.update({
    where: { id: product.id },
    data: {
      status: parsed.data.status,
      publishedAt:
        parsed.data.status === 'ACTIVE' ? (product.publishedAt ?? new Date()) : product.publishedAt,
    },
  });

  /*
   * File it on the way out the door.
   *
   * Categorisation used to run only at import, so anything the rules did not
   * recognise then stayed uncategorised for good — a live perfume was in no
   * collection at all and reachable only by search. Publishing is the right
   * second chance: it is the moment the product becomes navigable.
   *
   * Never fatal. A product that publishes but does not get filed is a smaller
   * problem than a publish that fails because of a filing error.
   */
  let filing: Awaited<ReturnType<typeof fileProduct>> | null = null;
  let copy: Awaited<ReturnType<typeof ensureDescription>> | null = null;
  if (parsed.data.status === 'ACTIVE') {
    filing = await fileProduct(product.id).catch(() => null);
    /*
     * Imports arrive with an empty description, so without this every product
     * page shows nothing but a supplier title and the meta description falls
     * back to repeating it. Like filing, never fatal: a product that publishes
     * without copy is a smaller problem than a publish that fails.
     */
    copy = await ensureDescription(product.id).catch(() => null);
  }

  return NextResponse.json({ ok: true, filing, copy });
}

const deleteSchema = z.object({
  productId: z.string().min(1),
  /** Required only when the product has already been ordered. */
  force: z.boolean().optional(),
});

/**
 * Remove a product entirely.
 *
 * Safe by construction: OrderLineItem snapshots productTitle, variantTitle, sku
 * and imageUrl, and its variantId is nullable, so a past order stays readable
 * after the product behind it is gone. Images, variants, collection links and
 * the supplier record all cascade.
 *
 * A product that has actually been sold still needs `force`. Losing the link
 * from an order to its variant is recoverable; doing it by accident because a
 * Delete button sat next to a Publish toggle is not.
 */
export async function DELETE(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, title: true },
  });
  if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });

  const soldCount = await prisma.orderLineItem.count({
    where: { variant: { productId: product.id } },
  });

  if (soldCount > 0 && !parsed.data.force) {
    return NextResponse.json(
      {
        error: `"${product.title}" appears on ${soldCount} order line(s). Deleting keeps those orders readable but breaks the link back to the variant.`,
        requiresForce: true,
        soldCount,
      },
      { status: 409 }
    );
  }

  await prisma.product.delete({ where: { id: product.id } });

  return NextResponse.json({ ok: true, deleted: product.title, soldCount });
}
