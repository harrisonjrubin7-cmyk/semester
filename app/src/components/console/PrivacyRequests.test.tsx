// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type {
  ApprovalInput,
  PrivacyRequest,
  PrivacyRequestDetail,
  PrivacyRequestOutcome,
  PrivacyResolution,
} from '../../lib/console/client';
import { when } from './Fields';
import { PrivacyRequests } from './PrivacyRequests';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const request = (overrides: Partial<PrivacyRequest> = {}): PrivacyRequest => ({
  requestId: 'request-1',
  requestRef: 'DSR-1234567890',
  tenantId: 'vu',
  tenantName: 'Vanderbilt University',
  isDemo: false,
  kind: 'erasure',
  requestedBy: 'self',
  status: 'received',
  receivedAt: '2026-10-01T10:00:00Z',
  dueAt: '2026-10-31T10:00:00Z',
  overdue: false,
  identityState: 'unverified',
  assignedTo: null,
  assignedAt: null,
  assignedToMe: false,
  holdState: 'clear',
  affectedStores: ['erasable account records', 'retained audit history'],
  deletionApprovalId: null,
  deletionApprovalStatus: null,
  classification: 'restricted',
  provenance: 'public.data_subject_request + public.legal_holds',
  limitation: 'Metadata only. Detail requires a separate audited read.',
  ...overrides,
});

const detail: PrivacyRequestDetail = {
  requestRef: 'DSR-1234567890',
  subjectReference: 'ab'.repeat(32),
  kind: 'erasure',
  requestedBy: 'self',
  detail: 'Delete eligible account data.',
  tenantId: 'vu',
  verifiedAt: null,
  resolution: '',
  resolutionEvidence: null,
  completionCertificateId: null,
};

let host: HTMLDivElement;
let root: Root;
let status: Mock<(message: string) => void>;
let privileged: Mock<(run: () => Promise<void>) => void>;
let read: Mock<(includeDemo?: boolean) => Promise<PrivacyRequest[]>>;
let claim: Mock<(requestId: string) => Promise<string>>;
let readDetail: Mock<(requestId: string) => Promise<PrivacyRequestDetail>>;
let verify: Mock<(requestId: string, basis: string, evidence: string) => Promise<string>>;
let resolve: Mock<(requestId: string, outcome: PrivacyRequestOutcome, resolution: string, evidence: string, approvalId?: string | null) => Promise<PrivacyResolution>>;
let requestDeletionApproval: Mock<(input: ApprovalInput) => Promise<string>>;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  status = vi.fn();
  privileged = vi.fn((run) => { void run(); });
  read = vi.fn(async () => [request()]);
  claim = vi.fn(async () => 'verifying');
  readDetail = vi.fn(async () => detail);
  verify = vi.fn(async () => 'in_progress');
  resolve = vi.fn(async () => ({ status: 'completed', certificateId: 'certificate-1' }));
  requestDeletionApproval = vi.fn(async () => 'approval-1');
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function draw(rows?: PrivacyRequest[]) {
  if (rows) read.mockResolvedValue(rows);
  await act(async () => {
    root.render(
      <PrivacyRequests
        env="Production"
        scope="All"
        filter=""
        onStatus={status}
        privileged={privileged}
        read={read}
        claim={claim}
        readDetail={readDetail}
        verify={verify}
        resolve={resolve}
        requestDeletionApproval={requestDeletionApproval}
      />,
    );
  });
  await act(async () => {});
}

const buttons = () => [...host.querySelectorAll('button')];
const button = (label: string) => buttons().find((item) => item.textContent?.trim() === label) as HTMLButtonElement | undefined;

async function press(label: string) {
  const target = button(label);
  if (!target) throw new Error(`No button ${label}`);
  await act(async () => target.click());
  await act(async () => {});
}

function field(label: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  const wrapper = [...host.querySelectorAll('label')].find((item) => item.textContent?.trim().startsWith(label));
  const control = wrapper?.querySelector('input, textarea, select');
  if (!control) throw new Error(`No field ${label}`);
  return control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
}

