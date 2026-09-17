import Link from 'next/link';
import { ProductStatusToggle } from '@/components/admin/ProductStatusToggle';
import { ProductDeleteButton } from '@/components/admin/ProductDeleteButton';
import { FeatureToggle } from '@/components/admin/FeatureToggle';
import { FEATURED_TAG, hasTag } from '@/lib/tags';
import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { EditPricing } from '@/components/admin/EditPricing';
import { auditMargin } from '@/lib/pricing';
import { getPricingRules, getStoreSettings } from '@/lib/settings';

export const metadata = { title: 'Products' };
export const dynamic = 'force-dynamic';

/*
 * No cap. The whole catalogue renders, and every product added later renders
 * with it, because the list scrolls in its own pane — there is nowhere for a
 * hundredth row to be "below".
 *
 * The cap that used to be here was worse than a slow page: it was silent. 28
 * products were absent from the admin with nothing on screen saying so, and
 * the heading counted the fetched rows, so the shop read as 100 products.
 *
 * The cost is bounded by what this page actually needs per product — one
 * image and its variants — and the catalogue is the merchant's own, not a
 * public feed. If it ever grows enough to feel slow, the fix is to fetch the
 * variant count and cheapest price as aggregates rather than loading every
 * variant row; the answer is not to hide products again.
 */

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [settings, rules] = await Promise.all([getStoreSettings(), getPricingRules()]);

  const query = ((await searchParams).q ?? '').trim();

  /*
   * Searched in the database rather than by filtering what is on screen.
   *
   * Every product is rendered now, so a client-side filter would work — but it
   * would go wrong again the moment anyone reintroduced a limit, and it would
   * make the browser hold the whole catalogue to answer one question the
   * database can answer directly. Asking for what was wanted is both cheaper
   * and harder to break.
   *
   * Matching the handle as well as the title, since that is what a product URL
   * carries and it is often what someone is holding when they come looking.
   */
  const where = query
    ? {
        OR: [
          { title: { contains: query } },
          { handle: { contains: query } },
        ],
      }
    : {};

  const [products, matching, total] = await Promise.all([
    prisma.product
      .findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          images: { take: 1, orderBy: { position: 'asc' } },
          variants: true,
          source: { select: { sourceUrl: true, platform: true, raw: true } },
        },
      })
      .catch(() => []),
    prisma.product.count({ where }).catch(() => 0),
    prisma.product.count().catch(() => 0),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Products</h2>
          {/*
            The honest count. This said "{products.length} in catalog", which
            was the number FETCHED — capped at 100 — so a 126-product shop
            read as 100 and nothing hinted at the missing 26.
          */}
          <p className="text-sm text-greige">
            {query ? (
              <>
                {matching} matching &ldquo;{query}&rdquo; · {total} in catalog
              </>
            ) : (
              <>{total} in catalog</>
            )}
          </p>
        </div>
        <Link href="/admin/import" className="btn btn-primary">
          Import from link
        </Link>
      </header>

      {/*
        A plain GET form: it works before React hydrates, the query lives in
        the URL so a search can be linked or reloaded, and the back button
        behaves. Nothing here needs to be a client component.
      */}
      <form method="get" className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search products by name or handle…"
          aria-label="Search products"
          className="field min-w-[16rem] flex-1"
        />
        <button type="submit" className="btn btn-secondary shrink-0">
          Search
        </button>
        {query && (
          <Link href="/admin/products" className="text-micro text-greige underline underline-offset-2">
            Clear
          </Link>
        )}
      </form>

      {products.length === 0 ? (
        <div className="card space-y-4 p-12 text-center">
          {query ? (
            <>
              <p className="text-sm text-greige">
                Nothing matches &ldquo;{query}&rdquo; among your {total} products.
              </p>
              <Link href="/admin/products" className="btn btn-secondary">
                Clear the search
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-greige">No products yet.</p>
              <Link href="/admin/import" className="btn btn-primary">
                Import your first product
              </Link>
            </>
          )}
        </div>
      ) : (
        /*
          The list scrolls in its own pane rather than running down the page.

          With 126 products the page grew to a wall you had to scroll past to
          reach anything else, and the header — the count and Import button —
          disappeared the moment you started looking. Bounding it keeps those
          in view and makes the list feel like a working surface.

          Height is viewport-relative, not a fixed pixel figure: the admin is
          used on a phone as much as a desktop, and a hardcoded height either
          wastes a large screen or swallows a small one. The minimum stops it
          collapsing to a sliver on a short window.

          overscroll-contain stops a flick at the end of the list scrolling the
          page behind it, which on a touchpad reads as the panel jumping.
        */
        <div className="max-h-[calc(100vh-16rem)] min-h-[24rem] space-y-3 overflow-y-auto overscroll-contain rounded-sm pr-1">
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

                <FeatureToggle
                  productId={product.id}
                  featured={hasTag(product.tags, FEATURED_TAG)}
                />

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
