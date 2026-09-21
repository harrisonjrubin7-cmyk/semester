// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';

/**
 * The switch said "on" and nothing was arriving.
 *
 * `lib/push.test.ts` proves the arithmetic — which queued reminders count as
 * never delivered, and which must not. What it cannot prove is that the answer
 * reaches a screen, and that is the whole point of the change: the failure
 * being fixed is a *silent* one, so a correct calculation that renders nothing
 * is the same bug with more code in it.
 *
 * So this mounts the real component and reads the real DOM.
 *
 * ## What is faked, and why only this much
 *
 * Two things, each replaced with `importOriginal` so everything else in both
 * modules stays real:
 *
 *   - `enrolled`, because a jsdom browser has no `PushSubscription` and the
 *     panel draws its switch as off without one.
 *   - `queuedSendAts`, because there is no Supabase project behind a test and
 *     the real one answers `[]` when `cloudConfigured` is false — which is the
 *     correct answer there and would make this test vacuously green.
 *
 * `neverArrived` and `stalledLine` are **not** faked. The sentence on screen is
 * the one the real code builds from the real timestamps, so this fails if the
 * wiring is wrong, if the branch never renders, or if the threshold moves.
 */
vi.mock('../lib/push', async (original) => ({
  ...(await original<typeof import('../lib/push')>()),
  enrolled: async () => true,
}));

vi.mock('../lib/cloud', async (original) => ({
  ...(await original<typeof import('../lib/cloud')>()),
  queuedSendAts: async () => queued,
}));

/** Rewritten per test, read by the mock above when the panel asks. */
let queued: number[] = [];

const { PushSwitch } = await import('./PushSwitch');

const HOUR = 3_600_000;
let host: HTMLDivElement;
let root: Root;

function pushable(): void {
  const g = globalThis as Record<string, unknown>;
  g.PushManager = class {};
  g.Notification = class {
    static permission = 'granted';
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({}) },
  });
}

beforeAll(async () => {
  await loadSeed();
});

beforeEach(async () => {
  pushable();
  host = document.createElement('div');
  document.body.append(host);
  await act(async () => {
    root = createRoot(host);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  const g = globalThis as Record<string, unknown>;
  delete g.PushManager;
  delete g.Notification;
  Reflect.deleteProperty(navigator, 'serviceWorker');
  localStorage.clear();
});

async function draw(): Promise<void> {
  await act(async () => {
    root.render(
      <StoreProvider>
        <PushSwitch />
      </StoreProvider>,
    );
  });
  // The panel asks after it has drawn once; let the promise settle.
  await act(async () => {
    await Promise.resolve();
  });
}

const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');

describe('a switch that is on while nothing is being delivered', () => {
  it('says so, on the screen, in words', async () => {
    queued = [Date.now() - 5 * HOUR, Date.now() - 9 * HOUR];
    await draw();
    expect(text()).toContain('2 reminders came due and did not arrive');
    expect(text()).toContain('scheduler.sql');
  });

  /*
   * The control. A queue holding the week ahead is the normal, working state
   * and is mostly rows that have not happened yet — a version of this that
   * counted them would put a warning on every healthy device every day, which
   * is worse than the silence it replaces.
   */
  it('stays quiet when the queue is simply full of the week ahead', async () => {
    queued = [Date.now() + 3 * HOUR, Date.now() + 26 * HOUR];
    await draw();
    expect(text()).not.toContain('did not arrive');
  });

  it('stays quiet inside the grace period', async () => {
    queued = [Date.now() - HOUR];
    await draw();
    expect(text()).not.toContain('did not arrive');
  });
});
