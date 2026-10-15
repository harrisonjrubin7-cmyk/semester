// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { TodayDecisionSurface } from './TodayDecisionSurface';

/**
 * Phase 2: the real Action Center, mounted with the shadow on, on the shipped
 * sample semester at a pinned time. The shadow compares the domain layer's
 * Today with what this very component computed, and the only acceptable
 * outcome is "agrees, apart from the sources the domain layer does not have
 * yet" — a `console.warn` naming an unexplained difference fails the test.
 *
 * The same harness as `TodayActionCenter.test.tsx`.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let store: ReturnType<typeof useStore>;
const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});

beforeAll(async () => {
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  await loadSeed();
  await import('./TodayActionCenter');
  await import('../composition/TodayShadow');
});
afterAll(() => vi.useRealTimers());

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 27, 10, 0));
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6 }));
  warn.mockClear();
  debug.mockClear();
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function Adopt() {
  const { adopt } = useStore();
  useEffect(() => adopt(), [adopt]);
  return null;
}
function Peek() {
  const s = useStore();
  useEffect(() => { store = s; });
  return null;
}

const mount = async (setup?: () => void) => {
  await act(async () => {
    root.render(
      <StoreProvider>
        <Adopt />
        <Peek />
        <TodayDecisionSurface actionCenter />
      </StoreProvider>,
    );
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  if (setup) await act(async () => setup());
  // The shadow's view is a promise: let it settle, then the effect it feeds.
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};

const unexplained = () => warn.mock.calls.filter((c) => String(c[0]).includes('[today-shadow]'));

describe('the shadow, on the real Action Center', () => {
  it('does nothing at all when the build has not opted in', async () => {
    await mount();
    expect(debug.mock.calls.filter((c) => String(c[0]).includes('[today-shadow]'))).toEqual([]);
    expect(unexplained()).toEqual([]);
  });

  it('agrees on the sample semester, ranking and day alike', async () => {
    vi.stubEnv('VITE_TODAY_SHADOW', 'on');
    await mount();
    expect(unexplained(), JSON.stringify(unexplained())).toEqual([]);
    // The control: it did run, and reached a verdict.
    expect(debug.mock.calls.some((c) => String(c[0]).includes('agrees with the Action Center'))).toBe(true);
  });

  // 29 Sep 2026 has two deadlines in the sample (core-q4, bus-ga3). One is ticked
  // off, which legacy hides from its rows; the domain must too, and must still
  // show the other, the action and the appointment.
  it('agrees with an action, an appointment and a deadline due today when another deadline is ticked off', async () => {
    vi.stubEnv('VITE_TODAY_SHADOW', 'on');
    vi.setSystemTime(new Date(2026, 8, 29, 10, 0));
    await mount(() => {
      store.dispatch({ type: 'addTask', task: { title: 'Problem set', date: '2026-09-29', time: '', note: '' } } as never);
      store.dispatch({ type: 'addAppointment', appointment: { title: 'Dentist', date: '2026-09-29', at: 14 * 60, time: '2:00p', minutes: 30, where: '', note: '' } } as never);
      store.dispatch({ type: 'toggleDone', id: 'core-q4' });
    });
    expect(unexplained(), JSON.stringify(unexplained())).toEqual([]);
    const agreed = debug.mock.calls.filter((c) => String(c[0]).includes('agrees with the Action Center'));
    const day = agreed.flatMap((c) => (c[1] as { day: string[] }).day);
    // The control: the day it compared is not empty — it holds the ticked-off deadline's sibling, the action and the appointment.
    expect(day.some((k) => k === 'course:bus-ga3')).toBe(true);
    expect(day.some((k) => k.startsWith('task:'))).toBe(true);
    expect(day.some((k) => k.startsWith('appointment:'))).toBe(true);
    // And the ticked one is on neither side of the comparison's final agreement.
    expect(agreed.at(-1)![1] as { day: string[] }).toMatchObject({ day: expect.not.arrayContaining(['course:core-q4']) });
  });
});
