// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CORE_MODULES } from '@semester/contract';

/**
 * The Modules tab shows every module, its mode and its source; offers a
 * request only to someone who may configure the school; and lets a second
 * administrator approve but never the requester. The mode itself is the
 * database's, so the loaders are stubbed.
 */
const mock = vi.hoisted(() => ({
  rows: null as { module: string; mode: string; frozen: boolean; killed: boolean }[] | null,
  requests: [] as unknown[],
  request: vi.fn(async () => null as string | null),
  approve: vi.fn(async () => null as string | null),
}));
vi.mock('../../lib/modulemode', async (orig) => ({
  ...(await orig<typeof import('../../lib/modulemode')>()),
  moduleModes: () => Promise.resolve(mock.rows),
  loadRequests: () => Promise.resolve(mock.requests),
  requestModuleMode: mock.request,
  approveModuleMode: mock.approve,
}));
const { ModulesPanel } = await import('./ModulesPanel');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  mock.rows = CORE_MODULES.map((module) => ({ module, mode: 'connect', frozen: false, killed: false }));
  mock.requests = [];
  mock.request.mockClear();
  mock.approve.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = async (props: { canEdit: boolean; me?: string }) => {
  await act(async () => root.render(<ModulesPanel school="s1" me={props.me ?? 'u1'} canEdit={props.canEdit} />));
};
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));

it('lists all fourteen modules in Connect and separates a built gradebook from cutover authorization', async () => {
  await render({ canEdit: true });
  expect(host.querySelectorAll('li').length).toBe(14);
  expect(host.textContent).toContain('native gradebook exists');
  expect(host.textContent).toContain('no school has authorized a Core cutover');
  expect(host.textContent).toContain('Assignments and submissions');
  expect(host.textContent).toContain('Status: Planned');
});

it('offers a request to an administrator and nothing to anyone else', async () => {
  await render({ canEdit: false });
  expect(button(/Ask for Core/)).toBeUndefined();
  expect(host.textContent).toContain('Only an administrator');
  act(() => root.unmount());
  root = createRoot(host);
  await render({ canEdit: true });
  expect(button(/Ask for Core/)).toBeDefined();
});

it('sends a reason with the request, and will not send without one', async () => {
  await render({ canEdit: true });
  await act(async () => button(/Ask for Core/)!.click());
  expect((button(/Send for approval/) as HTMLButtonElement).disabled).toBe(true);
  const box = host.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box, 'Pilot cohort');
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => button(/Send for approval/)!.click());
  expect(mock.request).toHaveBeenCalledWith('s1', 'u1', 'lms_assignments', 'core', 'Pilot cohort');
});

it('lets another administrator approve, and never the requester', async () => {
  mock.requests = [{ id: 'r1', module: 'lms_assignments', to_mode: 'core', reason: 'Pilot', status: 'pending', requested_by: 'u2', requested_at: '', expires_at: '', approvals: 1, approvedByMe: false }];
  await render({ canEdit: true, me: 'u1' });
  expect(host.textContent).toContain('1 of 2 approvals');
  await act(async () => button(/^Approve/)!.click());
  expect(mock.approve).toHaveBeenCalledWith('s1', 'u1', 'r1');
  act(() => root.unmount());
  root = createRoot(host);
  await render({ canEdit: true, me: 'u2' });
  expect(button(/^Approve/)).toBeUndefined();
});

it('says every module is Connect when the setting could not be read', async () => {
  mock.rows = null;
  await render({ canEdit: true });
  expect(host.textContent).toContain('could not be read');
  expect(host.textContent).toContain('Connect, because the setting could not be read');
});

it('does not say the settings could not be read while they are still being read', async () => {
  // canEdit so that "Ask for Core" would be on offer if the panel guessed a mode.
  let release: (v: typeof mock.rows) => void = () => {};
  const slow = new Promise<typeof mock.rows>((r) => { release = r; });
  const real = mock.rows;
  // The loader is stubbed above to resolve at once; hand this render a slow one.
  const mod = await import('../../lib/modulemode');
  const spy = vi.spyOn(mod, 'moduleModes').mockReturnValue(slow as never);
  try {
    await act(async () => root.render(<ModulesPanel school="s1" me="u1" canEdit />));
    expect(host.textContent).toContain('Reading the settings');
    expect(host.textContent).not.toContain('could not be read');
    // Nor does any module claim a mode, or offer a change, before it is known.
    expect(host.textContent).not.toContain('because the setting');
    expect(button(/Ask for Core|Go back to Connect/)).toBeUndefined();
    await act(async () => { release(real); await slow; });
    expect(host.textContent).not.toContain('Reading the settings');
    expect(host.textContent).not.toContain('could not be read');
  } finally {
    spy.mockRestore();
  }
});

it('says so, after the read, when the settings really could not be read', async () => {
  mock.rows = null;
  await render({ canEdit: false });
  expect(host.textContent).toContain('The settings could not be read, so every module shows as Connect');
  expect(host.textContent).not.toContain('Reading the settings');
});
