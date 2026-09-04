import { describe, expect, it } from 'vitest';
import {
  ENOUGH_REPORTS,
  FLOOR,
  UNSURE,
  bestBuys,
  calibrate,
  calibrationLine,
  corrected,
  eveningLine,
  fits,
  overHours,
  projectGrade,
  projectionLine,
  spread,
  type BuyInput,
} from './worth';
import type { Standing } from './grades';
import type { Spent } from './pace';

const at = (patch: Partial<Standing>): Standing =>
  ({
    rows: [],
    earned: 0,
    counted: 0,
    remaining: 0,
    current: null,
    extraCredit: 0,
    pointsOff: 0,
    incomplete: false,
    ...patch,
  }) as Standing;

describe('how much your scores have varied', () => {
  it('is the spread of what actually happened', () => {
    expect(spread([80, 80, 80])).toBe(0);
    expect(spread([70, 90])).toBeCloseTo(14.14, 1);
  });

  it('is absent from one score, because one score has no spread', () => {
    expect(spread([80])).toBeNull();
    expect(spread([])).toBeNull();
  });
});

describe('where the term lands', () => {
  it('carries the current average across what is left', () => {
    // 40% counted at 84 = 33.6 banked; 60% left at 84 = 50.4. Total 84.
    const s = at({ earned: 33.6, counted: 40, remaining: 60, current: 84 });
    const p = projectGrade(s, [84, 84, 84, 84]);
    expect(p?.middle).toBeCloseTo(84, 1);
  });

  it('is a band, never a point, and never a probability', () => {
    const s = at({ earned: 33.6, counted: 40, remaining: 60, current: 84 });
    const p = projectGrade(s, [78, 84, 90, 84]);
    expect(p!.low).toBeLessThan(p!.middle);
    expect(p!.high).toBeGreaterThan(p!.middle);
    const said = projectionLine(p).toLowerCase();
    for (const word of ['chance', 'probability', 'likely', '% likely', 'odds']) {
      expect(said).not.toContain(word);
    }
  });

  it('widens the band on very little evidence rather than narrowing it', () => {
    // A band of zero would be the most confident thing on the screen resting
    // on the least.
    const s = at({ earned: 8.4, counted: 10, remaining: 90, current: 84 });
    const one = projectGrade(s, [84]);
    expect(one!.high - one!.low).toBeGreaterThan(UNSURE);
    expect(one!.thin).toBe(true);
    expect(projectionLine(one)).toContain('very little');
  });

  it('never claims a precision it has not got', () => {
    const s = at({ earned: 33.6, counted: 40, remaining: 60, current: 84 });
    const steady = projectGrade(s, [84, 84, 84, 84, 84]);
    // Five identical scores have zero spread, and a zero-width band would be
    // a promise.
    expect(steady!.high - steady!.low).toBeGreaterThan(0);
    expect(steady!.high - steady!.low).toBeCloseTo((60 * FLOOR * 2) / 100, 1);
  });

  it('bands only what is left to play for', () => {
    // What is graded is graded. A band that moved it would be fiction.
    const nearlyDone = at({ earned: 85, counted: 95, remaining: 5, current: 89.5 });
    const p = projectGrade(nearlyDone, [80, 99, 85, 94]);
    expect(p!.high - p!.low).toBeLessThan(2);
  });

  it('subtracts points lost to absences', () => {
    const s = at({ earned: 84, counted: 100, remaining: 0, current: 84, pointsOff: 10 });
    expect(projectGrade(s, [84, 84, 84])?.middle).toBeCloseTo(74, 1);
  });

  it('calls a finished term finished rather than banding a decided number', () => {
    // Found by driving it: with every category filled the band collapsed to
    // "79.2 to 79.2" while the same sentence called the band wide.
    const done = at({ earned: 79.2, counted: 100, remaining: 0, current: 79.2 });
    const said = projectionLine(projectGrade(done, [84, 78]));
    expect(said).toBe('Everything is in. That finishes at 79.2.');
    expect(said).not.toContain('to 79.2');
    expect(said.toLowerCase()).not.toContain('wide');
  });

  it('says nothing at all before anything is graded', () => {
    expect(projectGrade(at({}), [])).toBeNull();
    expect(projectionLine(null)).toContain('nothing to project from');
  });

  it('says how much is still in play when most of it is', () => {
    const s = at({ earned: 8.4, counted: 10, remaining: 90, current: 84 });
    expect(projectionLine(projectGrade(s, [84, 80, 88, 84]))).toContain('90% of the grade');
  });
});

