import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * A CHECK constraint whose body is `x between a and b and <more>` does not
 * survive a dump and restore. Postgres stores the `between` as an AND nested
 * inside the outer AND; `pg_dump` prints that nested form with brackets; reading
 * the brackets back flattens it, so `pg_get_constraintdef` reads differently
 * afterwards and `supabase/restore.sh` reports the schema as changed.
 * `20260929040000_round_trip_stable_checks.sql` says why at length and rewrote
 * the three that had landed by then.
 *
 * That drill runs only in CI, on Postgres 17. #1062 learned this from a red
 * `build` job: four such constraints in one new migration. This reads the
 * migrations after the rewrite and refuses the shape, so the next one is found
 * by `npm test` and not by a twenty-minute CI run.
 *
 * The fix is to spell `between` out as its two comparisons. A `between` that is
 * the whole body of a check, or is not followed by another `and`, is fine.
 */
const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'supabase', 'migrations');
/** The migration that rewrote the earlier offenders. Anything older was rewritten by it or predates the drill. */
const AFTER = '20260929040000';

/** The text inside each `check ( ... )`, found by matching brackets, so a long body is not cut short. */
export function checkBodies(sql: string): string[] {
  const bodies: string[] = [];
  const re = /\bcheck\s*\(/gi;
  while (re.exec(sql)) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < sql.length && depth > 0) {
      const c = sql[i];
      if (c === '(') depth += 1;
      else if (c === ')') depth -= 1;
      i += 1;
    }
    bodies.push(sql.slice(re.lastIndex, i - 1));
  }
  return bodies;
}

/** `between a and b and` with simple operands: a number, an identifier, or a call such as length(btrim(x)) on the left. */
const NESTED_BETWEEN = /\bbetween\s+-?[\w.]+\s+and\s+-?[\w.]+\s+and\b/i;

export function nestedBetween(sql: string): string[] {
  return checkBodies(sql).filter((b) => NESTED_BETWEEN.test(b));
}

describe('check constraints that survive a dump and a restore', () => {
  it('finds the shape it refuses, in a constraint written the way #1062 first wrote it (control)', () => {
    const bad = `create table t (program text not null check (length(btrim(program)) between 1 and 200 and program <> 'x'));`;
    expect(nestedBetween(bad)).toHaveLength(1);
    // The same constraint spelled out reads back unchanged, and a lone between is fine.
    expect(nestedBetween(`create table t (program text check (length(btrim(program)) >= 1 and length(btrim(program)) <= 200 and program <> 'x'));`)).toEqual([]);
    expect(nestedBetween(`create table t (n bigint check (n between 1 and 100));`)).toEqual([]);
  });

  it('reads a check body to its closing bracket, so a long one is not cut short', () => {
    const body = `x text check (length(btrim(x)) >= 1 and (position('(' in x) = 0) and length(x) between 1 and 9 and x <> 'a')`;
    expect(nestedBetween(body)).toHaveLength(1);
  });

  it('is found in none of the migrations after the rewrite', () => {
    const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && f.slice(0, 14) > AFTER);
    expect(files.length).toBeGreaterThan(20);
    const offenders = files.filter((f) => nestedBetween(readFileSync(join(MIGRATIONS, f), 'utf8')).length > 0);
    expect(offenders, `spell out each "between a and b and ..." inside a check as two comparisons: ${offenders.join(', ')}`).toEqual([]);
  });
});
