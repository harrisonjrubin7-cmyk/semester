// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider } from '../state/store';
import { EMERGENCY_GUIDANCE, newMaintenance, type MaintenanceRequest } from '../lib/maintenance';
import { MaintenanceRequests } from './MaintenanceRequests';

/**
 * Repairs on Housing, against the real store: an empty section offers to
 * record one; the form names every problem at once and moves focus; choosing
 * Emergency says to call before anything is saved; a save lands in the list;
 * a second record of the same ticket is questioned before it is kept; moves
 * follow the status graph; and a due follow-up says so in words.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date(2026, 9, 12, 9, 0);
let host: HTMLDivElement;
let root: Root;

const seed = (maintenance: MaintenanceRequest[] = []) =>
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 6,
      seenOnboarding: true,
      sample: false,
      term: '2026FA',
      residences: [{ id: 'h1', hall: 'Branscomb', room: '214', term: '2026FA', moveOut: '', hoursAfterLastExam: 0, created: 1 }],
      maintenance,
    }),
  );

const existing = (patch: Partial<MaintenanceRequest> = {}): MaintenanceRequest => ({
  ...newMaintenance(
    'mr1',
    '2026FA',
    {
      hall: 'Branscomb', room: '214', what: 'Sink drains slowly', where: 'Bathroom', urgency: 'routine', channel: 'portal',
      reference: 'WO-1001', reportedAt: NOW.getTime() - 3_600_000, checkBackAt: NOW.getTime() + 86_400_000, checkBackStated: false,
    },
    NOW.getTime() - 3_600_000,
  ),
  ...patch,
});

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  window.location.hash = '';
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.useRealTimers();
});

const render = async () => {
  await act(async () => root.render(<StoreProvider><MaintenanceRequests /></StoreProvider>));
};
const button = (name: string | RegExp) =>
  [...host.querySelectorAll('button')].find((b) => (typeof name === 'string' ? b.textContent?.trim() === name : name.test(b.textContent ?? '')));
const click = async (name: string | RegExp) => {
  const b = button(name);
  if (!b) throw new Error(`no button ${String(name)}`);
  await act(async () => b.click());
};
const field = (label: string) => {
  const l = [...host.querySelectorAll('label')].find((x) => x.textContent?.startsWith(label));
  const el = l?.htmlFor ? (host.querySelector(`[id="${l.htmlFor}"]`) as HTMLInputElement | HTMLTextAreaElement | null) : null;
  if (!el) throw new Error(`no field ${label}`);
  return el;
};
const type = async (label: string, value: string) => {
  const el = field(label);
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')!.set!;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('MaintenanceRequests', () => {
  it('starts empty, says Semester sends nothing, and offers to record a repair', async () => {
    seed();
    await render();
    expect(host.textContent).toContain('No repairs recorded');
    expect(host.textContent).toContain('Semester does not send anything to housing');
    await click('Record a repair');
    expect(host.querySelector('form[aria-label="Record a repair"]')).not.toBeNull();
    // The building comes from the room already on file.
    expect(field('Building').value).toBe('Branscomb');
  });

  it('refuses an empty description, marks the field invalid and moves focus to it', async () => {
    seed();
    await render();
    await click('Record a repair');
    await click('Save repair');
    const what = field('What is wrong');
    expect(what.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(what);
    expect(host.textContent).toContain('Say what is wrong');
  });

  it('shows the call-first guidance as an alert as soon as Emergency is chosen', async () => {
    seed();
    await render();
    await click('Record a repair');
    const emergency = [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')].find((r) => r.value === 'emergency')!;
    await act(async () => emergency.click());
    const alert = [...host.querySelectorAll('[role="alert"]')].find((n) => n.textContent === EMERGENCY_GUIDANCE);
    expect(alert).toBeDefined();
  });

  it('saves a repair to the list with its reference and whose check-back time it is', async () => {
    seed();
    await render();
    await click('Record a repair');
    await type('What is wrong', 'Heater clicks all night');
    await type('Housing reference number', 'WO-77');
    await click('Save repair');
    const list = host.querySelector('ul[aria-label="Open repair requests"]');
    expect(list?.textContent).toContain('Heater clicks all night');
    expect(list?.textContent).toContain('Reference WO-77');
    expect(list?.textContent).toContain('not a promise from housing');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').maintenance ?? null).not.toBeNull();
  });

  it('asks before recording the same ticket twice', async () => {
    seed([existing()]);
    await render();
    await click('Record another repair');
    await type('What is wrong', 'Sink still slow');
    await type('Housing reference number', 'WO-1001');
    await click('Save repair');
    expect(host.textContent).toContain('This looks like “Sink drains slowly”');
    expect(host.querySelectorAll('ul[aria-label="Open repair requests"] > li')).toHaveLength(1);
    await click('Record it as a separate repair');
    expect(host.querySelectorAll('ul[aria-label="Open repair requests"] > li')).toHaveLength(2);
  });

  it('offers only the moves the status allows, and closes a fixed request', async () => {
    seed([existing()]);
    await render();
    expect(button('Still not fixed')).toBeUndefined();
    await click('It is fixed');
    expect(host.querySelector('ul[aria-label="Open repair requests"]')).toBeNull();
    const closed = host.querySelector('ul[aria-label="Closed repair requests"]');
    expect(closed?.textContent).toContain('Fixed');
    expect(button('Still not fixed')).toBeDefined();
  });

  it('says in words when it is time to check back', async () => {
    seed([existing({ checkBackAt: NOW.getTime() - 60_000 })]);
    await render();
    expect(host.textContent).toContain('It is time to check on this one');
  });

  it('needs a time before it records a scheduled visit', async () => {
    seed([existing()]);
    await render();
    await click('Visit scheduled');
    await click('Save visit');
    expect(host.textContent).toContain('Give the date and time housing scheduled');
    await type('When housing will come', '2026-10-14T10:00');
    await click('Save visit');
    expect(host.textContent).toContain('Visit scheduled for');
  });
});

describe('MaintenanceRequests, review findings on #1501', () => {
  it('offers "Remind me tomorrow" only while waiting to hear back, not on a scheduled visit', async () => {
    // Reported a week ago, visit three days ago: a timeline the reader keeps.
    seed([existing({ status: 'scheduled', reportedAt: NOW.getTime() - 7 * 86_400_000, scheduledFor: NOW.getTime() - 3 * 86_400_000 })]);
    await render();
    expect(button('Remind me tomorrow')).toBeUndefined();
    expect(host.textContent).toContain('The visit has passed');
  });

  it('offers "Remind me tomorrow" only once the follow-up is due, and sets it for tomorrow from now', async () => {
    seed([existing({ checkBackAt: NOW.getTime() + 3 * 86_400_000 })]);
    await render();
    expect(button('Remind me tomorrow')).toBeUndefined();
    await act(async () => root.unmount());
    root = createRoot(host);
    seed([existing({ checkBackAt: NOW.getTime() - 60_000 })]);
    await render();
    await click('Remind me tomorrow');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').maintenance[0];
    expect(saved.checkBackAt).toBe(new Date(2026, 9, 13, 9, 0).getTime());
  });

  it('takes the new ticket number when a repair is reported again', async () => {
    seed([existing({ status: 'not_fixed', updated: NOW.getTime() })]);
    await render();
    await click('Reported it again');
    await type('New reference number', 'WO-2002');
    await click('Save');
    const list = host.querySelector('ul[aria-label="Open repair requests"]');
    expect(list?.textContent).toContain('Reference WO-2002');
    expect(list?.textContent).not.toContain('WO-1001');
  });
});
