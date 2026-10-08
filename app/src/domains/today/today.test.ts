import { describe, expect, it } from 'vitest';
import { rank, type Choice } from '../../lib/actions';
import { isoToDate } from '../../lib/date';
import { todayActions, type TodayActionInput } from '../../lib/today-actions';
import type { PathSnapshot } from '../../lib/today-decision';
import type { DatedItem } from '../../lib/types';
import { fail, fixedClock, ok } from '../../kernel';
import type { Agenda } from '../calendar';
import type { TaskList } from '../tasks';
import { getToday, isQuiet, type Guard, type Ranking, type TodayDeps } from './index';
import { legacyRanking } from './adapters';
import { officeActionToAction, type OfficeAction } from '../../lib/office-actions';
import type { CatalogCourse } from '../../lib/registration';
import { registrationActions } from '../../lib/registration-actions';
import { EMPTY_REGISTRATION_DAY, type RegistrationDayData } from '../../lib/registration-day';

const clock = fixedClock('2026-10-08');
const allow: Guard = () => ok(undefined);
const none: Ranking = { mostImportant: null, next: [] };
const task = (id: string, dueOn: string | null) => ({ id, title: id, dueOn, done: false, rollsTo: null });
const emptyTasks: TaskList = { open: [], overdue: [], dueToday: [] };
const emptyAgenda: Agenda = { on: '2026-10-08', entries: [], conflicts: [], unavailable: [] };

const deps = (over: Partial<TodayDeps> = {}): TodayDeps => ({
  guard: allow,
  clock,
  tasks: async () => ok(emptyTasks),
  agenda: async () => ok(emptyAgenda),
  ranking: async () => none,
  ...over,
});

describe('today: the read model', () => {
  it('is quiet when there is nothing on, nothing due, nothing late and nothing to suggest', async () => {
    const r = await getToday(deps())();
    expect(r.ok && r.value).toMatchObject({ on: '2026-10-08', quiet: true, mostImportant: null, next: [] });
  });

  it('is not quiet for any one thing — each, alone, turns it off (the control the other way)', async () => {
    const entry = { id: 'e', title: 'T', kind: 'class' as const, on: '2026-10-08', startMin: 600, durationMin: 60, provenance: 'student_entered' as const, done: false };
    const action = { id: 'a', title: 'A', why: 'w', priority: 'normal' as const, dueAt: null };
    const cases: Partial<TodayDeps>[] = [
      { agenda: async () => ok({ ...emptyAgenda, entries: [entry] }) },
      { tasks: async () => ok({ ...emptyTasks, overdue: [task('late', '2026-10-01')] }) },
      { tasks: async () => ok({ ...emptyTasks, dueToday: [task('now', '2026-10-08')] }) },
      { ranking: async () => ({ mostImportant: action, next: [] }) },
    ];
    for (const c of cases) {
      const r = await getToday(deps(c))();
      expect(r.ok && r.value.quiet).toBe(false);
    }
    expect(isQuiet({ schedule: [], overdue: [], dueToday: [], ranking: none })).toBe(true);
  });

  it('leaves a finished entry off what is left of the day, and is quiet when only finished things remain', async () => {
    const done = { id: 'd', title: 'D', kind: 'deadline' as const, on: '2026-10-08', startMin: null, durationMin: 0, provenance: 'imported' as const, done: true };
    const r = await getToday(deps({ agenda: async () => ok({ ...emptyAgenda, entries: [done] }) }))();
    expect(r.ok && r.value.schedule).toEqual([]);
    expect(r.ok && r.value.quiet).toBe(true);
  });

  it('carries the pieces through unchanged', async () => {
    const r = await getToday(deps({
      tasks: async () => ok({ open: [task('a', '2026-10-01')], overdue: [task('a', '2026-10-01')], dueToday: [] }),
      agenda: async () => ok({ ...emptyAgenda, unavailable: ['Campus feed'] }),
    }))();
    expect(r.ok && r.value.overdue.map((t) => t.id)).toEqual(['a']);
    expect(r.ok && r.value.unavailable).toEqual(['Campus feed']);
  });

  it('asks the calendar about the clock’s day, not its own idea of today', async () => {
    const asked: string[] = [];
    await getToday(deps({ agenda: async (on) => { asked.push(on); return ok({ ...emptyAgenda, on }); } }))();
    expect(asked).toEqual(['2026-10-08']);
  });

  // The two failures are not the same failure. The device's own list is not
  // optional; a calendar that cannot be read is a different slice's refusal.
  it('fails when the tasks cannot be read, and passes the calendar’s refusal on as it was made', async () => {
    const t = await getToday(deps({ tasks: async () => fail('unavailable', 'tasks.store_unreadable', 'Your tasks could not be read.') }))();
    expect(t.ok || t.error).toMatchObject({ kind: 'unavailable', retryable: true, code: 'tasks.store_unreadable' });
    const a = await getToday(deps({ agenda: async () => fail('validation', 'calendar.bad_day', 'bad') }))();
    expect(a.ok || a.error.code).toBe('calendar.bad_day');
  });

  it('reads nothing for a request the guard refuses', async () => {
    let reads = 0;
    const counting = async () => { reads++; return ok(emptyTasks); };
    const r = await getToday(deps({ guard: () => fail('forbidden', 'policy.not_owner', 'no'), tasks: counting }))();
    expect(r.ok || r.error.code).toBe('policy.not_owner');
    expect(reads).toBe(0);
  });
});