function type(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto = control instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : control instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(control, value);
    control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

async function submit(label: string) {
  const form = host.querySelector(`form[aria-label="${label}"]`);
  if (!form) throw new Error(`No form ${label}`);
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await act(async () => {});
}

describe('privacy request workspace', () => {
  it('renders metadata without fetching subject identity or request detail', async () => {
    const item = request({ overdue: true });
    await draw([item]);
    expect(host.textContent).toContain('DSR-1234567890 · Erasure');
    expect(host.textContent).toContain(`Due${when(item.dueAt)}`);
    expect(host.textContent).toContain('OVERDUE');
    expect(host.textContent).toContain('OwnerUnassigned');
    expect(host.textContent).toContain('Affected storeserasable account records · retained audit history');
    expect(host.textContent).toContain('Metadata only. Detail requires a separate audited read.');
    expect(host.textContent).not.toContain('Delete eligible account data.');
    expect(readDetail).not.toHaveBeenCalled();
  });

  it('fails closed when the queue is denied', async () => {
    read.mockRejectedValue(new Error('data_request:handle over an exact school is required.'));
    await draw();
    expect(host.textContent).toContain('Access denied.');
    expect(host.textContent).not.toContain('DSR-');
    expect(readDetail).not.toHaveBeenCalled();
  });

  it('purges the queue and sensitive detail when access is revoked on refresh', async () => {
    await draw([request({ assignedTo: 'op-1', assignedToMe: true, status: 'verifying' })]);
    await press('Open case');
    await press('View request detail');
    expect(host.textContent).toContain('Delete eligible account data.');

    read.mockRejectedValueOnce(new Error('data_request:handle over an exact school is required.'));
    await press('Refresh privacy requests');

    expect(host.textContent).toContain('Access denied.');
    expect(host.textContent).not.toContain('DSR-1234567890');
    expect(host.textContent).not.toContain('Delete eligible account data.');
    expect(host.textContent).not.toContain(detail.subjectReference);
  });

  it('claims through the privileged boundary and never opens detail implicitly', async () => {
    await draw();
    await press('Claim request');
    expect(privileged).toHaveBeenCalledOnce();
    expect(claim).toHaveBeenCalledWith('request-1');
    expect(readDetail).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(expect.stringContaining('is assigned to you'));
  });

  it('requires an explicit audited detail read before offering verification', async () => {
    await draw([request({ assignedTo: 'op-1', assignedToMe: true, assignedAt: '2026-10-03T10:00:00Z', status: 'verifying' })]);
    await press('Open case');
    expect(host.querySelector('form[aria-label="Verify DSR-1234567890"]')).toBeNull();
    await press('View request detail');
    expect(privileged).toHaveBeenCalledOnce();
    expect(readDetail).toHaveBeenCalledWith('request-1');
    expect(host.textContent).toContain('Delete eligible account data.');
    expect(host.textContent).toContain('Subject reference');

    type(field('Verification basis'), 'signed-in account holder');
    type(field('Verification evidence reference'), 'case://verify-1');
    await submit('Verify DSR-1234567890');
    expect(verify).toHaveBeenCalledWith('request-1', 'signed-in account holder', 'case://verify-1');
  });

  it('discards a late sensitive response after the operator changes cases', async () => {
    let finish!: (value: PrivacyRequestDetail) => void;
    readDetail.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await draw([
      request({ assignedTo: 'op-1', assignedToMe: true, status: 'verifying' }),
      request({ requestId: 'request-2', requestRef: 'DSR-0987654321', assignedTo: 'op-1', assignedToMe: true, status: 'verifying' }),
    ]);
    const openButtons = () => buttons().filter((item) => item.textContent?.trim() === 'Open case');
    await act(async () => openButtons()[0]?.click());
    await act(async () => button('View request detail')?.click());
    await act(async () => button('Close case')?.click());
    await act(async () => openButtons()[1]?.click());
    await act(async () => finish(detail));
    expect(host.textContent).not.toContain('Delete eligible account data.');
    expect(host.textContent).toContain('DSR-0987654321');
  });

  it('creates an exact-request deletion approval without treating it as executed', async () => {
    await draw([request({
      assignedTo: 'op-1', assignedToMe: true, status: 'in_progress', identityState: 'verified',
    })]);
    await press('Open case');
    await press('View request detail');
    type(field('Deletion evidence'), 'Verified request and store-by-store deletion plan.');
    type(field('Change or case ticket'), 'PRIV-100');
    await submit('Deletion approval DSR-1234567890');
    expect(requestDeletionApproval).toHaveBeenCalledWith({
      dutyId: 'data-deletion',
      tenantId: 'vu',
      target: 'request-1',
      detail: {
        request_ref: 'DSR-1234567890',
        affected_stores: ['erasable account records', 'retained audit history'],
      },
      evidence: 'Verified request and store-by-store deletion plan.',
      ticket: 'PRIV-100',
    });
    expect(status).toHaveBeenCalledWith(expect.stringContaining('execution remains separate'));
  });

  it.each(['pending', 'approved', 'executed'] as const)('does not duplicate a %s deletion approval', async (approvalStatus) => {
    await draw([request({
      assignedTo: 'op-1', assignedToMe: true, status: 'in_progress', identityState: 'verified',
      deletionApprovalId: 'approval-1', deletionApprovalStatus: approvalStatus,
    })]);
    await press('Open case');
    await press('View request detail');
    expect(host.querySelector('form[aria-label="Deletion approval DSR-1234567890"]')).toBeNull();
  });

  it.each(['rejected', 'expired'] as const)('allows a replacement after a %s deletion approval', async (approvalStatus) => {
    await draw([request({
      assignedTo: 'op-1', assignedToMe: true, status: 'in_progress', identityState: 'verified',
      deletionApprovalId: 'approval-1', deletionApprovalStatus: approvalStatus,
    })]);
    await press('Open case');
    await press('View request detail');
    expect(host.querySelector('form[aria-label="Deletion approval DSR-1234567890"]')).not.toBeNull();
  });

  it('rejects invalid deletion-ticket characters before submission', async () => {
    await draw([request({
      assignedTo: 'op-1', assignedToMe: true, status: 'in_progress', identityState: 'verified',
    })]);
    await press('Open case');
    await press('View request detail');
    type(field('Deletion evidence'), 'Verified request and store-by-store deletion plan.');
    type(field('Change or case ticket'), 'PRIV/100');
    expect(button('Record approval request')?.disabled).toBe(true);
    expect(requestDeletionApproval).not.toHaveBeenCalled();
  });

  it('blocks held erasure completion but permits a reasoned refusal', async () => {
    await draw([request({
      assignedTo: 'op-1', assignedToMe: true, status: 'in_progress', identityState: 'verified',
      holdState: 'live_hold', deletionApprovalId: 'approval-1', deletionApprovalStatus: 'executed',
    })]);
    await press('Open case');
    await press('View request detail');
    type(field('Resolution'), 'Cannot erase while the legal hold remains active.');
    type(field('Evidence reference'), 'case://held-1');
    expect(button('Complete and issue certificate')?.disabled).toBe(true);
    type(field('Outcome'), 'refused');
    expect(button('Record refusal')?.disabled).toBe(false);
    await submit('Resolve DSR-1234567890');
    expect(resolve).toHaveBeenCalledWith(
      'request-1', 'refused', 'Cannot erase while the legal hold remains active.', 'case://held-1', null,
    );
  });

  it('uses the executed exact approval for completion and reports the certificate', async () => {
    await draw([request({
      assignedTo: 'op-1', assignedToMe: true, status: 'in_progress', identityState: 'verified',
      deletionApprovalId: 'approval-1', deletionApprovalStatus: 'executed',
    })]);
    await press('Open case');
    await press('View request detail');
    type(field('Resolution'), 'Eligible data erased and propagation recorded.');
    type(field('Evidence reference'), 'case://erase-1');
    await submit('Resolve DSR-1234567890');
    expect(resolve).toHaveBeenCalledWith(
      'request-1', 'completed', 'Eligible data erased and propagation recorded.', 'case://erase-1', 'approval-1',
    );
    expect(status).toHaveBeenCalledWith(expect.stringContaining('immutable certificate certificate-1'));
  });

  it.each(['completed', 'refused'])('keeps a %s request read-only', async (requestStatus) => {
    await draw([request({ status: requestStatus, assignedTo: 'op-1', assignedToMe: true, identityState: 'verified' })]);
    await press('Open case');
    expect(button('Claim request')).toBeUndefined();
    expect(host.querySelector(`form[aria-label="Verify DSR-1234567890"]`)).toBeNull();
    expect(host.querySelector(`form[aria-label="Resolve DSR-1234567890"]`)).toBeNull();
  });
});
