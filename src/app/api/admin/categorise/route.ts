import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { categorise } from '@/lib/categorise';
import { ensureCollection } from '@/lib/filing';

/**
 * File existing products into collections.
 *
 * This is a maintenance job that would normally be a CLI script, and it was
 * one — until the script proved unrunnable here. Node aborts on startup with
 * `uv_thread_create` failing, because its worker threads count against the
 * account's LVE process cap, which this host keeps close to exhausted. No
 * combination of env vars fixes that; a fresh Node process simply cannot start
 * reliably.
 *
 * So the work happens inside the Passenger worker that is already running. No
 * new process, no thread creation, nothing to exhaust. On a host where
 * spawning is the unreliable part, maintenance belongs in the app.
 *
 * POST { apply: false } reports what it would do and changes nothing.
 * POST { apply: true }  files them.
 */
const schema = z.object({
  apply: z.boolean().optional(),
  /*
   * Re-examine products that ALREADY have a category.
   *
   * Off by default, because moving a product a merchant filed by hand would be
   * rude and invisible. But filing only unfiled products means a rule added
   * later never reaches the catalogue: a gaming mouse imported before "gaming
   * mouse" was a keyword sat in Gadgets & Lighting for good, and the fix looked
   * like it had done nothing.
   */
  refile: z.boolean().optional(),
});

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
  const refile = parsed.success ? Boolean(parsed.data.refile) : false;

  const [products, collections] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true,
        title: true,
        productType: true,
        collections: { select: { collectionId: true } },
      },
    }),
    prisma.collection.findMany({ select: { id: true, handle: true } }),
  ]);

  const byHandle = new Map(collections.map((c) => [c.handle, c.id]));

  const planned: { title: string; handle: string }[] = [];
  const unmatched: string[] = [];
  const missingCollection: { title: string; handle: string }[] = [];
  const createdCollections = new Set<string>();
  let alreadyFiled = 0;

  const byId = new Map(collections.map((c) => [c.id, c.handle]));
  const moved: { title: string; from: string; to: string }[] = [];

  for (const product of products) {
    if (product.collections.length > 0) {
      if (!refile) {
        alreadyFiled++;
        continue;
      }
      /*
       * Only a product whose CURRENT filing disagrees with the rules is moved,
       * and only when the rules have an opinion at all. A product the rules
       * cannot place is left exactly where it is rather than being emptied out
       * of a category someone chose deliberately.
       */
      const should = categorise(product.title, product.productType);
      const current = product.collections
        .map((c) => byId.get(c.collectionId))
        .filter((h): h is string => Boolean(h));
      if (!should || current.includes(should)) {
        alreadyFiled++;
        continue;
      }
      const target = byHandle.get(should);
      if (!target) {
        missingCollection.push({ title: product.title, handle: should });
        continue;
      }
      moved.push({ title: product.title, from: current.join(', ') || '(none)', to: should });
      if (apply) {
        await prisma.collectionProduct.deleteMany({ where: { productId: product.id } });
        await prisma.collectionProduct.createMany({
          data: [{ productId: product.id, collectionId: target }],
          skipDuplicates: true,
        });
      }
      continue;
    }
    const handle = categorise(product.title, product.productType);
    if (!handle) {
      unmatched.push(product.title);
      continue;
    }
    /*
     * Create the department if the rule set defines one we do not have yet.
     * Adding a rule should be enough to add a category — otherwise "Gaming"
     * exists as a rule that files products into a collection nobody can
     * browse, which reads as products silently vanishing.
     *
     * Only on apply: a dry run must not write anything.
     */
    let collectionId = byHandle.get(handle);
    if (!collectionId && apply) {
      const created = await ensureCollection(handle);
      if (created) {
        collectionId = created;
        byHandle.set(handle, created);
        createdCollections.add(handle);
      }
    }
    if (!collectionId) {
      missingCollection.push({ title: product.title, handle });
      continue;
    }
    planned.push({ title: product.title, handle });
    if (apply) {
      await prisma.collectionProduct.createMany({
        data: [{ productId: product.id, collectionId }],
        skipDuplicates: true,
      });
    }
  }

  return NextResponse.json({
    applied: apply,
    totalProducts: products.length,
    collections: collections.map((c) => c.handle),
    filed: planned,
    alreadyFiled,
    moved,
    // Named plainly: these were left alone on purpose, not skipped by accident.
    noMatch: unmatched,
    collectionMissing: missingCollection,
    createdCollections: [...createdCollections],
  });
}
