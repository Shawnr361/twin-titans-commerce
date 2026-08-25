import crypto from 'node:crypto';

/**
 * Paystack — the NGN rail (cards, bank transfer, USSD).
 *
 * Paystack amounts are in kobo, which is already our minor-unit convention, so
 * no conversion happens here. If that ever changes, change it in ONE place.
 */

const API = 'https://api.paystack.co';

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not configured.');
  return key;
}

/**
 * Paystack is configured once the secret key is present — and nothing else.
 *
 * This used to also require NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY, which no code in
 * this app ever reads: the whole flow is server-side (initialize -> redirect to
 * Paystack's hosted page -> verify), so the browser never needs a public key.
 * Worse, NEXT_PUBLIC_* is inlined at BUILD time, so that gate made switching
 * payments on require a rebuild rather than an env var and a restart. Requiring
 * a key nothing consumes is a checkout that stays dark for no reason.
 */
export function isPaystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
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
  const body = (await res.json()) as { status: boolean; message: string; data: T };
  if (!res.ok || !body.status) {
    throw new Error(body?.message || `Paystack returned HTTP ${res.status}.`);
  }
  return body.data;
}

export interface InitTransactionResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export function initTransaction(params: {
  email: string;
  amountMinor: number;
  reference: string;
  callbackUrl: string;
  currency?: string;
  metadata?: Record<string, unknown>;
}): Promise<InitTransactionResult> {
  return call<InitTransactionResult>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: params.email,
      amount: params.amountMinor,
      reference: params.reference,
      callback_url: params.callbackUrl,
      currency: params.currency ?? 'NGN',
      metadata: params.metadata ?? {},
    }),
  });
}

export interface VerifyResult {
  status: string; // 'success' | 'failed' | 'abandoned'
  reference: string;
  amount: number;
  currency: string;
  fees: number | null;
  paid_at: string | null;
  metadata: Record<string, unknown> | null;
  customer: { email: string } | null;
}

export function verifyTransaction(reference: string): Promise<VerifyResult> {
  return call<VerifyResult>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

/**
 * Validate a webhook body against the x-paystack-signature header.
 *
 * The RAW request body must be passed in — re-serialising parsed JSON changes
 * key order and whitespace, and the HMAC will never match.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac('sha512', secretKey()).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