describe('how wrong your own guesses have been', () => {
  const guessed = (guess: number, minutes: number) => ({ guess, minutes });

  it('measures the guess against what it took', () => {
    // "I thought two hours, it was three and a half."
    const four = [1, 2, 3, 4].map(() => guessed(120, 210));
    expect(calibrate(four)?.ratio).toBe(1.75);
  });

  it('does not compare a prediction against the evidence it was made from', () => {
    // This is what the first version did — score the app's own median against
    // the reports that median is made of. On steady data it converges on being
    // right, so the ratio sat at 1 however badly the student estimated, and a
    // calibration that is always 1 reads as "I estimate well".
    const steady = [1, 2, 3, 4, 5].map(() => guessed(60, 120));
    expect(calibrate(steady)!.ratio).toBe(2);
  });

  it('takes the median, so one all-nighter does not move it', () => {
    const mostly = [
      guessed(60, 60),
      guessed(60, 60),
      guessed(60, 60),
      guessed(60, 60),
      guessed(60, 600),
    ];
    expect(calibrate(mostly)?.ratio).toBe(1);
  });

  it('says nothing on too little evidence', () => {
    expect(calibrate([guessed(60, 90), guessed(60, 90)])).toBeNull();
    expect(ENOUGH_REPORTS).toBeGreaterThanOrEqual(3);
  });

  it('ignores a report with no guess behind it', () => {
    const some = [guessed(0, 90), guessed(0, 90), guessed(60, 120), guessed(60, 120)];
    expect(calibrate(some)).toBeNull();
  });

  it('applies the bias to an estimate', () => {
    expect(corrected(120, { ratio: 1.5, from: 8 })).toBe(180);
    expect(corrected(120, null)).toBe(120);
  });

  it('stays quiet about a small bias', () => {
    // A five per cent error is not a finding, and announcing it weekly trains
    // people to ignore the week it says forty.
    expect(calibrationLine({ ratio: 1.05, from: 9 })).toBe('');
    expect(calibrationLine(null)).toBe('');
  });

  it('says which direction a real bias runs in', () => {
    expect(calibrationLine({ ratio: 1.4, from: 9 })).toContain('longer');
    expect(calibrationLine({ ratio: 0.6, from: 9 })).toContain('less time');
  });
});

