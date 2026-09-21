import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A migration numbered in the past cannot run, and nothing here could see it.
 *
 * Production's schema deploy was broken from 18 to 21 September and this
 * repository was green throughout. `supabase/check.sh` applies `migrations/` to
 * an empty Postgres in filename order, where every file runs and every suite
 * passes — a true statement about a database nobody is running. What the deploy
 * does is different: `db push` applies only the versions the live ledger does
 * not already have, **in version order**, so a pending version lower than the
 * highest applied one is in the past relative to a database that has moved on,
 * and the push fails. Supabase's own documentation names it.
 *
 * Seven files were in that state. They were numbered `20260901000900` through
 * `20260901001500`; production's watermark had reached `20260911151826` a
 * fortnight earlier, because ten migrations had been applied through the
 * dashboard and the management API rather than from here. Every merge touching
 * `supabase/` after that failed on a branch record in a dashboard, with no
 * issue, no red tick, and nothing in this repository able to tell.
 *
 * ## What this checks, and what it deliberately does not
 *
 * `supabase/ledger.snapshot` is a dated reading of the live ledger. Nothing in
 * a test run can reach the project, and a test that pretended to would be worse
 * than one that says what it is — so this holds `migrations/` to the reading
 * rather than to the database, and the file's header says a newer reading that
 * disagrees is a finding, not a number to update in passing.
 *
 * The rule is **not** "every migration must already be applied". A new
 * migration is supposed to be pending; that is what a migration is. The rule is
 * that a pending version may not be **below the watermark**, because that one
 * can never run. A new file numbered above it is fine and stays fine.
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

/** The version each file in `migrations/` would be pushed under. */
function fileVersions(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.slice(0, 14))
    .sort();
}

describe('the ledger snapshot is a reading, and still reads like one', () => {
  /*
   * The control. A parse that stopped matching would return an empty ledger,
   * and an empty ledger makes the watermark `undefined` — which every
   * comparison below would then pass, reporting all clear on a probe that had
   * read nothing. That is the failure this repository keeps finding in its own
   * instruments, so the shape is asserted before anything is concluded from it.
   */
  it('parses twenty-six rows, every one a fourteen-digit version and a name', () => {
    const rows = ledger();
    expect(rows).toHaveLength(26);
    for (const { version, name } of rows) {
      expect(version, `not a version: ${version}`).toMatch(/^\d{14}$/);
      expect(name.length, `no name for ${version}`).toBeGreaterThan(2);
    }
  });

  it('is sorted, because the watermark is only the last line if it is', () => {
    const versions = ledger().map((r) => r.version);
    expect(versions).toEqual([...versions].sort());
  });
});

describe('no migration is numbered in the past', () => {
  /*
   * The whole defect, in one assertion.
   *
   * Pending = a file version the ledger does not carry. Below the watermark =
   * lower than the highest version it does. A file that is both cannot ever be
   * applied by a push, and the push fails rather than skipping it.
   */
  it('every pending migration is above the watermark', () => {
    const applied = new Set(ledger().map((r) => r.version));
    const watermark = ledger()[ledger().length - 1].version;
    const stranded = fileVersions().filter((v) => !applied.has(v) && v < watermark);
    expect(
      stranded,
      `these are pending and below the watermark ${watermark}, so the deploy cannot apply them: ${stranded.join(', ')}`,
    ).toEqual([]);
  });

  /*
   * And the probe against the fault it is for. These are the seven numbers the
   * files carried until 21 September — every one of them pending, every one
   * below the watermark, which is exactly the state that broke the deploy. If
   * the assertion above ever stops being able to see this, it is not checking
   * anything.
   */
  it('and would have caught the seven that broke it', () => {
    const applied = new Set(ledger().map((r) => r.version));
    const watermark = ledger()[ledger().length - 1].version;
    const before = [
      '20260901000900', '20260901001000', '20260901001100', '20260901001200',
      '20260901001300', '20260901001400', '20260901001500',
    ];
    const stranded = before.filter((v) => !applied.has(v) && v < watermark);
    expect(stranded).toEqual(before);
  });

  /*
   * The other half, and it is not "nothing is pending".
   *
   * That was the first version of this test and it was wrong: it went red for a
   * newly added migration numbered above the watermark, which is the one thing
   * the rule above explicitly permits. A guard that forbids adding a migration
   * would have been removed within the week, by somebody who was right to.
   *
   * What is worth pinning is the *mapping*. Seven files were renumbered on
   * 21 September to the versions production had recorded their content under,
   * and a renumbering is only correct if each file landed on its own row rather
   * than on some other one. A version that exists but belongs to different
   * content would satisfy every assertion above and be a silent lie.
   *
   * The name is what distinguishes them. It matches exactly for six of the
   * seven; `function_grants` is recorded as `function_grants_rerun_after_access_log`,
   * because production ran that file twice and this is the second run — the one
   * after `access_log` existed, which is the run that closes `note_access` and
   * `read_feed`. Hence prefix rather than equality, and the direction matters:
   * the ledger name extends the file's, never the other way round.
   */
  it('and every applied file sits on the row its own content was recorded as', () => {
    const rows = new Map(ledger().map((r) => [r.version, r.name]));
    const wrong: string[] = [];
    for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql'))) {
      const version = file.slice(0, 14);
      const slug = file.slice(15).replace(/\.sql$/, '');
      const name = rows.get(version);
      if (name === undefined) continue; // pending, and the watermark test owns it
      if (!name.startsWith(slug)) wrong.push(`${file} sits on a row named "${name}"`);
    }
    expect(wrong, wrong.join('; ')).toEqual([]);
  });
});

describe('the ten recovered migrations stay out of the push', () => {
  /*
   * `history/` holds what production ran. Its ten versions are all in the
   * ledger, so a push would skip them — but they must not be in `migrations/`
   * for a different reason, measured rather than argued: put there, they break
   * a *preview* branch, which starts empty and applies every file from scratch
   * rather than consulting production's ledger. `history/README.md` and
   * `migrationhistory.test.ts` hold that line; this asserts the consequence
   * the ledger makes visible.
   */
  it('are in the ledger, so a push has nothing to do with them', () => {
    const applied = new Set(ledger().map((r) => r.version));
    const history = readdirSync(join(ROOT, 'supabase', 'history'))
      .filter((f) => f.endsWith('.sql'))
      .map((f) => f.slice(0, 14));
    expect(history).toHaveLength(10);
    expect(history.filter((v) => !applied.has(v))).toEqual([]);
  });
});
