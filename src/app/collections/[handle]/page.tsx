import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/ProductCard';
import { prisma } from '@/lib/db';
import { CARD_SELECT, toCard } from '@/lib/catalog';
import { getStoreSettings } from '@/lib/settings';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  if (handle === 'all') return { title: 'All products' };

  const collection = await prisma.collection
    .findUnique({ where: { handle }, select: { title: true, descriptionHtml: true } })
    .catch(() => null);

  return collection ? { title: collection.title } : { title: 'Collection not found' };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const settings = await getStoreSettings();

  // "all" is a virtual collection — every active product, newest first.
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
        title="All products"
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
      description={collection.descriptionHtml}
      products={products}
    />
  );
}

function Grid({
  title,
  description,
  products,
}: {
  title: string;
  description: string;
  products: ReturnType<typeof toCard>[];
}) {
  return (
    <div className="container-x py-12">
      <header className="mb-8 space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        {description && (
          <div
            className="max-w-2xl text-sm leading-relaxed text-mut"
            dangerouslySetInnerHTML={{ __html: description }}
          />
        )}
        <p className="text-xs text-mut">
          {products.length} product{products.length === 1 ? '' : 's'}
        </p>
      </header>

      {products.length === 0 ? (
        <div className="panel p-12 text-center text-sm text-mut">
          Nothing here yet — check back soon.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.handle} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
