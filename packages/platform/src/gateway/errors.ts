/**
 * One error shape for every platform surface, the one ADR 0010 gave the
 * institution gateway: `{ error: { code, message, correlation_id, retryable,
 * user_action? }, message }`.
 *
 * `code` is a name a client may switch on. `retryable` is a statement, true
 * only for 429 and 503 — a 502 means the outcome is unknown and the right
 * move is to reconcile, so a client that reads only flags must hear that too.
 * The top-level `message` stays for clients written before the envelope.
 *
 * An error never carries a stack, a query, a connection string or another
 * tenant's data. `PlatformError.message` is the sentence for the person, and
 * anything else an adapter threw is flattened to `internal` by `toPlatformError`.
 */

import type { UserAction } from '../seam/institution.ts';

export const ERROR_CODES = {
  invalid_request: { status: 400, retryable: false },
  validation_failed: { status: 400, retryable: false },
  version_unsupported: { status: 400, retryable: false },
  invalid_cursor: { status: 400, retryable: false },
  unauthenticated: { status: 401, retryable: false },
  forbidden: { status: 403, retryable: false },
  tenant_unresolved: { status: 403, retryable: false },
  tenant_mismatch: { status: 403, retryable: false },
  tenant_suspended: { status: 403, retryable: false },
  consent_required: { status: 403, retryable: false },
  entitlement_required: { status: 402, retryable: false },
  not_found: { status: 404, retryable: false },
  conflict: { status: 409, retryable: false },
  idempotency_in_progress: { status: 409, retryable: false },
  precondition_failed: { status: 412, retryable: false },
  idempotency_key_reused: { status: 422, retryable: false },
  rate_limited: { status: 429, retryable: true },
  internal: { status: 500, retryable: false },
  outcome_unknown: { status: 502, retryable: false },
  unavailable: { status: 503, retryable: true },
} as const satisfies Record<string, { status: number; retryable: boolean }>;

export type ErrorCode = keyof typeof ERROR_CODES;

export const isErrorCode = (v: unknown): v is ErrorCode =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(ERROR_CODES, v);

export class PlatformError extends Error {
  /** A brand rather than `instanceof`, for the reason `Refusal` has one: two bundled copies are two classes. */
  readonly platformError = true;
  readonly code: ErrorCode;
  readonly userAction?: UserAction;
  readonly retryAfterSeconds?: number;

  constructor(code: ErrorCode, message: string, opts: { userAction?: UserAction; retryAfterSeconds?: number } = {}) {
    super(message);
    this.name = 'PlatformError';
    this.code = code;
    this.userAction = opts.userAction;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }

  get status(): number {
    return ERROR_CODES[this.code].status;
  }

  get retryable(): boolean {
    return ERROR_CODES[this.code].retryable;
  }
}

export const isPlatformError = (e: unknown): e is PlatformError =>
  e instanceof Error && (e as { platformError?: unknown }).platformError === true;

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    correlation_id: string;
    retryable: boolean;
    user_action?: UserAction;
  };
  message: string;
}

export interface ErrorResponse {
  status: number;
  headers: Record<string, string>;
  body: ErrorEnvelope;
}

const INTERNAL_MESSAGE = 'Something went wrong on our side. Please try again later.';

/** Anything thrown becomes a `PlatformError`; what was not meant for a person becomes `internal`. */
export const toPlatformError = (e: unknown): PlatformError =>
  isPlatformError(e) ? e : new PlatformError('internal', INTERNAL_MESSAGE);

export function errorResponse(e: unknown, correlationId: string): ErrorResponse {
  const err = toPlatformError(e);
  const headers: Record<string, string> = { 'x-correlation-id': correlationId };
  if (err.retryAfterSeconds !== undefined) headers['retry-after'] = String(Math.max(1, Math.ceil(err.retryAfterSeconds)));
  return {
    status: err.status,
    headers,
    body: {
      error: {
        code: err.code,
        message: err.message,
        correlation_id: correlationId,
        retryable: err.retryable,
        ...(err.userAction ? { user_action: err.userAction } : {}),
      },
      message: err.message,
    },
  };
}

/** Whether a parsed response body is the envelope — what the SDK reads before it trusts `retryable`. */
export function parseErrorEnvelope(value: unknown): ErrorEnvelope | null {
  if (!value || typeof value !== 'object') return null;
  const e = (value as { error?: unknown }).error;
  if (!e || typeof e !== 'object') return null;
  const x = e as Record<string, unknown>;
  if (!isErrorCode(x.code) || typeof x.message !== 'string' || typeof x.correlation_id !== 'string') return null;
  if (typeof x.retryable !== 'boolean') return null;
  return value as ErrorEnvelope;
}
