import { EVENT_TYPE_PATTERN, transition } from '@semester/institution';
import { describe, expect, it } from 'vitest';
import { tick } from '../../lib/chores';
import type { PersonalTask } from '../../lib/types';
import { MemorySink, fail, fixedClock, ok } from '../../kernel';
import { createAuthorizer } from '../policy';
import { TASK_LIFECYCLE, TITLE_LIMIT, addTask, completeTask, complete, draftTask, isDay, isOverdue, listTasks, openTasks, removeTask, reopen, reopenTask, reschedule, rescheduleTask, stateOf, toggleTask, type Guard, type NewTask, type Task, type TaskDeps } from './index';
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
  const commands: string[] = [];
  let minted = 0;
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
    tasks: legacyTaskRepository(state, {
      add: (t) => {
        commands.push('add');
        tasks = [...tasks, { ...t, id: `new${++minted}`, created: 0, done: false }];
      },
      move: (id, date, time) => {
        commands.push(`move:${id}:${date}${time === undefined ? '' : `@${time}`}`);
        tasks = tasks.map((t) => (t.id === id ? { ...t, date, ...(time === undefined ? {} : { time }) } : t));
      },
      remove: (id) => {
        commands.push(`remove:${id}`);
        tasks = tasks.filter((t) => t.id !== id);
      },
    }),
    guard: guard ?? ((action, resource) => authorizer.enforce({ id: null }, { action, resource, correlationId: 'req-0001-abcdef' })),
    clock: fixedClock('2026-10-08'),
    events,
  };
  return { deps, events, writes, commands, now: () => tasks };
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

// ── writes: add, toggle, move, delete ──────────────────────────────────────

const draft = (over: Partial<NewTask> = {}): NewTask => ({ title: 'Read chapter 5', dueOn: '2026-10-09', courseId: null, time: '', note: '', origin: null, ...over });

describe('tasks: the rules for a new task and a move', () => {
  it('trims the title, refuses an empty one and one past the limit, and says which', () => {
    expect(draftTask(draft({ title: '  Read  ' }))).toMatchObject({ ok: true, value: { title: 'Read' } });
    expect(draftTask(draft({ title: '   ' })).ok || (draftTask(draft({ title: '   ' })) as { error: { code: string } }).error.code).toBe('tasks.title_required');
    const long = draftTask(draft({ title: 'x'.repeat(TITLE_LIMIT + 1) }));
    expect(long.ok || long.error).toMatchObject({ kind: 'validation', code: 'tasks.title_too_long' });
    expect(draftTask(draft({ title: 'x'.repeat(TITLE_LIMIT) })).ok).toBe(true);
  });

  it('knows a real day from a plausible one', () => {
    for (const real of ['2026-10-08', '2024-02-29']) expect(isDay(real), real).toBe(true);
    for (const fake of ['2026-02-30', '2025-02-29', '2026-13-01', '2026-10-8', 'tomorrow', '']) expect(isDay(fake), fake).toBe(false);
    expect(draftTask(draft({ dueOn: '2026-02-30' })).ok || 'refused').toBe('refused');
    expect(draftTask(draft({ dueOn: null })).ok).toBe(true);
  });

  it('moves to a real day or to someday, carries a time when given, and refuses a day that does not exist', () => {
    expect(reschedule(task(), '2026-10-09')).toEqual({ ok: true, value: { kind: 'reschedule', dueOn: '2026-10-09' } });
    expect(reschedule(task(), '2026-10-09', '4:00 PM')).toEqual({ ok: true, value: { kind: 'reschedule', dueOn: '2026-10-09', time: '4:00 PM' } });
    expect(reschedule(task(), null)).toEqual({ ok: true, value: { kind: 'reschedule', dueOn: null } });
    const bad = reschedule(task(), '2026-02-30');
    expect(bad.ok || bad.error).toMatchObject({ kind: 'validation', code: 'tasks.bad_date' });
  });
});

