'use client';

import { useEffect, useRef, useState } from 'react';
import { IconCheck, IconSpark } from '@/components/icons';

/**
 * Bookmarklet installation.
 *
 * The link must be a real <a href="javascript:..."> for the browser to accept
 * it as a bookmark when dragged — React will render the href fine, but the
 * anchor must not navigate if clicked here, hence the preventDefault.
 */
export function CaptureSetup({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);
  const anchorRef = useRef<HTMLAnchorElement>(null);

  /*
   * React refuses to render a `javascript:` href — it sanitises the attribute
   * and, in React 19, throws while rendering. That crashed this entire page.
   *
   * A bookmarklet is a javascript: URL by definition, so the attribute is set
   * directly on the DOM node after mount, which React does not police. The
   * anchor is inert until then, and clicking it never navigates anyway.
   */
  useEffect(() => {
    if (anchorRef.current && href) anchorRef.current.setAttribute('href', href);
  }, [href]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked — the drag route still works */
    }
  };

  return (
    <section className="card p-6">
      <div className="flex items-start gap-3">
        <IconSpark size={20} className="mt-0.5 shrink-0 text-gold" />
        <div className="min-w-0">
          <h3 className="font-display text-d2 text-onyx">Capture from your browser</h3>
          <p className="mt-2 max-w-2xl text-body text-greige">
            Supplier sites serve automated requests a stripped page with no prices, variants or
            videos. Your browser sees the real thing — so the capture runs there. This is the same
            approach DSers and Oberlo use.
          </p>
        </div>
      </div>

      <ol className="mt-6 space-y-4 text-body text-greige">
        <li className="flex gap-3">
          <span className="text-label shrink-0 text-gold">01</span>
          <span>
            Show your bookmarks bar — <kbd className="text-onyx">Ctrl</kbd> +{' '}
            <kbd className="text-onyx">Shift</kbd> + <kbd className="text-onyx">B</kbd>.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="text-label shrink-0 text-gold">02</span>
          <span className="flex flex-wrap items-center gap-3">
            Drag this button onto it:
            {/* href is attached in an effect — see the note above. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              ref={anchorRef}
              onClick={(e) => e.preventDefault()}
              draggable
              className="btn btn-primary cursor-grab px-5 py-2.5 active:cursor-grabbing"
              title="Drag me to your bookmarks bar"
            >
              Capture to Twin Titans
            </a>
            <button type="button" onClick={copy} className="link text-label">
              {copied ? 'Copied' : 'or copy the code'}
            </button>
          </span>
        </li>
        <li className="flex gap-3">
          <span className="text-label shrink-0 text-gold">03</span>
          <span>
            Open any AliExpress, Alibaba or 1688 product page, <strong className="text-onyx">
              wait until prices are visible
            </strong>
            , then click the bookmark. A confirmation appears on the page.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="text-label shrink-0 text-gold">04</span>
          <span>Come back here — the capture appears below, ready to price.</span>
        </li>
      </ol>

      <p className="mt-6 flex items-start gap-2 text-label !normal-case !tracking-normal text-quiet">
        <IconCheck size={15} className="mt-0.5 shrink-0 text-verdigris" />
        Captures land as raw supplier data. Nothing is priced, published or charged until you
        review it.
      </p>
    </section>
  );
}
