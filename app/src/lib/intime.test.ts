import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../data/catalog';
import { cardKey, type CardReview, type Reviews } from './review';
import {
  HORIZON,
  LAST_LOOK,
  TESTS,
  eveOf,
  inTime,
  missingCount,
  roomBefore,
  slotFor,
  testsNear,
  wouldMiss,
  type Test,
  type Tests,
} from './intime';
import type { CourseModule, Item } from './types';

const DAY = 86_400_000;
/** A Tuesday, so nothing here turns on a weekend. */
const NOW = new Date(2026, 8, 15).getTime();

/**
 * A card revised earlier in the term and put away for six weeks.
 *
 * `seen` is a month back on purpose. A card answered *inside* the run-up to
 * the test has already had the look this module exists to guarantee, so a
 * fixture with `seen: NOW` is a fixture nothing here will touch — which is
 * how the first version of these tests came to assert the behaviour of a
 * code path they never reached.
 */
function card(over: Partial<CardReview> = {}): CardReview {
  return {
    right: 4, wrong: 0, streak: 4, ease: 2.9, interval: 45,
    seen: NOW - 30 * DAY, due: NOW + 15 * DAY, ...over,
  };
}

function test(days: number, kind = 'Exam'): Test {
  return { at: NOW + days * DAY, kind, days };
}

const K = (courseId: string, q = 'What is opportunity cost?') => cardKey(courseId, q);

describe('which deadlines count as a test', () => {
  it('is the four the study plan already counts, and no more', () => {
    // Deliberately the same list as `lib/select.ts`. A card pulled forward for
    // a kind the plan does not call a test would be the two halves of the app
    // disagreeing about Thursday.
    expect([...TESTS].sort()).toEqual(['Exam', 'Final', 'Midterm', 'Quiz']);
    expect(TESTS.has('Assignment')).toBe(false);
    expect(TESTS.has('Reading')).toBe(false);
  });
});

/** A course with the deadlines it is given and nothing else. */
function courseWith(id: string, items: Partial<Item>[]): CourseModule {
  return {
    course: { id, code: id.toUpperCase(), name: '', prof: '', email: '', meets: '', room: '',
      credits: '', term: '2026FA', source: 'x.pdf', grading: [] },
    items: items.map((i, n) => ({
      id: `${id}-${n}`, c: id, title: 'T', kind: 'Exam', month: 8, day: 20, year: 2026,
      dueTime: '11:59 PM', weight: '', where: '', detail: '', quote: '', source: 'x.pdf', ...i,
    })),
    schedule: [],
    guide: { code: id.toUpperCase(), name: '', blurb: '', source: '', mastery: 0, audio: false, units: [], terms: [] },
    planMinutes: '45 min',
    frameLabel: 'Exam frames',
  };
}

describe('finding each course’s next test', () => {
  const at = (month: number, day: number) => ({ month, day, year: 2026 });

  it('takes the nearest test in each course, course by course', () => {
    // The fault this replaced in spirit: one course's exam standing in for
    // every course's. ECON is examined on the 20th, PSCI on the 25th.
    const cat = buildCatalog([
      courseWith('econ', [{ ...at(8, 20), kind: 'Exam' }, { ...at(8, 22), kind: 'Exam' }]),
      courseWith('psci', [{ ...at(8, 25), kind: 'Quiz' }]),
    ]);
    const tests = testsNear(cat, new Date(NOW));
    expect(tests.econ).toMatchObject({ days: 5, kind: 'Exam' });
    expect(tests.psci).toMatchObject({ days: 10, kind: 'Quiz' });
  });

  it('ignores a deadline that is not a test', () => {
    const cat = buildCatalog([courseWith('econ', [{ ...at(8, 18), kind: 'Assignment' }])]);
    expect(testsNear(cat, new Date(NOW)).econ).toBeUndefined();
  });

  it('ignores a test beyond the horizon, so December does not govern September', () => {
    const far = buildCatalog([courseWith('econ', [{ month: 11, day: 12, year: 2026, kind: 'Final' }])]);
    expect(testsNear(far, new Date(NOW)).econ).toBeUndefined();
    // And a course examined inside it is found.
    const near = buildCatalog([courseWith('econ', [{ ...at(8, 15 + HORIZON), kind: 'Final' }])]);
    expect(near && testsNear(near, new Date(NOW)).econ).toBeDefined();
  });

  it('reads the day it falls on, not the hour it is due at', () => {
    /*
     * The card wants to be back *before* the test, and a test has a time of
     * day the app does not reliably know, so the start of the day is the safe
     * reading of "the day of".
     *
     * `testsNear` gets that for free — `decorateItem` builds the date as
     * `new Date(year, month, day)` — and this is the test that keeps it free.
     * A `DatedItem.date` that ever grows an hour fails here rather than
     * silently moving every last look half a day later.
     */
    const cat = buildCatalog([courseWith('econ', [{ ...at(8, 20), kind: 'Exam', dueTime: '2:00 PM' }])]);
    expect(testsNear(cat, new Date(NOW)).econ.at).toBe(new Date(2026, 8, 20).getTime());
  });
});

