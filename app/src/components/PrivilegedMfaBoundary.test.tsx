// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ required: vi.fn(), watch: vi.fn() }));
vi.mock('../lib/mfa-status', () => ({ privilegedMfaRequired: mock.required, watchMfaSession: mock.watch }));
vi.mock('./MfaStep', () => ({ MfaStep: ({ onVerified }: { onVerified: () => void }) => <button onClick={onVerified}>Verify second factor</button> }));

import { PrivilegedMfaBoundary } from './PrivilegedMfaBoundary';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  mock.watch.mockResolvedValue(() => {});
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

  it('lets a locked-out operator sign out and switch accounts', async () => {
    const leave = vi.fn().mockResolvedValue(undefined);
    mock.required.mockResolvedValue(true);
    await act(async () => {
      root.render(<PrivilegedMfaBoundary subject="operator-1" signOutAccount={leave}><p>Protected app</p></PrivilegedMfaBoundary>);
    });
    const signOutButton = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Sign out'))!;
    expect(signOutButton).toBeTruthy();
    await act(async () => { signOutButton.click(); });
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('reports a failed sign-out and leaves the escape action usable', async () => {
    const leave = vi.fn().mockRejectedValue(new Error('Sign-out service unavailable'));
    mock.required.mockResolvedValue(true);
    await act(async () => {
      root.render(<PrivilegedMfaBoundary subject="operator-1" signOutAccount={leave}><p>Protected app</p></PrivilegedMfaBoundary>);
    });
    const signOutButton = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Sign out'))!;
    await act(async () => { signOutButton.click(); });
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Sign-out service unavailable');
    expect(signOutButton.disabled).toBe(false);
  });

  it('does not carry a pending sign-out lock into a different account', async () => {
    const leave = vi.fn(() => new Promise<void>(() => {}));
    mock.required.mockResolvedValue(true);
    await act(async () => {
      root.render(<PrivilegedMfaBoundary subject="operator-1" signOutAccount={leave}><p>Protected app</p></PrivilegedMfaBoundary>);
    });
    const firstButton = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Sign out'))!;
    await act(async () => { firstButton.click(); });
    expect(firstButton.disabled).toBe(true);
    await act(async () => {
      root.render(<PrivilegedMfaBoundary subject="operator-2" signOutAccount={leave}><p>Protected app</p></PrivilegedMfaBoundary>);
    });
    const nextButton = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Sign out'))!;
    expect(nextButton.disabled).toBe(false);
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
    expect(host.textContent).toContain('Protected app');
    const retry = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Try the access check'))!;
    await act(async () => { retry.click(); });
    expect(host.textContent).toContain('Protected app');
  });

  it('keeps the device-only app usable when no Auth subscription is available', async () => {
    mock.required.mockRejectedValue(new Error('No account service is configured for this build.'));
    mock.watch.mockRejectedValue(new Error('No account service is configured for this build.'));
    await render();
    expect(host.querySelector('[role=alert]')?.textContent).toContain('No account service is configured');
    expect(host.textContent).toContain('Protected app');
  });

  it('uses session and focus events without polling every signed-in account', async () => {
    const interval = vi.spyOn(window, 'setInterval');
    mock.required.mockResolvedValue(false);
    await render('student-1');
    expect(interval).not.toHaveBeenCalled();
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve(); });
    expect(mock.required).toHaveBeenCalledTimes(2);
    interval.mockRestore();
  });

  it('preserves a verified ordinary state when a background recheck fails', async () => {
    mock.required.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('Offline'));
    await render('student-1');
    expect(host.textContent).toContain('Protected app');
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve(); });
    expect(host.textContent).toContain('Protected app');
    expect(host.querySelector('[role=alert]')).toBeNull();
  });

  it('rechecks when Auth replaces the same account’s session', async () => {
    let changed: (() => void) | undefined;
    mock.watch.mockImplementation(async (callback: () => void) => {
      changed = callback;
      return () => {};
    });
    mock.required.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await render('operator-1');
    expect(host.textContent).toContain('Protected app');
    await act(async () => { changed?.(); await Promise.resolve(); });
    expect(host.textContent).not.toContain('Protected app');
    expect(host.textContent).toContain('Verify second factor');
  });

  it('keeps ordinary content mounted while checking a different signed-in account, then gates a confirmed privileged session', async () => {
    mock.required.mockResolvedValueOnce(false);
    await render('operator-1');
    expect(host.textContent).toContain('Protected app');
    let finish!: (required: boolean) => void;
    mock.required.mockImplementationOnce(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    await act(async () => {
      root.render(<PrivilegedMfaBoundary subject="operator-2"><p>Protected app</p></PrivilegedMfaBoundary>);
    });
    expect(host.textContent).toContain('Protected app');
    expect(host.textContent).toContain('Checking privileged access');
    await act(async () => { finish(true); await Promise.resolve(); });
    expect(host.textContent).not.toContain('Protected app');
    expect(host.textContent).toContain('Verify second factor');
  });
});
