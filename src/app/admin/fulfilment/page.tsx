import { formatMoney } from '@/lib/money';
import { PlaceWithSupplier } from '@/components/admin/PlaceWithSupplier';
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
        <p className="max-w-2xl text-sm text-greige">
          Paid orders waiting to be placed with the supplier. Open the listing, buy the exact SKU,
          and paste the customer&apos;s address as the delivery address — then record the supplier
          order number here.
        </p>
      </header>

      {valid.length === 0 ? (
        <div className="card p-12 text-center text-sm text-greige">
          Nothing waiting. Every paid order has been placed with its supplier.
        </div>
      ) : (
        <div className="space-y-10">
          {/*
            Grouped by the CUSTOMER's order, not by seller.
            
            One payment can span several AliExpress sellers — order #18 has foot
            socks from one store and a clipper from another — and AliExpress
            cannot place a single order across sellers. The queue must still
            show a card per seller, because each becomes its own parcel and its
            own tracking number. But the merchant should press ONE button: the
            per-card buttons meant clicking three times for one purchase, and
            the second and third are exactly what gets forgotten.
          */}
          {[...new Map(valid.map((s) => [s.orderId, s])).keys()].map((orderId) => {
            const group = valid.filter((s) => s.orderId === orderId);
            const placeable = group.filter(
              (s) => s.status === 'PENDING' && s.canPlaceAutomatically
            );
            return (
              <section key={orderId} className="space-y-4">
                {placeable.length > 0 && (
                  <div className="flex flex-wrap items-center gap-4">
                    <PlaceWithSupplier
                      orderId={orderId}
                      sellerCount={placeable.length}
                      cost={formatMoney(
                        placeable.reduce((sum, s) => sum + s.estimatedCostMinor, 0),
                        group[0].currency
                      )}
                    />
                    <p className="text-micro text-greige">
                      {placeable.length > 1
                        ? `Order #${group[0].orderNumber} spans ${placeable.length} sellers — one click places them all, one order each.`
                        : 'Places and pays on AliExpress with the customer’s address.'}
                    </p>
                  </div>
                )}
                {group.map((sheet) => (
                  <FulfilmentCard key={sheet.supplierOrderId} sheet={sheet} />
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
