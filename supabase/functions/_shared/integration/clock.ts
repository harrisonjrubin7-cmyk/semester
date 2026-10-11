// Generated from app/../packages/platform/src/kernel/clock.ts by app/scripts/edge-integration.ts. Do not edit;
// change the source and run `cd app && node scripts/edge-integration.ts`.

/**
 * Time, identity and randomness, as things a caller hands in.
 *
 * Every other module in this package takes a `Clock`, an `IdSource` or an
 * `Rng` instead of reading the machine. That is not tidiness: a rule that says
 * "an idempotency record lapses after a day" or "quiet hours end at seven" can
 * only be tested by a clock the test owns, and a `Date.now()` buried in a
 * helper is the reason the date-sensitive suites in this repository needed
 * stabilising twice. `architecture.test.ts` refuses the machine's clock,
 * `Math.random` and `crypto.randomUUID` anywhere but this file.
 */

export interface Clock {
  now(): Date;
}

export interface IdSource {
  /** A new unguessable id, optionally prefixed (`evt_…`). */
  next(prefix?: string): string;
}

export interface Rng {
  /** A float in [0, 1). */
  next(): number;
}

export const systemClock: Clock = { now: () => new Date() };

export const systemIds: IdSource = {
  next: (prefix) => (prefix ? `${prefix}_${crypto.randomUUID()}` : crypto.randomUUID()),
};

export const systemRng: Rng = {
  next: () => {
    const [n] = crypto.getRandomValues(new Uint32Array(1));
    return n / 0x1_0000_0000;
  },
};

/** A clock a test advances by hand. */
export function fixedClock(start: string | number | Date): Clock & { set(to: string | number | Date): void; advance(ms: number): void } {
  let t = new Date(start).getTime();
  return {
    now: () => new Date(t),
    set: (to) => {
      t = new Date(to).getTime();
    },
    advance: (ms) => {
      t += ms;
    },
  };
}

/** Ids that count: stable across runs, so a test can name the one it expects. */
export function sequentialIds(): IdSource {
  let n = 0;
  return {
    next: (prefix) => {
      n += 1;
      const tail = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
      return prefix ? `${prefix}_${tail}` : tail;
    },
  };
}

/** A repeating sequence in [0, 1), for tests of jitter and sampling. */
export function sequenceRng(values: readonly number[]): Rng {
  let i = 0;
  return { next: () => values[i++ % values.length] };
}
