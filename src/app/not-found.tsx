import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-x py-24">
      <div className="panel mx-auto max-w-md space-y-4 p-10 text-center">
        <p className="text-5xl font-black tracking-tight text-accent">404</p>
        <h1 className="text-xl font-bold">We can&apos;t find that page</h1>
        <p className="text-sm text-mut">
          It may have been moved or removed. Try the shop instead.
        </p>
        <Link href="/collections/all" className="btn-primary">
          Browse products
        </Link>
      </div>
    </div>
  );
}
