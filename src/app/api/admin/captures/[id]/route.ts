import { NextResponse } from 'next/server';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Discard a capture from the import queue.
 *
 * Only the capture. The product it may already have become is untouched — a
 * capture is the raw material, and throwing away the paperwork must never
 * delete the thing on the shelf.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  const { id } = await context.params;

  const row = await prisma.supplierCapture.findUnique({
    where: { id },
    select: { id: true, title: true },
  });
  if (!row) {
    return NextResponse.json({ error: 'That capture no longer exists.' }, { status: 404 });
  }

  await prisma.supplierCapture.delete({ where: { id } });

  return NextResponse.json({ ok: true, deleted: row.title.slice(0, 80) });
}