describe('what an hour buys', () => {
  const timed = (courseId: string, kind: string, minutes: number): Spent[] =>
    [1, 2, 3].map((n) => ({ id: `${courseId}${kind}${n}`, courseId, kind, minutes, at: n }));

  const item = (patch: Partial<BuyInput> & { id: string }): BuyInput => ({
    title: 'Something',
    courseId: 'econ',
    kind: 'Problem set',
    weight: '10%',
    daysAway: 3,
    ...patch,
  });

  const spent = [...timed('econ', 'problem set', 60), ...timed('psci', 'essay', 300)];

  it('orders by points an hour, not by size', () => {
    const list = bestBuys(
      [
        item({ id: 'a', weight: '10%' }),
        item({ id: 'b', courseId: 'psci', kind: 'Essay', weight: '20%' }),
      ],
      spent,
      null,
    );
    // 10% in an hour beats 20% in five.
    expect(list[0].id).toBe('a');
    expect(list[0].perHour).toBe(10);
    expect(list[1].perHour).toBe(4);
  });

  it('puts anything due today first, because that is not a trade', () => {
    const list = bestBuys(
      [
        item({ id: 'good', weight: '30%', daysAway: 5 }),
        item({ id: 'tonight', weight: '2%', daysAway: 0 }),
      ],
      spent,
      null,
    );
    expect(list[0].id).toBe('tonight');
  });

  it('keeps what it cannot weigh, at the bottom, marked', () => {
    // A reading worth nothing towards the grade is still the reading the
    // seminar is about.
    const list = bestBuys(
      [item({ id: 'weighed' }), item({ id: 'reading', weight: 'Required', kind: 'Reading' })],
      spent,
      null,
    );
    expect(list.map((b) => b.id)).toEqual(['weighed', 'reading']);
    expect(list[1].perHour).toBeNull();
    expect(list[1].why).toBe('No stated weight');
  });

  it('marks something weighted that has never been timed', () => {
    const list = bestBuys([item({ id: 'x', kind: 'Presentation', weight: '15%' })], spent, null);
    expect(list[0].why).toBe('15% of the grade, never timed');
  });

  it('applies the measured bias to the minutes it quotes', () => {
    const plain = bestBuys([item({ id: 'a' })], spent, null);
    const slow = bestBuys([item({ id: 'a' })], spent, { ratio: 2, from: 9 });
    expect(slow[0].minutes).toBe((plain[0].minutes ?? 0) * 2);
    expect(slow[0].perHour).toBeLessThan(plain[0].perHour ?? 0);
  });
});

describe('fitting it into the hours there are', () => {
  const buy = (id: string, minutes: number | null): never =>
    ({ id, title: id, courseId: 'econ', worth: 10, minutes, perHour: 10, daysAway: 2, why: '' }) as never;

  it('takes what fits and sets aside what does not, keeping the order', () => {
    // The first version stopped dead at the first miss, which put three
    // half-hour pieces under "not in 3 hours" behind one ten-hour paper —
    // simply untrue, and the drive showed it.
    const { taken, over } = fits([buy('a', 120), buy('huge', 600), buy('c', 20)], 3);
    expect(taken.map((b) => b.id)).toEqual(['a', 'c']);
    expect(over.map((b) => b.id)).toEqual(['huge']);
  });

  it('always takes the first thing, however long it is', () => {
    const { taken } = fits([buy('huge', 600)], 1);
    expect(taken.map((b) => b.id)).toEqual(['huge']);
  });

  it('treats an untimed item as costing nothing rather than blocking', () => {
    const { taken } = fits([buy('a', 60), buy('unknown', null), buy('c', 60)], 3);
    expect(taken.map((b) => b.id)).toEqual(['a', 'unknown', 'c']);
  });

  it('names the hours that did not fit', () => {
    const { over } = fits([buy('a', 60), buy('huge', 600), buy('big', 300)], 2);
    expect(overHours(over)).toBe(15);
    expect(overHours([])).toBe(0);
  });
});

describe('what the evening’s list says at the top', () => {
  const spent: Spent[] = [1, 2, 3].map((n) => ({
    id: `s${n}`,
    courseId: 'econ',
    kind: 'problem set',
    minutes: 60,
    at: n,
  }));
  const item = (id: string, weight: string, kind = 'Problem set') => ({
    id,
    title: id,
    courseId: 'econ',
    kind,
    weight,
    daysAway: 3,
  });

  it('says what it is ordered by', () => {
    const list = bestBuys([item('a', '10%')], spent, null);
    expect(eveningLine(list, 6)).toContain('what an hour is worth');
  });

  it('admits when it could weigh nothing', () => {
    const list = bestBuys([item('a', 'Required', 'Reading')], spent, null);
    expect(eveningLine(list, 6)).toContain('deadline order');
  });

  it('counts what it left at the bottom rather than hiding it', () => {
    const list = bestBuys([item('a', '10%'), item('b', 'Required', 'Reading')], spent, null);
    expect(eveningLine(list, 6)).toContain('1 could not be weighed');
  });

  it('has something to say about an empty evening', () => {
    expect(eveningLine([], 6)).toBe('Nothing outstanding to weigh up.');
  });
});