describe('tasks: writes, over the legacy store', () => {
  it('adds a task through addTask, hands back what the store minted, and says so', async () => {
    const w = world([]);
    const r = await addTask(w.deps)(draft({ title: ' Read chapter 5 ', courseId: 'econ', time: '6:30 PM', note: 'ch. 5', origin: 'mail' }));
    expect(r.ok && r.value).toMatchObject({ id: 'new1', title: 'Read chapter 5', dueOn: '2026-10-09', done: false });
    expect(w.commands).toEqual(['add']);
    expect(w.now()[0]).toMatchObject({ title: 'Read chapter 5', date: '2026-10-09', time: '6:30 PM', note: 'ch. 5', courseId: 'econ', from: 'mail' });
    expect(w.events.events.map((e) => [e.type, e.payload])).toEqual([['tasks.created', { taskId: 'new1' }]]);
  });

  it('adds nothing for a title or a day it refuses, and for a guard that says no', async () => {
    const w = world([]);
    expect((await addTask(w.deps)(draft({ title: '' }))).ok).toBe(false);
    expect((await addTask(w.deps)(draft({ dueOn: '2026-02-30' }))).ok).toBe(false);
    const g = world([], () => fail('forbidden', 'policy.not_owner', 'no'));
    expect((await addTask(g.deps)(draft())).ok).toBe(false);
    expect([w.commands, g.commands, w.events.events]).toEqual([[], [], []]);
  });

  it('says the store did not record an add that it did not record, rather than inventing a task', async () => {
    const w = world([]);
    const deps = { ...w.deps, tasks: { ...w.deps.tasks, create: () => legacyTaskRepository({ read: () => [], update: () => {} }, { add: () => {}, move: () => {}, remove: () => {} }).create(draft()) } };
    await expect(addTask(deps)(draft())).rejects.toThrow('did not record');
  });

  it('moves a task with moveTask, so the move keeps its undo, and touches no other field', async () => {
    const w = world([legacy({ steps: [{ id: 's', text: 'a', done: false }] }), legacy({ id: 't2' })]);
    const r = await rescheduleTask(w.deps)('t1', '2026-10-12', '4:00 PM');
    expect(r).toEqual(ok({ taskId: 't1' }));
    expect(w.commands).toEqual(['move:t1:2026-10-12@4:00 PM']);
    expect(w.now()[0]).toEqual({ ...legacy({ steps: [{ id: 's', text: 'a', done: false }] }), date: '2026-10-12', time: '4:00 PM' });
    expect(w.now()[1]).toEqual(legacy({ id: 't2' }));
  });

  it('moves a day alone without touching the time, and a repeating task keeps its rule', async () => {
    const weekly = legacy({ time: '6:30 PM', repeat: { every: 'weekly', until: '2026-12-31' } });
    const w = world([weekly]);
    await rescheduleTask(w.deps)('t1', '2026-10-09');
    expect(w.commands).toEqual(['move:t1:2026-10-09']);
    expect(w.now()[0]).toEqual({ ...weekly, date: '2026-10-09' });
  });

  it('sends a task back to someday as an edit, since moveTask has no day to move to', async () => {
    const w = world([legacy()]);
    await rescheduleTask(w.deps)('t1', null);
    expect(w.commands).toEqual([]);
    expect(w.now()[0]).toEqual({ ...legacy(), date: null });
  });

  it('refuses a day that does not exist, a task that is gone and a guard that says no, writing nothing', async () => {
    const w = world([legacy()]);
    expect((await rescheduleTask(w.deps)('t1', '2026-02-30')).ok).toBe(false);
    const gone = await rescheduleTask(w.deps)('nope', '2026-10-09');
    expect(gone.ok || gone.error.kind).toBe('not_found');
    const g = world([legacy()], () => fail('forbidden', 'policy.not_owner', 'no'));
    expect((await rescheduleTask(g.deps)('t1', '2026-10-09')).ok).toBe(false);
    expect([w.commands, g.commands, w.writes, g.writes, w.now()[0]]).toEqual([[], [], [], [], legacy()]);
  });

  it('deletes with deleteTask, only the one task, and says so', async () => {
    const w = world([legacy(), legacy({ id: 't2' })]);
    expect(await removeTask(w.deps)('t1')).toEqual(ok({ taskId: 't1' }));
    expect(w.commands).toEqual(['remove:t1']);
    expect(w.now().map((t) => t.id)).toEqual(['t2']);
    expect(w.events.events.map((e) => e.type)).toEqual(['tasks.removed']);
    const again = await removeTask(w.deps)('t1');
    expect(again.ok || again.error.code).toBe('tasks.not_found');
  });

  it('deletes and toggles nothing for a guard that says no, and announces nothing', async () => {
    const w = world([legacy(), legacy({ id: 't2', done: true })], () => fail('forbidden', 'policy.not_owner', 'no'));
    const gone = await removeTask(w.deps)('t1');
    const ticked = await toggleTask(w.deps)('t1');
    expect(gone.ok || gone.error.code).toBe('policy.not_owner');
    expect(ticked.ok || ticked.error.code).toBe('policy.not_owner');
    expect([w.commands, w.writes, w.events.events]).toEqual([[], [], []]);
    expect(w.now().map((t) => [t.id, t.done])).toEqual([['t1', false], ['t2', true]]);
  });

  it('asks to read before it toggles: a person who may tick but not read gets a refusal, and nothing is written', async () => {
    const w = world([legacy()], (action) => (action === 'tasks.read' ? fail('forbidden', 'policy.not_owner', 'no') : ok(null)));
    const ticked = await toggleTask(w.deps)('t1');
    expect(ticked.ok || ticked.error.code).toBe('policy.not_owner');
    expect(w.writes).toEqual([]);
  });

  it('toggles by what is stored: open becomes done, done becomes open, and a repeating task rolls', async () => {
    const w = world([legacy(), legacy({ id: 't2', done: true }), legacy({ id: 't3', repeat: { every: 'weekly', until: '2026-12-31' } })]);
    for (const id of ['t1', 't2', 't3']) expect((await toggleTask(w.deps)(id)).ok).toBe(true);
    expect(w.now().map((t) => [t.done, t.date])).toEqual([[true, '2026-10-08'], [false, '2026-10-08'], [false, '2026-10-15']]);
    const gone = await toggleTask(w.deps)('nope');
    expect(gone.ok || gone.error.kind).toBe('not_found');
  });

  it('names every new event the way the outbox envelope does', async () => {
    const w = world([legacy()]);
    await addTask(w.deps)(draft());
    await rescheduleTask(w.deps)('t1', '2026-10-09');
    await removeTask(w.deps)('t1');
    expect(w.events.events.length).toBe(3);
    for (const e of w.events.events) expect(e.type).toMatch(EVENT_TYPE_PATTERN);
  });
});

