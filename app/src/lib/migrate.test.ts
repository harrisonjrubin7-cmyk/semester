import { describe, expect, it } from 'vitest';
import { SCHEMA, STEPS, migrate, migrationLine, versionOf } from './migrate';
import { directoryOf } from './look';

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
