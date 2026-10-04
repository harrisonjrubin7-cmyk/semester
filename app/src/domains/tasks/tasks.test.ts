import { EVENT_TYPE_PATTERN, transition } from '@semester/institution';
import { describe, expect, it } from 'vitest';
import { tick } from '../../lib/chores';
import type { PersonalTask } from '../../lib/types';
import { MemorySink, fail, fixedClock, ok } from '../../kernel';
import { createAuthorizer } from '../policy';
import { TASK_LIFECYCLE, completeTask, complete, isOverdue, listTasks, openTasks, reopen, reopenTask, stateOf, type Guard, type Task, type TaskDeps } from './index';
import { legacyTaskRepository, toTask } from './adapters';

const task = (over: Partial<Task> = {}): Task => ({ id: 't1', title: 'Read chapter 4', dueOn: '2026-10-08', done: false, rollsTo: null, ...over });
const legacy = (over: Partial<PersonalTask> = {}): PersonalTask => ({
  id: 't1', title: 'Read chapter 4', date: '2026-10-08', time: '', note: 'bring the book', done: false, created: 0, courseId: null, ...over,
});

describe('tasks: the lifecycle (ADR 0009)', () => {
  it('allows exactly open→done and done→open, for every pair of states, and no state is a dead end', () => {
    const states = ['open', 'done'] as const;
    for (const from of states) for (const to of states) {
      expect(transition(TASK_LIFECYCLE, from, to).ok, `${from}→${to}`).toBe(from !== to);
    }
    expect(TASK_LIFECYCLE.terminal).toEqual([]);
    // The commands agree with the machine: complete is open→done, reopen is done→open.
    expect(complete(task({ done: false })).ok).toBe(true);
    expect(complete(task({ done: true })).ok).toBe(false);
    expect(reopen(task({ done: true })).ok).toBe(true);
    expect(reopen(task({ done: false })).ok).toBe(false);
    expect(stateOf(task({ done: true }))).toBe('done');
  });

  it('refuses to complete what is done and to reopen what is open, naming a conflict', () => {
    const a = complete(task({ done: true }));
    const b = reopen(task());
    expect(a.ok || a.error).toMatchObject({ kind: 'conflict', code: 'tasks.already_done', retryable: false });
    expect(b.ok || b.error).toMatchObject({ kind: 'conflict', code: 'tasks.not_done' });
  });

  it('carries a repeating task’s next day in the change, and nothing for one that does not repeat', () => {
    expect(complete(task({ rollsTo: '2026-10-15' }))).toEqual({ ok: true, value: { kind: 'complete', rolledTo: '2026-10-15' } });
    expect(complete(task())).toEqual({ ok: true, value: { kind: 'complete', rolledTo: null } });
  });
});

describe('tasks: ordering and lateness', () => {
  it('lists open tasks soonest first, undated last, and does not shuffle ties', () => {
    const all = [task({ id: 'c', title: 'C', dueOn: null }), task({ id: 'b', title: 'B', dueOn: '2026-10-09' }), task({ id: 'a2', title: 'B', dueOn: '2026-10-08' }), task({ id: 'a1', title: 'A', dueOn: '2026-10-08' }), task({ id: 'x', done: true })];
    expect(openTasks(all).map((t) => t.id)).toEqual(['a1', 'a2', 'b', 'c']);
  });

  it('calls a task late only the day after it was due', () => {
    expect(isOverdue(task({ dueOn: '2026-10-07' }), '2026-10-08')).toBe(true);
    expect(isOverdue(task({ dueOn: '2026-10-08' }), '2026-10-08')).toBe(false);
    expect(isOverdue(task({ dueOn: null }), '2026-10-08')).toBe(false);
    expect(isOverdue(task({ dueOn: '2026-10-07', done: true }), '2026-10-08')).toBe(false);
  });
});

// ── the use cases, over the legacy adapter ─────────────────────────────────

function world(start: PersonalTask[], guard?: Guard) {
  let tasks = start;
  const writes: string[] = [];
  const state = {
    read: () => tasks,
    update: (change: (t: PersonalTask[]) => PersonalTask[]) => {
      writes.push('write');
      tasks = change(tasks);
    },
  };
  const events = new MemorySink();
  const authorizer = createAuthorizer({ clock: fixedClock('2026-10-08') });
  const deps: TaskDeps = {
    tasks: legacyTaskRepository(state),
    guard: guard ?? ((action, resource) => authorizer.enforce({ id: null }, { action, resource, correlationId: 'req-0001-abcdef' })),
    clock: fixedClock('2026-10-08'),
    events,
  };
  return { deps, events, writes, now: () => tasks };
}

