import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../data/catalog';
import type { Commitment } from './activities';
import type { AthleticEvent } from './athletics';
import {
  CATEGORY_LABEL,
  conflicts,
  crunchAction,
  crunchForecast,
  daySpans,
  isMajor,
  longRuns,
  openBlocks,
  readSettings,
  suggestionAppointment,
  summarizeDay,
  summarizeWeek,
  workloadPressure,
  type Input,
} from './life-balance';
import { datedItems } from './select';
import type { Appointment, CourseModule, Item } from './types';

/**
 * Phase E: schedule aggregation, conflict detection, long stretches, open
 * blocks, where every figure came from, and the Crunch Week Forecast.
 *
 * The week is pinned: Sunday 27 Sep 2026 to Saturday 3 Oct, with "now" on
 * Monday 28 Sep at 8am.
 */

const NOW = new Date(2026, 8, 28, 8, 0);
const MON = new Date(2026, 8, 28);
const TUE = new Date(2026, 8, 29);

const item = (id: string, c: string, month: number, day: number, kind: string, weight = '', confirmed = false): Item =>
  ({
    id,
    c,
    title: id,
    kind,
    month,
    day,
    year: 2026,
    dueTime: '11:59p',
    weight,
    where: '',
    detail: '',
    quote: '',
    source: '',
    ...(confirmed ? { checked: { confirmed: true, page: 2 } } : {}),
  }) as Item;

const mod = (id: string, days: number[], at: number, meets: string, items: Item[] = []): CourseModule =>
  ({
    course: { id, code: id.toUpperCase(), name: id, prof: 'Prof', email: '', term: '2026FA', meets },
    items,
    schedule: [{ days, time: '', at, title: 'Lecture', meta: '' }],
    guide: {},
    planMinutes: '',
    frameLabel: '',
  }) as unknown as CourseModule;

const commitment = (over: Partial<Commitment>): Commitment => ({
  id: 'c',
  name: 'Thing',
  kind: 'other',
  role: '',
  where: '',
  url: '',
  note: '',
  days: [],
  at: null,
  minutes: 0,
  hours: 0,
  active: true,
  created: 0,
  ...over,
});

const CRUNCH_ITEMS = [
  item('midterm', 'econ', 9, 13, 'Exam', '', true),
  item('essay', 'chem', 9, 14, 'Paper', '', true),
  item('quiz', 'econ', 9, 15, 'Quiz', '2%', true),
  item('pset', 'chem', 9, 16, 'Problem set', '15%'),
  item('project', 'econ', 9, 18, 'Project', '', true),
  // Five days out: a major deadline, but too close for the forecast.
  item('soon', 'econ', 9, 3, 'Exam', '', true),
];

function input(over: Partial<Input> = {}, items: Item[] = CRUNCH_ITEMS): Input {
  const catalog = buildCatalog([
    mod('econ', [1, 3, 5], 9 * 60, 'MWF 9:00–10:30a', items.filter((i) => i.c === 'econ')),
    mod('chem', [2, 4], 13 * 60, 'TR 1:00–2:30p', items.filter((i) => i.c === 'chem')),
  ]);
  const appointments: Appointment[] = [
    { id: 'a1', title: 'Problem set group', kind: 'study', date: '2026-09-29', at: 19 * 60, minutes: 60, time: '7:00p', where: '', note: '', created: 0 },
  ];
  const athletics: AthleticEvent[] = [
    { id: 't1', title: 'Away meet', team: 'Club', kind: 'Travel', start: '2026-10-02T15:00', end: '2026-10-03T12:00', where: '', notes: '', steps: [] },
  ];
  return {
    catalog,
    commitments: [
      commitment({ id: 'job', name: 'Library desk', kind: 'job', days: [1, 3], at: 10 * 60 + 30, minutes: 240 }),
      commitment({ id: 'practice', name: 'Practice', kind: 'clubsport', days: [2], at: 13 * 60 + 30, minutes: 90 }),
      commitment({ id: 'lab', name: 'Lab reading', kind: 'research', hours: 7 }),
    ],
    appointments,
    rest: [{ id: 'dinner', label: 'Dinner', days: [0, 1, 2, 3, 4, 5, 6], from: 18 * 60, to: 19 * 60 }],
    windows: [],
    floor: { from: 23 * 60, to: 7 * 60, on: false },
    athletics,
    settings: { commute: { days: [1, 3, 5], minutesEachWay: 30 } },
    items: datedItems(catalog, NOW).filter((i) => !i.isPast),
    spent: [],
    ...over,
  };
}

