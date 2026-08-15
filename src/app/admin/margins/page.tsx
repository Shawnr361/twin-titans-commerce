import Link from 'next/link';
import { prisma } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { auditMargin } from '@/lib/pricing';
import { getPricingRules, getStoreSettings } from '@/lib/settings';

export const metadata = { title: 'Margin audit' };
export const dynamic = 'force-dynamic';

/**
 * Margin audit over EVERY variant in the catalog.
 *
 * The old store shipped loss-making variants three separate times, each time
 * because a single flat price was applied across SKUs whose supplier cost
 * differed. A per-product spot check cannot catch that, so this checks every
 * variant individually and sorts the worst to the top.
 */
export default async function MarginAuditPage() {
  const [settings, rules] = await Promise.all([getStoreSettings(), getPricingRules()]);

  const variants = await prisma.variant
    .findMany({
      include: { product: { select: { handle: true, title: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
    .catch(() => []);

  const audited = variants
    .map((v) => ({
      variant: v,
      audit: auditMargin(v.priceMinor, v.costMinor, rules),
    }))
    .sort((a, b) => a.audit.marginPct - b.audit.marginPct);

  const losses = audited.filter((a) => a.audit.severity === 'loss');
  const thin = audited.filter((a) => a.audit.severity === 'thin');

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-bold tracking-tight">Margin audit</h2>
        <p className="max-w-2xl text-sm text-mut">
          Every variant checked against its own landed cost, including the payment-gateway fee.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-5">
          <p className="text-xs uppercase tracking-wide text-mut">Selling at a loss</p>
          <p className={`mt-1.5 text-2xl font-extrabold ${losses.length ? 'text-red-400' : ''}`}>
            {losses.length}
          </p>
        </div>
        <div className="panel p-5">
          <p className="text-xs uppercase tracking-wide text-mut">
            Below {rules.minMarginPct}% floor
          </p>
          <p className={`mt-1.5 text-2xl font-extrabold ${thin.length ? 'text-amber-400' : ''}`}>
            {thin.length}
          </p>
        </div>
        <div className="panel p-5">
          <p className="text-xs uppercase tracking-wide text-mut">Variants checked</p>
          <p className="mt-1.5 text-2xl font-extrabold">{audited.length}</p>
        </div>
      </div>

      {audited.length === 0 ? (
        <div className="panel p-12 text-center text-sm text-mut">
          No variants yet — import a product to get started.
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="scroll-x">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mut">
                  <th className="p-4 font-medium">Product</th>
                  <th className="p-4 font-medium">Variant</th>
                  <th className="p-4 font-medium">Cost</th>
                  <th className="p-4 font-medium">Price</th>
                  <th className="p-4 font-medium">Profit</th>
                  <th className="p-4 font-medium">Margin</th>
                </tr>
              </thead>
              <tbody>
                {audited.slice(0, 100).map(({ variant, audit }) => (
                  <tr key={variant.id} className="border-b border-line/60 last:border-0">
                    <td className="p-4">
                      <Link
                        href={`/products/${variant.product.handle}`}
                        className="line-clamp-1 font-medium hover:text-accent2"
                      >
                        {variant.product.title}
                      </Link>
                      {variant.product.status !== 'ACTIVE' && (
                        <span className="text-[11px] text-mut">{variant.product.status}</span>
                      )}
                    </td>
                    <td className="p-4 text-mut">{variant.title}</td>
                    <td className="p-4 text-mut">
                      {formatMoney(variant.costMinor, settings.baseCurrency)}
                    </td>
                    <td className="p-4">{formatMoney(variant.priceMinor, settings.baseCurrency)}</td>
                    <td
                      className={`p-4 font-semibold ${
                        audit.severity === 'loss'
                          ? 'text-red-400'
                          : audit.severity === 'thin'
                            ? 'text-amber-400'
                            : ''
                      }`}
                    >
                      {formatMoney(audit.profitMinor, settings.baseCurrency)}
                    </td>
                    <td className="p-4">
                      <span
                        className={`chip ${
                          audit.severity === 'loss'
                            ? 'border-red-500/50 text-red-300'
                            : audit.severity === 'thin'
                              ? 'border-amber-500/50 text-amber-300'
                              : 'border-accent/50 text-accent2'
                        }`}
                        title={audit.message}
                      >
                        {audit.marginPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
