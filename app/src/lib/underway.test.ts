import { describe, expect, it } from 'vitest';
import {
  STALLED_AFTER_DAYS,
  isUnderway,
  openFor,
  openLine,
  readStarted,
  stalled,
  toggle,
  underway,
  underwayLine,
  type StartedMap,
} from './underway';
import { split } from './standing';
import type { DatedItem } from './types';

const NOW = 1_788_000_000_000;
const DAY = 86_400_000;

const item = (id: string, over: Partial<DatedItem> = {}): DatedItem =>
  ({
    id,
    c: 'econ',
    title: id,
    kind: 'paper',
    date: new Date(NOW + 5 * DAY),
    isPast: false,
    daysAway: 5,
    dueShort: 'Fri',
    weight: '20%',
    ...over,
  }) as unknown as DatedItem;

describe('what counts as open', () => {
  it('is started and not finished', () => {
    expect(isUnderway('a', { a: NOW }, {})).toBe(true);
  });

  it('is not something you never started', () => {
    expect(isUnderway('a', {}, {})).toBe(false);
  });

  it('is not something you finished', () => {
    // Ticking it off is the end of it being open, whether or not the start
    // mark is still there.
    expect(isUnderway('a', { a: NOW }, { a: true })).toBe(false);
  });
});

describe('the list', () => {
  const items = [item('a'), item('b'), item('c')];
  const started: StartedMap = { a: NOW - 2 * DAY, c: NOW - 9 * DAY };

  it('shows what is open, longest first', () => {
    // The one that has been sitting longest is the one worth looking at.
    expect(underway(items, started, {}).map((i) => i.id)).toEqual(['c', 'a']);
  });

  it('drops one as soon as it is ticked', () => {
    expect(underway(items, started, { c: true }).map((i) => i.id)).toEqual(['a']);
  });

  it('is empty when nothing has been started', () => {
    expect(underway(items, {}, {})).toEqual([]);
  });
});

describe('a filter, not a fourth bucket', () => {
  it('keeps an overdue thing in Overdue as well as here', () => {
    // A paper started and now overdue is both. Moving it out of Overdue to
    // make the partition tidy would hide a miss.
    const late = item('late', { isPast: true, daysAway: -3 });
    const started = { late: NOW - 6 * DAY };
    expect(underway([late], started, {}).map((i) => i.id)).toEqual(['late']);
    expect(split([late], {}).overdue.map((i) => i.id)).toEqual(['late']);
  });

  it('leaves an open thing in Ahead too', () => {
    const soon = item('soon');
    expect(underway([soon], { soon: NOW }, {}).map((i) => i.id)).toEqual(['soon']);
    expect(split([soon], {}).ahead.map((i) => i.id)).toEqual(['soon']);
  });
});

describe('how long it has been open', () => {
  it('counts whole days', () => {
    expect(openFor('a', { a: NOW - 3 * DAY }, NOW)).toBe(3);
  });

  it('never goes negative', () => {
    // The store zeroes seconds on its clock while a mark is stamped with the
    // real instant, which made a thing started this minute read as -1.
    expect(openFor('a', { a: NOW + 30_000 }, NOW)).toBe(0);
  });

  it('is nothing for something never started', () => {
    expect(openFor('a', {}, NOW)).toBe(0);
  });

  it('says today rather than zero days', () => {
    expect(openLine('a', { a: NOW }, NOW)).toBe('Started today');
    expect(openLine('a', { a: NOW - DAY }, NOW)).toBe('Open since yesterday');
    expect(openLine('a', { a: NOW - 4 * DAY }, NOW)).toBe('Open 4 days');
    expect(openLine('a', {}, NOW)).toBe('');
  });
});

describe('the ones that have gone quiet', () => {
  const items = [item('fresh'), item('old'), item('older')];
  const started: StartedMap = {
    fresh: NOW - 2 * DAY,
    old: NOW - 12 * DAY,
    older: NOW - 30 * DAY,
  };

  it('finds only what has been sitting a long time', () => {
    // Started Monday and unfinished Thursday is a normal week. An app that is
    // noise about the ordinary gets ignored about the serious.
    expect(stalled(items, started, {}, NOW).map((i) => i.id)).toEqual(['older', 'old']);
  });

  it('uses a threshold that is not days', () => {
    expect(STALLED_AFTER_DAYS).toBeGreaterThanOrEqual(7);
  });

  it('says nothing about a week that is going fine', () => {
    expect(stalled([item('fresh')], { fresh: NOW - 2 * DAY }, {}, NOW)).toEqual([]);
  });
});

describe('the sentence over the list', () => {
  const items = [item('fresh'), item('old')];

  it('explains how to get here when nothing is open', () => {
    expect(underwayLine(items, {}, {}, NOW)).toContain('The button on any deadline');
  });

  it('counts, and says plainly when nothing is stuck', () => {
    const line = underwayLine(items, { fresh: NOW - DAY }, {}, NOW);
    expect(line).toContain('1 thing is open');
    expect(line).toContain('Nothing has been sitting long');
  });

  it('names the oldest rather than only counting it', () => {
    // "3 open" is a number. "one of them since the 2nd" is a reason to act.
    const line = underwayLine(items, { old: NOW - 14 * DAY }, {}, NOW);
    expect(line).toContain('old');
    expect(line).toContain('14 days');
  });

  it('pluralises off the real count', () => {
    const line = underwayLine(items, { fresh: NOW - DAY, old: NOW - DAY }, {}, NOW);
    expect(line).toContain('2 things are open');
  });
});

describe('marking and unmarking', () => {
  it('marks with the moment', () => {
    expect(toggle('a', {}, NOW)).toEqual({ a: NOW });
  });

  it('unmarks by removing rather than zeroing', () => {
    // A zero would read as "started at the epoch" everywhere that checks the
    // number rather than the key.
    const off = toggle('a', { a: NOW }, NOW + DAY);
    expect('a' in off).toBe(false);
  });

  it('does not disturb the others', () => {
    expect(toggle('a', { a: NOW, b: NOW }, NOW)).toEqual({ b: NOW });
  });

  it('does not mutate what it was given', () => {
    const before: StartedMap = { a: NOW };
    toggle('a', before, NOW);
    expect(before).toEqual({ a: NOW });
  });
});

describe('reading what was stored', () => {
  it('takes a map of numbers', () => {
    expect(readStarted({ a: NOW })).toEqual({ a: NOW });
  });

  it('drops anything that is not a real moment', () => {
    expect(readStarted({ a: 'yesterday', b: 0, c: -5, d: NOW })).toEqual({ d: NOW });
  });

  it('takes anything that is not a map as nothing', () => {
    expect(readStarted(null)).toEqual({});
    expect(readStarted([1, 2])).toEqual({});
    expect(readStarted('x')).toEqual({});
  });
});
