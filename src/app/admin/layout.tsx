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
  ['/admin/settings', 'Settings'],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // middleware.ts has already rejected unauthenticated requests to every admin
  // route except the login page, so a missing session here means "login page".
  const session = await getSession();
  if (!session) return <>{children}</>;

  return (
    <div className="container-x py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Store admin</h1>
          <p className="text-xs text-mut">Signed in as {session.email}</p>
        </div>
        <form action="/api/admin/logout" method="post">
          <button type="submit" className="btn-ghost text-xs">
            Sign out
          </button>
        </form>
      </div>

      <nav className="scroll-x mb-8 flex gap-2 border-b border-line pb-3">
        {NAV.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="shrink-0 rounded-lg px-3.5 py-2 text-sm text-mut transition hover:bg-white/5 hover:text-ink"
          >
            {label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
