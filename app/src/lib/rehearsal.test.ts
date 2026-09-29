import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

/** The data modules that cite the script. A new one that does is added here. */
const MODULES = [
  'app/src/lib/masterregister.ts',
  'app/src/lib/launchreadiness.ts',
  'app/src/lib/governance/risk.ts',
  'app/src/lib/governance/edgecases.ts',
  'app/src/lib/ops/claims.ts',
];

/** The sentence that was true once. */
const STALE = /not (yet )?in CI|passes locally|local (dump|rehearsal)|only locally/i;

const citing = (src: string): string[] => src.split('\n').filter((l) => l.includes('restore.sh'));

describe('the restore rehearsal', () => {
  it('runs on every change, by the name the registers use', () => {
    const ci = read('.github/workflows/ci.yml');
    const step = ci.indexOf(`- name: ${STEP}`);
    expect(step, `ci.yml has a step named “${STEP}”`).toBeGreaterThanOrEqual(0);
    expect(ci.slice(step, step + 200)).toMatch(new RegExp(`run: ${SCRIPT}`));
  });

  it('is cited by every module as in CI, never as local', () => {
    let cited = 0;
    for (const m of MODULES) {
      for (const line of citing(read(m))) {
        cited += 1;
        expect(line, `${m}: ${line.trim().slice(0, 120)}`).not.toMatch(STALE);
      }
    }
    expect(cited, 'the modules still cite the script').toBeGreaterThanOrEqual(5);
  });

  it('would read the older sentence as stale', () => {
    expect("shows: 'local dump/restore rehearsal comparing schema and rows; not in CI'").toMatch(STALE);
    expect("note: 'A rehearsal passes locally; production has never been restored'").toMatch(STALE);
    expect('on every change in CI; never against production').not.toMatch(STALE);
  });
});
