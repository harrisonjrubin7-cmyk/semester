import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A rollback plan is a claim about the repository, so it is checked like one.
 *
 * `ROLLBACK.md` says three things that are only true while the workflows stay
 * as they are, and every one of them fails silently: a rollback plan whose
 * preconditions have quietly gone is not a plan that breaks loudly during an
 * incident, it is a plan that was already broken and nobody knew. So:
 *
 *   **`pages.yml` must accept `workflow_dispatch`.** Without it the only way
 *   to redeploy an earlier commit is an empty commit on main, which is slower
 *   and puts a lie in the history. The document's whole procedure is that one
 *   trigger.
 *
 *   **`pages.yml` must not cancel a deploy in flight.** A cancelled deploy can
 *   leave the site serving a partial build, which during a rollback means the
 *   incident is now two incidents.
 *
 *   **Nothing may apply a migration.** The document's central rule — that the
 *   app rolls back and the schema does not — is written on the fact that
 *   schema changes are manual. If somebody wires migrations into CI, the rule
 *   stops being the rule and the document is wrong in the most expensive
 *   possible way. This test is the tripwire.
 *
 * What it deliberately does *not* check is the rule that matters most: that a
 * migration leaves the database readable by the previous app version. That is
 * a property of a change, not of a file, and no test in this repository can
 * see it. It is stated in the document rather than pretended at here.
 */

const ROOT = join(process.cwd(), '..');
const DOC = join(ROOT, 'ROLLBACK.md');
const WORKFLOWS = join(ROOT, '.github', 'workflows');

const workflow = (name: string) => readFileSync(join(WORKFLOWS, name), 'utf8');
const doc = () => readFileSync(DOC, 'utf8');

/** The `on:` block only, so a `workflow_dispatch` in a comment is not a trigger. */
function triggers(source: string): string {
  const from = source.indexOf('\non:');
  expect(from, 'the workflow has no on: block').toBeGreaterThan(-1);
  const rest = source.slice(from + 1);
  // Up to the next top-level key, which is the first line starting in column 1
  // after the first.
  const end = rest.slice(1).search(/\n[a-z]/);
  return end === -1 ? rest : rest.slice(0, end + 1);
}

describe('the document exists and names somebody', () => {
  it('is there at all', () => {
    expect(existsSync(DOC), 'ROLLBACK.md is gone').toBe(true);
  });

  it('names an owner, and not a placeholder', () => {
    const said = doc();
    /*
     * The checklist asks for a *defined* owner, so an unfilled one is the
     * exact failure being guarded against — a document that looks complete
     * and names nobody.
     */
    expect(said).toMatch(/@[A-Za-z0-9-]+/);
    for (const placeholder of ['TODO', 'TBD', 'FIXME', '<owner>', 'XXX']) {
      expect(said, `the owner is still ${placeholder}`).not.toContain(placeholder);
    }
  });

  it('commits to a time, in a number somebody can hold it to', () => {
    expect(doc()).toMatch(/under \w+ minutes/i);
  });

  it('says plainly that the schema does not roll back', () => {
    expect(doc()).toMatch(/does not roll the schema back/i);
  });
});

describe('the preconditions the procedure rests on', () => {
  it('pages.yml can be run by hand, which is the whole procedure', () => {
    expect(triggers(workflow('pages.yml')), 'no workflow_dispatch on the Pages deploy').toContain(
      'workflow_dispatch',
    );
  });

  it('functions.yml can be too, which is the other half', () => {
    expect(triggers(workflow('functions.yml'))).toContain('workflow_dispatch');
  });

  it('a deploy is never cancelled in flight, because a partial site is worse', () => {
    expect(workflow('pages.yml')).toContain('cancel-in-progress: false');
  });

  /*
   * The control on the trigger probe, and the second version of it.
   *
   * The first asserted that `ci.yml`'s triggers do not contain
   * `workflow_dispatch` — which is true, and useless: `ci.yml` does not
   * contain that word *anywhere*, so a parser that returned the entire file
   * would have passed it. The mutation harness found that by breaking the
   * parser and watching this test stay green, which is the whole reason a
   * control is mutated rather than admired.
   *
   * So it is pinned to something that certainly is in the file and certainly
   * is not a trigger. If `triggers()` ever starts handing back more than the
   * `on:` block, this goes red before the two tests above start passing on
   * nothing.
   */
  it('and the probe reads triggers rather than the whole file', () => {
    const block = triggers(workflow('pages.yml'));
    expect(block, 'the trigger block now reaches the job body').not.toContain('actions/checkout');
    expect(block, 'the trigger block no longer reaches the triggers').toContain('workflow_dispatch');
    // And the thing it must not reach is genuinely there to be reached.
    expect(workflow('pages.yml')).toContain('actions/checkout');
  });
});

describe('the rule that nothing applies a migration', () => {
  it('holds, and this is the tripwire for the day it stops', () => {
    /*
     * If this goes red, `ROLLBACK.md` is wrong rather than this test being
     * wrong: somebody has automated migrations, and the document's central
     * claim — that the app rolls back and the schema does not — needs
     * rewriting before the next incident rather than after it.
     */
    const applies = /supabase\s+db\s+push|supabase\s+migration\s+up|db\s+reset/;
    for (const name of readdirSync(WORKFLOWS)) {
      expect(applies.test(workflow(name)), `${name} appears to apply migrations`).toBe(false);
    }
  });

  it('and there are migrations for it to be a rule about', () => {
    // The control: a rule about migrations means nothing if there are none,
    // and this test would pass just as well against an empty directory.
    const migrations = readdirSync(join(ROOT, 'supabase', 'migrations'));
    expect(migrations.filter((f) => f.endsWith('.sql')).length).toBeGreaterThan(5);
  });
});

describe('what the document points at exists', () => {
  it('every workflow it names is a workflow that is there', () => {
    const named = [...doc().matchAll(/`(\w+\.yml)`/g)].map((m) => m[1]);
    expect(named.length, 'the document names no workflows at all').toBeGreaterThan(1);
    for (const name of new Set(named)) {
      expect(existsSync(join(WORKFLOWS, name)), `${name} is named but not there`).toBe(true);
    }
  });

  it('and every repository file it links to', () => {
    const linked = [...doc().matchAll(/\]\((?!https?:)([^)#]+)\)/g)].map((m) => m[1]);
    expect(linked.length, 'the document links to no files').toBeGreaterThan(0);
    for (const path of new Set(linked)) {
      expect(existsSync(join(ROOT, path)), `${path} is linked but not there`).toBe(true);
    }
  });
});
