// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * The roster desk on screen: every state it can be in (loading, not set up,
 * refused, failed with a retry, empty, a list), nothing sent before a
 * preview is confirmed, a pasted account id checked before it is sent, the
 * absence switch saying what it means and sending what the administrator saw,
 * a stale refusal reloading, and a lost reply retried with the same key. The
 * rules themselves are proved by supabase/roster-admin-desk.check.sql.
 */

const mock = vi.hoisted(() => ({ rpc: vi.fn(), say: vi.fn() }));
vi.mock('../../lib/cloud', () => ({ cloudConfigured: true, cloud: () => Promise.resolve({ rpc: mock.rpc, from: vi.fn() }) }));
vi.mock('../../state/store', () => ({ useStore: () => ({ say: mock.say }) }));
const { RosterDesk } = await import('./RosterDesk');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  mock.rpc.mockReset();
  mock.say.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const ACCOUNT = '1b2c3d4e-0000-4000-8000-000000000001';
const CONFIG = { configured: true, absence_revokes_access: false, roster_complete: true, would_end: 2, unbound: 1, last_promoted_at: null };
const PEOPLE = [{ sourced_id: 'u-teach', role: 'teacher', given_name: 'Tess', family_name: 'Ng', courses: [{ course: 'HIST 2100', term: '2026FA', role: 'faculty' }] }];
const BOUND = { outcome: 'bound', grants: [{ role: 'faculty', scope: 'vu/HIST 2100/2026FA' }], replayed: false };

type Reply = { data?: unknown; error?: unknown } | (() => Promise<unknown>);
function server(by: Record<string, Reply>) {
  mock.rpc.mockImplementation((name: string) => {
    const r = by[name];
    if (typeof r === 'function') return r();
    return Promise.resolve({ data: null, error: null, ...r });
  });
}

const button = (name: RegExp) => [...document.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const calls = (name: string) => mock.rpc.mock.calls.filter((c) => c[0] === name);
const click = (b: HTMLButtonElement | undefined) => act(() => { b?.click(); });

function type(input: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function open(by: Record<string, Reply>) {
  server(by);
  act(() => root.render(<RosterDesk tenantId="vu" />));
  await flush();
}

it('says it is loading, then lists unbound people with what a binding gives', async () => {
  let release: (v: unknown) => void = () => {};
  server({ roster_admin_config: () => new Promise((r) => { release = r; }), roster_admin_unbound: { data: PEOPLE } });
  act(() => root.render(<RosterDesk tenantId="vu" />));
  await flush();
  expect(host.textContent).toContain('Loading the roster');
  await act(async () => { release({ data: CONFIG, error: null }); await new Promise((r) => setTimeout(r, 0)); });
  expect(mock.rpc).toHaveBeenCalledWith('roster_admin_unbound', { want_tenant: 'vu' });
  expect(host.textContent).toContain('Tess Ng');
  expect(host.textContent).toContain('HIST 2100 · 2026FA as instructor');
  expect(host.textContent).not.toContain('@');
});

it('says everyone has an account when nobody is unbound', async () => {
  await open({ roster_admin_config: { data: { ...CONFIG, unbound: 0 } }, roster_admin_unbound: { data: [] } });
  expect(host.textContent).toContain('Everyone on the roster has an account');
});

it('says it is not set up when the migration is absent', async () => {
  await open({ roster_admin_config: { error: { code: 'PGRST202', message: 'Could not find the function' } }, roster_admin_unbound: { error: { code: 'PGRST202', message: 'x' } } });
  expect(host.textContent).toContain('The roster desk is not set up here yet');
  expect(button(/Bind/)).toBeUndefined();
});

it('shows the permission boundary when the server refuses', async () => {
  const refusal = { code: '42501', message: 'semester: the roster desk needs roster:administer at this school' };
  await open({ roster_admin_config: { error: refusal }, roster_admin_unbound: { error: refusal } });
  expect(host.querySelector('[data-state="permission-denied"]')?.textContent).toContain('The roster desk needs roster:administer at this school.');
});

it('offers a retry when the load fails, and the retry loads', async () => {
  await open({ roster_admin_config: { error: { code: 'XX000', message: 'semester: the service is down' } }, roster_admin_unbound: { data: [] } });
  expect(host.textContent).toContain('Could not load the roster');
  server({ roster_admin_config: { data: CONFIG }, roster_admin_unbound: { data: PEOPLE } });
  await click(button(/Load again/));
  await flush();
  expect(host.textContent).toContain('Tess Ng');
});

it('checks a pasted account id before anything is sent, and ties the message to the field', async () => {
  await open({ roster_admin_config: { data: CONFIG }, roster_admin_unbound: { data: PEOPLE }, roster_admin_bind: { data: BOUND } });
  await click(button(/Bind Tess Ng/));
  const input = host.querySelector('input') as HTMLInputElement;
  type(input, 'tess@vu.edu');
  await click(button(/Review the binding/));
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(input.getAttribute('aria-describedby')?.split(' ').pop() ?? '')?.textContent).toContain('not an account id');
  expect(calls('roster_admin_bind')).toHaveLength(0);
});

it('previews the binding, sends nothing on cancel, then binds and shows the receipt', async () => {
  await open({ roster_admin_config: { data: CONFIG }, roster_admin_unbound: { data: PEOPLE }, roster_admin_bind: { data: BOUND } });
  await click(button(/Bind Tess Ng/));
  type(host.querySelector('input') as HTMLInputElement, ` ${ACCOUNT} `);
  await click(button(/Review the binding/));
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain('Nothing is matched by email');
  expect(dialog?.textContent).toContain('HIST 2100 · 2026FA as instructor');
  expect(dialog?.textContent).toContain('no unbind');
  await click(button(/^Cancel$/));
  expect(calls('roster_admin_bind')).toHaveLength(0);

  await click(button(/Review the binding/));
  await click(button(/^Bind$/));
  await flush();
  const [, args] = calls('roster_admin_bind')[0];
  expect(args).toMatchObject({ want_tenant: 'vu', want_sourced_id: 'u-teach', want_subject: ACCOUNT });
  expect(host.textContent).toContain(`Tess Ng is bound to account ${ACCOUNT}. They now have HIST 2100 · 2026FA as instructor.`);
});

it('shows a refusal in the server’s words', async () => {
  await open({
    roster_admin_config: { data: CONFIG }, roster_admin_unbound: { data: PEOPLE },
    roster_admin_bind: { error: { code: '42501', message: 'semester: you cannot bind your own account; another administrator at your school can' } },
  });
  await click(button(/Bind Tess Ng/));
  type(host.querySelector('input') as HTMLInputElement, ACCOUNT);
  await click(button(/Review the binding/));
  await click(button(/^Bind$/));
  await flush();
  expect(host.textContent).toContain('You cannot bind your own account; another administrator at your school can. Nothing was changed.');
  expect(button(/Try again/)).toBeUndefined();
});

it('retries a lost reply with the same key', async () => {
  let n = 0;
  await open({
    roster_admin_config: { data: CONFIG }, roster_admin_unbound: { data: PEOPLE },
    roster_admin_bind: () => (n++ === 0 ? Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) : Promise.resolve({ data: { ...BOUND, replayed: true }, error: null })),
  });
  await click(button(/Bind Tess Ng/));
  type(host.querySelector('input') as HTMLInputElement, ACCOUNT);
  await click(button(/Review the binding/));
  await click(button(/^Bind$/));
  await flush();
  expect(host.textContent).toContain('it is not known whether the change was made');
  await click(button(/Try again/));
  await flush();
  const keys = calls('roster_admin_bind').map((c) => (c[1] as { want_key: string }).want_key);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  expect(host.textContent).toContain('nothing was sent twice');
});

