/**
 * Provider-neutral verification at the inbound integration webhook boundary.
 *
 * This module deliberately stops before routing or ingestion: a deployed
 * endpoint must still resolve its connection and secret from trusted server
 * configuration, select a provider schema, and hand the accepted event to the
 * integration worker. The raw body is verified before JSON parsing.
 */
import { hmacSha256, timingSafeEqual, utf8 } from '../../../packages/platform/src/kernel/canonical.ts';

export const MAX_INTEGRATION_WEBHOOK_BYTES = 256 * 1024;
export const INTEGRATION_WEBHOOK_TOLERANCE_SECONDS = 300;

export interface IntegrationWebhookEvent {
  id: string;
  type: string;
  version?: string;
  data: Record<string, unknown>;
}

export interface WebhookReplayStore {
  /** Atomically returns true only for the first claim of this scoped event. */
  claim(key: string, expiresAtSeconds: number, nowSeconds: number): Promise<boolean>;
}

/** Test/single-process implementation. A deployed endpoint needs a shared durable store. */
export class MemoryWebhookReplayStore implements WebhookReplayStore {
  private readonly claims = new Map<string, number>();

  async claim(key: string, expiresAtSeconds: number, nowSeconds: number): Promise<boolean> {
    for (const [storedKey, expiry] of this.claims) if (expiry < nowSeconds) this.claims.delete(storedKey);
    if (this.claims.has(key)) return false;
    this.claims.set(key, expiresAtSeconds);
    return true;
  }
}

export type WebhookRefusalCode =
  | 'body_too_large'
  | 'missing_secret'
  | 'missing_signature'
  | 'stale_signature'
  | 'signature_mismatch'
  | 'invalid_json'
  | 'invalid_envelope'
  | 'replayed_event'
  | 'replay_unavailable';

export type WebhookVerification =
  | { ok: true; event: IntegrationWebhookEvent }
  | { ok: false; code: WebhookRefusalCode };

export interface VerifyWebhookInput {
  rawBody: string;
  signatureHeader: string | null | undefined;
  secret: string;
  nowSeconds: number;
  connectionPublicId: string;
  replayStore: WebhookReplayStore;
  toleranceSeconds?: number;
}

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const HEX_SIGNATURE = /^[0-9a-f]{64}$/;

function signatureBytes(value: string): Uint8Array | null {
  if (!HEX_SIGNATURE.test(value)) return null;
  const out = new Uint8Array(32);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function parseSignatureHeader(header: string | null | undefined): { t: number; v1: Uint8Array[] } | null {
  if (!header) return null;
  let t = Number.NaN;
  const v1: Uint8Array[] = [];
  for (const part of header.split(',')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key === 't' && /^\d{1,12}$/.test(value)) t = Number(value);
    if (key === 'v1') {
      const bytes = signatureBytes(value);
      if (bytes) v1.push(bytes);
    }
  }
  return Number.isFinite(t) && v1.length > 0 ? { t, v1 } : null;
}

function boundedToken(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && TOKEN.test(value);
}

function readEnvelope(value: unknown): IntegrationWebhookEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!boundedToken(row.id, 200) || !boundedToken(row.type, 120)) return null;
  if (row.version !== undefined && !boundedToken(row.version, 40)) return null;
  if (!row.data || typeof row.data !== 'object' || Array.isArray(row.data)) return null;
  return {
    id: row.id,
    type: row.type,
    ...(row.version === undefined ? {} : { version: row.version as string }),
    data: row.data as Record<string, unknown>,
  };
}

export async function verifyIntegrationWebhook(input: VerifyWebhookInput): Promise<WebhookVerification> {
  if (new TextEncoder().encode(input.rawBody).byteLength > MAX_INTEGRATION_WEBHOOK_BYTES) {
    return { ok: false, code: 'body_too_large' };
  }
  if (!input.secret) return { ok: false, code: 'missing_secret' };

  const tolerance = input.toleranceSeconds ?? INTEGRATION_WEBHOOK_TOLERANCE_SECONDS;
  const signature = parseSignatureHeader(input.signatureHeader);
  if (!signature) return { ok: false, code: 'missing_signature' };
  if (Math.abs(input.nowSeconds - signature.t) > tolerance) return { ok: false, code: 'stale_signature' };
  const expected = await hmacSha256(utf8(input.secret), utf8(`${signature.t}.${input.rawBody}`));
  let matched = false;
  for (const candidate of signature.v1) if (timingSafeEqual(candidate, expected)) matched = true;
  if (!matched) return { ok: false, code: 'signature_mismatch' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawBody);
  } catch {
    return { ok: false, code: 'invalid_json' };
  }
  const event = readEnvelope(parsed);
  if (!event || !boundedToken(input.connectionPublicId, 200)) return { ok: false, code: 'invalid_envelope' };

  try {
    const firstUse = await input.replayStore.claim(
      `${input.connectionPublicId}\u0000${event.id}`,
      signature.t + tolerance,
      input.nowSeconds,
    );
    if (!firstUse) return { ok: false, code: 'replayed_event' };
  } catch {
    return { ok: false, code: 'replay_unavailable' };
  }

  return { ok: true, event };
}