// ── parity: Today’s ranking is the Action Center’s, not a second one ───────────

const path = (over: Partial<PathSnapshot> = {}): PathSnapshot => ({
  state: 'review', heading: 'h', detail: 'd', creditLine: 'c', covered: 3, total: 10, percent: 30, unresolved: 2, firstUnresolved: 'ECON 1010', source: 'Your degree record', ...over,
});
const dated = (id: string, daysAway: number, confirmed: boolean) => ({
  id, title: `Essay ${id}`, date: isoToDate('2026-10-08'), dueShort: 'soon', dueAt: 17 * 60, daysAway, checked: confirmed ? { confirmed: true } : undefined,
}) as unknown as DatedItem;

describe('today: the legacy ranking', () => {
  const input: TodayActionInput = {
    path: path(),
    upcoming: [dated('e1', 2, true), dated('e2', 9, false), dated('e3', 1, false)],
    done: {},
    reviewDue: 8,
    catalogEmpty: false,
  };
  const now = clock.now();

  it('gives the same most-important and the same next three, in the same order, as lib/actions.rank', async () => {
    const direct = rank(todayActions(input), {}, now);
    const ours = await legacyRanking(() => ({ input, choices: {} }))(now);
    expect(ours.mostImportant?.id).toBe(direct.mostImportant?.action.id);
    expect(ours.next.map((n) => n.id)).toEqual(direct.next.map((n) => n.action.id));
    // A control that the comparison has something to compare: there are candidates, and an order.
    expect(direct.mostImportant).not.toBeNull();
    expect(direct.next.length).toBeGreaterThan(1);
  });

  it('honours what the student chose: a snoozed action leaves the list in both', async () => {
    const top = rank(todayActions(input), {}, now).mostImportant!.action.id;
    const snoozed: Record<string, Choice> = { [top]: { status: 'snoozed', snoozedUntil: now + 86_400_000, history: [] } };
    const direct = rank(todayActions(input), snoozed, now);
    const ours = await legacyRanking(() => ({ input, choices: snoozed }))(now);
    expect(ours.mostImportant?.id).toBe(direct.mostImportant?.action.id);
    expect(ours.mostImportant?.id).not.toBe(top);
  });

  it('translates an action into the six fields Today draws, and nothing it does not', async () => {
    const ours = await legacyRanking(() => ({ input, choices: {} }))(now);
    expect(Object.keys(ours.mostImportant!).sort()).toEqual(['dueAt', 'id', 'priority', 'title', 'why']);
  });
});

// ── the two candidate sources that were once missing ───────────────────────

