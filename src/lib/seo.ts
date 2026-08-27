/**
 * Helpers for the text search engines and social cards actually read.
 *
 * The product pages were shipping the TITLE as the description, in three
 * places at once: <meta name="description">, og:description and the JSON-LD.
 * A description identical to the title tells a search engine nothing it does
 * not already know, and gives it no reason to show the page for anything but
 * the exact product name — so Google rewrites it from page content, badly.
 * A share card with the title printed twice looks broken to a human, too.
 */

/** Characters Google will actually render before truncating. */
const MAX_DESCRIPTION = 155;

/**
 * Plain text from stored HTML.
 *
 * Supplier descriptions arrive as HTML with entities and markup; both have to
 * go before the text can sit inside a meta attribute.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cut to length without slicing a word, preferring a sentence boundary. */
function truncate(text: string, max = MAX_DESCRIPTION): string {
  if (text.length <= max) return text;

  const window = text.slice(0, max + 1);

  // A full sentence reads far better than a clause ending in an ellipsis.
  const sentence = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '));
  if (sentence > max * 0.55) return window.slice(0, sentence + 1);

  const space = window.lastIndexOf(' ');
  return `${window.slice(0, space > 0 ? space : max).replace(/[,;:\-–—]$/, '')}…`;
}

/**
 * The description for a product page.
 *
 * Prefers an explicitly written one, then the real product copy, and only
 * falls back to something composed when a product has no description at all —
 * at which point naming the store and the delivery promise is still more
 * useful to a searcher than repeating the title.
 */
export function productDescription(product: {
  title: string;
  seoDescription?: string | null;
  descriptionHtml?: string | null;
}, storeName: string): string {
  const explicit = product.seoDescription?.trim();
  if (explicit) return truncate(explicit);

  const body = htmlToText(product.descriptionHtml ?? '');
  /*
   * Very short extracted copy is usually a stray heading or a spec fragment,
   * which makes a worse description than the composed line below.
   */
  if (body.length >= 60) return truncate(body);

  return truncate(`${product.title}. Sourced, checked and delivered across Nigeria by ${storeName}.`);
}

/**
 * The canonical origin, with no trailing slash.
 *
 * NEXT_PUBLIC_* is inlined at BUILD time, so this is only ever correct when
 * .env.production carried the real domain during the build — which is exactly
 * the mistake that once shipped canonical=http://localhost:3400 to production.
 */
export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://twintitanemporium.com').replace(/\/$/, '');
}
