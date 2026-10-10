// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';

/**
 * Offline, Queued and Conflict — and the bug underneath them.
 *
 * The three states only mean something if an edit actually goes up, and on
 * the database path it did not. The push depended on `persisted`, the
 * serialised persisted half, and on IndexedDB that string is never built:
 * it is `''` on every render. So in every ordinary browser an edit never
 * re-ran the push, and the account heard about it only at the next sign-in.
 * Every earlier sync test ran in jsdom, which has no IndexedDB, so all of
 * them took the localStorage path and none of them could see it. This file
 * mocks the database as open.
 */

const session = {
  user: { id: 'u1', email: 'a@b.c', app_metadata: { provider: 'email' } },
  access_token: 'tok',
} as unknown as Session;

class Stale extends Error {
  constructor() {
    super('stale');
    this.name = 'Stale';
  }
}

const pull = vi.fn();
const push = vi.fn();
const persist = vi.fn();
const flushNow = vi.fn(async () => true);
let db = true;

vi.mock('../lib/cloud', () => ({
  cloudConfigured: true,
  accountOf: (s: Session | null) =>
    s?.user ? { id: s.user.id, email: s.user.email ?? '', via: 'email' } : null,
  currentSession: async () => session,
  onAuthChange: () => () => {},
  explainSyncError: (e: unknown) => String(e),
  // The code rides on the error, so a test can say what kind of failure it is.
  explainSync: (e: unknown) => ({ said: String(e), code: (e as { code?: string })?.code ?? 'INTERNAL_ERROR', ref: 'SEM-TEST' }),
  isStale: (e: unknown) => e instanceof Error && e.name === 'Stale',
  pull: (...a: unknown[]) => pull(...a),
  push: (...a: unknown[]) => push(...a),
}));

// The database, open — or not, per test. Writes go nowhere; what matters is
// which path the store believes it is on.
vi.mock('./persist', () => ({
  available: () => db,
  persist: (...args: unknown[]) => persist(...args),
  flushNow: () => flushNow(),
  flushOnLeave: () => {},
  whileWriting: () => {},
  load: async () => null,
}));

const { StoreProvider, useStore, FOCUS_PULL_MS } = await import('./store');
const { SEEN_KEY, UNPUSHED_KEY } = await import('./shape');
const { loadSeed } = await import('../data/seed');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let onLine = true;
let visibility: DocumentVisibilityState = 'visible';
let store: ReturnType<typeof useStore>;

function Peek() {
  const seen = useStore();
  // In an effect rather than during render, so the test reads what the last
  // committed render saw.
  useEffect(() => {
    store = seen;
  });
  return null;
}

const snapshot = (stamp: string) => ({ state: {}, courses: [], updated: 0, seen: { state: stamp, courses: {} } });

async function mount() {
  await act(async () => {
    root.render(
      <StoreProvider>
        <Peek />
      </StoreProvider>,
    );
  });
}

async function wait(ms: number) {
  for (let t = 0; t < ms; t += 250) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
  }
}

async function addTask(title: string) {
  await act(async () => {
    store.dispatch({ type: 'addTask', task: { title, date: null, time: '', note: '' } } as never);
  });
}

async function connection(on: boolean) {
  onLine = on;
  await act(async () => {
    window.dispatchEvent(new Event(on ? 'online' : 'offline'));
  });
}

beforeEach(async () => {
  await loadSeed().catch(() => []);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => onLine });
  onLine = true;
  db = true;
  pull.mockReset();
  push.mockReset();
  persist.mockReset();
  flushNow.mockReset();
  flushNow.mockResolvedValue(true);
  localStorage.clear();
  localStorage.setItem('semester.v1', JSON.stringify({ schemaVersion: 6, seenOnboarding: true, registered: true }));
  localStorage.setItem(SEEN_KEY, JSON.stringify({ state: 's1', courses: {} }));
  pull.mockResolvedValue(snapshot('s1'));
  let n = 1;
  push.mockImplementation(async () => ({ state: `s${++n}`, courses: {} }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  localStorage.clear();
});

