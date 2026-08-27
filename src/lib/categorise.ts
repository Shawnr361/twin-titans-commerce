/**
 * Work out which collection a product belongs in, from its own words.
 *
 * Assigning by hand does not survive contact with volume — it was skipped on
 * every import so far, which is why the homepage's department tiles all read
 * zero. This runs at import time and needs nothing from the merchant.
 *
 * Deliberately keyword rules rather than a model call: it has to run inside the
 * import request on shared hosting, be inspectable when it puts something in an
 * odd place, and give the same answer twice for the same product.
 *
 * The important property is that it declines. A product matching nothing is
 * left uncategorised rather than pushed into whichever collection scored least
 * badly — a hair clipper filed under Pet Supplies is worse than one filed
 * nowhere, because nobody goes looking for the mistake.
 */

export interface CategoryRule {
  /** Collection handle to file under. */
  handle: string;
  /** Shown on the storefront, and used when the collection has to be created. */
  title: string;
  /** Any of these in the title is a match. */
  keywords: string[];
  /** These veto the rule outright, whatever else matched. */
  exclude?: string[];
}

/*
 * Order matters: the first rule to match wins, so the specific ones come first.
 * "Pet hair clipper" must reach Pet Supplies before Beauty claims it for
 * "clipper", which is exactly the collision that makes a naive keyword list
 * embarrassing.
 */
export const CATEGORY_RULES: CategoryRule[] = [
  {
    handle: 'pet-supplies',
    title: 'Pet Supplies',
    keywords: [
      'pet', 'dog', 'cat', 'puppy', 'kitten', 'paw', 'leash', 'collar',
      'aquarium', 'litter', 'chew toy', 'grooming brush', 'bird', 'hamster',
    ],
  },
  {
    handle: 'beauty-skincare',
    title: 'Beauty & Skincare',
    keywords: [
      'hair clipper', 'hair trimmer', 'trimmer', 'shaver', 'razor', 'skincare',
      'serum', 'moisturiser', 'moisturizer', 'cream', 'facial', 'face', 'lash',
      'nail', 'lipstick', 'makeup', 'cosmetic', 'wig', 'hair dryer', 'straightener',
      'curler', 'massager', 'toothbrush', 'epilator',
      // Fragrance. A live 100ml perfume matched none of the above and sat in
      // no collection at all, which is how this gap was found.
      'perfume', 'parfum', 'fragrance', 'cologne', 'eau de toilette',
      'eau de parfum', 'body mist', 'deodorant', 'body spray',
    ],
    // A pet clipper is a pet product, whatever the blade does.
    exclude: ['pet', 'dog', 'cat'],
  },
  {
    /*
     * Before gadgets-lighting on purpose: almost every gaming accessory is
     * also "wireless", "usb" or "led", so gadgets would claim the lot.
     */
    handle: 'gaming',
    title: 'Gaming',
    keywords: [
      'gaming', 'gamepad', 'game controller', 'joystick', 'joypad', 'console',
      'playstation', 'ps4', 'ps5', 'xbox', 'nintendo', 'switch controller',
      'gaming mouse', 'gaming keyboard', 'gaming headset', 'gaming chair',
      'mousepad', 'mouse pad', 'rgb keyboard', 'mechanical keyboard',
      'vr headset', 'steering wheel', 'arcade',
    ],
    // "Nintendo switch" is gaming; a light switch is not.
    exclude: ['light switch', 'wall switch'],
  },
  {
    handle: 'gadgets-lighting',
    title: 'Gadgets & Lighting',
    keywords: [
      'led', 'lamp', 'light', 'bulb', 'torch', 'projector', 'charger', 'cable',
      'power bank', 'earbud', 'headphone', 'speaker', 'bluetooth', 'usb',
      'smart watch', 'smartwatch', 'camera', 'fan', 'gadget', 'electric',
      'rechargeable', 'wireless',
    ],
  },
  {
    handle: 'home-living',
    title: 'Home & Living',
    keywords: [
      'kitchen', 'slicer', 'chopper', 'grater', 'cutter', 'peeler', 'storage',
      'organiser', 'organizer', 'cushion', 'curtain', 'bedding', 'towel',
      'cookware', 'pan', 'pot', 'utensil', 'bottle', 'mug', 'cup', 'shredder',
      'home', 'decor', 'mosquito', 'cleaning', 'mop', 'broom', 'hanger',
    ],
  },
];

/**
 * The collection this product belongs in, or null when nothing fits.
 *
 * Matches on word boundaries so "cat" does not fire on "communicate" and "led"
 * does not fire on "cordless" — substring matching on short words is the usual
 * way these rule sets quietly go wrong.
 */
export function categorise(
  title: string,
  productType?: string | null,
  rules: CategoryRule[] = CATEGORY_RULES
): string | null {
  const hay = `${title} ${productType ?? ''}`.toLowerCase();
  const has = (term: string) => {
    const t = term.toLowerCase();
    // Multi-word terms are matched plainly; single words need boundaries.
    if (t.includes(' ')) return hay.includes(t);
    const i = hay.indexOf(t);
    if (i < 0) return false;
    const before = i === 0 ? ' ' : hay[i - 1];
    const after = i + t.length >= hay.length ? ' ' : hay[i + t.length];
    return !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
  };

  for (const rule of rules) {
    if (rule.exclude?.some(has)) continue;
    if (rule.keywords.some(has)) return rule.handle;
  }
  return null;
}
