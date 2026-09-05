import { prisma } from '@/lib/db';
import { captureFromApi } from '@/lib/suppliers/aliexpress-fetch';
import { decideVariant } from '@/lib/suppliers/skuAudit';

/**
 * Keep checking, for ever, whether the options on sale can still be bought.
 *
 * WHY A STANDING JOB AND NOT A ONE-OFF REPAIR
 * -------------------------------------------
 * A supplier can retire a colour or a size any day, and nothing tells us. When
 * that happens a variant stays on the shelf, a customer picks it, pays, and
 * the order cannot be placed — AliExpress answers SKU_NOT_EXIST. That is order
 * #20's failure, and a single repair pass only fixes the ones that were
 * already broken on the day it ran. 33 unorderable variants were found the
 * first time we looked; the number is not static, so neither can the check be.
 *
 * This walks the catalogue a few products per run, for ever, wrapping round to
 * the beginning when it reaches the end. Every product gets re-checked on a
 * cycle, and a product imported tomorrow joins the rotation without anyone
 * remembering to add it.
 *
 * IT RESTORES AS WELL AS BLOCKS
 * -----------------------------
 * A supplier who removes a colour often puts it back. A check that could only
 * take things off sale would quietly shrink the catalogue over months, one
 * temporary outage at a time. So a variant that becomes buyable again is
 * un-blocked.
 *
 * ONLY WHAT THIS JOB BLOCKED IS EVER UNBLOCKED
 * --------------------------------------------
 * The ids it has blocked are remembered, and nothing else is touched. A
 * variant the merchant deliberately set to zero — genuinely out of stock, or
 * withdrawn on purpose — must not be put back on sale by a background job that
 * cannot know why it was zero.
 *
 * WHY A CURSOR IN Setting AND NOT A COLUMN
 * ----------------------------------------
 * Setting is a key/value JSON table, so progress needs no migration — and the
 * deploy does not run migrations, which means a schema change here would ship
 * broken. The cursor is a product id; ordering by id makes "carry on from
 * where you stopped" exact even as products are added and removed.
 */
const CURSOR_KEY = 'skuAudit.cursor';
const BLOCKED_KEY = 'skuAudit.blocked';

/** Products per run. Each costs one supplier lookup; the host times out around a handful. */
const BATCH = 3;

/** Ids we have blocked. Bounded so a runaway cannot grow the row without limit. */
const MAX_REMEMBERED = 2000;

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } }).catch(() => null);
  return row ? ((row.value as unknown) as T) : fallback;
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: value as never },
    update: { value: value as never },
  });
}

export interface SkuAuditResult {
  checkedProducts: number;
  wrappedToStart: boolean;
  rematched: string[];
  blocked: string[];
  restored: string[];
  stillBlockedTotal: number;
  nextCursor: string;
  problems: string[];
}

/**
 * One batch of the standing SKU check.
 *
 * Lifted out of the route so the tracking cron can run it too. Scheduling a
 * fourth cron on the host would have meant writing a shell script containing
 * the cron secret, and the tracking job already runs every thirty minutes with
 * its own authentication — so this rides along instead. Same work, no new
 * credential anywhere.
 */
export async function runSkuAuditBatch(): Promise<SkuAuditResult> {
  const cursor = await readSetting<string>(CURSOR_KEY, '');
  const blockedList = await readSetting<string[]>(BLOCKED_KEY, []);
  const blocked = new Set(blockedList);

  let products = await prisma.product.findMany({
    where: { source: { platform: 'ALIEXPRESS' } },
    select: {
      id: true,
      title: true,
      source: { select: { externalId: true } },
      variants: {
        select: {
          id: true,
          title: true,
          supplierVariantId: true,
          optionValues: true,
          inventory: true,
        },
      },
    },
    orderBy: { id: 'asc' },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: BATCH,
  });

  /* End of the catalogue — wrap round and start again next run. */
  let wrapped = false;
  if (products.length === 0 && cursor) {
    wrapped = true;
    products = await prisma.product.findMany({
      where: { source: { platform: 'ALIEXPRESS' } },
      select: {
        id: true,
        title: true,
        source: { select: { externalId: true } },
        variants: {
          select: {
            id: true,
            title: true,
            supplierVariantId: true,
            optionValues: true,
            inventory: true,
          },
        },
      },
      orderBy: { id: 'asc' },
      take: BATCH,
    });
  }

  const rematched: string[] = [];
  const nowBlocked: string[] = [];
  const restored: string[] = [];
  const problems: string[] = [];
  let checked = 0;

  for (const product of products) {
    const externalId = product.source?.externalId;
    if (!externalId) continue;

    let supplier;
    try {
      supplier = await captureFromApi(
        externalId,
        `https://www.aliexpress.com/item/${externalId}.html`
      );
    } catch {
      problems.push(`${product.title.slice(0, 36)} — lookup failed`);
      continue;
    }
    /*
     * A listing that answers with no SKUs at all is almost always a transient
     * refusal, not a product with nothing for sale. Blocking every variant on
     * the strength of it would empty a healthy product.
     */
    if (!supplier.capture || supplier.capture.variants.length === 0) {
      problems.push(`${product.title.slice(0, 36)} — no SKUs returned, skipped`);
      continue;
    }
    checked++;

    for (const variant of product.variants) {
      const verdict = decideVariant(variant, supplier.capture.variants);

      if (verdict.kind === 'unorderable') {
        if (variant.inventory !== 0) {
          await prisma.variant.update({ where: { id: variant.id }, data: { inventory: 0 } });
          blocked.add(variant.id);
          nowBlocked.push(`${product.title.slice(0, 28)} / ${variant.title.slice(0, 18)}`);
        }
        continue;
      }

      if (verdict.kind === 'rematched' && verdict.skuId !== variant.supplierVariantId) {
        await prisma.variant.update({
          where: { id: variant.id },
          data: { supplierVariantId: verdict.skuId },
        });
        /* A pending order holds its own copy, and stays stuck without this. */
        await prisma.supplierOrderItem.updateMany({
          where: {
            orderLineItem: { variantId: variant.id },
            supplierOrder: { status: 'PENDING' },
            NOT: { externalVariantId: verdict.skuId },
          },
          data: { externalVariantId: verdict.skuId },
        });
        rematched.push(`${product.title.slice(0, 28)} / ${variant.title.slice(0, 18)}`);
      }

      /* Buyable again, and it was this job that took it off sale. */
      if (variant.inventory === 0 && blocked.has(variant.id)) {
        await prisma.variant.update({ where: { id: variant.id }, data: { inventory: null } });
        blocked.delete(variant.id);
        restored.push(`${product.title.slice(0, 28)} / ${variant.title.slice(0, 18)}`);
      }
    }
  }

  const last = products.length > 0 ? products[products.length - 1].id : '';
  await writeSetting(CURSOR_KEY, last);
  await writeSetting(BLOCKED_KEY, [...blocked].slice(-MAX_REMEMBERED));

  return {
    checkedProducts: checked,
    wrappedToStart: wrapped,
    rematched,
    blocked: nowBlocked,
    restored,
    stillBlockedTotal: blocked.size,
    nextCursor: last || '(start)',
    problems,
  };
}