describe('schedule aggregation', () => {
  it('counts a day by category, each minute once', () => {
    const day = summarizeDay(input(), MON);
    expect(day.hours).toMatchObject({
      class: 1.5,
      // The desk, 4 h, plus a seventh of the lab's 7 h a week.
      work: 5,
      commute: 1,
      personal: 1,
      study: 0,
      athletics: 0,
    });
    // Awake 7a–11p is 16 h; 6.5 h is on the clock (9a–2:30p and dinner) and
    // 2 h has no set time (the lab's share and the commute).
    expect(day.hours.open).toBe(7.5);
    expect(day.committed).toBe(8.5);
  });

  it('gives an overlapped minute to the class, not to both', () => {
    const day = summarizeDay(input(), TUE);
    // Chem 1–2:30p, practice 1:30–3p: practice keeps only its last half hour.
    expect(day.hours.class).toBe(1.5);
    expect(day.hours.athletics).toBe(0.5);
    expect(day.hours.study).toBe(1);
  });

  it('clips a trip to the days it covers', () => {
    const week = summarizeWeek(input(), new Date(2026, 8, 27));
    const fri = week.days[5];
    const sat = week.days[6];
    expect(fri.hours.athletics).toBe(9);
    expect(sat.hours.athletics).toBe(12);
  });

  it('adds up the week and names what has no set time', () => {
    const week = summarizeWeek(input(), new Date(2026, 8, 27));
    expect(week.days.map((d) => d.iso)).toEqual([
      '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03',
    ]);
    expect(week.hours.class).toBe(7.5);
    expect(week.hours.commute).toBe(3);
    // 7 h of lab reading plus 3 h of commute.
    expect(week.stated).toBe(10);
  });

  it('uses the rest floor as the waking day when the student set one', () => {
    const late = summarizeDay(input({ floor: { from: 24 * 60, to: 9 * 60, on: true } }), MON);
    // 9a–midnight is 15 h: 1 h less open time than the default.
    expect(late.hours.open).toBe(6.5);
  });
});

describe('workload forecast', () => {
  const dueTuesday = [item('paper', 'econ', 8, 29, 'Paper', '', true)];

  it('compares the student\'s own estimate with open time without scoring the student', () => {
    const forecast = workloadPressure(
      input(
        {
          commitments: [commitment({ id: 'day', name: 'Fixed commitments', days: [2], at: 7 * 60, minutes: 16 * 60 })],
          spent: [{ id: 'old-paper', courseId: 'econ', kind: 'essay', minutes: 120, at: NOW.getTime() }],
        },
        dueTuesday,
      ),
      new Date(2026, 8, 27),
    );
    expect(forecast[2]).toMatchObject({
      iso: '2026-09-29',
      estimatedMinutes: 120,
      openMinutes: 0,
      balanceMinutes: -120,
      known: 1,
      unknown: 0,
      state: 'more_than_open',
      confirmed: true,
    });
  });

  it('keeps unseen work unknown instead of inventing an effort estimate', () => {
    const forecast = workloadPressure(input({}, dueTuesday), new Date(2026, 8, 27));
    expect(forecast[2]).toMatchObject({
      iso: '2026-09-29',
      estimatedMinutes: 0,
      known: 0,
      unknown: 1,
      state: 'unknown',
    });
  });
});

describe('conflict detection', () => {
  it('finds two commitments on the clock at once, with the minutes', () => {
    const found = conflicts(daySpans(input(), TUE));
    expect(found).toHaveLength(1);
    expect([found[0].a.title, found[0].b.title]).toEqual(['CHEM', 'Practice']);
    expect(found[0].minutes).toBe(60);
  });

  it('leaves the student’s own rest blocks out', () => {
    const overDinner = input({
      appointments: [{ id: 'x', title: 'Review session', kind: 'study', date: '2026-09-28', at: 18 * 60 + 30, minutes: 60, time: '', where: '', note: '', created: 0 }],
    });
    expect(conflicts(daySpans(overDinner, MON))).toEqual([]);
  });

  it('finds none on a clear day', () => {
    expect(conflicts(daySpans(input(), MON))).toEqual([]);
  });
});

