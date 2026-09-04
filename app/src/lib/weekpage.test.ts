import { describe, expect, it } from 'vitest';
import { busyDays, dueByDay, lanesOf, weekDates, weekLabel, weekLine } from './weekpage';
import type { DatedItem } from './types';

const MON = new Date(2026, 8, 7); // Mon 7 Sep 2026

const item = (date: Date, title: string): DatedItem =>
  ({ id: title, title, date, daysAway: 0 }) as unknown as DatedItem;

describe('the seven days', () => {
  it('runs from whatever the view calls the first', () => {
    const days = weekDates(MON);
    expect(days).toHaveLength(7);
    expect(days[0].getDate()).toBe(7);
    expect(days[6].getDate()).toBe(13);
  });

  it('crosses a month without arithmetic of its own', () => {
    const days = weekDates(new Date(2026, 8, 28));
    expect(days[6].getMonth()).toBe(9);
    expect(days[6].getDate()).toBe(4);
  });
});

describe('deadlines by day', () => {
  it('groups them onto the day they fall on', () => {
    const days = dueByDay(
      [item(new Date(2026, 8, 9), 'Problem Set 2'), item(new Date(2026, 8, 9), 'Reflection')],
      MON,
    );
    expect(days[2].items.map((i) => i.title)).toEqual(['Problem Set 2', 'Reflection']);
    expect(days[0].items).toEqual([]);
  });

  it('returns the empty days too', () => {
    // A sheet of paper wants a row to write on for Thursday whether or not
    // anything is already due then.
    expect(dueByDay([], MON)).toHaveLength(7);
  });

  it('leaves out a deadline from another week', () => {
    expect(dueByDay([item(new Date(2026, 8, 20), 'Later')], MON).every((d) => !d.items.length)).toBe(
      true,
    );
  });

  it('can be narrowed to the days that carry something', () => {
    const days = dueByDay([item(new Date(2026, 8, 9), 'Problem Set 2')], MON);
    expect(busyDays(days).map((d) => d.label)).toEqual(['Wed 9']);
  });
});

describe('two things at once', () => {
  const b = (id: string, at: number, minutes: number) => ({ id, at, minutes });

  it('puts a clash side by side', () => {
    const out = lanesOf([b('class', 660, 50), b('hours', 660, 60)]);
    expect(out.class).toEqual({ lane: 0, of: 2 });
    expect(out.hours).toEqual({ lane: 1, of: 2 });
  });

  it('leaves a day with no clash at full width', () => {
    const out = lanesOf([b('a', 540, 50), b('b', 780, 50)]);
    expect(out.a).toEqual({ lane: 0, of: 1 });
    expect(out.b).toEqual({ lane: 0, of: 1 });
  });

  it('divides per collision, not per day', () => {
    // Splitting every Thursday block in half because two of them clash at
    // eleven would make a legible day illegible to fix an hour of it.
    const out = lanesOf([b('x', 660, 50), b('y', 660, 50), b('later', 900, 50)]);
    expect(out.x.of).toBe(2);
    expect(out.later).toEqual({ lane: 0, of: 1 });
  });

  it('reuses a lane once its block has ended', () => {
    // `c` clashes with the long `b` but not with `a`, which has finished, so
    // it takes `a`'s slot rather than opening a third and narrowing all three.
    const out = lanesOf([b('a', 600, 60), b('b', 600, 120), b('c', 660, 40)]);
    expect(out.c).toEqual({ lane: 0, of: 2 });
  });

  it('does not call back-to-back blocks a clash', () => {
    const out = lanesOf([b('a', 600, 60), b('b', 660, 60)]);
    expect(out.a).toEqual({ lane: 0, of: 1 });
    expect(out.b).toEqual({ lane: 0, of: 1 });
  });

  it('takes an empty day without complaint', () => {
    expect(lanesOf([])).toEqual({});
  });
});

describe('how the week is named', () => {
  it('says one month once', () => {
    expect(weekLabel(MON)).toBe('Sep 7 – 13');
  });

  it('names both months where it crosses one', () => {
    expect(weekLabel(new Date(2026, 8, 28))).toBe('Sep 28 – Oct 4');
  });
});

describe('what the week asks', () => {
  it('counts, and does not characterise', () => {
    // "A heavy week" is a judgement the app cannot make about somebody whose
    // other four commitments it has never been told about.
    const days = dueByDay([item(new Date(2026, 8, 9), 'Problem Set 2')], MON);
    expect(weekLine(days, 12)).toBe('12 classes and 1 deadline this week.');
  });

  it('leaves out the half that is nothing', () => {
    expect(weekLine(dueByDay([], MON), 12)).toBe('12 classes this week.');
    const days = dueByDay([item(new Date(2026, 8, 9), 'x')], MON);
    expect(weekLine(days, 0)).toBe('1 deadline this week.');
  });

  it('says so plainly when there is nothing', () => {
    expect(weekLine(dueByDay([], MON), 0)).toBe('Nothing on this week.');
  });
});
