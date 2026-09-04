import { describe, expect, it } from 'vitest';
import {
  COMMON_LETTER,
  TOP_BANDS,
  fromTyped,
  hasCutoffs,
  letterFor,
  readGradeSystem,
  readOverrides,
  sourceLine,
  systemFor,
  targetsOf,
  type GradeSystem,
} from './cutoffs';
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

  it('is empty for a scale with grade points and no cutoffs', () => {
    // A university publishing "an A− is worth 3.7" has not said what earns
    // one. Drawing a cutoff table from that would be inventing the number the
    // student then plans around.
    const points: GradeSystem = { kind: 'letter', gpaMax: 4, scale: [{ label: 'A', gpa: 4 }] };
    expect(targetsOf(points)).toEqual([]);
    expect(hasCutoffs(points)).toBe(false);
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
});
