import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Remove the struck-through "was" prices that were generated, not real.
 *
 * Every compare-at price in the catalogue came from computePrice multiplying
 * the selling price by 1.45 — nothing in admin has ever let one be typed in —
 * so none of them is a price the product was actually offered at. computePrice
 * no longer generates them; this clears the ones already stored, which is what
 * takes the "-31%" badges off the storefront.
 *
 * DRY RUN BY DEFAULT: without {"apply": true} it only counts. One updateMany,
 * so it cannot half-finish.
 */
const schema = z.object({ apply: z.boolean().optional() });

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
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const where = { compareAtMinor: { not: null } };
  const [variants, products] = await Promise.all([
    prisma.variant.count({ where }),
    prisma.product.count({ where: { variants: { some: where } } }),
  ]);

  if (!parsed.data.apply) {
    return NextResponse.json({ dryRun: true, variantsWithWasPrice: variants, products });
  }

  const cleared = await prisma.variant.updateMany({ where, data: { compareAtMinor: null } });
  const remaining = await prisma.variant.count({ where });
  return NextResponse.json({ dryRun: false, cleared: cleared.count, products, remaining });
}
