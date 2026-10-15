/**
 * The headers every platform response carries, and the two a client may send.
 *
 * `X-Request-Id` is minted per request and is never anything a client sent.
 * `X-Correlation-Id` is the client's if it is well formed and minted
 * otherwise, because a header is a place to put a sentence, a script or four
 * kilobytes and this one lands in logs and audit rows (ADR 0010). There is no
 * tenant header: the tenant comes from the verified session (see
 * `tenancy/context.ts`), and a client that sends one is told when it disagrees.
 */

import { CORRELATION_ID_PATTERN } from '../seam/institution.ts';
import type { IdSource } from '../kernel/clock.ts';

export const HEADERS = {
  requestId: 'x-request-id',
  correlationId: 'x-correlation-id',
  idempotencyKey: 'idempotency-key',
  tenantHint: 'x-tenant-id',
  retryAfter: 'retry-after',
  deprecation: 'deprecation',
  sunset: 'sunset',
} as const;

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

/** Header lookup that does not care how the host framework cased the name. */
export function header(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return Array.isArray(v) ? v[0] : v;
  }
  return undefined;
}

export function resolveCorrelationId(sent: string | undefined, ids: IdSource): string {
  return sent !== undefined && CORRELATION_ID_PATTERN.test(sent) ? sent : ids.next('corr');
}

export const mintRequestId = (ids: IdSource): string => ids.next('req');

export const isIdempotencyKey = (v: unknown): v is string => typeof v === 'string' && IDEMPOTENCY_KEY_PATTERN.test(v);
