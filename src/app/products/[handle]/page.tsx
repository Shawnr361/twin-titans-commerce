import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/commerce/ProductGallery";
import { VariantMediaProvider } from "@/components/commerce/VariantMediaContext";
import { displayVendor, isMarketplaceName } from "@/lib/vendor";
import { AddToCart } from "@/components/commerce/AddToCart";
import { ProductCard } from "@/components/commerce/ProductCard";
import { SectionHead } from "@/components/layout/SectionHead";
import { Reveal } from "@/components/motion/Reveal";
import {
  IconReturn,
  IconSearch,
  IconShield,
  IconSpark,
  IconTruck,
} from "@/components/icons";
import { prisma } from "@/lib/db";
import { CARD_SELECT, toCard } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { getStoreSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

async function getProduct(handle: string) {
  return prisma.product.findFirst({
    where: { handle, status: "ACTIVE" },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: { orderBy: { position: "asc" } },
      source: {
        select: {
          supplier: { select: { shipDaysMin: true, shipDaysMax: true } },
          // Captured videos live here — see the note in fromCapture.
          raw: true,
        },
      },
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
  if (!product) return { title: "Not found" };

  return {
    title: product.seoTitle ?? product.title,
    description: product.seoDescription ?? product.title,
    alternates: { canonical: `/products/${product.handle}` },
    openGraph: {
      type: "website",
      title: product.seoTitle ?? product.title,
      description: product.seoDescription ?? undefined,
      images: product.images[0]?.url ? [product.images[0].url] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const settings = await getStoreSettings();
  const product = await getProduct(handle);

  if (!product) notFound();

  const related = await prisma.product
    .findMany({
      where: { status: "ACTIVE", handle: { not: handle } },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: CARD_SELECT,
    })
    .catch(() => []);

  const shipMin = product.source?.supplier.shipDaysMin ?? 7;
  const shipMax = product.source?.supplier.shipDaysMax ?? 21;
  const cheapest = product.variants.reduce(
    (min, v) => (v.priceMinor < min ? v.priceMinor : min),
    product.variants[0]?.priceMinor ?? 0,
  );
  const inStock = product.variants.some(
    (v) => v.inventory == null || v.inventory > 0,
  );

  /*
   * Variant photos belong in the gallery, not only behind the option picker.
   * A sixteen-colour listing arrives with a photo per colour, and showing only
   * the handful of catalogue shots leaves the shopper unable to see the one
   * they are actually buying. Product images lead so the hero stays the hero.
   */
  /*
   * Specification, built only from what the supplier listing actually stated
   * for this exact item. Most dropship pages either paste unreadable supplier
   * copy or invent specifications outright; the point of difference here is
   * that a figure appears only when it was captured, and is otherwise absent.
   */
  /*
   * Videos ride in SupplierProduct.raw, because there is no column for them and
   * adding one means a MySQL migration on shared hosting for a list of URLs.
   * Read defensively: raw is untyped JSON and older imports predate the field.
   */
  const productVideos = (() => {
    const raw = product.source?.raw as { videos?: unknown } | null | undefined;
    if (!raw || !Array.isArray(raw.videos)) return [];
    return raw.videos.filter((v): v is string => typeof v === "string" && v.length > 8);
  })();

  const specification = (() => {
    const byName = new Map<string, Set<string>>();
    for (const variant of product.variants) {
      const values = (variant.optionValues ?? {}) as Record<string, string>;
      for (const [name, value] of Object.entries(values)) {
        if (!name || !value) continue;
        if (!byName.has(name)) byName.set(name, new Set());
        byName.get(name)!.add(value);
      }
    }
    return Array.from(byName.entries()).map(([name, values]) => ({
      name,
      values: Array.from(values),
    }));
  })();

  const galleryImages = (() => {
    const seen = new Set<string>();
    const out: { url: string; alt: string }[] = [];
    for (const image of product.images) {
      if (seen.has(image.url)) continue;
      seen.add(image.url);
      out.push({ url: image.url, alt: image.alt ?? product.title });
    }
    for (const variant of product.variants) {
      if (!variant.imageUrl || seen.has(variant.imageUrl)) continue;
      seen.add(variant.imageUrl);
      out.push({
        url: variant.imageUrl,
        alt: `${product.title} — ${variant.title}`,
      });
    }
    return out;
  })();

  /*
   * Product structured data. Only facts we actually hold are emitted — there
   * is no aggregateRating, because inventing review data is both dishonest
   * and a Google policy violation. It appears once reviews are real.
   */
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.title,
    description: product.seoDescription ?? undefined,
    image: product.images.map((i) => i.url).slice(0, 6),
    sku: product.variants[0]?.sku ?? undefined,
    brand: !isMarketplaceName(product.vendor)
      ? { "@type": "Brand", name: product.vendor }
      : undefined,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: settings.baseCurrency,
      lowPrice: (cheapest / 100).toFixed(2),
      offerCount: product.variants.length,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
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
            <Link
              href="/collections/all"
              className="hover:text-onyx transition-colors"
            >
              Shop
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-greige">{product.title}</li>
        </ol>
      </nav>

      <VariantMediaProvider>
        <div className="shell grid gap-12 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:py-14">
          {/* Capped so the frame stays a product shot rather than a billboard. */}
          <div className="min-w-0 lg:max-w-[620px]">
            <ProductGallery images={galleryImages} videos={productVideos} title={product.title} />
          </div>

          {/*
           * min-w-0: a grid item defaults to min-width:auto and refuses to
           * shrink below its content's min-content width. Supplier titles run
           * past 140 characters, so this column was forced wide, pushed off
           * the viewport, and took the page into horizontal scroll.
           */}
          <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            <p className="label mb-3 break-words">{displayVendor(product.vendor)}</p>
            <h1 className="display-m break-words hyphens-auto">
              {product.title}
            </h1>
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
                <dd className="ml-auto text-right text-body text-greige">
                  Emailed when it ships
                </dd>
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
                    Complimentary over{" "}
                    {formatMoney(
                      settings.freeShippingOverMinor,
                      settings.baseCurrency,
                    )}
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

            {specification.length > 0 && (
              <section className="mt-12">
                <h2 className="font-display text-d2 text-onyx">Specification</h2>
                <dl className="mt-5 divide-y divide-rule border-y border-rule">
                  {specification.map((spec) => (
                    <div key={spec.name} className="flex gap-5 py-4">
                      <dt className="label w-28 shrink-0 pt-0.5">{spec.name}</dt>
                      <dd className="min-w-0 text-body text-greige">
                        {spec.values.join('  ·  ')}
                      </dd>
                    </div>
                  ))}
                  <div className="flex gap-5 py-4">
                    <dt className="label w-28 shrink-0 pt-0.5">Choices</dt>
                    <dd className="min-w-0 text-body text-greige">
                      {product.variants.length}{' '}
                      {product.variants.length === 1 ? 'option' : 'options'} available
                    </dd>
                  </div>
                  <div className="flex gap-5 py-4">
                    <dt className="label w-28 shrink-0 pt-0.5">Supplier</dt>
                    <dd className="min-w-0 break-words text-body text-greige">
                      {displayVendor(product.vendor)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 max-w-text text-micro text-quiet">
                  Read from the supplier&rsquo;s own listing for this exact item. Anything
                  they did not state, we leave out rather than guess at.
                </p>
              </section>
            )}
          </div>
        </div>
      </VariantMediaProvider>

      {related.length > 0 && (
        <section className="border-t border-rule">
          <div className="shell py-20">
            <Reveal>
              <SectionHead eyebrow="Also consider" title="You may also like" />
            </Reveal>
            <Reveal
              stagger
              className="mt-12 grid grid-cols-2 gap-x-5 gap-y-14 lg:grid-cols-4"
            >
              {related.map((p, i) => (
                <div key={p.handle} style={{ "--i": i } as React.CSSProperties}>
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
