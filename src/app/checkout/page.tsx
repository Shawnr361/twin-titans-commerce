import Link from 'next/link';
import { CheckoutForm } from '@/components/commerce/CheckoutForm';
import { hydrateCart, readCart } from '@/lib/cart';
import { isPaypalConfigured } from '@/lib/payments/paypal';
import { isFlutterwaveConfigured } from '@/lib/payments/flutterwave';
import { getStoreSettings } from '@/lib/settings';

export const metadata = { title: 'Checkout', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const [cart, settings] = await Promise.all([hydrateCart(await readCart()), getStoreSettings()]);

  if (cart.itemCount === 0) {
    return (
      <div className="shell py-24">
        <div className="max-w-text">
          <hr className="rule-gold" />
          <h1 className="display-m mt-5">Nothing to check out</h1>
          <p className="mt-4 text-body text-greige">Your bag is empty.</p>
          <Link href="/collections/all" className="btn btn-primary mt-8">
            View the catalogue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="shell py-16 md:py-20">
      <hr className="rule-gold" />
      <h1 className="display-l mt-5">Checkout</h1>

      <div className="mt-12">
        <CheckoutForm
          cart={cart}
          flutterwaveEnabled={isFlutterwaveConfigured()}
          paypalEnabled={isPaypalConfigured()}
        />
      </div>
    </div>
  );
}
