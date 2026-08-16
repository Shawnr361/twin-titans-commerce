import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({ email: z.string().email() });

/**
 * Newsletter signup.
 *
 * The email service (§22) is not built yet. Rather than silently discarding
 * the address and showing a success message — which would be a lie to the
 * customer and lose a real lead — this returns 501 and says so. It becomes a
 * real handler the moment the email provider abstraction lands.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  return NextResponse.json(
    { error: 'Our mailing list opens shortly. Please check back soon.' },
    { status: 501 }
  );
}
