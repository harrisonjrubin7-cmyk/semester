import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `supabase/history/` holds the ten migrations that existed only in
 * production, and its whole value is that each file equals the row it was read
 * from. Nothing else about it is interesting: it is never applied, so a
 * mistake in it cannot break a deploy — it can only quietly stop being a
 * record of what the database ran, which is the one thing it is for.
 *
 * So the test is the fingerprints. `MANIFEST` carries the md5 and byte length
 * the live ledger reported for each row before any of it was copied, and every
 * file is re-hashed here. A file somebody tidied, reflowed, or added a
 * trailing newline to is a file that no longer describes production, and it
 * fails.
 *
 * The second half is the mistake that would actually cost something. Moved
 * into `supabase/migrations/` these stop being records: `check.sh` would apply
 * them to a throwaway cluster, Branching would send them at preview branches,
 * and the third of them fails outright because `classmates.sql` has long since
 * absorbed it. `supabase/history/README.md` explains that at length; this
 * makes it a rule rather than a paragraph.
 */

const ROOT = join(process.cwd(), '..');
const HISTORY = join(ROOT, 'supabase', 'history');

const md5 = (b: Buffer) => createHash('md5').update(b).digest('hex');

type Row = { md5: string; bytes: number; file: string };

const manifest = (): Row[] =>
  readFileSync(join(HISTORY, 'MANIFEST'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))
    .map((l) => {
      const [sum, bytes, file] = l.split(/\s+/);
      return { md5: sum, bytes: Number(bytes), file };
    });

describe('the recovered migration history', () => {
  it('lists every migration that reached production without a file', () => {
    /*
     * The control for everything below: a manifest that had gone empty would
     * pass every per-file check there is, because there would be none.
     *
     * Ten to begin with, from 7 to 11 September. Two more on 21 September —
     * `forms_relation_grants` and `access_log_function_search_path`, applied by
     * hand that afternoon while three sessions were writing about the habit of
     * applying things by hand. A count rather than a floor, so that a thirteenth
     * arriving is a decision somebody makes here rather than a number that
     * drifts.
     */
    expect(manifest()).toHaveLength(12);
  });

  it('holds exactly the files the manifest names, and no others', () => {
    const onDisk = readdirSync(HISTORY)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    expect(onDisk).toEqual(manifest().map((r) => r.file).sort());
  });

  it('and every one still equals the row it was read from', () => {
    for (const row of manifest()) {
      const bytes = readFileSync(join(HISTORY, row.file));
      expect(bytes.length, `${row.file} is no longer the length the ledger reported`).toBe(
        row.bytes,
      );
      expect(md5(bytes), `${row.file} no longer matches its ledger fingerprint`).toBe(row.md5);
    }
  });

  it('is kept out of the migrations directory as statements, not as names', () => {
    const dir = join(ROOT, 'supabase', 'migrations');
    const migrations = readdirSync(dir).filter((f) => f.endsWith('.sql'));

    /*
     * This asked whether `migrations/` contained a file with the record's
     * *name*, which was the right question until `migrations/` gained a stub
     * per ledger row — one carrying the version and no SQL, so that
     * `db push` can find it and skip it. The stubs take the same names, so a
     * name check now fails on the fix.
     *
     * The hazard was never the name. It is the statements: applied on top of
     * the baseline, which already contains their effects, the third of these
     * fails outright because `classmates.sql` absorbed it. So the question is
     * asked about content instead, which is what the old check stood in for
     * and is harder to satisfy by accident.
     */
    const recorded = manifest().map((r) => r.md5);
    for (const f of migrations) {
      expect(recorded, `migrations/${f} is byte-identical to a history record`).not.toContain(
        md5(readFileSync(join(dir, f))),
      );
    }

    /*
     * And the half that is new. A stub is not optional decoration: remove one
     * and the deploy goes straight back to "Remote migration versions not
     * found in local migrations directory", which is the error that kept
     * production's schema deploy red and which no suite running SQL could see.
     */
    for (const row of manifest()) {
      const version = row.file.slice(0, 14);
      expect(
        migrations.some((f) => f.startsWith(version)),
        `no file in migrations/ carries version ${version}, so a deploy will refuse to start`,
      ).toBe(true);
    }

    // The control: there are migrations there for either check to have bitten on.
    expect(migrations.length).toBeGreaterThan(5);
  });

  it('and says on its face that it is not a migration set', () => {
    const readme = readFileSync(join(HISTORY, 'README.md'), 'utf8');
    expect(readme, 'the directory no longer warns against applying it').toMatch(
      /record, not a migration set/i,
    );
  });
});
