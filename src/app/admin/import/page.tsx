import { ImportWorkspace } from '@/components/admin/ImportWorkspace';
import { captureToken } from '@/lib/suppliers/captureToken';
import { buildCaptureScript } from '@/lib/suppliers/bookmarklet';
import type { CaptureRow } from '@/components/admin/CaptureList';
import { prisma } from '@/lib/db';
import { getPricingRules, getStoreSettings } from '@/lib/settings';

export const metadata = { title: 'Import product' };
export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const [settings, rules] = await Promise.all([getStoreSettings(), getPricingRules()]);

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3400').replace(/\/$/, '');

  let bookmarklet = '';
  try {
    bookmarklet = buildCaptureScript(`${site}/api/admin/capture`, captureToken());
  } catch {
    // AUTH_SECRET missing — the setup card explains rather than rendering a
    // bookmarklet that would fail silently on the supplier's page.
  }

  const rows = await prisma.supplierCapture
    .findMany({ orderBy: { createdAt: 'desc' }, take: 25 })
    .catch(() => []);

  const captures: CaptureRow[] = rows.map((r) => {
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

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="font-display text-d3 text-onyx">Add a product</h2>
        <p className="max-w-2xl text-body text-greige">
          Capture a supplier listing from your browser, then price every variant against its own
          landed cost in {settings.baseCurrency}. Nothing can be published below what it costs you.
        </p>
      </header>

      <ImportWorkspace
        baseCurrency={settings.baseCurrency}
        defaultMarginPct={rules.marginPct}
        bookmarklet={bookmarklet}
        captures={captures}
      />
    </div>
  );
}
