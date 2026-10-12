// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as capabilities from './capabilities';
import type { Grant } from './capabilities';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Discovery = {
  status: 'signed-out' | 'loading' | 'ready' | 'error';
  grants: Grant[];
  error: string;
  retry(): void;
};

type DiscoveryHook = (accountId: string, load?: (accountId: string) => Promise<Grant[]>) => Discovery;
const hook = (capabilities as typeof capabilities & { useCapabilityDiscovery?: DiscoveryHook }).useCapabilityDiscovery;

let host: HTMLDivElement;
let root: Root;
let latest: Discovery | null;

function Probe({ accountId, load }: { accountId: string; load: (accountId: string) => Promise<Grant[]> }) {
  latest = hook!(accountId, load);
  return <span>{latest.status}</span>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  latest = null;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('account-keyed capability discovery', () => {
  it('provides the explicit discovery hook', () => {
    expect(typeof hook).toBe('function');
  });

  it('does not let account A finish inside account B', async () => {
    if (!hook) return;
    const a = deferred<Grant[]>();
    const b = deferred<Grant[]>();
    const loadA = vi.fn(() => a.promise);
    const loadB = vi.fn(() => b.promise);

    await act(async () => root.render(<Probe accountId="account-a" load={loadA} />));
    expect(latest?.status).toBe('loading');

    await act(async () => root.render(<Probe accountId="account-b" load={loadB} />));
    expect(loadA).toHaveBeenCalledWith('account-a');
    expect(loadB).toHaveBeenCalledWith('account-b');
    a.resolve([{ capability: 'console:operate', scopeKind: 'platform', scopeId: '' }]);
    await act(async () => {});
    expect(latest).toMatchObject({ status: 'loading', grants: [] });

    b.resolve([{ capability: 'opportunity:publish', scopeKind: 'school', scopeId: 'school-b' }]);
    await act(async () => {});
    expect(latest).toMatchObject({
      status: 'ready',
      grants: [{ capability: 'opportunity:publish', scopeKind: 'school', scopeId: 'school-b' }],
    });
  });

  it('keeps failure distinct from no grants and retries explicitly', async () => {
    if (!hook) return;
    const first = deferred<Grant[]>();
    const second = deferred<Grant[]>();
    const load = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    await act(async () => root.render(<Probe accountId="account-a" load={load} />));
    first.reject(new Error('offline'));
    await act(async () => {});
    expect(latest).toMatchObject({ status: 'error', grants: [], error: 'Could not check connected access.' });

    await act(async () => latest!.retry());
    expect(latest).toMatchObject({ status: 'loading', grants: [] });
    second.resolve([]);
    await act(async () => {});
    expect(latest).toMatchObject({ status: 'ready', grants: [], error: '' });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not ask for grants without an account', async () => {
    if (!hook) return;
    const load = vi.fn(async () => []);
    await act(async () => root.render(<Probe accountId="" load={load} />));
    expect(latest).toMatchObject({ status: 'signed-out', grants: [] });
    expect(load).not.toHaveBeenCalled();
  });
});
