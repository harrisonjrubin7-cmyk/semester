import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIN_COHORT } from './institution-ops';

/**
 * One small-cell floor, in both places it is written.
 *
 * `MIN_COHORT` suppresses in the app; the database has its own floor, written
 * as a literal in each check constraint and each `having count(...)` that
 * builds an aggregate. `institution-ops.test.ts` pins `MIN_COHORT` to 10, which
 * holds the app to a number but not to the database — lower the SQL to 5 and
 * that test stays green while staff screens and the tables disagree about
 * what is safe to show. This reads every floor out of the migrations instead.
 *
 * Launch-readiness Phase 5 (product analytics and data ethics):
 * `docs/PRODUCT-ANALYTICS-DATA-ETHICS.md` names this test as the guard for
 * "no cell under ten, anywhere".
 */

const dir = join(import.meta.dirname, '../../../supabase/migrations');
const sql = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => ({ file: f, text: readFileSync(join(dir, f), 'utf8') }));

/**
 * Counts that look like a floor and are not one. Each is matched by file and
 * line, with the reason, so a new one is a decision someone wrote down rather
 * than a pattern the scan quietly stopped seeing.
 */
const NOT_A_COHORT_FLOOR: readonly { file: RegExp; line: RegExp; why: string }[] = [
  {
    file: /_community\.sql$/,
    line: /count\(distinct r\.reporter_id\) >= 3 into fresh_cluster/,
    why: 'A moderation trigger: three distinct reporters on one post. It decides when a post is reviewed, not what an aggregate may show.',
  },
];

const exempt = (f: { file: string; line: string }) => NOT_A_COHORT_FLOOR.some((n) => n.file.test(f.file) && n.line.test(f.line));

/** Every place a migration states a cohort floor, with the number it states. */
function floors(files: { file: string; text: string }[]) {
  const found: { file: string; line: string; floor: number }[] = [];
  for (const { file, text } of files) {
    for (const line of text.split('\n')) {
      // A column that holds a head count: `n >= 10`, `planned_students >= 10`.
      for (const m of line.matchAll(/\b(?:n|\w+_students)\s*>=\s*(\d+)/g)) found.push({ file, line: line.trim(), floor: Number(m[1]) });
      // A head count computed in place: `count(distinct …) … >= 10`.
      if (/count\(distinct/.test(line)) {
        for (const m of line.matchAll(/\)\s*>=\s*(\d+)/g)) found.push({ file, line: line.trim(), floor: Number(m[1]) });
      }
    }
  }
  return found.filter((f) => !exempt(f));
}

describe('the small-cell floor', () => {
  it('finds the floors it is meant to — the control for the comparison below', () => {
    const found = floors(sql);
    // The two aggregate tables' checks, both demand-refresh counts, and the
    // capability descriptions that promise the floor to whoever holds them.
    expect(found.length).toBeGreaterThanOrEqual(8);
    expect(found.some((f) => /planned_students >= /.test(f.line))).toBe(true);
    expect(found.some((f) => /status = 'backup'\) >= /.test(f.line))).toBe(true);
    expect(found.some((f) => /check \(n >= /.test(f.line))).toBe(true);
  });

  it('is the same number in every migration as in MIN_COHORT', () => {
    const wrong = floors(sql).filter((f) => f.floor !== MIN_COHORT);
    expect(wrong, 'a migration states a cohort floor that is not MIN_COHORT').toEqual([]);
  });

  it('exempts only what it names, and each exemption still matches something', () => {
    const raw = (files: { file: string; text: string }[]) =>
      files.flatMap(({ file, text }) => text.split('\n').map((line) => ({ file, line: line.trim() })));
    for (const n of NOT_A_COHORT_FLOOR) {
      expect(raw(sql).some((f) => n.file.test(f.file) && n.line.test(f.line)), n.why).toBe(true);
    }
    // The same count in another file is not exempt.
    const elsewhere = [{ file: '20990101000000_x.sql', text: 'select count(distinct r.reporter_id) >= 3 into fresh_cluster' }];
    expect(floors(elsewhere)).toHaveLength(1);
  });

  it('would notice one floor lowered (control)', () => {
    const lowered = sql.map((f) => ({ ...f, text: f.text.replace('check (n >= 10)', 'check (n >= 5)') }));
    expect(floors(lowered).filter((f) => f.floor !== MIN_COHORT)).toHaveLength(1);
  });
});
