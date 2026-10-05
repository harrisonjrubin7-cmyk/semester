// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The step in front of a privileged action: enrol when there is no
 * authenticator, challenge when there is one, and never call back until the
 * auth service accepted a code.
 */

const mock = vi.hoisted(() => ({
  factors: vi.fn(),
  enroll: vi.fn(),
  challenge: vi.fn(),
  verify: vi.fn(),
}));

vi.mock('../lib/console/client', () => ({
  totpFactors: mock.factors,
  enrollTotp: mock.enroll,
  challengeTotp: mock.challenge,
  verifyTotp: mock.verify,
}));

import { MfaStep } from './MfaStep';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
const onVerified = vi.fn();
const onCancel = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mock.factors.mockResolvedValue([]);
  mock.enroll.mockResolvedValue({ factorId: 'f-new', qrCode: 'data:image/svg+xml;utf-8,<svg/>', secret: 'JBSWY3DP', uri: 'otpauth://totp/x' });
  mock.challenge.mockResolvedValue('ch-1');
  mock.verify.mockResolvedValue(undefined);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function render() {
  await act(async () => {
    root.render(<MfaStep onVerified={onVerified} onCancel={onCancel} />);
  });
}

function typeCode(value: string) {
  const input = host.querySelector('input') as HTMLInputElement;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function submit() {
  await act(async () => {
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

const button = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;

describe('MfaStep', () => {
  it('enrols an authenticator when the account has none, showing the QR code and the secret', async () => {
    await render();
    expect(mock.enroll).toHaveBeenCalledTimes(1);
    expect(host.querySelector('img')?.getAttribute('src')).toBe('data:image/svg+xml;utf-8,<svg/>');
    expect(host.textContent).toContain('JBSWY3DP');
    expect(button('Enrol and verify')).toBeTruthy();
    expect(button('Enrol and verify').disabled).toBe(true);
    typeCode('123456');
    expect(button('Enrol and verify').disabled).toBe(false);
    await submit();
    expect(mock.challenge).toHaveBeenCalledWith('f-new');
    expect(mock.verify).toHaveBeenCalledWith('f-new', 'ch-1', '123456');
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it('challenges the existing authenticator without enrolling another', async () => {
    mock.factors.mockResolvedValue([{ id: 'f-old', name: 'Phone' }]);
    await render();
    expect(mock.enroll).not.toHaveBeenCalled();
    expect(host.querySelector('img')).toBeNull();
    expect(button('Verify')).toBeTruthy();
    typeCode('654321');
    await submit();
    expect(mock.challenge).toHaveBeenCalledWith('f-old');
    expect(mock.verify).toHaveBeenCalledWith('f-old', 'ch-1', '654321');
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it('does not call back on a refused code, and says why', async () => {
    mock.factors.mockResolvedValue([{ id: 'f-old', name: 'Phone' }]);
    mock.verify.mockRejectedValue(new Error('Invalid TOTP code entered'));
    await render();
    typeCode('000000');
    await submit();
    expect(onVerified).not.toHaveBeenCalled();
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Invalid TOTP code entered');
  });

  it('gives every control a name and offers a way out', async () => {
    mock.factors.mockResolvedValue([{ id: 'f-old', name: 'Phone' }]);
    await render();
    const input = host.querySelector('input') as HTMLInputElement;
    expect(input.closest('label')?.textContent).toContain('Code from your authenticator');
    act(() => button('Cancel').click());
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mock.verify).not.toHaveBeenCalled();
  });

  it('says so when the auth service cannot start the step', async () => {
    mock.factors.mockRejectedValue(new Error('Could not list your authenticators.'));
    await render();
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Could not list your authenticators.');
    expect(host.querySelector('form')).toBeNull();
  });
});
