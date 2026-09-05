import { prisma } from '@/lib/db';
import { call } from '@/lib/suppliers/aliexpress-api';
import { provinceFor } from '@/lib/dropship/address';
import { freightFor } from '@/lib/suppliers/aliexpress-freight';
import { findOrderNumber, refusalMessage } from '@/lib/dropship/aliexpress-reply';
import { skuAttrMap } from '@/lib/suppliers/aliexpress-fetch';
import { sendDeliveryNotice, sendShippingNotice } from '@/lib/notify';

/**
 * Place supplier orders with AliExpress, and pull tracking back.
 *
 * READ THIS BEFORE CHANGING ANYTHING HERE
 * ---------------------------------------
 * The API is called `aliexpress.ds.order.create` and the console describes it
 * as "AE DS Order Create and Pay". It is not a basket, not a draft, and not a
 * pre-filled checkout page — it commits and it spends money. There is no
 * confirm step on AliExpress's side once this returns successfully.
 *
 * Everything below is therefore built to be *stopped* rather than to be fast:
 * one supplier order at a time, never in a loop over the queue, never from a
 * webhook, and never automatically. A human presses a button per shipment.
 */

interface ShipTo {
  name?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

export interface PlaceResult {
  ok: boolean;
  externalOrderNo?: string;
  detail: string;
}

/**
 * AliExpress wants a two-letter country code; orders carry a country name.
 * A wrong code silently ships to the wrong country, so anything unrecognised
 * fails loudly instead of guessing.
 */
const COUNTRY_CODES: Record<string, string> = {
  nigeria: 'NG',
  'united states': 'US',
  usa: 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  canada: 'CA',
  ghana: 'GH',
  'south africa': 'ZA',
  kenya: 'KE',
  ireland: 'IE',
  germany: 'DE',
  france: 'FR',
};

function countryCode(name: string | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return COUNTRY_CODES[trimmed.toLowerCase()] ?? null;
}

/**
 * International dialling codes for the countries we ship to.
 *
 * Kept beside COUNTRY_CODES deliberately: a country we can ship to but cannot
 * dial is a country whose orders will fail validation at the supplier, so the
 * two lists must be added to together.
 */
const DIAL_CODES: Record<string, string> = {
  NG: '234',
  US: '1',
  GB: '44',
  CA: '1',
  GH: '233',
  ZA: '27',
  KE: '254',
  IE: '353',
  DE: '49',
  FR: '33',
};

/**
 * Split a phone number the way AliExpress wants it.
 *
 * It requires the country code in its own field and 9-12 DIGITS in the number,
 * and rejects the whole order otherwise: "+447936781278" sent as one string
 * returned B_DROPSHIPPER_DELIVERY_ADDRESS_VALIDATE_FAIL and a real customer's
 * order would not place.
 *
 * The leading zero goes too. British and Nigerian customers write their number
 * as 07936781278 out of habit; that zero is a domestic dialling prefix, not
 * part of the number, and leaving it on pushes the length past the limit.
 */
function splitPhone(raw: string | undefined, iso: string): { country: string; national: string } | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return null;

  const dial = DIAL_CODES[iso] ?? '';
  let national = dial && digits.startsWith(dial) ? digits.slice(dial.length) : digits;
  national = national.replace(/^0+/, '');

  if (national.length < 9 || national.length > 12) return null;
  return { country: dial ? `+${dial}` : '', national };
}

/**
 * Place ONE supplier order.
 *
 * Refuses anything already placed: the guard is the stored status plus the
 * supplier's own reference, because a double click here buys the goods twice.
 */
