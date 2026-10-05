import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * `docs/FEATURE-TRUTH-TABLE.md` says what is live, what is built but off, and
 * what is only planned. A page like that is only worth reading while its
 * evidence is real, so this holds it to two things a test can check:
 *
 * - every status cell is one of the six agreed words, so a seventh cannot
 *   creep in and blur the table;
 * - every file the evidence column names still exists, so a screen that is
 *   renamed or deleted cannot leave a row claiming it.
 *
 * What it cannot check is whether a status is *true* — that a row saying LIVE
 * really works for a student. That stays a human reading. The test says so
 * rather than implying more.
 */

const ROOT = resolve(__dirname, '../../..');
const DOC = join(ROOT, 'docs/FEATURE-TRUTH-TABLE.md');
const STATUSES = ['LIVE', 'IMPLEMENTED_NOT_RELEASED', 'PARTIAL', 'MOCK_DEMO', 'PLANNED', 'BLOCKED'];

/** Where a bare `screens/Today.tsx` or `20260930…sql` may be meant. */
const BASES = ['', 'app', 'app/src', 'app/src/lib', 'app/scripts', 'supabase', 'supabase/migrations', 'supabase/functions', 'docs'];

export function rows(text: string): string[][] {
  return text
    .split('\n')
    .filter((l) => l.startsWith('|') && !/^\|[\s-|]+\|$/.test(l))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
}

export function paths(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/`([^`\s]+)`/g)) {
    const t = m[1];
    if (/^https?:/.test(t) || t.includes('*') || t.includes('(') || t.includes('=')) continue;
    if (/\.(tsx?|sql|md|json|mjs|sh|toml|yml)$/.test(t)) out.add(t);
  }
  return [...out];
}

const exists = (p: string) => BASES.some((b) => existsSync(join(ROOT, b, p)));

describe('the feature truth table', () => {
  const text = readFileSync(DOC, 'utf8');

  it('finds rows and paths to check (control: a probe that finds nothing proves nothing)', () => {
    expect(rows(text).length).toBeGreaterThan(50);
    expect(paths(text).length).toBeGreaterThan(40);
  });

  it('uses only the six agreed status words', () => {
    const bad: string[] = [];
    for (const r of rows(text)) {
      // A status cell is the one that is entirely a status word, bold or not,
      // optionally followed by a short qualifier ("LIVE (device)", "— BLOCKED").
      const cell = r.find((c) => /^\*{0,2}[A-Z_]{4,}\b/.test(c) && STATUSES.some((s) => c.includes(s)));
      if (!cell) continue;
      const words = (cell.match(/[A-Z][A-Z_]{3,}/g) ?? []).filter((w) => !['LIVE', 'WHEN', 'ONLY', 'NOT', 'RELEASED'].includes(w));
      for (const w of words) if (!STATUSES.includes(w) && !['DEMO'].includes(w)) bad.push(`${r[0]}: ${w}`);
    }
    expect(bad).toEqual([]);
  });

  it('names only files that exist', () => {
    const missing = paths(text).filter((p) => !exists(p));
    expect(missing).toEqual([]);
  });

  it('the probe does notice a path that is not there', () => {
    expect(exists('screens/DoesNotExist.tsx')).toBe(false);
    expect(exists('screens/Today.tsx')).toBe(true);
  });
});
