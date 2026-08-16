'use client';

import { useRef, useState } from 'react';
import { CaptureSetup } from './CaptureSetup';
import { CaptureList, type CaptureRow } from './CaptureList';
import { ImportWizard, type ImportWizardHandle } from './ImportWizard';

/**
 * Ties the three pieces of the import flow together: install the bookmarklet,
 * pick a capture, price it.
 *
 * The wizard owns the pricing state, so selecting a capture calls into it via a
 * ref rather than lifting all of that state up here — the wizard is already the
 * thing that knows how to load, edit and commit a preview.
 */
export function ImportWorkspace({
  baseCurrency,
  defaultMarginPct,
  bookmarklet,
  captures,
}: {
  baseCurrency: string;
  defaultMarginPct: number;
  bookmarklet: string;
  captures: CaptureRow[];
}) {
  const wizardRef = useRef<ImportWizardHandle>(null);
  const [pricingId, setPricingId] = useState<string | null>(null);

  const use = (id: string) => {
    setPricingId(id);
    wizardRef.current?.loadCapture(id);
    // Bring the pricing table into view — it renders below the list.
    requestAnimationFrame(() => {
      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div className="space-y-8">
      {bookmarklet ? (
        <CaptureSetup href={bookmarklet} />
      ) : (
        <div className="card border-warn/40 p-6">
          <p className="text-body text-warn">
            AUTH_SECRET is not set on the server, so the capture bookmarklet cannot be generated.
          </p>
        </div>
      )}

      <section className="space-y-4">
        <h3 className="font-display text-d2 text-onyx">
          Captures
          {captures.length > 0 && <span className="ml-2 text-label text-quiet">{captures.length}</span>}
        </h3>
        <CaptureList captures={captures} onUse={use} />
      </section>

      <section id="pricing" className="scroll-mt-24 space-y-4">
        <ImportWizard
          ref={wizardRef}
          baseCurrency={baseCurrency}
          defaultMarginPct={defaultMarginPct}
          activeCaptureId={pricingId}
        />
      </section>
    </div>
  );
}
