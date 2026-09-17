/**
 * The store-wide delivery promise, in one place.
 *
 * These numbers were written out separately in the shipping policy, the product
 * page's structured data and (now) the homepage. Three copies of a promise is
 * how one gets changed and the other two quietly stop being true — and a
 * delivery estimate is the claim a dropshipping customer holds us to most.
 *
 * Suppliers can carry their own window (Supplier.shipDaysMin/Max), which the
 * product page prefers; these are the defaults and the whole-store summary.
 */
export const DISPATCH_DAYS = { min: 1, max: 3 } as const;
export const DELIVERY_DAYS = { min: 7, max: 21 } as const;

export const dispatchWindow = `${DISPATCH_DAYS.min}–${DISPATCH_DAYS.max} business days`;
export const deliveryWindow = `${DELIVERY_DAYS.min}–${DELIVERY_DAYS.max} days`;
