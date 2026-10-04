// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { loadSeed } from '../data/seed';
import type { Domains } from '../domains/composition';
import type { Task } from '../domains/tasks';
import type { PersonalTask } from '../lib/types';
import { reducer } from './reducer';
import { DEFAULT_PERSISTED, initialEphemeral, STORAGE_KEY, type Action, type State } from './shape';
import { StoreProvider, useStore } from './store';
import { makeTaskActions, useTaskActions, type TaskActions } from './taskactions';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Step 5: who decides when a task is ticked or moved.
 *
 * The first block runs `makeTaskActions` against a stand-in for the domain, so
 * every branch can be forced: the flag, a repeating task, a refusal, a task that
 * has gone. The second runs it in a real store and holds the result to what the
 * legacy reducer alone would have produced for the same presses.
 */
const dom = (over: Partial<Task> = {}): Task => ({
  id: 't1', title: 'Read', state: 'open', dueOn: '2026-09-10', courseId: null, repeats: false, ...over,
});

function stub(initial: Task[]) {
  let tasks = initial;
  const calls: string[] = [];
  const ok = { ok: true as const, value: { value: dom(), events: [], obligations: [] } };
  const domains = {
    tasks: {
      list: async () => ({ ok: true as const, value: tasks }),
      complete: vi.fn(async (id: string) => { calls.push(`complete:${id}`); tasks = tasks.map((t) => (t.id === id ? { ...t, state: 'done' as const } : t)); return ok; }),
      reopen: vi.fn(async (id: string) => { calls.push(`reopen:${id}`); tasks = tasks.map((t) => (t.id === id ? { ...t, state: 'open' as const } : t)); return ok; }),
      reschedule: vi.fn(async (id: string, to: string | null) => { calls.push(`reschedule:${id}:${to}`); return ok; }),
    },
    settled: async () => undefined,
  } as unknown as Domains;
  const dispatch = vi.fn<(a: Action) => void>();
  return { domains, dispatch, calls };
}
const drain = () => new Promise((r) => setTimeout(r, 0));

