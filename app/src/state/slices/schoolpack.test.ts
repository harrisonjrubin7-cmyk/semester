import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { globSync } from 'node:fs';
import { reducer } from '../reducer';
import { DEFAULT_PERSISTED, initialEphemeral, type State } from '../shape';
import { BUNDLED, everySchool, resolveSchool } from '../../data/schools';
import { readPack, readSchoolPack, writePack } from '../../lib/schoolpack';
import { moveOut } from '../../lib/school';

/**
 * A pack that is loaded and changes nothing is the failure this file exists
 * for.
 *
 * `lib/schoolpack.ts` can read a university's file perfectly and it does not
 * matter unless the profile it produces is the one the screens resolve to.
 * The bundled Vanderbilt copy used to win every lookup for `vanderbilt` — see
 * `data/schools/index.ts` — so a corrected calendar would have imported
 * cleanly, reported no problem, and left the old dates on screen with nothing
 * anywhere to say why. That is the state COMPLETION-PLAN.md §8b calls built
 * and unreachable, and it is what every test below is really checking.
 */

function base(): State {
  return { ...DEFAULT_PERSISTED, ...initialEphemeral(), mySchools: [], schoolPack: null } as State;
}

/** Vanderbilt's own profile, with one date the bundled copy leaves blank. */
const corrected = () => {
  const read = readPack(
    JSON.stringify({
      ...JSON.parse(writePack(BUNDLED.vanderbilt, '2026-08-01')),
      data: {
        ...BUNDLED.vanderbilt.data,
        academicCalendar: [{ ...BUNDLED.vanderbilt.data.academicCalendar![0], endsOn: '2026-12-11' }],
      },
    }),
  );
  expect(read.ok).toBe(true);
  return read;
};

describe('a loaded pack is the profile the screens get', () => {
  it('beats the bundled copy of the same school', () => {
    const read = corrected();
    expect(resolveSchool('vanderbilt', null, [], read.school).data.academicCalendar![0].endsOn).toBe('2026-12-11');
  });

  it('and the bundled copy is what they get without one — the control', () => {
    // Without this the test above passes against a resolver that always
    // returns its fourth argument.
    expect(resolveSchool('vanderbilt', null, [], null).data.academicCalendar![0].endsOn).toBe('');
  });

  it('does not leak into a different school', () => {
    const read = corrected();
    expect(resolveSchool('somewhere-else', null, [], read.school).id).toBe('');
  });

  it('is ignored when no school is selected at all', () => {
    const read = corrected();
    expect(resolveSchool('', null, [], read.school).id).toBe('');
  });

  it('carries a rule through to the answer a screen actually shows', () => {
    // Not the field — the thing computed from it. A pack that set the field
    // and never reached `moveOut` would pass a field test.
    const read = readPack(
      JSON.stringify({
        semesterSchoolPack: 1,
        id: 'example',
        name: 'Example University',
        importedAt: '2026-08-01',
        capabilities: { housing: true, mealPlan: 'none', campusMap: false },
        data: { housing: { moveOutRule: 'hours_after_last_exam', hoursAfterLastExam: 48 } },
      }),
    );
    const school = resolveSchool('example', null, [], read.school);
    const lastExam = Date.parse('2026-12-11T12:00:00Z');
    expect(moveOut(school.data, lastExam)).toBe(lastExam + 48 * 3_600_000);
  });
});

describe('a pack in the searchable list', () => {
  it('replaces the school it corrects rather than sitting beside it', () => {
    const read = corrected();
    const all = everySchool([], read.school);
    expect(all.filter((s) => s.id === 'vanderbilt')).toHaveLength(1);
    expect(all.find((s) => s.id === 'vanderbilt')!.data.academicCalendar![0].endsOn).toBe('2026-12-11');
  });

  it('is findable when it names a school nothing else has', () => {
    const read = readPack(JSON.stringify({ semesterSchoolPack: 1, id: 'example', name: 'Example University', importedAt: '2026-08-01' }));
    expect(everySchool([], read.school).map((s) => s.id)).toContain('example');
  });

  it('leaves the list alone when there is no pack', () => {
    expect(everySchool([], null).map((s) => s.id)).toEqual(['vanderbilt']);
  });
});

