import { describe, expect, it } from 'vitest';
import {
  EXAM_HORIZON_DAYS,
  MIN_STRETCH_MINUTES,
  SECONDS_PER_CARD,
  counted,
  countedLine,
  doneToday,
  dueIn,
  testWeight,
  planFor,
  planTotals,
  rank,
  reasonFor,
  warmedLine,
  type Counted,
  type UnitFacts,
} from './revise';
import { emptyReview, type CardReview, type Reviews } from './review';

const NOW = new Date(2026, 8, 9, 21, 0).getTime();
const DAY = 86_400_000;

const unit = (over: Partial<UnitFacts> = {}): UnitFacts => ({
  courseId: 'econ',
  code: 'ECON 1020',
  index: 0,
  name: '1 · What economics is',
  mastery: 50,
  keys: ['econ:a', 'econ:b', 'econ:c'],
  testInDays: null,
  testKind: null,
  ...over,
});

const answered = (over: Partial<CardReview> = {}): CardReview => ({
  ...emptyReview(NOW),
  right: 1,
  streak: 1,
  interval: 1,
  seen: NOW - DAY,
  due: NOW + DAY,
  ...over,
});

describe('dueIn', () => {
  it('counts a card nobody has answered as due', () => {
    expect(dueIn(['a', 'b'], {}, NOW)).toBe(2);
  });

  it('leaves out a card scheduled for later', () => {
    const reviews: Reviews = { a: answered({ due: NOW + 3 * DAY }) };
    expect(dueIn(['a', 'b'], reviews, NOW)).toBe(1);
  });

  it('counts a card whose date has passed', () => {
    const reviews: Reviews = { a: answered({ due: NOW - DAY }) };
    expect(dueIn(['a'], reviews, NOW)).toBe(1);
  });
});

describe('testWeight', () => {
  it('is flat when there is no exam, and beyond the horizon', () => {
    expect(testWeight(null)).toBe(1);
    expect(testWeight(EXAM_HORIZON_DAYS + 1)).toBe(1);
    expect(testWeight(60)).toBe(1);
  });

  it('rises as the exam approaches and stays bounded', () => {
    expect(testWeight(10)).toBeGreaterThan(testWeight(13));
    expect(testWeight(1)).toBeGreaterThan(testWeight(10));
    expect(testWeight(0)).toBeLessThanOrEqual(2.5);
  });
});

describe('rank', () => {
  it('drops a unit with no cards rather than offering an empty sitting', () => {
    expect(rank([unit({ keys: [] })], {}, NOW)).toEqual([]);
  });

  it('puts the colder unit first, all else equal', () => {
    const out = rank(
      [unit({ index: 0, mastery: 80 }), unit({ index: 1, mastery: 20 })],
      {},
      NOW,
    );
    expect(out[0].index).toBe(1);
  });

  it('lifts a unit whose course is examined this week over a colder one that is not', () => {
    const out = rank(
      [
        unit({ courseId: 'hist', code: 'HIST 1200', mastery: 25, testInDays: null }),
        unit({ courseId: 'econ', code: 'ECON 1020', mastery: 45, testInDays: 2, testKind: 'Exam' }),
      ],
      {},
      NOW,
    );
    expect(out[0].courseId).toBe('econ');
  });

  it('counts overdue cards as more urgent than ones answered on time', () => {
    const fresh: Reviews = { 'econ:a': answered(), 'econ:b': answered(), 'econ:c': answered() };
    const stale: Reviews = {
      'hist:a': answered({ due: NOW - 30 * DAY, seen: NOW - 31 * DAY }),
      'hist:b': answered({ due: NOW - 30 * DAY, seen: NOW - 31 * DAY }),
      'hist:c': answered({ due: NOW - 30 * DAY, seen: NOW - 31 * DAY }),
    };
    const out = rank(
      [
        unit({ courseId: 'econ' }),
        unit({ courseId: 'hist', code: 'HIST 1200', keys: ['hist:a', 'hist:b', 'hist:c'] }),
      ],
      { ...fresh, ...stale },
      NOW,
    );
    expect(out[0].courseId).toBe('hist');
  });

  it('sizes a sitting by the cards that are actually waiting', () => {
    const [s] = rank([unit({ keys: ['a', 'b', 'c'] })], {}, NOW);
    expect(s.due).toBe(3);
    expect(s.minutes).toBe(Math.round((3 * SECONDS_PER_CARD) / 60));
  });

  it('still offers a short sitting on a unit with nothing due', () => {
    const reviews: Reviews = {
      'econ:a': answered({ due: NOW + 9 * DAY }),
      'econ:b': answered({ due: NOW + 9 * DAY }),
      'econ:c': answered({ due: NOW + 9 * DAY }),
    };
    const [s] = rank([unit()], reviews, NOW);
    expect(s.due).toBe(0);
    expect(s.minutes).toBeGreaterThan(0);
  });
});

