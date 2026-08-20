import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, createSession } from '@/lib/auth';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email and password.' }, { status: 400 });
  }

  /*
   * Everything below is wrapped because an unhandled throw here returns a 500
   * with an EMPTY body — the browser then fails on `res.json()` with
   * "Unexpected end of JSON input", which tells the user nothing and tells us
   * nothing either. That happened for real: the database was unreachable
   * (the host had run out of process slots for Prisma's query engine) and the
   * only visible symptom was a JSON parse error in the login form.
   *
   * A login route must always answer in the shape the client expects, and must
   * log the true cause somewhere a developer can find it.
   */
  try {
    const session = await authenticate(parsed.data.email, parsed.data.password);
    if (!session) {
      // Deliberately vague — never reveal whether the email exists.
      return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
    }

    await createSession(session);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/login] failed:', err);
    return NextResponse.json(
      { error: 'Sign-in is temporarily unavailable. Please try again in a moment.' },
      { status: 503 }
    );
  }
}
