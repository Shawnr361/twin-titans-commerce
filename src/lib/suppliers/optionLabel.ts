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

/** Tokens that are units or codes rather than words, so they stay lowercase. */
const UNIT = /^\d+(\.\d+)?[a-z]{1,4}$/i;

function tidyToken(token: string): string {
  if (UNIT.test(token)) return token.toLowerCase();
  // Leave mixed-case alone — the supplier wrote it deliberately ("Cold White").
  if (token !== token.toUpperCase()) return token;
  // "3IN1", "2PCS" — a code, not a word.
  if (/\d/.test(token)) return token.toLowerCase();
  /*
   * Short all-caps words are acronyms, not shouting: USB, LED, RGB, HD, UV, PU.
   * Title-casing them produces "Usb", which looks like a typo on a button. The
   * cost is that a genuinely short shouted word ("NEW") stays shouted, which is
   * the cheaper mistake.
   */
  if (token.length <= 4) return token;
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

  // Breathing room around the separator the importer joins options with.
  out = out.replace(/\s*\/\s*/g, ' / ');

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
