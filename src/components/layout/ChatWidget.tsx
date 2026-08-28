'use client';

import { useEffect, useRef, useState } from 'react';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

const OPENING =
  'Hello — ask me about delivery, returns, payment, or finding something in the shop. For where your order is, use Track an order.';

/**
 * Floating customer assistant.
 *
 * Renders nothing until opened, so the storefront's first paint carries no cost
 * for a panel most visitors never touch.
 */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([{ role: 'assistant', content: OPENING }]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'end' });
  }, [turns, open]);

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question || busy) return;

    // The history sent is the state BEFORE this question, and excludes the
    // canned opening line — the model did not say it and should not think it did.
    const history = turns.slice(1);

    setTurns((t) => [...t, { role: 'user', content: question }]);
    setDraft('');
    setBusy(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, history }),
      });
      const data = await res.json().catch(() => ({}));
      setTurns((t) => [
        ...t,
        {
          role: 'assistant',
          content:
            res.ok && data?.reply
              ? data.reply
              : (data?.error ?? 'Sorry — something went wrong. Please email us.'),
        },
      ]);
    } catch {
      setTurns((t) => [
        ...t,
        { role: 'assistant', content: 'I could not reach the shop just then. Please try again.' },
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask a question"
        className="fixed bottom-5 right-5 z-40 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-bg shadow-lg transition-transform hover:-translate-y-0.5"
      >
        Ask us
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Customer assistant"
      className="fixed bottom-5 right-5 z-40 flex h-[30rem] w-[min(23rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-rule bg-paper shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-rule px-4 py-3">
        <p className="text-label">Ask us</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="text-greige hover:text-onyx"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {turns.map((t, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
              t.role === 'user'
                ? 'ml-auto bg-gold/15 text-onyx'
                : 'bg-paper-2 text-greige'
            }`}
          >
            {/* Plain text: the model is told not to emit markup, and rendering
                any it produced anyway would be an injection route. */}
            <p className="whitespace-pre-wrap">{t.content}</p>
          </div>
        ))}
        {busy && <p className="text-xs text-quiet">Thinking…</p>}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-rule p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your question"
          maxLength={600}
          className="field flex-1"
          aria-label="Your question"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="btn btn-primary !rounded-full px-5 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
