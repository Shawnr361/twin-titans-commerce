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

/**
 * Default OpenRouter model.
 *
 * A free-tier id, overridable with OPENROUTER_MODEL. Free ids are renamed and
 * retired regularly, so treat a 404 here as "pick another model", not a bug.
 */
const DEFAULT_OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

export interface CopyInput {
  title: string;
  /** Option values actually offered, e.g. ["Pink", "Gray"]. */
  options: string[];
  /** Collection handle, when the product has been filed. */
  category?: string | null;
  priceMinor: number;
  currency: string;
}

/**
 * Which provider will be used, if any.
 *
 * OpenRouter wins when its key is present: it is the cheaper route and offers
 * free models, so a store backfilling a whole catalogue should not have to
 * remove the Anthropic key to stop paying for it. Anthropic remains the
 * fallback so switching back is a config change, not a code change.
 */
export function copywriterProvider(): 'openrouter' | 'anthropic' | null {
  if (process.env.OPENROUTER_API_KEY?.trim()) return 'openrouter';
  if (process.env.ANTHROPIC_API_KEY?.trim()) return 'anthropic';
  return null;
}

export function isCopywriterConfigured(): boolean {
  return copywriterProvider() !== null;
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
 * Deterministic copy, for a caller that explicitly wants something rather than
 * nothing.
 *
 * NOT used automatically when the key is missing — see generateDescription for
 * why writing weak copy is worse than writing none.
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
export async function generateDescription(
  input: CopyInput
): Promise<{ html: string | null; error?: string }> {
  /*
   * No key means write NOTHING, not something weak.
   *
   * The fallback looked like a safe default until you follow it through:
   * ensureDescription never overwrites existing copy, so filling 54 products
   * with a title and three generic bullets would permanently block the real
   * copy from ever being written. An empty description is recoverable; a
   * mediocre one that blocks its own replacement is not — and the SEO layer
   * already composes a sensible meta description from the title regardless.
   */
  const provider = copywriterProvider();
  if (!provider) {
    return { html: null, error: 'no OPENROUTER_API_KEY or ANTHROPIC_API_KEY' };
  }

  const facts = [
    `Title: ${input.title}`,
    input.options.length ? `Options: ${input.options.slice(0, 12).join(', ')}` : 'Options: none',
    input.category ? `Category: ${input.category.replace(/-/g, ' ')}` : null,
    `Price: ${formatMoney(input.priceMinor, input.currency)}`,
  ]
    .filter(Boolean)
    .join('\n');

  if (provider === 'openrouter') return viaOpenRouter(facts);

  /*
   * An identity-linked API key is rejected with 400 "anthropic-workspace-id is
   * required" unless the workspace is named on every request. A plain
   * workspace-scoped key needs no header, so this is set only when present.
   */
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({
    timeout: TIMEOUT_MS,
    maxRetries: 1,
    ...(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {}),
  });

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

    if (response.stop_reason === 'refusal') {
      return { html: null, error: `refusal: ${response.stop_details?.category ?? 'unknown'}` };
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    const html = sanitise(text);
    /*
     * A rejected body is worth reporting verbatim-ish: it is almost always the
     * model answering in prose or markdown rather than the HTML asked for, and
     * that is a prompt problem, not an API problem.
     */
    return html
      ? { html }
      : { html: null, error: `unusable output: ${text.slice(0, 160).replace(/\s+/g, ' ')}` };
  } catch (err) {
    // Typed classes rather than message matching; a failure is never fatal.
    if (err instanceof Anthropic.AuthenticationError) {
      return { html: null, error: 'ANTHROPIC_API_KEY rejected' };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { html: null, error: 'rate limited' };
    }
    if (err instanceof Anthropic.APIError) {
      if (String(err.message).includes('anthropic-workspace-id')) {
        return {
          html: null,
          error:
            'The API key is identity-linked, so it needs a workspace. Set ' +
            'ANTHROPIC_WORKSPACE_ID in the app environment and restart, or use a ' +
            'workspace-scoped key instead.',
        };
      }
      return { html: null, error: `API ${err.status}: ${String(err.message).slice(0, 160)}` };
    }
    return { html: null, error: String(err).slice(0, 200) };
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

  const generated = await generateDescription({
    title: product.title,
    // "Default" is the placeholder for a single-variant product, not a choice.
    options: product.variants
      .map((v) => v.title.replace(/^[^:]+:\s*/, '').trim())
      .filter((t) => t && t.toLowerCase() !== 'default'),
    category: product.collections[0]?.collection.handle ?? null,
    priceMinor: cheapest,
    currency: 'NGN',
  });

  if (!generated.html) return { written: false, reason: generated.error ?? 'no copy returned' };

  await prisma.product.update({
    where: { id: product.id },
    data: { descriptionHtml: generated.html },
  });
  return { written: true, chars: generated.html.length };
}

/**
 * OpenRouter — an OpenAI-shaped endpoint in front of many models.
 *
 * Written with fetch rather than an SDK: this is one POST, and OpenRouter's
 * wire format is the OpenAI chat-completions shape, so a client library would
 * add a dependency for nothing.
 *
 * The model is configurable because OpenRouter's free tier changes: model ids
 * come and go, and a hard-coded one turns into a 404 nobody can fix without a
 * deploy. Set OPENROUTER_MODEL to whatever is currently free and good.
 */
async function viaOpenRouter(facts: string): Promise<{ html: string | null; error?: string }> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;

  /*
   * fetch has no timeout of its own, and publishing waits on this call — an
   * unbounded request would hang the publish rather than fail it.
   */
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: abort.signal,
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        // OpenRouter attributes usage to the calling site; harmless, and it
        // makes the dashboard readable.
        'http-referer': 'https://twintitanemporium.com',
        'x-title': 'Twin Titans Emporium',
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        // Copy, not reasoning: a little variation reads better than none.
        temperature: 0.7,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: facts },
        ],
      }),
    });

    const body = (await res.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    } | null;

    if (!res.ok) {
      const detail = body?.error?.message ?? `HTTP ${res.status}`;
      return { html: null, error: `OpenRouter (${model}): ${String(detail).slice(0, 160)}` };
    }

    const text = body?.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) return { html: null, error: `OpenRouter (${model}) returned no content` };

    const html = sanitise(text);
    /*
     * Free models follow formatting instructions less reliably than paid ones,
     * so a rejection here is expected often enough to be worth naming — it is
     * usually markdown or a preamble, which means try another model rather
     * than debug the code.
     */
    return html
      ? { html }
      : { html: null, error: `unusable output from ${model}: ${text.slice(0, 160).replace(/\s+/g, ' ')}` };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { html: null, error: `OpenRouter timed out after ${TIMEOUT_MS / 1000}s` };
    }
    return { html: null, error: String(err).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}
