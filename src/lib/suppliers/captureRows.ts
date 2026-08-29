import type { CaptureRow } from '@/components/admin/CaptureList';
import { prisma } from '../db';

/**
 * The capture list, shaped for the admin UI.
 *
 * Shared by the page's first render and by the poll endpoint the list uses to
 * refresh itself. Keeping one loader means the two can never drift into
 * disagreeing about what a row looks like.
 *
 * WHY THE LIMIT IS THIS HIGH
 * --------------------------
 * It used to be 25, which silently truncated the list: the header read
 * "Captures 25" however many existed, and anything older could not be reached
 * at all. Captures are small rows on an admin-only screen, so loading a few
 * hundred is cheaper than a merchant wondering where a capture went.
 */
export async function listCaptureRows(take = 300): Promise<CaptureRow[]> {
  const rows = await prisma.supplierCapture
    .findMany({ orderBy: { createdAt: 'desc' }, take })
    .catch(() => []);

  /*
   * "Imported" on its own does not say whether the product is earning money or
   * sitting invisible as a draft — on this screen the two looked identical, and
   * the difference was only discoverable by opening the product editor. One
   * extra query resolves every row, rather than N queries or a guess.
   */
  const importedIds = rows
    .map((r) => r.importedProductId)
    .filter((id): id is string => Boolean(id));

  /*
   * RESOLVING HISTORY.
   *
   * importedProductId is only written from now on — every capture taken before
   * that fix has it null, including products that are live and selling. Rather
   * than a one-off backfill script, the link is recovered here: SupplierProduct
   * and SupplierCapture both carry (platform, externalId), and SupplierProduct
   * has a unique index on exactly that pair. So the product a capture became
   * can be found precisely, with no string matching on URLs.
   *
   * Self-healing rather than a migration: it also covers any future capture
   * whose commit-time update failed.
   */
  const unlinked = rows.filter((r) => !r.importedProductId && r.externalId);

  const supplierLinks = unlinked.length
    ? await prisma.supplierProduct
        .findMany({
          where: {
            OR: unlinked.map((r) => ({
              platform: r.platform,
              externalId: r.externalId as string,
            })),
          },
          select: { productId: true, platform: true, externalId: true },
        })
        .catch(() => [])
    : [];

  const productIdByKey = new Map(
    supplierLinks.map((l) => [`${l.platform}:${l.externalId}`, l.productId])
  );

  const allProductIds = [...new Set([...importedIds, ...productIdByKey.values()])];

  const products = allProductIds.length
    ? await prisma.product
        .findMany({
          where: { id: { in: allProductIds } },
          select: { id: true, status: true, handle: true },
        })
        .catch(() => [])
    : [];

  const productById = new Map(products.map((p) => [p.id, p]));

  return rows.map((r) => {
    const payload = r.payload as { images?: string[] } | null;
    const resolvedId =
      r.importedProductId ??
      (r.externalId ? (productIdByKey.get(`${r.platform}:${r.externalId}`) ?? null) : null);
    const product = resolvedId ? productById.get(resolvedId) : undefined;

    return {
      id: r.id,
      title: r.title,
      platform: r.platform,
      sourceUrl: r.sourceUrl,
      currency: r.currency,
      variantCount: r.variantCount,
      pricedVariantCount: r.pricedVariantCount,
      imageCount: r.imageCount,
      videoCount: r.videoCount,
      reviewCount: r.reviewCount,
      importedProductId: resolvedId,
      /*
       * null when the capture was never imported, and ALSO null when it was
       * imported into a product since deleted. The two are told apart by
       * importedProductId, and the UI says which rather than showing a dead
       * "Imported" badge that points at nothing.
       */
      productStatus: product?.status ?? null,
      productHandle: product?.handle ?? null,
      createdAt: r.createdAt.toISOString(),
      thumbnail: payload?.images?.[0] ?? null,
    };
  });
}
