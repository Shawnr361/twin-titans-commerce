import { prisma } from '@/lib/db';
import { completeText } from '@/lib/copywriter';
import {
  SHOP_TITLE_SYSTEM,
  isFaithfulTitle,
  shopTitlePrompt,
  tidyTitleAnswer,
} from './shopTitle';

/**
 * Applying shop titles — automatically, once per product, for ever.
 *
 * WHERE IT RUNS
 * -------------
 * 1. On publish (PATCH /api/admin/products → ACTIVE), before the description is
 *    written, so a product goes live with a proper name.
 * 2. On the half-hourly tracking cron, a few products a run, for anything live that
 *    has not been through it — products published another way, and retries
 *    after a provider outage. This is what makes it persistent: nobody has to
 *    remember to run anything after a batch of captures.
 * 3. POST /api/admin/products/shop-titles, to preview and apply by hand.
 *
 * ONCE PER PRODUCT
 * ----------------
 * The outcome is recorded in SupplierProduct.raw.shopTitle (a JSON column,
 * because migrations cannot run on this host). A product with a record is never
 * touched again — so a title the merchant later edits by hand is final, and the
 * cron cannot keep spending on the same rows. A failure is retried up to
 * MAX_ATTEMPTS times and then left alone with its old title.
 *
 * The supplier's original title is kept in raw.supplierTitle: it is the
 * evidence the guard checks against, and what the description writer is given,
 * because a short shop title says too little to write honest copy from.
 */

const MAX_ATTEMPTS = 3;

export interface ShopTitleRecord {
  status: 'renamed' | 'kept' | 'failed';
  from?: string;
  to?: string;
  reason?: string;
  attempts?: number;
  at: string;
}

type Raw = Record<string, unknown> & { supplierTitle?: string; shopTitle?: ShopTitleRecord };

function asRaw(raw: unknown): Raw {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Raw) : {};
}

export function needsShopTitle(raw: unknown): boolean {
  const record = asRaw(raw).shopTitle;
  if (!record) return true;
  return record.status === 'failed' && (record.attempts ?? 0) < MAX_ATTEMPTS;
}

/** The supplier's own words: stored evidence, else the capture, else the current title. */
async function supplierTitleFor(productId: string, raw: Raw, currentTitle: string): Promise<string> {
  if (typeof raw.supplierTitle === 'string' && raw.supplierTitle.trim()) return raw.supplierTitle;
  const capture = await prisma.supplierCapture
    .findFirst({
      where: { importedProductId: productId },
      orderBy: { createdAt: 'desc' },
      select: { title: true },
    })
    .catch(() => null);
  return capture?.title?.trim() || currentTitle;
}

export interface ShopTitleProposal {
  productId: string;
  from: string;
  to: string | null;
  supplierTitle: string;
  reason?: string;
}

/** Ask for a name and check it. Writes nothing. */
export async function proposeShopTitle(productId: string): Promise<ShopTitleProposal | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, title: true, source: { select: { raw: true } } },
  });
  if (!product?.source) return null;

  const raw = asRaw(product.source.raw);
  const supplierTitle = await supplierTitleFor(product.id, raw, product.title);

  const answer = await completeText(SHOP_TITLE_SYSTEM, shopTitlePrompt(supplierTitle), {
    maxTokens: 1000,
    temperature: 0.2,
  });
  if (!answer.text) {
    return { productId, from: product.title, to: null, supplierTitle, reason: answer.error ?? 'no answer' };
  }

  const name = tidyTitleAnswer(answer.text);
  const verdict = isFaithfulTitle(name, supplierTitle);
  if (!verdict.ok) {
    return { productId, from: product.title, to: null, supplierTitle, reason: `rejected "${name}": ${verdict.reason}` };
  }
  return { productId, from: product.title, to: name, supplierTitle };
}

/**
 * Write an approved name.
 *
 * Re-checks everything rather than trusting the caller: the title must still be
 * what the proposal saw (a merchant edit in between wins), and the name must
 * still pass the guard against the supplier's words.
 */
