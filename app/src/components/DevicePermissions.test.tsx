// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DevicePermissions } from './DevicePermissions';

/**
 * The permissions panel, in every state a student can reach it in.
 *
 * Loading, ready with nothing allowed, ready with some allowed, a blocked one,
 * one this browser does not have, one it will not report, a failed read and the
 * retry, and a change made in the browser's own settings arriving while the page
 * is open. The browser is stubbed at the edge: jsdom has none of it.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

type Entry = { state: string; listeners: Set<() => void> };
function browser(states: Partial<Record<'camera' | 'microphone' | 'geolocation' | 'notifications', string | Error>>, extra: { media?: boolean; notification?: boolean } = {}) {
  const entries = new Map<string, Entry>();
  vi.stubGlobal('navigator', {
    permissions: {
      query: async ({ name }: { name: string }) => {
        const s = states[name as keyof typeof states] ?? 'prompt';
        if (s instanceof Error) throw s;
        const entry: Entry = { state: s, listeners: new Set() };
        entries.set(name, entry);
        return {
          get state() {
            return entry.state;
          },
          addEventListener: (_: string, fn: () => void) => entry.listeners.add(fn),
          removeEventListener: (_: string, fn: () => void) => entry.listeners.delete(fn),
        };
      },
    },
    ...(extra.media === false ? {} : { mediaDevices: { getUserMedia: vi.fn() } }),
    geolocation: { getCurrentPosition: vi.fn() },
  });
  if (extra.notification === false) vi.stubGlobal('Notification', undefined);
  else vi.stubGlobal('Notification', Object.assign(function () {}, { permission: 'default', requestPermission: vi.fn() }));
  return {
    change: async (name: string, state: string) => {
      const entry = entries.get(name)!;
      entry.state = state;
      await act(async () => {
        entry.listeners.forEach((fn) => fn());
        await Promise.resolve();
      });
    },
    listeners: (name: string) => entries.get(name)?.listeners.size ?? 0,
  };
}

async function render(openAlerts = () => undefined) {
  await act(async () => {
    root.render(<DevicePermissions openAlerts={openAlerts} />);
    await Promise.resolve();
  });
}
const text = () => host.textContent ?? '';
const items = () => [...host.querySelectorAll('li')];
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));

describe('the panel', () => {
  it('is a labelled region listing all four, each with what it is for and what works without it', async () => {
    browser({});
    await render();
    expect(host.querySelector('section')?.getAttribute('aria-labelledby')).toBe('device-permissions-heading');
    expect(document.getElementById('device-permissions-heading')?.textContent).toBe('On this device');
    expect(items().map((li) => li.querySelector('strong')?.textContent)).toEqual(['Camera', 'Microphone', 'Location', 'Notifications']);
    for (const li of items()) {
      expect(li.textContent).toMatch(/Used for\./);
      expect(li.textContent).toMatch(/Without it\./);
    }
  });

  it('shows a word with every state, never colour alone', async () => {
    browser({ camera: 'granted', microphone: 'denied', geolocation: 'prompt' });
    await render();
    const chips = [...host.querySelectorAll('.status-chip')].map((c) => c.textContent);
    expect(chips).toEqual(['✓Allowed', '×Blocked', '·Not asked yet', '·Not asked yet']);
  });

  it('says nothing has been allowed when nothing has, and stops saying it once something is', async () => {
    browser({});
    await render();
    expect(text()).toMatch(/Nothing has been allowed yet/);
    act(() => root.render(<></>));
    browser({ camera: 'granted' });
    await render();
    expect(text()).not.toMatch(/Nothing has been allowed yet/);
  });

  it('does not call a blocked-only page empty: blocked is an answer, and it says how to undo it', async () => {
    browser({ microphone: 'denied' });
    await render();
    expect(text()).not.toMatch(/Nothing has been allowed yet/);
    expect(host.querySelector('.state-permission')?.textContent).toMatch(/Microphone is blocked.*site settings/s);
  });

  it('gives the way back for an allowed one it cannot revoke itself', async () => {
    browser({ camera: 'granted' });
    await render();
    expect(items()[0].textContent).toMatch(/To take it back\..*site settings/s);
  });

  it('says plainly when this browser does not have the thing', async () => {
    browser({}, { media: false, notification: false });
    await render();
    expect(items()[0].textContent).toMatch(/Not available here/);
    expect(items()[0].textContent).toMatch(/does not offer it, so the app never asks/);
    expect(button(/Alerts/)).toBeUndefined();
  });

  it('says plainly when the browser will not report one, instead of calling it not asked', async () => {
    browser({ camera: new TypeError('not a permission name') });
    await render();
    expect(items()[0].textContent).toMatch(/Not reported/);
    expect(items()[0].textContent).toMatch(/only once it has been asked/);
  });

  it('links notifications to the Alerts page, where the switch is', async () => {
    const open = vi.fn();
    browser({ notifications: 'granted' });
    await render(open);
    await act(async () => button(/Turn reminders off in Alerts/)!.click());
    expect(open).toHaveBeenCalledOnce();
  });

  it('follows a change made in the browser while the page is open', async () => {
    const b = browser({ camera: 'prompt' });
    await render();
    expect(items()[0].textContent).toMatch(/Not asked yet/);
    await b.change('camera', 'denied');
    expect(items()[0].textContent).toMatch(/Blocked/);
    await b.change('camera', 'granted');
    expect(items()[0].textContent).toMatch(/Allowed/);
  });

  it('stops listening when it goes away', async () => {
    const b = browser({ camera: 'prompt' });
    await render();
    expect(b.listeners('camera')).toBe(1);
    act(() => root.render(<></>));
    expect(b.listeners('camera')).toBe(0);
  });

  it('offers a retry when reading fails, and recovers on it', async () => {
    browser({ camera: new Error('boom') });
    await render();
    expect(host.querySelector('.state-error')?.getAttribute('role')).toBe('alert');
    expect(text()).toMatch(/Could not check your permissions/);
    expect(items()).toHaveLength(0);
    browser({ camera: 'granted' });
    await act(async () => {
      button(/Try again/)!.click();
      await Promise.resolve();
    });
    expect(host.querySelector('.state-error')).toBeNull();
    expect(items()[0].textContent).toMatch(/Allowed/);
  });

  it('says it is loading before it has an answer', async () => {
    let release!: (v: { state: string }) => void;
    vi.stubGlobal('navigator', {
      permissions: { query: () => new Promise((r) => (release = r)) },
      mediaDevices: { getUserMedia: vi.fn() },
      geolocation: { getCurrentPosition: vi.fn() },
    });
    vi.stubGlobal('Notification', Object.assign(function () {}, { permission: 'default' }));
    await act(async () => {
      root.render(<DevicePermissions openAlerts={() => undefined} />);
    });
    expect(host.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(text()).toMatch(/Loading your permissions/);
    expect(items()).toHaveLength(0);
    release({ state: 'prompt' });
  });
});
