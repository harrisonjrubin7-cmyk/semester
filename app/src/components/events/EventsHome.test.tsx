// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * Events as the person sees it: nothing in Connect, upcoming events with an RSVP
 * button that follows the server's answer (going, or the waitlist), a proposer
 * told that someone else decides it, and the office's controls only for
 * `events:manage`. The rules are `supabase/events.check.sql`'s.
 */
const future = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const EVENT = {
  id: 'e1', hostKind: 'community', hostRef: 'Econ club', title: 'Economics talk', description: 'A short talk', location: 'Quad', spaceId: null,
  startsAt: future(48), endsAt: future(49), capacity: 2, mine: false, state: 'published', cancelReason: '', myStatus: null, going: 2, waitlisted: 1,
};
const mock = vi.hoisted(() => ({
  store: { school: { id: 'vu' }, account: { id: 'u1' } as { id: string } | null, say: vi.fn(), dispatch: vi.fn() },
  rows: [] as unknown[] | null,
  grants: [] as unknown[],
  events: [] as unknown[],
  rsvp: vi.fn(async () => 'waitlisted'),
  decide: vi.fn(async () => ({})),
}));
vi.mock('../../state/store', () => ({ useStore: () => mock.store }));
vi.mock('../../lib/modulemode', async (orig) => ({ ...(await orig<typeof import('../../lib/modulemode')>()), moduleModes: () => Promise.resolve(mock.rows) }));
vi.mock('../../lib/capabilities', () => ({ loadMyCapabilities: () => Promise.resolve(mock.grants) }));
vi.mock('../../lib/events/client', async (orig) => ({
  ...(await orig<typeof import('../../lib/events/client')>()),
  loadEvents: () => Promise.resolve(mock.events),
  rsvp: mock.rsvp,
  decideEvent: mock.decide,
}));
const { EventsHome } = await import('./EventsHome');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const CORE = [{ module: 'events', mode: 'core', frozen: false, killed: false }];
const MANAGER = [{ capability: 'events:manage', scopeKind: 'school', scopeId: 'vu' }];

beforeEach(() => {
  mock.store.account = { id: 'u1' };
  mock.rows = CORE; mock.grants = []; mock.events = [];
  mock.rsvp.mockClear(); mock.decide.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => { act(() => root.unmount()); host.remove(); });

const render = async () => { await act(async () => root.render(<EventsHome />)); };
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));

it('asks a signed-out visitor to sign in', async () => {
  mock.store.account = null;
  await render();
  expect(host.textContent).toContain('Sign in with your school account');
});

it('says the school’s own system holds events while the school is in Connect', async () => {
  mock.rows = [{ module: 'events', mode: 'connect', frozen: false, killed: false }];
  await render();
  expect(host.textContent).toContain('own system holds events');
});

it('says there is nothing upcoming and offers a proposal form', async () => {
  await render();
  expect(host.textContent).toContain('No upcoming events');
  expect(button(/^Propose it$/)).toBeDefined();
  expect(button(/^Publish as an office event$/)).toBeUndefined();
});

it('shows counts, says a full event waitlists, and sends an RSVP', async () => {
  mock.events = [EVENT];
  await render();
  expect(host.textContent).toContain('2 going of 2 · 1 waiting');
  expect(host.textContent).toContain('Full: you would join the waitlist.');
  await act(async () => button(/^I’m going$/)!.click());
  expect(mock.rsvp).toHaveBeenCalledWith('e1', true, expect.any(String));
});

it('offers a member who is going a way to cancel, and says where a waitlisted one stands', async () => {
  mock.events = [{ ...EVENT, myStatus: 'going' }];
  await render();
  expect(host.textContent).toContain('You are going.');
  expect(button(/^Cancel my RSVP$/)).toBeDefined();
  act(() => root.unmount()); root = createRoot(host);
  mock.events = [{ ...EVENT, myStatus: 'waitlisted' }];
  await render();
  expect(host.textContent).toContain('You are on the waitlist');
});

it('tells a proposer someone else decides, and gives a manager the controls for another’s proposal only', async () => {
  mock.grants = MANAGER;
  mock.events = [
    { ...EVENT, id: 'p1', title: 'My proposal', state: 'proposed', mine: true, going: null, waitlisted: null },
    { ...EVENT, id: 'p2', title: 'Chess night', state: 'proposed', mine: false, going: null, waitlisted: null },
  ];
  await render();
  expect(host.textContent).toContain('You proposed this, so someone else decides it.');
  expect([...host.querySelectorAll('button')].filter((b) => /^Publish$/.test(b.textContent ?? ''))).toHaveLength(1);
  expect(button(/^Publish as an office event$/)).toBeDefined();
  await act(async () => button(/^Publish$/)!.click());
  expect(mock.decide).toHaveBeenCalledWith('p2', true, '', expect.any(String));
});
