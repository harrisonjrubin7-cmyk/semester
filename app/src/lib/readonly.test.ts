import { describe, expect, it } from 'vitest';
import { READ_ONLY_NOTICE, ReadOnly, isReadOnly, readOnlyMode } from './readonly';

/**
 * The switch itself. The two sides that read it — `cloud.push` and the store —
 * have their own tests (`cloud.test.ts`, `state/readonly.test.tsx`); this one
 * is for the parse, which is where a build flag is most often "on" by a
 * spelling nobody meant.
 */
describe('read-only mode', () => {
  it('is on for the exact word true, however cased or spaced', () => {
    for (const v of ['true', 'TRUE', ' true ', 'True']) expect(readOnlyMode({ VITE_READ_ONLY: v }), v).toBe(true);
  });

  it('is off when unset, empty, or anything else — a stray value must not freeze a build', () => {
    for (const v of [undefined, '', 'on', '1', 'yes', 'false', 'read-only']) {
      expect(readOnlyMode({ VITE_READ_ONLY: v }), String(v)).toBe(false);
    }
    expect(readOnlyMode({})).toBe(false);
  });

  it('carries the banner sentence on the refusal, and is told apart by name', () => {
    const e = new ReadOnly();
    expect(e.message).toBe(READ_ONLY_NOTICE);
    expect(isReadOnly(e)).toBe(true);
    expect(isReadOnly(new Error(READ_ONLY_NOTICE))).toBe(false);
  });
});
