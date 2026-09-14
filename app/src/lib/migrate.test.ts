import { describe, expect, it } from 'vitest';
import { SCHEMA, STEPS, migrate, migrationLine, versionOf } from './migrate';
import { directoryOf } from './look';
import { DEFAULT_PERSISTED } from '../state/shape';

describe('what version a stored copy is', () => {
  it('treats a missing marker as the first version', () => {
    // Not corruption — it is what almost every stored copy is right now.
    expect(versionOf({ courses: [] })).toBe(1);
  });

  it('reads a marker it was given', () => {
    expect(versionOf({ schemaVersion: 2 })).toBe(2);
  });

  it('refuses a marker that is not a version', () => {
    expect(versionOf({ schemaVersion: 'two' })).toBe(1);
    expect(versionOf({ schemaVersion: 0 })).toBe(1);
    expect(versionOf({ schemaVersion: -3 })).toBe(1);
  });
});

describe('moving forward', () => {
  it('stamps an unmarked copy without touching what is in it', () => {
    const before = { courses: [{ id: 'econ' }], notes: ['a'], accent: 'copper' };
    const m = migrate(before);
    expect(m.from).toBe(1);
    expect(m.to).toBe(SCHEMA);
    expect(m.state.courses).toEqual([{ id: 'econ' }]);
    expect(m.state.accent).toBe('copper');
    expect(m.state.schemaVersion).toBe(SCHEMA);
  });

  it('does nothing to a copy already at the current version', () => {
    const m = migrate({ schemaVersion: SCHEMA, notes: ['a'] });
    expect(m.ran).toEqual([]);
    expect(m.state.notes).toEqual(['a']);
  });

  it('does not mutate what it was handed', () => {
    const before: Record<string, unknown> = { notes: ['a'] };
    migrate(before);
    expect('schemaVersion' in before).toBe(false);
  });

  it('says what it did', () => {
    expect(migrationLine(migrate({}))).toContain('version 1');
    expect(migrationLine(migrate({ schemaVersion: SCHEMA }))).toContain('Nothing to do');
  });
});

describe('step 3: the directory nobody chose', () => {
  /*
   * `directory` shipped with `list` as its initial value and the state is
   * written whole every save, so a stored `list` on a non-soft shell says
   * nothing about what anybody wanted. Emptying it puts the copy back into
   * "nobody has chosen", where the layout answers.
   */
  it('empties a list that was only ever the default', () => {
    expect(migrate({ directory: 'list', shell: 'plain' }).state.directory).toBe('');
    expect(migrate({ directory: 'list', shell: 'grouped' }).state.directory).toBe('');
  });

  it('keeps a list somebody had to ask for', () => {
    // Soft's own answer is the tiles, so a stored list against it is a choice.
    expect(migrate({ directory: 'list', shell: 'soft' }).state.directory).toBe('list');
  });

  it('never touches the tiles, under any shell', () => {
    for (const shell of ['plain', 'grouped', 'soft']) {
      expect(migrate({ directory: 'tiles', shell }).state.directory).toBe('tiles');
    }
  });

  it('changes nothing on screen for the copies it empties', () => {
    // The whole claim of emptying only the non-soft ones: the resolver gives
    // back exactly what was stored, so the setting only starts differing if
    // they go to soft.
    for (const shell of ['plain', 'grouped']) {
      const after = migrate({ directory: 'list', shell }).state;
      expect(directoryOf(String(after.directory), shell)).toBe('list');
    }
  });

  it('leaves the rest of the copy alone', () => {
    const m = migrate({ directory: 'list', shell: 'plain', notes: ['a'], accent: 'copper' });
    expect(m.state.notes).toEqual(['a']);
    expect(m.state.accent).toBe('copper');
  });
});

