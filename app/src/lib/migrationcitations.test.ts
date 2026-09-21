import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A migration that cites another migration by filename has to name one that
 * exists.
 *
 * The migrations in this repository explain themselves at length, and they
 * explain themselves by pointing at each other — *"`…_function_grants.sql` is
 * the file that explains why at length"*, *"`…_referrals.sql` records that
 * one"*. That is the right way to write them and it has a failure mode nothing
 * was watching: **a renumbering moves the file and leaves the prose behind.**
 *
 * It has already happened twice in one day.
 *
 * `#588` renumbered seven migrations above production's watermark. `#600`
 * merged ninety seconds later from a branch cut before that, carrying
 * `lti.sql`, whose comments cited `20260921003500_referrals.sql` and
 * `20260921003600_function_grants.sql` — names that were correct when they were
 * typed and were already gone when they merged. `#608` then renumbered
 * `lti.sql` itself, fixed the two references *to* it in `DEPLOY.md` and
 * `functions/lti/index.ts`, and did not touch the two references *inside* it,
 * because nothing said they were broken.
 *
 * So four citations sat in `migrations/20260921160000_lti.sql` pointing at
 * files that resolve nowhere in the tree. Fixed in the same commit as this
 * file; this is what stops the next renumbering doing it again.
 *
 * ## Why a citation may live in `history/`
 *
 * `supabase/history/` holds the ten migrations that were applied to production
 * through the dashboard and never had a file here. They are real files and
 * citing one is legitimate — `local.stub.sql` and
 * `migrations/20260921144011_function_grants.sql` both cite
 * `20260907134823_harden_security_definer_helpers.sql`, which is exactly where
 * it should be. A guard that demanded every citation resolve under
 * `migrations/` would call those two wrong and would be teaching people to stop
 * citing history, so both directories count.
 *
 * ## What is deliberately out of scope
 *
 * [MIGRATION-HISTORY.md](../../../MIGRATION-HISTORY.md) is the one document
 * whose job is to discuss names that no longer exist: it carries
 * `20260901000900_usage_atomic.sql` and six siblings as the record of what
 * those files were called before `#588`. Those citations are *correct as
 * history* and dangling by design, which is why this reads only under
 * `supabase/` and says so rather than adding an exception list somebody would
 * later widen.
 *
 * The files *inside* `history/` are out of scope for the same reason, and it is
 * the stronger case. They are byte-for-byte transcriptions of what production
 * ran, fingerprinted in [`MANIFEST`](../../../supabase/history/MANIFEST) and
 * re-checked by `migrationhistory.test.ts`. `20260921144711` names
 * `20260901001100_forms.sql`, which is what `forms` was called on the afternoon
 * it ran; correcting that to today's number would make the file a better
 * citation and a false record, and would fail its own md5. A record's prose is
 * part of the record. They are still resolved *against*, so a citation pointing
 * into `history/` counts — what is excluded is reading them as prose to check.
 */

const ROOT = join(process.cwd(), '..');
const SUPABASE = join(ROOT, 'supabase');

/** A migration filename: fourteen digits, an underscore, a snake_case name. */
const CITATION = /\b(2026\d{10}_[a-z0-9_]+\.sql)\b/g;

/** Files under `supabase/` that can carry prose, recursively. */
function readable(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const at = join(dir, entry.name);
    // `history/` holds transcriptions, not prose somebody may correct. See the
    // header. `MANIFEST` is read, because it is this repository's own writing.
    if (entry.isDirectory()) {
      if (entry.name !== 'history') out.push(...readable(at));
      else out.push(join(at, 'MANIFEST'), join(at, 'README.md'));
    }
    else if (/\.(sql|md|sh|ts|toml|snapshot)$/.test(entry.name) || entry.name === 'MANIFEST') {
      out.push(at);
    }
  }
  return out;
}

/** Every migration filename that exists, in either directory. */
function existing(): Set<string> {
  const names = new Set<string>();
  for (const dir of ['migrations', 'history']) {
    for (const f of readdirSync(join(SUPABASE, dir))) {
      if (f.endsWith('.sql')) names.add(f);
    }
  }
  return names;
}

interface Citation {
  /** Path relative to the repository root, for a failure somebody can act on. */
  where: string;
  name: string;
}

function citations(): Citation[] {
  const out: Citation[] = [];
  for (const path of readable(SUPABASE)) {
    const text = readFileSync(path, 'utf8');
    for (const m of text.matchAll(CITATION)) {
      out.push({ where: path.slice(ROOT.length + 1), name: m[1] });
    }
  }
  return out;
}

const found = citations();
const exists = existing();

describe('migration filenames cited under supabase/', () => {
  /*
   * The control, and it is the whole reason to believe the assertion after it.
   * A regex that stopped matching, a directory walk that returned nothing, or a
   * rename of `migrations/` would all produce an empty list — and an empty list
   * satisfies "every citation resolves" perfectly. That is the failure
   * [CLAUDE.md](../../../CLAUDE.md) keeps finding in this repository's own
   * instruments, and the one this session paid for twice.
   */
  it('are found at all, before anything is concluded from them', () => {
    expect(found.length, 'no citations were found — the scan is broken').toBeGreaterThan(10);
    expect(exists.size, 'no migrations were found — the directories moved').toBeGreaterThan(15);
  });

  it('every one names a file that exists', () => {
    const dangling = found.filter((c) => !exists.has(c.name));
    expect(
      dangling.map((c) => `${c.where} cites ${c.name}`),
      'a renumbering moved the file and left the prose behind',
    ).toEqual([]);
  });

  /*
   * The second control. The assertion above would also pass if `existing()`
   * were somehow returning every name ever asked of it, so one citation is
   * checked in the other direction: a name nobody has written must not resolve.
   */
  it('does not resolve a filename that was never there', () => {
    expect(exists.has('20260101000000_not_a_migration.sql')).toBe(false);
  });

  it('accepts a citation that resolves in history/ rather than migrations/', () => {
    /*
     * Pinned because it is the case a stricter version of this guard would get
     * wrong, and getting it wrong would push people towards deleting honest
     * references to what production actually ran.
     */
    const inHistory = readdirSync(join(SUPABASE, 'history')).filter((f) => f.endsWith('.sql'));
    expect(inHistory.length, 'history/ is empty').toBeGreaterThan(5);
    const cited = found.filter((c) => inHistory.includes(c.name));
    expect(cited.length, 'no history file is cited, so this case is untested').toBeGreaterThan(0);
    for (const c of cited) expect(exists.has(c.name)).toBe(true);
  });

  it('reads the migrations that do the citing, not only the ones cited', () => {
    // The scan has to cover `migrations/` itself: three of the four citations
    // this file was written for were inside a migration's own comments, and a
    // walk that only read the docs would have missed every one.
    const fromMigrations = found.filter((c) => c.where.startsWith('supabase/migrations/'));
    expect(fromMigrations.length, 'no migration cites another').toBeGreaterThan(2);
  });
});