describe('tasks: every write waits for the store to commit', () => {
  // The next press reads the store. A write that returned before the commit would let it read the old list
  // and repeat the first: two quick ticks would land on the wrong side.
  it('waits after a tick, an un-tick, a move, a move to someday, an add and a delete', async () => {
    let tasks = [legacy(), legacy({ id: 't2', done: true }), legacy({ id: 't3' }), legacy({ id: 't4' }), legacy({ id: 't5' })];
    let waits = 0;
    const repo = legacyTaskRepository(
      { read: () => tasks, update: (f) => void (tasks = f(tasks)) },
      {
        add: (t) => void (tasks = [...tasks, { ...t, id: 'new', created: 0, done: false }]),
        move: (id, date) => void (tasks = tasks.map((t) => (t.id === id ? { ...t, date } : t))),
        remove: (id) => void (tasks = tasks.filter((t) => t.id !== id)),
      },
      async () => void (waits += 1),
    );
    const authorizer = createAuthorizer({ clock: fixedClock('2026-10-08') });
    const deps: TaskDeps = {
      tasks: repo,
      guard: (action, resource) => authorizer.enforce({ id: null }, { action, resource, correlationId: 'req-0001-abcdef' }),
      clock: fixedClock('2026-10-08'),
      events: new MemorySink(),
    };
    const steps: [string, () => Promise<unknown>][] = [
      ['tick', () => completeTask(deps)('t1')],
      ['un-tick', () => reopenTask(deps)('t2')],
      ['move', () => rescheduleTask(deps)('t3', '2026-10-12')],
      ['someday', () => rescheduleTask(deps)('t4', null)],
      ['add', () => addTask(deps)(draft())],
      ['delete', () => removeTask(deps)('t5')],
    ];
    for (const [name, run] of steps) {
      const before = waits;
      await run();
      expect(waits, name).toBe(before + 1);
    }
  });
});
