import { describe, expect, it } from 'vitest';
import {
  against,
  cardsFrom,
  forCourse,
  missedFrom,
  pctOf,
  sittingName,
  trend,
  trendLine,
  type Sitting,
} from './sitting';
import type { Question } from './exam';

const choice = (over: Partial<Question> = {}): Question => ({
  id: 'q1',
  kind: 'choice',
  prompt: 'Which is a public good?',
  options: ['A lighthouse', 'A sandwich', 'A haircut', 'A ticket'],
  answer: '0',
  why: 'Non-rival and non-excludable.',
  points: 2,
  ...over,
});

const written = (over: Partial<Question> = {}): Question => ({
  id: 'w1',
  kind: 'short',
  prompt: 'Define deadweight loss.',
  options: [],
  answer: 'The surplus destroyed when the market does not trade the efficient quantity.',
  why: 'Tests whether you can name the mechanism, not the phrase.',
  points: 6,
  ...over,
});

const sitting = (over: Partial<Sitting> = {}): Sitting => ({
  id: 's1',
  courseId: 'econ',
  title: 'ECON 1020 · paper 7PS4',
  at: Date.UTC(2026, 8, 3),
  minutes: 30,
  got: 18,
  outOf: 24,
  pct: 75,
  code: '7PS4',
  missed: [],
  ...over,
});

describe('pctOf', () => {
  it('rounds to a whole percent', () => {
    expect(pctOf(18, 24)).toBe(75);
    expect(pctOf(1, 3)).toBe(33);
  });

  it('is zero rather than NaN for an empty paper', () => {
    expect(pctOf(0, 0)).toBe(0);
  });
});

describe('missedFrom', () => {
  it('keeps a choice question you got wrong, with the right option spelled out', () => {
    const out = missedFrom([choice()], { q1: { given: '2' } });
    // "B" is not something you can revise from three weeks later.
    expect(out).toEqual([
      {
        prompt: 'Which is a public good?',
        answer: 'A lighthouse',
        why: 'Non-rival and non-excludable.',
        kind: 'choice',
      },
    ]);
  });

  it('leaves out one you got right', () => {
    expect(missedFrom([choice()], { q1: { given: '0' } })).toEqual([]);
  });

  it('counts a blank as missed — not answering is the same gap', () => {
    expect(missedFrom([choice()], {})).toHaveLength(1);
    expect(missedFrom([choice()], { q1: { given: '' } })).toHaveLength(1);
  });

  it('keeps a written answer you marked partly, which is the kind most worth seeing again', () => {
    expect(missedFrom([written()], { w1: { given: 'some', mark: 'partly' } })).toHaveLength(1);
    expect(missedFrom([written()], { w1: { given: 'some', mark: 'wrong' } })).toHaveLength(1);
    expect(missedFrom([written()], { w1: { given: 'some', mark: 'right' } })).toEqual([]);
  });

  it('keeps the key rather than what you wrote', () => {
    const out = missedFrom([written()], { w1: { given: 'my rambling attempt', mark: 'wrong' } });
    expect(out[0].answer).toContain('surplus destroyed');
    expect(JSON.stringify(out)).not.toContain('rambling');
  });
});

describe('cardsFrom', () => {
  it('puts the key and what the question tested on one card', () => {
    const cards = cardsFrom(missedFrom([choice()], { q1: { given: '1' } }));
    expect(cards[0].q).toBe('Which is a public good?');
    expect(cards[0].a).toContain('A lighthouse');
    expect(cards[0].a).toContain('Non-rival');
  });

  it('does not leave a dangling blank when there was nothing to explain', () => {
    const cards = cardsFrom([{ prompt: 'P', answer: 'A', why: '', kind: 'short' }]);
    expect(cards[0].a).toBe('A');
  });
});

