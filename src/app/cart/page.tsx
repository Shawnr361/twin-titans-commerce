import Link from 'next/link';
import { CartTable } from '@/components/CartTable';
import { hydrateCart, readCart } from '@/lib/cart';

export const metadata = { title: 'Your cart' };
export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const cart = await hydrateCart(await readCart());

  return (
    <div className="container-x py-12">
      <h1 className="mb-8 text-3xl font-extrabold tracking-tight">Your cart</h1>

      {cart.lines.length === 0 ? (
        <div className="panel space-y-4 p-12 text-center">
          <p className="text-sm text-mut">Your cart is empty.</p>
          <Link href="/collections/all" className="btn-primary">
            Start shopping
          </Link>
        </div>
      ) : (
        <CartTable initial={cart} />
      )}
    </div>
  );
}
