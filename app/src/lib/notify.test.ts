import { describe, expect, it } from 'vitest';
import { dueReminders } from './notify';
import type { DatedItem } from './types';
import type { NotifKey } from '../data/misc';

const ALL: Record<NotifKey, boolean> = {
  class: true, today: true, two: true, free: true, sun: true, exam: true, term: true,
};
const NONE: Record<NotifKey, boolean> = {
  class: false, today: false, two: false, free: false, sun: false, exam: false, term: false,
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

  it('sends the weekly report even when nothing is due next week', () => {
    // A week with nothing coming is exactly the week worth reading the
    // backward half of, and staying silent meant it never arrived then.
    const quiet = { items: [], classes: [] };
    const fired = dueReminders(SUN_EVENING, ALL, quiet).filter((r) => r.rule === 'sun');
    expect(fired).toHaveLength(1);
    expect(fired[0].body).toContain('look back on');
  });

  it('gives every reminder an id that is stable within a day', () => {
    const src = { items: [item({ isToday: true })], classes: [] };
    const a = dueReminders(THU, ALL, src).map((r) => r.id);
    const b = dueReminders(new Date(2026, 8, 3, 11, 30), ALL, src).map((r) => r.id);
    expect(a).toEqual(b);
  });
});

describe('registrar deadlines', () => {
  const sheet = [
    { id: 'drop-clean', label: 'Last day to drop without a W', iso: '2026-09-10', until: '',
      cost: 'After this it stays on your transcript.', kind: 'deadline' as const },
  ];

  it('warns a week out', () => {
    // Thursday 3 Sep, and the drop deadline is the 10th.
    const out = dueReminders(THU, ALL, { items: [], classes: [], registrar: sheet });
    expect(out.filter((r) => r.rule === 'term').map((r) => r.title)).toEqual([
      'One week: Last day to drop without a W',
    ]);
  });

  it('says what it costs rather than what it is', () => {
    const out = dueReminders(THU, ALL, { items: [], classes: [], registrar: sheet });
    expect(out.find((r) => r.rule === 'term')?.body).toBe(
      'After this it stays on your transcript.',
    );
  });

  it('warns again the day before, and not on the days between', () => {
    const days = [8, 9, 10].map(
      (d) =>
        dueReminders(new Date(2026, 8, d, 9, 0), ALL, {
          items: [], classes: [], registrar: sheet,
        }).filter((r) => r.rule === 'term').length,
    );
    // 8th: nothing. 9th: the day-before warning. 10th: the day itself, which
    // Today already carries — a notification there would be too late to act on.
    expect(days).toEqual([0, 1, 0]);
  });

  it('stays quiet about a break, which cannot be missed', () => {
    const brk = [{ ...sheet[0], id: 'break', kind: 'break' as const }];
    const out = dueReminders(THU, ALL, { items: [], classes: [], registrar: brk });
    expect(out.filter((r) => r.rule === 'term')).toEqual([]);
  });

  it('says nothing at all when the sheet is empty', () => {
    const out = dueReminders(THU, ALL, { items: [], classes: [] });
    expect(out.filter((r) => r.rule === 'term')).toEqual([]);
  });

  it('is silent when the rule is off', () => {
    const out = dueReminders(THU, { ...ALL, term: false }, {
      items: [], classes: [], registrar: sheet,
    });
    expect(out.filter((r) => r.rule === 'term')).toEqual([]);
  });
});

describe('the exam warning', () => {
  const exam = (daysAway: number) =>
    item({ id: 'x', daysAway, kind: 'Exam', title: 'Midterm 1', weight: '25%' });

  it('fires at four weeks, where the runway starts', () => {
    const out = dueReminders(THU, ALL, { items: [exam(28)], classes: [] });
    expect(out.find((r) => r.rule === 'exam')?.title).toBe('Four weeks: Midterm 1');
  });

  it('fires again at one week', () => {
    const out = dueReminders(THU, ALL, { items: [exam(7)], classes: [] });
    expect(out.find((r) => r.rule === 'exam')?.title).toBe('One week: Midterm 1');
  });

  it('says nothing on the days between', () => {
    for (const d of [27, 14, 8, 6]) {
      const out = dueReminders(THU, ALL, { items: [exam(d)], classes: [] });
      expect(out.filter((r) => r.rule === 'exam')).toEqual([]);
    }
  });

  it('takes a heavy project as an exam, since the runway does', () => {
    const project = item({ id: 'p', daysAway: 28, kind: 'Project', title: 'Case', weight: '30%' });
    const out = dueReminders(THU, ALL, { items: [project], classes: [] });
    expect(out.filter((r) => r.rule === 'exam')).toHaveLength(1);
  });

  it('leaves a problem set alone', () => {
    const ps = item({ id: 'q', daysAway: 28, kind: 'Problem set', title: 'PS4', weight: '5%' });
    expect(
      dueReminders(THU, ALL, { items: [ps], classes: [] }).filter((r) => r.rule === 'exam'),
    ).toEqual([]);
  });
});
