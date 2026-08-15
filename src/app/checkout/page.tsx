import Link from 'next/link';
import { CheckoutForm } from '@/components/CheckoutForm';
import { hydrateCart, readCart } from '@/lib/cart';
import { isPaypalConfigured } from '@/lib/payments/paypal';
import { isPaystackConfigured } from '@/lib/payments/paystack';
import { getStoreSettings } from '@/lib/settings';

export const metadata = { title: 'Checkout' };
export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const [cart, settings] = await Promise.all([hydrateCart(await readCart()), getStoreSettings()]);

  if (cart.itemCount === 0) {
    return (
      <div className="container-x py-20">
        <div className="panel mx-auto max-w-md space-y-4 p-10 text-center">
          <h1 className="text-xl font-bold">Nothing to check out</h1>
          <p className="text-sm text-mut">Your cart is empty.</p>
          <Link href="/collections/all" className="btn-primary">
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-x py-12">
      <h1 className="mb-8 text-3xl font-extrabold tracking-tight">Checkout</h1>
      <CheckoutForm
        cart={cart}
        baseCurrency={settings.baseCurrency}
        paystackEnabled={isPaystackConfigured()}
        paypalEnabled={isPaypalConfigured()}
      />
    </div>
  );
}
