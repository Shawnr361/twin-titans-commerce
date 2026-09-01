import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { cleanProductTitle } from '@/lib/suppliers/title';
import { normaliseVendor } from '@/lib/vendor';
import { isPlaceholderOptions } from '@/lib/suppliers/variants';

export const dynamic = 'force-dynamic';

/**
 * Bring products already in the catalogue up to the rules that now run on
 * every import: a title fit for a card, and a vendor line that names a brand
 * or nothing at all.
 *
 * Both are safe to run twice — an already-tidy product produces no change, and
 * only genuine differences are written.
 *
 * DEFAULTS TO A DRY RUN
 * ---------------------
 * This rewrites every product in one call, and a title is what a customer
 * reads and what Google indexes. Nothing is written unless the request says
 * `{"apply": true}`.
 *
 * HANDLES ARE NEVER TOUCHED
 * -------------------------
 * A product's URL is derived from its title at creation. Regenerating handles
 * would break every link already shared and every page already indexed, for a
 * cosmetic gain. Titles change; addresses do not.
 *
 * PADDING VARIANTS ARE DELETED, NEVER ORDERED ONES
 * ------------------------------------------------
 * Listings arrive with attribute-less SKUs that the picker has to label
 * "Option 2" because they have no name — the same product, offered twice. They
 * are removed, but a variant that appears on any order line is left alone and
 * reported instead: an order must keep saying what was actually bought, and a
 * tidy-up is never worth rewriting history. Every product keeps at least one
 * variant, since a product with none cannot be bought.
 *
 * VENDOR IS CLEARED, NOT REWRITTEN
 * --------------------------------
 * Where a vendor is a marketplace storefront handle rather than a maker, the
 * field is set to null. Nothing is lost: which supplier an item is reordered
 * from lives on the Supplier record, which this never touches.
 */
const schema = z.object({ apply: z.boolean().optional() });

interface Change {
  id: string;
  field: 'title' | 'vendor';
  before: string | null;
  after: string | null;
}

interface VariantDrop {
  productId: string;
  productTitle: string;
  variantId: string;
  variantTitle: string;
  /** Set when the variant is kept despite being padding, with the reason. */
  keptBecause?: string;
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  const apply = parsed.success ? Boolean(parsed.data.apply) : false;

  const products = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      vendor: true,
      variants: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          title: true,
          optionValues: true,
          _count: { select: { lineItems: true } },
        },
      },
    },
  });

  const changes: Change[] = [];
  const drops: VariantDrop[] = [];
  for (const p of products) {
    const title = cleanProductTitle(p.title);
    if (title && title !== p.title) {
      changes.push({ id: p.id, field: 'title', before: p.title, after: title });
    }
    const vendor = normaliseVendor(p.vendor);
    if (p.vendor && vendor !== p.vendor) {
      changes.push({ id: p.id, field: 'vendor', before: p.vendor, after: vendor });
    }

    /*
     * Mirrors realVariants(), but over stored rows: where some variants carry
     * attributes the attribute-less ones are padding; where none do, the first
     * is the real one and the rest are copies of it.
     */
    if (p.variants.length > 1) {
      const named = p.variants.filter((v) => !isPlaceholderOptions(v.optionValues));
      const keep = new Set(
        (named.length > 0 ? named : p.variants.slice(0, 1)).map((v) => v.id)
      );
      for (const v of p.variants) {
        if (keep.has(v.id)) continue;
        drops.push({
          productId: p.id,
          productTitle: p.title,
          variantId: v.id,
          variantTitle: v.title,
          ...(v._count.lineItems > 0
            ? { keptBecause: `on ${v._count.lineItems} order line(s)` }
            : {}),
        });
      }
    }
  }

  const removable = drops.filter((d) => !d.keptBecause);

  if (!apply) {
    return NextResponse.json({
      applied: false,
      scanned: products.length,
      wouldChange: changes.length,
      titles: changes.filter((c) => c.field === 'title').length,
      vendors: changes.filter((c) => c.field === 'vendor').length,
      paddingVariants: removable.length,
      variantsKeptBecauseOrdered: drops.filter((d) => d.keptBecause),
      changes,
      drops: removable,
    });
  }

  /*
   * One product at a time rather than a transaction: a single odd row must not
   * roll back the other ninety-nine, and no change here depends on another.
   */
  let updated = 0;
  const failures: string[] = [];
  for (const c of changes) {
    try {
      await prisma.product.update({
        where: { id: c.id },
        data: c.field === 'title' ? { title: c.after as string } : { vendor: c.after },
      });
      updated++;
    } catch (err) {
      failures.push(`${c.id} (${c.field}): ${err instanceof Error ? err.message : 'failed'}`);
    }
  }

  let variantsRemoved = 0;
  for (const d of removable) {
    try {
      await prisma.variant.delete({ where: { id: d.variantId } });
      variantsRemoved++;
    } catch (err) {
      failures.push(
        `${d.productTitle} / ${d.variantTitle}: ${err instanceof Error ? err.message : 'failed'}`
      );
    }
  }

  return NextResponse.json({
    applied: true,
    scanned: products.length,
    updated,
    variantsRemoved,
    variantsKeptBecauseOrdered: drops.filter((d) => d.keptBecause).length,
    failures,
  });
}
