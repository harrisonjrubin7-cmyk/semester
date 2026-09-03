import { describe, expect, it } from 'vitest';
import { dueReminders } from './notify';
import type { DatedItem } from './types';
import type { NotifKey } from '../data/misc';

const ALL: Record<NotifKey, boolean> = {
  class: true, today: true, two: true, free: true, sun: true, exam: true,
};
const NONE: Record<NotifKey, boolean> = {
  class: false, today: false, two: false, free: false, sun: false, exam: false,
};

const item = (over: Partial<DatedItem>): DatedItem =>
  ({
    id: 'i1', c: 'econ', title: 'Problem Set 1', kind: 'Problem set',
    dueShort: 'Today', weight: '20%', isToday: false, daysAway: 0,
    ...over,
  } as DatedItem);

// Thursday 3 Sep 2026, 09:00.
const THU = new Date(2026, 8, 3, 9, 0);
const SUN_EVENING = new Date(2026, 8, 6, 19, 0);

describe('dueReminders', () => {
  it('shows nothing when every rule is off', () => {
    const out = dueReminders(THU, NONE, {
      items: [item({ isToday: true }), item({ id: 'i2', daysAway: 2 })],
      classes: [{ label: 'ECON 1020', at: 9 * 60 + 10, where: 'Hall 201' }],
    });
    expect(out).toEqual([]);
  });

  it('warns about a class starting within fifteen minutes', () => {
    const out = dueReminders(THU, ALL, {
      items: [],
      classes: [{ label: 'ECON 1020', at: 9 * 60 + 10, where: 'Hall 201' }],
    });
    expect(out.find((r) => r.rule === 'class')?.title).toContain('10 min');
  });

  it('does not warn about a class that already started, or one hours away', () => {
    const src = {
      items: [],
      classes: [
        { label: 'Past', at: 8 * 60, where: '' },
        { label: 'Later', at: 14 * 60, where: '' },
      ],
    };
    expect(dueReminders(THU, ALL, src).some((r) => r.rule === 'class')).toBe(false);
  });

  it('gives the morning summary only after 8am', () => {
    const src = { items: [item({ isToday: true })], classes: [] };
    expect(dueReminders(new Date(2026, 8, 3, 7, 0), ALL, src).some((r) => r.rule === 'today')).toBe(false);
    expect(dueReminders(THU, ALL, src).some((r) => r.rule === 'today')).toBe(true);
  });

  it('gives the all-clear only when nothing is due', () => {
    expect(dueReminders(THU, ALL, { items: [], classes: [] }).some((r) => r.rule === 'free')).toBe(true);
    expect(
      dueReminders(THU, ALL, { items: [item({ isToday: true })], classes: [] })
        .some((r) => r.rule === 'free'),
    ).toBe(false);
  });

  it('warns two days out, and not one or three', () => {
    const at = (d: number) =>
      dueReminders(THU, ALL, { items: [item({ daysAway: d })], classes: [] })
        .some((r) => r.rule === 'two');
    expect(at(2)).toBe(true);
    expect(at(1)).toBe(false);
    expect(at(3)).toBe(false);
  });

  it('warns a week before an exam, but not before a problem set', () => {
    const kind = (k: string) =>
      dueReminders(THU, ALL, { items: [item({ daysAway: 7, kind: k })], classes: [] })
        .some((r) => r.rule === 'exam');
    expect(kind('Midterm')).toBe(true);
    expect(kind('Final exam')).toBe(true);
    expect(kind('Problem set')).toBe(false);
  });

  it('gives the week ahead on Sunday evening only', () => {
    const src = { items: [item({ daysAway: 3, isToday: false })], classes: [] };
    expect(dueReminders(SUN_EVENING, ALL, src).some((r) => r.rule === 'sun')).toBe(true);
    expect(dueReminders(new Date(2026, 8, 6, 11, 0), ALL, src).some((r) => r.rule === 'sun')).toBe(false);
    expect(dueReminders(THU, ALL, src).some((r) => r.rule === 'sun')).toBe(false);
  });

  it('gives every reminder an id that is stable within a day', () => {
    const src = { items: [item({ isToday: true })], classes: [] };
    const a = dueReminders(THU, ALL, src).map((r) => r.id);
    const b = dueReminders(new Date(2026, 8, 3, 11, 30), ALL, src).map((r) => r.id);
    expect(a).toEqual(b);
  });
});