export async function placeWithSupplier(supplierOrderId: string): Promise<PlaceResult> {
  const so = await prisma.supplierOrder.findUnique({
    where: { id: supplierOrderId },
    include: {
      order: { select: { id: true, number: true } },
      items: {
        include: {
          orderLineItem: {
            select: { productTitle: true, variant: { select: { supplierVariantId: true } } },
          },
        },
      },
    },
  });

  if (!so) return { ok: false, detail: 'That supplier order no longer exists.' };


  if (so.status !== 'PENDING') {
    return {
      ok: false,
      detail: `Already ${so.status.toLowerCase()}${so.externalOrderNo ? ` as ${so.externalOrderNo}` : ''} — not placing it again.`,
    };
  }

  const shipTo = so.shipTo as unknown as ShipTo | null;
  const code = countryCode(shipTo?.country);
  if (!shipTo || !code) {
    return {
      ok: false,
      detail: `Cannot place: the delivery country "${shipTo?.country ?? 'missing'}" has no ISO code mapped. Add it to COUNTRY_CODES rather than guessing.`,
    };
  }

  /*
   * A number AliExpress will reject is caught here rather than after the call,
   * so a failure costs nothing and names the field a person has to correct.
   */
  const phone = splitPhone(shipTo.phone, code);
  if (!phone) {
    return {
      ok: false,
      detail:
        `The delivery phone number "${shipTo.phone ?? '(none)'}" is not one AliExpress will accept — ` +
        `it needs 9 to 12 digits after the country code. Correct it on the order and try again.`,
    };
  }

  /*
   * Every line must carry the supplier's own SKU id. Without it AliExpress
   * would pick a default variant, and the customer would receive the wrong
   * colour or size — the single most expensive mistake in dropshipping.
   */
  const missing = so.items.filter(
    (i) => !(i.externalVariantId || i.orderLineItem.variant?.supplierVariantId)
  );
  if (missing.length > 0) {
    return {
      ok: false,
      detail:
        `${missing.length} item(s) have no supplier SKU recorded, so the variant cannot be ` +
        `guaranteed. Place this one by hand, and re-capture the product so future orders carry it.`,
    };
  }

  /*
   * sku_id and sku_attr are DIFFERENT things and both are required.
   *
   * We store the numeric sku_id. AliExpress wants the attribute string in
   * sku_attr — "14:365458#Red;200000828:201589807" — and sending the id there
   * is what returned SKU_NOT_EXIST on every attempt: it looked for an attribute
   * string, found a number, and refused. The map is read live so a listing
   * edited since import cannot leave us ordering an attribute that is gone.
   */
  const attrByProduct = new Map<string, Map<string, string>>();
  const missingAttr: string[] = [];

  const productItems = [];
  for (const i of so.items) {
    const productId = extractProductId(i.sourceUrl);
    const skuId = String(i.externalVariantId ?? i.orderLineItem.variant?.supplierVariantId ?? '');

    if (!attrByProduct.has(productId)) {
      try {
        attrByProduct.set(productId, await skuAttrMap(productId));
      } catch {
        attrByProduct.set(productId, new Map());
      }
    }
    const skuAttr = attrByProduct.get(productId)?.get(skuId);
    if (!skuAttr) {
      missingAttr.push(`${i.orderLineItem.productTitle.slice(0, 40)} (sku ${skuId || 'none'})`);
      continue;
    }

    /*
     * The shipping service is ASKED FOR, not assumed.
     *
     * This was hardcoded to CAINIAO_FULFILLMENT_STD for every product and
     * every destination. The freight API returns the services actually offered
     * on a listing, and for the KIKO lip gloss into GB that is
     * CAINIAO_FULFILLMENT_PRE — a code we were never sending. A service the
     * seller does not offer on that route is a plausible way for an order to
     * be refused or to ship on something we did not price for.
     *
     * The old constant remains the fallback, so a freight lookup that fails
     * leaves placement exactly as it behaved before rather than blocking it.
     */
    const quote = await freightFor(productId, skuId, code);
    productItems.push({
      product_count: i.quantity,
      product_id: productId,
      sku_attr: skuAttr,
      sku_id: skuId,
      logistics_service_name: quote?.serviceCode ?? 'CAINIAO_FULFILLMENT_STD',
      order_memo: `Store order #${so.order.number}. Please ship with no invoice or price tag.`,
    });
  }

  /*
   * Refuse rather than place a partial order. A supplier order that arrives
   * with two of a customer's three items looks fulfilled in every report we
   * have, and the missing one is discovered by the customer.
   */
  if (missingAttr.length > 0 || productItems.length === 0) {
    return {
      ok: false,
      detail:
        `AliExpress has no current SKU matching ${missingAttr.length || 'any'} item(s): ` +
        `${missingAttr.join('; ')}. The listing has probably changed its options since import — ` +
        `re-import the product, or place this one by hand.`,
    };
  }

  const payload = {
    param_place_order_request4_open_api_d_t_o: JSON.stringify({
      product_items: productItems,
      logistics_address: {
        contact_person: shipTo.name ?? '',
        phone_country: phone.country,
        mobile_no: phone.national,
        address: shipTo.line1 ?? '',
        address2: shipTo.line2 ?? '',
        city: shipTo.city ?? '',
        province: provinceFor(code, shipTo.state, shipTo.city),
        zip: shipTo.postcode ?? '',
        country: code,
        full_name: shipTo.name ?? '',
      },
    }),
  };

  const res = await call('aliexpress.ds.order.create', payload);
  const text = JSON.stringify(res.body);

  // The response shape nests under a method-named key; find the order number.
  const number = findOrderNumber(res.body);

  if (!number) {
    /*
     * Record the refusal, do not just return it.
     *
     * A failure used to leave no trace anywhere: the reason appeared in the
     * button's panel and vanished the moment the page was navigated away
     * from, so the only way to learn why an order would not place was to be
     * watching at the time and copy the text by hand. The address rejection on
     * order #20 was diagnosed exactly that way, which is not a process.
     *
     * Written before returning so the timeline holds it even if nobody is
     * looking, and non-fatal — a failed audit write must not swallow the
     * reason the caller is about to be shown.
     */
    await prisma.orderEvent
      .create({
        data: {
          orderId: so.order.id,
          kind: 'supplier_place_failed',
          message: `AliExpress refused this order: ${text.slice(0, 500)}`,
          data: { supplierOrderId },
        },
      })
      .catch(() => undefined);

    const refusal = refusalMessage(res.body);

    return {
      ok: false,
      /*
       * The warning matters more than the wording.
       *
       * "No order number" does NOT prove no order was created — that
       * assumption is exactly what produced four unpaid orders for two items
       * on order #20. Whoever reads this must check the account before
       * pressing anything again.
       *
       * The raw reply is kept after the plain-English part: a refusal is
       * usually a missing balance, an address field they will not accept, or a
       * SKU they no longer sell, and only their own wording separates those.
       */
      detail:
        (refusal
          ? `AliExpress refused this order: ${refusal}. `
          : 'AliExpress returned no order number and no reason. ') +
        'CHECK "My Orders" ON ALIEXPRESS BEFORE TRYING AGAIN — an order can be created even when ' +
        'the reply cannot be read, and pressing again would buy it twice. ' +
        `Raw reply: ${text.slice(0, 600)}`,
    };
  }

  await prisma.$transaction([
    prisma.supplierOrder.update({
      where: { id: supplierOrderId },
      data: { status: 'PLACED', externalOrderNo: String(number), placedAt: new Date() },
    }),
    prisma.orderEvent.create({
      data: {
        orderId: so.order.id,
        kind: 'supplier_placed',
        message: `Placed with AliExpress as ${number} via the API — pay it on AliExpress.`,
        data: { supplierOrderId, externalOrderNo: String(number) },
      },
    }),
  ]);

  /*
   * CREATED IS NOT PAID.
   *
   * The method is described as "Order Create and Pay", but on an account
   * without auto-pay approval it only creates: order #20's legs landed in
   * AliExpress's "To pay" list with a countdown against them, and AliExpress
   * cancels an unpaid order when that runs out. Saying "Placed" alone would
   * leave a merchant believing a customer's goods were bought when they were
   * about to expire, so the amount owed is named here and on the timeline.
   */
  return {
    ok: true,
    externalOrderNo: String(number),
    detail:
      `Created on AliExpress as ${number}. It is NOT paid yet — open My Orders on AliExpress ` +
      `and press Pay now, or it will be cancelled when their countdown expires.`,
  };
}