describe('step 4: the workspace, for everybody', () => {
  const at3 = (extra: Record<string, unknown> = {}) => ({ schemaVersion: 3, ...extra });

  /*
   * Step 4 in isolation, rather than through `migrate`.
   *
   * These two used to run the whole chain from 3 and assert the navigation it
   * came out with, which read as a test of step 4 and was really a test of
   * "whichever step touched `nav` last". Step 5 moves it again, so both went
   * red for a change that has nothing to do with step 4 — and left step 4
   * itself unasserted. What this describe block is *about* is that step 4
   * rewrites the navigation unconditionally, so that is what it runs.
   *
   * The tests below that are genuinely about the chain — running once, and
   * touching nothing else — still go through `migrate`, because that is what
   * they are about.
   */
  const step4 = (nav: string) => {
    const step = STEPS.find((s) => s.to === 4);
    if (!step) throw new Error('step 4 is gone — steps are kept forever, see migrate.ts');
    return step.run({ nav });
  };

  it('moves a copy that has only ever had the tab bar', () => {
    // Which is every copy ever written: `nav` has always been persisted, so
    // the literal `tabs` in there was put there by the app, not chosen.
    expect(step4('tabs').nav).toBe('workspace');
  });

  it('moves the other three as well, which is the trade it is', () => {
    // Unconditional, and deliberately so — there is no record anywhere of
    // whether a navigation was chosen or defaulted, so "leave the ones
    // somebody picked" is not a rule this can implement. Asserted rather than
    // left implicit: it is the part of the step worth seeing in a diff.
    for (const nav of ['feed', 'springboard', 'shelves']) {
      expect(step4(nav).nav, nav).toBe('workspace');
    }
  });

  it('runs once, so going back to the tab bar sticks', () => {
    /*
     * The whole reason this is a step behind a version marker rather than a
     * line in the loader. Somebody reads the new layout, decides against it,
     * and picks the bar again — and the app has to keep that, on this device
     * and every reopening after. A step that re-ran would overrule the
     * setting it offers, every morning.
     */
    const after = migrate(at3({ nav: 'tabs' })).state;
    const chosen = { ...after, nav: 'tabs' };
    expect(migrate(chosen).state.nav).toBe('tabs');
    expect(migrate(chosen).ran).toEqual([]);
  });

  it('touches nothing else in the copy', () => {
    const before = at3({
      nav: 'shelves',
      shell: 'soft',
      ground: 'oxide',
      courses: [{ id: 'econ' }],
      done: { 'econ-m1': true },
      favourites: 'study,calendar',
    });
    const after = migrate(before).state;
    expect(after.shell).toBe('soft');
    expect(after.ground).toBe('oxide');
    expect(after.courses).toEqual([{ id: 'econ' }]);
    expect(after.done).toEqual({ 'econ-m1': true });
    expect(after.favourites).toBe('study,calendar');
  });

  it('leaves the collections by reference, so a save writes only what moved', () => {
    // `state/persist/index.ts` diffs the migrated copy against the one it
    // read, by reference, to decide what to write back. A step that rebuilt
    // the arrays would rewrite every record in the account on the way past.
    const courses = [{ id: 'econ' }];
    expect(migrate(at3({ nav: 'tabs', courses })).state.courses).toBe(courses);
  });
});

describe('step 5: the guides, for everybody', () => {
  const step5 = (nav: string) => {
    const step = STEPS.find((s) => s.to === 5);
    if (!step) throw new Error('step 5 is gone — steps are kept forever, see migrate.ts');
    return step.run({ nav });
  };

  it('moves a copy that step 4 put on the workspace', () => {
    // Which is every copy opened since step 4 shipped: step 4 wrote that
    // literal `workspace`, so it says nothing about what anybody chose — the
    // same argument step 4 made about the `tabs` before it.
    expect(step5('workspace').nav).toBe('guides');
  });

  it('moves the other four as well, which is the same trade step 4 made', () => {
    for (const nav of ['tabs', 'feed', 'springboard', 'shelves']) {
      expect(step5(nav).nav, nav).toBe('guides');
    }
  });

  it('is still in the list, because steps are kept forever', () => {
    // Step 6 undoes it, which is not the same as deleting it: a copy stored
    // at 4 has to walk through 5 to reach 6, and a gap in the list is how a
    // step stops running for the people who never got it.
    expect(STEPS.map((s) => s.to)).toEqual([...STEPS.map((s) => s.to)].sort((a, b) => a - b));
    expect(STEPS.some((s) => s.to === 5)).toBe(true);
  });

  it('touches nothing else in the copy', () => {
    const after = migrate({
      schemaVersion: 4,
      nav: 'workspace',
      shell: 'soft',
      ground: 'oxide',
      done: { 'econ-m1': true },
    }).state;
    expect(after.shell).toBe('soft');
    expect(after.ground).toBe('oxide');
    expect(after.done).toEqual({ 'econ-m1': true });
  });
});

