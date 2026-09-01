/**
 * Which captured variants are real, and which are padding.
 *
 * A marketplace listing sometimes carries an SKU with no attributes on it at
 * all — no colour, no size, nothing. Imported as-is that becomes a second
 * variant beside the real one, and because it has no name to print the picker
 * labels it "Option 2". A shopper looking at a one-colour eyeliner sees
 * "Black" and "Option 2" and has to guess what the difference is. There is
 * none: it is the same product.
 *
 * Naming it better was the wrong fix — the row should not exist. This is the
 * one rule that decides, used by the importer so new products never gain one,
 * and by the tidy route so the ones already in the catalogue lose theirs.
 */

/** No attributes, or attributes that are all blank. */
export function isPlaceholderOptions(options: unknown): boolean {
  if (!options || typeof options !== 'object') return true;
  return Object.values(options as Record<string, unknown>).every(
    (value) => String(value ?? '').trim() === ''
  );
}

/**
 * Keep the variants a shopper could actually choose between.
 *
 * When some variants carry attributes, the attribute-less ones are padding and
 * go. When NONE do, the product genuinely has one variant however many rows
 * arrived, so the FIRST is kept — first is the supplier's own default, and the
 * rest are duplicates of it.
 *
 * Never returns an empty list: a product with no variant cannot be bought.
 */
export function realVariants<T extends { options?: Record<string, string> | null }>(
  variants: T[]
): T[] {
  if (variants.length <= 1) return variants;
  const named = variants.filter((v) => !isPlaceholderOptions(v.options));
  return named.length > 0 ? named : variants.slice(0, 1);
}
