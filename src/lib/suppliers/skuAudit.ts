/**
 * Is a stored variant still buyable from the supplier?
 *
 * Shared by the one-off repair route and the standing cron, so the two cannot
 * drift into disagreeing about what "unorderable" means — which would show up
 * as the cron blocking variants the repair had just fixed, or the reverse.
 */

/** Comparison key for an option set: order-independent, punctuation-blind. */
export function optionKey(options: Record<string, unknown> | null | undefined): string {
  if (!options || typeof options !== 'object') return '';
  return Object.values(options)
    .map((v) =>
      String(v ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
    )
    .filter(Boolean)
    .sort()
    .join('|');
}

export interface SupplierSku {
  skuId?: string | number | null;
  options?: Record<string, unknown> | null;
}

export interface StoredVariant {
  id: string;
  title: string;
  supplierVariantId: string | null;
  optionValues: unknown;
  inventory: number | null;
}

export type SkuVerdict =
  /** Its SKU is still on the listing — nothing to do. */
  | { kind: 'live'; skuId: string }
  /** Matched to a SKU by its options; store this id. */
  | { kind: 'rematched'; skuId: string; wasStale: boolean }
  /** Nothing on the listing matches, or several do. Cannot be ordered. */
  | { kind: 'unorderable'; reason: 'no SKU matches' | 'several SKUs match' };

/**
 * Decide one variant against the supplier's current SKU list.
 *
 * AMBIGUITY IS TREATED AS UNORDERABLE, NOT GUESSED
 * ------------------------------------------------
 * Where several SKUs share an option key, picking one would place a real order
 * for possibly the wrong thing — and unlike a refused order, that failure is
 * discovered by the customer opening the parcel. A blocked sale is recoverable;
 * a wrong delivery is a refund and a bad review.
 */
export function decideVariant(
  variant: StoredVariant,
  supplierSkus: SupplierSku[]
): SkuVerdict {
  const live = new Set(supplierSkus.map((s) => String(s.skuId ?? '')).filter(Boolean));

  if (variant.supplierVariantId && live.has(String(variant.supplierVariantId))) {
    return { kind: 'live', skuId: String(variant.supplierVariantId) };
  }

  const byOptions = new Map<string, string[]>();
  for (const s of supplierSkus) {
    if (!s.skuId) continue;
    const key = optionKey(s.options);
    byOptions.set(key, [...(byOptions.get(key) ?? []), String(s.skuId)]);
  }

  const candidates = byOptions.get(optionKey(variant.optionValues as Record<string, unknown>)) ?? [];

  /*
   * A listing with exactly one SKU has nothing to match ON, and nothing to get
   * wrong either — if there is only one thing to buy, that is the one.
   */
  if (candidates.length === 0 && supplierSkus.length === 1 && supplierSkus[0].skuId) {
    return {
      kind: 'rematched',
      skuId: String(supplierSkus[0].skuId),
      wasStale: Boolean(variant.supplierVariantId),
    };
  }

  if (candidates.length === 1) {
    return { kind: 'rematched', skuId: candidates[0], wasStale: Boolean(variant.supplierVariantId) };
  }

  return {
    kind: 'unorderable',
    reason: candidates.length > 1 ? 'several SKUs match' : 'no SKU matches',
  };
}