export async function applyShopTitle(
  productId: string,
  from: string,
  to: string
): Promise<{ status: 'renamed' | 'kept' | 'skipped'; reason?: string }> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, title: true, source: { select: { id: true, raw: true } } },
  });
  if (!product?.source) return { status: 'skipped', reason: 'not a supplier product' };
  if (product.title !== from) return { status: 'skipped', reason: 'title changed since the preview' };

  const raw = asRaw(product.source.raw);
  if (!needsShopTitle(raw)) return { status: 'skipped', reason: 'already processed' };

  const supplierTitle = await supplierTitleFor(product.id, raw, product.title);
  const verdict = isFaithfulTitle(to, supplierTitle);
  if (!verdict.ok) return { status: 'skipped', reason: verdict.reason };

  const at = new Date().toISOString();

  if (to.toLowerCase() === from.toLowerCase()) {
    await prisma.supplierProduct.update({
      where: { id: product.source.id },
      data: { raw: { ...raw, supplierTitle, shopTitle: { status: 'kept', reason: 'already a good name', at } } as never },
    });
    return { status: 'kept' };
  }

  /*
   * The handle is deliberately NOT regenerated. It is the product's URL, and
   * changing it breaks every shared link, ad and indexed page for a cosmetic
   * gain. Image alt text that simply repeated the old title follows the rename.
   */
  await prisma.$transaction([
    prisma.product.update({ where: { id: product.id }, data: { title: to } }),
    prisma.productImage.updateMany({ where: { productId: product.id, alt: from }, data: { alt: to } }),
    prisma.supplierProduct.update({
      where: { id: product.source.id },
      data: { raw: { ...raw, supplierTitle, shopTitle: { status: 'renamed', from, to, at } } as never },
    }),
  ]);
  return { status: 'renamed' };
}

/** Propose and apply in one go — what publish and the cron use. Never throws. */
export async function ensureShopTitle(
  productId: string
): Promise<{ status: 'renamed' | 'kept' | 'failed' | 'skipped'; from?: string; to?: string; reason?: string }> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { title: true, source: { select: { id: true, raw: true } } },
    });
    if (!product?.source) return { status: 'skipped', reason: 'not a supplier product' };
    const raw = asRaw(product.source.raw);
    if (!needsShopTitle(raw)) return { status: 'skipped', reason: 'already processed' };

    const proposal = await proposeShopTitle(productId);
    if (!proposal) return { status: 'skipped', reason: 'not a supplier product' };

    if (!proposal.to) {
      const attempts = (raw.shopTitle?.attempts ?? 0) + 1;
      const giveUp = attempts >= MAX_ATTEMPTS;
      const record: ShopTitleRecord = {
        status: giveUp ? 'kept' : 'failed',
        reason: giveUp ? `gave up after ${attempts} attempts: ${proposal.reason}` : proposal.reason,
        attempts,
        at: new Date().toISOString(),
      };
      await prisma.supplierProduct.update({
        where: { id: product.source.id },
        data: { raw: { ...raw, supplierTitle: proposal.supplierTitle, shopTitle: record } as never },
      });
      return { status: 'failed', from: proposal.from, reason: proposal.reason };
    }

    const applied = await applyShopTitle(productId, proposal.from, proposal.to);
    return { status: applied.status, from: proposal.from, to: proposal.to, reason: applied.reason };
  } catch (err) {
    return { status: 'failed', reason: err instanceof Error ? err.message : String(err) };
  }
}

/** Live supplier products that have not been through the title job, oldest first. */
export async function pendingShopTitleIds(limit: number, includeDrafts = false): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: {
      ...(includeDrafts ? {} : { status: 'ACTIVE' as const }),
      source: { isNot: null },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, source: { select: { raw: true } } },
  });
  return rows.filter((r) => needsShopTitle(r.source?.raw)).slice(0, limit).map((r) => r.id);
}

/** One small batch, for the cron. Sequential so a provider hiccup stays small. */
export async function runShopTitleBatch(limit = 3) {
  const ids = await pendingShopTitleIds(limit);
  const results = [];
  for (const id of ids) results.push({ id, ...(await ensureShopTitle(id)) });
  const remaining = (await pendingShopTitleIds(10_000)).length;
  return {
    processed: results.length,
    renamed: results.filter((r) => r.status === 'renamed').length,
    failed: results.filter((r) => r.status === 'failed').map((r) => r.reason),
    remaining,
  };
}
