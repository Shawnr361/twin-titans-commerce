/*
 * NOTE: on the Go54 host this script cannot run. Node aborts at startup with
 * `uv_thread_create` failing, because its worker threads count against the
 * account's LVE process cap. Use the admin route instead, which does the same
 * work inside the already-running Passenger worker:
 *
 *   POST /api/admin/categorise  { "apply": false }   // report only
 *   POST /api/admin/categorise  { "apply": true }    // file them
 *
 * This script is kept for local use, where spawning a process works.
 *
 * File already-imported products into collections.
 *
 * Auto-categorisation runs at import from now on, but everything imported
 * before it existed sits in no collection at all — which is why the homepage
 * department tiles read zero.
 *
 * Dry run by default. Pass --apply to write:
 *   npx tsx scripts/backfill-categories.ts
 *   npx tsx scripts/backfill-categories.ts --apply
 */
import { prisma } from '../src/lib/db';
import { categorise } from '../src/lib/categorise';

const apply = process.argv.includes('--apply');

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      productType: true,
      collections: { select: { collectionId: true } },
    },
  });

  const collections = await prisma.collection.findMany({ select: { id: true, handle: true } });
  const byHandle = new Map(collections.map((c) => [c.handle, c.id]));

  console.log(`${products.length} product(s), ${collections.length} collection(s)`);
  console.log(`collections: ${collections.map((c) => c.handle).join(', ') || '(none)'}\n`);

  let filed = 0;
  let already = 0;
  let unmatched = 0;
  let noCollection = 0;

  for (const p of products) {
    if (p.collections.length > 0) {
      already++;
      continue;
    }
    const handle = categorise(p.title, p.productType);
    if (!handle) {
      unmatched++;
      console.log(`  –  ${p.title.slice(0, 58)}  ->  (no match, left alone)`);
      continue;
    }
    const collectionId = byHandle.get(handle);
    if (!collectionId) {
      noCollection++;
      console.log(`  !  ${p.title.slice(0, 58)}  ->  ${handle} (collection missing)`);
      continue;
    }

    console.log(`  ${apply ? '+' : '·'}  ${p.title.slice(0, 58)}  ->  ${handle}`);
    if (apply) {
      await prisma.collectionProduct.create({ data: { productId: p.id, collectionId } });
      filed++;
    }
  }

  console.log(
    `\n${apply ? 'filed' : 'would file'}: ${apply ? filed : products.length - already - unmatched - noCollection}` +
      `  ·  already filed: ${already}  ·  no match: ${unmatched}  ·  missing collection: ${noCollection}`
  );
  if (!apply) console.log('\nDry run. Re-run with --apply to write.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
