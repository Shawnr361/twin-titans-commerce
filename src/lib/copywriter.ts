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
const MAX_TOKENS = 3000;
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
- Never infer one fact from another. "Cordless" does not tell you how it charges — do not write "charge over USB". "Slicer" does not tell you what the blades are made of. If a detail is not written in the title, it does not exist.
- Never invent claims about performance, safety, medical or cosmetic benefit.
- If the title is vague, write copy that stays vague rather than guessing.
- Do not pad. A bullet that would be true of almost any product ("suitable for various settings", "aids in everyday tasks") is worse than no bullet. Write fewer, truer points.
- Do not mention price, delivery, shipping, returns or payment — the page states those separately.
- Do not use the words "premium", "high-quality", "amazing", "perfect" or "must-have".
- British English. Plain, calm, concrete. No exclamation marks.
- Do not restate the title. The title is printed directly above your text on the page, so repeating it wastes the only space you have. No bullet may reuse a phrase from the title.

FORMAT — return only HTML, no markdown fence, no commentary:
- One <p> of 2–3 sentences: what the thing is, and the everyday situation it suits.
- Then <ul> with 2–4 <li> points about LIVING WITH it, not about what it is: when or where you would reach for it, who it suits, what it saves you doing, how to keep it in good order. Each 6–12 words.
- Where options are given, one bullet may mention that a choice of colour or style is available — never name a colour that was not listed.
- Aim for 450–700 characters in total.
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

  if (provider === 'openrouter') return viaOpenRouter(facts, input.title);

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

    const html = sanitise(text, input.title);
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
 * Words that assert a specification. Each is allowed ONLY if the supplier
 * title actually contains it.
 *
 * Prompting alone does not hold. The rule was stated plainly, then restated
 * naming this exact failure ("cordless does not tell you how it charges"), and
 * the model still published "Recharges via USB for ease" for a clipper whose
 * title says nothing about charging. The store's terms commit us to accurate
 * descriptions, so a claim like that is a return we would have to honour.
 *
 * Deliberately narrow: materials, power, connectivity, certification and
 * measurement. Ordinary use-language ("for salads", "keep clean") is what the
 * copy is supposed to be made of and must survive.
 */
const SPEC_WORDS = [
  'usb', 'rechargeable', 'recharge', 'recharges', 'recharging', 'charge', 'charges',
  'charging', 'battery', 'batteries', 'mains', 'plug', 'bluetooth', 'wireless', 'wifi',
  'waterproof', 'water-resistant', 'dishwasher', 'microwave', 'stainless', 'steel',
  'aluminium', 'aluminum', 'silicone', 'plastic', 'ceramic', 'leather', 'cotton',
  'bamboo', 'glass', 'rubber', 'bpa', 'warranty', 'guarantee', 'certified', 'waterproofing',
];

/** A number joined to a unit — "500ml", "20 cm", "2000mAh" — is a measurement. */
const MEASUREMENT = /\b\d+(?:\.\d+)?\s?(?:ml|l|cl|cm|mm|m|in|inch|inches|ft|kg|g|mg|w|v|mah|hz|rpm)\b/i;

function assertsUnsupportedSpec(text: string, title: string): boolean {
  const lower = text.toLowerCase();
  const inTitle = title.toLowerCase();
  if (MEASUREMENT.test(text) && !MEASUREMENT.test(title)) return true;
  return SPEC_WORDS.some(
    (w) => new RegExp(`\\b${w}\\b`, 'i').test(lower) && !inTitle.includes(w)
  );
}

/**
 * Remove any sentence or bullet that asserts something the title never said.
 *
 * Stripping rather than rejecting the whole answer: one bad bullet out of four
 * is a bullet to drop, not a reason to spend another model call. If the opening
 * paragraph does not survive, there is no description left worth writing and
 * the caller is told nothing came back.
 */
export function stripInventedClaims(html: string, title: string): string | null {
  const para = /<p>([\s\S]*?)<\/p>/i.exec(html);
  if (!para) return null;

  const kept = htmlToText(para[1])
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.trim() && !assertsUnsupportedSpec(sentence, title));
  if (kept.length === 0) return null;

  const bullets = [...html.matchAll(/<li>([\s\S]*?)<\/li>/gi)]
    .map((m) => m[1].trim())
    .filter((b) => b && !assertsUnsupportedSpec(htmlToText(b), title));

  return [
    `<p>${kept.join(' ')}</p>`,
    bullets.length ? `<ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>` : '',
  ]
    .join('')
    .trim();
}

/**
 * Keep only the tags the product page renders, and reject anything that came
 * back as prose instead of HTML.
 *
 * The page injects this with dangerouslySetInnerHTML, so a stray <script> or an
 * onerror attribute would execute. Stripping to a fixed tag set is the only
 * safe way to accept generated markup.
 */
function sanitise(html: string, title: string): string | null {
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

  const honest = stripInventedClaims(stripped, title);
  if (!honest || htmlToText(honest).length < 40) return null;
  return honest;
}

/**
 * Write a description for one product, if it has none.
 *
 * Never overwrites existing copy: a merchant who wrote their own outranks a
 * generated paragraph, and re-running the backfill must be safe.
 */
export async function ensureDescription(
  productId: string,
  /*
   * Replace copy that is already there.
   *
   * Off by default and deliberately awkward to reach: publishing calls this on
   * every product, and copy a human has edited must survive that. It exists
   * because a bad prompt can put a wrong fact on a live page — the first run
   * here claimed a clipper charged over USB, which the title never said — and
   * without this there is no way to take that back.
   */
  rewrite = false
): Promise<{
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
  if (!rewrite && htmlToText(product.descriptionHtml ?? '').length > 40) {
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
async function viaOpenRouter(
  facts: string,
  title: string
): Promise<{ html: string | null; error?: string }> {
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
      choices?: Array<{
        message?: { content?: string; reasoning?: string };
        finish_reason?: string;
      }>;
      error?: { message?: string };
    } | null;

    if (!res.ok) {
      const detail = body?.error?.message ?? `HTTP ${res.status}`;
      return { html: null, error: `OpenRouter (${model}): ${String(detail).slice(0, 160)}` };
    }

    const choice = body?.choices?.[0];
    const text = choice?.message?.content?.trim() ?? '';
    if (!text) {
      /*
       * Reasoning models put their chain of thought in `reasoning` and the
       * answer in `content`. Given a small budget they spend it all thinking
       * and return an empty answer — which looks like a broken integration
       * unless the reason is named. finish_reason "length" says exactly that.
       */
      const reasoned = (choice?.message?.reasoning ?? '').length;
      const why = reasoned
        ? `it is a reasoning model and spent the ${MAX_TOKENS}-token budget thinking (${reasoned} chars of reasoning, finish_reason=${choice?.finish_reason})`
        : `finish_reason=${choice?.finish_reason ?? 'unknown'}`;
      return {
        html: null,
        error: `OpenRouter (${model}) returned no content — ${why}. Try a plain instruct model.`,
      };
    }

    const html = sanitise(text, title);
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
