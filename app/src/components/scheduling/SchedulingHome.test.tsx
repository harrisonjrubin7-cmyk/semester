// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * Scheduling as the person sees it: nothing in Connect, a member's request form,
 * the office only for someone holding a space capability, a requester told that
 * someone else decides their booking, and a timetable proposal with its
 * conflicts shown before it is saved. The rules are `supabase/scheduling.check.sql`'s.
 */
const SPACES = [
  { id: 's1', code: 'HALL-101', name: 'Hall 101', building: 'Main', capacity: 45, features: ['projector'], bookable: true, retired: false },
  { id: 's2', code: 'LAB-1', name: 'Lab 1', building: 'Main', capacity: 24, features: [], bookable: true, retired: false },
];
const mock = vi.hoisted(() => ({
  store: { school: { id: 'vu' }, account: { id: 'u1' } as { id: string } | null, say: vi.fn(), dispatch: vi.fn() },
  rows: [] as unknown[] | null,
  grants: [] as unknown[],
  bookings: [] as unknown[],
  request: vi.fn(async () => ({})),
  decide: vi.fn(async () => ({})),
  saveRun: vi.fn(async () => ({ id: 'r1', conflicts: 0 })),
}));
vi.mock('../../state/store', () => ({ useStore: () => mock.store }));
vi.mock('../../lib/modulemode', async (orig) => ({ ...(await orig<typeof import('../../lib/modulemode')>()), moduleModes: () => Promise.resolve(mock.rows) }));
vi.mock('../../lib/capabilities', () => ({ loadMyCapabilities: () => Promise.resolve(mock.grants) }));
vi.mock('../../lib/scheduling/client', async (orig) => ({
  ...(await orig<typeof import('../../lib/scheduling/client')>()),
  loadSpaces: () => Promise.resolve(SPACES),
  loadBookings: () => Promise.resolve(mock.bookings),
  loadRuns: () => Promise.resolve([]),
  requestBooking: mock.request,
  decideBooking: mock.decide,
  saveRun: mock.saveRun,
}));
const { SchedulingHome } = await import('./SchedulingHome');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const CORE = [{ module: 'scheduling', mode: 'core', frozen: false, killed: false }];
const OFFICER = [
  { capability: 'space:manage', scopeKind: 'school', scopeId: 'vu' }, { capability: 'space:approve', scopeKind: 'school', scopeId: 'vu' },
  { capability: 'timetable:run', scopeKind: 'school', scopeId: 'vu' },
];

beforeEach(() => {
  mock.store.account = { id: 'u1' };
  mock.rows = CORE; mock.grants = []; mock.bookings = [];
  mock.request.mockClear(); mock.decide.mockClear(); mock.saveRun.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => { act(() => root.unmount()); host.remove(); });

const render = async () => { await act(async () => root.render(<SchedulingHome />)); };
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));
const typeInto = async (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  await act(async () => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

it('asks a signed-out visitor to sign in', async () => {
  mock.store.account = null;
  await render();
  expect(host.textContent).toContain('Sign in with your school account');
});

it('says the school’s own system holds booking while the school is in Connect', async () => {
  mock.rows = [{ module: 'scheduling', mode: 'connect', frozen: false, killed: false }];
  await render();
  expect(host.textContent).toContain('own system holds room booking');
});

it('lets a member request a space, keeping Request off until the form is complete', async () => {
  await render();
  expect(host.textContent).toContain('HALL-101 · Hall 101 · holds 45 · projector');
  expect((button(/^Request it$/) as HTMLButtonElement).disabled).toBe(true);
  expect(button(/^Scheduling office$/)).toBeUndefined();
  const inputs = [...host.querySelectorAll('input')];
  await typeInto(inputs.find((i) => i.type === 'text')!, 'Economics club');
  await typeInto(inputs.find((i) => i.type === 'date')!, '2026-10-05');
  const times = inputs.filter((i) => i.type === 'time');
  await typeInto(times[0], '09:00');
  await typeInto(times[1], '10:00');
  expect((button(/^Request it$/) as HTMLButtonElement).disabled).toBe(false);
  await act(async () => button(/^Request it$/)!.click());
  expect(mock.request).toHaveBeenCalledWith('HALL-101', 'meeting', 'Economics club', expect.stringMatching(/^2026-10-0/), expect.stringMatching(/^2026-10-0/), expect.any(String));
});

it('shows the office to a space capability and tells a requester someone else decides', async () => {
  mock.grants = OFFICER;
  mock.bookings = [
    { id: 'b1', spaceId: 's1', title: 'My own meeting', purpose: 'meeting', startsAt: '2026-10-05T09:00:00Z', endsAt: '2026-10-05T10:00:00Z', status: 'requested', mine: true, note: '' },
    { id: 'b2', spaceId: 's2', title: 'Chess club', purpose: 'event', startsAt: '2026-10-06T09:00:00Z', endsAt: '2026-10-06T10:00:00Z', status: 'requested', mine: false, note: '' },
  ];
  await render();
  await act(async () => button(/^Scheduling office$/)!.click());
  expect(host.textContent).toContain('You requested this, so someone else decides it.');
  expect([...host.querySelectorAll('button')].filter((b) => /^Confirm$/.test(b.textContent ?? ''))).toHaveLength(1);
  await act(async () => button(/^Confirm$/)!.click());
  expect(mock.decide).toHaveBeenCalledWith('b2', true, '', expect.any(String));
});

it('proposes a timetable from typed sections, shows what could not be placed, and saves the run', async () => {
  mock.grants = OFFICER;
  await render();
  await act(async () => button(/^Timetable$/)!.click());
  const area = host.querySelector('textarea') as HTMLTextAreaElement;
  await typeInto(area, 'ECON 1010 | 01 | 30 | Dr Rao | | MWF 09:00-09:50\nBIG 9999 | 01 | 900 | Dr X | | MWF 09:00-09:50');
  await act(async () => button(/^Propose a timetable$/)!.click());
  expect(host.textContent).toContain('1 placed · 1 not placed · 0 conflicts');
  expect(host.textContent).toContain('BIG 9999 01 was not placed: no bookable room holds 900');
  expect(host.textContent).toContain('A rule proposed this, not a person');
  await act(async () => button(/^Save this run$/)!.click());
  expect(mock.saveRun).toHaveBeenCalledWith('2027SP', expect.any(Array), [expect.objectContaining({ course: 'ECON 1010', room: 'HALL-101' })], expect.any(String));
});

it('says the first bad section line instead of proposing', async () => {
  mock.grants = OFFICER;
  await render();
  await act(async () => button(/^Timetable$/)!.click());
  await typeInto(host.querySelector('textarea') as HTMLTextAreaElement, 'not a section');
  await act(async () => button(/^Propose a timetable$/)!.click());
  expect(host.textContent).toContain('Line 1:');
  expect(host.textContent).not.toContain('The proposal');
});
