import { formatMoney } from '@/lib/money';
import { PlaceOnAliExpress } from '@/components/admin/PlaceOnAliExpress';
import { FulfilmentCard } from '@/components/admin/FulfilmentCard';
import { aliexpressItemUrl } from '@/lib/dropship/aliexpress-cart';
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

            /*
             * Every outstanding AliExpress purchase on this payment.
             *
             * Note what is NOT filtered here: canPlaceAutomatically. That flag
             * gates the API, which refuses a line with no supplier SKU because
             * it would let AliExpress choose the variant. Buying by hand has no
             * such problem — the merchant sees the options on the page and
             * picks the right one — so the products that flag excludes are
             * exactly the ones that most need this button.
             */
            const pending = group.filter(
              (s) => s.status === 'PENDING' && s.platform === 'ALIEXPRESS'
            );

            const lines = pending.flatMap((sheet) =>
              sheet.lines.map((line) => ({
                title: line.title ?? '',
                url: aliexpressItemUrl(line.url, line.sku, line.quantity),
                variant: line.variant,
                sku: line.sku,
                quantity: line.quantity,
              }))
            );

            const shipTo = group[0].shipTo;
            const addressText = [
              shipTo.name,
              shipTo.line1,
              shipTo.line2,
              [shipTo.city, shipTo.state].filter(Boolean).join(', '),
              [shipTo.postcode, shipTo.country].filter(Boolean).join(' '),
              shipTo.phone ? `Tel: ${shipTo.phone}` : '',
            ]
              .filter(Boolean)
              .join('\n');

            return (
              <section key={orderId} className="space-y-4">
                {lines.length > 0 && (
                  <PlaceOnAliExpress
                    orderNumber={group[0].orderNumber}
                    lines={lines}
                    addressText={addressText}
                    sellerCount={pending.length}
                    cost={formatMoney(
                      pending.reduce((sum, s) => sum + s.estimatedCostMinor, 0),
                      group[0].currency
                    )}
                  />
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
