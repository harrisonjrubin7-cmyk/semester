/**
 * Deno-safe edge-function error and request identifiers.
 *
 * Edge functions cannot import the Node-oriented platform package, but their
 * wire contract must still match ADR 0010. Keep this module argument-driven
 * and runtime-neutral so Vitest can hold the boundary without a Deno runner.
 */

export const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const ERROR_CODE_PATTERN = /^[a-z][a-z0-9_-]{2,47}$/;

export interface EdgeRequestIdentifiers {
  requestId: string;
  correlationId: string;
}

const defaultCode = (status: number): string => {
  if (status === 400) return 'invalid_request';
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 405) return 'method_not_supported';
  if (status === 413) return 'too_large';
  if (status === 429) return 'rate_limited';
  if (status === 501) return 'provider_not_configured';
  if (status === 502) return 'outcome_uncertain';
  if (status === 503) return 'unavailable';
  return 'internal';
};

export function requestIdentifiers(
  headers: Headers,
  randomUUID: () => string = () => crypto.randomUUID(),
): EdgeRequestIdentifiers {
  const supplied = headers.get('X-Correlation-Id') ?? '';
  return {
    requestId: randomUUID(),
    correlationId: CORRELATION_ID_PATTERN.test(supplied) ? supplied : randomUUID(),
  };
}

export function identifierHeaders(ids: EdgeRequestIdentifiers): Record<string, string> {
  return {
    'X-Request-Id': ids.requestId,
    'X-Correlation-Id': ids.correlationId,
  };
}

/** Add ADR 0010 fields to an edge function's existing `{ error: … }` body. */
export function edgeJsonBody(body: unknown, status: number, correlationId: string): unknown {
  if (status < 400) return body;
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const candidate = record.error && typeof record.error === 'object'
    ? record.error as Record<string, unknown>
    : {};
  const message = typeof candidate.message === 'string' && candidate.message.trim()
    ? candidate.message
    : 'Something went wrong on our side. Please try again later.';
  const code = typeof candidate.code === 'string' && ERROR_CODE_PATTERN.test(candidate.code)
    ? candidate.code
    : defaultCode(status);
  return {
    ...record,
    error: {
      ...candidate,
      code,
      message,
      correlation_id: correlationId,
      retryable: status === 429 || status === 503,
    },
    message,
  };
}
