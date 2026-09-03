import { describe, expect, it } from 'vitest';
import { badge, lateBy, overdueCount, overdueLine, split, standingOf } from './standing';
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
