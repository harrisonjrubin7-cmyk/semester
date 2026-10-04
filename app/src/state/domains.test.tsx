// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { loadSeed } from '../data/seed';
import type { Domains } from '../domains/composition';
import { dateToIso } from '../lib/date';
import { useDomains } from './domains';
import { STORAGE_KEY } from './shape';
import { StoreProvider, useStore } from './store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * `useDomains` against the real store, in a real React tree.
 *
 * `domains/composition.test.ts` drives the reducer synchronously, which is the
 * easy case. What this holds is the hard one the hook exists to solve: React
 * only *schedules* a dispatch, so a write has to wait for the commit, and a
 * service built once has to keep reading the state on screen, not the state of
 * the render it was built in.
 */
let host: HTMLDivElement;
let root: Root;
const seen = { domains: [] as Domains[], tasks: [] as { id: string; title: string; done: boolean }[], dispatch: null as null | ((a: never) => void) };

function Probe() {
  const domains = useDomains();
  const { state, dispatch } = useStore();
  seen.domains.push(domains);
  seen.tasks = state.tasks;
  seen.dispatch = dispatch as (a: never) => void;
  return <output data-tasks={state.tasks.length} />;
}

beforeAll(async () => {
  await loadSeed();
});

beforeEach(async () => {
  seen.domains = [];
  seen.tasks = [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6 }));
  host = document.createElement('div');
  document.body.append(host);
  await act(async () => {
    root = createRoot(host);
  });
  await act(async () => {
    root.render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
  });
});

// No root outlives the test that made it. See `src/rootunmount.test.ts`.
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

/**
 * Start a write inside `act`, let React flush the dispatch when the scope closes, then await the result.
 *
 * Inside a single `act` scope React holds renders until the callback returns, so
 * awaiting the write there would wait for a commit that cannot happen. A browser
 * has no such scope; this is the test environment's shape, not the hook's.
 */
async function run<T>(fn: () => Promise<T>): Promise<T> {
  let pending!: Promise<T>;
  await act(async () => {
    pending = fn();
  });
  let out!: T;
  await act(async () => {
    out = await pending;
  });
  return out;
}

const today = () => dateToIso(new Date());
const domains = () => seen.domains[seen.domains.length - 1];

describe('useDomains', () => {
  it('is built once, however often the store re-renders', async () => {
    await act(async () => seen.dispatch?.({ type: 'addTask', task: { title: 'x', date: null, time: '', note: '', courseId: null } } as never));
    expect(seen.domains.length).toBeGreaterThan(1);
    expect(new Set(seen.domains).size).toBe(1);
  });

  it('adds through the store, and resolves only once the store holds the task', async () => {
    const added = await run(() => domains().tasks.add({ title: 'Email Dr. Rao', dueOn: today() }));
    expect(added.ok).toBe(true);
    expect(seen.tasks.map((t) => t.title)).toEqual(['Email Dr. Rao']);
    expect(added.ok && added.value.value.id).toBe(seen.tasks[0].id);
  });

  it('completes through toggleTask, and refuses a second completion that the toggle would have undone', async () => {
    const r = await run(() => domains().tasks.add({ title: 'Read', dueOn: today() }));
    const id = r.ok ? r.value.value.id : '';
    await run(() => domains().tasks.complete(id));
    expect(seen.tasks.find((t) => t.id === id)?.done).toBe(true);
    const again = await run(() => domains().tasks.complete(id));
    expect(again.ok === false && again.error.code).toBe('invalid_transition');
    expect(seen.tasks.find((t) => t.id === id)?.done).toBe(true);
  });

  it('reads what the store holds now, including changes it did not make', async () => {
    await act(async () => seen.dispatch?.({ type: 'addTask', task: { title: 'From elsewhere', date: today(), time: '', note: '', courseId: null } } as never));
    const view = await domains().today();
    expect(view.ok && view.value.dueToday.map((t) => t.title)).toEqual(['From elsewhere']);
  });
});
