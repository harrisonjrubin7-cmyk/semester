// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDeviceLibrary } from '../lib/device-library';
import { EMPTY_REGISTRATION_DAY, readRegistrationDay } from '../lib/registration-day';
import { REGISTRATION_DAY_KEY } from '../lib/registration-window';

/**
 * Turning the registration reminder off, or moving the time, rebuilds the
 * push queue at once (review fix). The queue is otherwise refilled at most
 * twice a day, so a reminder the student switched off could still arrive.
 * Everything the queue is built from is mocked; what is measured is whether
 * a rebuild happens and which registration time it carries.
 */

const saved: (number | null)[] = [];
vi.mock('../state/store', () => ({
  useNow: () => new Date('2026-10-01T12:00:00'),
  useStore: () => ({ state: { notifs: {}, done: {} }, catalog: {}, account: { id: 'u1' }, courseCode: () => '' }),
}));
vi.mock('../lib/push', () => ({
  enrolled: async () => true,
  lastRefill: () => Date.now(),
  needsRefill: () => false,
  markRefilled: () => {},
  queueFor: (_now: Date, _notifs: unknown, day: (d: Date) => { registrationOpens: number | null }) => day(new Date()).registrationOpens,
}));
vi.mock('../lib/cloud', () => ({ saveQueue: async (q: number | null) => void saved.push(q) }));
vi.mock('../lib/select', () => ({ datedItems: () => [], railFor: () => [] }));
vi.mock('../lib/atrisk', () => ({ atRiskToday: () => [] }));
vi.mock('../lib/notify', () => ({ classesToNudge: () => [] }));
vi.mock('../lib/start', () => ({ beginNow: () => [], planFrom: () => ({}) }));

const { PushTop } = await import('./PushTop');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
function Switch() {
  const lib = useDeviceLibrary(REGISTRATION_DAY_KEY, readRegistrationDay, EMPTY_REGISTRATION_DAY);
  return (
    <button type="button" onClick={() => lib.update((d) => ({ ...d, remind: false }))}>
      Switch the reminder off
    </button>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(REGISTRATION_DAY_KEY, JSON.stringify({ ...EMPTY_REGISTRATION_DAY, opensAt: '2026-11-02T07:00', remind: true }));
  saved.length = 0;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

const settle = () => act(async () => new Promise((r) => setTimeout(r, 20)));

it('rebuilds the queue without the reminder the moment it is switched off', async () => {
  await act(async () => root.render(<><PushTop /><Switch /></>));
  await settle();
  // Refilled recently, and nothing changed: no rebuild (the control).
  expect(saved).toEqual([]);
  await act(async () => host.querySelector('button')!.click());
  await settle();
  expect(saved).toEqual([null]);
});
