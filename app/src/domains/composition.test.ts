import { describe, expect, it } from 'vitest';
import { reducer } from '../state/reducer';
import { DEFAULT_PERSISTED, initialEphemeral, type State } from '../state/shape';
import type { Role } from '../lib/role';
import type { PersonalTask } from '../lib/types';
import { createDomains, type LegacyHost } from './composition';
import { fixedClock } from './kernel';
import type { LegacyTaskCommand } from './tasks';

/**
 * The slice against the real legacy reducer.
 *
 * Nothing here is mocked: the host's `dispatch` is `state/reducer.ts`, so what
 * these tests prove is that the anti-corruption layer speaks the reducer's
 * actual vocabulary, and that the domain's rules sit *on top of* legacy
 * behaviour rather than beside it.
 */

const blank = (): State => ({ ...DEFAULT_PERSISTED, ...initialEphemeral() });

function host(opts: { role?: Role; readOnly?: boolean; tasks?: PersonalTask[] } = {}) {
  let state: State = { ...blank(), tasks: opts.tasks ?? [] };
  const dispatched: LegacyTaskCommand[] = [];
  const h: LegacyHost = {
    person: () => ({ accountId: 'acct-1', role: opts.role ?? 'student', schoolId: 'vanderbilt' }),
    readOnly: () => opts.readOnly ?? false,
    tasks: {
      read: () => state.tasks,
      dispatch: (command) => {
        dispatched.push(command);
        state = reducer(state, command as never);
      },
    },
    appointments: () => [],
    deadlines: () => [],
  };
  return { h, dispatched, state: () => state };
}

const legacyTask = (over: Partial<PersonalTask> = {}): PersonalTask => ({
  id: 't1', title: 'Read chapter 3', date: '2026-09-10', time: '6:30 PM', note: 'bring the blue book', done: false, created: 1,
  courseId: 'econ', steps: [{ id: 's1', text: 'Skim', done: false }], ...over,
});

const clock = fixedClock('2026-09-09', 600, 5);

describe('the slice running on the legacy store', () => {
  it('adds a task through the reducer and reads it back as a domain task', async () => {
    const { h, state } = host();
    const d = createDomains(h, clock);
    const r = await d.tasks.add({ title: 'Email Dr. Rao', dueOn: '2026-09-11' });
    expect(r.ok && r.value.value).toMatchObject({ title: 'Email Dr. Rao', dueOn: '2026-09-11', state: 'open', repeats: false });
    expect(state().tasks).toHaveLength(1);
    expect(state().tasks[0]).toMatchObject({ title: 'Email Dr. Rao', date: '2026-09-11', done: false });
  });

  it('completes through toggleTask without touching steps, notes or the free-text time', async () => {
    const { h, state } = host({ tasks: [legacyTask()] });
    const d = createDomains(h, clock);
    const r = await d.tasks.complete('t1');
    expect(r.ok).toBe(true);
    expect(state().tasks[0]).toMatchObject({
      done: true, note: 'bring the blue book', time: '6:30 PM', steps: [{ id: 's1', text: 'Skim', done: false }],
    });
  });

  it('refuses a second completion, where the legacy toggle would have silently undone it', async () => {
    const { h, state, dispatched } = host({ tasks: [legacyTask({ done: true })] });
    const d = createDomains(h, clock);
    const r = await d.tasks.complete('t1');
    expect(!r.ok && r.error.code).toBe('invalid_transition');
    expect(state().tasks[0].done).toBe(true);
    expect(dispatched).toEqual([]);
  });

  it('can send a task back to someday, which only editTask can express', async () => {
    const { h, state } = host({ tasks: [legacyTask()] });
    const d = createDomains(h, clock);
    const r = await d.tasks.reschedule('t1', null);
    expect(r.ok).toBe(true);
    expect(state().tasks[0].date).toBeNull();
  });

  it('leaves a repeating task to the legacy engine and changes nothing', async () => {
    const repeating = legacyTask({ repeat: { every: 'weekly', until: '2026-12-01' } });
    const { h, state, dispatched } = host({ tasks: [repeating] });
    const d = createDomains(h, clock);
    const r = await d.tasks.complete('t1');
    expect(!r.ok && r.error.code).toBe('unsupported');
    expect(state().tasks[0]).toEqual(repeating);
    expect(dispatched).toEqual([]);
  });

  it('does not rewrite a task whose stored date it could not read', async () => {
    const odd = legacyTask({ date: 'sometime next week' });
    const { h, state } = host({ tasks: [odd] });
    const d = createDomains(h, clock);
    await d.tasks.complete('t1');
    expect(state().tasks[0].date).toBe('sometime next week');
    expect(state().tasks[0].done).toBe(true);
  });

  it('reads the live state on every call, not the state it was built with', async () => {
    const { h } = host({ tasks: [legacyTask({ date: '2026-09-09' })] });
    const d = createDomains(h, clock);
    const before = await d.today();
    expect(before.ok && before.value.dueToday).toHaveLength(1);
    await d.tasks.complete('t1');
    const after = await d.today();
    expect(after.ok && after.value.dueToday).toHaveLength(0);
  });

  it('serves Today to a student and refuses it to faculty, without a role check in the slice', async () => {
    const student = await createDomains(host({ role: 'student' }).h, clock).today();
    expect(student.ok).toBe(true);
    const faculty = await createDomains(host({ role: 'faculty' }).h, clock).today();
    expect(!faculty.ok && faculty.error.code).toBe('forbidden');
  });

  it('reports the read-only obligation so the screen can say changes stay on this device', async () => {
    const { h } = host({ readOnly: true, tasks: [legacyTask()] });
    const r = await createDomains(h, clock).tasks.complete('t1');
    expect(r.ok && r.value.obligations).toEqual(['keep_on_device']);
  });

  it('waits for a host that commits later, so a write resolves only once it is recorded', async () => {
    // A React host: dispatch is queued and the list changes on the next "commit".
    let committed: PersonalTask[] = [];
    let queue: (() => void)[] = [];
    let state: State = blank();
    const h: LegacyHost = {
      ...host().h,
      tasks: {
        read: () => committed,
        dispatch: (command) => queue.push(() => { state = reducer(state, command as never); }),
        settled: () => new Promise<void>((resolve) => setTimeout(() => {
          for (const run of queue) run();
          queue = [];
          committed = state.tasks;
          resolve();
        }, 0)),
      },
    };
    const r = await createDomains(h, clock).tasks.add({ title: 'Deferred' });
    expect(r.ok && r.value.value.title).toBe('Deferred');
    expect(committed).toHaveLength(1);
  });

  it('carries time, note and what the task was made for through to the reducer', async () => {
    const { h, state } = host();
    const d = createDomains(h, clock);
    const r = await d.tasks.add({ title: 'Reply to Dr. Rao', dueOn: '2026-09-11', courseId: 'econ', time: '6 PM', note: 'about the essay', origin: 'follow-up:7' });
    expect(r.ok).toBe(true);
    expect(state().tasks[0]).toMatchObject({ title: 'Reply to Dr. Rao', date: '2026-09-11', time: '6 PM', note: 'about the essay', courseId: 'econ', from: 'follow-up:7', done: false });
  });

  it('leaves `from` off a task that nothing made', async () => {
    const { h, state } = host();
    await createDomains(h, clock).tasks.add({ title: 'Plain' });
    expect('from' in state().tasks[0]).toBe(false);
  });
});
