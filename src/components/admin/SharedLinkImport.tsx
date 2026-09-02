'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/**
 * What happens when a link arrives from the Android share sheet.
 *
 * It imports on arrival rather than waiting for a tap. The merchant already
 * expressed the intent — they chose Share, then chose this app — and asking
 * again on a phone, one-handed, standing in a shop, is a tap that earns
 * nothing. A duplicate is reported rather than refused, and nothing is
 * published either way, so the worst case of acting immediately is a capture
 * sitting in a queue.
 */
export function SharedLinkImport({ link }: { link: string | null }) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'failed'>(
    link ? 'working' : 'idle'
  );
  const [message, setMessage] = useState('');
  const [warning, setWarning] = useState('');
  // React runs effects twice in development; an import must not run twice.
  const started = useRef(false);

  useEffect(() => {
    if (!link || started.current) return;
    started.current = true;

    (async () => {
      try {
        const res = await fetch('/api/admin/import/from-url', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: link }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) {
          setState('failed');
          setMessage(String(body.error ?? 'Could not fetch that product.'));
          return;
        }
        const q = body.quality ?? {};
        setState('done');
        setMessage(
          `${String(body.title).slice(0, 70)} — ${q.variantCount} variants, ${q.imageCount} images${
            q.videoCount ? `, ${q.videoCount} video` : ''
          }.`
        );
        if (body.warning) setWarning(String(body.warning));
      } catch {
        setState('failed');
        setMessage('Could not reach the store. Check your connection and try again.');
      }
    })();
  }, [link]);

  if (!link) {
    return (
      <div className="card p-6">
        <p className="text-body text-greige">
          Nothing was shared. On your phone, open a product in the AliExpress app, tap{' '}
          <strong className="text-onyx">Share</strong>, then choose{' '}
          <strong className="text-onyx">Twin Titans</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="card space-y-3 p-6">
      {state === 'working' && <p className="text-body text-greige">Fetching from AliExpress…</p>}

      {state === 'done' && (
        <>
          <p className="text-body text-verdigris">Added to your import queue</p>
          <p className="text-body text-onyx">{message}</p>
          {warning && <p className="text-label text-warn">{warning}</p>}
        </>
      )}

      {state === 'failed' && (
        <>
          <p className="text-body text-warn">{message}</p>
          <p className="text-micro text-greige break-all">Shared link: {link}</p>
        </>
      )}

      {state !== 'working' && (
        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="/admin/import" className="btn btn-primary !rounded-full px-5 py-2 text-xs">
            Price it now
          </Link>
          {/*
            Closing the window is what a phone user actually wants next: they
            are in the AliExpress app, mid-browse, and the queue can wait.
          */}
          <Link href="/admin" className="btn !rounded-full px-5 py-2 text-xs">
            Done
          </Link>
        </div>
      )}
    </div>
  );
}
