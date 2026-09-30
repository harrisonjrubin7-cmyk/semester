// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { passwordProblem, PASSWORD_FLOOR } from '../lib/password';
import { AccountSecurity, RecoveryDialog } from './AccountSecurity';

/**
 * Full-beta G-02: a reset link lands on a screen of the app's own, under the
 * same password floor as sign-up; a signed-in account can change its password
 * and address; and signing out other devices is a preview and a confirmation.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const byLabel = (text: string) => {
  const label = [...document.querySelectorAll('label')].find((l) => l.textContent?.trim() === text);
  return label ? (document.getElementById(label.htmlFor) as HTMLInputElement) : null;
};
const button = (name: RegExp, within: ParentNode = document) =>
  [...within.querySelectorAll('button')].find((b) => name.test(b.textContent ?? '')) as HTMLButtonElement | undefined;

async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function click(b: HTMLButtonElement | undefined) {
  expect(b).toBeTruthy();
  await act(async () => {
    b!.click();
    await Promise.resolve();
  });
}

describe('the password floor', () => {
  it('is one number, applied to a chosen password', () => {
    expect(passwordProblem('a'.repeat(PASSWORD_FLOOR - 1))).toMatch(/at least/i);
    expect(passwordProblem('a'.repeat(PASSWORD_FLOOR))).toBeNull();
  });
});

describe('the recovery dialog', () => {
  it('stays closed until a reset link has been followed, then sets the password', async () => {
    let fire: () => void = () => {};
    const watch = (fn: () => void) => {
      fire = fn;
      return () => {};
    };
    const setPassword = vi.fn(async () => 'Your password is changed.');
    await act(async () => root.render(<RecoveryDialog watch={watch} setPassword={setPassword} />));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => fire());
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toMatch(/new password/i);
    await type(byLabel('New password')!, 'correct horse');
    await type(byLabel('New password again')!, 'correct horse');
    await click(button(/set password/i));
    expect(setPassword).toHaveBeenCalledWith('correct horse');
    expect(document.querySelector('[role="status"]')?.textContent).toMatch(/changed/);
  });
});

describe('account security', () => {
  it('refuses a short or mismatched password without calling the server', async () => {
    const setPassword = vi.fn(async () => 'x');
    await act(async () => root.render(<AccountSecurity setPassword={setPassword} />));
    await type(byLabel('New password')!, 'short');
    await type(byLabel('New password again')!, 'short');
    await click(button(/^change password$/i));
    expect(setPassword).not.toHaveBeenCalled();
    expect(byLabel('New password')!.getAttribute('aria-invalid')).toBe('true');
    await type(byLabel('New password')!, 'long enough one');
    await click(button(/^change password$/i));
    expect(setPassword).not.toHaveBeenCalled();
    expect(byLabel('New password again')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('asks for a confirmation link rather than claiming the address changed', async () => {
    const changeAddress = vi.fn(async (e: string) => `A confirmation link is on its way to ${e}.`);
    await act(async () => root.render(<AccountSecurity changeAddress={changeAddress} />));
    await type(byLabel('New email address')!, 'me@school.edu');
    await click(button(/send confirmation link/i));
    expect(changeAddress).toHaveBeenCalledWith('me@school.edu');
    await type(byLabel('New email address')!, 'not-an-address');
    await click(button(/send confirmation link/i));
    expect(changeAddress).toHaveBeenCalledTimes(1);
  });

  it('signs out other devices only after a preview and an explicit confirm', async () => {
    const signOutOthers = vi.fn(async () => 'done');
    await act(async () => root.render(<AccountSecurity signOutOthers={signOutOthers} />));
    await click(button(/^sign out other devices$/i));
    expect(signOutOthers).not.toHaveBeenCalled();
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog).toBeTruthy();
    await click(button(/sign out other devices/i, dialog));
    expect(signOutOthers).toHaveBeenCalledTimes(1);
  });

  it('cancel does nothing', async () => {
    const signOutOthers = vi.fn(async () => 'x');
    await act(async () => root.render(<AccountSecurity signOutOthers={signOutOthers} />));
    await click(button(/^sign out other devices$/i));
    await click(button(/^cancel$/i));
    expect(signOutOthers).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
