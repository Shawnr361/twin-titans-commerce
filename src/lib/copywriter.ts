import Anthropic from '@anthropic-ai/sdk';
import { formatMoney } from './money';
import { htmlToText } from './seo';

/**
 * Product copy, written at publish time.
 *
 * WHY THIS EXISTS
 * ---------------
 * Imported products arrive with an empty descriptionHtml, so every product page
 * carried nothing but a supplier title — and the meta description, the share
 * card and the JSON-LD all fell back to repeating that title. A description
 * identical to the title tells a search engine nothing it does not already know.
 *
 * WHY A DEPENDENCY IS SAFE HERE
 * -----------------------------
 * The deploy ships only `.next` and never runs an install, which previously led
 * me to avoid new packages entirely. That was over-cautious: Next BUNDLES
 * ordinary packages into the route output — `zod` appears inlined, while
 * `@prisma/client` is the exception that stays a runtime require() because Next
 * externalises it for its binary engines. The SDK bundles like zod.
 *
 * WHAT IT MAY AND MAY NOT SAY
 * ---------------------------
 * All we genuinely know is the title, the option names, and the price. The
 * prompt is therefore built around a refusal to invent: no materials, no
 * measurements, no battery life, no certifications, no country of origin, no
 * claims about what is in the box. Those are exactly the details a supplier
 * title implies but does not establish, and the terms page commits us to
 * describing products accurately — copy that invents a spec is a
 * misdescription we would have to honour a return on.
 */

/** Roughly the longest copy that still reads as a product blurb. */
const MAX_TOKENS = 1200;
/** Publishing must not hang on this. */
const TIMEOUT_MS = 25_000;

export interface CopyInput {
  title: string;
  /** Option values actually offered, e.g. ["Pink", "Gray"]. */
  options: string[];
  /** Collection handle, when the product has been filed. */
  category?: string | null;
  priceMinor: number;
  currency: string;
}

export function isCopywriterConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM = `You write product descriptions for Twin Titans Emporium, an online shop in Nigeria.

You will be given only a supplier's product title, the options it comes in, and its price. That is genuinely all that is known about the product.

RULES — these matter more than style:
- Never state a fact you were not given. No materials, dimensions, weights, capacities, battery life, wattage, certifications, brand names, country of origin, or contents of the box.
- Never invent claims about performance, safety, medical or cosmetic benefit.
- If the title is vague, write copy that stays vague rather than guessing.
- Do not mention price, delivery, shipping, returns or payment — the page states those separately.
- Do not use the words "premium", "high-quality", "amazing", "perfect" or "must-have".
- British English. Plain, calm, concrete. No exclamation marks.

FORMAT — return only HTML, no markdown fence, no commentary:
- One <p> of 2–3 sentences saying what the thing is and who it suits.
- Then <ul> with 3–4 <li> points, each a short phrase drawn from what the title actually says.
Nothing else.`;

/**
 * Deterministic copy for when no API key is configured.
 *
 * Deliberately plain. It exists so publishing never depends on a network call
 * and never leaves a product with no description at all — not to be good copy.
 */
export function fallbackDescription(input: CopyInput): string {
  const opts = input.options.filter(Boolean).slice(0, 6);
  const bullets = [
    opts.length > 1 ? `Available in ${opts.length} options` : null,
    'Checked before dispatch',
    'Tracked delivery across Nigeria',
  ].filter(Boolean) as string[];

  return [
    `<p>${escapeHtml(input.title)}.</p>`,
    '<ul>',
    ...bullets.map((b) => `<li>${escapeHtml(b)}</li>`),
    '</ul>',
  ].join('');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Write a description. Returns null when nothing usable came back.
 *
 * Never throws: a publish must not fail because copy generation did.
 */
export async function generateDescription(input: CopyInput): Promise<string | null> {
  if (!isCopywriterConfigured()) return fallbackDescription(input);

  const client = new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 1 });

  const facts = [
    `Title: ${input.title}`,
    input.options.length ? `Options: ${input.options.slice(0, 12).join(', ')}` : 'Options: none',
    input.category ? `Category: ${input.category.replace(/-/g, ' ')}` : null,
    `Price: ${formatMoney(input.priceMinor, input.currency)}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: MAX_TOKENS,
      /*
       * Low effort, thinking left at its default. This is short copy from a
       * handful of facts, and publishing waits on the call — but thinking is
       * NOT disabled, because on Opus 5 disabling it can leak reasoning into
       * the visible text, which here would be published as product copy.
       */
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [{ role: 'user', content: facts }],
    });

    if (response.stop_reason === 'refusal') return null;

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    return sanitise(text);
  } catch (err) {
    // Typed classes rather than message matching; a failure is never fatal.
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('[copywriter] ANTHROPIC_API_KEY rejected');
    } else if (err instanceof Anthropic.RateLimitError) {
      console.error('[copywriter] rate limited');
    } else if (err instanceof Anthropic.APIError) {
      console.error(`[copywriter] API error ${err.status}`);
    } else {
      console.error('[copywriter] failed:', err);
    }
    return null;
  }
}

/**
 * Keep only the tags the product page renders, and reject anything that came
 * back as prose instead of HTML.
 *
 * The page injects this with dangerouslySetInnerHTML, so a stray <script> or an
 * onerror attribute would execute. Stripping to a fixed tag set is the only
 * safe way to accept generated markup.
 */
function sanitise(html: string): string | null {
  const stripped = html
    .replace(/```html?/gi, '')
    .replace(/```/g, '')
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?(?!p\b|ul\b|li\b|strong\b|em\b)[a-z][^>]*>/gi, '')
    // Any attribute at all: none of the permitted tags need one, and this is
    // what closes off onerror/onclick/href-javascript in one move.
    .replace(/<(p|ul|li|strong|em)\s[^>]*>/gi, '<$1>')
    .trim();

  // A model that answered in prose gives no tags; that is not usable copy.
  if (!stripped.includes('<p>') || htmlToText(stripped).length < 40) return null;
  return stripped;
}

/**
 * Write a description for one product, if it has none.
 *
 * Never overwrites existing copy: a merchant who wrote their own outranks a
 * generated paragraph, and re-running the backfill must be safe.
 */
export async function ensureDescription(productId: string): Promise<{
  written: boolean;
  reason?: string;
  chars?: number;
}> {
  const { prisma } = await import('./db');

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      descriptionHtml: true,
      variants: { select: { title: true, priceMinor: true } },
      collections: { select: { collection: { select: { handle: true } } } },
    },
  });
  if (!product) return { written: false, reason: 'product not found' };
  if (htmlToText(product.descriptionHtml ?? '').length > 40) {
    return { written: false, reason: 'already has copy' };
  }

  const cheapest = product.variants.reduce(
    (low, v) => (v.priceMinor > 0 && (low === 0 || v.priceMinor < low) ? v.priceMinor : low),
    0
  );

  const html = await generateDescription({
    title: product.title,
    // "Default" is the placeholder for a single-variant product, not a choice.
    options: product.variants
      .map((v) => v.title.replace(/^[^:]+:\s*/, '').trim())
      .filter((t) => t && t.toLowerCase() !== 'default'),
    category: product.collections[0]?.collection.handle ?? null,
    priceMinor: cheapest,
    currency: 'NGN',
  });

  if (!html) return { written: false, reason: 'no usable copy returned' };

  await prisma.product.update({
    where: { id: product.id },
    data: { descriptionHtml: html },
  });
  return { written: true, chars: html.length };
}
