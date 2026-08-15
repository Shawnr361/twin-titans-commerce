import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hydrateCart, mergeLine, readCart, writeCart } from '@/lib/cart';
import { prisma } from '@/lib/db';

const addSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(99).default(1),
});

const updateSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(0).max(99),
});

export async function GET() {
  const cart = await hydrateCart(await readCart());
  return NextResponse.json(cart);
}

export async function POST(request: Request) {
  const parsed = addSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // Verify the variant exists and is actually purchasable before it can enter
  // a cart — otherwise a stale or guessed id sits there until checkout.
  const variant = await prisma.variant.findUnique({
    where: { id: parsed.data.variantId },
    select: { id: true, product: { select: { status: true } } },
  });

  if (!variant || variant.product.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'That product is not available.' }, { status: 404 });
  }

  const lines = mergeLine(await readCart(), parsed.data.variantId, parsed.data.quantity);
  await writeCart(lines);

  return NextResponse.json(await hydrateCart(lines));
}

export async function PATCH(request: Request) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const lines = (await readCart())
    .map((l) =>
      l.variantId === parsed.data.variantId ? { ...l, quantity: parsed.data.quantity } : l
    )
    .filter((l) => l.quantity > 0);

  await writeCart(lines);
  return NextResponse.json(await hydrateCart(lines));
}

export async function DELETE() {
  await writeCart([]);
  return NextResponse.json(await hydrateCart([]));
}
