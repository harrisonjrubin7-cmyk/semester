// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import { MODULE_FLAGS } from '../lib/experience-flags';
import { OfflineRefusal } from '../lib/offline-mode';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { ConfirmDialog } from './ConfirmDialog';
import { OfflineBanner } from './OfflineBanner';

/**
 * Phase M on screen. Offline, the badge says so and when the account last
 * took this device's copy. A change made offline is saved on the device at
 * once; coming back online with changes waiting syncs them, and with nothing
 * waiting does not (the control). High-risk actions are refused offline and
 * leave nothing behind to fire later; an official hand-off cannot be
 * confirmed offline, and can with the flag off or online (the controls).
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LEDGER = 'semester.offline-ledger.v1:device';
const flag = MODULE_FLAGS.offline_mode;
let host: HTMLDivElement;
let root: Root;
let dispatchRef: ReturnType<typeof useStore>['dispatch'] | null = null;

function Probe() {
  const { dispatch } = useStore();
  useEffect(() => {
    dispatchRef = dispatch;
  });
  return null;
}

const setOnline = (on: boolean) => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => on });
const goOnline = async (on: boolean) => {
  setOnline(on);
  await act(async () => {
    window.dispatchEvent(new Event(on ? 'online' : 'offline'));
  });
};

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  window.location.hash = '';
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, seenOnboarding: true, sample: false, term: '2026FA', courses: [] }));
  localStorage.setItem(LEDGER, JSON.stringify({ lastSyncedAt: new Date(new Date().setHours(9, 5, 0, 0)).getTime(), unsyncedSince: null }));
  MODULE_FLAGS.offline_mode = 'production';
  setOnline(true);
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  MODULE_FLAGS.offline_mode = flag;
  setOnline(true);
  dispatchRef = null;
});

const render = async (node: React.ReactNode) => {
  await act(async () => root.render(<StoreProvider>{node}<Probe /></StoreProvider>));
};
const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');

describe('the badge', () => {
  it('says offline, when it last synced, and that changes are safe here', async () => {
    setOnline(false);
    await render(<OfflineBanner signedIn />);
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Offline mode');
    expect(text()).toContain('Last synced 9:05 AM.');
    expect(text()).toContain('Everything you change is saved on this device and syncs when you are back online.');
  });

  it('shows nothing online and caught up', async () => {
    await render(<OfflineBanner signedIn />);
    expect(host.querySelector('.offline-banner')).toBeNull();
  });
});

describe('a change made offline', () => {
  it('is saved on the device at once, and synced when the connection comes back', async () => {
    const syncNow = vi.fn(async () => '');
    await render(<OfflineBanner signedIn syncNow={syncNow} />);
    await goOnline(false);
    await act(async () => dispatchRef!({ type: 'addTask', task: { title: 'Written on the train', date: '2026-10-02', time: '', courseId: null, note: '' } } as never));
    // Saved on this device, with no network.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(localStorage.getItem(STORAGE_KEY)).toContain('Written on the train');
    expect(JSON.parse(localStorage.getItem(LEDGER)!).unsyncedSince).not.toBeNull();
    expect(syncNow).not.toHaveBeenCalled();
    await goOnline(true);
    expect(syncNow).toHaveBeenCalledTimes(1);
  });

  it('does not sync on reconnect when nothing is waiting, or with no account', async () => {
    const syncNow = vi.fn(async () => '');
    await render(<OfflineBanner signedIn={false} syncNow={syncNow} />);
    await goOnline(false);
    await goOnline(true);
    expect(syncNow).not.toHaveBeenCalled();
  });
});

describe('what is available offline', () => {
  it('opens saved schedules and the degree plan with the network gone', async () => {
    setOnline(false);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const course = { id: 'e1', code: 'ECON 1010', section: '01', title: 'Principles', term: '2027SP', department: 'ECON', credits: 3, instructor: '', location: '', description: '', prerequisites: '', seats: null, meetings: [{ days: [1, 3], start: '09:00', end: '10:15' }] };
    localStorage.setItem('semester.registration.v1', JSON.stringify({ catalog: null, cart: [], plans: [{ id: 'p1', name: 'Spring, with backups', courses: [course] }] }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, seenOnboarding: true, sample: false, term: '2026FA', courses: [],
      requirements: [{ id: 'core', programme: 'Economics major', name: 'Core theory', need: 'courses', count: 2, accepts: ['ECON 2010'], note: '' }] }));
    let seen: string[] = [];
    function Reader() {
      const { state } = useStore();
      useEffect(() => {
        seen = state.requirements.map((r) => r.name);
      });
      return null;
    }
    const { RegistrationPortal } = await import('./RegistrationPortal');
    await render(<><RegistrationPortal demandForecasting={false} /><Reader /></>);
    const tab = [...host.querySelectorAll('button, [role="tab"]')].find((b) => /^Potential schedules \(1\)$/.test(b.textContent ?? '')) as HTMLElement;
    await act(async () => tab.click());
    expect(text()).toContain('Spring, with backups');
    expect(seen).toEqual(['Core theory']);
    fetchSpy.mockRestore();
  });
});

describe('high-risk actions offline', () => {
  it('are refused before anything is sent, and nothing is left to send later', async () => {
    setOnline(false);
    const before = Object.keys(localStorage).sort();
    const { shareWithAdvisor } = await import('../lib/advisor-shares');
    const { markDone, saveDraft } = await import('../lib/office-actions-remote');
    const { contribute } = await import('../lib/course-demand-remote');
    const { deleteEverything } = await import('../lib/cloud');
    const payload = { version: 1, sharedAs: 'Sam', title: 't', date: null, agenda: ['a'], questions: [], scenario: null, courses: [], followUps: [] };
    await expect(shareWithAdvisor('adv@school.edu', 't', payload as never, 7)).rejects.toThrow(OfflineRefusal);
    await expect(markDone('u1', 'a1', true)).rejects.toThrow(OfflineRefusal);
    await expect(saveDraft({} as never)).rejects.toThrow(OfflineRefusal);
    await expect(contribute('2027SP', [{ course: 'ECON 1010', role: 'primary' }])).rejects.toThrow(OfflineRefusal);
    await expect(deleteEverything()).rejects.toThrow(OfflineRefusal);
    expect(Object.keys(localStorage).sort()).toEqual(before);
  });

  it('an official hand-off cannot be confirmed offline', async () => {
    setOnline(false);
    const open = vi.fn();
    await render(<ConfirmDialog title="Open the official page?" tone="external" preview={<p>https://school.edu</p>} confirmLabel="Open" onConfirm={open} onCancel={() => {}} />);
    const confirm = [...document.querySelectorAll<HTMLButtonElement>('.dialog button')].find((b) => b.textContent === 'Open')!;
    expect(confirm.disabled).toBe(true);
    expect(document.querySelector('.dialog [role="alert"]')?.textContent).toContain('You are offline. Opening an official site needs a connection');
    await act(async () => confirm.click());
    expect(open).not.toHaveBeenCalled();
  });

  it('and can be, online or with the flag off (the controls)', async () => {
    for (const [online, state] of [[true, 'production'], [false, 'off']] as const) {
      setOnline(online);
      MODULE_FLAGS.offline_mode = state;
      await render(<ConfirmDialog title="Open?" tone="external" preview={<p>x</p>} confirmLabel="Open" onConfirm={() => {}} onCancel={() => {}} />);
      const confirm = [...document.querySelectorAll<HTMLButtonElement>('.dialog button')].find((b) => b.textContent === 'Open')!;
      expect(confirm.disabled).toBe(false);
      await act(async () => root.unmount());
      root = createRoot(host);
    }
  });
});
