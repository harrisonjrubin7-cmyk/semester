import { describe, expect, it } from 'vitest';
import { classesToNudge, dueReminders, inQuiet } from './notify';
import type { DatedItem } from './types';
import type { NotifKey } from '../data/misc';

const ALL: Record<NotifKey, boolean> = {
  class: true, today: true, two: true, free: true, sun: true, exam: true, term: true, attend: true,
  bill: true,
};
const NONE: Record<NotifKey, boolean> = {
  class: false, today: false, two: false, free: false, sun: false, exam: false, term: false, attend: false,
  bill: false,
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
    const out = dueReminders(THU, { ...ALL, term: false, attend: false }, {
      items: [], classes: [], registrar: sheet,
    });
    expect(out.filter((r) => r.rule === 'term')).toEqual([]);
  });
});

describe('quiet hours', () => {
  const at = (h: number, m = 0) => new Date(2026, 8, 3, h, m);
  const night = { from: 22 * 60, to: 8 * 60 };
  const src = { items: [item({ isToday: true })], classes: [], quiet: night };

  // The whole difficulty, and the reason `inQuiet` is a function rather than
  // `m >= from && m < to` at the call site: that comparison is false for every
  // minute of the window everybody actually sets.
  it('wraps midnight', () => {
    expect(inQuiet(23 * 60, night)).toBe(true);
    expect(inQuiet(2 * 60, night)).toBe(true);
    expect(inQuiet(12 * 60, night)).toBe(false);
  });

  it('is half-open, so a held reminder fires on the tick that ends it', () => {
    expect(inQuiet(22 * 60, night)).toBe(true);
    expect(inQuiet(8 * 60, night)).toBe(false);
    expect(inQuiet(8 * 60 - 1, night)).toBe(true);
  });

  it('handles a window inside one day as well', () => {
    const nap = { from: 13 * 60, to: 15 * 60 };
    expect(inQuiet(14 * 60, nap)).toBe(true);
    expect(inQuiet(12 * 60, nap)).toBe(false);
    expect(inQuiet(23 * 60, nap)).toBe(false);
  });

  // Two readings of the same two numbers, and the one that silences the app
  // forever is not what anybody means by setting a start equal to an end.
  it('reads a window that starts when it ends as off, not as all day', () => {
    const none = { from: 9 * 60, to: 9 * 60 };
    for (const m of [0, 9 * 60, 9 * 60 + 1, 23 * 60 + 59]) expect(inQuiet(m, none)).toBe(false);
  });

  it('is off where none is set', () => {
    expect(inQuiet(3 * 60, null)).toBe(false);
  });

  it('silences every rule inside the window, with no exception', () => {
    expect(dueReminders(at(23), ALL, src)).toEqual([]);
    expect(
      dueReminders(at(3), ALL, {
        ...src,
        classes: [{ label: 'ECON 1020', at: 3 * 60 + 10, where: 'Hall 201' }],
        registrar: [
          { id: 'drop-clean', label: 'Drop', iso: '2026-09-10', until: '', cost: '', kind: 'deadline' as const },
        ],
        bill: { due: '2026-09-10', cents: 1000 },
      }),
    ).toEqual([]);
  });

  it('says everything again the moment the window lifts', () => {
    expect(dueReminders(at(8), ALL, src).length).toBeGreaterThan(0);
  });

  it('changes nothing for somebody who has not set one', () => {
    expect(dueReminders(at(23), ALL, { items: src.items, classes: [] }).length).toBeGreaterThan(0);
  });
});

