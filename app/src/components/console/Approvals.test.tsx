// @vitest-environment jsdom
import axe from 'axe-core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { ApprovalDecisionReceipt, ApprovalRequest, DutyRow } from '../../lib/console/client';
import { Approvals } from './Approvals';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const REQUEST_ID = '123e4567-e89b-12d3-a456-426614174000';

const duty = (overrides: Partial<DutyRow> = {}): DutyRow => ({
  id: 'integration-config',
  action: 'Change a production integration configuration',
  requester: 'role:engineering',
  approvers: ['role:security', 'role:founder'],
  twoPerson: true,
  evidence: 'Institution approval, data scope, fallback plan and credential expiry',
  ...overrides,
});

const request = (overrides: Partial<ApprovalRequest> = {}): ApprovalRequest => ({
  id: REQUEST_ID,
  dutyId: 'integration-config',
  requester: '00000000-0000-4000-8000-000000000001',
  tenantId: 'vu',
  tenantName: 'Vanderbilt University',
  isDemo: false,
  target: 'canvas-production',
  detail: { requested_change: 'rotate-reference', data_scope: ['courses', 'enrollments'] },
  evidence: 'institution=APP-17; fallback=RUNBOOK-9',
  ticket: 'CHG-44',
  status: 'pending',
  correlationId: 'corr-44',
  createdAt: '2026-10-12T10:00:00Z',
  expiresAt: '2026-10-19T10:00:00Z',
  decidedAt: null,
  executedAt: null,
  approvals: 0,
  rejections: 0,
  mine: false,
  decidedByMe: false,
  canDecide: true,
  ...overrides,
});

const receipt = (overrides: Partial<ApprovalDecisionReceipt> = {}): ApprovalDecisionReceipt => ({
  requestId: REQUEST_ID,
  approver: 'op-1',
  decision: 'approve',
  asParty: 'role:security',
  decidedAt: '2026-10-12T10:05:00Z',
  ...overrides,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}

let host: HTMLDivElement;
let root: Root;
let status: Mock<(message: string) => void>;
let readDuties: Mock<() => Promise<DutyRow[]>>;
let readRequests: Mock<() => Promise<ApprovalRequest[]>>;
let recordDecision: Mock<(requestId: string, decision: 'approve' | 'reject') => Promise<ApprovalRequest['status']>>;
let readReceipt: Mock<(requestId: string) => Promise<ApprovalDecisionReceipt>>;
let queueRefresh: Mock<() => void>;

beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  status = vi.fn();
  readDuties = vi.fn(async () => [duty()]);
  readRequests = vi.fn(async () => [request()]);
  recordDecision = vi.fn(async () => 'pending');
  readReceipt = vi.fn(async () => receipt());
  queueRefresh = vi.fn();
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  document.documentElement.style.fontSize = '';
});

