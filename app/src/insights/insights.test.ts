import { describe, expect, it } from 'vitest';
import { insights } from './index';
import type { Facts } from './types';
import BUS from '../data/courses/bus';
import type { Answer } from '../lib/sure';
import type { Attended } from '../lib/attend';
import type { Spent } from '../lib/pace';

/**
 * The engine, and mostly its silence.
 *
 * `worked`'s stated principle is the rule for all of this: evidence-based, and
 * silent when the evidence is thin. So the tests that matter are the ones that
 * check nothing is said — a fresh account, a sample one short of the minimum,
 * a result that is real and not worth reporting. A report with two insights
 * and no filler is better than eight with six hedged, and the way that goes
 * wrong is one threshold quietly lowered until a screen looks fuller.
 */

const facts = (over: Partial<Facts> = {}): Facts => ({
  now: new Date(2026, 9, 15),
  courses: [BUS.course],
  items: BUS.items,
  scores: {},
  pieces: {},
  drops: {},
  attendance: [],
  attendPolicy: {},
  answers: [],
  spent: [],
  dated: [],
  done: {},
  sittings: [],
  reviews: {},
  unitOf: () => 'Segmentation',
  codeOf: () => 'BUS 1600',
  ...over,
});

const spent = (n: number, guess: number, minutes: number): Spent[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `i${i}`,
    courseId: 'bus',
    kind: 'Problem set',
    guess,
    minutes,
    at: Date.now() - i * 86_400_000,
  }));

const answers = (n: number, got: boolean, sure: 'know' | 'guess'): Answer[] =>
  Array.from({ length: n }, (_, i) => ({
    key: `k${i}`,
    courseId: 'bus',
    got,
    sure,
    at: Date.now() - i * 3_600_000,
  }));

/** `id` is `courseId:date`, derived — see `Attended`, which explains why. */
const mark = (date: string, m: 'present' | 'absent'): Attended => ({
  id: `bus:${date}`,
  courseId: 'bus',
  date,
  mark: m,
  at: Date.parse(date),
});

const marks = (present: number, absent: number): Attended[] => [
  ...Array.from({ length: present }, (_, i) =>
    mark(`2026-09-${String(i + 1).padStart(2, '0')}`, 'present'),
  ),
  ...Array.from({ length: absent }, (_, i) =>
    mark(`2026-10-${String(i + 1).padStart(2, '0')}`, 'absent'),
  ),
];

const POLICY = { allowed: 2, penaltyPer: 3, worth: 0, note: 'Two absences, then three points each.' };

describe('a fresh account', () => {
  it('says nothing at all', () => {
    // No placeholder, no "not enough data yet", no greyed-out shell.
    expect(insights(facts())).toEqual([]);
  });
});

describe('calibration', () => {
  it('says nothing below five timed pieces of work', () => {
    expect(insights(facts({ spent: spent(4, 120, 200) }))).toEqual([]);
  });

  it('reports the median guess against the median actual', () => {
    const [got] = insights(facts({ spent: spent(6, 120, 200) }));
    expect(got.headline).toBe('You estimate 2 hours. You take about 3 hours 20.');
    expect(got.sampleSize).toBe(6);
  });

  it('says nothing when the estimates are good', () => {
    /*
     * The silence rule applied to a result rather than a sample size.
     * Somebody estimating inside a fifth either way is estimating well, and
     * telling them so is a compliment rather than an insight.
     */
    expect(insights(facts({ spent: spent(8, 120, 130) }))).toEqual([]);
  });

  it('ignores reports made without a guess, which is most of them', () => {
    const noGuess = spent(8, 120, 200).map(({ guess, ...rest }) => {
      void guess;
      return rest;
    });
    expect(insights(facts({ spent: noGuess }))).toEqual([]);
  });

  it('is tentative on a thin sample and firm on a full one', () => {
    expect(insights(facts({ spent: spent(5, 60, 100) }))[0].confidence).toBe('tentative');
    expect(insights(facts({ spent: spent(10, 60, 100) }))[0].confidence).toBe('firm');
  });
});

describe('confident and wrong', () => {
  it('says nothing below eight answers', () => {
    expect(insights(facts({ answers: answers(7, false, 'know') }))).toEqual([]);
  });

  it('names the topic when most of its answers were sure and wrong', () => {
    const [got] = insights(facts({ answers: answers(10, false, 'know') }));
    expect(got.headline).toContain('Segmentation');
    expect(got.headline).toContain('sure and wrong 10 times out of 10');
  });

  it('says nothing when being wrong was not the confident kind', () => {
    // Wrong and unsure is a gap, which every other screen already finds.
    expect(insights(facts({ answers: answers(10, false, 'guess') }))).toEqual([]);
  });

  it('says nothing when the confident-wrong ones are the minority', () => {
    const mixed = [...answers(3, false, 'know'), ...answers(9, true, 'know')].map((a, i) => ({
      ...a,
      key: `k${i}`,
    }));
    expect(insights(facts({ answers: mixed }))).toEqual([]);
  });

  it('leaves out answers whose card belongs to no unit it can find', () => {
    // A card from a deleted unit. Counting it would put a topic-less finding
    // on the screen.
    expect(insights(facts({ answers: answers(10, false, 'know'), unitOf: () => '' }))).toEqual([]);
  });
});

