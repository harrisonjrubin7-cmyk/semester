import { describe, expect, it } from 'vitest';
import { EMPTY_CATALOG } from '../data/catalog';
import { MemorySink, counterIds, fixedClock } from '../kernel';
import { UNDOABLE } from '../lib/undo';
import { reducer } from '../state/reducer';
import { DEFAULT_PERSISTED, initialEphemeral, type Action, type State } from '../state/shape';
import type { PersonalTask } from '../lib/types';
import { composeDomains } from './domains';
import { hostOver, type StoreSnapshot } from './react';

/**
 * The host, held to the real reducer. No React, no mocks: a state, the reducer
 * that every legacy write goes through, and a dispatch that applies it.
 */

const task = (over: Partial<PersonalTask> = {}): PersonalTask => ({
  id: 't1', title: 'Read chapter 4', date: '2026-10-08', time: '', note: 'bring the book', done: false, created: 0, courseId: null, ...over,
});
const base = (tasks: PersonalTask[]): State => ({ ...DEFAULT_PERSISTED, ...initialEphemeral(), tasks });

function live(tasks: PersonalTask[], over: Partial<StoreSnapshot> = {}) {
  let state = base(tasks);
  const dispatched: Action[] = [];
  const dispatch = (a: Action) => { dispatched.push(a); state = reducer(state, a); };
  const host = hostOver(
    () => ({ state, catalog: EMPTY_CATALOG, accountId: null, schoolId: 'default', now: new Date(2026, 9, 8, 12), grants: [], choices: {}, ...over }),
    dispatch,
  );
  const events = new MemorySink();
  const domains = composeDomains(host, { clock: fixedClock('2026-10-08'), ids: counterIds('req'), events });
  return { domains, events, dispatched, state: () => state };
}

describe('the store host: writes go through the reducer', () => {
  const cases: Record<string, PersonalTask> = {
    plain: task(),
    undated: task({ date: null }),
    'weekly with weeks left': task({ repeat: { every: 'weekly', until: '2026-12-31' } }),
    'weekly on its last day': task({ repeat: { every: 'weekly', until: '2026-10-08' } }),
    'daily with steps to clear': task({ repeat: { every: 'daily', until: '2026-12-31' }, steps: [{ id: 's', text: 'a', done: true }] }),
  };

  for (const [name, t] of Object.entries(cases)) {
    it(`${name}: completing leaves the state the legacy toggleTask would`, async () => {
      const w = live([t, task({ id: 't2', title: 'Other' })]);
      expect((await w.domains.tasks.complete('t1')).ok).toBe(true);
      const legacy = reducer(base([t, task({ id: 't2', title: 'Other' })]), { type: 'toggleTask', id: 't1' });
      expect(w.state().tasks).toEqual(legacy.tasks);
    });
  }

  it('reopens like toggleTask does, and touches nothing else', async () => {
    const done = task({ done: true });
    const w = live([done, task({ id: 't2' })]);
    await w.domains.tasks.reopen('t1');
    expect(w.state().tasks).toEqual(reducer(base([done, task({ id: 't2' })]), { type: 'toggleTask', id: 't1' }).tasks);
  });

  it('sends one editTask carrying only the fields that changed, for the one task that changed', async () => {
    const w = live([task(), task({ id: 't2' })]);
    await w.domains.tasks.complete('t1');
    expect(w.dispatched).toEqual([{ type: 'editTask', id: 't1', patch: { done: true } }]);
  });

  it('sends nothing for a request the guard refuses, and nothing for a task that is not there', async () => {
    const w = live([task({ done: true })]);
    await w.domains.tasks.complete('t1'); // already done: a conflict
    await w.domains.tasks.complete('nope');
    expect(w.dispatched).toEqual([]);
  });

  it('is read afresh each time: a tick made by anyone shows in the next Today', async () => {
    const w = live([task({ id: 'late', date: '2026-10-06' })]);
    const before = await w.domains.today.view();
    expect(before.ok && before.value.overdue.map((t) => t.id)).toEqual(['late']);
    await w.domains.tasks.complete('late');
    const after = await w.domains.today.view();
    expect(after.ok && after.value.overdue).toEqual([]);
  });

  it('reads identity from the store: signed out on a fresh device, with the stored role', async () => {
    const w = live([], {});
    expect(w.domains.subject()).toMatchObject({ id: null, signedIn: false, roleId: 'student', schoolId: 'default', capabilities: [] });
    const signed = live([], { accountId: 'u1', grants: [{ capability: 'registrar:read', scopeKind: 'school', scopeId: 'default' }] });
    expect(signed.domains.subject()).toMatchObject({ id: 'u1', signedIn: true, capabilities: ['registrar:read'] });
  });
});

