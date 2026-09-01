'use client';

import { Fragment, useEffect, useState } from 'react';
import { formatMoney } from '@/lib/money';
import { Price } from '@/components/commerce/Price';

/**
 * The announcement strip.
 *
 * TWO DISPLAYS, ONE SOURCE
 * ------------------------
 * 'marquee' runs every message as one continuous line scrolling right to left.
 * 'rotate'  shows one message at a time, dropping in from above and changing
 *           on a timer.
 *
 * Both read the same setting — one message per line in admin — so switching
 * display never means retyping the copy.
 *
 * MONEY INSIDE THE BANNER
 * -----------------------
 * The banner is free text, so the free-delivery threshold in it is just
 * characters — "Free delivery on orders over ₦30,000". Switching to USD
 * converted every real price on the page and left this line in naira, which is
 * the first thing a visitor reads and the one place an inconsistency looks like
 * a bug rather than a rounding difference. Rather than force the merchant to
 * learn a template syntax, this looks for the threshold as it would be
 * formatted in the base currency and swaps that one span for a Price. Text that
 * does not mention the amount is rendered unchanged, so nothing here constrains
 * what can be written.
 */

/** How long each message holds before the next drops in. */
const ROTATE_MS = 5000;

export function AnnouncementBar({
  messages,
  style = 'marquee',
  freeShippingOverMinor,
  baseCurrency,
}: {
  messages: string[];
  style?: 'marquee' | 'rotate';
  freeShippingOverMinor: number;
  baseCurrency: string;
}) {
  if (messages.length === 0) return null;

  const render = (text: string) => (
    <Message
      text={text}
      freeShippingOverMinor={freeShippingOverMinor}
      baseCurrency={baseCurrency}
    />
  );

  return (
    <div className="border-b border-onyx/10 bg-onyx/10 backdrop-blur-md">
      {style === 'rotate' ? (
        <Rotator messages={messages} render={render} />
      ) : (
        <Marquee messages={messages} render={render} />
      )}
    </div>
  );
}

/**
 * One continuous line, right to left.
 *
 * The track holds the messages twice so the loop meets itself: the animation
 * travels exactly half the track width, at which point the copy sits where the
 * original started and the jump back is invisible. The second copy is hidden
 * from screen readers — it is the same words, and hearing everything twice is
 * worse than not hearing the effect at all.
 *
 * It pauses on hover and on keyboard focus, because a line that will not hold
 * still cannot be read by anyone who reads slowly.
 */
function Marquee({
  messages,
  render,
}: {
  messages: string[];
  render: (text: string) => React.ReactNode;
}) {
  /*
   * Speed is set by length, not by a fixed duration. A fixed duration makes one
   * short message crawl and five long ones sprint past unread; roughly constant
   * pixels-per-second keeps both legible.
   */
  const characters = messages.join('').length * Math.max(messages.length, 1);
  const seconds = Math.min(90, Math.max(24, characters * 0.35));

  const group = (clone: boolean) => (
    <div className="announce-group" aria-hidden={clone || undefined}>
      {messages.map((message, i) => (
        <Fragment key={i}>
          <span className="label !text-onyx/80">{render(message)}</span>
          <span className="text-onyx/25" aria-hidden="true">
            ✦
          </span>
        </Fragment>
      ))}
    </div>
  );

  return (
    <div className="announce py-2.5" aria-label="Store announcements" role="region">
      <div
        className="announce-track"
        style={{ ['--announce-duration' as string]: `${seconds}s` }}
      >
        {group(false)}
        {group(true)}
      </div>
    </div>
  );
}

/**
 * One message at a time, dropping in from above.
 *
 * Every message is also rendered flat and visually hidden, so assistive
 * technology reads the whole set once rather than being interrupted every five
 * seconds by a live region that changes on its own.
 */
function Rotator({
  messages,
  render,
}: {
  messages: string[];
  render: (text: string) => React.ReactNode;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length < 2) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % messages.length),
      ROTATE_MS
    );
    return () => window.clearInterval(id);
  }, [messages.length]);

  // A shorter list after an edit must not leave the index past the end.
  const current = messages[index % messages.length];

  return (
    <div className="announce" aria-label="Store announcements" role="region">
      <p
        key={index}
        className="announce-slide label !text-onyx/80 px-4 py-2.5 text-center"
        aria-hidden="true"
      >
        {render(current)}
      </p>
      <div className="sr-only">
        {messages.map((message, i) => (
          <p key={i}>{message}</p>
        ))}
      </div>
    </div>
  );
}

/** Swap the free-delivery threshold for a live-converted Price, if present. */
function Message({
  text,
  freeShippingOverMinor,
  baseCurrency,
}: {
  text: string;
  freeShippingOverMinor: number;
  baseCurrency: string;
}) {
  const needle = freeShippingOverMinor > 0 ? formatMoney(freeShippingOverMinor, baseCurrency) : '';
  const at = needle ? text.indexOf(needle) : -1;

  if (at === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, at)}
      <Price minor={freeShippingOverMinor} currency={baseCurrency} className="!text-onyx/80" />
      {text.slice(at + needle.length)}
    </>
  );
}