const course = (id: string): CatalogCourse => ({
  id, code: 'PSY 220', section: '01', title: 'Methods', term: 'Spring 2027', department: 'PSY', credits: 3,
  instructor: '', location: '', description: '', prerequisites: '', seats: 10, meetings: [{ days: [1, 3], start: 540, end: 590 }],
});
const regDay = (patch: Partial<RegistrationDayData> = {}): RegistrationDayData => ({ ...EMPTY_REGISTRATION_DAY, opensAt: '2026-10-10T08:00', ...patch });
const office = (id: string, over: Partial<OfficeAction> = {}): OfficeAction => ({
  id, office: 'financial_aid', officeLabel: 'Financial Aid', type: 'deadline', audience: 'tenant', program: null, eligibility: null,
  title: `Verify ${id}`, why: 'Aid is held until it is done.', dueAt: clock.now() + 2 * 86_400_000, url: 'https://example.edu/aid', sourceNote: 'Checklist',
  updatedAt: Date.parse('2026-10-01T09:00:00Z'), publishedAt: null, doneAt: null, ...over,
});

describe('today: registration and office actions in the ranking', () => {
  const input: TodayActionInput = { path: path(), upcoming: [dated('e1', 2, true)], done: {}, reviewDue: 3, catalogEmpty: false };
  const now = clock.now();
  const cart = [course('psy')];
  const reg = { active: true, data: regDay(), cart, catalog: cart };
  const sources = [office('a1'), office('a2', { dueAt: null })];

  /** The Action Center's own recipe, written out, as the thing to match. */
  const legacy = (r: typeof reg | undefined, o: OfficeAction[] | null, choices: Record<string, Choice> = {}) =>
    rank(
      [
        ...todayActions(input),
        ...(r?.active ? registrationActions(r.data, r.cart, r.catalog, new Date(now)) : []),
        ...(o ?? []).filter((a) => a.doneAt === null).map((a) => officeActionToAction(a, now)),
      ],
      choices,
      now,
    );
  const ours = (r: typeof reg | undefined, o: OfficeAction[] | null, choices: Record<string, Choice> = {}) =>
    legacyRanking(() => ({ input, choices, registration: r, office: o }))(now);

  it('ranks the same ones in the same order as the Action Center, with both sources on', async () => {
    const direct = legacy(reg, sources);
    const got = await ours(reg, sources);
    expect(got.mostImportant?.id).toBe(direct.mostImportant?.action.id);
    expect(got.next.map((n) => n.id)).toEqual(direct.next.map((n) => n.action.id));
    // The control: the new candidates are really in play — without them the answer is different.
    const without = await ours(undefined, null);
    const all = [got.mostImportant, ...got.next].map((n) => n?.id);
    expect(all.some((id) => id?.startsWith('regday:') || id?.startsWith('office:'))).toBe(true);
    expect([without.mostImportant, ...without.next].map((n) => n?.id)).not.toEqual(all);
  });

  it('proposes no registration action when the mode is not surfaced, however the data looks', async () => {
    const got = await ours({ ...reg, active: false }, null);
    const direct = legacy({ ...reg, active: false }, null);
    expect([got.mostImportant, ...got.next].map((n) => n?.id)).toEqual([direct.mostImportant?.action.id, ...direct.next.map((n) => n.action.id)]);
    expect([got.mostImportant, ...got.next].some((n) => n?.id.startsWith('regday:'))).toBe(false);
  });

  it('leaves out an office action the student marked done, and none at all while the feed is not ready', async () => {
    // A lean day, so nothing else crowds the top four and presence is a fair question.
    const lean: TodayActionInput = { path: path({ state: 'moving', unresolved: 0, firstUnresolved: null }), upcoming: [], done: {}, reviewDue: 0, catalogEmpty: false };
    const run = (o: OfficeAction[] | null) => legacyRanking(() => ({ input: lean, choices: {}, office: o }))(now);
    const idsOf = (r: Awaited<ReturnType<typeof run>>) => [r.mostImportant, ...r.next].flatMap((n) => (n ? [n.id] : []));
    const got = idsOf(await run([office('a1', { doneAt: now - 1 }), office('a2')]));
    expect(got).toContain('office:a2');
    expect(got).not.toContain('office:a1');
    expect(idsOf(await run(null)).some((id) => id.startsWith('office:'))).toBe(false);
  });

  it('honours a snooze on a registration or office action, as it does on any other', async () => {
    const top = legacy(reg, sources).mostImportant!.action.id;
    const snoozed: Record<string, Choice> = { [top]: { status: 'snoozed', snoozedUntil: now + 86_400_000, history: [] } };
    const direct = legacy(reg, sources, snoozed);
    const got = await ours(reg, sources, snoozed);
    expect(got.mostImportant?.id).toBe(direct.mostImportant?.action.id);
    expect(got.mostImportant?.id).not.toBe(top);
  });
});