describe('the room a last look has', () => {
  it('ends the day before the test', () => {
    expect(eveOf(test(5))).toBe(NOW + (5 - LAST_LOOK) * DAY);
  });

  it('counts the whole days between now and that eve', () => {
    expect(roomBefore(test(5), NOW)).toBe(4);
    expect(roomBefore(test(1), NOW)).toBe(0);
  });

  it('goes negative for a test that is today, rather than pretending there is room', () => {
    expect(roomBefore(test(0), NOW)).toBeLessThan(0);
  });
});

describe('dealing the last looks across the days that are left', () => {
  it('puts the most certain card on the eve and the least certain furthest back', () => {
    expect(slotFor(0, 10, 5)).toBe(0);
    expect(slotFor(9, 10, 5)).toBe(5);
  });

  it('spreads the ones between rather than bunching them', () => {
    const slots = Array.from({ length: 14 }, (_, i) => slotFor(i, 14, 6));
    expect(new Set(slots).size).toBe(7); // every day from the eve back
    // No day takes more than its share.
    for (const day of new Set(slots)) {
      expect(slots.filter((s) => s === day).length).toBeLessThanOrEqual(3);
    }
  });

  it('never deals a slot past the room there is', () => {
    for (let i = 0; i < 40; i += 1) expect(slotFor(i, 40, 3)).toBeLessThanOrEqual(3);
  });

  it('answers the eve when there is no room and when there is nothing to deal', () => {
    expect(slotFor(0, 10, 0)).toBe(0);
    expect(slotFor(5, 10, -2)).toBe(0);
    expect(slotFor(0, 0, 5)).toBe(0);
  });
});

describe('which cards the scheduler would have dropped', () => {
  const tests: Tests = { econ: test(10) };

  it('is one whose next showing falls after the test', () => {
    const reviews: Reviews = { [K('econ')]: card({ due: NOW + 16 * DAY }) };
    expect(wouldMiss(reviews, K('econ'), tests.econ)).toBe(true);
  });

  it('is not one that already comes back in time', () => {
    const reviews: Reviews = { [K('econ')]: card({ due: NOW + 3 * DAY }) };
    expect(wouldMiss(reviews, K('econ'), tests.econ)).toBe(false);
  });

  it('is not a card nobody has answered', () => {
    /*
     * It has never been scheduled anywhere; `dueFirst` already deals it as
     * unseen, and counting it here would say the app dropped something it had
     * never picked up.
     *
     * The `due` is deliberately far out, which `emptyReview` would never
     * write — it sets `due` to the moment the row was made. That is the point:
     * reviews cross a sync boundary and arrive from other devices, so the
     * check has to hold for a record this app did not author. Written the
     * obvious way, with `due: NOW`, this passed on the due date alone and said
     * nothing about the guard at all.
     */
    const reviews: Reviews = { [K('econ')]: card({ seen: 0, due: NOW + 40 * DAY }) };
    expect(wouldMiss(reviews, K('econ'), tests.econ)).toBe(false);
  });

  it('is nothing at all when no test is near', () => {
    const reviews: Reviews = { [K('econ')]: card({ due: NOW + 90 * DAY }) };
    expect(wouldMiss(reviews, K('econ'), undefined)).toBe(false);
    expect(missingCount([K('econ')], reviews, undefined)).toBe(0);
  });

  it('counts a set of them', () => {
    const keys = [K('econ', 'a'), K('econ', 'b'), K('econ', 'c')];
    const reviews: Reviews = {
      [keys[0]]: card({ due: NOW + 16 * DAY }),
      [keys[1]]: card({ due: NOW + 2 * DAY }),
      [keys[2]]: card({ due: NOW + 40 * DAY }),
    };
    expect(missingCount(keys, reviews, tests.econ)).toBe(2);
  });
});