describe('long stretches and open blocks', () => {
  it('joins class and a shift into one stretch, and ignores dinner', () => {
    expect(longRuns(daySpans(input(), MON))).toEqual([{ from: 9 * 60, to: 14 * 60 + 30, titles: ['ECON', 'Library desk'] }]);
  });

  it('breaks a stretch at a real gap', () => {
    const spaced = input({ commitments: [commitment({ id: 'job', name: 'Desk', kind: 'job', days: [1], at: 11 * 60, minutes: 240 })] });
    // 10:30 to 11:00 is thirty minutes: a break, not a walk.
    expect(longRuns(daySpans(spaced, MON))).toEqual([{ from: 11 * 60, to: 15 * 60, titles: ['Desk'] }]);
  });

  it('finds open hours in the default day, labelled Estimated', () => {
    const blocks = openBlocks(daySpans(input(), TUE), [], input().floor, 2);
    expect(blocks.map((b) => [b.from / 60, b.to / 60])).toEqual([[7, 13], [15, 18], [20, 23]]);
    expect(new Set(blocks.map((b) => b.source))).toEqual(new Set(['estimated']));
  });

  it('keeps to the student’s work windows, labelled Student entered', () => {
    const windows = [{ id: 'w', label: 'Evenings', days: [2], from: 19 * 60, to: 23 * 60 }];
    const blocks = openBlocks(daySpans(input(), TUE), windows, input().floor, 2);
    expect(blocks).toEqual([{ from: 20 * 60, to: 23 * 60, source: 'student_entered' }]);
  });

  it('keeps a work window off the protected sleep floor', () => {
    const windows = [{ id: 'w', label: 'Late', days: [2], from: 19 * 60, to: 24 * 60 }];
    const floor = { from: 23 * 60, to: 7 * 60, on: true };
    expect(openBlocks([], windows, floor, 2)).toEqual([{ from: 19 * 60, to: 23 * 60, source: 'student_entered' }]);
    // With the floor off, the window is the student's to the minute (the control).
    expect(openBlocks([], windows, { ...floor, on: false }, 2)).toEqual([{ from: 19 * 60, to: 24 * 60, source: 'student_entered' }]);
  });
});

describe('where each figure came from', () => {
  it('labels the timetable Imported and everything typed Student entered', () => {
    const spans = daySpans(input(), TUE);
    expect(spans.find((s) => s.category === 'class')?.source).toBe('imported');
    expect(spans.filter((s) => s.category !== 'class').every((s) => s.source === 'student_entered')).toBe(true);
  });

  it('labels a confirmed deadline Imported and an unchecked one Needs review', () => {
    const week = summarizeWeek(input(), new Date(2026, 9, 11));
    const due = week.days.flatMap((d) => d.deadlines);
    expect(due.find((d) => d.id === 'midterm')?.source).toBe('imported');
    expect(due.find((d) => d.id === 'pset')?.source).toBe('needs_review');
  });

  it('never claims Institution verified', () => {
    const week = summarizeWeek(input(), new Date(2026, 9, 11));
    const labels = [
      ...week.days.flatMap((d) => d.spans.map((s) => s.source)),
      ...week.days.flatMap((d) => d.deadlines.map((x) => x.source)),
      ...week.days.flatMap((d) => d.open.map((x) => x.source)),
    ];
    expect(labels).not.toContain('institution_verified');
  });
});

