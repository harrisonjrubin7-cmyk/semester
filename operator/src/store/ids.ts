import { randomBytes } from 'node:crypto';
export type IdFactory = (prefix: string) => string;
export const randomIds: IdFactory = (prefix) => `${prefix}_${randomBytes(6).toString('hex')}`;
/** Sequential ids for tests and committed demonstrations, so records are stable across runs. */
export function sequentialIds(): IdFactory {
  const counters = new Map<string, number>();
  return (prefix) => {
    const next = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, next);
    return `${prefix}_${String(next).padStart(3, '0')}`;
  };
}
