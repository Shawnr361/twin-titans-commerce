import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductGallery } from '@/components/ProductGallery';
import { ProductBuyBox } from '@/components/ProductBuyBox';
import { ProductCard } from '@/components/ProductCard';
import { prisma } from '@/lib/db';
import { CARD_SELECT, toCard } from '@/lib/catalog';
import { getStoreSettings } from '@/lib/settings';

export const revalidate = 60;

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
  if (!product) return { title: 'Product not found' };

  return {
    title: product.seoTitle ?? product.title,
    description: product.seoDescription ?? product.title,
    openGraph: {
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

  return (
    <>
      <div className="container-x grid gap-10 py-10 lg:grid-cols-2 lg:py-16">
        <ProductGallery
          images={product.images.map((i) => ({ url: i.url, alt: i.alt ?? product.title }))}
          title={product.title}
        />

        <div className="space-y-7">
          <div className="space-y-3">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{product.title}</h1>
            {product.vendor && <p className="text-sm text-mut">Sold by {product.vendor}</p>}
          </div>

          <ProductBuyBox
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

          <div className="panel space-y-3 p-5 text-sm">
            <div className="flex items-start gap-3">
              <span aria-hidden className="text-accent2">
                ⏱
              </span>
              <p className="text-mut">
                Estimated delivery: <span className="text-ink">{shipMin}–{shipMax} days</span> after
                dispatch. You get a tracking number by email as soon as your parcel ships.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span aria-hidden className="text-accent2">
                🔒
              </span>
              <p className="text-mut">
                Secure checkout. Card and bank transfer accepted, charged in {settings.baseCurrency}.
              </p>
            </div>
          </div>

          {product.descriptionHtml && (
            <div
              className="prose-invert max-w-none space-y-3 text-sm leading-relaxed text-mut [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-ink [&_li]:ml-4 [&_li]:list-disc [&_strong]:text-ink"
              dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
            />
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="container-x pb-20">
          <h2 className="mb-6 text-xl font-bold tracking-tight">You might also like</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.handle} product={toCard(p, settings.baseCurrency)} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
