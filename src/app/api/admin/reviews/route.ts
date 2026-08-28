import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

const schema = z.object({ id: z.string().min(1), hidden: z.boolean() });

/**
 * Show or hide one review on the storefront.
 *
 * There is deliberately no delete. A review is evidence about a supplier, and
 * the only reason to erase one rather than hide it would be to make a supplier
 * look better than they are.
 */
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
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  try {
    await prisma.review.update({
      where: { id: parsed.data.id },
      data: { hiddenAt: parsed.data.hidden ? new Date() : null },
    });
  } catch {
    return NextResponse.json({ error: 'That review no longer exists.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