describe('step 6: the workspace again', () => {
  const step6 = (nav: string) => {
    const step = STEPS.find((s) => s.to === 6);
    if (!step) throw new Error('step 6 is gone — steps are kept forever, see migrate.ts');
    return step.run({ nav });
  };

  it('puts back what step 5 overwrote', () => {
    expect(step6('guides').nav).toBe('workspace');
  });

  it('lands a copy coming all the way from 4 on the workspace it started on', () => {
    // The round trip, asserted end to end: step 4 wrote `workspace`, step 5
    // wrote `guides` over it, step 6 puts it back. Nothing was chosen at any
    // point in that, which is the only reason undoing it loses nothing.
    expect(migrate({ schemaVersion: 4, nav: 'tabs' }).state.nav).toBe('workspace');
  });

  it('is where a fresh install lands too, so the two cannot drift', () => {
    // A default that disagreed with the last step is how somebody's phone and
    // laptop end up in different navigations. Against the constant rather than
    // the literal, so the next move has to change both.
    expect(DEFAULT_PERSISTED.nav).toBe('workspace');
  });

  it('runs once, so choosing the guides sticks', () => {
    /*
     * The same guarantee steps 4 and 5 carry, and the one that matters most
     * here: this step is a reversal, and a reversal that reapplied itself
     * would take the guides away from somebody every time they reopened the
     * app. Somebody picks the guides on Layout and navigation, and the app
     * has to keep that, on this device and every reopening after.
     */
    const after = migrate({ schemaVersion: 5, nav: 'guides' }).state;
    expect(after.nav).toBe('workspace');
    const chosen = { ...after, nav: 'guides' };
    expect(migrate(chosen).state.nav).toBe('guides');
    expect(migrate(chosen).ran).toEqual([]);
  });

  it('touches nothing else in the copy', () => {
    const after = migrate({
      schemaVersion: 5,
      nav: 'guides',
      shell: 'soft',
      ground: 'oxide',
      done: { 'econ-m1': true },
    }).state;
    expect(after.shell).toBe('soft');
    expect(after.ground).toBe('oxide');
    expect(after.done).toEqual({ 'econ-m1': true });
  });
});

describe('a copy from the future', () => {
  it('is left exactly as it is', () => {
    // Somebody opening a laptop on last month's build, after their phone wrote
    // this month's shape. Walking their data backwards through steps written
    // for an older format is worse than reading what is recognised.
    const ahead = { schemaVersion: SCHEMA + 4, somethingNew: 'kept' };
    const m = migrate(ahead);
    expect(m.fromFuture).toBe(true);
    expect(m.ran).toEqual([]);
    expect(m.state.schemaVersion).toBe(SCHEMA + 4);
    expect(m.state.somethingNew).toBe('kept');
  });

  it('says so plainly rather than as an error', () => {
    const said = migrationLine(migrate({ schemaVersion: SCHEMA + 1 }));
    expect(said).toContain('Left as it is');
    expect(said.toLowerCase()).not.toContain('error');
    expect(said.toLowerCase()).not.toContain('corrupt');
  });
});

describe('the steps themselves', () => {
  it('go up one at a time with no gaps', () => {
    // A gap means a stored copy at the missing version runs the wrong steps.
    const versions = STEPS.map((s) => s.to);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    versions.forEach((v, i) => expect(v).toBe(i + 2));
  });

  it('end at the version this build writes', () => {
    expect(STEPS[STEPS.length - 1].to).toBe(SCHEMA);
  });

  it('each say what they do', () => {
    for (const s of STEPS) {
      expect(s.describe.length, String(s.to)).toBeGreaterThan(10);
    }
  });

  it('run in order from the oldest version', () => {
    const seen: number[] = [];
    const spy = STEPS.map((s) => ({
      ...s,
      run: (x: Record<string, unknown>) => {
        seen.push(s.to);
        return s.run(x);
      },
    }));
    let out: Record<string, unknown> = {};
    for (const s of spy) if (s.to > 1) out = s.run(out);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });
});

describe('rubbish in storage', () => {
  it('becomes an empty state rather than throwing', () => {
    for (const bad of [null, undefined, 'a string', 42, [1, 2, 3]]) {
      expect(() => migrate(bad)).not.toThrow();
      expect(migrate(bad).state.schemaVersion).toBe(SCHEMA);
    }
  });
});
