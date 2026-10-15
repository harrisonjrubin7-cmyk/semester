// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignedInDevices } from './SignedInDevices';
import type { SessionRevocationReceipt, SessionRow } from '../lib/devices';

/**
 * The "where you are signed in" list in every state a student reaches it in:
 * loading, a failed read and the retry, only this device, several, ending one
 * (the preview, the cancel, the success, the failure, the one already gone).
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  act(() => { root = createRoot(host); });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36';
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1';
const here: SessionRow = { id: 'here', startedAt: '2026-10-04T12:00:00Z', lastActiveAt: '2026-10-06T12:00:00Z', userAgent: MAC, isCurrent: true };
const phone: SessionRow = { id: 'phone', startedAt: '2026-10-01T12:00:00Z', lastActiveAt: '2026-10-03T12:00:00Z', userAgent: PHONE, isCurrent: false };

const receipt = (outcome: SessionRevocationReceipt['outcome']): SessionRevocationReceipt => ({
  outcome,
  occurredAt: '2026-10-15T12:34:56.000Z',
});
const mount = async (
  list: () => Promise<SessionRow[]>,
  end: (id: string, requestKey: string) => Promise<SessionRevocationReceipt> = async () => receipt('revoked'),
) => {
  act(() => root.render(
    <SignedInDevices
      list={list}
      end={end}
      requestKey={() => 'request-key-1'}
      now={() => new Date('2026-10-15T12:00:00.000Z')}
    />,
  ));
  await flush();
};
const button = (label: string | RegExp) =>
  [...host.ownerDocument.querySelectorAll('button')].find((b) => (typeof label === 'string' ? b.textContent === label : label.test(b.getAttribute('aria-label') ?? b.textContent ?? '')))!;

/** The dialog's own confirm: the row buttons carry an aria-label, this one does not. */
const confirmButton = () =>
  [...host.ownerDocument.querySelectorAll('button')].find((b) => b.textContent === 'Sign out' && !b.getAttribute('aria-label'))!;

