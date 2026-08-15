import Link from 'next/link';
import { ParticleField } from '@/components/ParticleField';
import { ProductCard } from '@/components/ProductCard';
import { prisma } from '@/lib/db';
import { CARD_SELECT, toCard } from '@/lib/catalog';
import { getStoreSettings } from '@/lib/settings';

export const revalidate = 60;

export default async function HomePage() {
  const settings = await getStoreSettings();

  const [products, collections, productCount] = await Promise.all([
    prisma.product
      .findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: CARD_SELECT,
      })
      .catch(() => []),
    prisma.collection
      .findMany({
        where: { published: true },
        orderBy: { position: 'asc' },
        take: 4,
        select: { handle: true, title: true, imageUrl: true, _count: { select: { products: true } } },
      })
      .catch(() => []),
    prisma.product.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
  ]);

  return (
    <>
      <section className="relative overflow-hidden border-b border-line/60">
        <ParticleField />

        <div className="container-x relative grid gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div className="space-y-7">
            <span className="chip border-accent/40 text-accent2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent2" aria-hidden />
              {productCount > 0 ? `${productCount} products live now` : 'Store launching'}
            </span>

            <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              {settings.storeName}
              <span className="mt-2 block bg-gradient-to-r from-accent via-accent2 to-accent bg-clip-text text-transparent">
                {settings.tagline}
              </span>
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-mut">
              Carefully sourced products, shipped straight to your door. Pay securely with your card
              or bank transfer, and track every order from checkout to delivery.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/collections/all" className="btn-primary">
                Shop the collection
              </Link>
              <Link href="/orders/track" className="btn-ghost">
                Track an order
              </Link>
            </div>

            <dl className="grid max-w-lg grid-cols-3 gap-4 pt-4">
              {[
                ['Secure', 'Card & transfer'],
                ['Tracked', 'Every parcel'],
                ['Support', 'Real humans'],
              ].map(([term, desc]) => (
                <div key={term} className="panel p-4">
                  <dt className="text-sm font-semibold text-ink">{term}</dt>
                  <dd className="mt-0.5 text-xs text-mut">{desc}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative hidden lg:block">
            <div className="animate-float panel relative aspect-square overflow-hidden p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/25 via-transparent to-accent2/20" />
              {products[0]?.images[0]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={products[0].images[0].url}
                  alt={products[0].title}
                  className="relative h-full w-full rounded-xl object-cover"
                />
              ) : (
                <div className="relative grid h-full place-items-center text-sm text-mut">
                  Your best-seller appears here
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {collections.length > 0 && (
        <section className="container-x py-16">
          <h2 className="mb-6 text-xl font-bold tracking-tight">Shop by category</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {collections.map((c) => (
              <Link
                key={c.handle}
                href={`/collections/${c.handle}`}
                className="panel group relative overflow-hidden p-6 transition hover:border-accent/50"
              >
                <span className="text-sm font-semibold text-ink">{c.title}</span>
                <span className="mt-1 block text-xs text-mut">
                  {c._count.products} product{c._count.products === 1 ? '' : 's'}
                </span>
                <span className="mt-4 block text-xs font-medium text-accent2 opacity-0 transition group-hover:opacity-100">
                  Browse →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="container-x pb-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="text-xl font-bold tracking-tight">New arrivals</h2>
          <Link href="/collections/all" className="text-sm text-accent2 transition hover:text-ink">
            View all →
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="panel p-12 text-center">
            <p className="text-sm text-mut">
              No products published yet. Import your first one from a supplier link in the admin.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.handle} product={toCard(p, settings.baseCurrency)} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
