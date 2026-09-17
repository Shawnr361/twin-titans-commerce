/**
 * Shop titles: the short name a product card prints, written from the supplier's
 * keyword-stuffed listing title.
 *
 * WHY cleanProductTitle WAS NOT ENOUGH
 * -----------------------------------
 * cleanProductTitle only removes — marketplace tails, brackets, a leading "1pc"
 * — and cuts anything over 70 characters. That is safe, but a title that is
 * keyword soup from its first word stays keyword soup: "Toilet Seat Cover Warm
 * Soft Acrylic Washable Mat Home Decor Closestool" passed through untouched and
 * sat on the homepage looking like an AliExpress search result. Every batch of
 * captures needed a manual rename pass, which nobody should have to remember.
 *
 * HOW A MODEL IS ALLOWED TO DO THIS UNATTENDED
 * --------------------------------------------
 * The reason the cleaner never rewrote was that a rewrite runs with nobody
 * checking, and a title is a claim about what is in the box. So the model is
 * not trusted — its answer is. isFaithfulTitle accepts a name only if every
 * meaningful word in it already appears in the supplier's own title (allowing
 * plurals and a handful of joining words). The model can select and reorder;
 * it cannot add a material, a size, a feature or a sales word. Anything that
 * fails keeps the old title, which is ugly but never untrue.
 *
 * This file is pure — no database, no network — so the guard is testable in
 * scripts/verify-logic.ts. The job that applies it lives in shopTitleJob.ts.
 */

export const SHOP_TITLE_MAX = 48;
const SHOP_TITLE_MIN = 6;
const MAX_WORDS = 7;

/** Joining words a name may use even when the supplier title does not. */
const FILLER = new Set([
  'and', 'for', 'with', 'of', 'the', 'a', 'an', 'in', 'to', 'on',
  'set', 'pack', 'kit', 'piece', 'pieces', 'pc', 'pcs',
]);

/**
 * Sales words. Refused even when the supplier used them: "Premium" in a
 * marketplace title is a keyword, not a fact anyone checked.
 */
const PUFFERY = new Set([
  'premium', 'luxury', 'luxurious', 'best', 'perfect', 'amazing', 'genuine',
  'original', 'authentic', 'official', 'new', 'hot', 'upgraded', 'upgrade',
  'quality', 'high-quality', 'bestseller', 'bestselling', 'trendy', 'wholesale',
]);

export const SHOP_TITLE_SYSTEM = `You name products for the cards of Twin Titans Emporium, an online shop in Nigeria. You are given a marketplace supplier's listing title, which is stuffed with search keywords. Write the short name a good shop would print on the product card.

RULES
- 2 to 6 words, at most 40 characters.
- Say plainly what the product is, plus at most one detail that tells it apart (the kind, the use, or the count in a multi-pack).
- Use ONLY words that appear in the supplier title. You may drop words, reorder them, change singular or plural, and add "and", "for", "with", "of", "set" or "pack". Never add any other word, fact, material, size or feature.
- Drop brand names, model numbers, marketplace words, years, and sales words such as premium, luxury, new, hot, upgraded, best.
- Keep a number only when it is the count in a multi-pack, written like "60-Piece".
- Title Case. British English. No quotation marks, no full stop, no emoji.

Reply with the name only, on one line.

Examples
Supplier: Toilet Seat Cover Warm Soft Acrylic Washable Mat Home Decor Closestool
Name: Warm Washable Toilet Seat Cover

Supplier: 10 Blades Portable Fruit Juicer 450ml Capacity 3 Gears USB
Name: Portable Fruit Juicer

Supplier: Cats and Dogs Pet Plush Dinosaur Toys Interactive Dog Chew Toys Plush
Name: Plush Dinosaur Dog Chew Toy`;

export function shopTitlePrompt(supplierTitle: string): string {
  return `Supplier: ${supplierTitle.replace(/\s+/g, ' ').trim()}\nName:`;
}

/** First usable line of a model answer, without labels, quotes or a full stop. */
export function tidyTitleAnswer(answer: string): string {
  const line =
    String(answer ?? '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? '';
  return line
    .replace(/^(name|title)\s*:\s*/i, '')
    .replace(/^[*_"'“”‘’`]+|[*_"'“”‘’`]+$/g, '')
    .replace(/[.。]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(text: string): string[] {
  return text
    // Supplier titles glue words together ("Makeup ToolsPortable Face Razor"),
    // which would otherwise hide a word that is really there.
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9%]+/)
    .filter(Boolean);
}

/** Crude singular form — enough to match "Toys" to "Toy" and "Brushes" to "Brush". */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/*
 * Only grammatical endings, never another word glued on: "Wash" may become
 * "Washing" or "Washable", but "Water" must not become "Waterproof" — that is
 * a new claim wearing a matching prefix.
 */
const ENDINGS = ['ing', 'able', 'ible', 'ed', 'er', 'ers', 'al', 'y'];

function sameWordFamily(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length < 4) return false;
  // "Washable" from "Wash".
  if (long.startsWith(short) && ENDINGS.includes(long.slice(short.length))) return true;
  // A dropped final e: "Storage"-style is not covered, "Shaving" from "Shave" is.
  if (short.endsWith('e')) {
    const root = short.slice(0, -1);
    return long.startsWith(root) && ENDINGS.includes(long.slice(root.length));
  }
  return false;
}

export interface TitleVerdict {
  ok: boolean;
  reason?: string;
}

/**
 * Is `candidate` a name built only from what the supplier actually said?
 *
 * Deliberately strict. A false rejection costs a long title; a false acceptance
 * puts an unchecked claim on a live product.
 */
export function isFaithfulTitle(candidate: string, supplierTitle: string): TitleVerdict {
  const name = candidate.trim();
  if (name.length < SHOP_TITLE_MIN) return { ok: false, reason: 'too short' };
  if (name.length > SHOP_TITLE_MAX) return { ok: false, reason: `longer than ${SHOP_TITLE_MAX} characters` };
  if (/[|:;"“”【】[\]{}<>@#*_=+\\/~^]/.test(name)) return { ok: false, reason: 'contains markup or symbols' };
  if (/[a-z]/i.test(name) && name === name.toUpperCase() && name.replace(/[^a-z]/gi, '').length > 8) {
    return { ok: false, reason: 'all capitals' };
  }

  const tokens = words(name);
  if (tokens.length === 0) return { ok: false, reason: 'no words' };
  if (tokens.length > MAX_WORDS) return { ok: false, reason: `more than ${MAX_WORDS} words` };

  const evidence = words(supplierTitle);
  const evidenceStems = new Set(evidence.map(stem));
  let meaningful = 0;

  for (const token of tokens) {
    if (PUFFERY.has(token)) return { ok: false, reason: `sales word "${token}"` };
    if (FILLER.has(token)) continue;
    meaningful++;

    if (/\d/.test(token)) {
      // A number is a count or a measurement: it must be the supplier's number.
      if (!evidence.includes(token)) return { ok: false, reason: `number "${token}" not in the supplier title` };
      continue;
    }

    const s = stem(token);
    const found = evidenceStems.has(s) || [...evidenceStems].some((e) => sameWordFamily(s, e));
    if (!found) return { ok: false, reason: `"${token}" is not in the supplier title` };
  }

  if (meaningful === 0) return { ok: false, reason: 'only joining words' };
  return { ok: true };
}
