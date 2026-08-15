import { SettingsForm } from '@/components/admin/SettingsForm';
import { getPricingRules, getStoreSettings } from '@/lib/settings';
import { getRates } from '@/lib/fx';

export const metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const [settings, rules, rates] = await Promise.all([
    getStoreSettings(),
    getPricingRules(),
    getRates(),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-mut">Store identity, pricing defaults and exchange rates.</p>
      </header>

      <SettingsForm settings={settings} rules={rules} rates={rates} />
    </div>
  );
}
