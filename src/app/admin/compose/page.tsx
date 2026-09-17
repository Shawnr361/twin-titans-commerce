import { ComposeEmail } from '@/components/admin/ComposeEmail';
import { prisma } from '@/lib/db';
import { getStoreSettings } from '@/lib/settings';

export const metadata = { title: 'Email a customer' };
export const dynamic = 'force-dynamic';

/**
 * Write to one customer in the store's own email design.
 *
 * The addresses offered are customers who have ordered — people the shop
 * already has a reason to write to. Marketing to the mailing list is a
 * different job with different rules; see the Mailing list page.
 */
export default async function ComposePage() {
  const [customers, settings] = await Promise.all([
    prisma.customer
      .findMany({
        orderBy: { updatedAt: 'desc' },
        take: 500,
        select: { email: true, name: true },
      })
      .catch(() => []),
    getStoreSettings(),
  ]);

  const from = settings.notificationEmail || settings.supportEmail || 'the store address';

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-bold tracking-tight">Email a customer</h2>
        <p className="max-w-2xl text-sm text-greige">
          Sends one email in the store&rsquo;s black-and-gold design — the same design as order
          confirmations. For one customer at a time: order updates, apologies, follow-ups. Not
          for promotions to your mailing list.
        </p>
      </header>
      <ComposeEmail customers={customers} from={from} />
    </div>
  );
}
