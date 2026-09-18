import { describe, expect, it } from 'vitest';
import {
  DAY_MINUTES,
  HORIZON_DAYS,
  LONGEST,
  daysOf,
  finishes,
  layOut,
  minutesOn,
  missed,
  moveOn,
  onDay,
  onlyFrom,
  progressOf,
  today,
  willMove,
  type Session,
} from './sessions';
import { A_SITTING } from './review';
import { SECONDS_PER_CARD } from './revise';
import { shiftIso } from './date';
import type { Stretch } from './revise';

const MON = '2026-09-14';
const TUE = '2026-09-15';
const WED = '2026-09-16';

function sitting(over: Partial<Session> = {}): Session {
  return {
    id: over.id ?? `s${Math.random()}`,
    courseId: 'econ',
    index: 0,
    name: 'Monopoly',
    code: 'ECON 1020',
    minutes: 30,
    on: TUE,
    ...over,
  };
}

function stretch(over: Partial<Stretch> = {}): Stretch {
  return {
    courseId: 'econ',
    code: 'ECON 1020',
    index: 0,
    name: 'Monopoly',
    mastery: 40,
    keys: [],
    testInDays: null,
    testKind: null,
    due: 0,
    cards: 10,
    minutes: 30,
    cardsToDo: 10,
    score: 1,
    why: 'because',
    ...over,
  } as Stretch;
}

describe('what has been missed', () => {
  it('is what was planned before today and not done', () => {
    const list = [sitting({ id: 'a', on: MON }), sitting({ id: 'b', on: TUE })];
    expect(missed(list, TUE).map((s) => s.id)).toEqual(['a']);
  });

  it('does not count today as missed, at any hour of it', () => {
    // A sitting planned for tonight is not missed at nine in the morning. An
    // app that says otherwise has told its first lie before breakfast.
    expect(missed([sitting({ on: TUE })], TUE)).toEqual([]);
  });

  it('does not count a sitting that was done', () => {
    expect(missed([sitting({ on: MON, doneAt: 1 })], TUE)).toEqual([]);
  });

  it('lists today’s outstanding sittings apart from the rest', () => {
    const list = [
      sitting({ id: 'a', on: TUE }),
      sitting({ id: 'b', on: TUE, doneAt: 1 }),
      sitting({ id: 'c', on: WED }),
    ];
    expect(onDay(list, TUE).map((s) => s.id)).toEqual(['a']);
  });

  it('counts a day’s minutes including what is finished', () => {
    // The ceiling is about the evening, not about what is left of it: two
    // finished sittings mean the evening is spent.
    const list = [sitting({ on: TUE, minutes: 30, doneAt: 1 }), sitting({ on: TUE, minutes: 20 })];
    expect(minutesOn(list, TUE)).toBe(50);
  });
});

