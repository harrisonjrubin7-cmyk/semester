import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The restore rehearsal runs in CI, and the registers have kept saying it
 * does not.
 *
 * `supabase/restore.sh` has run on every change as “Rehearse a backup and
 * restore” since the constraints fingerprint went red unnoticed. Five copies
 * of the older sentence — a local rehearsal, not in CI — were found one at a
 * time: the test plan (#935), the storage-outage note (#939), the
 * `backup-restore` gate (D-115), and then SRE-005, R-03, the DR plan's row
 * and the claims register, all in one pass. Each was true when written. This
 * holds every data module that cites the script to the workflow, so the
 * sixth copy cannot be written.
 *
 * It does not say the rehearsal proves a production restore: it runs against
 * an empty database, and production has never been restored (R-10).
 */

const root = join(import.meta.dirname, '../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const SCRIPT = 'supabase/restore.sh';
const STEP = 'Rehearse a backup and restore';

/**
 * Every source file under app/src that cites the script or the rehearsal, found by reading
 * the tree rather than kept as a list: a list is one more copy to go stale,
 * and Codex found three citing modules the first draft's list had missed.
 * Tests are left out, since this one cites the sentence on purpose.
 */
function citingFiles(dir = join(root, 'app/src')): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...citingFiles(full));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && CITES.test(readFileSync(full, 'utf8'))) {
      out.push(relative(root, full));
    }
  }
  return out.sort();
}

/** The sentence that was true once. */
const STALE = /not (yet )?in CI|passes locally|local (dump|rehearsal)|only locally/i;

/** A line about the script or the rehearsal, by either name. */
const CITES = /restore\.sh|rehears/i;
const citing = (src: string): string[] => src.split('\n').filter((l) => CITES.test(l));

describe('the restore rehearsal', () => {
  it('runs on every change, by the name the registers use', () => {
    const ci = read('.github/workflows/ci.yml');
    const step = ci.indexOf(`- name: ${STEP}`);
    expect(step, `ci.yml has a step named “${STEP}”`).toBeGreaterThanOrEqual(0);
    expect(ci.slice(step, step + 200)).toMatch(new RegExp(`run: ${SCRIPT}`));
  });

  it('is cited by every source file as in CI, never as local', () => {
    const files = citingFiles();
    // The five modules the first draft listed by hand, and the three Codex found.
    for (const known of ['masterregister.ts', 'launchreadiness.ts', 'governance/risk.ts', 'governance/edgecases.ts', 'ops/claims.ts', 'launchkit.ts', 'operationalreality.ts', 'ops/evidence.ts']) {
      expect(files, `the walk finds app/src/lib/${known}`).toContain(`app/src/lib/${known}`);
    }
    for (const f of files) {
      for (const line of citing(read(f))) expect(line, `${f}: ${line.trim().slice(0, 120)}`).not.toMatch(STALE);
    }
  });

  it('would read the older sentence as stale', () => {
    expect("shows: 'local dump/restore rehearsal comparing schema and rows; not in CI'").toMatch(STALE);
    expect("note: 'A rehearsal passes locally; production has never been restored'").toMatch(STALE);
    expect('on every change in CI; never against production').not.toMatch(STALE);
  });
});
