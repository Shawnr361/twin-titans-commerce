import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductGallery } from '@/components/commerce/ProductGallery';
import { AddToCart } from '@/components/commerce/AddToCart';
import { ProductCard } from '@/components/commerce/ProductCard';
import { SectionHead } from '@/components/layout/SectionHead';
import { Reveal } from '@/components/motion/Reveal';
import { IconReturn, IconSearch, IconShield, IconSpark, IconTruck } from '@/components/icons';
import { prisma } from '@/lib/db';
import { CARD_SELECT, toCard } from '@/lib/catalog';
import { formatMoney } from '@/lib/money';
import { getStoreSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

async function getProduct(handle: string) {
  return prisma.product.findFirst({
    where: { handle, status: 'ACTIVE' },
    include: {
      images: { orderBy: { position: 'asc' } },
      variants: { orderBy: { position: 'asc' } },
      source: { select: { supplier: { select: { shipDaysMin: true, shipDaysMax: true } } } },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProduct(handle).catch(() => null);
  if (!product) return { title: 'Not found' };

  return {
    title: product.seoTitle ?? product.title,
    description: product.seoDescription ?? product.title,
    alternates: { canonical: `/products/${product.handle}` },
    openGraph: {
      type: 'website',
      title: product.seoTitle ?? product.title,
      description: product.seoDescription ?? undefined,
      images: product.images[0]?.url ? [product.images[0].url] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const settings = await getStoreSettings();
  const product = await getProduct(handle);

  if (!product) notFound();

  const related = await prisma.product
    .findMany({
      where: { status: 'ACTIVE', handle: { not: handle } },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: CARD_SELECT,
    })
    .catch(() => []);

  const shipMin = product.source?.supplier.shipDaysMin ?? 7;
  const shipMax = product.source?.supplier.shipDaysMax ?? 21;
  const cheapest = product.variants.reduce(
    (min, v) => (v.priceMinor < min ? v.priceMinor : min),
    product.variants[0]?.priceMinor ?? 0
  );
  const inStock = product.variants.some((v) => v.inventory == null || v.inventory > 0);

  /*
   * Product structured data. Only facts we actually hold are emitted — there
   * is no aggregateRating, because inventing review data is both dishonest
   * and a Google policy violation. It appears once reviews are real.
   */
  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.title,
    description: product.seoDescription ?? undefined,
    image: product.images.map((i) => i.url).slice(0, 6),
    sku: product.variants[0]?.sku ?? undefined,
    brand: product.vendor ? { '@type': 'Brand', name: product.vendor } : undefined,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: settings.baseCurrency,
      lowPrice: (cheapest / 100).toFixed(2),
      offerCount: product.variants.length,
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="shell pt-8">
        <ol className="flex flex-wrap items-center gap-2 text-label text-quiet">
          <li>
            <Link href="/" className="hover:text-onyx transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/collections/all" className="hover:text-onyx transition-colors">
              Shop
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-greige">{product.title}</li>
        </ol>
      </nav>

      <div className="shell grid gap-12 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:py-14">
        <div className="min-w-0">
          <ProductGallery
            images={product.images.map((i) => ({ url: i.url, alt: i.alt ?? product.title }))}
            title={product.title}
          />
        </div>

        {/*
          * min-w-0: a grid item defaults to min-width:auto and refuses to
          * shrink below its content's min-content width. Supplier titles run
          * past 140 characters, so this column was forced wide, pushed off
          * the viewport, and took the page into horizontal scroll.
          */}
        <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          {product.vendor && <p className="label mb-3 break-words">{product.vendor}</p>}
          <h1 className="display-m break-words hyphens-auto">{product.title}</h1>
          <hr className="rule-gold mt-6" />

          <div className="mt-8">
            <AddToCart
              variants={product.variants.map((v) => ({
                id: v.id,
                title: v.title,
                priceMinor: v.priceMinor,
                compareAtMinor: v.compareAtMinor,
                imageUrl: v.imageUrl,
                available: v.inventory == null || v.inventory > 0,
                options: (v.optionValues ?? {}) as Record<string, string>,
              }))}
              currency={settings.baseCurrency}
            />
          </div>

          {/* Service facts — only things we can actually stand behind. */}
          <dl className="mt-10 divide-y divide-rule border-y border-rule">
            <div className="flex items-center gap-4 py-4">
              <IconTruck size={19} className="shrink-0 text-brass" />
              <dt className="label shrink-0">Delivery</dt>
              <dd className="ml-auto text-right text-body text-greige">
                {shipMin}–{shipMax} days after dispatch
              </dd>
            </div>
            <div className="flex items-center gap-4 py-4">
              <IconSearch size={19} className="shrink-0 text-brass" />
              <dt className="label shrink-0">Tracking</dt>
              <dd className="ml-auto text-right text-body text-greige">Emailed when it ships</dd>
            </div>
            <div className="flex items-center gap-4 py-4">
              <IconShield size={19} className="shrink-0 text-brass" />
              <dt className="label shrink-0">Payment</dt>
              <dd className="ml-auto text-right text-body text-greige">
                Card, transfer or USSD in {settings.baseCurrency}
              </dd>
            </div>
            <div className="flex items-center gap-4 py-4">
              <IconReturn size={19} className="shrink-0 text-brass" />
              <dt className="label shrink-0">Returns</dt>
              <dd className="ml-auto text-right text-body text-greige">
                <Link href="/pages/returns" className="link">
                  See our policy
                </Link>
              </dd>
            </div>
            {settings.freeShippingOverMinor > 0 && (
              <div className="flex items-center gap-4 py-4">
                <IconSpark size={19} className="shrink-0 text-brass" />
                <dt className="label shrink-0">Shipping</dt>
                <dd className="ml-auto text-right text-body text-greige">
                  Complimentary over{' '}
                  {formatMoney(settings.freeShippingOverMinor, settings.baseCurrency)}
                </dd>
              </div>
            )}
          </dl>

          {product.descriptionHtml && (
            <div
              className="prose-measure mt-10 space-y-4 text-body text-greige [&_h2]:font-display [&_h2]:text-d2 [&_h2]:text-onyx [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-onyx [&_ul]:space-y-2"
              dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
            />
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="border-t border-rule">
          <div className="shell py-20">
            <Reveal>
              <SectionHead eyebrow="Also consider" title="You may also like" />
            </Reveal>
            <Reveal stagger className="mt-12 grid grid-cols-2 gap-x-5 gap-y-14 lg:grid-cols-4">
              {related.map((p, i) => (
                <div key={p.handle} style={{ '--i': i } as React.CSSProperties}>
                  <ProductCard product={toCard(p, settings.baseCurrency)} />
                </div>
              ))}
            </Reveal>
          </div>
        </section>
      )}
    </>
  );
}
