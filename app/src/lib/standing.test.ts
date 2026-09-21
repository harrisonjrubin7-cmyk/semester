import { describe, expect, it } from 'vitest';
import { badge, claimed, lateBy, overdueCount, overdueLine, split, standingOf } from './standing';
import type { DatedItem } from './types';

function item(id: string, daysAway: number, title = id): DatedItem {
  const date = new Date(2026, 8, 3 + daysAway);
  return {
    id,
    c: 'econ',
    kind: 'Paper',
    title,
    month: date.getMonth(),
    day: date.getDate(),
    dueTime: '11:59p',
    where: 'Brightspace',
    date,
    dueShort: 'x',
    dow: 'Thu',
    mon: 'Sep',
    isToday: daysAway === 0,
    isPast: daysAway < 0,
    daysAway,
  } as DatedItem;
}

describe('standingOf', () => {
  it('calls a future deadline ahead', () => {
    expect(standingOf(item('a', 3), {})).toBe('ahead');
  });

  it('calls a passed deadline overdue', () => {
    expect(standingOf(item('a', -1), {})).toBe('overdue');
  });

  /*
   * This is half the rule. `item()` above fabricates a `DatedItem`, so what
   * is held here is what `standingOf` does *given* an `isPast` that is
   * already right — and the promise the file makes, that a deadline due today
   * is never called missed, only holds if `date.ts` sets `isPast` to
   * `away < 0` rather than `away <= 0`.
   *
   * `lib/select.test.ts`, "dates each item against the clock it was given",
   * is the other half: a today item out of `datedItems` with `isPast` false.
   * Neither said so until `SIMPLIFY-AUDIT.md` J1 went looking, and nothing
   * here would fail if `date.ts` changed.
   */
  it('never calls today overdue, however late in the day', () => {
    expect(standingOf(item('a', 0), {})).toBe('ahead');
  });

  it('lets done win over overdue — handed in late is still handed in', () => {
    expect(standingOf(item('a', -5), { a: true })).toBe('done');
  });
});

describe('split', () => {
  const items = [item('past2', -6), item('past1', -1), item('soon', 1), item('later', 9)];

  it('puts each item in exactly one bucket', () => {
    const s = split(items, {});
    expect(s.ahead.map((i) => i.id)).toEqual(['soon', 'later']);
    expect(s.overdue.map((i) => i.id)).toEqual(['past1', 'past2']);
    expect(s.done).toEqual([]);
  });

  it('reads ahead forwards and overdue backwards', () => {
    const s = split([item('c', 5), item('a', -9), item('b', -2)], {});
    expect(s.overdue.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('keeps a ticked future deadline in ahead, not in done', () => {
    // You want to see it is handled, in the place you were already looking.
    const s = split(items, { soon: true });
    expect(s.ahead.map((i) => i.id)).toEqual(['later']);
    expect(s.done.map((i) => i.id)).toEqual(['soon']);
  });

  it('does not mutate the list it is given', () => {
    const given = [item('b', 4), item('a', 1)];
    split(given, {});
    expect(given.map((i) => i.id)).toEqual(['b', 'a']);
  });
});

describe('overdueCount', () => {
  it('counts only the unticked past', () => {
    const items = [item('a', -2), item('b', -3), item('c', 4)];
    expect(overdueCount(items, {})).toBe(2);
    expect(overdueCount(items, { a: true })).toBe(1);
  });
});

describe('lateBy', () => {
  it('says a day, days, then weeks', () => {
    expect(lateBy(item('a', -1))).toBe('1 day late');
    expect(lateBy(item('a', -3))).toBe('3 days late');
    expect(lateBy(item('a', -21))).toBe('3 weeks late');
  });

  it('does not call today late', () => {
    expect(lateBy(item('a', 0))).toBe('due today');
  });
});

describe('overdueLine', () => {
  const code = () => 'ECON 1020';

  it('is calm when nothing is missed', () => {
    expect(overdueLine([], code)).toBe('Nothing missed. Keep it that way.');
  });

  it('names the oldest miss, not the newest', () => {
    // split() hands back most-recent-first, so the last one is the oldest.
    const overdue = [item('new', -1, 'Quiz 3'), item('old', -6, 'Problem set 2')];
    expect(overdueLine(overdue, code)).toBe(
      'ECON 1020 Problem set 2 is 6 days late, and 1 other went by.',
    );
  });

  it('does not add a tail when there is only one', () => {
    expect(overdueLine([item('a', -2, 'Essay')], code)).toBe('ECON 1020 Essay is 2 days late.');
  });
});

describe('badge', () => {
  it('is blank at zero so a chip does not read "Overdue 0"', () => {
    expect(badge(0)).toBe('');
    expect(badge(3)).toBe(' 3');
  });
});

describe('claimed', () => {
  const item = (c: string, id: string) => ({ c, id }) as unknown as DatedItem;
  const ECON = item('econ', 'econ-1');
  const PSCI = item('psci', 'psci-1');
  const MINE = item('hist-3010', 'mine-1');

  it('drops the shipped courses while the question is still open', () => {
    // `state.sample` true means nobody has answered "these are mine / not
    // mine" yet, so those four courses belong to nobody — and a deadline
    // belonging to nobody is not one anybody missed.
    expect(claimed([ECON, PSCI], [], true)).toEqual([]);
  });

  it('keeps a deadline from a course the student did import', () => {
    // The half that makes this a filter rather than a mute: their own missed
    // deadline still warns them, sample term or not.
    expect(claimed([ECON, PSCI, MINE], ['hist-3010'], true)).toEqual([MINE]);
  });

  it('is the identity once the question has been answered', () => {
    // Adopting copies the sample courses into `state.courses`, so the same
    // rule that excluded them now includes them. Nothing is special-cased.
    const own = ['econ', 'psci'];
    expect(claimed([ECON, PSCI], own, false)).toEqual([ECON, PSCI]);
    expect(claimed([ECON, PSCI], own, true)).toEqual([ECON, PSCI]);
  });

  it('does not filter at all when the sample is off, whatever it is given', () => {
    // With `sample` false the catalogue is the student's own courses only, so
    // there is nothing to exclude and an empty `own` must not empty the list.
    // Reading it the other way would blank the banner for everyone who
    // dismissed the sample, which is the opposite of the bug.
    expect(claimed([ECON, PSCI, MINE], [], false)).toEqual([ECON, PSCI, MINE]);
  });

  it('counts nothing as missed on a first run, and the student’s own as missed', () => {
    // The two ends, through the function the banner actually calls.
    const done = {};
    // `standingOf` reads `isPast`, not `daysAway` — the first version of this
    // fixture set the latter and the count came back nought for the wrong
    // reason, which would have let a broken `claimed` pass the middle case.
    const overdueItems = [
      { ...ECON, isPast: true },
      { ...PSCI, isPast: true },
      { ...MINE, isPast: true },
    ] as unknown as DatedItem[];
    expect(overdueCount(claimed(overdueItems, [], true), done)).toBe(0);
    expect(overdueCount(claimed(overdueItems, ['hist-3010'], true), done)).toBe(1);
    expect(overdueCount(claimed(overdueItems, [], false), done)).toBe(3);
  });
});