/** AliExpress product id out of a listing URL. */
function extractProductId(url: string): string {
  return url.match(/\/item\/(\d+)/)?.[1] ?? '';
}


export interface TrackingSyncResult {
  checked: number;
  updated: number;
  notified: number;
  delivered: number;
  problems: string[];
}

/**
 * Pull tracking for everything already placed, and email the customer the
 * first time a number appears.
 *
 * Safe to run on a schedule and safe to run twice: it only writes when the
 * number actually changes, and sendShippingNotice refuses to send twice for
 * the same tracking number.
 */
export async function syncTracking(limit = 20): Promise<TrackingSyncResult> {
  const placed = await prisma.supplierOrder.findMany({
    where: { status: { in: ['PLACED', 'SHIPPED'] }, externalOrderNo: { not: null } },
    select: { id: true, externalOrderNo: true, trackingNumber: true, status: true },
    take: limit,
    orderBy: { placedAt: 'asc' },
  });

  const out: TrackingSyncResult = { checked: 0, updated: 0, notified: 0, delivered: 0, problems: [] };

  for (const so of placed) {
    out.checked++;
    try {
      const res = await call('aliexpress.ds.order.tracking.get', {
        ae_order_id: String(so.externalOrderNo),
      });

      const info = findTracking(res.body);

      /*
       * Delivery is checked BEFORE the tracking-number guard. A parcel whose
       * number has not changed is exactly the one most likely to have arrived
       * since the last run, and returning early on it is why nothing ever
       * reached DELIVERED.
       */
      if (so.status === 'SHIPPED' && looksDelivered(res.body)) {
        await prisma.supplierOrder.update({
          where: { id: so.id },
          data: { status: 'DELIVERED', deliveredAt: new Date() },
        });
        await sendDeliveryNotice(so.id);
        out.delivered++;
        continue;
      }

      if (!info.number || info.number === so.trackingNumber) continue;

      await prisma.supplierOrder.update({
        where: { id: so.id },
        data: {
          trackingNumber: info.number,
          trackingCarrier: info.carrier ?? undefined,
          trackingUrl: info.url ?? undefined,
          status: 'SHIPPED',
        },
      });
      out.updated++;

      await sendShippingNotice(so.id);
      out.notified++;
    } catch (err) {
      out.problems.push(
        `${so.externalOrderNo}: ${err instanceof Error ? err.message : 'failed'}`
      );
    }
  }

  return out;
}

