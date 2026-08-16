import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductCard, type ProductCardData } from '@/components/commerce/ProductCard';
import { Reveal } from '@/components/motion/Reveal';
import { prisma } from '@/lib/db';
import { CARD_SELECT, toCard } from '@/lib/catalog';
import { getStoreSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  if (handle === 'all') {
    return { title: 'All products', alternates: { canonical: '/collections/all' } };
  }

  const collection = await prisma.collection
    .findUnique({ where: { handle }, select: { title: true } })
    .catch(() => null);

  return collection
    ? { title: collection.title, alternates: { canonical: `/collections/${handle}` } }
    : { title: 'Not found' };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const settings = await getStoreSettings();

  // "all" is a virtual collection: every active product, newest first.
  if (handle === 'all') {
    const products = await prisma.product
      .findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        select: CARD_SELECT,
      })
      .catch(() => []);

    return (
      <Grid
        title="The catalogue"
        eyebrow="Everything"
        description=""
        products={products.map((p) => toCard(p, settings.baseCurrency))}
      />
    );
  }

  const collection = await prisma.collection.findFirst({
    where: { handle, published: true },
    include: {
      products: {
        orderBy: { position: 'asc' },
        include: { product: { select: { ...CARD_SELECT, status: true } } },
      },
    },
  });

  if (!collection) notFound();

  const products = collection.products
    .map((cp) => cp.product)
    .filter((p) => p.status === 'ACTIVE')
    .map((p) => toCard(p, settings.baseCurrency));

  return (
    <Grid
      title={collection.title}
      eyebrow="Department"
      description={collection.descriptionHtml}
      imageUrl={collection.imageUrl}
      products={products}
    />
  );
}

function Grid({
  title,
  eyebrow,
  description,
  products,
  imageUrl,
}: {
  title: string;
  eyebrow: string;
  description: string;
  products: ProductCardData[];
  imageUrl?: string | null;
}) {
  return (
    <>
      <header className="border-b border-rule">
        <div className="shell py-16 md:py-20">
          <hr className="rule-gold" />
          <p className="label mt-5">{eyebrow}</p>
          <h1 className="display-l mt-3">{title}</h1>

          {description && (
            <div
              className="prose-measure mt-6 text-body text-greige"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          )}

          <p className="label mt-8">
            {products.length} {products.length === 1 ? 'piece' : 'pieces'}
          </p>
        </div>

        {imageUrl && (
          <div className="media aspect-[21/7] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" fetchPriority="high" />
          </div>
        )}
      </header>

      <div className="shell py-16">
        {products.length === 0 ? (
          <p className="max-w-text text-body text-greige">
            Nothing here yet. Pieces appear once they have been sourced and approved.
          </p>
        ) : (
          <Reveal stagger className="grid grid-cols-2 gap-x-5 gap-y-14 lg:grid-cols-4">
            {products.map((p, i) => (
              <div key={p.handle} style={{ '--i': i % 4 } as React.CSSProperties}>
                <ProductCard product={p} priority={i < 4} />
              </div>
            ))}
          </Reveal>
        )}
      </div>
    </>
  );
}