describe('SignedInDevices', () => {
  it('shows loading before the answer', () => {
    act(() => root.render(<SignedInDevices list={() => new Promise(() => {})} />));
    expect(host.textContent).toContain('your devices');
    expect(host.querySelector('ul')).toBeNull();
  });

  it('says this is the only device when it is, and offers no sign-out', async () => {
    await mount(async () => [here]);
    expect(host.textContent).toContain('Chrome on Mac');
    expect(host.textContent).toContain('This device');
    expect(host.textContent).toContain('the only device signed in');
    expect(host.querySelectorAll('li button')).toHaveLength(0);
    expect(host.textContent).toContain('Source: Semester account sessions');
    expect(host.textContent).toContain('checked');
  });

  it('renders an honest empty answer with its checked source', async () => {
    await mount(async () => []);
    expect(host.textContent).toContain('No sessions were found for this account.');
    expect(host.textContent).toContain('Source: Semester account sessions');
    expect(host.textContent).not.toContain('the only device signed in');
  });

  it('lists every device, marks this one, and gives the others a named button', async () => {
    await mount(async () => [here, phone]);
    expect(host.querySelectorAll('li')).toHaveLength(2);
    expect(host.textContent).not.toContain('the only device');
    const buttons = host.querySelectorAll('li button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute('aria-label')).toMatch(/^Sign out Safari on iPhone, signed in /);
  });

  it('keeps rendering when one session has invalid dates', async () => {
    await mount(async () => [{ ...phone, startedAt: 'raw-secret-date', lastActiveAt: '' }, here]);
    expect(host.querySelectorAll('li')).toHaveLength(2);
    expect(host.textContent).toContain('Time unavailable');
    expect(host.textContent).not.toContain('raw-secret-date');
  });

  it('a failed read is a way back, never "only this device"; retrying reads again', async () => {
    const list = vi.fn<() => Promise<SessionRow[]>>().mockRejectedValueOnce(new Error('down'));
    await mount(list);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Could not list your devices');
    expect(host.textContent).not.toContain('the only device');
    list.mockResolvedValueOnce([here]);
    act(() => button('Try again').click());
    await flush();
    expect(list).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('the only device');
  });

  it('asks first, says what it does not do and when it stops, and cancel ends nothing', async () => {
    const end = vi.fn(async () => receipt('revoked'));
    await mount(async () => [here, phone], end);
    act(() => button(/^Sign out Safari on iPhone/).click());
    const dialog = host.ownerDocument.body.textContent ?? '';
    expect(dialog).toContain('Sign out Safari on iPhone?');
    expect(dialog).toContain('up to an hour');
    expect(dialog).toContain('This device stays signed in');
    act(() => button('Cancel').click());
    expect(end).not.toHaveBeenCalled();
  });

  it('Escape closes the confirmation and returns focus to the named trigger', async () => {
    const end = vi.fn(async () => receipt('revoked'));
    await mount(async () => [here, phone], end);
    const trigger = button(/^Sign out Safari on iPhone/);
    trigger.focus();
    act(() => trigger.click());
    await flush();
    const dialog = host.ownerDocument.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(host.ownerDocument.activeElement?.textContent).toBe('Cancel');
    act(() => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await flush();
    expect(host.ownerDocument.querySelector('[role="dialog"]')).toBeNull();
    expect(host.ownerDocument.activeElement).toBe(trigger);
    expect(end).not.toHaveBeenCalled();
  });

  it('announces and disables the row while the bounded command is pending', async () => {
    let settle!: (value: SessionRevocationReceipt) => void;
    const end = vi.fn(() => new Promise<SessionRevocationReceipt>((resolve) => { settle = resolve; }));
    await mount(async () => [here, phone], end);
    act(() => button(/^Sign out Safari on iPhone/).click());
    act(() => confirmButton().click());
    await flush();
    const pending = button(/^Sign out Safari on iPhone/);
    expect(pending.disabled).toBe(true);
    expect(pending.textContent).toContain('Signing out');
    expect(pending.closest('[aria-busy="true"]')).not.toBeNull();
    expect(host.textContent).toContain('Checking whether Safari on iPhone signed out');
    await act(async () => { settle(receipt('revoked')); await Promise.resolve(); });
  });

  it('confirming ends that session only, says when it stops, and reads the list again', async () => {
    const end = vi.fn(async () => receipt('revoked'));
    const list = vi.fn<() => Promise<SessionRow[]>>().mockResolvedValueOnce([here, phone]).mockResolvedValueOnce([here]);
    await mount(list, end);
    act(() => button(/^Sign out Safari on iPhone/).click());
    act(() => confirmButton().click());
    await flush();
    expect(end).toHaveBeenCalledExactlyOnceWith('phone', 'request-key-1');
    const said = [...host.querySelectorAll('[role="status"]')].map((n) => n.textContent ?? '');
    expect(said.some((t) => /Safari on iPhone is signed out\. It stops working within the hour/.test(t))).toBe(true);
    expect(list).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('the only device');
  });

  it('a session that was already gone is said to have signed out, not to have been signed out by us', async () => {
    const end = vi.fn(async () => receipt('already_ended'));
    await mount(async () => [here, phone], end);
    act(() => button(/^Sign out Safari on iPhone/).click());
    act(() => confirmButton().click());
    await flush();
    expect(host.textContent).toContain('had already signed out');
    expect(host.textContent).not.toContain('is signed out');
  });

  it('a definite refusal claims no success and exposes no identifiers', async () => {
    const end = vi.fn(async () => receipt('refused'));
    await mount(async () => [here, phone], end);
    act(() => button(/^Sign out Safari on iPhone/).click());
    act(() => confirmButton().click());
    await flush();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('was not signed out');
    expect(host.textContent).not.toContain('phone');
    expect(host.textContent).not.toContain('is signed out');
  });

  it('an unknown outcome shows fixed recovery copy and retries the identical key', async () => {
    const raw = 'provider secret account-123 session-phone cursor-456';
    const end = vi.fn<(id: string, requestKey: string) => Promise<SessionRevocationReceipt>>()
      .mockRejectedValueOnce(new Error(raw))
      .mockResolvedValueOnce(receipt('revoked'));
    const list = vi.fn<() => Promise<SessionRow[]>>()
      .mockResolvedValueOnce([here, phone])
      .mockResolvedValueOnce([here]);
    await mount(list, end);
    act(() => button(/^Sign out Safari on iPhone/).click());
    act(() => confirmButton().click());
    await flush();
    const alert = host.querySelector('[role="alert"]')?.textContent ?? '';
    expect(alert).toContain("couldn't confirm");
    expect(alert).toContain('may or may not have signed out');
    expect(host.textContent).not.toContain(raw);
    expect(host.textContent).not.toContain('account-123');
    expect(host.textContent).not.toContain('cursor-456');
    act(() => button('Check again').click());
    await flush();
    expect(end).toHaveBeenNthCalledWith(1, 'phone', 'request-key-1');
    expect(end).toHaveBeenNthCalledWith(2, 'phone', 'request-key-1');
    expect(host.textContent).toContain('Safari on iPhone is signed out');
  });
});
