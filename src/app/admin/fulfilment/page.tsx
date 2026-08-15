import { FulfilmentCard } from '@/components/admin/FulfilmentCard';
import { buildOrderSheet } from '@/lib/dropship/fulfilment';
import { prisma } from '@/lib/db';

export const metadata = { title: 'Supplier queue' };
export const dynamic = 'force-dynamic';

/**
 * The supplier fulfilment queue.
 *
 * Every paid order that has not yet been placed with its supplier shows up
 * here with a ready-to-paste order sheet: exact listing URL, exact SKU, and the
 * customer's address as the ship-to. This is the screen that replaces DSers.
 */
export default async function FulfilmentPage() {
  const pending = await prisma.supplierOrder
    .findMany({
      where: { status: { in: ['PENDING', 'PLACED'] } },
      orderBy: { createdAt: 'asc' },
      take: 40,
      select: { id: true, status: true, createdAt: true },
    })
    .catch(() => []);

  const sheets = await Promise.all(
    pending.map(async (row) => {
      try {
        return { ...(await buildOrderSheet(row.id)), status: row.status };
      } catch {
        return null;
      }
    })
  );

  const valid = sheets.filter((s): s is NonNullable<typeof s> => s !== null);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-bold tracking-tight">Supplier queue</h2>
        <p className="max-w-2xl text-sm text-mut">
          Paid orders waiting to be placed with the supplier. Open the listing, buy the exact SKU,
          and paste the customer&apos;s address as the delivery address — then record the supplier
          order number here.
        </p>
      </header>

      {valid.length === 0 ? (
        <div className="panel p-12 text-center text-sm text-mut">
          Nothing waiting. Every paid order has been placed with its supplier.
        </div>
      ) : (
        <div className="space-y-4">
          {valid.map((sheet) => (
            <FulfilmentCard key={sheet.supplierOrderId} sheet={sheet} />
          ))}
        </div>
      )}
    </div>
  );
}
