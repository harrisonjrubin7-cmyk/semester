import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every row in the ledger needs a file, and thirteen do not have one.
 *
 * `migrationorder.test.ts` guards the fault the renumbering was for: a pending
 * version below the watermark can never be applied. This guards the one
 * standing behind it, which is why production's deploy was still failing after
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
 * ## Why this is a ratchet and not an equality
 *
 * The thirteen are not a mistake to be deleted. Ten are fault 2's, and they sit
 * in `supabase/history/` because the eight baseline files already contain their
 * effects — give them files in `migrations/` and every build from empty applies
 * them twice. Asserting "there are none" would demand a fix this file has no
 * business choosing; `MIGRATION-HISTORY.md` sets out the three shapes that fix
 * could take and why picking one is a decision.
 *
 * So the assertion is a **subset**: the rows without files must be among the
 * thirteen already known. Fixing any of them passes. Adding a fourteenth
 * fails — and a fourteenth is exactly what happened twice on 21 September,
 * when applying migrations by hand to close a live hole wrote
 * `forms_relation_grants` and `access_log_function_search_path` into the ledger
 * with no file behind either. That is the recurrence worth catching: the gap
 * grows by hand, quietly, and the next merge is where it shows.
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

/**
 * The thirteen, read on 21 September 2026 and named rather than counted.
 *
 * A bare number would go stale without saying which row moved. These are the
 * versions a deploy currently complains about, and `MIGRATION-HISTORY.md` says
 * where each one's SQL actually lives.
 */
const KNOWN_WITHOUT_FILES = new Set([
  '20260907050718', // push_devices_and_queue          ─┐
  '20260907133756', // push_scheduler_extensions        │
  '20260907134823', // harden_security_definer_helpers  │
  '20260907141019', // rls_initplan_and_policy_overlap  │ fault 2's ten, in
  '20260907141324', // wrap_auth_uid_in_helpers         │ supabase/history/
  '20260907141551', // index_foreign_keys               │ because the baseline
  '20260908053010', // classmates_any_school            │ already contains them
  '20260908053943', // per_record_sync_with_soft_deletes│
  '20260908054007', // calendar_feeds                   │
  '20260911151826', // groups                          ─┘
  '20260921002658', // revoke_function_execute_from_supabase_default_roles — fault 4
  '20260921144711', // forms_relation_grants            ─┐ applied by hand on
  '20260921150750', // access_log_function_search_path  ─┘ 21 Sep, folded into
  //                                                        the files they belong to
]);

describe('every ledger row a deploy will look for', () => {
  /*
   * The control, first and for the reason the rest of this directory keeps
   * learning: a parse that stopped matching returns an empty ledger, an empty
   * ledger has no rows missing files, and the subset assertion below passes
   * while proving nothing at all.
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

  it('has no row without a file beyond the thirteen already known', () => {
    const files = fileVersions();
    const missing = ledger().filter((r) => !files.has(r.version));
    const unexpected = missing.filter((r) => !KNOWN_WITHOUT_FILES.has(r.version));

    expect(
      unexpected.map((r) => `${r.version} ${r.name}`),
      'a ledger row with no file in supabase/migrations/ stops `db push` before it ' +
        'orders anything: "Remote migration versions not found in local migrations ' +
        'directory". Applying a migration by hand and not writing its file is how ' +
        'this list grew twice on 21 September. See MIGRATION-HISTORY.md.',
    ).toEqual([]);
  });

  /*
   * And the control for *that*: the known list must still describe the ledger.
   * If every one of the thirteen gained a file the check above would pass, and
   * it should — but silently, leaving a stale list nobody revisits. This says
   * so out loud instead.
   */
  it('still needs all thirteen, or the list here is out of date', () => {
    const files = fileVersions();
    const fixed = [...KNOWN_WITHOUT_FILES].filter((v) => files.has(v));
    expect(
      fixed,
      'these versions now have files, so the deploy fault they describe is ' +
        'partly repaired — take them out of KNOWN_WITHOUT_FILES and update ' +
        'MIGRATION-HISTORY.md to say what changed.',
    ).toEqual([]);
  });
});
