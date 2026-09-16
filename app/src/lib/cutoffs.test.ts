import { describe, expect, it } from 'vitest';
import {
  COMMON_LETTER,
  TOP_BANDS,
  fromTyped,
  letterFor,
  readGradeSystem,
  readOverrides,
  sourceLine,
  systemFor,
  targetsOf,
  type GradeSystem,
} from './cutoffs';
import { landingAt } from './termgpa';
import { NO_SCHOOL, type School } from './school';
import { TARGETS } from './grades';

const school = (data: School['data']): School => ({ ...NO_SCHOOL, id: 'x', name: 'Somewhere', data });

const published: GradeSystem = {
  kind: 'letter',
  scale: [
    { label: 'A', min: 94 },
    { label: 'A-', min: 90 },
    { label: 'B', min: 84 },
  ],
};

describe('where a scale comes from', () => {
  it('takes the course over the school, because the syllabus governs', () => {
    const got = systemFor('econ', { econ: published }, school({ gradeSystem: COMMON_LETTER }));
    expect(got.source).toBe('course');
    expect(targetsOf(got.system)[0].at).toBe(94);
  });

  it('takes the school when the course says nothing', () => {
    const got = systemFor('econ', {}, school({ gradeSystem: published }));
    expect(got.source).toBe('school');
  });

  it('falls through to a stated assumption, not to nothing', () => {
    const got = systemFor('econ', {}, school({}));
    expect(got.source).toBe('assumed');
    expect(got.system).toBe(COMMON_LETTER);
  });

  it('works with no school at all, which is most people', () => {
    expect(systemFor('econ', {}, null).source).toBe('assumed');
  });

  it('says which of the three it was, every time', () => {
    // The screen has to be able to tell a fact from a guess. A caveat that
    // only appears sometimes is worse than none.
    expect(sourceLine('course', null)).toMatch(/this course/i);
    expect(sourceLine('school', school({}))).toContain('Somewhere');
    expect(sourceLine('assumed', null).toLowerCase()).toContain('assumed');
  });

  it('says how to fix an assumption in the same breath as making it', () => {
    expect(sourceLine('assumed', null)).toMatch(/syllabus/i);
  });
});

describe('the targets table', () => {
  it('is the top five, highest first', () => {
    const t = targetsOf(COMMON_LETTER);
    expect(t).toHaveLength(TOP_BANDS);
    expect(t[0].label).toBe('A');
    expect(t.map((x) => x.at)).toEqual([...t.map((x) => x.at)].sort((a, b) => b - a));
  });

  it('matches what the screen showed before, so nothing moved for anyone', () => {
    // The old hardcoded constant. Extraction, not authorship — a Vanderbilt
    // student must see the same five rows they saw yesterday.
    expect(targetsOf(COMMON_LETTER)).toEqual(TARGETS.map((t) => ({ label: t.label, at: t.at })));
  });

  it('is empty for a course marked out of points', () => {
    expect(targetsOf({ kind: 'points' })).toEqual([]);
  });
});

describe('naming the grade somebody currently has', () => {
  it('reads a percentage into a band', () => {
    expect(letterFor(95, COMMON_LETTER)).toBe('A');
    expect(letterFor(93, COMMON_LETTER)).toBe('A');
    expect(letterFor(92.9, COMMON_LETTER)).toBe('A−');
    expect(letterFor(0, COMMON_LETTER)).toBe('F');
  });

  it('says nothing rather than guessing', () => {
    expect(letterFor(null, COMMON_LETTER)).toBe('');
    expect(letterFor(88, { kind: 'points' })).toBe('');
  });

  it('uses the course’s own letters, not the common ones', () => {
    // A school without minus grades gets its own labels back.
    const flat: GradeSystem = { kind: 'letter', scale: [{ label: 'A', min: 90 }, { label: 'B', min: 80 }] };
    expect(letterFor(91, flat)).toBe('A');
    expect(letterFor(85, flat)).toBe('B');
  });
});

describe('a scale that arrived from somewhere else', () => {
  it('drops a shape it does not recognise', () => {
    expect(readGradeSystem(null)).toBeNull();
    expect(readGradeSystem('letter')).toBeNull();
    expect(readGradeSystem({ kind: 'vibes' })).toBeNull();
  });

  it('keeps the kind with no scale, which is a real state', () => {
    expect(readGradeSystem({ kind: 'points' })).toEqual({ kind: 'points' });
  });

  it('drops bands that are not percentages', () => {
    const got = readGradeSystem({
      kind: 'letter',
      scale: [{ label: 'A', min: 93 }, { label: 'B', min: 900 }, { label: '', min: 80 }, { label: 'C', min: -1 }],
    });
    expect(got?.scale?.map((b) => b.label)).toEqual(['A', 'B', 'C']);
    expect(got?.scale?.[1].min).toBeUndefined();
    expect(got?.scale?.[2].min).toBeUndefined();
  });

  it('refuses a gpa cap that is not a number of points', () => {
    expect(readGradeSystem({ kind: 'letter', gpaMax: 0 })?.gpaMax).toBeUndefined();
    expect(readGradeSystem({ kind: 'letter', gpaMax: 4.3 })?.gpaMax).toBe(4.3);
  });

  it('reads a whole map of overrides and drops only the bad rows', () => {
    const got = readOverrides({ econ: { kind: 'letter' }, psci: 'nope', bus: { kind: 'custom' } });
    expect(Object.keys(got).sort()).toEqual(['bus', 'econ']);
  });

  it('is not confused by an array where a map belongs', () => {
    expect(readOverrides([{ kind: 'letter' }])).toEqual({});
  });
});

