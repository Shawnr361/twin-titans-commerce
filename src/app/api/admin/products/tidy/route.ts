import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { cleanProductTitle } from '@/lib/suppliers/title';
import { normaliseVendor } from '@/lib/vendor';

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
    select: { id: true, title: true, vendor: true },
  });

  const changes: Change[] = [];
  for (const p of products) {
    const title = cleanProductTitle(p.title);
    if (title && title !== p.title) {
      changes.push({ id: p.id, field: 'title', before: p.title, after: title });
    }
    const vendor = normaliseVendor(p.vendor);
    if (p.vendor && vendor !== p.vendor) {
      changes.push({ id: p.id, field: 'vendor', before: p.vendor, after: vendor });
    }
  }

  if (!apply) {
    return NextResponse.json({
      applied: false,
      scanned: products.length,
      wouldChange: changes.length,
      titles: changes.filter((c) => c.field === 'title').length,
      vendors: changes.filter((c) => c.field === 'vendor').length,
      changes,
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

  return NextResponse.json({ applied: true, scanned: products.length, updated, failures });
}