describe('reasonFor', () => {
  it('names the test first when there is one close', () => {
    const why = reasonFor({ ...unit({ testInDays: 3, testKind: 'Exam', mastery: 30 }), due: 2, cards: 3 });
    expect(why.startsWith('Exam in 3 days')).toBe(true);
  });

  it('calls a quiz a quiz', () => {
    const why = reasonFor({ ...unit({ testInDays: 2, testKind: 'Quiz', mastery: 30 }), due: 2, cards: 3 });
    expect(why).toContain('Quiz in 2 days');
    expect(why).not.toContain('xam');
  });

  it('says what is waiting and where the unit stands', () => {
    const why = reasonFor({ ...unit({ mastery: 22 }), due: 2, cards: 9 }, 'practising');
    expect(why).toContain('2 of 9 cards due');
    expect(why).toContain('practising');
  });

  it('says no percentage, whatever the blend claims', () => {
    // Was `22% mastered`. `mastery` is `unitMastery`'s blend, which stands the
    // guide's written estimate in for every unanswered card — so on the first
    // evening of term the line headed "why this unit is here" carried a
    // two-digit figure about material nothing had measured. The ranking still
    // uses it; the printing was the claim. See `lib/knowing.ts`.
    for (const state of ['unseen', 'introduced', 'practising', 'retained', 'review'] as const) {
      expect(reasonFor({ ...unit({ mastery: 22 }), due: 2, cards: 9 }, state)).not.toMatch(/\d+%/);
    }
    expect(reasonFor({ ...unit({ mastery: 22 }), due: 2, cards: 9 })).not.toMatch(/\d+%/);
  });

  it('has something to say about a warm unit with nothing due', () => {
    const why = reasonFor({ ...unit({ mastery: 88 }), due: 0, cards: 9 }, 'retained');
    expect(why).toBe('Holding — keeping it warm');
  });

  it('leads with the state for a unit that is behind, even with nothing due', () => {
    // The old rule only spoke below 40%, so a unit at 41 with nothing due fell
    // through to "keeping it warm" — which is the wrong advice for a unit that
    // has never been opened.
    expect(reasonFor({ ...unit({ mastery: 88 }), due: 0, cards: 9 }, 'unseen')).toBe('Unseen');
  });

  it('still says something useful when the caller cannot supply a state', () => {
    const why = reasonFor({ ...unit({ mastery: 22 }), due: 2, cards: 9 });
    expect(why).toContain('2 of 9 cards due');
  });
});

