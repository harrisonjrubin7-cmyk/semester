// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { loadSeed } from '../data/seed';
import type { Domains } from './domains';
import type { Task } from '../domains/tasks';
import type { PersonalTask } from '../lib/types';
import { reducer } from '../state/reducer';
import { DEFAULT_PERSISTED, initialEphemeral, STORAGE_KEY, type Action, type State } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
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
const dom = (over: Partial<Task> = {}): Task => ({ id: 't1', title: 'Read', dueOn: '2026-09-10', done: false, rollsTo: null, ...over });

const gone = { ok: false as const, error: { kind: 'not_found', code: 'tasks.not_found', message: 'gone', retryable: false } };
const refusal = (kind: string) => ({ ok: false as const, error: { kind, code: `tasks.${kind}`, message: 'x', retryable: false } });

function stub(initial: Task[]) {
  let tasks = initial;
  const calls: string[] = [];
  const ok = { ok: true as const, value: { taskId: 't1' } };
  const has = (id: string) => tasks.some((t) => t.id === id);
  const domains = {
    tasks: {
      toggle: vi.fn(async (id: string) => {
        calls.push(`toggle:${id}`);
        if (!has(id)) return gone;
        tasks = tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
        return ok;
      }),
      reschedule: vi.fn(async (id: string, to: string | null, time?: string) => {
        calls.push(`reschedule:${id}:${to}${time === undefined ? '' : `@${time}`}`);
        return has(id) ? ok : gone;
      }),
      add: vi.fn(async (input: { title: string }) => { calls.push(`add:${input.title}`); return { ok: true as const, value: dom() }; }),
      remove: vi.fn(async (id: string) => {
        calls.push(`remove:${id}`);
        if (!has(id)) return gone;
        tasks = tasks.filter((t) => t.id !== id);
        return ok;
      }),
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
        { type: 'moveTask', id: 't1', date: '2026-09-12' },
      ]);
      expect(calls).toEqual([]);
    }
  });

  it('toggles through the domain, one press at a time, so a second press sees the first', async () => {
    const { domains, dispatch, calls } = stub([dom()]);
    const a = makeTaskActions(domains, dispatch, 'production');
    a.toggle('t1');
    a.toggle('t1'); // pressed again before the first has finished: it must wait for it
    await drain(); await drain(); await drain();
    expect(calls).toEqual(['toggle:t1', 'toggle:t1']);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('asks the domain about a repeating task too: the domain owns the roll, not the screen', async () => {
    const { domains, dispatch, calls } = stub([dom({ rollsTo: '2026-09-17' })]);
    const a = makeTaskActions(domains, dispatch, 'production');
    a.toggle('t1');
    a.reschedule('t1', '2026-09-12');
    await drain(); await drain(); await drain();
    expect(calls).toEqual(['toggle:t1', 'reschedule:t1:2026-09-12']);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does nothing for a task that has gone', async () => {
    const { domains, dispatch, calls } = stub([]);
    const a = makeTaskActions(domains, dispatch, 'production');
    a.toggle('gone');
    a.reschedule('gone', '2026-09-12');
    await drain(); await drain();
    expect(calls).toEqual(['toggle:gone', 'reschedule:gone:2026-09-12']);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('never loses a tick: a domain refusal falls back to the legacy dispatch', async () => {
    const { domains, dispatch } = stub([dom()]);
    (domains.tasks.toggle as ReturnType<typeof vi.fn>).mockResolvedValueOnce(refusal('forbidden'));
    (domains.tasks.reschedule as ReturnType<typeof vi.fn>).mockResolvedValueOnce(refusal('validation'));
    const a = makeTaskActions(domains, dispatch, 'production');
    a.toggle('t1');
    a.reschedule('t1', '2026-09-12');
    await drain(); await drain(); await drain();
    expect(dispatch.mock.calls.map((c) => c[0])).toEqual([
      { type: 'toggleTask', id: 't1' },
      { type: 'moveTask', id: 't1', date: '2026-09-12' },
    ]);
  });
});

describe('before the domains have loaded', () => {
  it('takes the legacy path at production, for every action, so no press is lost to a chunk still arriving', () => {
    const { dispatch } = stub([dom()]);
    const a = makeTaskActions(null, dispatch, 'production');
    a.toggle('t1');
    a.reschedule('t1', '2026-09-12', '4 PM');
    a.remove('t1');
    a.add({ title: 'x', date: null, time: '', note: '', courseId: null });
    expect(dispatch.mock.calls.map((c) => c[0].type)).toEqual(['toggleTask', 'moveTask', 'deleteTask', 'addTask']);
  });

  it('is not imported by the shell: this file must not statically import the composition root or the hook over it', () => {
    // 30 KB of first load for a flag that is off. Dynamic `import()` is the only way in; a type import is erased.
    const source = readFileSync(join(process.cwd(), 'src/composition/taskactions.ts'), 'utf8');
    const staticValueImports = source
      .split('\n')
      .filter((line) => /^import\s/.test(line) && !/^import\s+type\s/.test(line))
      .filter((line) => /from\s+'\.\/(domains|react)'/.test(line) || /from\s+'\.\.\/(domains|composition)/.test(line));
    expect(staticValueImports).toEqual([]);
  });
});

describe('makeTaskActions.add', () => {
  const plain = { title: 'Email Dr. Rao', date: '2026-09-11', time: '6 PM', note: 'about the essay', courseId: 'econ', from: 'deadline:e1' };

  it('is the legacy addTask, exactly, when the flag is not production', () => {
    for (const flag of ['off', 'preview', 'sandbox'] as const) {
      const { domains, dispatch, calls } = stub([]);
      makeTaskActions(domains, dispatch, flag).add(plain);
      expect(dispatch.mock.calls.map((c) => c[0])).toEqual([{ type: 'addTask', task: plain }]);
      expect(calls).toEqual([]);
    }
  });

  it('adds through the domain at production, carrying time, note and what the task was made for', async () => {
    const { domains, dispatch, calls } = stub([]);
    makeTaskActions(domains, dispatch, 'production').add(plain);
    await drain(); await drain();
    expect(calls).toEqual(['add:Email Dr. Rao']);
    expect(domains.tasks.add).toHaveBeenCalledWith({
      title: 'Email Dr. Rao', dueOn: '2026-09-11', courseId: 'econ', time: '6 PM', note: 'about the essay', origin: 'deadline:e1',
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('sends a repeating task, or one with steps, to the legacy reducer without asking the domain', async () => {
    const { domains, dispatch, calls } = stub([]);
    const a = makeTaskActions(domains, dispatch, 'production');
    a.add({ ...plain, repeat: { every: 'weekly', until: '2026-12-01' } });
    a.add({ ...plain, steps: [{ id: 's', text: 'Skim', done: false }] });
    await drain(); await drain(); await drain();
    expect(calls).toEqual([]);
    expect(dispatch.mock.calls.map((c) => c[0].type)).toEqual(['addTask', 'addTask']);
  });

  it('never loses an action to an exception either: a throw is said once and the legacy store takes it', async () => {
    const { domains, dispatch } = stub([dom()]);
    (domains.tasks.add as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('did not record'));
    (domains.tasks.toggle as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    const log = vi.fn();
    const a = makeTaskActions(domains, dispatch, 'production', log);
    a.add(plain);
    a.toggle('t1');
    await drain(); await drain(); await drain(); await drain();
    expect(log).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls.map((c) => c[0].type)).toEqual(['addTask', 'toggleTask']);
  });

  it('never loses a task: a refusal is said once, and the legacy store takes it', async () => {
    const { domains, dispatch } = stub([]);
    (domains.tasks.add as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, error: { kind: 'validation', code: 'validation', message: 'x', retryable: false } });
    const log = vi.fn();
    makeTaskActions(domains, dispatch, 'production', log).add(plain);
    await drain(); await drain(); await drain();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain('refused an add (validation)');
    expect(dispatch.mock.calls.map((c) => c[0])).toEqual([{ type: 'addTask', task: plain }]);
  });
});

describe('makeTaskActions.remove and the timed move', () => {
  it('is the legacy dispatch, exactly, when the flag is not production', () => {
    for (const flag of ['off', 'preview', 'sandbox'] as const) {
      const { domains, dispatch, calls } = stub([dom()]);
      const a = makeTaskActions(domains, dispatch, flag);
      a.remove('t1');
      a.reschedule('t1', '2026-09-12', '4:00 PM');
      a.reschedule('t1', '2026-09-13');
      expect(dispatch.mock.calls.map((c) => c[0])).toEqual([
        { type: 'deleteTask', id: 't1' },
        { type: 'moveTask', id: 't1', date: '2026-09-12', time: '4:00 PM' },
        { type: 'moveTask', id: 't1', date: '2026-09-13' },
      ]);
      expect(calls).toEqual([]);
    }
  });

  it('removes and moves through the domain at production, passing the time along', async () => {
    const { domains, dispatch, calls } = stub([dom()]);
    const a = makeTaskActions(domains, dispatch, 'production');
    a.reschedule('t1', '2026-09-12', '4:00 PM');
    a.reschedule('t1', '2026-09-13');
    a.remove('t1');
    await drain(); await drain(); await drain(); await drain();
    expect(calls).toEqual(['reschedule:t1:2026-09-12@4:00 PM', 'reschedule:t1:2026-09-13', 'remove:t1']);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does nothing for a task that has gone: the domain says not found and that is not a refusal', async () => {
    const empty = stub([]);
    const g = makeTaskActions(empty.domains, empty.dispatch, 'production');
    g.remove('x');
    g.reschedule('x', '2026-09-12', '4 PM');
    g.toggle('x');
    await drain(); await drain(); await drain();
    expect(empty.calls).toEqual(['remove:x', 'reschedule:x:2026-09-12@4 PM', 'toggle:x']);
    expect(empty.dispatch).not.toHaveBeenCalled();
  });

  it('never loses a delete to a refusal: it falls back to the legacy dispatch', async () => {
    const { domains, dispatch } = stub([dom()]);
    (domains.tasks.remove as ReturnType<typeof vi.fn>).mockResolvedValueOnce(refusal('forbidden'));
    makeTaskActions(domains, dispatch, 'production', () => undefined).remove('t1');
    await drain(); await drain(); await drain();
    expect(dispatch.mock.calls.map((c) => c[0])).toEqual([{ type: 'deleteTask', id: 't1' }]);
  });

  it('never loses a delete or a move: a refusal or a throw falls back to the legacy dispatch', async () => {
    const { domains, dispatch } = stub([dom()]);
    (domains.tasks.remove as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    (domains.tasks.reschedule as ReturnType<typeof vi.fn>).mockResolvedValueOnce(refusal('validation'));
    const a = makeTaskActions(domains, dispatch, 'production', () => undefined);
    a.remove('t1');
    a.reschedule('t1', '2026-09-12', '4 PM');
    await drain(); await drain(); await drain(); await drain();
    expect(dispatch.mock.calls.map((c) => c[0])).toEqual([
      { type: 'deleteTask', id: 't1' },
      { type: 'moveTask', id: 't1', date: '2026-09-12', time: '4 PM' },
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
    // A production build fetches the domains lazily, and a press before they arrive takes the legacy path,
    // which would make every comparison below pass for the wrong reason. Wait for them.
    if (flag === 'production') await act(async () => void (await new Promise((r) => setTimeout(r, 400))));
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

  it('reschedules like moveTask, and leaves a task’s other fields alone', async () => {
    const rows = seed([{ note: 'keep me', time: 'before work' }]);
    await mount('production', rows);
    await act(async () => actions.reschedule('t0', '2026-09-14'));
    await flush();
    expect(strip(tasks)).toEqual(strip(legacyOnly(rows, [{ type: 'moveTask', id: 't0', date: '2026-09-14' }])));
    expect(tasks[0]).toMatchObject({ note: 'keep me', time: 'before work', date: '2026-09-14' });
  });

  it('is indistinguishable from the legacy path with the flag off', async () => {
    const rows = seed([{}]);
    await mount('off', rows);
    await act(async () => actions.toggle('t0'));
    await flush();
    expect(strip(tasks)).toEqual(strip(legacyOnly(rows, [{ type: 'toggleTask', id: 't0' }])));
  });
  it('adds like the legacy reducer, fields and all, apart from the title being trimmed', async () => {
    await mount('production', []);
    const input = { title: '  Email Dr. Rao  ', date: '2026-09-11', time: '6 PM', note: 'about the essay', courseId: 'econ', from: 'deadline:e1' };
    await act(async () => actions.add(input));
    await flush();
    const viaLegacy = legacyOnly([], [{ type: 'addTask', task: { ...input, title: 'Email Dr. Rao' } }]);
    const pick = (rows: PersonalTask[]) => rows.map((t) => ({ title: t.title, date: t.date, time: t.time, note: t.note, courseId: t.courseId, from: t.from, done: t.done }));
    expect(pick(tasks)).toEqual(pick(viaLegacy));
    expect(tasks).toHaveLength(1);
    expect(tasks[0].from).toBe('deadline:e1'); // the control: origin really reached the store
  });

  it('keeps a repeating add exactly as the legacy reducer makes it', async () => {
    await mount('production', []);
    const input = { title: 'Laundry', date: '2026-09-15', time: '', note: '', courseId: null, repeat: { every: 'weekly' as const, until: '2026-12-01' } };
    await act(async () => actions.add(input));
    await flush();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].repeat).toEqual(input.repeat);
  });

  it('stores a title the domain would refuse, and says so once', async () => {
    await mount('production', []);
    const long = 'x'.repeat(201);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await act(async () => actions.add({ title: long, date: null, time: '', note: '', courseId: null }));
    await flush();
    expect(tasks.map((t) => t.title)).toEqual([long]);
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('[domainTasks]'))).toHaveLength(1);
    warn.mockRestore();
  });
  it('deletes like the legacy reducer', async () => {
    const rows = seed([{}, { title: 'Keep me' }]);
    await mount('production', rows);
    await act(async () => actions.remove('t0'));
    await flush();
    expect(strip(tasks)).toEqual(strip(legacyOnly(rows, [{ type: 'deleteTask', id: 't0' }])));
    expect(tasks.map((t) => t.id)).toEqual(['t1']);
  });

  it('drops a task on an hour like the legacy moveTask, and keeps its time on a day-only move', async () => {
    const rows = seed([{ time: '9 AM', note: 'keep me' }]);
    await mount('production', rows);
    await act(async () => actions.reschedule('t0', '2026-09-14', '4:00 PM'));
    await flush();
    expect(strip(tasks)).toEqual(strip(legacyOnly(rows, [{ type: 'moveTask', id: 't0', date: '2026-09-14', time: '4:00 PM' }])));
    expect(tasks[0]).toMatchObject({ date: '2026-09-14', time: '4:00 PM', note: 'keep me' });
    await act(async () => actions.reschedule('t0', '2026-09-16'));
    await flush();
    expect(tasks[0]).toMatchObject({ date: '2026-09-16', time: '4:00 PM' });
  });
});
