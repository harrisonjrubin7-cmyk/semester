import { useCallback, useState } from 'react';

/**
 * One idempotency key per attempt, and the same key on its retry.
 *
 * The registration ledger and the gradebook both take a key on every write
 * and treat "the same caller, key and request" as one request: the second
 * delivery returns the first answer and writes nothing. That only protects a
 * student if the screen keeps the key across the retry that matters — the one
 * after a request whose outcome is unknown, because the connection dropped
 * after the server had committed. A fresh key there would enroll twice, or
 * spend a second waitlist place.
 *
 * So a key belongs to an *attempt*, named by what is being asked
 * (`enroll:<section>`, `enter:<item>:<student>`). It is made on the first
 * press and kept until the server has answered — yes or no. After an answer
 * the next press is a new attempt with a new key, which is also what the
 * server needs: a refusal is not stored against its key, but a success is,
 * and asking again after a success under the old key would replay the old
 * success rather than do the new thing.
 */

/** A key both ledgers accept: `^[A-Za-z0-9:._-]{8,128}$`. */
export function newKey(prefix: string): string {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  const clean = prefix.replace(/[^A-Za-z0-9:._-]/g, '-').slice(0, 60);
  return `${clean}.${id}`;
}

/**
 * A failed call to the account service, with whether the server answered.
 *
 * `answered` is true when the database said no — a raised exception with a
 * SQLSTATE code. The request is settled: nothing was written, and the next
 * press is a new attempt. It is false when the request never got an answer —
 * the network failed, or the reply was lost — and then nobody knows whether it
 * committed, so the retry must carry the same key.
 */
export class ServiceError extends Error {
  readonly answered: boolean;
  constructor(message: string, answered: boolean) {
    super(message);
    this.name = 'ServiceError';
    this.answered = answered;
  }
}

interface RawError {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * The server's own sentence, in plain words.
 *
 * Every raise in both migrations begins `semester: ` and is written to be read
 * ("that student is not enrolled in this course"); this drops the prefix and
 * makes it a sentence. A failure with no SQLSTATE is the network, and says so
 * without claiming anything about what happened on the other side.
 */
export function serviceError(error: RawError | null | undefined, fallback: string): ServiceError {
  const code = typeof error?.code === 'string' ? error.code : '';
  const raw = (error?.message ?? '').trim();
  if (!code) {
    return new ServiceError(
      `${fallback} The connection to your school’s service did not answer, so it is not known whether the change was made. Try again: it is sent with the same key, so it cannot happen twice.`,
      false,
    );
  }
  const said = raw.replace(/^semester:\s*/i, '');
  if (!said) return new ServiceError(fallback, true);
  const sentence = said.charAt(0).toUpperCase() + said.slice(1);
  return new ServiceError(/[.!?]$/.test(sentence) ? sentence : `${sentence}.`, true);
}

/** Whether a caught failure left the attempt settled. Anything that is not a `ServiceError` is treated as unknown. */
export const settled = (e: unknown): boolean => e instanceof ServiceError && e.answered;

/**
 * The keys of the attempts in flight, by what they ask.
 *
 * Pure so the rule can be tested without React: `keyFor` hands out the kept
 * key or makes one, and `settle` forgets it once the server has answered.
 */
export class Attempts {
  private readonly keys = new Map<string, string>();
  private readonly make: (prefix: string) => string;
  constructor(make: (prefix: string) => string = newKey) {
    this.make = make;
  }

  keyFor(what: string): string {
    const kept = this.keys.get(what);
    if (kept) return kept;
    const key = this.make(what);
    this.keys.set(what, key);
    return key;
  }

  /** Whether `what` is waiting on a retry: its last try got no answer. */
  pending(what: string): boolean {
    return this.keys.has(what);
  }

  settle(what: string): void {
    this.keys.delete(what);
  }
}

/**
 * Run one attempt: the key is reused until the server answers.
 *
 * `run` is handed the key. When it resolves, or throws an answered
 * `ServiceError`, the attempt is over. When it throws anything else, the key
 * is kept for the retry, and the error is re-thrown for the screen to show.
 */
export function useAttempts() {
  // One ledger of keys per mounted screen, made once and never replaced.
  const [attempts] = useState(() => new Attempts());
  const attempt = useCallback(
    async <T,>(what: string, run: (key: string) => Promise<T>): Promise<T> => {
      const key = attempts.keyFor(what);
      try {
        const out = await run(key);
        attempts.settle(what);
        return out;
      } catch (e) {
        if (settled(e)) attempts.settle(what);
        throw e;
      }
    },
    [attempts],
  );
  const pending = useCallback((what: string) => attempts.pending(what), [attempts]);
  return { attempt, pending };
}