describe('bringing them back', () => {
  it('moves a stranded card to a day before the test', () => {
    const tests: Tests = { econ: test(10) };
    const key = K('econ');
    const reviews: Reviews = { [key]: card({ due: NOW + 40 * DAY }) };
    const out = inTime(reviews, tests, NOW);
    expect(out[key].due).toBeLessThan(tests.econ.at);
    expect(out[key].due).toBeGreaterThanOrEqual(NOW);
  });

  it('changes nothing else about the card', () => {
    const tests: Tests = { econ: test(10) };
    const key = K('econ');
    const was = card({ due: NOW + 40 * DAY });
    const out = inTime({ [key]: was }, tests, NOW);
    expect({ ...out[key], due: 0 }).toEqual({ ...was, due: 0 });
  });

  it('leaves a course with no test near completely alone', () => {
    const key = K('psci');
    const reviews: Reviews = { [key]: card({ due: NOW + 40 * DAY }) };
    expect(inTime(reviews, { econ: test(5) }, NOW)).toBe(reviews);
  });

  it('returns the very same object when nothing moved', () => {
    // A screen memoises on this. A new object for a change that did not happen
    // is a re-render and a re-sorted deck for nothing.
    const reviews: Reviews = { [K('econ')]: card({ due: NOW + DAY }) };
    expect(inTime(reviews, { econ: test(10) }, NOW)).toBe(reviews);
  });

  it('never pushes a card back, only forward', () => {
    /*
     * A card due tomorrow must not be moved out to the eve of a test next
     * week because it happens to rank as the most certain in its set. It is
     * not moved because it is never in the set: `wouldMiss` only collects
     * cards whose `due` is already past the eve.
     */
    const tests: Tests = { econ: test(10) };
    const soon = K('econ', 'soon');
    const late = K('econ', 'late');
    const reviews: Reviews = {
      [soon]: card({ interval: 60, due: NOW + DAY }),
      [late]: card({ interval: 2, due: NOW + 40 * DAY }),
    };
    const out = inTime(reviews, tests, NOW);
    expect(out[soon].due).toBe(NOW + DAY);
    // And the one that was moved went earlier than it had been, not later.
    expect(out[late].due).toBeLessThan(reviews[late].due);
  });

  it('leaves a card that has already had a look inside the run-up', () => {
    /*
     * The bound on the guarantee, and the thing a rollout had to find. A
     * forced look updates `seen` and the card's own interval then sends it
     * further out than ever — so without this it is stranded again tomorrow,
     * dealt again, and again. The set never shrinks, and on the eve, where
     * there is one slot left, the whole deck falls due at once: measured at
     * 68 cards on one evening against a 25-card sitting.
     */
    const tests: Tests = { econ: test(10) };
    const key = K('econ');
    // Answered three days ago, which is inside the three-week run-up, and
    // then sent away for six weeks.
    const reviews: Reviews = { [key]: card({ seen: NOW - 3 * DAY, due: NOW + 42 * DAY }) };
    expect(wouldMiss(reviews, key, tests.econ)).toBe(false);
    expect(inTime(reviews, tests, NOW)).toBe(reviews);
  });

  it('promises one look, not a revision plan', () => {
    // The same card before and after its look. Before: the schedule misses
    // the test and nothing has been seen in the run-up, so it is brought
    // back. After: it has had the look, and its own schedule takes over.
    const tests: Tests = { econ: test(10) };
    const key = K('econ');
    const before: Reviews = { [key]: card() };
    expect(wouldMiss(before, key, tests.econ)).toBe(true);
    const after: Reviews = { [key]: card({ seen: NOW, due: NOW + 45 * DAY }) };
    expect(wouldMiss(after, key, tests.econ)).toBe(false);
  });

  it('deals each course against its own test, not the nearest one anywhere', () => {
    const tests: Tests = { econ: test(3), psci: test(14) };
    const e = K('econ');
    const p = K('psci');
    const reviews: Reviews = { [e]: card({ due: NOW + 40 * DAY }), [p]: card({ due: NOW + 40 * DAY }) };
    const out = inTime(reviews, tests, NOW);
    expect(out[e].due).toBeLessThan(tests.econ.at);
    expect(out[p].due).toBeLessThan(tests.psci.at);
    expect(out[p].due).toBeGreaterThan(tests.econ.at);
  });

  it('gives the card the scheduler is least sure of the earlier look', () => {
    const tests: Tests = { econ: test(11) };
    const sure = K('econ', 'sure');
    const shaky = K('econ', 'shaky');
    const reviews: Reviews = {
      [sure]: card({ interval: 60, due: NOW + 60 * DAY }),
      [shaky]: card({ interval: 13, due: NOW + 13 * DAY }),
    };
    const out = inTime(reviews, tests, NOW);
    expect(out[shaky].due).toBeLessThan(out[sure].due);
  });

  it('puts every one of a large set on a different day rather than on the eve', () => {
    const tests: Tests = { econ: test(11) };
    const reviews: Reviews = {};
    for (let i = 0; i < 40; i += 1) {
      reviews[K('econ', `q${i}`)] = card({ interval: 20 + i, due: NOW + (20 + i) * DAY });
    }
    const out = inTime(reviews, tests, NOW);
    const days = new Set(Object.values(out).map((r) => Math.round((tests.econ.at - r.due) / DAY)));
    expect(days.size).toBeGreaterThan(5);
    expect(Math.min(...days)).toBeGreaterThanOrEqual(LAST_LOOK);
  });
});

