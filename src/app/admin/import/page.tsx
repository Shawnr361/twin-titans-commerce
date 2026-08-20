import { ImportWorkspace } from '@/components/admin/ImportWorkspace';
import { captureToken } from '@/lib/suppliers/captureToken';
import { buildCaptureScript } from '@/lib/suppliers/bookmarklet';
import type { CaptureRow } from '@/components/admin/CaptureList';
import { listCaptureRows } from '@/lib/suppliers/captureRows';
import { getPricingRules, getStoreSettings } from '@/lib/settings';

export const metadata = { title: 'Import product' };
export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const [settings, rules] = await Promise.all([getStoreSettings(), getPricingRules()]);

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3400').replace(/\/$/, '');

  let bookmarklet = '';
  try {
    bookmarklet = buildCaptureScript(`${site}/api/admin/capture`, captureToken());
  } catch {
    // AUTH_SECRET missing — the setup card explains rather than rendering a
    // bookmarklet that would fail silently on the supplier's page.
  }

  const captures: CaptureRow[] = await listCaptureRows();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="font-display text-d3 text-onyx">Add a product</h2>
        <p className="max-w-2xl text-body text-greige">
          Capture a supplier listing from your browser, then price every variant against its own
          landed cost in {settings.baseCurrency}. Nothing can be published below what it costs you.
        </p>
      </header>

      <ImportWorkspace
        baseCurrency={settings.baseCurrency}
        defaultMarginPct={rules.marginPct}
        bookmarklet={bookmarklet}
        captures={captures}
      />
    </div>
  );
}
