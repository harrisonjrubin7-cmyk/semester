/**
 * The error model every domain speaks.
 *
 * A domain function that can fail returns a `Result`; it does not throw for an
 * expected outcome. Throwing is for programmer error and is caught once, by the
 * screen boundary (`components/Boundary.tsx`), which already knows a stale chunk
 * from a real fault. Everything a person can cause — a blank title, a task that
 * is already done, a role that may not do this — is a value, so the caller has
 * to look at it and a test can enumerate it.
 *
 * The code is a closed set on purpose. A code is what a screen switches on and
 * what a metric counts; a message is for a person and may be reworded freely.
 * Adding a code is a decision, so it is made here, in one file, with the
 * guarantee below: every code has a calm sentence and a retry answer, and the
 * test that walks `ERROR_CODES` fails if one is added without both.
 *
 * It is the client-side half of ADR 0010's envelope. The gateway's wire shape
 * (`packages/institution`) carries a correlation id; a domain error does not,
 * because correlation belongs to a request and a domain has none. The adapter
 * that crosses the wire attaches the id.
 */

export const ERROR_CODES = [
  'validation',
  'not_found',
  'conflict',
  'forbidden',
  'invalid_transition',
  'unsupported',
  'unavailable',
  'internal',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface AppError {
  code: ErrorCode;
  /** A sentence a person can read. Calm: it says what happened and what is possible, never who is at fault. */
  message: string;
  /** Whether doing the same thing again could succeed without anything else changing. */
  retryable: boolean;
  /** Machine-readable detail for logs and tests; never shown. */
  details?: Readonly<Record<string, string | number | boolean | null>>;
}

export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

/** `retryable` is a property of the code, not a per-call guess, so callers cannot disagree about it. */
const RETRYABLE: Readonly<Record<ErrorCode, boolean>> = {
  validation: false,
  not_found: false,
  conflict: true,
  forbidden: false,
  invalid_transition: false,
  unsupported: false,
  unavailable: true,
  internal: false,
};

export const isRetryable = (code: ErrorCode): boolean => RETRYABLE[code];

export function err(
  code: ErrorCode,
  message: string,
  details?: AppError['details'],
): Result<never> {
  return { ok: false, error: { code, message, retryable: RETRYABLE[code], ...(details ? { details } : {}) } };
}

/** Transform the success value; an error passes through untouched. */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

/** Chain a step that can itself fail. The first failure ends the chain. */
export function andThen<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}
