import type { CaptureRow } from '@/components/admin/CaptureList';
import { prisma } from '../db';

/**
 * The capture list, shaped for the admin UI.
 *
 * Shared by the page's first render and by the poll endpoint the list uses to
 * refresh itself. Keeping one loader means the two can never drift into
 * disagreeing about what a row looks like.
 */
export async function listCaptureRows(take = 25): Promise<CaptureRow[]> {
  const rows = await prisma.supplierCapture
    .findMany({ orderBy: { createdAt: 'desc' }, take })
    .catch(() => []);

  return rows.map((r) => {
    const payload = r.payload as { images?: string[] } | null;
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
      importedProductId: r.importedProductId,
      createdAt: r.createdAt.toISOString(),
      thumbnail: payload?.images?.[0] ?? null,
    };
  });
}
