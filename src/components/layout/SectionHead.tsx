import Link from 'next/link';

/**
 * Section heading: brass hairline, wide-tracked eyebrow, serif title, and an
 * optional text link aligned to the baseline. Used everywhere so section
 * rhythm is identical across the storefront.
 */
export function SectionHead({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <hr className="rule-gold" />
        <p className="label mt-4">{eyebrow}</p>
        <h2 className="display-m mt-2">{title}</h2>
      </div>

      {action && (
        <Link href={action.href} className="link text-label pb-1">
          {action.label}
        </Link>
      )}
    </div>
  );
}
