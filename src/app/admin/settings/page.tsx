import { SettingsForm } from '@/components/admin/SettingsForm';
import { getPricingRules, getStoreSettings } from '@/lib/settings';
import { getRates } from '@/lib/fx';
import { AliexpressConnection } from '@/components/admin/AliexpressConnection';
import { isAliexpressConfigured, storedToken } from '@/lib/suppliers/aliexpress-api';

export const metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ aliexpress?: string }>;
}) {
  const [settings, rules, rates, params, token] = await Promise.all([
    getStoreSettings(),
    getPricingRules(),
    getRates(),
    searchParams,
    storedToken().catch(() => null),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-greige">Store identity, pricing defaults and exchange rates.</p>
      </header>

      <SettingsForm settings={settings} rules={rules} rates={rates} />

      <AliexpressConnection
        configured={isAliexpressConfigured()}
        connectedAt={token?.connectedAt ?? null}
        sellerId={token?.sellerId ?? null}
        notice={params.aliexpress ?? null}
      />
    </div>
  );
}