describe('an edit goes up on the database path', () => {
  it('makes an automatic pull durable before recording the account copy as seen', async () => {
    const remote = {
      id: 'remote-task', title: 'From the account', date: null, time: '', note: '',
      courseId: null, done: true, created: 2,
    };
    pull.mockResolvedValue({
      state: { tasks: [remote] },
      courses: [],
      updated: 2,
      seen: { state: 'account-v2', courses: {} },
    });
    let seenWhenFlushed = '';
    flushNow.mockImplementationOnce(async () => {
      seenWhenFlushed = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}').state ?? '';
      return true;
    });

    await mount();
    await wait(3_000);

    const written = persist.mock.calls.find(([value]) => (
      value as { tasks?: { id: string }[] }
    ).tasks?.some((task) => task.id === remote.id))?.[0] as { tasks?: { id: string }[] } | undefined;
    expect(written?.tasks?.map((task) => task.id)).toContain(remote.id);
    expect(flushNow).toHaveBeenCalled();
    expect(seenWhenFlushed).toBe('s1');
    expect(store.asking).toBeNull();
  });

  it('does not mark an automatic account pull as seen when its durable write fails', async () => {
    pull.mockResolvedValue({
      state: { tasks: [{ id: 'remote', title: 'From the account', done: true, created: 2 }] },
      courses: [],
      updated: 2,
      seen: { state: 'account-v2', courses: {} },
    });
    flushNow.mockResolvedValue(false);

    await mount();
    await wait(3_000);

    expect(JSON.parse(localStorage.getItem(SEEN_KEY) || '{}').state).not.toBe('account-v2');
    expect(store.state.tasks.some((task) => task.id === 'remote')).toBe(false);
  });

  it('makes an accepted account copy durable before recording it as seen', async () => {
    const local = {
      id: 'local-task', title: 'Already here', date: null, time: '', note: '',
      courseId: null, done: false, created: 1,
    };
    const remote = {
      id: 'remote-task', title: 'From the account', date: null, time: '', note: '',
      courseId: null, done: true, created: 2,
    };
    localStorage.setItem(
      'semester.v1',
      JSON.stringify({ schemaVersion: 6, seenOnboarding: true, registered: true, tasks: [local] }),
    );
    localStorage.removeItem(SEEN_KEY);
    pull.mockResolvedValue({
      state: { tasks: [remote] },
      courses: [],
      updated: 2,
      seen: { state: 'account-v2', courses: {} },
    });

    await mount();
    await wait(3_000);
    expect(store.asking).not.toBeNull();
    persist.mockClear();

    await act(async () => {
      await store.settle('merge', null);
    });

    const written = persist.mock.calls.at(-1)?.[0] as { tasks?: { id: string }[] } | undefined;
    expect(written?.tasks?.map((task) => task.id).sort()).toEqual(['local-task', 'remote-task']);
    expect(flushNow).toHaveBeenCalledOnce();
    expect(store.state.tasks.map((task) => task.id).sort()).toEqual(['local-task', 'remote-task']);
    expect(JSON.parse(localStorage.getItem(SEEN_KEY) || '{}').state).toBe('account-v2');
    expect(store.asking).toBeNull();
  });

  it('does not mark an accepted account copy as seen when its durable write fails', async () => {
    localStorage.removeItem(SEEN_KEY);
    pull.mockResolvedValue({
      state: { tasks: [{ id: 'remote', title: 'From the account', done: true, created: 2 }] },
      courses: [],
      updated: 2,
      seen: { state: 'account-v2', courses: {} },
    });
    flushNow.mockResolvedValue(false);

    await mount();
    await wait(3_000);
    expect(store.asking).not.toBeNull();

    await act(async () => {
      await expect(store.settle('merge', null)).rejects.toThrow('could not be saved');
    });

    expect(localStorage.getItem(SEEN_KEY)).toBeNull();
    expect(store.asking).not.toBeNull();
  });

  it('pushes after an edit, not only at sign-in', async () => {
    await mount();
    await wait(3_000);
    const atSignIn = push.mock.calls.length;
    expect(atSignIn).toBe(1);

    await addTask('Problem set 4');
    await wait(3_000);
    expect(push.mock.calls.length).toBe(atSignIn + 1);
  });

  it('does not push for a change that is only on screen', async () => {
    // The control: opening search changes `state` and nothing persisted. A
    // navigation is not a control — `recent` and `visited` are persisted and
    // sync, on both paths, as they always have.
    await mount();
    await wait(3_000);
    const before = push.mock.calls.length;
    await act(async () => {
      store.dispatch({ type: 'finder', open: true });
    });
    await wait(3_000);
    expect(push.mock.calls.length).toBe(before);
  });
});

