import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { buildPolicies } from '@/content/policies';
import { getStoreSettings } from '@/lib/settings';

/**
 * Publish the store's legal pages from src/content/policies.ts.
 *
 * The documents quote the delivery charge, the free-delivery threshold and the
 * settlement currency, all of which come from admin Settings. Run this again
 * after changing any of them, or the published terms will describe a shipping
 * rule the checkout no longer applies — which is precisely the document a
 * customer would quote back during a chargeback.
 *
 * A route rather than a script because node cannot start on this host: its
 * worker threads count against the LVE process cap and abort with
 * uv_thread_create. Inside the Passenger worker there is no process to spawn.
 *
 * Dry run unless `apply` is true, and it reports a diff of what would change.
 */

const schema = z.object({
  apply: z.boolean().optional(),
  /** Restrict to specific handles, e.g. ["privacy"]. Default is all of them. */
  handles: z.array(z.string()).optional(),
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

  const parsed = schema.safeParse((await request.json().catch(() => ({}))) ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const { apply = false, handles } = parsed.data;

  const settings = await getStoreSettings();
  const docs = buildPolicies(settings).filter((d) => !handles || handles.includes(d.handle));

  if (docs.length === 0) {
    return NextResponse.json({ error: 'No matching pages.' }, { status: 400 });
  }

  const report: Array<Record<string, unknown>> = [];
  let written = 0;

  for (const doc of docs) {
    const existing = await prisma.page.findUnique({ where: { handle: doc.handle } });
    const unchanged =
      existing != null &&
      existing.bodyHtml === doc.bodyHtml &&
      existing.title === doc.title &&
      existing.seoTitle === doc.seoTitle &&
      existing.seoDescription === doc.seoDescription &&
      existing.published;

    report.push({
      handle: doc.handle,
      title: doc.title,
      action: existing == null ? 'create' : unchanged ? 'no change' : 'replace',
      wasChars: existing?.bodyHtml.length ?? 0,
      nowChars: doc.bodyHtml.length,
      url: `/pages/${doc.handle}`,
    });

    if (!apply || unchanged) continue;

    await prisma.page.upsert({
      where: { handle: doc.handle },
      create: {
        handle: doc.handle,
        title: doc.title,
        bodyHtml: doc.bodyHtml,
        seoTitle: doc.seoTitle,
        seoDescription: doc.seoDescription,
        published: true,
      },
      update: {
        title: doc.title,
        bodyHtml: doc.bodyHtml,
        seoTitle: doc.seoTitle,
        seoDescription: doc.seoDescription,
        published: true,
      },
    });
    written++;
  }

  return NextResponse.json({
    applied: apply,
    /*
     * Surfaced because the policies name a contact address, and an unset
     * supportEmail silently falls back to a mailbox that may not exist yet. A
     * data-rights request or a complaint sent to a dead address is a real
     * problem, so it is reported on every run rather than buried in settings.
     */
    supportEmail: settings.supportEmail || '(unset — policies fall back to support@twintitanemporium.com)',
    pagesWritten: written,
    pages: report,
    note: apply ? 'Pages published.' : 'Nothing was changed. Send { "apply": true } to publish.',
  });
}
