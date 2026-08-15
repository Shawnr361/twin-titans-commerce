import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { commitImport, previewImport, type PreviewResult } from '@/lib/suppliers/import';

const previewSchema = z.object({
  action: z.literal('preview'),
  url: z.string().min(4),
  marginPct: z.number().min(0).max(95).optional(),
});

const commitSchema = z.object({
  action: z.literal('commit'),
  preview: z.unknown(),
  title: z.string().optional(),
  descriptionHtml: z.string().optional(),
  handle: z.string().optional(),
  productType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  supplierName: z.string().optional(),
  priceOverrides: z.record(z.string(), z.number()).optional(),
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

  const body = await request.json().catch(() => null);

  const preview = previewSchema.safeParse(body);
  if (preview.success) {
    try {
      const result = await previewImport(
        preview.data.url,
        preview.data.marginPct != null
          ? { strategy: 'MARGIN', marginPct: preview.data.marginPct }
          : undefined
      );
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Import failed.' },
        { status: 422 }
      );
    }
  }

  const commit = commitSchema.safeParse(body);
  if (commit.success) {
    try {
      const overrides: Record<number, number> = {};
      for (const [key, value] of Object.entries(commit.data.priceOverrides ?? {})) {
        overrides[Number(key)] = value;
      }

      const result = await commitImport({
        preview: commit.data.preview as PreviewResult,
        title: commit.data.title,
        descriptionHtml: commit.data.descriptionHtml,
        handle: commit.data.handle,
        productType: commit.data.productType,
        tags: commit.data.tags,
        supplierName: commit.data.supplierName,
        priceOverrides: overrides,
      });
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Could not save the product.' },
        { status: 422 }
      );
    }
  }

  return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
}
