import { prisma } from '@/lib/db';
import { UnsubscribeButton } from '@/components/layout/UnsubscribeButton';

export const metadata = { title: 'Unsubscribe', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * The destination of the unsubscribe link in every marketing email.
 *
 * Shows a button rather than removing the address on page load. Mail scanners
 * and prefetchers fetch links before a human ever sees them, so unsubscribing
 * on GET would silently drop people who never clicked — see the POST handler.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  const subscriber = token
    ? await prisma.subscriber
        .findUnique({
          where: { token },
          select: { email: true, unsubscribedAt: true },
        })
        .catch(() => null)
    : null;

  return (
    <div className="shell py-16 md:py-24">
      <div className="mx-auto max-w-xl">
        <header>
          <hr className="rule-gold" />
          <h1 className="display-l mt-5">Unsubscribe</h1>
        </header>

        {!subscriber && (
          <p className="mt-6 text-body text-greige">
            That link is not valid or has already been used. If you are still receiving emails you
            did not ask for, reply to any of them and we will remove you by hand.
          </p>
        )}

        {subscriber?.unsubscribedAt && (
          <p className="mt-6 text-body text-greige">
            <strong className="text-onyx">{subscriber.email}</strong> has already been removed. You
            will not receive any further marketing emails from us.
          </p>
        )}

        {subscriber && !subscriber.unsubscribedAt && (
          <>
            <p className="mt-6 text-body text-greige">
              Remove <strong className="text-onyx">{subscriber.email}</strong> from our marketing
              list? You will still receive emails about orders you have placed.
            </p>
            <UnsubscribeButton token={token as string} />
          </>
        )}
      </div>
    </div>
  );
}
