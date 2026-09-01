/**
 * Make a supplier's option label fit to print on a button.
 *
 * What actually arrives, unedited, from real listings in this catalogue:
 *
 *   "WHITE-3IN1 / 103CM"        shouting
 *   "8 / 90cn"                  a unit typo — the supplier meant 90cm
 *   "Cold White / 3m-By USB"    cramped separators
 *
 * DELIBERATELY CONSERVATIVE. These labels are the only thing distinguishing
 * one SKU from another on the page, so the rule fixes presentation and never
 * meaning: nothing is dropped, no word is removed, no two options are merged.
 * A shopper must still be able to tell every choice apart afterwards.
 *
 * Only the displayed title is touched. optionValues, the supplier SKU and the
 * variant id are left exactly as captured, because those are what an order is
 * matched and fulfilled against — presentation is safe to rewrite, the data
 * behind the sale is not.
 */

/**
 * A measurement, and nothing else: 103CM, 10PCS, 1PC, 15G.
 *
 * Deliberately a closed list of units. An earlier version lowercased any
 * all-caps token containing a digit, which turned "64GB" into "64gb", "4K"
 * into "4k" and the product code "D03" into "d03" — the preview caught all
 * three across 503 labels before any of it was written.
 */
const MEASUREMENT = /^\d+(\.\d+)?(cm|mm|m|g|kg|ml|l|pcs?|sets?|inch(es)?)$/i;

/** A word rather than a part number: letters only, and it can be pronounced. */
function looksLikeAWord(token: string): boolean {
  return /^[A-Z]+$/.test(token) && /[AEIOU]/.test(token) && token.length >= 4;
}

function tidyToken(token: string): string {
  if (MEASUREMENT.test(token)) return token.toLowerCase();
  // Mixed case is the supplier writing deliberately ("Cold White").
  if (token !== token.toUpperCase()) return token;
  /*
   * Everything else all-caps is title-cased ONLY when it reads as a word.
   * "PURPLE" is shouting; "NCSKJ" is a part number and has no vowels; "USB"
   * and "LED" are acronyms and too short to be shouting. Anything carrying a
   * digit — D03, 64GB, 13X4 — is left exactly as written, because a code a
   * customer may have to quote back to us is not ours to restyle.
   */
  if (!looksLikeAWord(token)) return token;
  return token.charAt(0) + token.slice(1).toLowerCase();
}


/** One label, cleaned. */
export function cleanOptionLabel(raw: string): string {
  let out = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  // "90cn" is a typo for 90cm on every listing here; only after a digit, so a
  // word that legitimately ends in "cn" is untouched.
  out = out.replace(/(\d)\s*cn\b/gi, '$1cm');

  /*
   * The separator is deliberately NOT touched. The importer already joins
   * options with " / ", so there is nothing to fix — and an option NAME can
   * itself contain a slash: "Voltage/Plug Type: USB Type-C" was being split
   * into "Voltage / Plug Type", inventing a second option that never existed.
   */

  out = out
    .split(' ')
    .map((word) => word.split('-').map(tidyToken).join('-'))
    .join(' ');

  return out.trim();
}

/**
 * A product's labels, cleaned as a set.
 *
 * Collision safety is the point of doing them together: on one listing here
 * both "NEW White" and "White" exist as separate variants. Any rule that
 * collapsed them would leave two buttons reading the same thing, which is
 * worse than shouting. If a cleaned label would duplicate another, that one
 * keeps its original text.
 */
export function cleanOptionLabels(titles: string[]): string[] {
  const taken = new Set<string>();
  const cleaned = titles.map((t) => {
    const next = cleanOptionLabel(t);
    if (!next) return t;
    const collides = next !== t && (titles.includes(next) || taken.has(next.toLowerCase()));
    const chosen = collides ? t : next;
    taken.add(chosen.toLowerCase());
    return chosen;
  });
  return cleaned;
}