describe('attendance', () => {
  it('says nothing without a policy to measure against', () => {
    expect(insights(facts({ attendance: marks(6, 3) }))).toEqual([]);
  });

  it('says nothing below three marked meetings', () => {
    const got = insights(facts({ attendance: marks(1, 1), attendPolicy: { bus: POLICY } }));
    expect(got).toEqual([]);
  });

  it('says nothing while you are clear with absences to spare', () => {
    // A course that allows two absences is a course where the first is free,
    // and the app does not have an opinion about it.
    expect(insights(facts({ attendance: marks(8, 0), attendPolicy: { bus: POLICY } }))).toEqual([]);
  });

  it('speaks up on the last one', () => {
    const [got] = insights(facts({ attendance: marks(6, 2), attendPolicy: { bus: POLICY } }));
    expect(got.headline).toContain('used all 2 allowed absences');
  });

  it('counts the cost once past the allowance', () => {
    const [got] = insights(facts({ attendance: marks(6, 4), attendPolicy: { bus: POLICY } }));
    expect(got.headline).toContain('2 absences past the 2 allowed, costing 6 points');
    expect(got.rank).toBe(1);
  });

  it('quotes the syllabus rather than paraphrasing the rule', () => {
    const [got] = insights(facts({ attendance: marks(6, 4), attendPolicy: { bus: POLICY } }));
    expect(got.detail).toContain('Two absences, then three points each.');
  });
});

describe('the grade projection', () => {
  const scores = (n: number) =>
    Object.fromEntries(Array.from({ length: n }, (_, i) => [`bus:${i}`, '85']));

  it('says nothing from one graded component', () => {
    expect(insights(facts({ scores: scores(1) }))).toEqual([]);
  });

  it('states how much is still ungraded, in the same breath as the number', () => {
    // The failure this exists to avoid: a real number about a quarter of a
    // course, printed as if it were the course.
    const [got] = insights(facts({ scores: scores(2) }));
    expect(got.headline).toMatch(/BUS 1600: \d+% across 2 of \d+ graded components\./);
    expect(got.detail).toMatch(/\d+% of the grade is still ungraded/);
    expect(got.detail).toMatch(/anywhere from \d+% to \d+%/);
  });

  it('is tentative while most of the course is undecided', () => {
    expect(insights(facts({ scores: scores(2) }))[0].confidence).toBe('tentative');
  });
});

describe('what the engine guarantees', () => {
  it('never ships an insight with no evidence', () => {
    // The line between analysis and a horoscope.
    const all = insights(
      facts({
        spent: spent(8, 60, 140),
        answers: answers(10, false, 'know'),
        attendance: marks(6, 4),
        attendPolicy: { bus: POLICY },
        scores: { 'bus:0': '85', 'bus:1': '78' },
      }),
    );
    expect(all.length).toBeGreaterThan(2);
    for (const i of all) expect(i.evidence.length, i.id).toBeGreaterThan(0);
  });

  it('ranks by what it costs to not know, never by recency', () => {
    const all = insights(
      facts({
        spent: spent(8, 60, 140),
        answers: answers(10, false, 'know'),
        attendance: marks(6, 4),
        attendPolicy: { bus: POLICY },
      }),
    );
    // Points already lost, then a wrong belief, then an estimate that is out.
    expect(all.map((i) => i.id.split(':')[0])).toEqual(['attendance', 'confident', 'calibration']);
  });

  it('produces identical output from identical state', () => {
    // It is a pure function, which is what lets it run offline.
    const f = facts({ spent: spent(8, 60, 140), answers: answers(10, false, 'know') });
    expect(JSON.stringify(insights(f))).toBe(JSON.stringify(insights(f)));
  });

  it('carries on when one insight throws', () => {
    /*
     * These read data somebody typed — a weight worded as "twenty percent", a
     * date that is not one. The screen they appear on is the one people open
     * when they want to know where they stand, and a blank screen is a worse
     * answer than a shorter one.
     */
    const broken = facts({
      spent: spent(8, 60, 140),
      answers: answers(10, false, 'know'),
      unitOf: () => {
        throw new Error('a card key that is not one');
      },
    });
    const all = insights(broken);
    expect(all.map((i) => i.id)).toEqual(['calibration']);
  });
});
