import { describe, expect, it } from 'vitest';
import { EMPTY_CATALOG } from '../data/catalog';
import { MemorySink, counterIds, fixedClock } from '../kernel';
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
