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
import { FEATURED_TAG, hasTag } from '@/lib/tags';
import { deliveryWindow, dispatchWindow } from '@/content/delivery';

// Prices, stock and the catalogue all change from the admin, and prerendering
// would additionally require a database connection at build time, which the
// current host cannot provide.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const settings = await getStoreSettings();

  // The departments strip is gone, so the collection query goes with it rather
  // than running on every homepage render for nothing.
  const [newest, productCount, featured] = await Promise.all([
    prisma.product
      .findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        /*
         * Four rows on the four-column desktop grid. On mobile the grid is two
         * columns, so this is eight rows there — still a reasonable scroll,
         * and it is the difference between a shop that looks stocked and one
         * that looks like it has eight things.
         */
        take: 16,
        select: CARD_SELECT,
      })
      .catch(() => []),

    prisma.product.count({ where: { status: 'ACTIVE' } }).catch(() => 0),

    /*
     * Hand-picked hero products. Filtered here rather than in SQL: tags is a
     * JSON column, the live catalogue is a few hundred rows at most, and a
     * JSON path filter is one more thing that behaves differently per database.
     */
    prisma.product
      .findMany({
        where: { status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' },
        select: { ...CARD_SELECT, tags: true },
      })
      .then((rows) => rows.filter((p) => hasTag(p.tags, FEATURED_TAG)))
      .catch(() => []),
  ]);

  /*
   * One slide per product, first image only. Products with no image are
   * skipped rather than shown as a gap, and the list is capped so the hero
   * stays a taste of the catalogue rather than all of it.
   *
   * The merchant's featured picks lead. Newest-first is only the fallback when
   * nothing is featured — left to itself it put a toilet seat cover under the
   * headline, because that happened to be the latest import.
   *
   * Up to ten featured (the merchant's call, 2026-09-17); the unchosen
   * fallback stays at six, since nobody picked those.
   */
  const heroSlides = (featured.length > 0 ? featured : newest)
    .filter((p) => p.images?.[0]?.url)
    .slice(0, featured.length > 0 ? 10 : 6)
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
            <hr className="rule-gold" />

            <h1 className="display-xl mt-8">
              <span className="reveal-line" style={{ '--i': 0 } as React.CSSProperties}>
                <span>Consider it</span>
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

            {/*
              The delivery time, said up front. Goods ship from overseas
              suppliers, and a shopper who assumed three days is the one who
              writes "where is my order" on day eight — or disputes the charge.
              Same numbers as the shipping policy, from one source.
            */}
            <p className="mt-8 text-label text-quiet">
              Dispatched in {dispatchWindow} · delivered in {deliveryWindow} · tracked all the way
            </p>
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
              body: `Orders go straight from our supplier to your address, which is how the pricing stays where it is. Expect it within ${deliveryWindow} of dispatch.`,
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
