// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  configured: true,
  account: { id: 'account-team-1', email: 'team@semester.example', via: 'SSO' } as { id: string; email: string; via: string } | null,
  user: 'account-team-1' as string | null,
  authError: null as { message: string } | null,
  caps: vi.fn(),
  authChange: null as null | (() => void),
}));

function table() {
  const self: Record<string, unknown> = {
    then: (ok: (reply: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok),
  };
  for (const method of ['select', 'eq', 'in', 'order', 'limit', 'range', 'maybeSingle']) self[method] = () => self;
  return self;
}

vi.mock('../state/store', () => ({ useStore: () => ({ account: mock.account }) }));
vi.mock('../lib/cloud', () => ({
  get cloudConfigured() { return mock.configured; },
  cloud: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mock.user ? { id: mock.user } : null }, error: mock.authError }),
      onAuthStateChange: (callback: () => void) => {
        mock.authChange = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
    from: () => table(),
    rpc: () => table(),
  }),
}));
vi.mock('../lib/capabilities', async (original) => ({
  ...(await original<object>()),
  loadMyCapabilitiesOrThrow: mock.caps,
}));
vi.mock('../lib/offline-mode', async (original) => ({ ...(await original<object>()), useOnline: () => true }));

import { Company } from './Company';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  mock.configured = true;
  mock.account = { id: 'account-team-1', email: 'team@semester.example', via: 'SSO' };
  mock.user = 'account-team-1';
  mock.authError = null;
  mock.authChange = null;
  mock.caps.mockResolvedValue([{ capability: 'account:manage', scopeKind: 'platform', scopeId: '' }]);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function render() {
  await act(async () => root.render(<Company />));
  for (let index = 0; index < 8; index += 1) await act(async () => Promise.resolve());
}

describe('Company entry gate', () => {
  it('requires a signed-in account before checking staff permissions', async () => {
    mock.account = null;
    mock.user = null;
    await render();
    expect(host.textContent).toContain('Sign in to open Company');
    expect(mock.caps).not.toHaveBeenCalled();
  });

  it('rejects similarly named, wrong-scope, console-only and trust-only grants', async () => {
    mock.caps.mockResolvedValue([
      { capability: 'account:manage', scopeKind: 'school', scopeId: 'north' },
      { capability: 'console:operate', scopeKind: 'platform', scopeId: '' },
      { capability: 'trust:publish', scopeKind: 'platform', scopeId: '' },
    ]);
    await render();
    expect(host.textContent).toContain('Company access is not granted');
    expect(host.textContent).not.toContain('No company accounts are visible');
  });

  it('distinguishes an authentication failure from denied or empty data', async () => {
    mock.authError = { message: 'network unavailable' };
    mock.user = null;
    await render();
    expect(host.textContent).toContain('Your signed-in account could not be verified');
    expect(host.textContent).not.toContain('Company access is not granted');
    expect(host.textContent).not.toContain('No company accounts are visible');
  });

  it('opens procurement access only after the exact capability check succeeds', async () => {
    await render();
    expect(mock.caps).toHaveBeenCalledWith('account-team-1');
    expect(host.textContent).toContain('Procurement access');
    expect(host.textContent).toContain('No company accounts are visible');
  });
});
