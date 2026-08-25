import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError, requireAdmin } from '@/lib/auth';
import { upsertRate } from '@/lib/fx';
import {
  announcementContradictsShipping,
  getPricingRules,
  getStoreSettings,
  writeSetting,
} from '@/lib/settings';

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

  /*
   * Refuse a banner that contradicts the delivery rule.
   *
   * The announcement is the most prominent line on the site. "Free delivery
   * nationwide" while a ₦30,000 threshold exists is not a wording quibble, it
   * is a false promise to every customer below the threshold — the same class
   * of problem as the "pay on delivery" line that had to be removed. A warning
   * would be ignored eventually; this refuses to save.
   */
  if (announcementContradictsShipping(store.announcement, store.freeShippingOverMinor)) {
    return NextResponse.json(
      {
        error:
          'The announcement promises free delivery with no condition, but a free-shipping threshold is set. Either clear the threshold or reword the banner, e.g. "Free delivery on orders over ₦30,000".',
      },
      { status: 422 }
    );
  }

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