describe('makeTaskActions', () => {
  it('is the legacy dispatch, exactly, when the flag is not production', () => {
    for (const flag of ['off', 'preview', 'sandbox'] as const) {
      const { domains, dispatch, calls } = stub([dom()]);
      const a = makeTaskActions(domains, dispatch, flag);
      a.toggle('t1');
      a.reschedule('t1', '2026-09-12');
      expect(dispatch.mock.calls.map((c) => c[0])).toEqual([
        { type: 'toggleTask', id: 't1' },
        { type: 'editTask', id: 't1', patch: { date: '2026-09-12' } },
      ]);
      expect(calls).toEqual([]);
    }
  });

  it('completes an open task and reopens a done one through the domain, from the live state', async () => {
    const { domains, dispatch, calls } = stub([dom()]);
    const a = makeTaskActions(domains, dispatch, 'production');
    a.toggle('t1');
    a.toggle('t1'); // pressed again before the first has finished: it must see the first
    await drain(); await drain(); await drain();
    expect(calls).toEqual(['complete:t1', 'reopen:t1']);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('sends a repeating task to the legacy reducer and never asks the domain', async () => {
    const { domains, dispatch, calls } = stub([dom({ repeats: true })]);
    const a = makeTaskActions(domains, dispatch, 'production');
    a.toggle('t1');
    a.reschedule('t1', '2026-09-12');
    await drain(); await drain(); await drain();
    expect(calls).toEqual([]);
    expect(dispatch.mock.calls.map((c) => c[0].type)).toEqual(['toggleTask', 'editTask']);
  });

  it('does nothing for a task that has gone', async () => {
    const { domains, dispatch, calls } = stub([]);
    const a = makeTaskActions(domains, dispatch, 'production');
    a.toggle('gone');
    a.reschedule('gone', '2026-09-12');
    await drain(); await drain();
    expect(calls).toEqual([]);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('never loses a tick: a domain refusal falls back to the legacy dispatch', async () => {
    const { domains, dispatch } = stub([dom()]);
    (domains.tasks.complete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, error: { code: 'forbidden', message: 'x', retryable: false } });
    (domains.tasks.reschedule as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, error: { code: 'validation', message: 'x', retryable: false } });
    const a = makeTaskActions(domains, dispatch, 'production');
    a.toggle('t1');
    a.reschedule('t1', '2026-09-12');
    await drain(); await drain(); await drain();
    expect(dispatch.mock.calls.map((c) => c[0])).toEqual([
      { type: 'toggleTask', id: 't1' },
      { type: 'editTask', id: 't1', patch: { date: '2026-09-12' } },
    ]);
  });
});

describe('in a real store, against the legacy reducer', () => {
  let host: HTMLDivElement;
  let root: Root;
  let actions: TaskActions;
  let tasks: PersonalTask[] = [];

  function Probe({ flag }: { flag: 'off' | 'production' }) {
    const a = useTaskActions(flag);
    const { state } = useStore();
    useEffect(() => {
      actions = a;
      tasks = state.tasks;
    });
    return null;
  }

  beforeAll(async () => {
    await loadSeed();
  });

  beforeEach(async () => {
    host = document.createElement('div');
    document.body.append(host);
    await act(async () => {
      root = createRoot(host);
    });
  });

  // No root outlives the test that made it. See `src/rootunmount.test.ts`.
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    localStorage.clear();
  });

  const seed = (rows: Partial<PersonalTask>[]): PersonalTask[] =>
    rows.map((r, i) => ({ id: `t${i}`, title: `T${i}`, date: '2026-09-10', time: '', note: '', done: false, created: i, courseId: null, ...r }));

  async function mount(flag: 'off' | 'production', saved: PersonalTask[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, tasks: saved }));
    await act(async () => {
      root.render(
        <StoreProvider>
          <Probe flag={flag} />
        </StoreProvider>,
      );
    });
  }
  /** Let queued presses run: each waits for a commit, and a commit needs the `act` scope to close. */
  async function flush() {
    for (let i = 0; i < 12; i++) await act(async () => void (await new Promise((r) => setTimeout(r, 15))));
  }
  const legacyOnly = (rows: PersonalTask[], presses: Action[]): PersonalTask[] => {
    let s: State = { ...DEFAULT_PERSISTED, ...initialEphemeral(), tasks: rows };
    for (const a of presses) s = reducer(s, a);
    return s.tasks;
  };
  const strip = (rows: PersonalTask[]) => rows.map((t) => ({ id: t.id, done: t.done, date: t.date, steps: t.steps, note: t.note, time: t.time }));

  it('ticks and un-ticks like the legacy toggle, and two quick presses end where two toggles do', async () => {
    const rows = seed([{ steps: [{ id: 's', text: 'Skim', done: false }], note: 'blue book', time: '6:30 PM' }]);
    await mount('production', rows);
    await act(async () => actions.toggle('t0'));
    await flush();
    expect(strip(tasks)).toEqual(strip(legacyOnly(rows, [{ type: 'toggleTask', id: 't0' }])));
    await act(async () => {
      actions.toggle('t0');
      actions.toggle('t0');
    });
    await flush();
    expect(strip(tasks)).toEqual(strip(legacyOnly(rows, Array(3).fill({ type: 'toggleTask', id: 't0' }))));
    expect(tasks[0].done).toBe(true); // 1 + 2 presses = three toggles
  });

  it('moves a repeating task exactly as the legacy tick does', async () => {
    const rows = seed([{ date: '2026-09-09', repeat: { every: 'weekly', until: '2026-12-01' } }]);
    await mount('production', rows);
    await act(async () => actions.toggle('t0'));
    await flush();
    const expected = legacyOnly(rows, [{ type: 'toggleTask', id: 't0' }]);
    expect(strip(tasks)).toEqual(strip(expected));
    expect(tasks[0].date).not.toBe('2026-09-09'); // the control: legacy really did move it
    expect(tasks[0].done).toBe(false);
  });

  it('reschedules like editTask, and leaves a task’s other fields alone', async () => {
    const rows = seed([{ note: 'keep me', time: 'before work' }]);
    await mount('production', rows);
    await act(async () => actions.reschedule('t0', '2026-09-14'));
    await flush();
    expect(strip(tasks)).toEqual(strip(legacyOnly(rows, [{ type: 'editTask', id: 't0', patch: { date: '2026-09-14' } }])));
    expect(tasks[0]).toMatchObject({ note: 'keep me', time: 'before work', date: '2026-09-14' });
  });

  it('is indistinguishable from the legacy path with the flag off', async () => {
    const rows = seed([{}]);
    await mount('off', rows);
    await act(async () => actions.toggle('t0'));
    await flush();
    expect(strip(tasks)).toEqual(strip(legacyOnly(rows, [{ type: 'toggleTask', id: 't0' }])));
  });
});
