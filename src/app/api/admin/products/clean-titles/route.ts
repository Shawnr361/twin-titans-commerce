import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { cleanProductTitle } from '@/lib/suppliers/title';

export const dynamic = 'force-dynamic';

/**
 * Apply the import-time title cleaner to products already in the catalogue.
 *
 * New imports are cleaned on the way in, so this exists only to catch up the
 * ones that arrived before that existed. It is safe to run twice: cleaning an
 * already-clean title returns it unchanged, and only genuine differences are
 * written.
 *
 * DEFAULTS TO A DRY RUN
 * ---------------------
 * A title is what a customer reads and what Google indexes, and this rewrites
 * every product in one call. So it previews unless explicitly told otherwise —
 * `{"apply": true}` is the only thing that writes.
 *
 * HANDLES ARE NEVER TOUCHED
 * -------------------------
 * The URL is derived from the title at creation. Regenerating handles here
 * would break every link already shared and every page Google has indexed, for
 * a cosmetic gain. Titles change; addresses do not.
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
  const apply = parsed.success ? Boolean(parsed.data.apply) : false;

  const products = await prisma.product.findMany({ select: { id: true, title: true } });

  const changes = products
    .map((p) => ({ id: p.id, before: p.title, after: cleanProductTitle(p.title) }))
    .filter((c) => c.after && c.after !== c.before);

  if (!apply) {
    return NextResponse.json({
      applied: false,
      scanned: products.length,
      wouldChange: changes.length,
      changes,
    });
  }

  // One at a time rather than a transaction: a single odd title must not roll
  // back the other ninety-nine, and nothing here depends on the others.
  let updated = 0;
  const failures: string[] = [];
  for (const c of changes) {
    try {
      await prisma.product.update({ where: { id: c.id }, data: { title: c.after } });
      updated++;
    } catch (err) {
      failures.push(`${c.id}: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }

  return NextResponse.json({ applied: true, scanned: products.length, updated, failures, changes });
}
