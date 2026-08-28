import Link from 'next/link';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin', robots: { index: false, follow: false } };

const NAV = [
  ['/admin', 'Dashboard'],
  ['/admin/import', 'Import product'],
  ['/admin/products', 'Products'],
  ['/admin/orders', 'Orders'],
  ['/admin/fulfilment', 'Supplier queue'],
  ['/admin/margins', 'Margin audit'],
  ['/admin/reviews', 'Reviews'],
  ['/admin/subscribers', 'Mailing list'],
  ['/admin/settings', 'Settings'],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // middleware.ts has already rejected unauthenticated requests to every admin
  // route except the login page, so a missing session here means "login page".
  const session = await getSession();
  if (!session) return <>{children}</>;

  return (
    <div className="shell py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Store admin</h1>
          <p className="text-xs text-greige">Signed in as {session.email}</p>
        </div>
        <form action="/api/admin/logout" method="post">
          <button type="submit" className="btn btn-secondary text-xs">
            Sign out
          </button>
        </form>
      </div>

      <nav className="scroll-x mb-8 flex gap-2 border-b border-rule pb-3">
        {NAV.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="shrink-0 rounded-sm px-3.5 py-2 text-sm text-greige transition hover:bg-paper hover:text-onyx"
          >
            {label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