describe('forCourse', () => {
  it('takes one course, newest first', () => {
    const all = [
      sitting({ id: 'a', at: 1 }),
      sitting({ id: 'b', at: 3 }),
      sitting({ id: 'c', at: 2, courseId: 'psci' }),
    ];
    expect(forCourse(all, 'econ').map((s) => s.id)).toEqual(['b', 'a']);
  });
});

describe('trend', () => {
  it('averages the papers and names the last two', () => {
    const t = trend([sitting({ at: 1, pct: 60 }), sitting({ at: 2, pct: 80 })]);
    expect(t.papers).toBe(2);
    expect(t.average).toBe(70);
    expect(t.latest).toBe(80);
    expect(t.previous).toBe(60);
    expect(t.change).toBe(20);
  });

  it('has no change to report from one paper', () => {
    expect(trend([sitting()]).change).toBe(null);
  });

  it('is empty rather than NaN with nothing sat', () => {
    expect(trend([])).toEqual({
      papers: 0,
      average: 0,
      latest: null,
      previous: null,
      change: null,
      missed: 0,
    });
  });

  it('counts the marks dropped across every paper', () => {
    const one = sitting({ at: 1, missed: [{ prompt: 'a', answer: 'b', why: '', kind: 'short' }] });
    const two = sitting({ at: 2, missed: [{ prompt: 'c', answer: 'd', why: '', kind: 'short' }] });
    expect(trend([one, two]).missed).toBe(2);
  });
});

describe('trendLine', () => {
  it('says plainly when there is nothing yet', () => {
    expect(trendLine(trend([]), [])).toBe('No practice papers yet.');
  });

  it('does not read a trend from one paper', () => {
    const one = [sitting({ pct: 75 })];
    expect(trendLine(trend(one), one)).toContain('One paper');
  });

  it('reads the change when the last two are comparable', () => {
    const two = [sitting({ at: 1, pct: 60 }), sitting({ at: 2, pct: 71 })];
    expect(trendLine(trend(two), two)).toContain('up 11 points');
  });

  it('refuses to compare papers of different lengths', () => {
    // A fifteen-minute paper and a ninety-minute one are different exercises,
    // and "up eleven points" across them is a number invented from nothing.
    const two = [sitting({ at: 1, pct: 60, minutes: 15 }), sitting({ at: 2, pct: 71, minutes: 90 })];
    const said = trendLine(trend(two), two);
    expect(said).toContain('different lengths');
    expect(said).not.toContain('up 11');
  });

  it('says level rather than inventing a direction', () => {
    const two = [sitting({ at: 1, pct: 70 }), sitting({ at: 2, pct: 70 })];
    expect(trendLine(trend(two), two)).toContain('level');
  });

  it('never calls a practice score a grade', () => {
    const two = [sitting({ at: 1, pct: 60 }), sitting({ at: 2, pct: 71 })];
    for (const said of [trendLine(trend(two), two), trendLine(trend([]), [])]) {
      expect(said).not.toMatch(/\bgrade\b/i);
    }
  });
});

describe('against', () => {
  it('says nothing when there is no target to compare with', () => {
    expect(against(80, null)).toBe('');
  });

  it('places a practice average either side of what the rest has to average', () => {
    expect(against(90, 70)).toContain('Comfortably above');
    expect(against(72, 70)).toContain('About level');
    expect(against(65, 70)).toContain('A little under');
    expect(against(40, 70)).toContain('30 points under');
  });

  it('never merges the two into one number', () => {
    // The projection is arithmetic on syllabus weights; a practice score is
    // evidence about you. An average of the two is neither.
    for (const said of [against(90, 70), against(40, 70)]) {
      expect(said).not.toMatch(/\d+%/);
    }
  });
});

describe('sittingName', () => {
  it('names the file by day and paper code', () => {
    expect(sittingName(sitting())).toBe('2026-09-03-paper-7ps4.md');
  });

  it('still names one that has no code', () => {
    expect(sittingName(sitting({ code: '' }))).toBe('2026-09-03-practice-paper.md');
  });
});
