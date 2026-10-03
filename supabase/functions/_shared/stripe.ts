/**
 * The payment provider, as the three things Semester needs from it: check a
 * webhook's signature, read an event into a payment kind, and open a hosted
 * checkout page. No SDK: two `fetch`-shaped calls and Web Crypto.
 *
 * ## The signature
 *
 * Stripe signs every webhook with the endpoint's secret:
 *
 *     Stripe-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256>[,v1=…][,v0=…]
 *     v1 = HMAC-SHA256(secret, `${t}.${rawBody}`)
 *
 * The body is signed as bytes, so it is verified **before** it is parsed —
 * re-serialising parsed JSON changes whitespace and key order and would fail
 * every genuine event. A timestamp more than five minutes from now is refused,
 * so a captured event cannot be replayed later; any `v1` may match (Stripe
 * sends two while a secret is being rolled); and the comparison takes the same
 * time however many characters agree.
 *
 * ## Deno-free on purpose
 *
 * Like `cors.ts`, nothing here reads `Deno.env`, so
 * `app/src/lib/billing/stripe.test.ts` drives it under vitest.
 */

/** Five minutes, Stripe's own default tolerance. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

const enc = new TextEncoder();

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 of a string, as lowercase hex: the webhook body's fingerprint. */
export async function sha256Hex(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

/** HMAC-SHA256 of `message` under `key`, as lowercase hex. */
export async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(message)));
}

/**
 * Equal strings, compared in time that depends only on their length. Lengths
 * are public here (a v1 is always 64 hex characters), so an early return on a
 * length mismatch leaks nothing.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The parts of a `Stripe-Signature` header, or null when it has no timestamp or no v1. */
export function parseSignatureHeader(header: string | null | undefined): { t: number; v1: string[] } | null {
  if (!header) return null;
  let t = NaN;
  const v1: string[] = [];
  for (const part of header.split(',')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === 't' && /^\d{1,12}$/.test(v)) t = Number(v);
    else if (k === 'v1' && /^[0-9a-f]{64}$/.test(v)) v1.push(v);
  }
  return Number.isFinite(t) && v1.length > 0 ? { t, v1 } : null;
}

export type SignatureVerdict = 'ok' | 'missing' | 'stale' | 'mismatch';

/** Whether `rawBody` was signed by the holder of `secret`, within the tolerance. */
export async function verifySignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  nowSeconds: number,
  toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS,
): Promise<SignatureVerdict> {
  const parsed = parseSignatureHeader(header);
  if (!parsed) return 'missing';
  if (Math.abs(nowSeconds - parsed.t) > toleranceSeconds) return 'stale';
  const expected = await hmacSha256Hex(secret, `${parsed.t}.${rawBody}`);
  let match = false;
  // Every candidate is compared, so the time taken does not say which matched.
  for (const candidate of parsed.v1) if (timingSafeEqual(candidate, expected)) match = true;
  return match ? 'ok' : 'mismatch';
}

/** The payment kinds `apply_payment_event` records. */
export type PaymentKind = 'payment_succeeded' | 'payment_failed' | 'address_required' | 'refund' | 'chargeback' | 'other';

/** The subscription statuses Semester's `subscriptions.status` allows. */
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'grace' | 'canceled' | 'ended';

/** A provider subscription status, in Semester's vocabulary. */
export function mapSubscriptionStatus(status: unknown): SubscriptionStatus | null {
  switch (status) {
    case 'trialing': return 'trialing';
    case 'active': return 'active';
    case 'past_due':
    case 'unpaid':
    case 'incomplete': return 'past_due';
    case 'paused': return 'canceled';
    case 'canceled':
    case 'incomplete_expired': return 'ended';
    default: return null;
  }
}

/** Seconds since the epoch to ISO, or null. */
export function isoFromSeconds(v: unknown): string | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? new Date(v * 1000).toISOString() : null;
}

/** Form-encode nested parameters the way Stripe's API reads them (`a[b][c]=v`). */
export function formEncode(params: Record<string, unknown>, prefix = ''): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') {
      const nested = formEncode(v as Record<string, unknown>, key);
      if (nested) out.push(nested);
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out.join('&');
}

export const STRIPE_API = 'https://api.stripe.com/v1';
