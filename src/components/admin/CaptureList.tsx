'use client';

export interface CaptureRow {
  id: string;
  title: string;
  platform: string;
  sourceUrl: string;
  currency: string;
  variantCount: number;
  pricedVariantCount: number;
  imageCount: number;
  videoCount: number;
  reviewCount: number;
  importedProductId: string | null;
  /** ACTIVE / DRAFT, or null when never imported or the product was deleted. */
  productStatus: string | null;
  productHandle: string | null;
  createdAt: string;
  thumbnail: string | null;
}

/**
 * Captures waiting to be priced.
 *
 * The counts are shown prominently, and priced-vs-total is called out in red
 * when they disagree: a capture with 12 variants but 0 prices looks successful
 * at a glance and is worthless. Making that visible here stops it being
 * discovered at the pricing table.
 */
type CaptureState =
  | 'live'
  | 'draft'
  | 'deleted'
  | 'unpriceable'
  | 'ready';

/**
 * What has actually happened to this capture.
 *
 * The list previously said only "Imported" or nothing, which hid the two
 * states a merchant most needs to tell apart: a product that is live and
 * selling, and one that was imported but left as a draft and is therefore
 * invisible to customers.
 */
function stateOf(c: CaptureRow): CaptureState {
  if (c.importedProductId) {
    if (c.productStatus === 'ACTIVE') return 'live';
    if (c.productStatus === 'DRAFT') return 'draft';
    // Imported, but the product it produced no longer exists.
    return 'deleted';
  }
  /*
   * A capture with no priced variant cannot be imported at all — the pricing
   * step has nothing to cost. Saying "awaiting pricing" would send the
   * merchant to a wizard that cannot succeed.
   */
  if (c.pricedVariantCount === 0) return 'unpriceable';
  return 'ready';
}

const STATE_LABEL: Record<CaptureState, string> = {
  live: 'Live in store',
  draft: 'Draft — not visible',
  deleted: 'Product deleted',
  unpriceable: 'No prices captured',
  ready: 'Not yet priced',
};

const STATE_CLASS: Record<CaptureState, string> = {
  live: 'border-verdigris/50 text-verdigris',
  draft: 'border-warn/50 text-warn',
  deleted: 'border-rule text-quiet',
  unpriceable: 'border-danger/50 text-danger',
  ready: 'border-gold/40 text-gold',
};

export function CaptureList({
  captures,
  onUse,
  onDelete,
  busyId = null,
  arrivedIds = [],
}: {
  captures: CaptureRow[];
  onUse: (id: string) => void;
  onDelete: (id: string) => void;
  busyId?: string | null;
  arrivedIds?: string[];
}) {
  const busy = busyId;
  const remove = onDelete;

  if (captures.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="text-body text-greige">
          No captures yet. Use the bookmark on a supplier product page and it will appear here.
        </p>
      </div>
    );
  }

  /*
   * Counted here rather than in the page so the summary can never disagree
   * with the badges beside it — both read the same stateOf().
   */
  const tally = captures.reduce<Record<string, number>>((acc, c) => {
    const k = stateOf(c);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-micro text-quiet">
        <span>{captures.length} captures</span>
        {tally.live > 0 && <span className="text-verdigris">{tally.live} live</span>}
        {tally.draft > 0 && <span className="text-warn">{tally.draft} draft</span>}
        {tally.ready > 0 && <span className="text-gold">{tally.ready} to price</span>}
        {tally.unpriceable > 0 && (
          <span className="text-danger">{tally.unpriceable} with no prices</span>
        )}
        {tally.deleted > 0 && <span>{tally.deleted} deleted</span>}
      </div>

      {/*
        Capped and scrolled. The list is the whole page below the fold once a
        few dozen captures exist, and older ones were unreachable — the loader
        also used to stop at 25 rows, so they were not merely off-screen, they
        were never fetched.
      */}
      <ul className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
      {captures.map((c) => {
        const incomplete = c.pricedVariantCount < c.variantCount || c.pricedVariantCount === 0;
        const state = stateOf(c);
        return (
          <li
            key={c.id}
            className={[
              'card flex flex-wrap items-center gap-4 p-4 transition-opacity',
              busy === c.id ? 'opacity-50' : '',
              // A capture lands while the merchant is looking at another tab,
              // so the row has to announce itself when they come back.
              arrivedIds.includes(c.id) ? 'capture-arrived' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="media aspect-product w-16 shrink-0">
              {c.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.thumbnail} alt="" loading="lazy" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-body text-onyx">{c.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-quiet">
                <span className="tag">{c.platform}</span>
                <span className={incomplete ? 'text-danger' : 'text-verdigris'}>
                  {c.pricedVariantCount}/{c.variantCount} priced
                </span>
                <span>{c.imageCount} images</span>
                {c.videoCount > 0 && <span className="text-gold">{c.videoCount} video</span>}
                {c.reviewCount > 0 && <span>{c.reviewCount} reviews</span>}
                <span>{new Date(c.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className={`tag ${STATE_CLASS[state]}`}>{STATE_LABEL[state]}</span>

              {state === 'live' && c.productHandle && (
                <a
                  href={`/products/${c.productHandle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="link text-label"
                >
                  View
                </a>
              )}

              {/*
                Points at the product LIST, not /admin/products/<id> — that
                route does not exist, and a badge that links to a 404 is worse
                than one that links nowhere.
              */}
              {state === 'draft' && (
                <a href="/admin/products" className="link text-label">
                  Publish it
                </a>
              )}

              {(state === 'ready' || state === 'unpriceable') && (
                <button
                  type="button"
                  onClick={() => onUse(c.id)}
                  disabled={state === 'unpriceable'}
                  title={
                    state === 'unpriceable'
                      ? 'This capture has no prices, so it cannot be costed. Re-capture it from the supplier page.'
                      : undefined
                  }
                  className="btn btn-primary px-5 py-2.5 disabled:opacity-40"
                >
                  Price it
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(c.id)}
                disabled={busy === c.id}
                className="link text-label"
              >
                Delete
              </button>
            </div>
          </li>
        );
      })}
      </ul>
    </div>
  );
}
