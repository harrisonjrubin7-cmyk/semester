// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';

/**
 * What the store does when a push loses the race.
 *
 * `lib/cloudcas.test.ts` proves `push` refuses to write over a copy this
 * device has not read. That is half a fix: refusing without going again
 * would leave this device's work on this device. So the store, on `Stale`,
 * pulls (which merges), and pushes again on the stamps it just read.
 *
 * And the other half of the same hole: while the first-sign-in dialogue is
 * asking "this device or the account?", nothing is pushed at all. It used to
 * be — the push effect did not know the question was open — so a change made
 * with the dialogue on screen settled the question before it was answered.
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

vi.mock('../lib/cloud', () => ({
  cloudConfigured: true,
  accountOf: (s: Session | null) =>
    s?.user ? { id: s.user.id, email: s.user.email ?? '', via: 'email' } : null,
  currentSession: async () => session,
  onAuthChange: () => () => {},
  explainSyncError: (e: unknown) => String(e),
  explainSync: (e: unknown) => ({ said: String(e), code: 'INTERNAL_ERROR', ref: 'SEM-TEST' }),
  isStale: (e: unknown) => e instanceof Error && e.name === 'Stale',
  pull: (...a: unknown[]) => pull(...a),
  push: (...a: unknown[]) => push(...a),
}));

const { StoreProvider } = await import('./store');
const { SEEN_KEY } = await import('./shape');
const { loadSeed } = await import('../data/seed');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const snapshot = (stamp: string, state: Record<string, unknown> = {}) => ({
  state,
  courses: [],
  updated: 0,
  seen: { state: stamp, courses: {} },
});

async function mount() {
  await act(async () => {
    root.render(
      <StoreProvider>
        <div />
      </StoreProvider>,
    );
  });
}

/**
 * Let the debounce run out, and whatever it started finish.
 *
 * In small steps, each its own `act`: React flushes a render — and so sets
 * the next timer — only when an `act` ends, so one long advance would run
 * the clock past a timer that had not been set yet.
 */
async function wait(ms: number) {
  for (let t = 0; t < ms; t += 250) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
  }
}

beforeEach(async () => {
  await loadSeed().catch(() => []);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  pull.mockReset();
  push.mockReset();
  localStorage.clear();
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

describe('a push that finds the account moved on', () => {
  it('pulls, then pushes again on the stamps it just read', async () => {
    // A device that has synced before: it holds s0, the account is at s1.
    localStorage.setItem(SEEN_KEY, JSON.stringify({ state: 's0', courses: {} }));
    pull.mockResolvedValueOnce(snapshot('s1')).mockResolvedValue(snapshot('s2'));
    push.mockRejectedValueOnce(new Stale()).mockResolvedValue({ state: 's3', courses: {} });

    await mount();
    await wait(3_000); // first push, which loses
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][4]).toEqual({ state: 's1', courses: {} });

    await wait(6_000); // pulled again, and the retry waits twice as long
    expect(push).toHaveBeenCalledTimes(2);
    expect(pull.mock.calls.length).toBeGreaterThanOrEqual(2);
    // The second push names what the second pull read, not the stale stamp.
    expect(push.mock.calls[1][4]).toEqual({ state: 's2', courses: {} });
    expect(JSON.parse(localStorage.getItem(SEEN_KEY)!)).toEqual({ state: 's3', courses: {} });
  });

  it('does not pull when the push simply works — the ordinary case costs nothing more', async () => {
    localStorage.setItem(SEEN_KEY, JSON.stringify({ state: 's1', courses: {} }));
    pull.mockResolvedValue(snapshot('s1'));
    push.mockResolvedValue({ state: 's2', courses: {} });
    await mount();
    await wait(3_000);
    expect(push).toHaveBeenCalledTimes(1);
    expect(pull).toHaveBeenCalledTimes(1); // the sign-in pull, and nothing after
  });
});

describe('while the first-sign-in question is open', () => {
  it('pushes nothing', async () => {
    // Never synced, and both sides hold a semester: `decide` asks.
    localStorage.setItem(
      'semester.v1',
      JSON.stringify({ schemaVersion: 6, tasks: [{ id: 't-local', title: 'here', date: null }] }),
    );
    pull.mockResolvedValue(
      snapshot('s1', { tasks: [{ id: 't-cloud', title: 'there', date: null }] }),
    );
    push.mockResolvedValue({ state: 's2', courses: {} });
    await mount();
    await wait(10_000);
    expect(push).not.toHaveBeenCalled();
  });
});
