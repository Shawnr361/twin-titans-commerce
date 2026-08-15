import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { auditMargin } from '@/lib/pricing';
import { getPricingRules } from '@/lib/settings';

const schema = z.object({
  productId: z.string().min(1),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
});

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

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    include: { variants: true },
  });
  if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });

  // Server-side guard. The UI already blocks this, but the rule that matters is
  // the one enforced where it cannot be bypassed.
  if (parsed.data.status === 'ACTIVE') {
    const rules = await getPricingRules();
    const losing = product.variants
      .map((v) => ({ v, audit: auditMargin(v.priceMinor, v.costMinor, rules) }))
      .filter((x) => x.audit.severity === 'loss');

    if (losing.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot publish: ${losing.length} variant(s) would sell at or below landed cost (${losing
            .map((x) => x.v.title)
            .join(', ')}).`,
        },
        { status: 422 }
      );
    }
  }

  await prisma.product.update({
    where: { id: product.id },
    data: {
      status: parsed.data.status,
      publishedAt:
        parsed.data.status === 'ACTIVE' ? (product.publishedAt ?? new Date()) : product.publishedAt,
    },
  });

  return NextResponse.json({ ok: true });
}
