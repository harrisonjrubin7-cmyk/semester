import { describe, expect, it } from 'vitest';
import { FIRST_DB_SCHEMA, forwardFrom } from './index';
import { SCHEMA, STEPS } from '../../lib/migrate';
import { type Persisted } from '../shape';

/**
 * The schema steps, on the database path.
 *
 * `persist/index.ts` promises at the top that what `load()` returns is what
 * `loadPersisted()` returned yesterday, *through the same `lib/migrate.ts`* —
 * and for a year that was only true of the one-time move off localStorage.
 * Everything already in the database was read straight out, so a step added
 * to `STEPS` reached the copies that had not moved yet and silently missed
 * every account that had. That is everybody who has opened the app since the
 * database shipped: exactly the people a migration is written for.
 *
 * Nothing failed when it broke, which is why it is pinned here. The app
 * opened, every screen worked, and the only symptom was a migration that had
 * simply not happened — on the majority of accounts, invisibly.
 */

/** What a database account looks like on the way out of `readEverything`. */
const account = (extra: Partial<Persisted> = {}): Partial<Persisted> =>
  ({ nav: 'tabs', courses: [], notes: [], ...extra }) as Partial<Persisted>;

/**
 * Where the newest navigation-writing step leaves a copy.
 *
 * These tests care that the steps *ran* on the database path, not which
 * navigation they land on — so the expected value is read out of `STEPS`
 * rather than written down, which is what the notes below have always said
 * they were doing.
 *
 * It used to be read off `DEFAULT_PERSISTED.nav` instead, which was the same
 * value for as long as the last step and the fresh-install default agreed.
 * They no longer do: the default is the tab bar and step 6 still writes the
 * workspace, on purpose (`lib/migrate.test.ts` says why). The proxy was never
 * the thing being checked, so this asks the steps directly.
 */
const afterSteps = (): unknown =>
  STEPS.reduce<Record<string, unknown>>((copy, step) => step.run(copy), {}).nav;

describe('moving a database account forward', () => {
  it('runs the steps it has not run', () => {
    const { state } = forwardFrom(account());
    /*
     * Against what the steps themselves produce rather than a literal
     * navigation.
     *
     * Every nav-moving step so far — 4 to the workspace, 5 to the guides, 6
     * back to the workspace — rewrites this field unconditionally, so the
     * account comes out wherever the newest of them puts it. Pinning the
     * literal made this fail on step 5 for a reason that had nothing to do
     * with what it checks, which is that the steps ran at all on the database
     * path. See `afterSteps`.
     */
    expect(state.nav).not.toBe('tabs');
    expect(state.nav).toBe(afterSteps());
    expect(state.schemaVersion).toBe(SCHEMA);
  });

  it('writes what it moved, so it does not run again', () => {
    /*
     * The half that makes it a migration rather than a policy. Without the
     * write, the step runs on every load — and then somebody who reads the
     * new layout and picks the tab bar again finds it undone the next
     * morning, for ever.
     */
    const { writes } = forwardFrom(account());
    const keys = writes.map((w) => w.key);
    expect(keys).toContain('nav');
    expect(keys, 'the marker, or the step runs again tomorrow').toContain('schemaVersion');
  });

  it('writes only what moved, not the whole account', () => {
    // The reference-equality diff `writesFor` does. A step that rebuilt the
    // arrays would rewrite every course, note and card on the way past.
    const { writes } = forwardFrom(account({ courses: [{ course: { id: 'econ' } }] as unknown as Persisted['courses'] }));
    expect(writes.every((w) => w.store === 'settings')).toBe(true);
  });

  it('does nothing at all to an account already at this version', () => {
    const done = account({ nav: 'tabs', schemaVersion: SCHEMA } as Partial<Persisted>);
    const { state, writes } = forwardFrom(done);
    expect(writes).toEqual([]);
    // The same object, not an equal one: a load that rewrote the state would
    // re-render the app against a new reference on every open.
    expect(state).toBe(done);
    expect(state.nav, 'a choice made after the step survives it').toBe('tabs');
  });

  /*
   * A missing marker is not version 1 here.
   *
   * `writesFor` only stores a setting that differs from the default, and every
   * database account was written by a build whose `SCHEMA` equalled its own
   * default marker — so the row matched the default and was never written.
   * Reading that silence the way a raw localStorage blob is read would re-run
   * every step ever written, on every load.
   */
  it('reads a missing marker as the version the database shipped at', () => {
    const { state } = forwardFrom(account({ directory: 'list', shell: 'plain' } as Partial<Persisted>));
    // Step 3 empties a `list` nobody chose — and must not run here, because
    // it already ran on the way in. A `list` in a database account is one
    // somebody has since asked for.
    expect(state.directory, 'step 3 must not run a second time').toBe('list');
    // The nav steps must run, because they never have. Against the steps'
    // own output for the reason given above: which navigation they land on is
    // the newest step's business, not this test's.
    expect(state.nav).not.toBe('tabs');
    expect(state.nav).toBe(afterSteps());
  });

  it('keeps the floor pointing at a version the steps still have', () => {
    /*
     * `FIRST_DB_SCHEMA` is a claim about history: `persist/index.ts` and
     * `SCHEMA = 3` arrived in the same commit, so no database account can
     * predate version 3. If a future step renumbers things so that 3 is no
     * longer a version any step produces, this floor has quietly become a
     * guess and the next migration will skip or repeat itself.
     */
    expect(FIRST_DB_SCHEMA).toBeLessThanOrEqual(SCHEMA);
    expect(
      [1, ...STEPS.map((s) => s.to)],
      'FIRST_DB_SCHEMA names a version no step produces',
    ).toContain(FIRST_DB_SCHEMA);
  });
});
