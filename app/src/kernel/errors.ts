import type { Err } from './result';
import { err } from './result';

/**
 * One error model for every domain.
 *
 * It is the shape of ADR 0010's refusal envelope, carried inside the app, so
 * that a refusal made on the device and a refusal made by the institution
 * gateway are the same thing to a screen: a `code` it may switch on, a
 * `message` it may show, whether trying again can help, and what the person
 * can do about it.
 *
 * `kind` is the part the envelope does not carry. It is the coarse category a
 * caller needs in order to choose a *behaviour* (show inline, redirect to
 * sign-in, offer retry) without learning every domain's codes.
 */
export const ERROR_KINDS = [
  /** The input is wrong; fix it and ask again. */
  'validation',
  /** The actor may not do this. Asking again will not help. */
  'forbidden',
  /** What was named does not exist (or is not visible to the actor). */
  'not_found',
  /** The thing exists in a state that does not allow this move. */
  'conflict',
  /** A rule of the domain would be broken. This is a bug if the UI offered it. */
  'invariant',
  /** A dependency is down or slow. The only kind a retry can fix. */
  'unavailable',
] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

/** What the person can do next, in the vocabulary ADR 0010 already fixed. */
export interface UserAction {
  readonly label: string;
  readonly kind: 'external_link' | 'open_screen' | 'retry_later' | 'contact_support';
  readonly href?: string;
}

export interface DomainError {
  readonly kind: ErrorKind;
  /** A name a caller may switch on: `<domain>.<what_went_wrong>`, lower snake. */
  readonly code: string;
  /** A sentence for the person, never a stack or a field path. */
  readonly message: string;
  /** True only for `unavailable`. A 4xx that says "try again" is a lie. */
  readonly retryable: boolean;
  readonly userAction?: UserAction;
  readonly correlationId?: string;
}

export const ERROR_CODE_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

export interface FailOptions {
  readonly userAction?: UserAction;
  readonly correlationId?: string;
}

/**
 * Build a failed `Result`.
 *
 * `retryable` is derived from `kind`, not passed in: ADR 0010 says only an
 * overload or an outage is retryable, and a parameter is a way to get that
 * wrong one call site at a time.
 */
export function fail(kind: ErrorKind, code: string, message: string, options: FailOptions = {}): Err<DomainError> {
  if (!ERROR_CODE_PATTERN.test(code)) throw new Error(`error code "${code}" is not <domain>.<reason>`);
  return err({ kind, code, message, retryable: kind === 'unavailable', ...options });
}

/** The wire shape of ADR 0010, for anything that has to leave the process. */
export interface ErrorEnvelope {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly correlation_id?: string;
    readonly retryable: boolean;
    readonly user_action?: UserAction;
  };
  /** Kept for clients written before the envelope, as the gateway does. */
  readonly message: string;
}

export function toEnvelope(e: DomainError): ErrorEnvelope {
  return {
    error: {
      code: e.code,
      message: e.message,
      ...(e.correlationId ? { correlation_id: e.correlationId } : {}),
      retryable: e.retryable,
      ...(e.userAction ? { user_action: e.userAction } : {}),
    },
    message: e.message,
  };
}
