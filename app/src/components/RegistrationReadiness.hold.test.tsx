// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * The school's record beside the readiness view. A hold names its office; a
 * clear reading is a receipt that says it is not enrollment; and once an
 * office resolves a hold, the server's `stale` is shown as "Something changed
 * — check again" rather than as an old answer that still looks current.
 * "Check again" reads both afresh. The server side is
 * registration-hold-resolution.check.sql.
 */

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../lib/cloud', () => ({ cloudConfigured: true, cloud: () => Promise.resolve({ rpc: mock.rpc, from: vi.fn() }) }));
const { HoldStanding } = await import('./RegistrationReadiness');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  mock.rpc.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));

function school(hold: Record<string, unknown>, readiness: Record<string, unknown>[]) {
  mock.rpc.mockImplementation((name: string) =>
    Promise.resolve(name === 'my_registration_hold' ? { data: [hold], error: null } : { data: readiness, error: null }),
  );
}

it('names the office that placed a hold, and never a reason', async () => {
  school({ held: true, office: 'Bursar', link: 'https://bursar.example.edu', reason: 'unpaid tuition' }, []);
  act(() => root.render(<HoldStanding />));
  expect(host.textContent).toContain('Checking your school’s registration record');
  await flush();
  expect(host.textContent).toContain('A hold stops you adding courses. Bursar can clear it');
  expect(host.querySelector('a')!.getAttribute('href')).toBe('https://bursar.example.edu');
  expect(host.textContent).not.toContain('unpaid');
  expect(host.textContent).not.toContain('Something changed');
});

it('after an office resolves it, says something changed and checks again on request', async () => {
  school({ held: false, office: null, link: null }, [{ term: '2026FA', state: 'stale', updated_at: '2026-10-01T00:03:00Z' }]);
  act(() => root.render(<HoldStanding />));
  await flush();
  expect(host.textContent).toContain('Something changed — check again.');
  expect(host.textContent).toContain('Your readiness for 2026FA was worked out before');
  expect(host.querySelector('[data-hold-standing]')!.getAttribute('data-hold-standing')).toBe('stale');
  // The clear-hold receipt still says what it is not.
  expect(host.textContent).toContain('This is not enrollment');

  // The evaluator has not run again yet: checking again says so, and still not "ready".
  act(() => button(/Check again/)!.click());
  expect(host.textContent).toContain('Checking your school’s registration record');
  await flush();
  expect(mock.rpc.mock.calls.filter((c) => c[0] === 'my_registration_readiness')).toHaveLength(2);
  expect(host.textContent).toContain('your school has not worked it out again yet');

  // Once it has, the stale notice is gone and the receipt stands alone.
  school({ held: false, office: null, link: null }, [{ term: '2026FA', state: 'ready', updated_at: '2026-10-20T00:07:00Z' }]);
  act(() => button(/Check again/)!.click());
  await flush();
  expect(host.textContent).not.toContain('Something changed');
  expect(host.textContent).toMatch(/Checked .*No hold stops you adding courses\. This is not enrollment/);
  expect(host.querySelector('[data-hold-standing]')!.getAttribute('data-hold-standing')).toBe('clear');
});

it('says a failed read, and offers to check again rather than showing no hold', async () => {
  mock.rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
  act(() => root.render(<HoldStanding />));
  await flush();
  expect(host.textContent).toContain('Nothing has changed.');
  expect(host.textContent).not.toContain('No hold stops you');
  expect(button(/Check again/)).toBeTruthy();
});
