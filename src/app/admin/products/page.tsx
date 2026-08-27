import Link from 'next/link';
import { ProductStatusToggle } from '@/components/admin/ProductStatusToggle';
import { ProductDeleteButton } from '@/components/admin/ProductDeleteButton';
import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { EditPricing } from '@/components/admin/EditPricing';
import { auditMargin } from '@/lib/pricing';
import { getPricingRules, getStoreSettings } from '@/lib/settings';

export const metadata = { title: 'Products' };
export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  const [settings, rules] = await Promise.all([getStoreSettings(), getPricingRules()]);

  const products = await prisma.product
    .findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        images: { take: 1, orderBy: { position: 'asc' } },
        variants: true,
        source: { select: { sourceUrl: true, platform: true, raw: true } },
      },
    })
    .catch(() => []);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Products</h2>
          <p className="text-sm text-greige">{products.length} in catalog</p>
        </div>
        <Link href="/admin/import" className="btn btn-primary">
          Import from link
        </Link>
      </header>

      {products.length === 0 ? (
        <div className="card space-y-4 p-12 text-center">
          <p className="text-sm text-greige">No products yet.</p>
          <Link href="/admin/import" className="btn btn-primary">
            Import your first product
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => {
            // Worst variant decides the product's health badge — an average
            // would hide exactly the one SKU that is losing money.
            const worst = product.variants
              .map((v) => auditMargin(v.priceMinor, v.costMinor, rules))
              .sort((a, b) => a.marginPct - b.marginPct)[0];

            const cheapest = product.variants.reduce<number | null>(
              (min, v) => (min === null || v.priceMinor < min ? v.priceMinor : min),
              null
            );

            return (
              <article key={product.id} className="card flex flex-wrap items-center gap-4 p-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-bone2">
                  {product.images[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.images[0].url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>

                <div className="min-w-[200px] flex-1 space-y-1">
                  <Link
                    href={`/products/${product.handle}`}
                    className="line-clamp-1 text-sm font-semibold hover:text-verdigris"
                  >
                    {product.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-greige">
                    <span>{product.variants.length} variant(s)</span>
                    {cheapest != null && (
                      <span>· from {formatMoney(cheapest, settings.baseCurrency)}</span>
                    )}
                    {product.source && (
                      <a
                        href={product.source.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-verdigris hover:underline"
                      >
                        · {product.source.platform} source
                      </a>
                    )}
                    {/*
                      SOURCING EVIDENCE, ADMIN ONLY.
                      This is the supplier's rating for the supplier's listing.
                      It belongs here, where it helps judge what to restock, and
                      never on the storefront: presenting another seller's
                      reviews as ours would be a false representation under the
                      FCCPA and breaches Google's review-snippet policy.
                    */}
                    {(() => {
                      const raw = product.source?.raw as
                        | { supplierRating?: number | null; supplierReviewCount?: number | null }
                        | null
                        | undefined;
                      if (!raw?.supplierRating) return null;
                      return (
                        <span
                          className="text-quiet"
                          title="Supplier's rating for their own listing — sourcing evidence, not a review of this shop"
                        >
                          · ★ {raw.supplierRating.toFixed(1)}
                          {raw.supplierReviewCount ? ` (${raw.supplierReviewCount})` : ''} at source
                        </span>
                      );
                    })()}
                  </div>

                  {/*
                    Re-pricing one product. The bulk reprice route applies the
                    store default to everything, which is the wrong tool when a
                    single item is priced badly — without this the only fix was
                    to move the global margin and re-price the whole catalogue.
                  */}
                  <EditPricing productId={product.id} currentMarginPct={rules.marginPct} />
                </div>

                {worst && (
                  <span
                    className={`tag ${
                      worst.severity === 'loss'
                        ? 'border-danger/50 text-danger'
                        : worst.severity === 'thin'
                          ? 'border-warn/50 text-warn'
                          : 'border-verdigris/50 text-verdigris'
                    }`}
                    title={worst.message}
                  >
                    {worst.severity === 'loss' ? 'LOSS' : `${worst.marginPct.toFixed(0)}% margin`}
                  </span>
                )}

                <ProductStatusToggle
                  productId={product.id}
                  status={product.status}
                  blocked={worst?.severity === 'loss'}
                />

                <ProductDeleteButton productId={product.id} title={product.title} />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