describe('laying a plan down', () => {
  it('puts the best-ranked unit on the first evening', () => {
    const made = layOut([stretch({ name: 'First' }), stretch({ name: 'Second', index: 1 })], {
      from: TUE,
    });
    expect(made[0]).toMatchObject({ name: 'First', on: TUE });
  });

  it('fills a day to its ceiling and then moves on', () => {
    const three = [stretch({ minutes: 40 }), stretch({ minutes: 40, index: 1 }), stretch({ minutes: 40, index: 2 })];
    const made = layOut(three, { from: TUE, dayMinutes: 90 });
    expect(made.filter((s) => s.on === TUE)).toHaveLength(2);
    expect(made.filter((s) => s.on === shiftIso(TUE, 1))).toHaveLength(1);
  });

  it('never exceeds the ceiling on any day', () => {
    const many = Array.from({ length: 30 }, (_, i) => stretch({ index: i, minutes: 35 }));
    const made = layOut(many, { from: TUE, dayMinutes: 90 });
    for (const day of daysOf(made, TUE)) expect(minutesOn(made, day)).toBeLessThanOrEqual(90);
  });

  it('caps one sitting rather than splitting a unit across evenings', () => {
    // Half a unit is two sittings that are each half a thing, and the half
    // that is left over is the half nobody does.
    const made = layOut([stretch({ minutes: 200 })], { from: TUE });
    expect(made).toHaveLength(1);
    expect(made[0].minutes).toBe(LONGEST);
  });

  it('stops at the horizon rather than planning into next month', () => {
    const many = Array.from({ length: 200 }, (_, i) => stretch({ index: i, minutes: 45 }));
    const made = layOut(many, { from: TUE, dayMinutes: 90, days: 3 });
    expect(daysOf(made, TUE)).toHaveLength(3);
    expect(made).toHaveLength(6);
  });

  it('plans around sittings that are already there', () => {
    const already = [sitting({ on: TUE, minutes: 80 })];
    const made = layOut([stretch({ minutes: 30 })], { from: TUE, dayMinutes: 90, existing: already });
    expect(made[0].on).toBe(shiftIso(TUE, 1));
  });

  it('gives every sitting a distinct id', () => {
    const many = Array.from({ length: 12 }, (_, i) => stretch({ index: i % 3, minutes: 30 }));
    const made = layOut(many, { from: TUE });
    expect(new Set(made.map((s) => s.id)).size).toBe(made.length);
  });

  it('copies the name and code rather than leaving an index to look up', () => {
    const made = layOut([stretch({ name: 'Game theory', code: 'ECON 1020', index: 9 })], { from: TUE });
    expect(made[0]).toMatchObject({ name: 'Game theory', code: 'ECON 1020', index: 9 });
  });

  it('plans nothing from nothing', () => {
    expect(layOut([], { from: TUE })).toEqual([]);
  });

  it('gives every course a turn before any course gets a second', () => {
    /*
     * Measured in the browser before this existed: a fresh install's first
     * plan put eight consecutive PSCI sittings on tonight and nothing else.
     * The ranking is a sort, and a sort groups — so filling a day straight off
     * it undoes the whole point of ranking across the catalogue.
     */
    const ranked = [
      stretch({ courseId: 'psci', index: 0, minutes: 10 }),
      stretch({ courseId: 'psci', index: 1, minutes: 10 }),
      stretch({ courseId: 'psci', index: 2, minutes: 10 }),
      stretch({ courseId: 'econ', index: 0, minutes: 10 }),
      stretch({ courseId: 'bus', index: 0, minutes: 10 }),
    ];
    const made = layOut(ranked, { from: TUE, dayMinutes: 60 });
    expect(made.slice(0, 3).map((s) => s.courseId)).toEqual(['psci', 'econ', 'bus']);
  });

  it('keeps the ranking’s order inside a course', () => {
    const ranked = [
      stretch({ courseId: 'psci', index: 0, name: 'first', minutes: 10 }),
      stretch({ courseId: 'psci', index: 1, name: 'second', minutes: 10 }),
      stretch({ courseId: 'econ', index: 0, name: 'other', minutes: 10 }),
    ];
    const made = layOut(ranked, { from: TUE, dayMinutes: 60 });
    const psci = made.filter((s) => s.courseId === 'psci').map((s) => s.name);
    expect(psci).toEqual(['first', 'second']);
  });

  it('loses nothing to the interleaving', () => {
    const ranked = Array.from({ length: 9 }, (_, i) =>
      stretch({ courseId: ['a', 'b', 'c'][i % 3], index: i, minutes: 10 }),
    );
    expect(layOut(ranked, { from: TUE, dayMinutes: 90 })).toHaveLength(9);
  });
});

describe('moving what was missed, in one action', () => {
  it('moves a missed sitting onto today', () => {
    const list = [sitting({ id: 'a', on: MON })];
    const out = moveOn(list, { today: TUE });
    expect(out.count).toBe(1);
    expect(out.sessions[0]).toMatchObject({ id: 'a', on: TUE, moved: 1 });
  });

  it('leaves everything that was not missed exactly where it is', () => {
    // The feature that makes people stop trusting a plan is the one that
    // rearranges the parts they had not missed.
    const future = sitting({ id: 'future', on: WED });
    const out = moveOn([sitting({ id: 'late', on: MON }), future], { today: TUE });
    expect(out.sessions.find((s) => s.id === 'future')).toEqual(future);
  });

  it('counts the moves, so a plan that is not working can say so', () => {
    const once = moveOn([sitting({ id: 'a', on: MON, moved: 2 })], { today: TUE });
    expect(once.sessions[0].moved).toBe(3);
  });

  it('fills today first, then tomorrow, rather than piling everything on today', () => {
    const late = [
      sitting({ id: 'a', on: MON, minutes: 45 }),
      sitting({ id: 'b', on: MON, minutes: 45 }),
      sitting({ id: 'c', on: MON, minutes: 45 }),
    ];
    const out = moveOn(late, { today: TUE, dayMinutes: 90 });
    expect(minutesOn(out.sessions, TUE)).toBe(90);
    expect(minutesOn(out.sessions, shiftIso(TUE, 1))).toBe(45);
  });

  it('takes the oldest first', () => {
    const late = [
      sitting({ id: 'newer', on: MON, minutes: 90 }),
      sitting({ id: 'older', on: '2026-09-01', minutes: 90 }),
    ];
    const out = moveOn(late, { today: TUE, dayMinutes: 90 });
    expect(out.sessions.find((s) => s.on === TUE)?.id).toBe('older');
  });

  it('respects a day that is already spoken for', () => {
    const list = [sitting({ id: 'today', on: TUE, minutes: 80 }), sitting({ id: 'late', on: MON, minutes: 30 })];
    const out = moveOn(list, { today: TUE, dayMinutes: 90 });
    expect(out.sessions.find((s) => s.id === 'late')?.on).toBe(shiftIso(TUE, 1));
  });

  it('does nothing, and returns the same array, when nothing was missed', () => {
    const list = [sitting({ on: WED })];
    const out = moveOn(list, { today: TUE });
    expect(out).toMatchObject({ count: 0, dropped: [] });
    expect(out.sessions).toBe(list);
  });
});

