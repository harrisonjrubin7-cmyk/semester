/**
 * The one way a domain operation says "that worked" or "that did not".
 *
 * A use case returns a `Result` rather than throwing, because a refusal is an
 * expected outcome of a request, not an accident: the caller has to handle it,
 * and a thrown error is the one thing the type system does not make it do.
 * Throwing stays for the genuinely unexpected — a bug, a broken invariant in
 * the host — which is not something a screen should try to recover from.
 *
 * The discriminant is `ok`, the same one `lib/actions.ts` already uses for
 * `Moved | Refused`, so a reader who knows one knows the other.
 */
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

/** Transform the value of a success; a failure passes through untouched. */
export const mapOk = <T, U, E>(r: Result<T, E>, f: (value: T) => U): Result<U, E> => (r.ok ? ok(f(r.value)) : r);

/** Chain a step that can itself fail; the first failure ends the chain. */
export const andThen = <T, U, E>(r: Result<T, E>, f: (value: T) => Result<U, E>): Result<U, E> => (r.ok ? f(r.value) : r);
