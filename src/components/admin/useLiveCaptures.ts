'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CaptureRow } from './CaptureList';

/**
 * Keeps the capture list current without reloading the page.
 *
 * A capture is posted by the bookmarklet running on the supplier's site — a
 * different tab, a different origin. Nothing here can know it happened, which
 * is why the list previously sat stale until the merchant reloaded by hand.
 *
 * Two deliberate choices:
 *
 * Polling, not a stream. This runs on shared hosting behind Passenger, where a
 * held-open connection occupies a worker that real requests then queue behind.
 *
 * Two-step. The repeating request asks only whether anything changed and gets
 * back two values; the rows are fetched once, after, when the answer is yes.
 * Only this hook's state updates, so the rest of the page — including a pricing
 * table the merchant may be part-way through — is never re-rendered underneath
 * them, which a router.refresh() would have done.
 */
export function useLiveCaptures(initial: CaptureRow[], intervalMs = 5000) {
  const [rows, setRows] = useState<CaptureRow[]>(initial);
  const [arrivedIds, setArrivedIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Refs so a change here never itself schedules a render.
  const seen = useRef<{ count: number; latestId: string | null }>({
    count: initial.length,
    latestId: initial[0]?.id ?? null,
  });

  // The polling effect closes over the first render's rows, so it reads the
  // current ones through a ref instead.
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    };

    async function tick() {
      // A hidden tab does not need updating, and waking the app to tell it so
      // is exactly the load this host has none to spare for.
      if (document.visibilityState !== 'visible') return schedule();

      try {
        const res = await fetch('/api/admin/capture', { cache: 'no-store' });
        if (!res.ok) return schedule();
        const head = (await res.json()) as { count: number; latestId: string | null };

        if (head.count !== seen.current.count || head.latestId !== seen.current.latestId) {
          const full = await fetch('/api/admin/capture?rows=1', { cache: 'no-store' });
          if (full.ok && !cancelled) {
            const data = (await full.json()) as { captures?: CaptureRow[] };
            const next = data.captures ?? [];
            const knownIds = new Set(rowsRef.current.map((r) => r.id));
            const fresh = next.filter((r) => !knownIds.has(r.id)).map((r) => r.id);

            seen.current = { count: head.count, latestId: head.latestId };
            setRows(next);
            if (fresh.length) {
              setArrivedIds(fresh);
              // Long enough to notice, short enough not to linger as decoration.
              setTimeout(() => !cancelled && setArrivedIds([]), 2600);
            }
          }
        }
      } catch {
        // Offline, asleep, or mid-deploy. The next tick tries again.
      }
      schedule();
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };

    schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);

  const remove = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/capture/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRows((prev) => {
          const next = prev.filter((r) => r.id !== id);
          seen.current = { count: next.length, latestId: next[0]?.id ?? null };
          return next;
        });
      }
    } finally {
      setBusyId(null);
    }
  }, []);

  return { rows, arrivedIds, busyId, remove };
}
