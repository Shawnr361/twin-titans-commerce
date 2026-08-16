import { cookies } from 'next/headers';
import { prisma } from './db';
import { getStoreSettings } from './settings';

/**
 * Cart lives in a cookie as nothing but {variantId, quantity} pairs.
 *
 * Prices are ALWAYS recomputed server-side from the database. A cart that
 * carries its own prices is a cart a customer can edit — never trust a number
 * that came back from the browser.
 */

const COOKIE = 'tt_cart';

export interface CartLine {
  variantId: string;
  quantity: number;
}

export interface HydratedLine {
  variantId: string;
  quantity: number;
  productId: string;
  productHandle: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  imageUrl: string | null;
  unitPriceMinor: number;
  unitCostMinor: number;
  compareAtMinor: number | null;
  lineTotalMinor: number;
  available: boolean;
  unavailableReason?: string;
}

export interface HydratedCart {
  lines: HydratedLine[];
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  costMinor: number;
  currency: string;
  itemCount: number;
  issues: string[];
  /** Threshold for complimentary delivery; 0 when not configured. Exposed so
   *  the cart can show progress toward it without re-reading settings. */
  freeShippingOverMinor: number;
}

export async function readCart(): Promise<CartLine[]> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l) => l && typeof l.variantId === 'string')
      .map((l) => ({
        variantId: String(l.variantId),
        quantity: Math.min(Math.max(parseInt(String(l.quantity), 10) || 1, 1), 99),
      }));
  } catch {
    return [];
  }
}

export async function writeCart(lines: CartLine[]): Promise<void> {
  (await cookies()).set(COOKIE, encodeURIComponent(JSON.stringify(lines)), {
    httpOnly: false, // the header badge reads it client-side
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearCart(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export function mergeLine(lines: CartLine[], variantId: string, quantity: number): CartLine[] {
  const next = [...lines];
  const existing = next.find((l) => l.variantId === variantId);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + quantity, 99);
  } else {
    next.push({ variantId, quantity: Math.min(Math.max(quantity, 1), 99) });
  }
  return next.filter((l) => l.quantity > 0);
}

/** Resolve cart lines against live catalog data and compute totals. */
export async function hydrateCart(lines: CartLine[]): Promise<HydratedCart> {
  const settings = await getStoreSettings();
  const issues: string[] = [];

  if (lines.length === 0) {
    return {
      lines: [],
      subtotalMinor: 0,
      shippingMinor: 0,
      totalMinor: 0,
      costMinor: 0,
      currency: settings.baseCurrency,
      freeShippingOverMinor: settings.freeShippingOverMinor,
      itemCount: 0,
      issues,
    };
  }

  const variants = await prisma.variant.findMany({
    where: { id: { in: lines.map((l) => l.variantId) } },
    include: {
      product: {
        select: { id: true, handle: true, title: true, status: true, images: { take: 1, orderBy: { position: 'asc' } } },
      },
    },
  });

  const byId = new Map(variants.map((v) => [v.id, v]));
  const hydrated: HydratedLine[] = [];

  for (const line of lines) {
    const variant = byId.get(line.variantId);
    if (!variant) {
      issues.push('An item in your cart is no longer available and was removed.');
      continue;
    }

    const unavailable =
      variant.product.status !== 'ACTIVE'
        ? 'This product is no longer on sale.'
        : variant.inventory != null && variant.inventory <= 0
          ? 'This variant is out of stock.'
          : undefined;

    if (unavailable) issues.push(`${variant.product.title}: ${unavailable}`);

    const quantity =
      variant.inventory != null ? Math.min(line.quantity, Math.max(variant.inventory, 0)) : line.quantity;

    hydrated.push({
      variantId: variant.id,
      quantity,
      productId: variant.product.id,
      productHandle: variant.product.handle,
      productTitle: variant.product.title,
      variantTitle: variant.title,
      sku: variant.sku,
      imageUrl: variant.imageUrl ?? variant.product.images[0]?.url ?? null,
      unitPriceMinor: variant.priceMinor,
      unitCostMinor: variant.costMinor,
      compareAtMinor: variant.compareAtMinor,
      lineTotalMinor: variant.priceMinor * quantity,
      available: !unavailable && quantity > 0,
      unavailableReason: unavailable,
    });
  }

  const sellable = hydrated.filter((l) => l.available);
  const subtotalMinor = sellable.reduce((s, l) => s + l.lineTotalMinor, 0);
  const costMinor = sellable.reduce((s, l) => s + l.unitCostMinor * l.quantity, 0);

  const shippingMinor =
    settings.freeShippingOverMinor > 0 && subtotalMinor >= settings.freeShippingOverMinor
      ? 0
      : settings.shippingFlatMinor;

  return {
    lines: hydrated,
    subtotalMinor,
    shippingMinor,
    totalMinor: subtotalMinor + shippingMinor,
    costMinor,
    currency: settings.baseCurrency,
    itemCount: sellable.reduce((s, l) => s + l.quantity, 0),
    issues,
    freeShippingOverMinor: settings.freeShippingOverMinor,
  };
}