/**
 * The rule the whole module exists for.
 *
 * Every backlog feature fails the same way: it conserves work somebody has
 * already decided not to do, and presents the total as an obligation. Four
 * missed evenings become a four-hour Thursday, and a plan that says four hours
 * on a Thursday is a plan that gets deleted.
 */
describe('refusing to build an impossible backlog', () => {
  const twenty = () =>
    Array.from({ length: 20 }, (_, i) => sitting({ id: `s${i}`, on: MON, minutes: 45 }));

  it('drops what will not fit rather than stacking it', () => {
    const out = moveOn(twenty(), { today: TUE, dayMinutes: 90, days: 3 });
    // Three days at two sittings each.
    expect(out.count).toBe(6);
    expect(out.dropped).toHaveLength(14);
  });

  it('leaves no day over its ceiling, however much was missed', () => {
    const out = moveOn(twenty(), { today: TUE, dayMinutes: 90, days: 3 });
    for (const day of daysOf(out.sessions, TUE)) {
      expect(minutesOn(out.sessions, day), day).toBeLessThanOrEqual(90);
    }
  });

  it('removes the dropped ones from the plan rather than leaving them in the past', () => {
    // Dropped means gone. Left on Monday they would be missed again tomorrow,
    // and the same button would offer to move the same fourteen every day.
    const out = moveOn(twenty(), { today: TUE, dayMinutes: 90, days: 3 });
    expect(out.sessions.filter((s) => s.on < TUE)).toEqual([]);
    expect(missed(out.sessions, TUE)).toEqual([]);
  });

  it('is idempotent — pressing it twice changes nothing the second time', () => {
    const once = moveOn(twenty(), { today: TUE, dayMinutes: 90, days: 3 });
    const twice = moveOn(once.sessions, { today: TUE, dayMinutes: 90, days: 3 });
    expect(twice.count).toBe(0);
    expect(twice.dropped).toEqual([]);
    expect(twice.sessions).toBe(once.sessions);
  });
});

describe('what the button says before it is pressed', () => {
  it('is written from the same call the button makes', () => {
    // Two instruments measuring one thing is how this repository has produced
    // most of its wrong numbers. A preview that disagrees with the action is
    // worse than no preview: it is a promise.
    const late = twoLate();
    expect(willMove(late, { today: TUE })).toBe('Move 2 sittings to the next evening with room.');
    expect(moveOn(late, { today: TUE }).count).toBe(2);
  });

  it('says so when nothing has been missed', () => {
    expect(willMove([sitting({ on: WED })], { today: TUE })).toBe('Nothing has been missed.');
  });

  it('reads properly for one', () => {
    expect(willMove([sitting({ on: MON })], { today: TUE })).toBe(
      'Move 1 sitting to the next evening with room.',
    );
  });

  it('says what will be dropped, rather than only what will move', () => {
    const many = Array.from({ length: 5 }, (_, i) => sitting({ id: `s${i}`, on: MON, minutes: 45 }));
    expect(willMove(many, { today: TUE, dayMinutes: 90, days: 1 })).toBe(
      'Move 2 sittings. 3 sittings will not fit and come off the plan.',
    );
  });

  it('says only the dropping when nothing can move at all', () => {
    const list = [sitting({ id: 'full', on: TUE, minutes: 90 }), sitting({ id: 'late', on: MON, minutes: 45 })];
    expect(willMove(list, { today: TUE, dayMinutes: 90, days: 1 })).toBe(
      '1 sitting will not fit — they come off the plan.',
    );
  });

  function twoLate(): Session[] {
    return [sitting({ id: 'a', on: MON, minutes: 20 }), sitting({ id: 'b', on: MON, minutes: 20 })];
  }
});

describe('keeping the list from becoming a filing cabinet', () => {
  it('drops everything before the day given, finished or not', () => {
    const list = [sitting({ on: MON, doneAt: 1 }), sitting({ on: TUE }), sitting({ on: WED })];
    expect(onlyFrom(list, TUE).map((s) => s.on)).toEqual([TUE, WED]);
  });
});

