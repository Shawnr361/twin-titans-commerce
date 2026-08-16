import { NextResponse } from 'next/server';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Discard a capture.
 *
 * Session-protected, unlike the POST capture endpoint — deleting is only ever
 * done from inside the admin, so there is no reason to accept the cross-origin
 * bearer token here.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  const { id } = await params;

  try {
    await prisma.supplierCapture.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    // Already gone is the desired end state, so treat it as success.
    return NextResponse.json({ ok: true });
  }
}
