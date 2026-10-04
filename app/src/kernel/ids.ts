/**
 * Where identifiers come from.
 *
 * `Math.random()` and `crypto.randomUUID()` in a domain make every test that
 * touches an id assert on a shape instead of a value. An `IdSource` is handed
 * in, and a test hands in a counter.
 */
export interface IdSource {
  next(): string;
}

export const systemIds: IdSource = { next: () => crypto.randomUUID() };

/** `req-1`, `req-2`, … — long enough to be a valid correlation id (ADR 0010 asks for 8–128 characters). */
export function counterIds(prefix = 'test-id'): IdSource {
  let n = 0;
  return { next: () => `${prefix}-${++n}` };
}