describe('planFor', () => {
  const deck = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);
  const ranked = () =>
    rank(
      [
        unit({ courseId: 'a', code: 'A 100', mastery: 10, keys: deck('a', 60) }),
        unit({ courseId: 'b', code: 'B 100', mastery: 20, keys: deck('b', 60) }),
        unit({ courseId: 'c', code: 'C 100', mastery: 30, keys: deck('c', 60) }),
      ],
      {},
      NOW,
    );

  it('never plans more than the time available', () => {
    const plan = planFor(ranked(), 10);
    expect(planTotals(plan).minutes).toBeLessThanOrEqual(10);
  });

  it('grows with the budget', () => {
    expect(planTotals(planFor(ranked(), 45)).minutes).toBeGreaterThan(
      planTotals(planFor(ranked(), 10)).minutes,
    );
  });

  it('serves every course before giving any course a second unit', () => {
    const two = rank(
      [
        unit({ courseId: 'a', code: 'A 100', index: 0, mastery: 10 }),
        unit({ courseId: 'a', code: 'A 100', index: 1, mastery: 12 }),
        unit({ courseId: 'b', code: 'B 100', index: 0, mastery: 30 }),
      ],
      {},
      NOW,
    );
    const plan = planFor(two, 60);
    expect(plan.map((s) => s.courseId)).toEqual(['a', 'b', 'a']);
  });

  it('keeps going through the ranking while there is time left', () => {
    const many = rank(
      [
        unit({ courseId: 'a', code: 'A 100', index: 0, keys: deck('a', 30) }),
        unit({ courseId: 'a', code: 'A 100', index: 1, keys: deck('d', 30) }),
        unit({ courseId: 'b', code: 'B 100', index: 0, keys: deck('b', 30) }),
        unit({ courseId: 'b', code: 'B 100', index: 1, keys: deck('e', 30) }),
      ],
      {},
      NOW,
    );
    // Four ten-minute stretches, forty minutes to spend: all four, and the
    // budget filled rather than one round of two and the rest of the evening
    // handed back.
    expect(planTotals(planFor(many, 40)).minutes).toBe(40);
    expect(planFor(many, 40)).toHaveLength(4);
  });

  it('runs consecutive units of one course once a course is chosen', () => {
    const two = rank(
      [
        unit({ courseId: 'a', code: 'A 100', index: 0, mastery: 10 }),
        unit({ courseId: 'a', code: 'A 100', index: 1, mastery: 12 }),
        unit({ courseId: 'b', code: 'B 100', index: 0, mastery: 30 }),
      ],
      {},
      NOW,
    );
    const plan = planFor(two, 60, 'a');
    expect(plan).toHaveLength(2);
    expect(plan.every((s) => s.courseId === 'a')).toBe(true);
  });

  it('stops at what is waiting rather than padding the evening out', () => {
    const little = rank([unit({ courseId: 'a', code: 'A 100', keys: ['a1', 'a2', 'a3'] })], {}, NOW);
    expect(planTotals(planFor(little, 45)).minutes).toBeLessThan(45);
  });

  it('does not start a stretch there is no real time for', () => {
    const plan = planFor(ranked(), MIN_STRETCH_MINUTES - 1);
    expect(plan).toEqual([]);
  });

  it('trims the last stretch to the time left rather than overrunning', () => {
    const long = rank([unit({ keys: Array.from({ length: 90 }, (_, i) => `k${i}`) })], {}, NOW);
    const plan = planFor(long, 12);
    expect(plan).toHaveLength(1);
    expect(plan[0].minutes).toBe(12);
    // And the cards come down with the minutes rather than staying at ninety.
    expect(plan[0].cardsToDo).toBe(Math.round((12 * 60) / SECONDS_PER_CARD));
  });

  it('counts the cards it is actually asking for', () => {
    const one = rank([unit({ keys: ['a', 'b', 'c', 'd'] })], {}, NOW);
    expect(planTotals(planFor(one, 25)).cards).toBe(4);
  });
});

describe('doneToday', () => {
  const now = new Date(2026, 8, 9, 21, 0);

  it('counts a card answered this evening', () => {
    const reviews: Reviews = { a: answered({ seen: new Date(2026, 8, 9, 20, 0).getTime() }) };
    expect(doneToday(reviews, now)).toBe(1);
  });

  it('leaves out yesterday, and anything stamped in the future', () => {
    const reviews: Reviews = {
      a: answered({ seen: new Date(2026, 8, 8, 23, 30).getTime() }),
      b: answered({ seen: new Date(2026, 8, 10, 9, 0).getTime() }),
    };
    expect(doneToday(reviews, now)).toBe(0);
  });
});

// ── The evening, counted rather than totalled ────────────────────────────

