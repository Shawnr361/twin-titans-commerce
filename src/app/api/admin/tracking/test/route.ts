import { NextResponse } from 'next/server';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { sendTestPurchase } from '@/lib/tracking';

/**
 * Fire one synthetic Purchase through the real Conversions/Events API senders
 * and return exactly what each platform replied.
 *
 * This exists because both platforms answer HTTP 200 to payloads they reject,
 * so "no error" is not evidence of anything. Running this after entering a
 * token turns a silent unknown into a printed verdict, before a real order is
 * the thing that finds out.
 *
 * Admin-only and JSON-only, like the rest of the admin surface.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }

  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Expected JSON.' }, { status: 415 });
  }

  const body = (await request.json().catch(() => ({}))) as { testEventCode?: unknown };
  const code = typeof body.testEventCode === 'string' ? body.testEventCode.trim() : '';
  const result = await sendTestPurchase(code || undefined);
  return NextResponse.json(result);
}
