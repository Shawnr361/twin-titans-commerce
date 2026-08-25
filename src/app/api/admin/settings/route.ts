import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { upsertRate } from '@/lib/fx';
import { getPricingRules, getStoreSettings, writeSetting } from '@/lib/settings';

const schema = z.object({
  store: z.object({
    storeName: z.string().min(1),
    tagline: z.string(),
    supportEmail: z.string().email().or(z.literal('')),
    supportPhone: z.string(),
    announcement: z.string(),
    /*
     * Delivery, in MINOR units (kobo). Editable here so the merchant can change
     * the threshold without a redeploy — and so the announcement bar, which
     * advertises it, can be corrected in the same place at the same time.
     */
    shippingFlatMinor: z.number().int().min(0),
    freeShippingOverMinor: z.number().int().min(0),
  }),
  pricing: z.object({
    marginPct: z.number().min(0).max(95),
    minMarginPct: z.number().min(0).max(95),
  }),
  rates: z.record(z.string(), z.number().positive()),
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

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Check the values and try again.' }, { status: 400 });
  }

  const { store, pricing, rates } = parsed.data;

  if (pricing.minMarginPct > pricing.marginPct) {
    return NextResponse.json(
      { error: 'The minimum margin cannot be higher than the target margin.' },
      { status: 400 }
    );
  }

  const [currentStore, currentPricing] = await Promise.all([getStoreSettings(), getPricingRules()]);

  await writeSetting('store', { ...currentStore, ...store });
  await writeSetting('pricing', { ...currentPricing, ...pricing });

  for (const [code, rate] of Object.entries(rates)) {
    if (Number.isFinite(rate) && rate > 0) await upsertRate(code, rate);
  }

  return NextResponse.json({ ok: true });
}