describe('cutoffs somebody typed', () => {
  it('builds a scale', () => {
    const got = fromTyped([{ label: 'A', min: '94' }, { label: 'B', min: '85' }]);
    expect(targetsOf(got as GradeSystem)).toEqual([
      { label: 'A', at: 94 },
      { label: 'B', at: 85 },
    ]);
  });

  it('drops a blank rather than reading it as zero', () => {
    // A band at zero makes everything an A, which is the one wrong answer
    // that looks like good news.
    const got = fromTyped([{ label: 'A', min: '94' }, { label: 'B', min: '' }]);
    expect(got?.scale).toHaveLength(1);
  });

  it('drops something that is not a percentage', () => {
    expect(fromTyped([{ label: 'A', min: 'ninety' }])).toBeNull();
    expect(fromTyped([{ label: 'A', min: '140' }])).toBeNull();
  });

  it('comes back null when nothing usable was typed, so the fallback holds', () => {
    expect(fromTyped([])).toBeNull();
    expect(fromTyped([{ label: '', min: '90' }])).toBeNull();
  });

  /*
   * What correcting your cutoffs does to the rest of the app.
   *
   * `components/Cutoffs.tsx` exists so a student can put their syllabus's own
   * cutoffs in place of the assumed ones. What came back priced nothing —
   * a band was a label and a number, and what the letter is *worth* was
   * dropped on the floor — so `landingAt` read every letter as null points
   * and `lib/termgpa.ts` took the course out of the term GPA entirely, with
   * "the scale states no grade points". Using the correction cost you the
   * projection.
   *
   * Reproduced before it was fixed: a scale typed here put A− at null where
   * the common scale puts it at 3.7.
   */
  it('keeps what each letter is worth, so a corrected scale still counts', () => {
    const got = fromTyped(
      [
        { label: 'A', min: '94' },
        { label: 'A−', min: '90' },
        { label: 'B+', min: '87' },
      ],
      COMMON_LETTER,
    )!;
    expect(landingAt(91, got)).toEqual({ pct: 91, letter: 'A−', points: 3.7 });
    expect(got.gpaMax).toBe(4);
  });

  it('carries the points the school states, not a 4.0 table', () => {
    // The distinction the fix turns on. Points are read out of the scale that
    // was in force and already on screen — a school grading to 4.3 keeps its
    // own numbers rather than being quietly re-priced to somebody else's.
    const theirs: GradeSystem = {
      kind: 'letter',
      gpaMax: 4.3,
      scale: [
        { label: 'A+', min: 95, gpa: 4.3 },
        { label: 'A', min: 90, gpa: 4 },
        { label: 'F', min: 0, gpa: 0 },
      ],
    };
    const got = fromTyped([{ label: 'A+', min: '97' }, { label: 'A', min: '92' }], theirs)!;
    expect(got.gpaMax).toBe(4.3);
    expect(landingAt(98, got).points).toBe(4.3);
  });

  it('leaves a letter the scale never priced unpriced, rather than inventing one', () => {
    const odd: GradeSystem = { kind: 'letter', scale: [{ label: 'S', min: 70 }] };
    const got = fromTyped([{ label: 'S', min: '75' }], odd)!;
    expect(landingAt(80, got).points).toBeNull();
  });

  it('keeps the bands the table does not show', () => {
    /*
     * `targetsOf` hands the editor the top five, because the useful question
     * is what the next reachable grade costs. The save used to replace the
     * whole scale with those five, so correcting an A− on a twelve-band table
     * left a five-band one and a mark in the seventies landed on no letter at
     * all — which the term arithmetic reads as zero.
     */
    const got = fromTyped([{ label: 'A', min: '94' }], COMMON_LETTER)!;
    expect(got.scale?.map((b) => b.label)).toContain('D−');
    expect(got.scale?.map((b) => b.label)).toContain('F');
    expect(landingAt(94, got)).toMatchObject({ letter: 'A', points: 4 });
    expect(landingAt(64, got)).toMatchObject({ letter: 'D', points: 1 });
  });

  it('still drops a band the typist blanked, because a blank is not a zero', () => {
    // The editor says so in as many words, and keeping the untouched bands
    // must not resurrect a shown one that was deliberately cleared.
    const got = fromTyped(
      [
        { label: 'A', min: '94' },
        { label: 'A−', min: '' },
      ],
      COMMON_LETTER,
    )!;
    expect(got.scale?.map((b) => b.label)).not.toContain('A−');
    expect(got.scale?.map((b) => b.label)).toContain('F');
  });

  it('sorts what it returns, so the bands read down the scale', () => {
    const got = fromTyped([{ label: 'B', min: '84' }, { label: 'A', min: '94' }], COMMON_LETTER)!;
    const mins = (got.scale ?? []).map((b) => b.min ?? 0);
    expect(mins).toEqual([...mins].sort((a, b) => b - a));
  });
});
