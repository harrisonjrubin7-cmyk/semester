/**
 * Inbound webhooks: prove the sender, drop the replay, keep the payload out of
 * the database.
 *
 * The scheme is the common one — `v1=<hex>` is HMAC-SHA256 over
 * `<timestamp>.<raw body>` — because it is what providers actually send, and a
 * provider that signs differently gets its own verifier beside this one, not a
 * flag on it. The raw body is signed, so callers must hand over the bytes they
 * received and not a re-serialised parse.
 *
 * What it guarantees:
 *
 *  - A signature from **any** configured secret passes, so a provider can rotate
 *    with both secrets live; one with a `notAfter` in the past does not.
 *  - A timestamp outside the tolerance window, in either direction, is refused,
 *    which bounds how long a captured delivery can be replayed.
 *  - The same delivery id is accepted once per connection. The second arrival is
 *    `duplicate` and carries no side effect. The ledger's unique constraint on
 *    `(connection_id, idempotency_key)` is the backstop; this is the fast path.
 *  - Every rejection is the same answer to the caller. Which check failed goes
 *    to the operator's log, not back to a sender who may be probing.
 *
 * The row it returns is shaped for `integration_webhook_events`: a hash and a
 * type, never the payload.
 */
import { constantTimeEqual, hmacSha256Hex } from './crypto.ts';
import { payloadHash } from './redact.ts';

export interface WebhookSecret {
  id: string;
  secret: string;
  notAfter?: Date;
}

export interface WebhookHeaders {
  signature: string | null;
  timestamp: string | null;
  deliveryId: string | null;
  eventType: string | null;
}

export type WebhookRejection =
  | 'too_large' | 'missing_header' | 'bad_timestamp' | 'stale_timestamp' | 'future_timestamp' | 'no_active_secret' | 'bad_signature' | 'bad_event_type';

export type Verification =
  | { ok: true; keyId: string; timestampMs: number }
  | { ok: false; reason: WebhookRejection };

export interface VerifyInput {
  rawBody: string;
  headers: WebhookHeaders;
  secrets: readonly WebhookSecret[];
  now: Date;
  /** Either direction. Default five minutes. */
  toleranceMs?: number;
  /** Default 1 MiB. */
  maxBytes?: number;
}

const DEFAULT_TOLERANCE_MS = 5 * 60_000;
const DEFAULT_MAX_BYTES = 1_048_576;

export async function verifyWebhook(input: VerifyInput): Promise<Verification> {
  const { rawBody, headers, now } = input;
  if (new TextEncoder().encode(rawBody).length > (input.maxBytes ?? DEFAULT_MAX_BYTES)) return { ok: false, reason: 'too_large' };
  if (!headers.signature || !headers.timestamp || !headers.deliveryId || !headers.eventType) return { ok: false, reason: 'missing_header' };
  if (!/^[A-Za-z0-9_.:-]{1,120}$/.test(headers.eventType)) return { ok: false, reason: 'bad_event_type' };

  // Seconds since the epoch, as providers send them.
  if (!/^\d{9,12}$/.test(headers.timestamp)) return { ok: false, reason: 'bad_timestamp' };
  const timestampMs = Number(headers.timestamp) * 1000;
  const tolerance = input.toleranceMs ?? DEFAULT_TOLERANCE_MS;
  const skew = now.getTime() - timestampMs;
  if (skew > tolerance) return { ok: false, reason: 'stale_timestamp' };
  if (-skew > tolerance) return { ok: false, reason: 'future_timestamp' };

  const live = input.secrets.filter((s) => !s.notAfter || s.notAfter.getTime() > now.getTime());
  if (live.length === 0) return { ok: false, reason: 'no_active_secret' };

  const offered = headers.signature.split(',').map((p) => p.trim()).filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (offered.length === 0) return { ok: false, reason: 'bad_signature' };

  // Check every secret against every offered signature without stopping at the
  // first hit, so the time taken does not say which secret matched.
  let matched: string | null = null;
  for (const s of live) {
    const expected = await hmacSha256Hex(s.secret, `${headers.timestamp}.${rawBody}`);
    for (const candidate of offered) {
      if (constantTimeEqual(candidate, expected) && matched === null) matched = s.id;
    }
  }
  return matched === null ? { ok: false, reason: 'bad_signature' } : { ok: true, keyId: matched, timestampMs };
}

/** What a sender is told. One answer per class, whatever the reason. */
export function httpStatusFor(reason: WebhookRejection): 401 | 413 {
  return reason === 'too_large' ? 413 : 401;
}

export interface WebhookLedger {
  /** Record the key for this connection; false when it was already there. */
  claim(connectionId: string, idempotencyKey: string): Promise<boolean>;
}

export interface WebhookEventRow {
  provider_event_id: string;
  event_type: string;
  event_version: string;
  idempotency_key: string;
  payload_hash: string;
  processing_status: 'received' | 'duplicate';
}

export type Acceptance =
  | { outcome: 'accepted' | 'duplicate'; row: WebhookEventRow; keyId: string }
  | { outcome: 'rejected'; reason: WebhookRejection; status: 401 | 413 };

export interface AcceptInput extends VerifyInput {
  connectionId: string;
  ledger: WebhookLedger;
  eventVersion?: string;
}

/** The delivery id when it fits the column; otherwise a key derived from the body. */
async function idempotencyKeyFor(deliveryId: string, rawBody: string): Promise<string> {
  if (/^[A-Za-z0-9_.:-]{8,200}$/.test(deliveryId)) return deliveryId;
  return `body-${(await payloadHash(rawBody)).slice('sha256:'.length, 'sha256:'.length + 40)}`;
}

export async function acceptWebhook(input: AcceptInput): Promise<Acceptance> {
  const verified = await verifyWebhook(input);
  if (!verified.ok) return { outcome: 'rejected', reason: verified.reason, status: httpStatusFor(verified.reason) };

  const { headers, rawBody, connectionId, ledger } = input;
  const idempotencyKey = await idempotencyKeyFor(headers.deliveryId as string, rawBody);
  const fresh = await ledger.claim(connectionId, idempotencyKey);
  const row: WebhookEventRow = {
    provider_event_id: (headers.deliveryId as string).slice(0, 200),
    event_type: headers.eventType as string,
    event_version: input.eventVersion ?? '1',
    idempotency_key: idempotencyKey,
    payload_hash: await payloadHash(rawBody),
    processing_status: fresh ? 'received' : 'duplicate',
  };
  return { outcome: fresh ? 'accepted' : 'duplicate', row, keyId: verified.keyId };
}

/** A ledger over a set, for tests and the sandbox. */
export function memoryLedger(): WebhookLedger & { keys: Set<string> } {
  const keys = new Set<string>();
  return {
    keys,
    async claim(connectionId, key) {
      const k = `${connectionId}\u0000${key}`;
      if (keys.has(k)) return false;
      keys.add(k);
      return true;
    },
  };
}
