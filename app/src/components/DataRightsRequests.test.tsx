// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataRightsRequests } from './DataRightsRequests';

const mock = vi.hoisted(() => ({ load: vi.fn(), certificates: vi.fn(), file: vi.fn() }));
vi.mock('../lib/data-rights', async (original) => ({
  ...(await original<typeof import('../lib/data-rights')>()),
  loadDataRightRequests: mock.load,
  loadPrivacyCompletionCertificates: mock.certificates,
  fileDataRightRequest: mock.file,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  mock.certificates.mockResolvedValue([]);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const account = { id: 'student', email: 'student@example.edu', via: 'email' };
const open = {
  id: 'request-1', kind: 'correction' as const, status: 'received' as const,
  detail: 'My program is wrong.', receivedAt: '2026-09-30T12:00:00Z',
  dueAt: '2026-10-30T12:00:00Z', resolvedAt: null, resolution: '',
};

function changeValue(element: HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

describe('data-rights request surface', () => {
  it('does not imply a server request exists for a signed-out device-only student', () => {
    act(() => root.render(<DataRightsRequests account={null} />));
    expect(host.textContent).toContain('Device-only data never reached');
    expect(host.textContent).toContain('Filing does not silently change or delete anything');
    expect(mock.load).not.toHaveBeenCalled();
  });

  it('shows the request, its words, due date, and student note', async () => {
    mock.load.mockResolvedValue([open]);
    await act(async () => { root.render(<DataRightsRequests account={account} />); });
    expect(host.textContent).toContain('Correct account data');
    expect(host.textContent).toContain('Received');
    expect(host.textContent).toContain('Oct');
    expect(host.textContent).toContain('My program is wrong.');
  });

  it('files a bounded request and refreshes the account-backed queue', async () => {
    mock.load.mockResolvedValueOnce([]).mockResolvedValueOnce([open]);
    mock.file.mockResolvedValue({ item: open, created: true });
    await act(async () => { root.render(<DataRightsRequests account={account} />); });

    const select = host.querySelector('select');
    const detail = host.querySelector('textarea');
    await act(async () => {
      if (select) changeValue(select, 'correction');
      if (detail) changeValue(detail, 'My program is wrong.');
    });
    await act(async () => { host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });

    expect(mock.file).toHaveBeenCalledWith('correction', 'My program is wrong.');
    expect(mock.load).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('Request received');
  });

  it('says when an existing open request was returned instead of claiming a duplicate', async () => {
    mock.load.mockResolvedValue([open]);
    mock.file.mockResolvedValue({ item: open, created: false });
    await act(async () => { root.render(<DataRightsRequests account={account} />); });
    await act(async () => { host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(host.textContent).toContain('No duplicate was filed');
  });

  it('shows completion certificates owned by the signed-in student', async () => {
    mock.load.mockResolvedValue([]);
    mock.certificates.mockResolvedValue([{
      certificateId: 'certificate-1', requestRef: 'DSR-101', kind: 'export',
      evidenceReference: 'delivery://export-1', issuedAt: '2026-10-03T12:00:00Z',
    }]);
    await act(async () => { root.render(<DataRightsRequests account={account} />); });
    expect(host.textContent).toContain('Completion certificates · 1');
    expect(host.textContent).toContain('certificate-1');
    expect(host.textContent).toContain('delivery://export-1');
  });

  it('keeps request history visible when certificate retrieval fails', async () => {
    mock.load.mockResolvedValue([open]);
    mock.certificates.mockRejectedValue(new Error('Certificate reader unavailable.'));
    await act(async () => { root.render(<DataRightsRequests account={account} />); });
    expect(host.textContent).toContain('My program is wrong.');
    expect(host.textContent).toContain('privacy requests are available');
    expect(host.textContent).toContain('Certificate reader unavailable.');
    expect(host.textContent).not.toContain('Could not load privacy requests');
  });
});
