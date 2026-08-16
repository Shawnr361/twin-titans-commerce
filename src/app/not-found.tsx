import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="shell py-32">
      <div className="max-w-text">
        <hr className="rule-gold" />
        <p className="label mt-5">Error 404</p>
        <h1 className="display-l mt-3">This page has moved on</h1>
        <p className="mt-5 text-body text-greige">
          The address may be mistyped, or the piece may no longer be available.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-5">
          <Link href="/collections/all" className="btn btn-primary">
            View the catalogue
          </Link>
          <Link href="/" className="link text-label">
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}
