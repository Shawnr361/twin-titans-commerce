import Link from 'next/link';
import { getStoreSettings } from '@/lib/settings';
import { Wordmark } from './Wordmark';
import { NewsletterForm } from './NewsletterForm';

const COLUMNS: { heading: string; links: [string, string][] }[] = [
  {
    heading: 'Shop',
    links: [
      ['All products', '/collections/all'],
      ['Bag', '/cart'],
      ['Track an order', '/orders/track'],
    ],
  },
  {
    heading: 'Client care',
    links: [
      ['Shipping & delivery', '/pages/shipping'],
      ['Returns & refunds', '/pages/returns'],
      ['Contact', '/pages/contact'],
    ],
  },
  {
    heading: 'House',
    links: [
      ['Privacy', '/pages/privacy'],
      ['Terms', '/pages/terms'],
    ],
  },
];

export async function SiteFooter() {
  const settings = await getStoreSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-band border-t border-rule bg-bone2">
      <div className="shell py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_2fr]">
          <div className="max-w-sm">
            <Wordmark name={settings.storeName} />
            <p className="mt-5 text-body text-greige">{settings.tagline}</p>
            <hr className="rule-brass mt-6" />
            <NewsletterForm />
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <nav key={col.heading} aria-label={col.heading}>
                <h2 className="label mb-4">{col.heading}</h2>
                <ul className="space-y-2.5">
                  {col.links.map(([label, href]) => (
                    <li key={href}>
                      <Link href={href} className="text-body text-greige hover:text-onyx transition-colors">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {(settings.supportEmail || settings.supportPhone) && (
          <div className="mt-12 flex flex-wrap gap-x-8 gap-y-2">
            {settings.supportEmail && (
              <a href={`mailto:${settings.supportEmail}`} className="link text-body">
                {settings.supportEmail}
              </a>
            )}
            {settings.supportPhone && (
              <a href={`tel:${settings.supportPhone.replace(/\s/g, '')}`} className="link text-body">
                {settings.supportPhone}
              </a>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-rule">
        <div className="shell flex flex-col justify-between gap-3 py-6 sm:flex-row">
          <p className="text-label text-quiet">
            © {year} {settings.storeName}
          </p>
          <p className="text-label text-quiet">
            Prices in {settings.baseCurrency}. Secure checkout.
          </p>
        </div>
      </div>
    </footer>
  );
}
