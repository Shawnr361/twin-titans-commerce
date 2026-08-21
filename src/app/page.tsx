import Link from 'next/link';
import { ProductCard } from '@/components/commerce/ProductCard';
import { SectionHead } from '@/components/layout/SectionHead';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { Reveal } from '@/components/motion/Reveal';
import { Parallax } from '@/components/motion/Parallax';
import { Magnetic } from '@/components/motion/Magnetic';
import { Spotlight } from '@/components/motion/Spotlight';
import { prisma } from '@/lib/db';
import { CARD_SELECT, toCard } from '@/lib/catalog';
import { getStoreSettings } from '@/lib/settings';

// Prices, stock and the catalogue all change from the admin, and prerendering
// would additionally require a database connection at build time, which the
// current host cannot provide.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const settings = await getStoreSettings();

  // The departments strip is gone, so the collection query goes with it rather
  // than running on every homepage render for nothing.
  const [newest, productCount] = await Promise.all([
    prisma.product
      .findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: CARD_SELECT,
      })
      .catch(() => []),

    prisma.product.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
  ]);

  /*
   * One slide per product, first image only. Products with no image are
   * skipped rather than shown as a gap, and the list is capped so the hero
   * stays a taste of the catalogue rather than all of it.
   */
  const heroSlides = newest
    .filter((p) => p.images?.[0]?.url)
    .slice(0, 6)
    .map((p) => ({ handle: p.handle, title: p.title, url: p.images[0].url }));

  const hasStock = newest.length > 0;

  return (
    <>
      {/* ---------------------------------------------------------------
          Hero. The headline arrives line by line, the image drifts.
          --------------------------------------------------------------- */}
      <Spotlight as="section" className="overflow-hidden">
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

            <div className="mt-10 flex flex-wrap items-center gap-x-9 gap-y-5">
              <Magnetic>
                <Link href="/collections/all" className="btn btn-primary sheen">
                  View the catalogue
                </Link>
              </Magnetic>
              <Link href="/orders/track" className="link whitespace-nowrap text-label">
                Track an order
              </Link>
            </div>
          </Reveal>

          <Reveal>
            <Parallax className="aspect-editorial md:aspect-product" strength={12}>
              <div className="media h-full">
                {heroSlides.length > 0 ? (
                  <HeroCarousel slides={heroSlides} />
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
      </Spotlight>

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
