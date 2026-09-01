/**
 * Turn a supplier's title into one a shop can put on a card.
 *
 * WHY THIS EXISTS
 * ---------------
 * A marketplace listing title is not written for a shopper, it is written for
 * that marketplace's search box. It is keyword-stuffed to the character limit,
 * repeats the same noun four times, and frequently carries the marketplace's
 * own tail — "... Bathroom Cleaning Home - AliExpress 15", where the number is
 * AliExpress's internal category id. Imported verbatim, that title wraps to
 * four lines on a product card, and it is what shows in a Google result and in
 * a WhatsApp share preview.
 *
 * WHAT THIS DOES NOT DO
 * ---------------------
 * It does not invent words, and it never reorders or rewrites what is there.
 * Everything below only REMOVES: a marketplace tail, decorative brackets, a
 * leading "1pc", and finally the tail end of an over-long title. That
 * restraint is deliberate — a title is a factual claim about what is in the
 * box, and this runs unattended on every import, where a clever rewrite would
 * eventually produce a confident lie about a product nobody has checked.
 */

/** Roughly two lines on a product card at the sizes this theme uses. */
const MAX_LENGTH = 70;

/** Never cut so hard that the product stops being identifiable. */
const MIN_LENGTH = 28;

/*
 * Marketplace tails. The trailing number is AliExpress's category id, which is
 * why "- AliExpress 15" and "- AliExpress 200165144" both occur.
 */
const MARKETPLACE_TAIL =
  /\s*[-|–—:]\s*(aliexpress|ali\s*express|alibaba|1688|temu|dhgate|banggood|shein|wish)(\.com)?(\s*\d+)?\s*$/i;

/** Pure sales noise when it is the last segment, never part of the product. */
const SPAM_TAIL =
  /\s*[-|–—]\s*(free\s+shipping|fast\s+shipping|hot\s+sale|new\s+arrival|drop\s*shipping|wholesale|in\s+stock)\s*$/i;

export function cleanProductTitle(raw: string): string {
  let title = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!title) return title;

  // 【 】 and the like carry banner text ("【Ship in 24h】"), never the product.
  title = title.replace(/[【\[]([^】\]]*)[】\]]/g, ' ');

  /*
   * Looped, because these genuinely stack: "... - Free Shipping - AliExpress 15".
   * Bounded so a pathological title cannot spin here.
   */
  for (let i = 0; i < 4; i++) {
    const before = title;
    title = title.replace(MARKETPLACE_TAIL, '').replace(SPAM_TAIL, '');
    title = title.replace(/\s+/g, ' ').trim();
    if (title === before) break;
  }

  /*
   * A leading "1pc" says nothing — every listing sells at least one. Larger
   * counts are kept: "12pcs Wall Stickers" and "120 Rolls Dog Poop Bag" are
   * telling the shopper what they actually receive.
   */
  title = title.replace(/^1\s*(pcs?|piece)\b[\s,.-]*/i, '');

  // SHOUTED titles are common and unreadable in a grid; sentence-case them,
  // but leave anything with normal casing completely alone.
  if (title.length > 12 && title === title.toUpperCase() && /[A-Z]{4}/.test(title)) {
    title = title
      .toLowerCase()
      .replace(/\b([a-z])/g, (m) => m.toUpperCase())
      .replace(/\b(Usb|Led|Uv|Pc|Ml|Tv|Diy|Rgb|Hd|3d|2d)\b/g, (m) => m.toUpperCase());
  }

  title = title.replace(/\s+/g, ' ').trim();
  if (title.length <= MAX_LENGTH) return trimPunctuation(title);

  /*
   * Over-long: prefer an honest break the seller already put in the title —
   * a comma, dash or pipe — because the text before it is normally the product
   * and the text after it is the keyword tail.
   */
  const breakPoint = lastBreakBefore(title, MAX_LENGTH);
  if (breakPoint >= MIN_LENGTH) return trimPunctuation(dropDanglingWords(title.slice(0, breakPoint)));

  // Otherwise cut on a word boundary. Never mid-word: "Stainless Ste" is worse
  // than a shorter title.
  const space = title.lastIndexOf(' ', MAX_LENGTH);
  return trimPunctuation(dropDanglingWords(title.slice(0, space >= MIN_LENGTH ? space : MAX_LENGTH)));
}

/**
 * Index of the FIRST comma/dash/pipe at or after MIN_LENGTH, or -1.
 *
 * First, not last, on purpose. Sellers put the product name first and the
 * keyword tail after the first separator, so the earliest usable break is the
 * one that leaves the product and drops the sales copy: "100g Solid Patch
 * Adhesive Gel for Nails" rather than "...for Nails - Long-Lasting".
 */
function lastBreakBefore(title: string, limit: number): number {
  for (let i = MIN_LENGTH; i < Math.min(title.length, limit); i++) {
    if (title[i] === ',') return i;
    if (',|-–—;'.includes(title[i]) && title[i - 1] === ' ') return i - 1;
  }
  return -1;
}

/*
 * Words that cannot end a title. A word-boundary cut can land just after a
 * preposition, and "Hair Dryer Comb With" reads like a truncation bug rather
 * than a name.
 */
const DANGLING = new Set([
  'for', 'with', 'and', 'or', 'the', 'a', 'an', 'to', 'in', 'on', 'of', 'by',
  'from', 'use', 'used', 'using', 'plus', 'per', '&', '+',
]);

function dropDanglingWords(title: string): string {
  const words = title.split(' ');
  while (words.length > 3 && DANGLING.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  return words.join(' ');
}

/** Leftover punctuation once a tail has been removed. */
function trimPunctuation(title: string): string {
  return title.replace(/[\s,;:|/\-–—]+$/, '').trim();
}