describe('the tuition instalment', () => {
  const bill = { due: '2026-09-10', cents: 368_644 };

  it('warns a week out, with the amount and the consequence', () => {
    const out = dueReminders(THU, ALL, { items: [], classes: [], bill });
    const said = out.find((r) => r.rule === 'bill');
    expect(said?.title).toBe('One week: tuition payment');
    expect(said?.body).toBe(
      "$3,686.44 due. An unpaid balance is what puts a hold on next term's registration.",
    );
  });

  it('warns again the day before, and not on the days between', () => {
    const days = [8, 9, 10].map(
      (d) =>
        dueReminders(new Date(2026, 8, d, 9, 0), ALL, { items: [], classes: [], bill }).filter(
          (r) => r.rule === 'bill',
        ).length,
    );
    expect(days).toEqual([0, 1, 0]);
  });

  it('holds off until the morning, like the registrar rule', () => {
    const out = dueReminders(new Date(2026, 8, 3, 6, 30), ALL, { items: [], classes: [], bill });
    expect(out.filter((r) => r.rule === 'bill')).toEqual([]);
  });

  it('says nothing where no payment date has been entered', () => {
    expect(
      dueReminders(THU, ALL, { items: [], classes: [] }).filter((r) => r.rule === 'bill'),
    ).toEqual([]);
    expect(
      dueReminders(THU, ALL, { items: [], classes: [], bill: null }).filter(
        (r) => r.rule === 'bill',
      ),
    ).toEqual([]);
  });

  // The point of keeping this separate from the registrar rule: academic
  // deadlines without money notifications has to be a reachable setting.
  it('is silent when the rule is off, with the registrar rule still on', () => {
    const out = dueReminders(THU, { ...ALL, bill: false }, { items: [], classes: [], bill });
    expect(out.filter((r) => r.rule === 'bill')).toEqual([]);
  });

  it('fires independently of the registrar rule being off', () => {
    const out = dueReminders(THU, { ...ALL, term: false }, { items: [], classes: [], bill });
    expect(out.filter((r) => r.rule === 'bill')).toHaveLength(1);
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

describe('what has already been ticked off', () => {
  // The installed icon's badge has always filtered these out — see the badge
  // effect in `state/store.tsx`. The notifications never did, so the number on
  // the icon and the number in the notification disagreed by whatever you had
  // handed in.
  const four = [
    item({ id: 'a', title: 'Problem Set 1', isToday: true, daysAway: 0 }),
    item({ id: 'b', title: 'Reading response', isToday: true, daysAway: 0 }),
    item({ id: 'c', title: 'Memo', daysAway: 2 }),
    item({ id: 'd', title: 'Midterm 1', kind: 'Exam', daysAway: 7 }),
  ];
  const all = { a: true, b: true, c: true, d: true };

  it('says nothing about a day whose deadlines are all handed in', () => {
    const out = dueReminders(THU, ALL, { items: four, classes: [], done: all });
    expect(out.some((r) => r.rule === 'today')).toBe(false);
  });

  it('counts only what is left when some of them are', () => {
    const out = dueReminders(THU, ALL, { items: four, classes: [], done: { a: true } });
    const today = out.find((r) => r.rule === 'today');
    expect(today?.title).toBe('1 due today');
    expect(today?.body).toBe('Reading response');
  });

  it('does not warn two days out about work already done', () => {
    expect(dueReminders(THU, ALL, { items: four, classes: [], done: all })
      .some((r) => r.rule === 'two')).toBe(false);
    expect(dueReminders(THU, ALL, { items: four, classes: [], done: {} })
      .some((r) => r.rule === 'two')).toBe(true);
  });

  it('does not count down to an exam that has been sat', () => {
    expect(dueReminders(THU, ALL, { items: four, classes: [], done: all })
      .some((r) => r.rule === 'exam')).toBe(false);
    expect(dueReminders(THU, ALL, { items: four, classes: [], done: {} })
      .some((r) => r.rule === 'exam')).toBe(true);
  });

  it('leaves finished work out of the weekly report', () => {
    const week = four.map((i) => ({ ...i, isToday: false, daysAway: 3 }));
    const sun = (done: Record<string, boolean>) =>
      dueReminders(SUN_EVENING, ALL, { items: week, classes: [], done }).find((r) => r.rule === 'sun');
    expect(sun({})?.body).toContain('4 due this week');
    expect(sun({ a: true, b: true })?.body).toContain('2 due this week');
    expect(sun(all)?.body).toBe('Nothing due next week — a good one to look back on.');
  });

  it('keeps the all-clear about the day, not about the list', () => {
    // Clearing three deadlines does not turn the morning that had three on it
    // into a morning that had none: the "3 due today" already went out, and a
    // contradicting all-clear an hour later is worse than no all-clear.
    const out = dueReminders(THU, ALL, { items: four, classes: [], done: all });
    expect(out.some((r) => r.rule === 'free')).toBe(false);
    expect(dueReminders(THU, ALL, { items: [], classes: [], done: {} })
      .some((r) => r.rule === 'free')).toBe(true);
  });

  it('is unchanged for a caller that states nothing about what is done', () => {
    const with_ = dueReminders(THU, ALL, { items: four, classes: [], done: {} });
    const without = dueReminders(THU, ALL, { items: four, classes: [] });
    expect(without.map((r) => r.id)).toEqual(with_.map((r) => r.id));
  });
});
describe('classesToNudge', () => {
  const block = (over: Record<string, unknown> = {}) =>
    ({ title: 'PSCI 1104', meta: 'Buttrick 101', at: 885, ...over }) as {
      title: string; meta: string; at: number; canceled?: boolean; optional?: boolean;
    };

  it('leaves out a class that is not happening', () => {
    // Straight out of the shipped PSCI syllabus: two blocks on 3 September are
    // marked cancelled, and the in-page timer sent a phone
    // "PSCI 1104 — canceled in 10 min" for one of them.
    expect(classesToNudge([block({ title: 'PSCI 1104 — canceled', canceled: true })])).toEqual([]);
  });

  it('leaves out an optional one, which you are never late for', () => {
    expect(classesToNudge([block({ title: 'Office hours', optional: true })])).toEqual([]);
  });

  it('keeps the ones that are happening, as label, hour and place', () => {
    expect(classesToNudge([block(), block({ title: 'Gone', canceled: true })])).toEqual([
      { label: 'PSCI 1104', at: 885, where: 'Buttrick 101' },
    ]);
  });

  it('is what both notification paths use, so they cannot drift apart again', () => {
    // The push queue filtered these and the in-page timer did not. Two copies
    // of one rule is how that happened; there is one copy now.
    const rail = [block(), block({ title: 'Gone', canceled: true }), block({ optional: true })];
    expect(classesToNudge(rail)).toHaveLength(1);
  });

  it('warns about nothing when a cancelled class would have started', () => {
    const rail = [block({ title: 'PSCI 1104 — canceled', at: 9 * 60 + 10, canceled: true })];
    const out = dueReminders(THU, ALL, { items: [], classes: classesToNudge(rail) });
    expect(out.some((r) => r.rule === 'class')).toBe(false);
  });
});
