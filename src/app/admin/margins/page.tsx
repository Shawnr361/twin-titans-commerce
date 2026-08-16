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
        <p className="max-w-2xl text-sm text-greige">
          Every variant checked against its own landed cost, including the payment-gateway fee.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-greige">Selling at a loss</p>
          <p className={`mt-1.5 text-2xl font-extrabold ${losses.length ? 'text-danger' : ''}`}>
            {losses.length}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-greige">
            Below {rules.minMarginPct}% floor
          </p>
          <p className={`mt-1.5 text-2xl font-extrabold ${thin.length ? 'text-warn' : ''}`}>
            {thin.length}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-greige">Variants checked</p>
          <p className="mt-1.5 text-2xl font-extrabold">{audited.length}</p>
        </div>
      </div>

      {audited.length === 0 ? (
        <div className="card p-12 text-center text-sm text-greige">
          No variants yet — import a product to get started.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="scroll-x">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs uppercase tracking-wide text-greige">
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
                  <tr key={variant.id} className="border-b border-rule/60 last:border-0">
                    <td className="p-4">
                      <Link
                        href={`/products/${variant.product.handle}`}
                        className="line-clamp-1 font-medium hover:text-verdigris"
                      >
                        {variant.product.title}
                      </Link>
                      {variant.product.status !== 'ACTIVE' && (
                        <span className="text-[11px] text-greige">{variant.product.status}</span>
                      )}
                    </td>
                    <td className="p-4 text-greige">{variant.title}</td>
                    <td className="p-4 text-greige">
                      {formatMoney(variant.costMinor, settings.baseCurrency)}
                    </td>
                    <td className="p-4">{formatMoney(variant.priceMinor, settings.baseCurrency)}</td>
                    <td
                      className={`p-4 font-semibold ${
                        audit.severity === 'loss'
                          ? 'text-danger'
                          : audit.severity === 'thin'
                            ? 'text-warn'
                            : ''
                      }`}
                    >
                      {formatMoney(audit.profitMinor, settings.baseCurrency)}
                    </td>
                    <td className="p-4">
                      <span
                        className={`tag ${
                          audit.severity === 'loss'
                            ? 'border-danger/50 text-danger'
                            : audit.severity === 'thin'
                              ? 'border-warn/50 text-warn'
                              : 'border-verdigris/50 text-verdigris'
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
