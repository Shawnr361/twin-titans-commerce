import { fromMinor, toMinor } from '../money';

/**
 * PayPal — the international rail.
 *
 * Hard platform limit, not a config problem: PayPal cannot process NGN at all.
 * So a Nigerian-priced order is converted to USD at checkout time and the buyer
 * is charged USD. The order still records NGN as its base currency; the USD
 * figure is presentment only.
 */

function env() {
  const live = (process.env.PAYPAL_ENV ?? 'sandbox').toLowerCase() === 'live';
  return {
    base: live ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
    clientId: process.env.PAYPAL_CLIENT_ID ?? '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? '',
  };
}

export function isPaypalConfigured(): boolean {
  const { clientId, clientSecret } = env();
  return Boolean(clientId && clientSecret);
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;

  const { base, clientId, clientSecret } = env();
  if (!clientId || !clientSecret) throw new Error('PayPal credentials are not configured.');

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`PayPal auth failed (HTTP ${res.status}).`);

  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const { base } = env();
  const res = await fetch(base + path, {
    ...init,
    headers: {
      authorization: `Bearer ${await accessToken()}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(body?.message || `PayPal returned HTTP ${res.status}.`);
  }
  return body as T;
}

export interface PaypalOrder {
  id: string;
  status: string;
  links?: { href: string; rel: string; method: string }[];
}

export function createPaypalOrder(params: {
  amountMinorUsd: number;
  reference: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<PaypalOrder> {
  return call<PaypalOrder>('/v2/checkout/orders', {
    method: 'POST',
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: params.reference,
          custom_id: params.reference,
          description: params.description.slice(0, 127),
          amount: {
            currency_code: 'USD',
            value: fromMinor(params.amountMinorUsd, 'USD').toFixed(2),
          },
        },
      ],
      application_context: {
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
      },
    }),
  });
}

export interface CaptureResult {
  id: string;
  status: string;
  purchase_units?: {
    custom_id?: string;
    payments?: {
      captures?: {
        id: string;
        status: string;
        amount: { currency_code: string; value: string };
        seller_receivable_breakdown?: { paypal_fee?: { value: string } };
      }[];
    };
  }[];
}

export async function capturePaypalOrder(paypalOrderId: string): Promise<{
  captureId: string;
  status: string;
  amountMinorUsd: number;
  feeMinorUsd: number;
  reference: string | null;
  raw: CaptureResult;
}> {
  const result = await call<CaptureResult>(`/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    body: '{}',
  });

  const unit = result.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  if (!capture) throw new Error('PayPal returned no capture record.');

  return {
    captureId: capture.id,
    status: capture.status,
    amountMinorUsd: toMinor(capture.amount.value, 'USD'),
    feeMinorUsd: toMinor(capture.seller_receivable_breakdown?.paypal_fee?.value ?? '0', 'USD'),
    reference: unit?.custom_id ?? null,
    raw: result,
  };
}
