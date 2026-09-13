import { describe, expect, it } from 'vitest';
import { FIRST_DB_SCHEMA, forwardFrom } from './index';
import { SCHEMA, STEPS } from '../../lib/migrate';
import type { Persisted } from '../shape';

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

describe('moving a database account forward', () => {
  it('runs the steps it has not run', () => {
    const { state } = forwardFrom(account());
    expect(state.nav).toBe('workspace');
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
    // Step 4 must run, because it never has.
    expect(state.nav).toBe('workspace');
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
