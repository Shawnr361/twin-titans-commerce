/**
 * Product tags the store itself acts on.
 *
 * Kept in Product.tags (JSON) rather than as columns, because schema migrations
 * cannot be run on this host — see the note in src/lib/db.ts. The categoriser's
 * pin already lives in tags for the same reason.
 *
 * No imports on purpose: client components read these too, and pulling the
 * Prisma client into a browser bundle is how that goes wrong.
 */

/** Chosen by hand in admin to lead the homepage hero. */
export const FEATURED_TAG = 'featured';

export function tagList(tags: unknown): string[] {
  return Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : [];
}

export function hasTag(tags: unknown, tag: string): boolean {
  return tagList(tags).includes(tag);
}
