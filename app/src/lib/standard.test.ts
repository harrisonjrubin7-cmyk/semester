import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STANDARD, counts, summary } from './standard';

const root = join(import.meta.dirname, '../../..');
const exists = (p: string) => existsSync(join(root, p));

describe('the Semester Standard', () => {
  it('states each commitment as a checkable “Every …” line, once', () => {
    const ids = STANDARD.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of STANDARD) {
      expect(c.line, c.id).toMatch(/^Every .+\.$/);
      expect(c.measure.length, c.id).toBeGreaterThan(40);
      expect(c.line, c.id).not.toMatch(/["&<>]/);
    }
  });

  it('cites only paths that exist, and never a gap-free “partly”', () => {
    for (const c of STANDARD) {
      expect(c.holds.length, c.id).toBeGreaterThan(0);
      for (const h of c.holds) expect(exists(h.path), `${c.id} cites ${h.path}`).toBe(true);
      if (c.status === 'held') expect(c.gap, `${c.id} is held and states a gap`).toBe('');
      else expect(c.gap.length, `${c.id} is ${c.status} and states no gap`).toBeGreaterThan(20);
    }
  });

  it('holds a line with a test when it says held', () => {
    for (const c of STANDARD.filter((x) => x.status === 'held')) {
      expect(c.holds.some((h) => /\.test\.tsx?$|\.check\.sql$/.test(h.path)), `${c.id} is held by no test`).toBe(true);
    }
  });

  it('states the finding, so a change in either direction is a line in a diff', () => {
    expect(STANDARD).toHaveLength(11);
    expect(counts()).toEqual({ held: 4, partly: 7, owed: 0 });
    expect(summary()).toBe('11 commitments: 4 held by a check that fails when broken, 7 held in part with the gap stated, 0 stated and not yet held.');
  });
});