/**
 * Has the carrier said it arrived?
 *
 * Read by shape, because the field naming varies by carrier and by route:
 * any status-looking key whose value says delivered, signed or received. A
 * false positive here emails a customer that a parcel they are still waiting
 * for has arrived, so the words are deliberately narrow — "in transit" and
 * "out for delivery" must not match, which is why "deliver" alone is not
 * enough and the test looks for delivered/signed/received.
 */
function looksDelivered(body: unknown): boolean {
  let hit = false;
  const walk = (v: unknown) => {
    if (hit || !v || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    for (const [key, value] of Object.entries(v as Record<string, unknown>)) {
      if (hit) return;
      if (typeof value === 'string' && /status|state|event|desc/i.test(key)) {
        if (/(delivered|signed|received by)/i.test(value)) {
          hit = true;
          return;
        }
      }
      walk(value);
    }
  };
  walk(body);
  return hit;
}

function findTracking(body: unknown): {
  number: string | null;
  carrier: string | null;
  url: string | null;
} {
  let number: string | null = null;
  let carrier: string | null = null;
  let url: string | null = null;

  const walk = (v: unknown) => {
    if (!v || typeof v !== 'object') return;
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === 'string') {
        if (!number && /mail_?no|tracking_?number|logistics_?no/i.test(k)) number = val;
        else if (!carrier && /service_?name|carrier|logistics_?company/i.test(k)) carrier = val;
        else if (!url && /url/i.test(k) && val.startsWith('http')) url = val;
      }
      walk(val);
    }
  };
  walk(body);

  return { number, carrier, url };
}


/**
 * Place EVERY outstanding supplier order for one customer payment.
 *
 * A customer who buys three things pays once, and the merchant should press one
 * button — not one per line, which is how the second and third get forgotten.
 *
 * WHY IT IS SEVERAL CALLS AND NOT ONE
 * -----------------------------------
 * AliExpress cannot place a single order across two different sellers. Order
 * #18 is exactly that case: the foot socks come from one store, the grooming
 * gloves and clipper from another. So the queue's grouping is right and the
 * platform's limit is real — what was wrong was making a person click once per
 * group. This loops, one call per seller, and reports the result of each.
 *
 * It keeps going after a failure rather than stopping. If the socks place and
 * the clipper does not, the customer is owed one parcel rather than three, and
 * abandoning the successful one to keep the summary tidy helps nobody.
 */
export async function placeWholeOrder(orderId: string): Promise<{
  ok: boolean;
  placed: number;
  failed: number;
  detail: string;
}> {
  const pending = await prisma.supplierOrder.findMany({
    where: { orderId, status: 'PENDING' },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (pending.length === 0) {
    return { ok: false, placed: 0, failed: 0, detail: 'Nothing on this order is waiting to be placed.' };
  }

  const done: string[] = [];
  const problems: string[] = [];

  for (const row of pending) {
    const result = await placeWithSupplier(row.id);
    if (result.ok) done.push(result.externalOrderNo ?? 'placed');
    else problems.push(result.detail);
  }

  return {
    ok: problems.length === 0,
    placed: done.length,
    failed: problems.length,
    detail:
      problems.length === 0
        ? `Placed ${done.length} supplier order(s): ${done.join(', ')}.`
        : `Placed ${done.length}, failed ${problems.length}. ${problems.join(' | ')}`,
  };
}
