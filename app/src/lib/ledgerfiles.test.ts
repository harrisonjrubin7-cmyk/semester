import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every row in the ledger has a file, and the deploy refuses to start without.
 *
 * `migrationorder.test.ts` guards the fault the renumbering was for: a pending
 * version below the watermark can never be applied. This guards the one that
 * was standing behind it, and which kept production's schema deploy red after
 * the renumbering landed.
 *
 * `db push` does not begin by ordering anything. It first compares the remote
 * ledger against `supabase/migrations/` and refuses outright if the database
 * knows a version the directory does not:
 *
 *     ERROR Remote migration versions not found in local migrations directory.
 *
 * That is the error the project's `workflow_run_logs` carried on every merge to
 * `main` on 21 September — 17:30, 17:33, 17:37 twice, 17:42, 17:44 — each one
 * taking the branch record to `CREATING_PROJECT` and back to
 * `MIGRATIONS_FAILED`. The SQL was never reached, so no suite that runs SQL
 * could have seen it, and `rehearse.sh` says so in its own header: it cannot
 * see the ledger.
 *
 * ## It was a ratchet, and now it is a floor
 *
 * Written first as a subset check — the rows without files had to be among the
 * thirteen already known — because the thirteen were not a mistake to delete.
 * Ten were the recovered history, which must not be applied a second time on
 * top of a baseline that already contains them, and choosing how to satisfy
 * both requirements was a decision rather than a patch.
 *
 * The decision was made: `migrations/` carries a **stub** for each of those
 * versions, holding the version and no SQL. A deploy finds the version and
 * skips the file, because the ledger already has the row; a build from empty
 * runs it and nothing happens. So the count is zero and this asserts zero —
 * which is a stronger statement than the subset ever was, and the one worth
 * keeping: *a migration reaching production without a file here is a broken
 * deploy*, and that is true of the next one as much as of those thirteen.
 */

const ROOT = join(process.cwd(), '..');
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');
const SNAPSHOT = join(ROOT, 'supabase', 'ledger.snapshot');

/** `version  name` per line, comments and blanks dropped. */
function ledger(): { version: string; name: string }[] {
  return readFileSync(SNAPSHOT, 'utf8')
    .split('\n')
    .map((l) => l.replace(/#.*/, '').trim())
    .filter(Boolean)
    .map((l) => {
      const [version, ...rest] = l.split(/\s+/);
      return { version, name: rest.join(' ') };
    });
}

/** The fourteen-digit version each file in `migrations/` would be pushed under. */
function fileVersions(): Set<string> {
  return new Set(
    readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => f.slice(0, 14)),
  );
}

describe('every ledger row a deploy will look for', () => {
  /*
   * The control, first and for the reason this directory keeps relearning: a
   * parse that stopped matching returns an empty ledger, an empty ledger has
   * no rows missing files, and the assertion below passes while proving
   * nothing at all.
   */
  it('reads the snapshot as rows, each a fourteen-digit version and a name', () => {
    const rows = ledger();
    expect(rows.length).toBeGreaterThanOrEqual(20);
    for (const r of rows) {
      expect(r.version).toMatch(/^\d{14}$/);
      expect(r.name).not.toBe('');
    }
  });

  /* The other half of the control: the directory must be readable too. */
  it('reads the migrations directory', () => {
    expect(fileVersions().size).toBeGreaterThanOrEqual(10);
  });

  it('has a file, of any kind, for every version the database already ran', () => {
    const files = fileVersions();
    const missing = ledger().filter((r) => !files.has(r.version));

    expect(
      missing.map((r) => `${r.version} ${r.name}`),
      'a ledger row with no file in supabase/migrations/ stops `db push` before it ' +
        'orders anything: "Remote migration versions not found in local migrations ' +
        'directory". Applying a migration by hand and not writing its file is how ' +
        'this happened thirteen times. An empty stub carrying the version is enough ' +
        'and is what the others do — see any file in migrations/ with no SQL in it.',
    ).toEqual([]);
  });
});