it('says what turning absence-means-removal on means, and sends what the administrator saw', async () => {
  await open({
    roster_admin_config: { data: CONFIG }, roster_admin_unbound: { data: [] },
    roster_admin_set_absence: { data: { outcome: 'turned-on', on: true, grants: { revoked: 2 }, replayed: false } },
  });
  expect(host.textContent).toContain('Off.');
  await click(button(/Turn on absence-means-removal/));
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain('People missing from a complete roster lose roster-given course access.');
  expect(dialog?.textContent).toContain('2 roster-given course grants would end as soon as you confirm.');
  expect(calls('roster_admin_set_absence')).toHaveLength(0);
  await click(button(/^Turn it on$/));
  await flush();
  expect(calls('roster_admin_set_absence')[0][1]).toMatchObject({ want_tenant: 'vu', want_on: true, want_expect: false });
  expect(host.textContent).toContain('Absence-means-removal is on. 2 roster-given course grants ended.');
});

it('reloads on a stale refusal rather than offering a blind retry', async () => {
  await open({
    roster_admin_config: { data: CONFIG }, roster_admin_unbound: { data: [] },
    roster_admin_set_absence: { error: { code: '40001', message: 'semester: stale: someone changed this setting since you looked; nothing was changed' } },
  });
  const before = calls('roster_admin_config').length;
  await click(button(/Turn on absence-means-removal/));
  await click(button(/^Turn it on$/));
  await flush();
  expect(host.textContent).toContain('Someone changed this setting since you loaded it');
  expect(calls('roster_admin_config').length).toBe(before + 1);
  expect(button(/Try again/)).toBeUndefined();
});

it('offers no switch when roster import is not set up for the school', async () => {
  await open({ roster_admin_config: { data: { ...CONFIG, configured: false } }, roster_admin_unbound: { data: [] } });
  expect(host.textContent).toContain('Roster import is not set up for this school');
  expect(button(/absence-means-removal/)).toBeUndefined();
});
