import { SettingsForm } from '@/components/admin/SettingsForm';
import { getPricingRules, getStoreSettings } from '@/lib/settings';
import { getRates } from '@/lib/fx';
import { AliexpressConnection } from '@/components/admin/AliexpressConnection';
import { isAliexpressConfigured, storedToken } from '@/lib/suppliers/aliexpress-api';
import { TrackingSettingsCard } from '@/components/admin/TrackingSettings';
import { getTrackingSettings } from '@/lib/tracking';

export const metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ aliexpress?: string }>;
}) {
  const [settings, rules, rates, params, token, tracking] = await Promise.all([
    getStoreSettings(),
    getPricingRules(),
    getRates(),
    searchParams,
    storedToken().catch(() => null),
    getTrackingSettings(),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-greige">Store identity, pricing defaults and exchange rates.</p>
      </header>

      <SettingsForm settings={settings} rules={rules} rates={rates} />

      {/*
        Tokens are deliberately NOT passed down — only whether each is set.
        A secret that never reaches the browser cannot leak from it.
      */}
      <TrackingSettingsCard
        settings={{
          metaPixelId: tracking.metaPixelId,
          tiktokPixelId: tracking.tiktokPixelId,
          metaTestEventCode: tracking.metaTestEventCode,
          tiktokTestEventCode: tracking.tiktokTestEventCode,
        }}
        metaTokenSet={Boolean(tracking.metaCapiToken)}
        tiktokTokenSet={Boolean(tracking.tiktokEventsToken)}
      />

      <AliexpressConnection
        configured={isAliexpressConfigured()}
        connectedAt={token?.connectedAt ?? null}
        sellerId={token?.sellerId ?? null}
        notice={params.aliexpress ?? null}
      />
    </div>
  );
}