describe('loading and removing one', () => {
  it('selects the school it describes, so the import visibly does something', () => {
    const read = corrected();
    const after = reducer(base(), { type: 'importSchoolPack', school: read.school!, importedAt: read.importedAt });
    expect(after.schoolId).toBe('vanderbilt');
    expect(after.schoolPack?.importedAt).toBe('2026-08-01');
  });

  it('replaces a pack already loaded, because "this year\'s calendar" means one', () => {
    const first = reducer(base(), { type: 'importSchoolPack', school: corrected().school!, importedAt: '2026-08-01' });
    const second = reducer(first, { type: 'importSchoolPack', school: corrected().school!, importedAt: '2026-09-01' });
    expect(second.schoolPack?.importedAt).toBe('2026-09-01');
  });

  it('falls back to the bundled profile when the file is removed, rather than to nothing', () => {
    const after = reducer(
      reducer(base(), { type: 'importSchoolPack', school: corrected().school!, importedAt: '2026-08-01' }),
      { type: 'forgetSchoolPack' },
    );
    expect(after.schoolPack).toBeNull();
    // The selection stays. A pack corrects a profile that already exists, so
    // dropping the file should return to that profile and not to no school.
    expect(after.schoolId).toBe('vanderbilt');
    expect(resolveSchool(after.schoolId, null, after.mySchools, null).data.academicCalendar![0].endsOn).toBe('');
  });

  it('does not make a new state object when there was nothing to forget', () => {
    const before = base();
    expect(reducer(before, { type: 'forgetSchoolPack' })).toBe(before);
  });
});

describe('a pack survives a reload', () => {
  it('reads back off the device with the school and the date intact', () => {
    const read = corrected();
    const stored = JSON.parse(JSON.stringify({ school: read.school, importedAt: read.importedAt }));
    const back = readSchoolPack(stored);
    expect(back?.importedAt).toBe('2026-08-01');
    expect(back?.school.data.academicCalendar![0].endsOn).toBe('2026-12-11');
  });

  it('cannot come back verified, however the stored copy was edited', () => {
    // Storage is not a trust boundary the app controls. `verified` means
    // "not editable by a stranger", and a file never earns it.
    const back = readSchoolPack({ school: { ...BUNDLED.vanderbilt, verified: true }, importedAt: '2026-08-01' });
    expect(back?.school.verified).toBe(false);
  });

  it.each([null, undefined, 'vanderbilt', 42, {}, { school: {} }, { school: { id: 'x' } }])(
    'reads %s back as no pack rather than as a broken one',
    (stored) => expect(readSchoolPack(stored)).toBeNull(),
  );

  it('drops a stored date that is not a date', () => {
    expect(readSchoolPack({ school: BUNDLED.vanderbilt, importedAt: 'last August' })?.importedAt).toBe('');
  });
});

describe('every caller resolves the same way', () => {
  /**
   * A call site that forgets the pack is the whole fault, one argument wide.
   *
   * `ai/providers/upkeep.ts` carried the comment *"the same resolution the
   * store does"* and then stopped doing it the moment a fourth argument
   * existed — silently, because three arguments still type-check and still
   * return a school. What it would have produced is the assumed American
   * grade scale in the tutor's answer while the screen beside it used the
   * one the university published, which is a whole grade band apart on a
   * school that publishes different cutoffs.
   *
   * So this counts arguments rather than trusting the comment. It reads the
   * tree, because the next call site has not been written yet.
   */
  const callers = (): { file: string; call: string }[] => {
    const root = join(process.cwd(), 'src');
    const files = globSync('**/*.{ts,tsx}', { cwd: root })
      .filter((f) => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));
    const out: { file: string; call: string }[] = [];
    for (const file of files) {
      const src = readFileSync(join(root, file), 'utf8');
      for (const m of src.matchAll(/resolveSchool\(([\s\S]{0,240}?)\)[;,)\s]/g)) {
        // The declaration itself, not a call.
        if (/^\s*id: string/.test(m[1])) continue;
        out.push({ file, call: m[1] });
      }
    }
    return out;
  };

  it('found the call sites, so the rest of this means something', () => {
    expect(callers().length).toBeGreaterThan(0);
  });

  it('passes the loaded pack, every time', () => {
    const thin = callers().filter(({ call }) => !/schoolPack/.test(call));
    expect(thin.map((c) => c.file)).toEqual([]);
  });
});