// ── the look-ahead ─────────────────────────────────────────────────────────

import { MAX_HORIZON_DAYS, addDays, daysFrom, getCommitments } from './index';

describe('today: counting days', () => {
  it('moves across month ends, year ends and leap days, in both directions', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-10-08', 0)).toBe('2026-10-08');
  });

  it('lists the day itself and the days after it, in order, with no day twice', () => {
    expect(daysFrom('2026-10-29', 5)).toEqual(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(new Set(daysFrom('2026-01-01', MAX_HORIZON_DAYS)).size).toBe(MAX_HORIZON_DAYS);
  });

  it('counts the same days whatever the clock zone does on the way: it never goes through a local time', () => {
    // 2026-11-01 is the day clocks go back in the US; a local-time walk is the classic way to see it twice.
    expect(daysFrom('2026-10-30', 4)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(daysFrom('2026-03-07', 4)).toEqual(['2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10']);
  });

  it('refuses a string that is not a day rather than counting from nothing', () => {
    expect(() => addDays('tomorrow', 1)).toThrow();
  });
});

describe('today: the look-ahead use case', () => {
  const entry = (id: string, on: string, over: Partial<import('../calendar').Entry> = {}) => ({ id, title: id, kind: 'deadline' as const, on, startMin: null, durationMin: 0, provenance: 'imported' as const, done: false, ...over });
  const agendaOf = (by: Record<string, import('../calendar').Entry[]>, unavailable: Record<string, string[]> = {}) =>
    async (on: string) => ok({ on, entries: by[on] ?? [], conflicts: [], unavailable: unavailable[on] ?? [] });

  it('reads today and the days after it, each from the calendar, and keeps finished entries marked', async () => {
    const asked: string[] = [];
    const agenda = async (on: string) => { asked.push(on); return agendaOf({ '2026-10-08': [entry('a', '2026-10-08', { done: true })], '2026-10-10': [entry('b', '2026-10-10')] })(on); };
    const r = await getCommitments({ guard: allow, clock, agenda })(3);
    expect(asked.sort()).toEqual(['2026-10-08', '2026-10-09', '2026-10-10']);
    expect(r.ok && r.value.map((d) => [d.on, d.entries.map((e) => [e.id, e.done])])).toEqual([
      ['2026-10-08', [['a', true]]],
      ['2026-10-09', []],
      ['2026-10-10', [['b', false]]],
    ]);
  });

  it('says which calendars could not be read on which day, and still returns the day', async () => {
    const r = await getCommitments({ guard: allow, clock, agenda: agendaOf({}, { '2026-10-09': ['Your classes'] }) })(2);
    expect(r.ok && r.value.map((d) => d.unavailable)).toEqual([[], ['Your classes']]);
  });

  it('fails the whole look-ahead when one day cannot be read at all, rather than returning a list with a hole', async () => {
    const agenda = async (on: string) => (on === '2026-10-09' ? fail('forbidden', 'calendar.refused', 'no') : agendaOf({})(on));
    const r = await getCommitments({ guard: allow, clock, agenda })(3);
    expect(r.ok || r.error.code).toBe('calendar.refused');
  });

  it('asks the guard first, and reads nothing for a refusal', async () => {
    let read = 0;
    const refuse: Guard = () => fail('forbidden', 'policy.not_owner', 'no');
    const r = await getCommitments({ guard: refuse, clock, agenda: async (on) => { read += 1; return agendaOf({})(on); } })(3);
    expect(r.ok || r.error.code).toBe('policy.not_owner');
    expect(read).toBe(0);
  });

  it('refuses a horizon of nothing, a fraction, a negative, or more than a month', async () => {
    for (const bad of [0, -1, 1.5, MAX_HORIZON_DAYS + 1, Number.NaN]) {
      const r = await getCommitments({ guard: allow, clock, agenda: agendaOf({}) })(bad);
      expect(r.ok || r.error, String(bad)).toMatchObject({ kind: 'validation', code: 'today.bad_horizon' });
    }
    expect((await getCommitments({ guard: allow, clock, agenda: agendaOf({}) })(MAX_HORIZON_DAYS)).ok).toBe(true);
  });
});
