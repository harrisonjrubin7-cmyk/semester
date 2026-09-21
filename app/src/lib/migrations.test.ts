import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The ten migrations that were recovered from production, held to production.
 *
 * `supabase/migrations/` holds two kinds of file, and until 21 September it
 * held only one. Eight of them — `20260901000100` through `000800` — are a
 * **desired state**: they have been edited in place for a year and each one
 * now already contains the effect of migrations production applied to it
 * later. The ten numbered `20260907` to `20260911` are a **history**: they
 * were read out of `supabase_migrations.schema_migrations` on the live project
 * and are byte-for-byte what it ran.
 *
 * `MIGRATION-HISTORY.md` step 2 is why the second kind may not be edited: the
 * entire point of them is that the file and the row agree, so an improvement —
 * a tidied comment, a provenance header, a reflowed line — breaks the one
 * property they exist to have. They carry no header saying where they came
 * from for exactly that reason.
 *
 * Nothing else would notice. `check.sh` applies them and would go on passing,
 * because what they produce is what the base eight already produced; the
 * schema fingerprint in step 4 would go on matching for the same reason. The
 * file would simply stop being a record, silently, and the next person to need
 * disaster recovery would be the one to find out.
 *
 * So the md5 of each row was read from production and is pinned here. This
 * cannot reach the database from a test run, and does not pretend to: it pins
 * **the reading taken on 21 September**, which is the honest thing a test can
 * hold. If production's row is ever re-read and disagrees with a column below,
 * that is a finding about the database and belongs in `MIGRATION-HISTORY.md`,
 * not a number to quietly update here.
 */

const ROOT = join(process.cwd(), '..');
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');
const EXPECTED = join(ROOT, 'supabase', 'replay.expected');

/**
 * `md5(array_to_string(statements, E'\n'))`, per row, read from
 * `supabase_migrations.schema_migrations` on the live project, 21 September.
 */
const RECOVERED: ReadonlyArray<readonly [file: string, md5: string]> = [
  ['20260907050718_push_devices_and_queue.sql', '822d2a0f5b08ade4288cedf84b019096'],
  ['20260907133756_push_scheduler_extensions.sql', '6ca07698039de38a5f74d765a67d7508'],
  ['20260907134823_harden_security_definer_helpers.sql', '31ff5589b9a5615b49893785aecc3e3a'],
  ['20260907141019_rls_initplan_and_policy_overlap.sql', '3a4a82f65c93e4688363617ccef499ce'],
  ['20260907141324_wrap_auth_uid_in_helpers.sql', '43a5914d24ab4325a42a77621077e26c'],
  ['20260907141551_index_foreign_keys.sql', '0743e7fb3c2d5ce06c5c2c1b84103bfc'],
  ['20260908053010_classmates_any_school.sql', '377411f71884a98b37b1d31fdbbdebde'],
  ['20260908053943_per_record_sync_with_soft_deletes.sql', 'a091b63a85ee5c7d5839632de9b227fd'],
  ['20260908054007_calendar_feeds.sql', 'c87932c42613c9e4db93d30dbd5dafa9'],
  ['20260911151826_groups.sql', 'c6733bc1d662040d68b1ebbb08a0f10c'],
];

const md5 = (at: string) => createHash('md5').update(readFileSync(at)).digest('hex');

describe('the recovered migrations still are what production ran', () => {
  it.each(RECOVERED)('%s', (file, want) => {
    expect(md5(join(MIGRATIONS, file))).toBe(want);
  });

  /*
   * The probe, pointed at itself.
   *
   * Ten passing rows is also what this file looks like after somebody deletes
   * nine of them, and `it.each([])` passes with no tests at all — the empty
   * tree this repository keeps finding in its own instruments. So the count is
   * asserted separately, and against the number `MIGRATION-HISTORY.md` gives
   * rather than against `RECOVERED.length`, which would be true of any list.
   */
  it('is still ten of them, which is fault 2 in full', () => {
    expect(RECOVERED).toHaveLength(10);
    const onDisk = readdirSync(MIGRATIONS).filter((f) => /^2026(09(0[78])|0911)/.test(f));
    expect(onDisk.sort()).toEqual(RECOVERED.map(([f]) => f).sort());
  });
});

/**
 * The replay's expected refusals, held to the files they name.
 *
 * `supabase/replay.expected` lists the nine statements that are refused when
 * the recovered files are replayed on top of the base eight, and `check.sh`
 * requires the errors to match it exactly. Its header explains why each is a
 * refusal rather than a difference, and step 4 is where that claim is tested.
 *
 * What `check.sh` cannot see is a line naming a file that no longer exists: a
 * stale entry would simply never be consulted, and the list would look better
 * covered than it is. That is the same fault `retention.test.ts` guards in its
 * second direction, and it is guarded the same way.
 */
describe('replay.expected names only files that are there', () => {
  const lines = readFileSync(EXPECTED, 'utf8')
    .split('\n')
    .map((l) => l.replace(/#.*/, '').trim())
    .filter(Boolean);

  /*
   * Nine, not ten. `function public.rls_auto_enable() does not exist` was here
   * until the step-4 fingerprint was widened to cover functions and found that
   * object in production and in no migration file at all — it is created by
   * `20260901000100_schema.sql` now, so the statement applies rather than being
   * refused. The number is asserted so that a line cannot be added back to this
   * list without somebody saying why.
   */
  it('reads the file rather than reporting an empty list', () => {
    expect(lines).toHaveLength(9);
  });

  it('names a migration that exists, on every line', () => {
    const present = new Set(readdirSync(MIGRATIONS));
    const missing = [...new Set(lines.map((l) => l.split('|')[0]))].filter((f) => !present.has(f));
    expect(missing, `replay.expected names files that are not in migrations/: ${missing.join(', ')}`).toEqual([]);
  });

  /*
   * And only ever a recovered one. A base file that starts refusing statements
   * is a broken migration, not a redundant one, and it must not be excusable
   * by adding a line here.
   */
  it('and only ever one of the ten recovered files', () => {
    const recovered = new Set(RECOVERED.map(([f]) => f));
    const wrong = [...new Set(lines.map((l) => l.split('|')[0]))].filter((f) => !recovered.has(f));
    expect(wrong, `replay.expected excuses a file that is not a recovered migration: ${wrong.join(', ')}`).toEqual([]);
  });

  it('carries an error text on every line, not just a filename', () => {
    for (const line of lines) {
      const [file, ...rest] = line.split('|');
      expect(file).toMatch(/\.sql$/);
      expect(rest.join('|').trim().length, `no error text on the line for ${file}`).toBeGreaterThan(10);
    }
  });
});
