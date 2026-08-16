import Link from 'next/link';
import { CartTable } from '@/components/commerce/CartTable';
import { hydrateCart, readCart } from '@/lib/cart';

export const metadata = { title: 'Your bag', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const cart = await hydrateCart(await readCart());

  return (
    <div className="shell py-16 md:py-20">
      <hr className="rule-gold" />
      <h1 className="display-l mt-5">Your bag</h1>

      {cart.lines.length === 0 ? (
        <div className="mt-12 max-w-text">
          <p className="text-body text-greige">
            Your bag is empty.
          </p>
          <Link href="/collections/all" className="btn btn-primary mt-8">
            View the catalogue
          </Link>
        </div>
      ) : (
        <div className="mt-12">
          <CartTable initial={cart} />
        </div>
      )}
    </div>
  );
}