describe('without a connection', () => {
  it('says Offline when nothing is waiting, and pushes nothing', async () => {
    onLine = false;
    await mount();
    await wait(3_000);
    expect(store.sync.status).toBe('offline');
    expect(push).not.toHaveBeenCalled();
  });

  it('says Queued once there is an edit waiting, and remembers it across a reload', async () => {
    await mount();
    await wait(3_000);
    await connection(false);
    await addTask('Read chapter 6');
    await wait(3_000);
    expect(store.sync.status).toBe('queued');
    expect(localStorage.getItem(UNPUSHED_KEY)).toBe('1');
  });

  it('on the way back: pulls, pushes the waiting edit, and says Synced', async () => {
    await mount();
    await wait(3_000);
    await connection(false);
    await addTask('Email the TA');
    await wait(3_000);
    const pushes = push.mock.calls.length;
    const pulls = pull.mock.calls.length;

    await connection(true);
    await wait(3_000);
    expect(pull.mock.calls.length).toBe(pulls + 1);
    expect(push.mock.calls.length).toBe(pushes + 1);
    expect(store.sync.status).toBe('synced');
    expect(localStorage.getItem(UNPUSHED_KEY)).toBeNull();
  });
});

describe('when another device keeps winning', () => {
  it('says Conflict from the third lost race, not Trouble', async () => {
    push.mockRejectedValue(new Stale());
    await mount();
    // 2.5s, then 5s, 10s, 20s between rounds.
    await wait(40_000);
    expect(push.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(store.sync.status).toBe('conflict');
  });
});

describe('coming back to the app', () => {
  /*
   * A laptop that stayed online all night: no reconnect, no sign-in, nothing
   * to push. Without this, nothing pulled until somebody pulled down.
   */
  async function focus() {
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
  }

  it('pulls on focus once the last pull is more than a minute old', async () => {
    await mount();
    await wait(3_000);
    const before = pull.mock.calls.length;
    await wait(FOCUS_PULL_MS);
    await focus();
    await wait(500);
    expect(pull.mock.calls.length).toBe(before + 1);
  });

  it('does not pull again within the minute — flicking between tabs costs nothing', async () => {
    await mount();
    await wait(3_000); // the sign-in pull is seconds old
    const before = pull.mock.calls.length;
    await focus();
    await focus();
    await wait(500);
    expect(pull.mock.calls.length).toBe(before);
  });

  it('pulls when a hidden tab becomes visible, which a phone may do without focus', async () => {
    await mount();
    await wait(3_000);
    const before = pull.mock.calls.length;
    visibility = 'hidden';
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await wait(FOCUS_PULL_MS);
    visibility = 'visible';
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await wait(500);
    expect(pull.mock.calls.length).toBe(before + 1);
  });

  // Held by two checks, the effect's `online` and `refresh`'s own `offline()`;
  // removing either alone leaves this green, which is the point of having both.
  it('does not pull on focus without a connection', async () => {
    await mount();
    await wait(3_000);
    await connection(false);
    const before = pull.mock.calls.length;
    await wait(FOCUS_PULL_MS);
    await focus();
    await wait(500);
    expect(pull.mock.calls.length).toBe(before);
  });
});

describe('a push that fails outright', () => {
  const failing = (code: string) => Object.assign(new Error(code), { code });

  it('goes again by itself, and says Synced when it lands', async () => {
    // One edit, then the laptop is left alone: nothing else would push.
    push
      .mockImplementationOnce(async () => ({ state: 's2', courses: {} })) // sign-in
      .mockImplementationOnce(async () => {
        throw failing('INTERNAL_ERROR');
      })
      .mockImplementation(async () => ({ state: 's3', courses: {} }));
    await mount();
    await wait(3_000);
    await addTask('Lab report');
    await wait(3_000);
    expect(store.sync.status).toBe('error');
    expect(store.sync.error).toMatch(/try again by itself/);
    const after = push.mock.calls.length;

    await wait(6_000); // 5s after one failure
    expect(push.mock.calls.length).toBe(after + 1);
    expect(store.sync.status).toBe('synced');
  });

  it('does not go again for a refusal, and does not promise to', async () => {
    push
      .mockImplementationOnce(async () => ({ state: 's2', courses: {} }))
      .mockImplementation(async () => {
        throw failing('PERMISSION_DENIED');
      });
    await mount();
    await wait(3_000);
    await addTask('Lab report');
    await wait(3_000);
    const after = push.mock.calls.length;
    expect(store.sync.error).not.toMatch(/try again by itself/);
    await wait(30_000);
    expect(push.mock.calls.length).toBe(after);
  });

  it('starts the waits again when the connection comes back', async () => {
    push
      .mockImplementationOnce(async () => ({ state: 's2', courses: {} }))
      .mockImplementationOnce(async () => {
        throw failing('INTERNAL_ERROR');
      })
      .mockImplementationOnce(async () => {
        throw failing('INTERNAL_ERROR');
      })
      .mockImplementationOnce(async () => {
        throw failing('INTERNAL_ERROR');
      })
      .mockImplementation(async () => ({ state: 's9', courses: {} }));
    await mount();
    await wait(3_000);
    await addTask('Lab report');
    await wait(3_000 + 6_000 + 11_000); // three failures: the next wait is 20s
    const after = push.mock.calls.length;
    await connection(false);
    await connection(true);
    await wait(3_000); // back to the settle time, not the rest of 20s
    expect(push.mock.calls.length).toBe(after + 1);
    expect(store.sync.status).toBe('synced');
  });
});

/*
 * Four found by reviewing this branch, each written here red first.
 */
describe('what the review found', () => {
  it('an empty account does not leave this device refused forever', async () => {
    // This device last read a state row at s1; the account has since been
    // emptied. The refresh used to record nothing for an empty account, so
    // every push named s1, was refused, and went round again for ever.
    pull.mockResolvedValue({ state: null, courses: [], updated: 0, seen: { courses: {} } });
    push.mockImplementation(async (...a: unknown[]) => {
      const seen = a[4] as { state?: string } | null;
      if (seen?.state) throw new Stale();
      return { state: 's9', courses: {} };
    });
    await mount();
    await wait(20_000);
    expect(store.sync.status).toBe('synced');
    expect((push.mock.calls.at(-1)![4] as { state?: string }).state).toBeUndefined();
  });

  it('does not start a second push while one is still on its way', async () => {
    let land: (v: unknown) => void = () => {};
    await mount();
    await wait(3_000); // the sign-in push, done
    push.mockImplementationOnce(() => new Promise((r) => (land = r)));
    await addTask('First');
    await wait(3_000); // a slow push starts
    const started = push.mock.calls.length;
    await addTask('Second');
    await wait(6_000);
    // Still one in flight: the second waits rather than racing it on stale stamps.
    expect(push.mock.calls.length).toBe(started);
    await act(async () => land({ state: 's5', courses: {} }));
    await wait(3_000);
    expect(push.mock.calls.length).toBe(started + 1);
    // And it goes up on the stamp the first push returned.
    expect((push.mock.calls.at(-1)![4] as { state?: string }).state).toBe('s5');
  });

  it('keeps "changes waiting" when a push lands after a newer edit', async () => {
    let land: (v: unknown) => void = () => {};
    await mount();
    await wait(3_000);
    push.mockImplementationOnce(() => new Promise((r) => (land = r)));
    await addTask('First');
    await wait(3_000);
    await addTask('Second'); // after the slow push left
    await act(async () => land({ state: 's5', courses: {} }));
    // The first push is up; the second edit is not. Still waiting.
    expect(localStorage.getItem(UNPUSHED_KEY)).toBe('1');
  });

  it('does not carry one account’s sync memory into another', async () => {
    // Another account was signed in on this device before: its stamps, its
    // agreed versions and a choice waiting on its review list.
    localStorage.setItem('semester.syncedAs', 'u0');
    // This account's own copy, at its own stamp.
    pull.mockResolvedValue(snapshot('t1'));
    localStorage.setItem('semester.base', JSON.stringify({ 'notes/n1': 'x' }));
    localStorage.setItem(
      'semester.review',
      JSON.stringify([{ key: 'notes/n1', field: 'notes', id: 'n1', mine: {}, theirs: {}, kept: 'theirs', found: 0 }]),
    );
    await mount();
    await wait(3_000); // the session arrives after first paint
    expect(store.review).toEqual([]);
    expect(localStorage.getItem('semester.review')).toBeNull();
    // The first push for this account names no stamp from the other one.
    expect((push.mock.calls[0]![4] as { state?: string } | null)?.state).toBe('t1');
    expect(localStorage.getItem('semester.syncedAs')).toBe('u1');
  });
});
