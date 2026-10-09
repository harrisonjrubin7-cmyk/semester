// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ required: vi.fn() }));
vi.mock('../lib/console/client', () => ({ privilegedMfaRequired: mock.required }));
vi.mock('./MfaStep', () => ({ MfaStep: ({ onVerified }: { onVerified: () => void }) => <button onClick={onVerified}>Verify second factor</button> }));

import { PrivilegedMfaBoundary } from './PrivilegedMfaBoundary';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function render(subject: string | null = 'operator-1') {
  await act(async () => {
    root.render(<PrivilegedMfaBoundary subject={subject}><p>Protected app</p></PrivilegedMfaBoundary>);
  });
}

describe('PrivilegedMfaBoundary', () => {
  it('does not mount the app until a privileged aal1 session verifies MFA', async () => {
    mock.required.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await render();
    expect(host.textContent).not.toContain('Protected app');
    expect(host.textContent).toContain('Verify second factor');
    await act(async () => { (host.querySelector('button') as HTMLButtonElement).click(); });
    expect(host.textContent).toContain('Protected app');
  });

  it('passes ordinary and signed-out sessions without an MFA prompt', async () => {
    mock.required.mockResolvedValue(false);
    await render();
    expect(host.textContent).toContain('Protected app');
    await act(async () => { root.render(<PrivilegedMfaBoundary subject={null}><p>Signed out app</p></PrivilegedMfaBoundary>); });
    expect(host.textContent).toContain('Signed out app');
  });

  it('fails closed and retries a transient privileged-status error', async () => {
    mock.required.mockRejectedValueOnce(new Error('Status unavailable')).mockResolvedValueOnce(false);
    await render();
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Status unavailable');
    const retry = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Try the access check'))!;
    await act(async () => { retry.click(); });
    expect(host.textContent).toContain('Protected app');
  });

  it('closes again before checking a different signed-in account', async () => {
    mock.required.mockResolvedValueOnce(false);
    await render('operator-1');
    expect(host.textContent).toContain('Protected app');
    mock.required.mockImplementationOnce(() => new Promise<boolean>(() => {}));
    await act(async () => {
      root.render(<PrivilegedMfaBoundary subject="operator-2"><p>Protected app</p></PrivilegedMfaBoundary>);
    });
    expect(host.textContent).not.toContain('Protected app');
    expect(host.textContent).toContain('Checking whether this account needs a second factor');
  });
});
