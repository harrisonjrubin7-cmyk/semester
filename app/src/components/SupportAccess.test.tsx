// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupportAccess } from './SupportAccess';

const mock = vi.hoisted(() => ({
  load: vi.fn(),
  create: vi.fn(),
  revoke: vi.fn(),
  read: vi.fn(),
}));

vi.mock('../lib/support-access', () => ({
  loadSupportAccess: mock.load,
  createSupportAccess: mock.create,
  revokeSupportAccess: mock.revoke,
  readSupportSignals: mock.read,
}));

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

async function renderSignedIn() {
  await act(async () => {
    root.render(<SupportAccess account={{ id: 'me', email: 'me@example.edu', via: 'email' }} />);
  });
}

function changeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

describe('consented support access surface', () => {
  it('keeps signed-out visitors at no access', () => {
    act(() => root.render(<SupportAccess account={null} />));
    expect(host.textContent).toContain('The default is no access');
    expect(host.textContent).toContain('Sign in with your university-linked Semester account');
    expect(mock.load).not.toHaveBeenCalled();
  });

  it('lets a student see and immediately revoke only their named window', async () => {
    mock.load.mockResolvedValue({
      supporters: [{ supporterId: 'staff', label: 'Advisor Rivera' }],
      windows: [{
        grantId: 'grant-1', side: 'student', counterpartLabel: 'Advisor Rivera',
        reason: 'Help me review the pattern.', expiresAt: '2099-01-02T00:00:00Z',
        revokedAt: null, createdAt: '2099-01-01T00:00:00Z',
      }],
    });
    mock.revoke.mockResolvedValue(undefined);
    await renderSignedIn();
    expect(host.textContent).toContain('Advisor Rivera');
    expect(host.textContent).toContain('You granted access');
    expect(host.textContent).not.toContain('View aggregate signals');
    const revoke = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Revoke now');
    await act(async () => { revoke?.click(); });
    expect(mock.revoke).toHaveBeenCalledWith('grant-1');
    expect(host.textContent).toContain('Support access revoked');
  });

  it('creates a bounded window and keeps the success confirmation visible', async () => {
    mock.load.mockResolvedValue({
      supporters: [{ supporterId: 'staff', label: 'Advisor Rivera' }],
      windows: [],
    });
    mock.create.mockResolvedValue(undefined);
    await renderSignedIn();

    const reason = host.querySelector('textarea');
    const [supporter, duration] = [...host.querySelectorAll('select')];
    const form = host.querySelector('form');
    await act(async () => {
      if (supporter) changeValue(supporter, 'staff');
      if (reason) changeValue(reason, 'Help me make a recovery plan.');
      if (duration) changeValue(duration, '3');
    });
    await act(async () => { form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });

    expect(mock.create).toHaveBeenCalledWith('staff', 'Help me make a recovery plan.', 3);
    expect(host.textContent).toContain('Support access created');
  });

  it('gives the named supporter aggregates but never raw mistake detail', async () => {
    mock.load.mockResolvedValue({
      supporters: [],
      windows: [{
        grantId: 'grant-2', side: 'supporter', counterpartLabel: 'Student Avery',
        reason: 'Help me review the pattern.', expiresAt: '2099-01-02T00:00:00Z',
        revokedAt: null, createdAt: '2099-01-01T00:00:00Z',
      }],
    });
    mock.read.mockResolvedValue([{
      courseId: 'ECON', evidenceCount: 4, averageScore: 0.75,
      mistakeCount: 2, lastObservedAt: '2099-01-01T00:00:00Z',
    }]);
    await renderSignedIn();
    const view = [...host.querySelectorAll('button')].find((button) => button.textContent === 'View aggregate signals');
    await act(async () => { view?.click(); });
    expect(mock.read).toHaveBeenCalledWith('grant-2');
    expect(host.textContent).toContain('4 evidence items');
    expect(host.textContent).toContain('2 mistakes');
    expect(host.textContent).toContain('average 75%');
    expect(host.textContent).not.toContain('Private detail');
    expect(host.textContent).not.toContain('Revoke now');
  });
});
