import type { Metadata, Viewport } from 'next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getStoreSettings } from '@/lib/settings';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3400';

  return {
    metadataBase: new URL(base),
    title: {
      default: `${settings.storeName} — ${settings.tagline}`,
      template: `%s · ${settings.storeName}`,
    },
    description: settings.tagline,
    openGraph: {
      type: 'website',
      siteName: settings.storeName,
      title: settings.storeName,
      description: settings.tagline,
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: '#080a12',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="relative z-10 flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
