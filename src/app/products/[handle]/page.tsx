import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { productDescription, siteOrigin } from "@/lib/seo";
import { Price } from "@/components/commerce/Price";
import { ProductGallery } from "@/components/commerce/ProductGallery";
import { VariantMediaProvider } from "@/components/commerce/VariantMediaContext";
import { displayVendor } from "@/lib/vendor";
import { AddToCart } from "@/components/commerce/AddToCart";
import { ProductCard } from "@/components/commerce/ProductCard";
import { SectionHead } from "@/components/layout/SectionHead";
import { Reveal } from "@/components/motion/Reveal";
import {
  IconReturn,
  IconSearch,
  IconShield,
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

  const settings = await getStoreSettings();
  const description = productDescription(product, settings.storeName);
  /*
   * Share cards get the image through our own domain, not the supplier CDN.
   *
   * The CDN answers image/webp despite a .jpg URL, and WhatsApp will not render
   * a WebP preview — every shared product link showed a card with no picture.
   * The proxy asks for JPEG and serves it from twintitanemporium.com.
   *
   * Absolute, because a share crawler has no page context to resolve a relative
   * URL against.
   */
  const rawImage = product.images[0]?.url;
  const image = rawImage
    ? `${siteOrigin()}/api/og-image?src=${encodeURIComponent(rawImage)}`
    : undefined;
  // Cheapest variant: the figure a share card and a shopper both expect.
  const priceMinor = product.variants.reduce(
    (low, v) => (v.priceMinor > 0 && (low === 0 || v.priceMinor < low) ? v.priceMinor : low),
    0
  );
  const title = product.seoTitle ?? product.title;

  return {
    title,
    description,
    alternates: { canonical: `/products/${product.handle}` },
    openGraph: {
      /*
       * Deliberately "website", not "product".
       *
       * Next validates this value while resolving metadata, so casting
       * "product" past the type system threw during the SERVER render — every
       * product page returned 200 and then rendered the error boundary, which
       * is the worst kind of break: the status code says fine.
       *
       * og:type=product would only improve a Facebook share card. Google reads
       * the JSON-LD Product offer below, which is what actually drives search
       * results, so the trade is not worth a route that can crash.
       */
      type: "website",
      title,
      description,
      images: image ? [image] : undefined,
    },
    /*
     * product:* are OG-namespaced too, so they carry the same caveat: emitted
     * via `other` they appear as name=, which Facebook does not read. They are
     * kept because they cost nothing and some scrapers are lenient, but the
     * figure search engines actually rely on is in the JSON-LD offer below.
     */
    other:
      priceMinor > 0
        ? {
            "product:price:amount": (priceMinor / 100).toFixed(2),
            "product:price:currency": settings.baseCurrency,
          }
        : {},
    /*
     * Without this, Twitter and every scraper that reads twitter:* fell back
     * to the site-wide card from the root layout - so sharing a product showed
     * the shop logo instead of the product.
     */
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
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
  /*
   * Structured data for Google's merchant listings.
   *
   * `brand` stays omitted rather than guessed when the vendor is a marketplace
   * handle: Google treats brand as recommended, and an omitted field costs a
   * warning, while asserting a supplier's shop name - or our own - as the
   * manufacturer is a claim we cannot stand behind.
   *
   * shippingDetails and hasMerchantReturnPolicy are read from the same
   * settings and policy the storefront and the terms page use, so a shipping
   * change cannot leave Google describing a rule that no longer applies.
   */
  const dearest = product.variants.reduce((high, v) => Math.max(high, v.priceMinor), 0);
  const productUrl = `${siteOrigin()}/products/${product.handle}`;
  // Same text the meta tags carry, so the page and the structured data agree.
  const description = productDescription(product, settings.storeName);

  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.title,
    description,
    image: product.images.map((i) => i.url).slice(0, 6),
    sku: product.variants[0]?.sku ?? undefined,
    // The cleaned name, not the raw one: what Google is told and what the
    // shopper is shown must be the same string.
    brand: displayVendor(product.vendor)
      ? { "@type": "Brand", name: displayVendor(product.vendor) }
      : undefined,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: settings.baseCurrency,
      lowPrice: (cheapest / 100).toFixed(2),
      // Google wants both bounds once more than one offer is advertised.
      highPrice: (Math.max(dearest, cheapest) / 100).toFixed(2),
      offerCount: product.variants.length,
      url: productUrl,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          value: (settings.shippingFlatMinor / 100).toFixed(2),
          currency: settings.baseCurrency,
        },
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "NG",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: {
            "@type": "QuantitativeValue",
            minValue: 1,
            maxValue: 3,
            unitCode: "DAY",
          },
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: 7,
            maxValue: 21,
            unitCode: "DAY",
          },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "NG",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        // Mirrors /pages/returns: 7 days, buyer pays return postage.
        merchantReturnDays: 7,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/ReturnShippingFees",
      },
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
            {displayVendor(product.vendor) && (
              <p className="label mb-3 break-words">{displayVendor(product.vendor)}</p>
            )}
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
                {/*
                  The CHARGE belongs here, not only in the basket. Showing the
                  time but not the cost means a shopper first meets the ₦3,500
                  at checkout, which is where carts get abandoned.
                */}
                <dd className="ml-auto text-right text-body text-greige">
                  {settings.shippingFlatMinor > 0 ? (
                    <span className="block text-onyx">
                      {/*
                        Price, not formatMoney: a shopper who switched to USD
                        was shown "$18.50" for the item and "₦3,500" for its
                        delivery on the same line.
                      */}
                      <Price
                        minor={settings.shippingFlatMinor}
                        currency={settings.baseCurrency}
                      />
                      {settings.freeShippingOverMinor > 0 && (
                        <>
                          {" · free over "}
                          {/* Rounded like the announcement bar — same claim,
                              so it must not be a different number. */}
                          <Price
                            minor={settings.freeShippingOverMinor}
                            currency={settings.baseCurrency}
                            roundUp
                          />
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="block text-onyx">Free delivery</span>
                  )}
                  <span className="block">
                    {shipMin}–{shipMax} days after dispatch
                  </span>
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
                {/*
                  Names the rails a shopper will actually meet at checkout.
                  The old line ("Card, transfer or USSD in NGN") described
                  Paystack, which the store no longer uses, and omitted PayPal
                  entirely — so an overseas visitor reading prices in USD was
                  told the only option was a naira payment method.

                  The currency shown is always the BASE currency, never the
                  visitor's display currency: Flutterwave charges in naira
                  whatever the storefront is showing, and implying otherwise
                  would be a promise about money that checkout then breaks.
                */}
                <dd className="ml-auto text-right text-body text-greige">
                  Card or bank transfer in {settings.baseCurrency} via Flutterwave,
                  {' '}or PayPal in {settings.paypalCurrency}
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
                  <div
                    className={`flex gap-5 py-4 ${product.variants.length > 1 ? '' : 'hidden'}`}
                  >
                    <dt className="label w-28 shrink-0 pt-0.5">Choices</dt>
                    <dd className="min-w-0 text-body text-greige">
                      {/*
                        "1 option available" is not information — a product with
                        one variant simply has no choice to make, and saying so
                        invites the shopper to look for a picker that is not
                        there. Same reason the placeholder variant is never
                        printed as "Default".
                      */}
                      {product.variants.length} options available
                    </dd>
                  </div>
                  {/*
                    "Brand", not "Supplier". The row only appears when the name
                    is plausibly the maker; naming the marketplace seller we
                    buy from tells a shopper nothing they want to know.
                  */}
                  {displayVendor(product.vendor) && (
                    <div className="flex gap-5 py-4">
                      <dt className="label w-28 shrink-0 pt-0.5">Brand</dt>
                      <dd className="min-w-0 break-words text-body text-greige">
                        {displayVendor(product.vendor)}
                      </dd>
                    </div>
                  )}
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
