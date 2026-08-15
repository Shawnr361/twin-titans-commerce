import { ImportWizard } from '@/components/admin/ImportWizard';
import { getPricingRules, getStoreSettings } from '@/lib/settings';

export const metadata = { title: 'Import product' };
export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const [settings, rules] = await Promise.all([getStoreSettings(), getPricingRules()]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-bold tracking-tight">Import from a supplier link</h2>
        <p className="max-w-2xl text-sm text-mut">
          Paste any AliExpress, Alibaba or 1688 product URL. The listing is read, converted to{' '}
          {settings.baseCurrency}, and priced from each variant&apos;s own cost — so no SKU can
          quietly end up selling below what it costs you.
        </p>
      </header>

      <ImportWizard baseCurrency={settings.baseCurrency} defaultMarginPct={rules.marginPct} />
    </div>
  );
}
