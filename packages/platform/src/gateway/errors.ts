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
  refused: { status: 400, retryable: false },
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
  method_not_supported: { status: 405, retryable: false },
  conflict: { status: 409, retryable: false },
  idempotency_in_progress: { status: 409, retryable: false },
  expired: { status: 410, retryable: false },
  too_large: { status: 413, retryable: false },
  unsupported_media_type: { status: 415, retryable: false },
  precondition_failed: { status: 412, retryable: false },
  idempotency_key_reused: { status: 422, retryable: false },
  rate_limited: { status: 429, retryable: true },
  internal: { status: 500, retryable: false },
  outcome_uncertain: { status: 502, retryable: false },
  unavailable: { status: 503, retryable: true },
} as const satisfies Record<string, { status: number; retryable: boolean }>;

export type ErrorCode = keyof typeof ERROR_CODES;

/**
 * A refinement of a status, named by a domain: `review_expired`, `record_changed`,
 * `adapter_not_configured`. The institution gateway already says these on the wire
 * (ADR 0010: "a status alone is not enough to tell *the review expired* from *the
 * record moved*, and both are 4xx"), so the platform has to carry them rather than
 * flatten them into the catalogue's nearest name. They are lowercase with `_` (or, as the live
 * `policy-disabled` already is, `-`), and a client may switch on them, but only the catalogue's codes are the platform's to promise.
 */
export const SPECIFIC_CODE_PATTERN = /^[a-z][a-z0-9_-]{2,47}$/;

export const isErrorCode = (v: unknown): v is ErrorCode =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(ERROR_CODES, v);

export class PlatformError extends Error {
  /** A brand rather than `instanceof`, for the reason `Refusal` has one: two bundled copies are two classes. */
  readonly platformError = true;
  /** A catalogue code, or a domain's refinement of a status (see `SPECIFIC_CODE_PATTERN`). */
  readonly code: string;
  readonly status: number;
  readonly userAction?: UserAction;
  readonly retryAfterSeconds?: number;

  constructor(code: ErrorCode, message: string, opts: { userAction?: UserAction; retryAfterSeconds?: number } = {}) {
    super(message);
    this.name = 'PlatformError';
    this.code = code;
    this.status = ERROR_CODES[code].status;
    this.userAction = opts.userAction;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }

  /**
   * A refusal a domain names more specifically than the catalogue does, at the
   * status it chose. The status must be a real HTTP error and the code a plain
   * lowercase name (`_` or `-` inside); anything else is a bug in the caller and throws.
   */
  static specific(status: number, code: string, message: string, opts: { userAction?: UserAction; retryAfterSeconds?: number } = {}): PlatformError {
    if (!Number.isInteger(status) || status < 400 || status > 599) throw new Error(`${status} is not an HTTP error status.`);
    if (!SPECIFIC_CODE_PATTERN.test(code)) throw new Error(`"${code}" is not a lowercase error code.`);
    const e = new PlatformError('internal', message, opts);
    // Not assignable through the constructor, which only takes catalogue codes; set once, here.
    (e as { code: string }).code = code;
    (e as { status: number }).status = status;
    return e;
  }

  /** The right constructor for a code and status read off the wire or out of a store. */
  static from(status: number, code: string, message: string, opts: { userAction?: UserAction; retryAfterSeconds?: number } = {}): PlatformError {
    return isErrorCode(code) && ERROR_CODES[code].status === status ? new PlatformError(code, message, opts) : PlatformError.specific(status, code, message, opts);
  }

  /** Only 429 and 503 say "the same request may be sent again" (ADR 0010); a 502 says reconcile. */
  get retryable(): boolean {
    return this.status === 429 || this.status === 503;
  }
}

export const isPlatformError = (e: unknown): e is PlatformError =>
  e instanceof Error && (e as { platformError?: unknown }).platformError === true;

export interface ErrorEnvelope {
  error: {
    code: string;
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
  if (typeof x.code !== 'string' || !SPECIFIC_CODE_PATTERN.test(x.code) || typeof x.message !== 'string' || typeof x.correlation_id !== 'string') return null;
  if (typeof x.retryable !== 'boolean') return null;
  return value as ErrorEnvelope;
}
