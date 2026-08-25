import type { Metadata } from 'next';
import { ContactForm } from '@/components/commerce/ContactForm';
import { getStoreSettings } from '@/lib/settings';

/**
 * Contact.
 *
 * A static segment deliberately shadowing /pages/[handle]: the other policy
 * pages are database Pages rendered from stored HTML, which cannot carry an
 * interactive form. This one needs a real client component, so it is a route of
 * its own and the stored "contact" Page is no longer used.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Contact us',
  description: 'Questions about an order, a product, or a delivery — send us a message.',
  alternates: { canonical: '/pages/contact' },
};

export default async function ContactPage() {
  const settings = await getStoreSettings();
  const supportEmail = settings.supportEmail || 'support@twintitanemporium.com';

  return (
    <article className="shell py-16 md:py-24">
      <header className="max-w-text">
        <hr className="rule-gold" />
        <h1 className="display-l mt-5">Contact us</h1>
        <p className="prose-measure mt-6 text-body text-greige">
          Questions about an order, a product, or a delivery? We reply to every message, usually
          within one business day.
        </p>
        <p className="prose-measure mt-3 text-body text-greige">
          Include your order number if you have one — it gets you an answer much faster.
        </p>
      </header>

      <div className="mt-10 max-w-2xl">
        <ContactForm supportEmail={supportEmail} />
      </div>
    </article>
  );
}
