import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { getTrackingSettings, writeTrackingSettings } from '@/lib/tracking';

/**
 * Save pixel ids and Conversions/Events API tokens.
 *
 * Admin-only, JSON-only. The JSON content-type requirement is the same CSRF
 * guard the other admin routes use: a cross-site form post cannot set it, and
 * SameSite=Lax alone does not cover this shape.
 */

const schema = z.object({
  metaPixelId: z.string().max(64),
  tiktokPixelId: z.string().max(64),
  metaTestEventCode: z.string().max(64),
  tiktokTestEventCode: z.string().max(64),
  metaCapiToken: z.string().max(1024),
  tiktokEventsToken: z.string().max(1024),
  clearMetaToken: z.boolean().default(false),
  clearTiktokToken: z.boolean().default(false),
});

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

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Check the values and try again.' }, { status: 400 });
  }

  const input = parsed.data;
  const current = await getTrackingSettings();

  /*
   * A pixel id with no token is a half-installed setup that still LOOKS
   * installed — the browser reports events, the dashboard fills with traffic,
   * and the conversions that actually matter go missing on every blocked or
   * abandoned session. Refuse it rather than let it look healthy.
   */
  const metaToken = input.clearMetaToken ? '' : input.metaCapiToken || current.metaCapiToken;
  const tiktokToken = input.clearTiktokToken
    ? ''
    : input.tiktokEventsToken || current.tiktokEventsToken;

  await writeTrackingSettings({
    metaPixelId: input.metaPixelId,
    tiktokPixelId: input.tiktokPixelId,
    metaCapiToken: metaToken,
    tiktokEventsToken: tiktokToken,
    metaTestEventCode: input.metaTestEventCode,
    tiktokTestEventCode: input.tiktokTestEventCode,
  });

  const warnings: string[] = [];
  if (input.metaPixelId && !metaToken) {
    warnings.push(
      'Meta pixel is set with no Conversions API token — browser events only, so blocked and abandoned sessions will not report.'
    );
  }
  if (input.tiktokPixelId && !tiktokToken) {
    warnings.push(
      'TikTok pixel is set with no Events API token — browser events only, same limitation.'
    );
  }
  if (input.metaTestEventCode || input.tiktokTestEventCode) {
    warnings.push(
      'A test event code is set. Events sent with one are diagnostic only and are not counted for optimisation — clear it once verified.'
    );
  }

  return NextResponse.json({ ok: true, warnings });
}