describe('tasks: ticking, over the legacy store', () => {
  it('completes a plain task, leaves every other field alone, and says so', async () => {
    const w = world([legacy(), legacy({ id: 't2', title: 'Other' })]);
    const r = await completeTask(w.deps)('t1');
    expect(r).toEqual(ok({ taskId: 't1', outcome: 'done', rolledTo: null }));
    expect(w.now()[0]).toEqual({ ...legacy(), done: true });
    expect(w.now()[1]).toEqual(legacy({ id: 't2', title: 'Other' }));
    expect(w.events.events.map((e) => [e.type, e.payload])).toEqual([['tasks.completed', { taskId: 't1', rolledTo: null }]]);
  });

  it('rolls a repeating task to its next day instead of finishing it', async () => {
    const weekly = legacy({ repeat: { every: 'weekly', until: '2026-12-31' } });
    const w = world([weekly]);
    const r = await completeTask(w.deps)('t1');
    expect(r).toEqual(ok({ taskId: 't1', outcome: 'rolled', rolledTo: '2026-10-15' }));
    expect(w.now()[0]).toMatchObject({ done: false, date: '2026-10-15' });
  });

  it('reopens, and refuses to reopen what is open', async () => {
    const w = world([legacy({ done: true })]);
    expect(await reopenTask(w.deps)('t1')).toEqual(ok({ taskId: 't1' }));
    expect(w.now()[0].done).toBe(false);
    const again = await reopenTask(w.deps)('t1');
    expect(again.ok || again.error.code).toBe('tasks.not_done');
  });

  it('says not found for a task that is gone, and writes nothing', async () => {
    const w = world([legacy()]);
    const r = await completeTask(w.deps)('nope');
    expect(r.ok || r.error).toMatchObject({ kind: 'not_found', code: 'tasks.not_found' });
    expect(w.writes).toEqual([]);
  });

  // The ordering the use case promises: a refused request writes nothing and announces nothing.
  it('writes nothing and announces nothing for a request the guard refuses', async () => {
    const w = world([legacy()], () => fail('forbidden', 'policy.not_owner', 'no'));
    const r = await completeTask(w.deps)('t1');
    expect(r.ok || r.error.code).toBe('policy.not_owner');
    expect(w.writes).toEqual([]);
    expect(w.events.events).toEqual([]);
  });

  it('names its events the way the outbox envelope does, so promotion needs no rename', async () => {
    const w = world([legacy({ done: true }), legacy({ id: 't2' })]);
    await reopenTask(w.deps)('t1');
    await completeTask(w.deps)('t2');
    expect(w.events.events.length).toBe(2);
    for (const e of w.events.events) expect(e.type).toMatch(EVENT_TYPE_PATTERN);
  });

  it('lists what is left, what is late and what is due today, by the injected clock', async () => {
    const w = world([legacy({ id: 'late', date: '2026-10-07' }), legacy({ id: 'now', date: '2026-10-08' }), legacy({ id: 'later', date: '2026-10-20' }), legacy({ id: 'done', done: true })]);
    const r = await listTasks(w.deps)();
    expect(r.ok && r.value.open.map((t) => t.id)).toEqual(['late', 'now', 'later']);
    expect(r.ok && r.value.overdue.map((t) => t.id)).toEqual(['late']);
    expect(r.ok && r.value.dueToday.map((t) => t.id)).toEqual(['now']);
  });
});

// ── parity: the domain and the legacy function agree, case by case ─────────

describe('tasks: parity with lib/chores.tick (the strangler’s proof)', () => {
  const cases: Record<string, PersonalTask> = {
    'plain': legacy(),
    'undated': legacy({ date: null }),
    'weekly with weeks left': legacy({ repeat: { every: 'weekly', until: '2026-12-31' } }),
    'weekly on its last day': legacy({ repeat: { every: 'weekly', until: '2026-10-08' } }),
    'daily with steps to clear': legacy({ repeat: { every: 'daily', until: '2026-12-31' }, steps: [{ id: 's', text: 'a', done: true }] }),
    'repeat but undated': legacy({ date: null, repeat: { every: 'weekly', until: '2026-12-31' } }),
  };

  for (const [name, t] of Object.entries(cases)) {
    it(`${name}: same record as the legacy tick, and the same day it rolls to`, async () => {
      const w = world([t]);
      await completeTask(w.deps)('t1');
      expect(w.now()[0]).toEqual({ ...t, ...tick(t, true) });
      const patch = tick(t, true);
      expect(toTask(t).rollsTo).toBe(patch.done === false ? (patch.date ?? null) : null);
    });
  }

  it('the control: a domain that disagreed would be caught — a task rolled the wrong day is not equal', () => {
    const t = cases['weekly with weeks left'];
    expect(toTask(t).rollsTo).toBe('2026-10-15');
    expect(toTask(t).rollsTo).not.toBe('2026-10-16');
  });
});
