import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The drift check is only a check while it still runs.
 *
 * `supabase/ledgerdrift.sh` reads the live ledger and says where it differs
 * from this repository. Everything it catches was previously found by
 * accident — a deploy that had been failing for three days, a CI run that went
 * red, a fingerprint that happened to come up three columns short. The script
 * is the answer to that and the schedule is what makes it an answer, so this
 * holds the wiring rather than the logic: the script's own behaviour is proved
 * by running it, four readings and four outcomes, which a unit test cannot do
 * without reaching a project.
 *
 * ## What is asserted, and the one thing deliberately not
 *
 * That it is scheduled, that it can be run by hand, and — the one people get
 * wrong — that it is **not** attached to `pull_request`. It needs a project
 * credential, so on a fork it cannot pass; a check a contributor cannot run is
 * how a repository stops taking contributions. `ci.yml` decides whether a
 * change is good. This decides whether the database has quietly stopped
 * matching the repository, which is not a property of anybody's diff.
 *
 * Not asserted: what the script concludes. That belongs to the script, and a
 * test that mocked a ledger to check an awk pipeline would be testing its own
 * fixture.
 */

const ROOT = join(process.cwd(), '..');
const SCRIPT = join(ROOT, 'supabase', 'ledgerdrift.sh');
const WORKFLOW = join(ROOT, '.github', 'workflows', 'ledger.yml');

const workflow = () => readFileSync(WORKFLOW, 'utf8');

/**
 * The `on:` block only, so that `workflow_dispatch` written in a comment is
 * not mistaken for a trigger. Lifted from `rollback.test.ts`, which learned
 * the distinction the expensive way.
 */
function triggers(source: string): string {
  const from = source.indexOf('\non:');
  expect(from, 'the workflow has no on: block').toBeGreaterThan(-1);
  const rest = source.slice(from + 1);
  const end = rest.slice(1).search(/\n[a-z]/);
  return end === -1 ? rest : rest.slice(0, end + 1);
}

describe('the ledger drift check', () => {
  it('exists, and is a thing that can be run', () => {
    expect(existsSync(SCRIPT), 'supabase/ledgerdrift.sh is gone').toBe(true);
    expect(statSync(SCRIPT).mode & 0o111, 'the script is not executable').toBeGreaterThan(0);
  });

  it('is scheduled, because nobody remembers to look', () => {
    const on = triggers(workflow());
    expect(on, 'the drift check no longer runs on a schedule').toMatch(/^\s+schedule:/m);
    expect(on, 'no cron under the schedule').toMatch(/cron:/);
  });

  it('and can still be run by hand, which is how you check after a deploy', () => {
    expect(triggers(workflow())).toMatch(/workflow_dispatch/);
  });

  /*
   * The assertion this file is most for.
   *
   * Attaching it to `pull_request` is the obvious next thought and it is the
   * wrong one twice over: the job needs `SUPABASE_ACCESS_TOKEN`, so it fails
   * on every fork; and the drift it looks for is not introduced by a diff, so
   * gating diffs on it blames whoever opened the next pull request for what
   * somebody did in the SQL editor.
   */
  it('does not gate pull requests, which it could not pass on a fork', () => {
    const on = triggers(workflow());
    expect(on, 'the drift check now gates pull requests').not.toMatch(/pull_request/);
  });

  /*
   * The control for the three above. `triggers()` returning an empty string —
   * a renamed file, a reformatted `on:` block — makes "does not match
   * pull_request" pass while proving nothing, which is the failure this
   * repository keeps finding in its own instruments.
   */
  it('and the trigger block was actually read', () => {
    const on = triggers(workflow());
    expect(on.length, 'the on: block came back empty, so the checks above read nothing')
      .toBeGreaterThan(20);
    expect(on, 'this is not the on: block').toMatch(/^\s*on:/);
  });

  it('is written down where somebody looking for it would look', () => {
    const monitoring = readFileSync(join(ROOT, 'MONITORING.md'), 'utf8');
    expect(monitoring, 'MONITORING.md does not mention the drift check').toMatch(
      /ledgerdrift\.sh/,
    );
  });
});