describe('the Crunch Week Forecast', () => {
  it('finds four major deadlines in six days, two to three weeks out', () => {
    const [crunch, ...more] = crunchForecast(input(), NOW);
    expect(more).toEqual([]);
    expect(crunch.deadlines.map((d) => d.id)).toEqual(['midterm', 'essay', 'pset', 'project']);
    expect(crunch.line).toBe('The week of Oct 11 has four major deadlines in six days.');
    expect(crunch.ask).toBe('Want to start two earlier?');
    // One of them has not been checked against its syllabus.
    expect(crunch.source).toBe('needs_review');
  });

  it('suggests earlier starts in open blocks of the week before, on different days', () => {
    const [crunch] = crunchForecast(input(), NOW);
    expect(crunch.suggestions).toHaveLength(2);
    const slots = crunch.suggestions.map((s) => s.slot!);
    for (const s of slots) {
      expect(s.iso >= '2026-10-06' && s.iso < '2026-10-13').toBe(true);
      expect(s.minutes).toBe(90);
    }
    // One a day, so the work is spread rather than moved; none before nine.
    expect(slots[0].iso).not.toBe(slots[1].iso);
    expect(slots.every((s) => s.from >= 9 * 60)).toBe(true);
    // Each slot is open on its day.
    for (const s of slots) {
      const day = summarizeDay(input(), new Date(`${s.iso}T00:00:00`));
      expect(day.open.some((o) => o.from <= s.from && s.from + s.minutes <= o.to)).toBe(true);
    }
  });

  it('asks for one earlier start when there are three', () => {
    const three = CRUNCH_ITEMS.filter((i) => i.id !== 'project');
    const [crunch] = crunchForecast(input({}, three), NOW);
    expect(crunch.line).toBe('The week of Oct 11 has three major deadlines in four days.');
    expect(crunch.ask).toBe('Want to start one earlier?');
    expect(crunch.suggestions).toHaveLength(1);
  });

  it('says nothing when the deadlines are spread out, minor, or too close', () => {
    const spread = [
      item('a', 'econ', 9, 12, 'Exam'),
      item('b', 'econ', 9, 18, 'Exam'),
      item('c', 'econ', 9, 24, 'Exam'),
    ];
    expect(crunchForecast(input({}, spread), NOW)).toEqual([]);
    const minor = [1, 2, 3, 4].map((n) => item(`q${n}`, 'econ', 9, 12 + n, 'Quiz', '2%'));
    expect(crunchForecast(input({}, minor), NOW)).toEqual([]);
    const close = [1, 2, 3, 4].map((n) => item(`x${n}`, 'econ', 8, 29 + n, 'Exam'));
    expect(crunchForecast(input({}, close), NOW)).toEqual([]);
  });

  it('places nothing: a suggestion becomes an event only through its caller', () => {
    const before = input();
    const [crunch] = crunchForecast(before, NOW);
    expect(before.appointments).toHaveLength(1);
    const appointment = suggestionAppointment(crunch.suggestions[0])!;
    expect(appointment).toMatchObject({ kind: 'study', date: crunch.suggestions[0].slot!.iso, minutes: 90 });
    expect(appointment.note).toContain('Suggested by the crunch week forecast');
  });

  it('explains itself as an action, with every field filled', () => {
    const [crunch] = crunchForecast(input(), NOW);
    const action = crunchAction(crunch, NOW);
    expect(action.type).toBe('crunch');
    expect(action.explanation.trigger).toMatch(/15 days away/);
    expect(action.explanation.factors).toHaveLength(4);
    expect(action.explanation.factors.join(' ')).toContain('(date needs review)');
    expect(action.explanation.limitations.length).toBeGreaterThan(0);
    expect(action.explanation.alternatives.length).toBeGreaterThan(0);
    expect(action.primary.requiresConfirmation).toBe(false);
    expect(action.expiresAt).toBe(new Date(2026, 9, 13).getTime());
  });

  it('uses calm words: hours and counts, never a verdict about the student', () => {
    const [crunch] = crunchForecast(input(), NOW);
    const action = crunchAction(crunch, NOW);
    const words = JSON.stringify([crunch, action, CATEGORY_LABEL]);
    expect(words).not.toMatch(/at risk|failing|behind|burn ?out|overload|stress|wellbeing|well-being|unhealthy/i);
  });
});

describe('major deadlines', () => {
  it('are exams, projects and papers, or ten per cent and up', () => {
    expect(isMajor({ kind: 'Exam', title: 'Midterm' })).toBe(true);
    expect(isMajor({ kind: 'Paper', title: 'Essay 2' })).toBe(true);
    expect(isMajor({ kind: 'Problem set', title: 'PS 4', weight: '10%' })).toBe(true);
    expect(isMajor({ kind: 'Problem set', title: 'PS 4', weight: '5%' })).toBe(false);
    expect(isMajor({ kind: 'Reading', title: 'Ch. 3' })).toBe(false);
  });
});

describe('the commute setting', () => {
  it('reads what it wrote, and refuses anything else', () => {
    expect(readSettings({ commute: null })).toEqual({ commute: null });
    expect(readSettings({ commute: { days: [5, 1], minutesEachWay: 25 } })).toEqual({ commute: { days: [1, 5], minutesEachWay: 25 } });
    expect(() => readSettings({ commute: { days: [7], minutesEachWay: 25 } })).toThrow();
    expect(() => readSettings({ commute: { days: [1, 1], minutesEachWay: 25 } })).toThrow();
    expect(() => readSettings({ commute: { days: [1], minutesEachWay: 500 } })).toThrow();
    expect(() => readSettings('nope')).toThrow();
  });
});