describe('counted', () => {
  const unit = (id: string, keys: string[]): UnitFacts => ({
    courseId: 'econ',
    code: 'ECON 1020',
    index: 0,
    name: id,
    mastery: 50,
    keys,
    testInDays: null,
    testKind: null,
  });

  const DAY = 86_400_000;
  const now = new Date('2026-09-21T20:00:00Z');
  const at = now.getTime();

  /** A card answered `daysAgo`, due `dueIn` days from then. */
  const seen = (daysAgo: number, dueInDays: number) => ({
    right: 1,
    wrong: 0,
    streak: 1,
    ease: 2.5,
    interval: dueInDays,
    seen: at - daysAgo * DAY,
    due: at - daysAgo * DAY + dueInDays * DAY,
  });

  it('splits the lump the screen used to print as one number', () => {
    // a: answered a week ago, due back a day later — come round.
    // b: never answered at all — new material, not a backlog.
    const reviews = { a: seen(7, 1) };
    const c = counted([unit('U1', ['a', 'b'])], reviews, now);
    expect(c.comeRound).toBe(1);
    expect(c.neverMet).toBe(1);
  });

  it('does not count a card that has never been met as having come round', () => {
    // The control, and the whole finding: `dueIn` counts both as due, so a
    // probe that reported them together would look right on the test above.
    const c = counted([unit('U1', ['a', 'b', 'c'])], {}, now);
    expect(c.comeRound).toBe(0);
    expect(c.neverMet).toBe(3);
  });

  it('does not count a card that is answered and not yet due', () => {
    const reviews = { a: seen(1, 6) };
    const c = counted([unit('U1', ['a'])], reviews, now);
    expect(c.comeRound).toBe(0);
    expect(c.neverMet).toBe(0);
  });

  it('counts a card named in two units once', () => {
    // Each shipped guide's self-test recaps a question or two, so one key can
    // sit in two units. Counting per unit and summing reports more cards than
    // the course has.
    const c = counted([unit('U1', ['a', 'b']), unit('U2', ['b'])], {}, now);
    expect(c.neverMet).toBe(2);
  });

  it('counts the units started, not a percentage of anybody', () => {
    const reviews = { a: seen(1, 6) };
    const c = counted([unit('U1', ['a']), unit('U2', ['z'])], reviews, now);
    expect(c.warmed).toBe(1);
    expect(c.units).toBe(2);
  });

  it('counts distinct cards touched today', () => {
    const reviews = { a: seen(0, 3), b: seen(7, 1) };
    expect(counted([unit('U1', ['a', 'b'])], reviews, now).today).toBe(1);
  });
});

describe('countedLine', () => {
  const line = (c: Partial<Counted>) =>
    countedLine({ comeRound: 0, neverMet: 0, today: 0, warmed: 0, units: 0, ...c });

  it('names each part with its own noun', () => {
    expect(line({ comeRound: 12, neverMet: 40, today: 3 })).toBe(
      '12 cards come round · 40 cards never met · 3 cards today',
    );
  });

  it('leaves out the parts that are nought', () => {
    // A row of zeroes is how a summary stops being read.
    expect(line({ neverMet: 40 })).toBe('40 cards never met');
    expect(line({ comeRound: 1, today: 2 })).toBe('1 card come round · 2 cards today');
  });

  it('uses the singular for one', () => {
    expect(line({ comeRound: 1 })).toBe('1 card come round');
  });

  it('says something true rather than nothing when there is nothing waiting', () => {
    expect(line({ today: 0 })).toContain('Nothing waiting');
  });

  it('is never a streak, a score or a percentage', () => {
    // `lib/you.ts` and `lib/weekly.ts` both refuse those in writing. This is
    // the third place the rule now has to survive, so it is asserted here
    // rather than left to whoever edits the strings next.
    const said = [
      line({ comeRound: 12, neverMet: 40, today: 3 }),
      line({}),
      warmedLine({ comeRound: 0, neverMet: 0, today: 0, warmed: 3, units: 11 }),
    ].join(' ');
    expect(said).not.toMatch(/streak|in a row|day[s]? running|%|score|points/i);
  });
});

describe('warmedLine', () => {
  const at = (warmed: number, units: number) =>
    warmedLine({ comeRound: 0, neverMet: 0, today: 0, warmed, units });

  it('says what has been started, out of what there is', () => {
    expect(at(3, 11)).toBe('3 of 11 units started');
  });

  it('says nothing once every unit has been started', () => {
    // "11 of 11" is a line that has stopped telling anybody anything.
    expect(at(11, 11)).toBe('');
  });

  it('says nothing where there are no units at all', () => {
    expect(at(0, 0)).toBe('');
  });
});
