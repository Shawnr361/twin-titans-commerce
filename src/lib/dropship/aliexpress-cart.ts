/**
 * Deep links into AliExpress for buying an order by hand.
 *
 * WHY THIS EXISTS ALONGSIDE aliexpress-place.ts
 * ---------------------------------------------
 * That file calls "AE DS Order Create and Pay", which commits and spends money
 * with no confirmation step. It is the right tool once the account is approved
 * for auto-pay; until then it refuses, and a merchant pressing the button gets
 * a refusal rather than a purchase. This is the route that always works: open
 * the exact listings, add them to the cart, and check out on AliExpress with
 * their own session, their own balance and their own confirmation screen.
 *
 * ONE CART, EVERY SELLER
 * ----------------------
 * The API cannot place a single order across two sellers, which is why
 * automatic placement loops one call per seller. The CART has no such limit —
 * it holds items from as many stores as you like and checks out in one pass.
 * So a customer payment that splits across three sellers is one button here,
 * not three.
 *
 * WHAT IS PROVEN AND WHAT IS NOT
 * ------------------------------
 * The cart URL below was checked directly and serves the real cart page. The
 * `sku_id` parameter is best effort: AliExpress does not put the selected
 * variant in the address bar itself, and its own share links drop it, so there
 * is no evidence it is read back on load. It is attached because it costs
 * nothing and helps if honoured — but the merchant is shown the variant label
 * and the SKU beside every link precisely because the parameter cannot be
 * trusted to select it. Buying the wrong colour is the expensive mistake, and
 * nothing here should let a silent URL failure cause one.
 */

/** Verified: this serves the cart page. */
export const ALIEXPRESS_CART_URL = 'https://www.aliexpress.com/p/shoppingcart/index.html';

export interface CartLine {
  title: string;
  /** The listing, with what we know about the variant attached. */
  url: string;
  variant: string;
  sku: string;
  quantity: number;
  imageUrl: string | null;
}

/** Product id out of any AliExpress listing URL. */
function productId(url: string): string | null {
  return url.match(/\/item\/(\d+)/)?.[1] ?? null;
}

/**
 * A clean listing URL for one line.
 *
 * Rebuilt from the product id rather than passed through, because captured
 * source URLs carry campaign junk — `?spm=`, `?algo_pvid=`, affiliate tags —
 * that survives into the tab and occasionally redirects somewhere else
 * entirely. Anything we cannot parse an id from is returned untouched, since a
 * URL that opens is better than one that does not.
 */
export function aliexpressItemUrl(
  sourceUrl: string,
  sku: string | null | undefined,
  quantity: number
): string {
  const id = productId(sourceUrl);
  if (!id) return sourceUrl;

  const url = new URL(`https://www.aliexpress.com/item/${id}.html`);
  // "—" is the placeholder the order sheet uses for a line with no SKU.
  if (sku && sku !== '—') url.searchParams.set('sku_id', sku);
  if (quantity > 1) url.searchParams.set('quantity', String(quantity));
  return url.toString();
}