async function draw(overrides: Partial<Parameters<typeof Approvals>[0]> = {}) {
  await act(async () => {
    root.render(
      <Approvals
        env="Production"
        scope="All"
        filter=""
        onStatus={status}
        privileged={(run) => void run()}
        reviewRequestId={REQUEST_ID}
        readDuties={readDuties}
        readRequests={readRequests}
        recordDecision={recordDecision}
        readReceipt={readReceipt}
        onQueueRefresh={queueRefresh}
        {...overrides}
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

describe('approval review workflow', () => {
  it('shows every stored consequence before confirm and cancel performs no write', async () => {
    await draw();

    expect(host.textContent).toContain('Change a production integration configuration');
    expect(host.textContent).toContain('canvas-production');
    expect(host.textContent).toContain('Vanderbilt University');
    expect(host.textContent).toContain('institution=APP-17; fallback=RUNBOOK-9');
    expect(host.textContent).toContain('Institution approval, data scope, fallback plan and credential expiry');
    expect(host.textContent).toContain('0 approved of 2 needed');
    expect(host.textContent).toContain('rotate-reference');
    expect(host.textContent).toContain('courses');

    await press('Approve');
    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Approve this request?');
    expect(dialog?.textContent).toContain('CHG-44');
    expect(dialog?.textContent).toContain('canvas-production');
    expect(dialog?.textContent).toContain('rotate-reference');
    expect(dialog?.textContent).toContain('does not execute the requested integration change');

    await press('Cancel');
    expect(recordDecision).not.toHaveBeenCalled();
    expect(readReceipt).not.toHaveBeenCalled();
  });

  it('renders and decides only the exact request while an exception review is active', async () => {
    readRequests.mockResolvedValue([
      request(),
      request({ id: '223e4567-e89b-12d3-a456-426614174000', ticket: 'CHG-OTHER', target: 'other-target' }),
    ]);
    await draw();

    expect(host.textContent).toContain('CHG-44');
    expect(host.textContent).not.toContain('CHG-OTHER');
    expect(host.textContent).not.toContain('other-target');
    expect(buttons().filter((item) => item.textContent?.trim() === 'Approve')).toHaveLength(1);
  });

  it('records one approval once, shows the authoritative own receipt, waits for a second person, and refreshes queues', async () => {
    readRequests
      .mockResolvedValueOnce([request()])
      .mockResolvedValue([request({ approvals: 1, decidedByMe: true })]);
    await draw();

    await press('Approve');
    const confirm = button('Record approval');
    if (!confirm) throw new Error('No confirm button');
    await act(async () => {
      confirm.click();
      confirm.click();
    });
    await act(async () => {});

    expect(recordDecision).toHaveBeenCalledTimes(1);
    expect(recordDecision).toHaveBeenCalledWith(REQUEST_ID, 'approve');
    expect(readReceipt).toHaveBeenCalledWith(REQUEST_ID);
    expect(host.textContent).toContain('Your approval is recorded. Waiting for a second person’s decision.');
    expect(host.textContent).toContain('role:security');
    expect(host.textContent).toContain('op-1');
    expect(host.textContent).not.toContain('Record approval');
    expect(queueRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows approved and rejected terminal decision states without claiming execution', async () => {
    recordDecision.mockResolvedValueOnce('approved');
    readRequests
      .mockResolvedValueOnce([request({ approvals: 1 })])
      .mockResolvedValue([request({ status: 'approved', approvals: 2, decidedByMe: true })]);
    await draw();
    await press('Approve');
    await press('Record approval');
    expect(host.textContent).toContain('Approved — required decisions recorded.');
    expect(host.textContent).toContain('The requested change has not been executed.');

    await act(async () => root.unmount());
    root = createRoot(host);
    recordDecision.mockResolvedValueOnce('rejected');
    readReceipt.mockResolvedValueOnce(receipt({ decision: 'reject' }));
    readRequests
      .mockResolvedValueOnce([request()])
      .mockResolvedValue([request({ status: 'rejected', rejections: 1, decidedByMe: true })]);
    await draw();
    await press('Reject');
    await press('Record rejection');
    expect(host.textContent).toContain('Rejected — the rejection is recorded.');
    expect(host.textContent).toContain('The requested change has not been executed.');
  });

  it.each([
    ['self', request({ mine: true, canDecide: false })],
    ['expired', request({ status: 'expired', canDecide: false })],
    ['already decided', request({ approvals: 1, decidedByMe: true, canDecide: true })],
  ])('does not offer a decision for %s requests', async (_name, row) => {
    readRequests.mockResolvedValue([row]);
    await draw();
    expect(button('Approve')).toBeUndefined();
    expect(button('Reject')).toBeUndefined();
  });

  it('reads and shows the caller receipt when the exact request already says they decided', async () => {
    readRequests.mockResolvedValue([request({ approvals: 1, decidedByMe: true })]);
    await draw();

    expect(readReceipt).toHaveBeenCalledExactlyOnceWith(REQUEST_ID);
    expect(host.querySelector('[aria-label="Your authoritative decision receipt"]')).not.toBeNull();
    expect(host.textContent).toContain('Your approval is recorded. Waiting for a second person’s decision.');
    expect(button('Approve')).toBeUndefined();
  });

  it('keeps an unavailable existing receipt explicit and retryable', async () => {
    readRequests.mockResolvedValue([request({ approvals: 1, decidedByMe: true })]);
    readReceipt
      .mockRejectedValueOnce(new Error('row-level security denied the receipt read'))
      .mockResolvedValueOnce(receipt());
    await draw();

    expect(host.textContent).toContain('Decision receipt unavailable');
    expect(host.textContent).toContain('row-level security denied the receipt read');
    await press('Check decision status');
    expect(readReceipt).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[aria-label="Your authoritative decision receipt"]')).not.toBeNull();
  });

  it('does not write or queue anything while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    await draw();
    expect(host.textContent).toContain('Decision unavailable while offline. Nothing is queued.');
    expect(button('Approve')?.disabled).toBe(true);
    expect(button('Reject')?.disabled).toBe(true);
    expect(recordDecision).not.toHaveBeenCalled();
  });

  it('re-checks connectivity when confirmation is submitted after going offline', async () => {
    const privileged = vi.fn<(run: () => Promise<void>) => void>();
    await draw({ privileged });
    await press('Approve');
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    await act(async () => window.dispatchEvent(new Event('offline')));
    await press('Record approval');

    expect(privileged).not.toHaveBeenCalled();
    expect(recordDecision).not.toHaveBeenCalled();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(status).toHaveBeenCalledWith('Decision unavailable while offline. Nothing was written or queued.');
  });

  it('drops queued MFA work if connectivity is lost before the callback dispatches', async () => {
    let queued: (() => Promise<void>) | undefined;
    await draw({ privileged: (run) => { queued = run; } });
    await press('Approve');
    await press('Record approval');
    expect(queued).toBeDefined();

    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    await act(async () => window.dispatchEvent(new Event('offline')));
    await act(async () => queued?.());

    expect(recordDecision).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith('Decision unavailable while offline. Nothing was written or queued.');

    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    await act(async () => window.dispatchEvent(new Event('online')));
    expect(button('Approve')?.disabled).toBe(false);
  });

  it('treats a failed decision transport as uncertain and reconciles status without repeating the write', async () => {
    recordDecision.mockRejectedValueOnce(new Error('Network response was lost'));
    readReceipt.mockResolvedValueOnce(receipt());
    readRequests
      .mockResolvedValueOnce([request()])
      .mockResolvedValue([request({ approvals: 1, decidedByMe: true })]);
    await draw();
    await press('Approve');
    await press('Record approval');

    expect(host.textContent).toContain('The decision result is uncertain. Check decision status before doing anything else.');
    expect(status).toHaveBeenCalledWith(expect.stringContaining('Network response was lost'));
    expect(button('Approve')).toBeUndefined();
    expect(recordDecision).toHaveBeenCalledTimes(1);

    await press('Check decision status');
    expect(readReceipt).toHaveBeenCalledTimes(1);
    expect(recordDecision).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Your approval is recorded. Waiting for a second person’s decision.');
  });

  it('does not infer reconciliation when the exact request disappears from the refreshed capped result', async () => {
    recordDecision.mockRejectedValueOnce(new Error('Network response was lost'));
    readRequests.mockResolvedValueOnce([request()]).mockResolvedValueOnce([]);
    await draw();
    await press('Approve');
    await press('Record approval');
    await press('Check decision status');

    expect(host.textContent).toContain('This approval is unavailable in the authorized result.');
    expect(status).not.toHaveBeenCalledWith('Decision status reconciled from the caller receipt and current request.');
    expect(queueRefresh).not.toHaveBeenCalled();
    expect(recordDecision).toHaveBeenCalledTimes(1);
  });

  it('renders missing and failed capped reads as unavailable with retry, never as resolved', async () => {
    readRequests.mockResolvedValueOnce([]).mockResolvedValueOnce([request()]);
    await draw();
    expect(host.textContent).toContain('This approval is unavailable in the authorized result.');
    expect(host.textContent).not.toContain('Approved — required decisions recorded.');
    await press('Retry approval review');
    expect(host.querySelector(`[data-approval-request="${REQUEST_ID}"]`)).not.toBeNull();

    await act(async () => root.unmount());
    root = createRoot(host);
    readRequests.mockRejectedValueOnce(new Error('row-level security denied the read'));
    await draw();
    expect(host.textContent).toContain('row-level security denied the read');
    expect(host.textContent).toContain('Approval review unavailable');
  });

  it('drops a queued privileged callback when its review unmounts', async () => {
    let queued: (() => Promise<void>) | undefined;
    await draw({ privileged: (run) => { queued = run; } });
    await press('Approve');
    await press('Record approval');
    expect(queued).toBeDefined();

    await act(async () => root.unmount());
    await queued?.();
    expect(recordDecision).not.toHaveBeenCalled();
  });

  it('drops an account-bound request response after the review unmounts', async () => {
    const pending = deferred<ApprovalRequest[]>();
    const found = vi.fn();
    readRequests.mockReturnValueOnce(pending.promise);
    await draw({ onReviewFound: found });

    await act(async () => root.unmount());
    pending.resolve([request()]);
    await act(async () => {});

    expect(found).not.toHaveBeenCalled();
    expect(host.textContent).toBe('');
  });

  it('keeps the review and confirmation accessible under narrow, 200% text reflow', async () => {
    vi.stubGlobal('innerWidth', 320);
    document.documentElement.style.fontSize = '32px';
    await draw();
    await press('Approve');

    const detail = host.querySelector('pre') as HTMLElement;
    expect(detail.style.whiteSpace).toBe('pre-wrap');
    expect(detail.style.overflowWrap).toBe('anywhere');
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    const result = await axe.run(host, { rules: { 'color-contrast': { enabled: false } }, resultTypes: ['violations'] });
    expect(result.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
    vi.unstubAllGlobals();
  });
});
