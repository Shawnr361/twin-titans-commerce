import crypto from 'node:crypto';
import { fromMinor, toMinor } from '@/lib/money';

/**
 * Flutterwave — the NGN rail (cards, bank transfer, USSD), replacing Paystack.
 *
 * THE ONE THING TO GET RIGHT: UNITS
 * ---------------------------------
 * Paystack took amounts in kobo, which is this app's minor-unit convention, so
 * its adapter did no conversion at all. **Flutterwave takes MAJOR units** — a
 * ₦35,997 order is `amount: 35997`, not `3599700`. Passing minor units through
 * unchanged would charge a customer one hundred times the order total.
 *
 * So conversion happens HERE and nowhere else: every function in this file
 * takes and returns MINOR units, matching the rest of the app, and translates
 * at the API boundary. Callers must never do the arithmetic themselves.
 *
 * WHY THE WEBHOOK RE-VERIFIES
 * ---------------------------
 * Paystack signs the webhook body with an HMAC, so a valid signature proves
 * both the sender and that the body was not altered. Flutterwave instead sends
 * a STATIC shared secret in the `verif-hash` header — it identifies the sender
 * but says nothing about the body, so anyone who ever learns that string can
 * post an arbitrary "you were paid" payload. `verifyTransaction` therefore
 * re-reads the amount from Flutterwave's own API before any order is marked
 * paid, and the webhook trusts that rather than the body it was handed.
 */

const API = 'https://api.flutterwave.com/v3';

function secretKey(): string {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) throw new Error('FLUTTERWAVE_SECRET_KEY is not configured.');
  return key;
}

/**
 * Configured once the secret key is present — and nothing else.
 *
 * Deliberately does NOT require a public key. The whole flow is server-side
 * (create payment link -> redirect to Flutterwave -> verify), so the browser
 * never needs one, and NEXT_PUBLIC_* is inlined at BUILD time — gating checkout
 * on one would make switching payments on require a rebuild rather than an env
 * var and a restart.
 */
export function isFlutterwaveConfigured(): boolean {
  return Boolean(process.env.FLUTTERWAVE_SECRET_KEY);
}

interface Envelope<T> {
  status: string;
  message: string;
  data: T;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      authorization: `Bearer ${secretKey()}`,
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  const body = (await res.json().catch(() => null)) as Envelope<T> | null;

  if (!res.ok || body?.status !== 'success') {
    throw new Error(body?.message || `Flutterwave returned HTTP ${res.status}.`);
  }
  return body.data;
}

/**
 * Start a payment and get the hosted checkout link.
 *
 * `amountMinor` is in MINOR units like everything else in this app; it is
 * converted to the major units Flutterwave expects on the line below.
 */
export async function createPaymentLink(params: {
  email: string;
  name?: string;
  phone?: string;
  amountMinor: number;
  reference: string;
  redirectUrl: string;
  currency?: string;
  storeName?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ link: string }> {
  const currency = params.currency ?? 'NGN';

  return call<{ link: string }>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      tx_ref: params.reference,
      // MAJOR units. See the units note at the top of this file.
      amount: fromMinor(params.amountMinor, currency),
      currency,
      redirect_url: params.redirectUrl,
      customer: {
        email: params.email,
        ...(params.name ? { name: params.name } : {}),
        ...(params.phone ? { phonenumber: params.phone } : {}),
      },
      customizations: {
        title: params.storeName ?? 'Twin Titans Emporium',
      },
      meta: params.metadata ?? {},
    }),
  });
}

export interface VerifyResult {
  /** 'successful' | 'failed' | 'pending' — note: NOT Paystack's 'success'. */
  status: string;
  reference: string;
  /** MINOR units, converted from Flutterwave's major-unit response. */
  amountMinor: number;
  /** MINOR units. Flutterwave calls its cut `app_fee`. */
  feeMinor: number;
  currency: string;
  transactionId: number | null;
  metadata: Record<string, unknown> | null;
}

interface RawTransaction {
  id: number;
  tx_ref: string;
  status: string;
  currency: string;
  /** What the customer was charged, in MAJOR units. */
  charged_amount?: number;
  amount: number;
  app_fee?: number;
  meta?: Record<string, unknown> | null;
}

function shape(raw: RawTransaction): VerifyResult {
  const currency = raw.currency || 'NGN';
  return {
    status: raw.status,
    reference: raw.tx_ref,
    /*
     * `amount` is what the order was for; `charged_amount` can include
     * Flutterwave's fee when the merchant passes fees to the customer. The
     * order total is what must be compared against, so `amount` is the right
     * field — using charged_amount would let a fee-bearing payment look like an
     * overpayment.
     */
    amountMinor: toMinor(raw.amount, currency),
    feeMinor: raw.app_fee ? toMinor(raw.app_fee, currency) : 0,
    currency,
    transactionId: raw.id ?? null,
    metadata: (raw.meta ?? null) as Record<string, unknown> | null,
  };
}

/** Verify by Flutterwave's numeric transaction id (from the redirect). */
export async function verifyTransaction(transactionId: string | number): Promise<VerifyResult> {
  const raw = await call<RawTransaction>(
    `/transactions/${encodeURIComponent(String(transactionId))}/verify`
  );
  return shape(raw);
}

/**
 * Verify by our own tx_ref.
 *
 * Needed because the webhook and the redirect do not always agree on what they
 * carry: our reference is the one identifier we control and can always match
 * back to an order.
 */
export async function verifyByReference(reference: string): Promise<VerifyResult> {
  const raw = await call<RawTransaction>(
    `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`
  );
  return shape(raw);
}

/**
 * Check the `verif-hash` header against the configured secret hash.
 *
 * This is a plain shared-secret comparison, not a signature over the body —
 * see the note at the top of this file for why callers must still re-verify
 * the transaction against the API before trusting any amount.
 */
export function verifyWebhookHash(received: string | null): boolean {
  const expected = process.env.FLUTTERWAVE_WEBHOOK_HASH;
  if (!expected || !received) return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
