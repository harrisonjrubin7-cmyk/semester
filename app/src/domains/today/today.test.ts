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
    const entry = { id: 'e', title: 'T', kind: 'class' as const, on: '2026-10-08', startMin: 600, durationMin: 60, provenance: 'student_entered' as const };
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
