import { SharedLinkImport } from '@/components/admin/SharedLinkImport';

export const dynamic = 'force-dynamic';

/**
 * Where the Android share sheet delivers a link.
 *
 * FINDING THE LINK IS THE WHOLE JOB
 * ---------------------------------
 * Android decides for itself which field a share lands in, and apps disagree.
 * AliExpress typically sends the product title and the URL together in `text`,
 * with `url` empty; other apps use `url` properly. So all three fields are
 * searched for something that looks like a link, rather than trusting any one
 * of them — a share that arrives and does nothing is the failure mode to avoid.
 *
 * Short links (a.aliexpress.com, s.click.aliexpress.com) are passed through
 * untouched: the importer already resolves and canonicalises them, and a second
 * opinion here would only be a second thing to keep in step.
 */
function linkFrom(params: Record<string, string | string[] | undefined>): string | null {
  const values = ['url', 'text', 'title']
    .map((key) => params[key])
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
    .filter((v): v is string => typeof v === 'string' && v.length > 0);

  for (const value of values) {
    const match = value.match(/https?:\/\/\S+/);
    if (match) return match[0];
    // A bare product id is a legitimate share from a copy-paste.
    if (/^\d{6,}$/.test(value.trim())) return value.trim();
  }
  return null;
}

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const link = linkFrom(params);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="font-display text-d3 text-onyx">Shared from AliExpress</h2>
        <p className="max-w-2xl text-body text-greige">
          The link is fetched straight from the API — variants, prices, images and video — and
          waits in your import queue until you price it.
        </p>
      </header>

      <SharedLinkImport link={link} />
    </div>
  );
}
