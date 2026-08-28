import { prisma } from '@/lib/db';
import { supplierQuality } from '@/lib/reviews';
import { ReviewVisibility } from '@/components/commerce/ReviewVisibility';

export const metadata = { title: 'Reviews & supplier quality' };
export const dynamic = 'force-dynamic';

function stars(n: number): string {
  return '★'.repeat(Math.round(n)).padEnd(5, '·');
}

/**
 * What customers said, and what it says about each supplier.
 *
 * The supplier table is the point. Individual reviews are how it is fed, but
 * the decision this page exists to support is which suppliers keep getting
 * orders — so that table comes first and sorts worst-average to the top.
 */
export default async function AdminReviewsPage() {
  const [suppliers, reviews] = await Promise.all([
    supplierQuality().catch(() => []),
    prisma.review
      .findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { product: { select: { title: true, handle: true } } },
      })
      .catch(() => []),
  ]);

  const thin = suppliers.filter((s) => s.reviews < 3);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-lg font-bold tracking-tight">Reviews &amp; supplier quality</h2>
        <p className="max-w-2xl text-sm text-greige">
          Only customers with a delivered order can review, so every row below is from someone who
          received the goods.
        </p>
      </header>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-greige">
          By supplier — worst first
        </h3>

        {suppliers.length === 0 ? (
          <div className="card p-10 text-center text-sm text-greige">
            No reviews yet. This table fills in once delivered orders start being reviewed.
          </div>
        ) : (
          <>
            {thin.length > 0 && (
              <p className="text-xs text-warn">
                {thin.length} supplier{thin.length === 1 ? '' : 's'} here {thin.length === 1 ? 'has' : 'have'}{' '}
                fewer than 3 reviews — not yet enough to judge. Read the count before the average.
              </p>
            )}
            <div className="card overflow-hidden">
              <div className="scroll-x">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-rule text-left text-xs uppercase tracking-wide text-greige">
                      <th className="p-4 font-medium">Supplier</th>
                      <th className="p-4 font-medium">Average</th>
                      <th className="p-4 font-medium">Reviews</th>
                      <th className="p-4 font-medium">1–2 star</th>
                      <th className="p-4 font-medium">Products</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((s) => (
                      <tr key={s.supplierId} className="border-b border-rule/60 last:border-0">
                        <td className="p-4">{s.supplierName}</td>
                        <td className="p-4">
                          <span className={s.average < 3 ? 'text-danger' : ''}>
                            {s.average.toFixed(1)}
                          </span>{' '}
                          <span className="text-greige">{stars(s.average)}</span>
                        </td>
                        <td className={`p-4 ${s.reviews < 3 ? 'text-warn' : 'text-greige'}`}>
                          {s.reviews}
                        </td>
                        <td className={`p-4 ${s.poor > 0 ? 'text-danger' : 'text-greige'}`}>
                          {s.poor}
                        </td>
                        <td className="p-4 text-greige">{s.products}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-greige">
          Every review
        </h3>

        {reviews.length === 0 ? (
          <div className="card p-10 text-center text-sm text-greige">Nothing yet.</div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {r.rating}/5 <span className="text-greige">{stars(r.rating)}</span>
                    </p>
                    <p className="mt-1 text-xs text-greige">
                      {r.product.title.slice(0, 80)} · {r.authorName ?? 'Anonymous'} · {r.email}
                    </p>
                  </div>
                  <ReviewVisibility id={r.id} hidden={Boolean(r.hiddenAt)} />
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm">{r.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
