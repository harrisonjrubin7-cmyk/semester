import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Both deploys wait for CI, and nothing used to say so.
 *
 * `pages.yml` explains at length why publishing on the push rather than on
 * CI's verdict is the whole of "we push straight to production": two workflows
 * watching one event, neither aware of the other, so a commit that failed
 * `tsc` or the policy checks went live at the same moment CI was going red
 * about it.
 *
 * That argument was made about the app and acted on only there. **The Edge
 * Functions kept the ungated trigger for as long as the gate had existed** —
 * the half with the service-role key in it, the AI metering, the calendar feed
 * served past row-level security and the push sender. Nothing was wrong with
 * the reasoning; it simply was not carried across, and nothing in this
 * repository was in a position to notice that it had not been.
 *
 * So the check is over both workflows at once rather than one each. The shape
 * of the failure is a workflow drifting back to `on: push`, or a new deploy
 * being added with the ungated trigger because it is the obvious one to write
 * — and in every version of that, the symptom is not an error. It is a deploy
 * that works, and happens not to have asked.
 *
 * ## What it cannot check
 *
 * That CI is any good, or that its `success` means what anybody hopes. This
 * asserts the gate exists and is wired to the run, not that what it gates on
 * is sufficient — `ci.yml`'s own steps are the argument for that, and they
 * are checked by being run.
 */

const WORKFLOWS = join(process.cwd(), '..', '.github', 'workflows');
const read = (name: string) => readFileSync(join(WORKFLOWS, name), 'utf8');

/** The workflows that put something in front of a student or the project. */
const DEPLOYS = ['pages.yml', 'functions.yml'];

describe('nothing deploys that CI has not passed', () => {
  it.each(DEPLOYS)('%s waits for the CI run rather than the push', (name) => {
    const text = read(name);
    // The trigger. `workflow_run` on CI, filtered to main — a deploy wired to
    // a differently-named workflow is wired to nothing, and fires never
    // rather than always, which is its own quiet failure.
    expect(text, `${name} has no workflow_run trigger`).toMatch(/^on:\n(?:.*\n)*?\s*workflow_run:/m);
    expect(text, `${name} does not name the CI workflow`).toMatch(/workflows:\s*\['CI'\]/);
    expect(text, `${name} is not filtered to main`).toMatch(/branches:\s*\['main'\]/);
  });

  it.each(DEPLOYS)('%s checks the conclusion, not merely that CI finished', (name) => {
    /*
     * The trap this one is for: `types: [completed]` fires on a *failed* run
     * too. A deploy triggered on `workflow_run` and not checking the
     * conclusion is the ungated deploy again, wearing the gate's clothes —
     * and it looks more correct than the version it replaced.
     */
    expect(read(name), `${name} deploys on a completed run without asking how it went`).toMatch(
      /github\.event\.workflow_run\.conclusion == 'success'/,
    );
  });

  it.each(DEPLOYS)('%s deploys the commit CI passed, not the branch head', (name) => {
    /*
     * A `workflow_run` job checks out the default branch head by default, not
     * the commit that triggered it. On this repository that is not a nicety:
     * five merges landed inside two minutes on the afternoon this was
     * written, so an unpinned deploy ships a tree CI never looked at — and in
     * `functions.yml` it also takes the `HEAD^` diff against somebody else's
     * merge, which changes *which* functions go up.
     */
    expect(read(name), `${name} does not pin the checkout to the run's head_sha`).toMatch(
      /ref:\s*\$\{\{\s*github\.event\.workflow_run\.head_sha\s*\}\}/,
    );
  });

  it.each(DEPLOYS)('%s keeps a way in for a person who has decided to', (name) => {
    // The gate has to have a documented override, or the first emergency is
    // spent discovering it does not. `workflow_dispatch` is that override in
    // both, and the job's `if` has to admit it — a dispatch carries no
    // `workflow_run`, so a condition naming only the conclusion locks the
    // escape hatch shut.
    const text = read(name);
    expect(text, `${name} has no workflow_dispatch`).toMatch(/^\s{2}workflow_dispatch:/m);
    expect(text, `${name} would refuse a hand-started deploy`).toMatch(
      /github\.event_name == 'workflow_dispatch'/,
    );
  });

  it('and no deploy workflow still fires on a bare push to main', () => {
    /*
     * The bidirectional half. The assertions above would all pass on a
     * workflow that had `workflow_run` *and* kept its old `push:` trigger —
     * which is the likeliest way this regresses, because adding the gate
     * without removing the old trigger looks like belt and braces and is in
     * fact the ungated deploy plus a second one.
     */
    for (const name of DEPLOYS) {
      const trigger = read(name).match(/^on:\n((?:[ \t].*\n|\n)*)/m)?.[1] ?? '';
      expect(trigger, `${name} still deploys on a bare push`).not.toMatch(/^\s{2}push:/m);
    }
  });

  it('and the probe is reading the workflows rather than an empty directory', () => {
    /*
     * The control, and the reason the sweeps above mean anything: a `read`
     * that threw or a directory that moved would fail loudly, but a `DEPLOYS`
     * list that had quietly gone empty would pass every `it.each` above by
     * running none of them.
     *
     * So the list is checked against the directory: every workflow here that
     * deploys must be one of the two named, and both must exist. A third
     * deploy workflow added later fails this until it is either gated and
     * listed, or explained.
     */
    expect(DEPLOYS.length).toBeGreaterThan(1);
    for (const name of DEPLOYS) {
      expect(existsSync(join(WORKFLOWS, name)), `${name} is gone`).toBe(true);
    }
    const deploying = readdirSync(WORKFLOWS).filter((f) => {
      if (!/\.ya?ml$/.test(f)) return false;
      const text = readFileSync(join(WORKFLOWS, f), 'utf8');
      // A workflow that publishes: it uploads the site, or it runs the
      // Supabase CLI's deploy. `ci.yml` does neither.
      return /actions\/deploy-pages@|supabase functions deploy/.test(text);
    });
    expect(deploying.sort(), 'a workflow deploys and is not covered above').toEqual(
      [...DEPLOYS].sort(),
    );
  });

  it('and CI is still the name both of them are waiting on', () => {
    // The second control. Every assertion above is pinned to the literal
    // `['CI']`, so renaming the CI workflow would leave two deploys waiting
    // on a workflow that no longer exists — firing never, deploying nothing,
    // and going green about it.
    expect(read('ci.yml'), 'the CI workflow is no longer called CI').toMatch(/^name: CI$/m);
  });
});
