/**
 * Reading what AliExpress says back when an order is created.
 *
 * Pure, and separate from aliexpress-place.ts so scripts/verify-logic.ts can
 * check it without a database. These two functions decide whether a customer
 * order is treated as bought or as refused, so they are worth testing directly:
 * getting the first one wrong bought order #20 twice.
 */
/**
 * An AliExpress order number: 16 digits in practice, bounded loosely.
 *
 * Used as the last-resort search, because the shape around it has already
 * proved untrustworthy once and a real number is highly distinctive.
 */
export const ORDER_NUMBER = /^\d{15,19}$/;

/**
 * Find the order number in a create reply.
 *
 * THE BUG THIS FIXES — IT COST REAL MONEY
 * ---------------------------------------
 * A successful create returns the number nested two levels down:
 *
 *   { "...response": { "result": { "order_list": { "number": [30760566...] },
 *                                  "is_success": true } } }
 *
 * The previous version matched the key `order_list`, found an OBJECT rather
 * than a string or an array, fell through to recursion, and then never matched
 * the inner key `number` because it was not in the pattern. So it returned
 * null for an order that AliExpress had genuinely created, the caller reported
 * a failure, and order #20 was placed a SECOND time — four unpaid orders on
 * the account for two items, $50.64 where $25.32 was owed.
 *
 * So this now: matches `number` as well; accepts an array at any matching key;
 * and if the shape changes again, falls back to any order-number-shaped value
 * anywhere in the reply. Reporting a false failure here is far more expensive
 * than reporting a false success — a false failure invites a human to buy the
 * goods twice, while a false success is caught by the next tracking sync.
 */
export function findOrderNumber(body: unknown): string | number | null {
  const primitive = (v: unknown): string | number | null => {
    if (typeof v === 'string' || typeof v === 'number') return v;
    if (Array.isArray(v)) {
      for (const entry of v) {
        const hit = primitive(entry);
        if (hit !== null) return hit;
      }
    }
    return null;
  };

  let found: string | number | null = null;

  const byKey = (v: unknown) => {
    if (found !== null || !v || typeof v !== 'object') return;
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (found !== null) return;
      if (/order_?list|order_?id|order_?no|orderNumber|^number$/i.test(k)) {
        const hit = primitive(val);
        if (hit !== null) {
          found = hit;
          return;
        }
      }
      byKey(val);
    }
  };
  byKey(body);
  if (found !== null) return found;

  // Shape changed — look for anything that is unmistakably an order number.
  const anyNumber = (v: unknown): string | number | null => {
    if (typeof v === 'string' || typeof v === 'number') {
      return ORDER_NUMBER.test(String(v)) ? v : null;
    }
    if (!v || typeof v !== 'object') return null;
    for (const val of Object.values(v as Record<string, unknown>)) {
      const hit = anyNumber(val);
      if (hit !== null) return hit;
    }
    return null;
  };
  return anyNumber(body);
}

/** AliExpress's own refusal wording, when it gave one. */
export function refusalMessage(body: unknown): string | null {
  let message: string | null = null;
  const walk = (v: unknown) => {
    if (message || !v || typeof v !== 'object') return;
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (message) return;
      if (/error_?msg|error_?message|error_?code/i.test(k) && typeof val === 'string' && val) {
        message = val;
        return;
      }
      walk(val);
    }
  };
  walk(body);
  return message;
}