/**
 * The day that is not 86,400,000 milliseconds long.
 *
 * `daysBack` round-trips through a `Date` instead of subtracting `days * DAY`,
 * for the reason `shiftIso` in `lib/date.ts` gives. Twice a year a day is an
 * hour shorter or longer, and millisecond arithmetic across that boundary
 * lands a last look on the wrong calendar day — two slots collapse onto one
 * date and the day either side of it gets nothing.
 *
 * **The default suite cannot see this.** Vitest runs in UTC here, where every
 * day really is 86,400,000ms and both spellings agree; a mutation swapping one
 * for the other survives the whole suite, and survives `npm run test:zones` as
 * well, because nothing in the shipped semester happens near a transition.
 * So the dates below are chosen to straddle one — the US clocks go back on 1
 * November 2026 — and this test is a guard only when the suite runs in a zone
 * that observes it. `test:zones` runs Chicago, which does.
 */
describe('a run-up that crosses a daylight-saving change', () => {
  const NOVEMBER = new Date(2026, 10, 10).getTime();
  const nov = (days: number): Test => ({ at: NOVEMBER, kind: 'Final', days });

  it('deals every last look onto a calendar day of its own', () => {
    const test = nov(HORIZON);
    // Three weeks before a 10 November final is 20 October: the run-up
    // contains the transition on the 1st.
    const now = new Date(2026, 9, 20, 19).getTime();
    const reviews: Reviews = {};
    for (let i = 0; i < 21; i += 1) {
      reviews[K('econ', `q${i}`)] = card({
        interval: 60 + i,
        seen: now - 40 * DAY,
        due: now + (60 + i) * DAY,
      });
    }
    const out = inTime(reviews, { econ: test }, now);
    const days = Object.values(out).map((r) => {
      const d = new Date(r.due);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    });
    // Twenty-one cards, twenty-one distinct dates, none doubled up.
    expect(new Set(days).size).toBe(21);
    // And each one at local midnight, not at 23:00 the day before.
    for (const r of Object.values(out)) {
      expect(new Date(r.due).getHours(), new Date(r.due).toString()).toBe(0);
    }
  });
});
