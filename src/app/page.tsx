import Link from 'next/link';
import { ProductCard } from '@/components/commerce/ProductCard';
import { SectionHead } from '@/components/layout/SectionHead';
import { Marquee } from '@/components/layout/Marquee';
import { Reveal } from '@/components/motion/Reveal';
import { Parallax } from '@/components/motion/Parallax';
import { Magnetic } from '@/components/motion/Magnetic';
import { prisma } from '@/lib/db';
import { CARD_SELECT, toCard } from '@/lib/catalog';
import { getStoreSettings } from '@/lib/settings';

// Prices, stock and the catalogue all change from the admin, and prerendering
// would additionally require a database connection at build time, which the
// current host cannot provide.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const settings = await getStoreSettings();

  const [newest, collections, productCount] = await Promise.all([
    prisma.product
      .findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: CARD_SELECT,
      })
      .catch(() => []),
    prisma.collection
      .findMany({
        where: { published: true },
        orderBy: { position: 'asc' },
        take: 3,
        select: {
          handle: true,
          title: true,
          imageUrl: true,
          _count: { select: { products: true } },
        },
      })
      .catch(() => []),
    prisma.product.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
  ]);

  const hasStock = newest.length > 0;

  return (
    <>
      {/* ---------------------------------------------------------------
          Hero. The headline arrives line by line, the image drifts.
          --------------------------------------------------------------- */}
      <section className="relative">
        <div className="shell grid items-center gap-14 py-20 md:grid-cols-[1.05fr_0.95fr] md:py-28 lg:gap-20">
          <Reveal className="max-w-xl">
            <p className="label">Est. Lagos</p>
            <hr className="rule-gold mt-5" />

            <h1 className="display-xl mt-8">
              <span className="reveal-line" style={{ '--i': 0 } as React.CSSProperties}>
                <span>Considered things,</span>
              </span>
              <span className="reveal-line" style={{ '--i': 1 } as React.CSSProperties}>
                <span className="gold italic">delivered.</span>
              </span>
            </h1>

            <p className="lede prose-measure mt-8">
              {settings.tagline} A short, deliberate catalogue — each piece sourced, checked and
              priced honestly, then shipped direct to your door.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Magnetic>
                <Link href="/collections/all" className="btn btn-primary sheen">
                  View the catalogue
                </Link>
              </Magnetic>
              <Link href="/orders/track" className="link text-label">
                Track an order
              </Link>
            </div>
          </Reveal>

          <Reveal>
            <Parallax className="aspect-editorial md:aspect-product" strength={12}>
              <div className="media h-full">
                {newest[0]?.images?.[0]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={newest[0].images[0].url}
                    alt={newest[0].title}
                    fetchPriority="high"
                    loading="eager"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
                    <hr className="rule-gold" />
                    <p className="label mt-2">The first pieces</p>
                    <p className="text-body text-greige">
                      Arriving shortly. The catalogue opens as stock is confirmed.
                    </p>
                  </div>
                )}
              </div>
            </Parallax>
          </Reveal>
        </div>
      </section>

      {/* Running band — motion at the seam between sections. */}
      <Marquee
        items={[
          'Shipped direct from source',
          'Tracked on every order',
          'Priced against true landed cost',
          'Reachable by a person',
        ]}
      />

      {/* ---------------------------------------------------------------
          Departments
          --------------------------------------------------------------- */}
      {collections.length > 0 && (
        <section className="shell py-20 md:py-28">
          <Reveal>
            <SectionHead eyebrow="Departments" title="Where to begin" />
          </Reveal>

          <Reveal stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((c, i) => (
              <div key={c.handle} style={{ '--i': i } as React.CSSProperties}>
                <Link href={`/collections/${c.handle}`} className="group block">
                  <div className="media media-hover sheen aspect-editorial">
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt="" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="font-display text-d2 text-quiet">{c.title}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-5 flex items-baseline justify-between gap-4">
                    <h3 className="font-display text-d2 text-onyx transition-colors duration-2 group-hover:text-verdigris">
                      {c.title}
                    </h3>
                    <span className="text-label text-quiet tabular-nums">{c._count.products}</span>
                  </div>
                </Link>
              </div>
            ))}
          </Reveal>
        </section>
      )}

      {/* ---------------------------------------------------------------
          New arrivals
          --------------------------------------------------------------- */}
      <section className="border-y border-rule bg-bone2/60">
        <div className="shell py-20 md:py-28">
          <Reveal>
            <SectionHead
              eyebrow="New arrivals"
              title={hasStock ? 'Latest additions' : 'The catalogue is opening'}
              action={hasStock ? { label: 'View all', href: '/collections/all' } : undefined}
            />
          </Reveal>

          {hasStock ? (
            <Reveal stagger className="mt-12 grid grid-cols-2 gap-x-5 gap-y-14 lg:grid-cols-4">
              {newest.map((p, i) => (
                <div key={p.handle} style={{ '--i': i % 4 } as React.CSSProperties}>
                  <ProductCard product={toCard(p, settings.baseCurrency)} priority={i < 2} />
                </div>
              ))}
            </Reveal>
          ) : (
            <Reveal className="mt-12 max-w-text">
              <p className="text-body text-greige">
                Nothing is published yet. Products appear here once they have been sourced, priced
                against their true landed cost, and approved — not before.
              </p>
            </Reveal>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------
          Service
          --------------------------------------------------------------- */}
      <section className="shell py-20 md:py-28">
        <Reveal stagger className="grid gap-12 md:grid-cols-3">
          {[
            {
              title: 'Shipped direct',
              body: 'Orders go straight from our supplier to your address, which is how the pricing stays where it is.',
            },
            {
              title: 'Tracked throughout',
              body: 'A tracking number by email the moment your parcel ships, and a tracking page you can check any time.',
            },
            {
              title: 'Reachable',
              body: 'Questions answered by a person. If something arrives wrong, tell us and we will put it right.',
            },
          ].map((item, i) => (
            <div key={item.title} style={{ '--i': i } as React.CSSProperties}>
              <hr className="rule-gold" />
              <h3 className="font-display text-d2 mt-6 text-onyx">{item.title}</h3>
              <p className="mt-3 text-body text-greige">{item.body}</p>
            </div>
          ))}
        </Reveal>

        {productCount > 0 && (
          <p className="mt-16 text-label text-quiet">
            {productCount} {productCount === 1 ? 'piece' : 'pieces'} currently available.
          </p>
        )}
      </section>
    </>
  );
}
