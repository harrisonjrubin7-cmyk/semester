import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * `supabase/check-suites.txt` is the committed list of policy suites a full
 * `supabase/check.sh` run must include. The script enforces it itself, both
 * ways, before building a cluster; this holds the same two assertions where a
 * pull request sees them first, since the policy step runs last in CI and only
 * where PostgreSQL 17 could be installed.
 *
 * Why a list and not the glob: a run that comes from the glob alone cannot
 * tell a passing suite from one that is no longer there. Deleting or renaming
 * a suite now takes a second edit, in a file whose diff says what left.
 */
const supabase = join(import.meta.dirname, '../../../../supabase');

const listed = () =>
  readFileSync(join(supabase, 'check-suites.txt'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

const present = () =>
  readdirSync(supabase)
    .filter((f) => f.endsWith('.check.sql'))
    .map((f) => f.slice(0, -'.check.sql'.length));

describe('the policy-suite manifest', () => {
  it('names every suite file, and only suite files', () => {
    const a = [...listed()].sort();
    const b = [...present()].sort();
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(100);
  });

  it('lists each suite once, in sorted order, so a diff of it reads as a list of changes', () => {
    const a = listed();
    expect(new Set(a).size).toBe(a.length);
    expect(a).toEqual([...a].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)));
  });

  it('is enforced by check.sh before a cluster is built', () => {
    const script = readFileSync(join(supabase, 'check.sh'), 'utf8');
    expect(script).toContain('check-suites.txt');
    expect(script.indexOf('check-suites.txt')).toBeLessThan(script.indexOf('initdb'));
  });
});
