/**
 * Shaping a customer's address into what AliExpress will accept.
 *
 * Pure, and kept apart from aliexpress-place.ts on purpose: that module pulls
 * in Prisma and the signed API client, and this needs to be checkable by
 * scripts/verify-logic.ts, which runs with no database.
 */

/**
 * Countries whose province AliExpress will not accept as written.
 *
 * THE BUG THIS FIXES
 * ------------------
 * Order #20 was refused twice with
 * B_DROPSHIPPER_DELIVERY_ADDRESS_VALIDATE_FAIL — "Please select a
 * State/Province/County" — while carrying a province of "s yorkshire". The
 * field was not empty. It was not one of THEIR values.
 *
 * AliExpress validates province against its own dropdown for the destination
 * country, and its United Kingdom list does not contain the counties at all.
 * So there is nothing to normalise "s yorkshire" into: "South Yorkshire" is
 * rejected in exactly the same way. The list's own escape hatch is a literal
 * entry called "Other", which is what a UK order placed through the AliExpress
 * interface actually selects.
 *
 * WHY THIS IS A LIST AND NOT A DEFAULT
 * ------------------------------------
 * "Other" must never reach a country whose provinces AliExpress DOES enforce.
 * A United States order with province "Other" either fails outright or ships
 * somewhere unintended — a state is load-bearing there in a way a British
 * county is not. Only the countries known to accept it are listed here; every
 * other destination passes the customer's own value through untouched.
 *
 * Add to this list only on evidence — a real refusal naming the country, not a
 * guess that its provinces look similar to Britain's.
 */
export const PROVINCE_IS_OTHER = new Set(['GB', 'IE']);

/**
 * The province to send for one destination.
 *
 * Falls back to the city rather than to an empty string, because an empty
 * province is precisely what the error above complains about, and for most
 * countries the city is a likelier match in their address tree than nothing.
 */
export function provinceFor(
  iso: string,
  state: string | undefined | null,
  city: string | undefined | null
): string {
  if (PROVINCE_IS_OTHER.has(iso)) return 'Other';
  return (state ?? '').trim() || (city ?? '').trim();
}
