'use client';

import { useState } from 'react';

interface Reviewable {
  productId: string;
  title: string;
  imageUrl: string | null;
  alreadyReviewed: boolean;
}

/**
 * Leave a review for something you actually received.
 *
 * Two steps on purpose: find the order first, then review what it contains.
 * The customer never picks a product from the whole catalogue, so the only
 * things offered are things the server already agreed were delivered.
 */
export function ReviewForm() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [items, setItems] = useState<Reviewable[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [active, setActive] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [done, setDone] = useState<string[]>([]);

  const findOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/reviews', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderNumber: Number(orderNumber), email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not find that order.');
      setItems(data.products ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (productId: string) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderNumber: Number(orderNumber),
          email,
          productId,
          rating,
          body,
          authorName: authorName || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not save your review.');
      setDone((d) => [...d, productId]);
      setActive(null);
      setRating(0);
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (!items) {
    return (
      <form onSubmit={findOrder} className="mt-10 grid gap-4 sm:grid-cols-[1fr_1.4fr_auto]">
        <div>
          <label className="field-label" htmlFor="rv-number">
            Order number
          </label>
          <input
            id="rv-number"
            inputMode="numeric"
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            className="field"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="rv-email">
            Email
          </label>
          <input
            id="rv-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
          />
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={busy} className="btn btn-primary !rounded-full px-8">
            {busy ? 'Checking…' : 'Find order'}
          </button>
        </div>

        {error && (
          <p role="alert" className="text-label text-danger sm:col-span-3">
            {error}
          </p>
        )}
      </form>
    );
  }

  const outstanding = items.filter((i) => !i.alreadyReviewed && !done.includes(i.productId));

  if (items.length === 0) {
    return (
      <p className="mt-8 text-body text-greige">
        Nothing on this order can be reviewed yet. Reviews open once your parcel is marked
        delivered — we will email you when it is.
      </p>
    );
  }

  if (outstanding.length === 0) {
    return (
      <p role="status" className="mt-8 text-body text-verdigris">
        Thank you — you have reviewed everything on this order.
      </p>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {error && (
        <p role="alert" className="text-label text-danger">
          {error}
        </p>
      )}

      {outstanding.map((item) => (
        <div key={item.productId} className="card p-5">
          <div className="flex items-start gap-4">
            {item.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt=""
                className="h-16 w-16 flex-none rounded object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-body">{item.title}</p>

              {active === item.productId ? (
                <div className="mt-4 space-y-3">
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        aria-label={`${n} out of 5`}
                        aria-pressed={rating === n}
                        className={`h-9 w-9 rounded-full border text-sm ${
                          n <= rating
                            ? 'border-gold bg-gold/15 text-gold'
                            : 'border-rule text-greige'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={4}
                    placeholder="How was the quality? Did it arrive as described?"
                    className="field w-full"
                  />
                  <input
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Name to show (optional)"
                    className="field w-full"
                  />

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy || rating === 0}
                      onClick={() => submit(item.productId)}
                      className="btn btn-primary !rounded-full px-6 disabled:opacity-50"
                    >
                      {busy ? 'Sending…' : 'Post review'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActive(null)}
                      className="btn !rounded-full px-6"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setActive(item.productId);
                    setRating(0);
                    setBody('');
                    setError('');
                  }}
                  className="btn !rounded-full mt-3 px-6"
                >
                  Write a review
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