/**
 * Add, move, delete and toggle, held to the reducer the screens used to
 * dispatch into themselves. Each case compares the whole resulting task list to
 * what the legacy action alone produces, so a domain that wrote a different
 * record, or a different action, would not be equal.
 */
describe('the store host: the writes the screens used to dispatch themselves', () => {
  const mine = () => [task(), task({ id: 't2', title: 'Other', time: '6:30 PM', steps: [{ id: 's', text: 'a', done: false }] })];

  it('adds like addTask: the same record, with the id and the timestamp the reducer mints', async () => {
    const w = live(mine());
    const added = await w.domains.tasks.add({ title: 'Read chapter 5', dueOn: '2026-10-09', courseId: 'econ', time: '6:30 PM', note: 'ch. 5', origin: 'mail' });
    expect(added.ok).toBe(true);
    const legacy = reducer(base(mine()), { type: 'addTask', task: { title: 'Read chapter 5', date: '2026-10-09', courseId: 'econ', time: '6:30 PM', note: 'ch. 5', from: 'mail' } });
    const strip = (ts: PersonalTask[]) => ts.map(({ id: _id, created: _created, ...rest }) => rest);
    expect(strip(w.state().tasks)).toEqual(strip(legacy.tasks));
    expect(w.dispatched.map((a) => a.type)).toEqual(['addTask']);
  });

  it('moves like moveTask, a day alone and a day with a time, and nothing else on the record', async () => {
    for (const [date, time] of [['2026-10-12', undefined], ['2026-10-12', '4:00 PM']] as const) {
      const w = live(mine());
      await w.domains.tasks.reschedule('t2', date, time);
      const legacy = reducer(base(mine()), { type: 'moveTask', id: 't2', date, ...(time === undefined ? {} : { time }) });
      expect(w.state().tasks).toEqual(legacy.tasks);
      expect(w.dispatched).toEqual([{ type: 'moveTask', id: 't2', date, ...(time === undefined ? {} : { time }) }]);
    }
  });

  it('deletes like deleteTask', async () => {
    const w = live(mine());
    await w.domains.tasks.remove('t1');
    expect(w.state().tasks).toEqual(reducer(base(mine()), { type: 'deleteTask', id: 't1' }).tasks);
    expect(w.dispatched).toEqual([{ type: 'deleteTask', id: 't1' }]);
  });

  it('toggles like toggleTask, in both directions', async () => {
    const w = live([task(), task({ id: 't2', done: true })]);
    await w.domains.tasks.toggle('t1');
    await w.domains.tasks.toggle('t2');
    let legacy = reducer(base([task(), task({ id: 't2', done: true })]), { type: 'toggleTask', id: 't1' });
    legacy = reducer(legacy, { type: 'toggleTask', id: 't2' });
    expect(w.state().tasks).toEqual(legacy.tasks);
  });

  it('sends the two actions the undo table names, so a move and a delete keep their undo', async () => {
    const w = live(mine());
    await w.domains.tasks.reschedule('t1', '2026-10-12');
    await w.domains.tasks.remove('t2');
    expect(w.dispatched.map((a) => a.type)).toEqual(['moveTask', 'deleteTask']);
    for (const a of w.dispatched) expect(UNDOABLE, a.type).toHaveProperty(a.type);
  });

  it('waits for the store to commit before it looks for what it added', async () => {
    // A store that commits a tick later, as React does: the add is not visible when dispatch returns.
    let state = base([]);
    let pending: Action | null = null;
    let release: () => void = () => {};
    const committed = new Promise<void>((r) => { release = r; });
    const host = hostOver(
      () => ({ state, catalog: EMPTY_CATALOG, accountId: null, schoolId: 'default', now: new Date(2026, 9, 8, 12), grants: [], choices: {} }),
      (a) => { pending = a; setTimeout(() => { state = reducer(state, pending as Action); release(); }, 5); },
      () => committed,
    );
    const domains = composeDomains(host, { clock: fixedClock('2026-10-08'), ids: counterIds('req'), events: new MemorySink() });
    const added = await domains.tasks.add({ title: 'Late', dueOn: null, courseId: null, time: '', note: '', origin: null });
    expect(added.ok && added.value.title).toBe('Late');
  });
});