describe('the day key', () => {
  it('is the local day, not a timestamp', () => {
    // A session happens on a day. Stored as an instant it moves across
    // midnight when the student changes timezone, and yesterday's sitting
    // becomes today's.
    expect(today(new Date(2026, 8, 15, 23, 45))).toBe('2026-09-15');
    expect(today(new Date(2026, 8, 15, 0, 5))).toBe('2026-09-15');
  });
});

describe('the defaults', () => {
  it('are a workable evening and a fortnight', () => {
    expect(DAY_MINUTES).toBeGreaterThanOrEqual(60);
    expect(LONGEST).toBeLessThanOrEqual(DAY_MINUTES);
    expect(HORIZON_DAYS).toBe(14);
  });
});

/**
 * What a sitting is, which used to be two things and is now four.
 *
 * `planned` and `done` were the whole vocabulary and the screen moved a
 * sitting between them the moment its row was tapped, so the plan measured
 * whether you had opened a thing. The two in the middle are what make an
 * opened-and-abandoned sitting distinguishable from an evening's work, and
 * this is where that distinction is pinned.
 */
describe('what state a sitting is in', () => {
  it('is planned until somebody opens it', () => {
    expect(progressOf(sitting())).toBe('planned');
  });

  it('is started once it is open with nothing answered', () => {
    expect(progressOf(sitting({ startedAt: 1 }))).toBe('started');
  });

  it('is partly done once there are answers in it', () => {
    expect(progressOf(sitting({ startedAt: 1, answered: 3, cards: 12 }))).toBe('partly');
  });

  it('is done only when it is stamped', () => {
    expect(progressOf(sitting({ startedAt: 1, answered: 12, cards: 12, doneAt: 2 }))).toBe('done');
  });

  it('reads a sitting from an older build, which has neither field, as planned', () => {
    // And not as started: a `startedAt` invented for it would be a time
    // nobody recorded, said in the app's own voice.
    expect(progressOf(sitting())).toBe('planned');
  });
});

describe('when the answers have finished a sitting', () => {
  it('is on the card it was sized for, not before', () => {
    const s = sitting({ cards: 3 });
    expect(finishes(s, 2)).toBe(false);
    expect(finishes(s, 3)).toBe(true);
  });

  it('is never, for a sitting that was never sized', () => {
    // Laid down before `cards` existed. Finishing it against a number it
    // never had would be inventing the history this all exists to avoid — it
    // finishes when its deck runs dry instead.
    expect(finishes(sitting(), 500)).toBe(false);
  });
});

describe('sizing a sitting in cards', () => {
  it('takes the count from the stretch it was laid from', () => {
    const [made] = layOut([stretch({ cardsToDo: 8, minutes: 10 })], { from: MON });
    expect(made.cards).toBe(8);
  });

  it('never asks for more cards than the minutes it was trimmed to', () => {
    // `layOut` caps a sitting at `LONGEST`. A sitting cut to forty-five
    // minutes that still wants ninety minutes of cards before it will call
    // itself finished is a sitting nobody can finish, which is the old bug
    // with the sign flipped.
    const [made] = layOut([stretch({ minutes: 200, cardsToDo: 600 })], { from: MON, dayMinutes: 500 });
    expect(made.minutes).toBe(LONGEST);
    expect(made.cards).toBeLessThanOrEqual(Math.round((LONGEST * 60) / SECONDS_PER_CARD));
  });

  it('never asks for more cards than one run will hand over', () => {
    // `A_SITTING` caps a deck at twenty-five, so a target above it could only
    // be reached by pressing "go again" — and a sitting you cannot finish in
    // the run it opens is a sitting that reports a missed evening after an
    // evening's work.
    const [made] = layOut([stretch({ minutes: LONGEST, cardsToDo: 600 })], { from: MON });
    expect(made.cards).toBeLessThanOrEqual(A_SITTING);
  });

  it('never asks for none, which would finish a sitting on no cards at all', () => {
    const [made] = layOut([stretch({ minutes: 1, cardsToDo: 0 })], { from: MON });
    expect(made.cards).toBeGreaterThan(0);
  });
});

describe('moving a sitting somebody is part way through', () => {
  it('carries the work with it', () => {
    // It is the same sitting on a different evening — `id` is stable across a
    // move for this reason — so the five cards answered on Monday are still
    // five cards answered.
    const list = [sitting({ id: 'a', on: MON, cards: 12, answered: 5, startedAt: 1 })];
    const out = moveOn(list, { today: TUE });
    expect(out.sessions[0]).toMatchObject({ id: 'a', on: TUE, answered: 5, startedAt: 1 });
    expect(progressOf(out.sessions[0])).toBe('partly');
  });
});
