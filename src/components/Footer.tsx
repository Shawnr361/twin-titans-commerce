import Link from 'next/link';
import { getStoreSettings } from '@/lib/settings';

export async function Footer() {
  const settings = await getStoreSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-line/70 bg-black/30">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <span className="text-sm font-bold">{settings.storeName}</span>
          <p className="text-sm leading-relaxed text-mut">{settings.tagline}</p>
        </div>

        <div className="space-y-2.5 text-sm">
          <span className="label">Shop</span>
          <Link href="/collections/all" className="block text-mut transition hover:text-ink">
            All products
          </Link>
          <Link href="/cart" className="block text-mut transition hover:text-ink">
            Cart
          </Link>
          <Link href="/orders/track" className="block text-mut transition hover:text-ink">
            Track my order
          </Link>
        </div>

        <div className="space-y-2.5 text-sm">
          <span className="label">Help</span>
          <Link href="/pages/shipping" className="block text-mut transition hover:text-ink">
            Shipping &amp; delivery
          </Link>
          <Link href="/pages/returns" className="block text-mut transition hover:text-ink">
            Returns &amp; refunds
          </Link>
          <Link href="/pages/contact" className="block text-mut transition hover:text-ink">
            Contact us
          </Link>
        </div>

        <div className="space-y-2.5 text-sm">
          <span className="label">Get in touch</span>
          {settings.supportEmail && (
            <a
              href={`mailto:${settings.supportEmail}`}
              className="block text-mut transition hover:text-ink"
            >
              {settings.supportEmail}
            </a>
          )}
          {settings.supportPhone && (
            <a
              href={`tel:${settings.supportPhone.replace(/\s/g, '')}`}
              className="block text-mut transition hover:text-ink"
            >
              {settings.supportPhone}
            </a>
          )}
        </div>
      </div>

      <div className="border-t border-line/70">
        <div className="container-x flex flex-col items-center justify-between gap-3 py-6 text-xs text-mut sm:flex-row">
          <span>
            © {year} {settings.storeName}. All rights reserved.
          </span>
          <div className="flex gap-5">
            <Link href="/pages/privacy" className="transition hover:text-ink">
              Privacy
            </Link>
            <Link href="/pages/terms" className="transition hover:text-ink">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
