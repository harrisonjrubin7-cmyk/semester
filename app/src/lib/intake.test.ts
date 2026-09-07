import { describe, expect, it } from 'vitest';
import { alreadyAdded, materialHash } from './intake';

describe('recognising material that is already here', () => {
  const u = (over: Record<string, unknown> = {}) => ({ courseId: 'econ', sourceHash: 'x', ...over });

  it('hashes the same passage the same way through a stray newline', () => {
    // The same paragraph pasted from a PDF twice differs by line breaks and
    // nothing else, and a de-duplication a newline defeats is not one.
    expect(materialHash(['The HOLC graded 239 cities.'])).toBe(
      materialHash(['The  HOLC\n graded\t239 cities.  ']),
    );
  });

  it('hashes different material differently', () => {
    expect(materialHash(['one'])).not.toBe(materialHash(['two']));
  });

  it('ignores the empty parts rather than letting them change the hash', () => {
    expect(materialHash(['text', '', undefined, '   '])).toBe(materialHash(['text']));
  });

  it('is empty for nothing at all, which is never a match', () => {
    expect(materialHash([])).toBe('');
    expect(materialHash(['', undefined])).toBe('');
    expect(alreadyAdded([u()], 'econ', '')).toBeUndefined();
  });

  it('finds an earlier import of the same thing', () => {
    expect(alreadyAdded([u({ sourceHash: 'abc' })], 'econ', 'abc')).toBeDefined();
    expect(alreadyAdded([u({ sourceHash: 'abc' })], 'econ', 'def')).toBeUndefined();
  });

  it('does not match across courses — the same handout can belong to two', () => {
    expect(alreadyAdded([u({ courseId: 'psci', sourceHash: 'abc' })], 'econ', 'abc')).toBeUndefined();
  });

  it('ignores an update from before hashes were stored', () => {
    expect(alreadyAdded([u({ sourceHash: undefined })], 'econ', 'abc')).toBeUndefined();
  });
});
