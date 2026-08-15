import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const page = await prisma.page
    .findFirst({ where: { handle, published: true }, select: { title: true, seoTitle: true, seoDescription: true } })
    .catch(() => null);

  if (!page) return { title: 'Page not found' };
  return { title: page.seoTitle ?? page.title, description: page.seoDescription ?? undefined };
}

/**
 * Content and marketing landing pages.
 *
 * Page bodies are authored HTML scoped under `.ttlp`. Headings and body text
 * get explicit colours here because on the old theme they inherited the
 * theme's dark colour and rendered invisible against a dark card — the fix is
 * baked into the wrapper so every page gets it, rather than each page
 * remembering to.
 */
export default async function ContentPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  const page = await prisma.page.findFirst({ where: { handle, published: true } });
  if (!page) notFound();

  return (
    <div className="container-x py-12">
      <article className="ttlp mx-auto max-w-[1080px] overflow-hidden rounded-xl2 border border-line bg-panel/60 p-6 sm:p-10">
        <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {page.title}
        </h1>
        <div
          className="space-y-4 text-sm leading-relaxed text-mut [&_a]:text-accent2 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-ink [&_img]:max-w-full [&_img]:rounded-xl [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink"
          dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
        />
      </article>
    </div>
  );
}
