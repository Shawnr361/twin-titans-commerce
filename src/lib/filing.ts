import { prisma } from './db';
import { CATEGORY_RULES, categorise } from './categorise';

/**
 * Put a product in its collection, creating the collection if it is missing.
 *
 * WHY THIS EXISTS SEPARATELY FROM IMPORT
 * --------------------------------------
 * Filing used to happen only at import. Anything the rules did not recognise at
 * that moment stayed uncategorised for good — a live 100ml perfume sat in no
 * collection at all, so it was unreachable from every department tile and only
 * findable by search. Adding a keyword later fixed nothing, because nothing ran
 * the rules again.
 *
 * Publishing is the natural second chance: it is the point where a product
 * becomes something a customer can navigate to.
 *
 * Two properties matter:
 *  - It never MOVES a product. A merchant who filed something by hand outranks
 *    a keyword list, so a product already in a collection is left alone.
 *  - It still declines. No match means no collection, rather than the least
 *    bad guess — a hair clipper under Pet Supplies is worse than one filed
 *    nowhere, because nobody goes looking for the mistake.
 */
export async function fileProduct(productId: string): Promise<{
  filed: boolean;
  collection?: string;
  reason?: string;
}> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      productType: true,
      collections: { select: { collectionId: true } },
    },
  });
  if (!product) return { filed: false, reason: 'product not found' };
  if (product.collections.length > 0) return { filed: false, reason: 'already filed' };

  const handle = categorise(product.title, product.productType);
  if (!handle) return { filed: false, reason: 'no rule matched' };

  const collection = await ensureCollection(handle);
  if (!collection) return { filed: false, reason: `collection ${handle} is not defined` };

  /*
   * createMany + skipDuplicates rather than create: two publishes racing on the
   * same product would otherwise collide on the unique pair.
   */
  await prisma.collectionProduct.createMany({
    data: [{ productId: product.id, collectionId: collection }],
    skipDuplicates: true,
  });

  return { filed: true, collection: handle };
}

/**
 * The collection id for a handle, creating it from the rule set when absent.
 *
 * Adding a rule should be enough to add a department — having to remember a
 * second manual step is how "Gaming" would end up as a rule that files products
 * into a collection nobody can browse.
 */
export async function ensureCollection(handle: string): Promise<string | null> {
  const existing = await prisma.collection.findUnique({
    where: { handle },
    select: { id: true },
  });
  if (existing) return existing.id;

  const rule = CATEGORY_RULES.find((r) => r.handle === handle);
  if (!rule) return null;

  // Append rather than jump the queue: existing departments keep their order.
  const last = await prisma.collection.findFirst({
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const created = await prisma.collection.create({
    data: {
      handle: rule.handle,
      title: rule.title,
      position: (last?.position ?? 0) + 1,
      published: true,
    },
    select: { id: true },
  });
  return created.id;
}
