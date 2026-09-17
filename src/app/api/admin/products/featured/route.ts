import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { FEATURED_TAG, tagList } from '@/lib/tags';

export const dynamic = 'force-dynamic';

/**
 * Put a product in (or take it out of) the homepage hero.
 *
 * The hero used to show whatever was imported last, which is how a toilet seat
 * cover became the first thing a visitor saw under "Consider it delivered." The
 * merchant chooses now; the newest products are only the fallback when nothing
 * has been chosen.
 */
const schema = z.object({
  productId: z.string().min(1),
  featured: z.boolean(),
});

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, tags: true, status: true },
  });
  if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });

  const others = tagList(product.tags).filter((t) => t !== FEATURED_TAG);
  const tags = parsed.data.featured ? [...others, FEATURED_TAG] : others;

  await prisma.product.update({ where: { id: product.id }, data: { tags: tags as never } });

  return NextResponse.json({
    ok: true,
    featured: parsed.data.featured,
    // Featuring a draft is allowed, but it will not appear until it is live.
    live: product.status === 'ACTIVE',
  });
}
