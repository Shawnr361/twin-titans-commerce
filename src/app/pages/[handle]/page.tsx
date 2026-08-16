import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getPage(handle: string) {
  return prisma.page.findFirst({ where: { handle, published: true } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const page = await getPage(handle).catch(() => null);
  if (!page) return { title: 'Not found' };

  return {
    title: page.seoTitle ?? page.title,
    description: page.seoDescription ?? undefined,
    alternates: { canonical: `/pages/${page.handle}` },
  };
}

export default async function ContentPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const page = await getPage(handle);

  if (!page) notFound();

  return (
    <article className="shell py-16 md:py-24">
      <header className="max-w-text">
        <hr className="rule-gold" />
        <h1 className="display-l mt-5">{page.title}</h1>
      </header>

      {/*
        Editorial prose. Headings get the display serif and generous space
        above; body copy is capped at a comfortable measure rather than
        running the full width of the shell.
      */}
      <div
        className="prose-measure mt-10 space-y-5 text-body text-greige
          [&_a]:text-onyx [&_a]:underline [&_a]:underline-offset-2
          [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-d2 [&_h2]:text-onyx
          [&_h3]:mt-8 [&_h3]:font-display [&_h3]:text-d2 [&_h3]:text-onyx
          [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal
          [&_strong]:text-onyx [&_ul]:space-y-2 [&_ol]:space-y-2"
        dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
      />
    </article>
  );
}
