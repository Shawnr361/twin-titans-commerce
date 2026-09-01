import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { readDeployStatus, startDeploy } from '@/lib/deploy';

export const dynamic = 'force-dynamic';

/**
 * Start a deploy, and report on one in progress.
 *
 * WHAT GUARDS THIS
 * ----------------
 *  - requireAdmin, same as every other admin route. The session cookie is
 *    httpOnly, secure and SameSite=Lax, so a cross-site POST never carries it.
 *  - JSON content type is mandatory. An HTML form can only send urlencoded,
 *    multipart or plain text, so this closes the one CSRF shape SameSite=Lax
 *    does not: a form auto-submitted from a page the admin is tricked into
 *    visiting.
 *  - A typed confirmation in the body. Not security on its own — an attacker
 *    who can post can type a word — but it means no stray click, prefetch or
 *    retry can replace the live site.
 *  - A lock and a cooldown live in the library, so a double-click cannot run
 *    two deploys over each other while directories are being moved.
 *
 * Nothing from the request reaches a command line. There are no parameters:
 * this endpoint runs one fixed script or refuses.
 */
const schema = z.object({ confirm: z.literal('DEPLOY') });

async function admin(): Promise<{ email: string } | NextResponse> {
  try {
    const session = await requireAdmin();
    return { email: session.email };
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    throw err;
  }
}

export async function GET() {
  const who = await admin();
  if (who instanceof NextResponse) return who;
  return NextResponse.json(readDeployStatus());
}

export async function POST(request: Request) {
  const who = await admin();
  if (who instanceof NextResponse) return who;

  if (!/^application\/json/.test(request.headers.get('content-type') ?? '')) {
    return NextResponse.json({ error: 'Expected a JSON request.' }, { status: 415 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Confirmation missing. This replaces the live site.' },
      { status: 400 }
    );
  }

  const result = startDeploy(who.email);
  return NextResponse.json(
    { ...result, ...readDeployStatus() },
    { status: result.ok ? 202 : 409 }
  );
}
