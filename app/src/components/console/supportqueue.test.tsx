// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mock = vi.hoisted(() => ({
  queue: vi.fn(),
  thread: vi.fn(),
  access: vi.fn(),
  signals: vi.fn(),
  reply: vi.fn(),
  status: vi.fn(),
}));

vi.mock('../../lib/supporttickets', async (original) => ({
  ...(await original<object>()),
  supportQueue: mock.queue,
  supportThread: mock.thread,
  supportCaseAccess: mock.access,
  readSupportCaseSignals: mock.signals,
  supportReply: mock.reply,
}));

import { SupportQueue } from './SupportQueue';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  mock.queue.mockResolvedValue([{
    id: '123e4567-e89b-12d3-a456-426614174000',
    category: 'accessibility',
    subject: 'Cannot reach Continue',
    status: 'open',
    priority: 'high',
    createdAt: '2026-10-01T10:00:00Z',
    firstResponseDue: '2026-10-02T10:00:00Z',
    firstRespondedAt: null,
    emailNoticeEnabled: true,
    overdue: true,
  }]);
  mock.thread.mockResolvedValue([{
    from: 'student',
    body: 'Tab skips the button.',
    at: '2026-10-01T10:00:00Z',
    context: { device_class: 'tablet', screen: '#/drill' },
  }]);
  mock.access.mockResolvedValue({
    ticketId: '123e4567-e89b-12d3-a456-426614174000',
    grantId: null,
    scope: null,
    reason: null,
    expiresAt: null,
    consentState: 'not_granted',
    active: false,
    lastSensitiveReadAt: null,
  });
  mock.signals.mockResolvedValue([]);
  mock.reply.mockResolvedValue('accepted');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function draw(filter = '', privileged: (run: () => Promise<void>) => void = (run) => void run()) {
  await act(async () => {
    root.render(<SupportQueue env="Production" scope="All" filter={filter} onStatus={mock.status} privileged={privileged} />);
  });
  await act(async () => {});
}

const button = (text: string) => [...host.querySelectorAll('button')].find((item) => item.textContent?.trim() === text) as HTMLButtonElement;

async function click(item: HTMLElement) {
  await act(async () => { item.click(); });
  await act(async () => {});
}

function type(item: HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto = item instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLSelectElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(item, value);
    item.dispatchEvent(new Event(item instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

describe('the support operations queue', () => {
  it('shows an identity-free prioritized ticket and only student-approved app context', async () => {
    await draw();
    expect(host.textContent).toContain('Identity-free queue');
    expect(host.textContent).toContain('SUP-123E-4567-E89B-12D3');
    expect(host.textContent).toContain('OVERDUE');
    expect(host.textContent).not.toMatch(/ada@example\.edu|user-123|vanderbilt-university/i);

    await click(button('Open conversation'));
    expect(host.textContent).toContain('Tab skips the button.');
    expect(host.textContent).toContain('Kind of device');
    expect(host.textContent).toContain('tablet');
    expect(mock.thread).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
    expect(host.textContent).toContain('Private access · metadata only');
    expect(host.textContent).toContain('No case-bound access was granted');
    expect(mock.signals).not.toHaveBeenCalled();
  });

  it('shows case metadata separately and reads aggregates only through the privileged gate', async () => {
    mock.access.mockResolvedValue({
      ticketId: '123e4567-e89b-12d3-a456-426614174000',
      grantId: 'grant-1',
      scope: 'learning-progress',
      reason: 'Diagnose this accessibility case.',
      expiresAt: '2099-01-02T00:00:00Z',
      consentState: 'active',
      active: true,
      lastSensitiveReadAt: null,
    });
    mock.signals.mockResolvedValue([{
      courseId: 'ECON', evidenceCount: 4, averageScore: 0.75,
      mistakeCount: 2, lastObservedAt: '2099-01-01T00:00:00Z',
    }]);
    let approved: (() => Promise<void>) | undefined;
    const privileged = vi.fn((run: () => Promise<void>) => { approved = run; });
    await draw('', privileged);
    await click(button('Open conversation'));

    expect(host.textContent).toContain('learning-progress');
    expect(host.textContent).toContain('Diagnose this accessibility case.');
    expect(host.textContent).toContain('Consentactive');
    expect(host.textContent).toContain('Last sensitive readNever');
    expect(host.textContent).not.toContain('4 evidence items');
    expect(mock.signals).not.toHaveBeenCalled();

    await click(button('View consented aggregate signals'));
    expect(privileged).toHaveBeenCalledTimes(1);
    expect(mock.signals).not.toHaveBeenCalled();
    await act(async () => { await approved?.(); });
    expect(mock.signals).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
    expect(host.textContent).toContain('4 evidence items');
    expect(host.textContent).toContain('2 mistakes');
    expect(host.textContent).not.toContain('Private mistake detail');
    expect(mock.status).toHaveBeenLastCalledWith(
      'Consented aggregate signals read for SUP-123E-4567-E89B-12D3. The read was audited.',
    );
  });

  it('purges cached aggregates when refreshed case access is inactive', async () => {
    mock.access.mockResolvedValueOnce({
      ticketId: '123e4567-e89b-12d3-a456-426614174000', grantId: 'grant-1',
      scope: 'learning-progress', reason: 'Diagnose this case.', expiresAt: '2099-01-02T00:00:00Z',
      consentState: 'active', active: true, lastSensitiveReadAt: null,
    }).mockResolvedValueOnce({
      ticketId: '123e4567-e89b-12d3-a456-426614174000', grantId: 'grant-1',
      scope: 'learning-progress', reason: 'Diagnose this case.', expiresAt: '2099-01-02T00:00:00Z',
      consentState: 'active', active: true, lastSensitiveReadAt: null,
    }).mockResolvedValue({
      ticketId: '123e4567-e89b-12d3-a456-426614174000', grantId: 'grant-1',
      scope: 'learning-progress', reason: 'Diagnose this case.', expiresAt: '2099-01-02T00:00:00Z',
      consentState: 'revoked', active: false, lastSensitiveReadAt: null,
    });
    mock.signals.mockResolvedValue([{
      courseId: 'ECON', evidenceCount: 4, averageScore: 0.75,
      mistakeCount: 2, lastObservedAt: '2099-01-01T00:00:00Z',
    }]);
    await draw();
    await click(button('Open conversation'));
    await click(button('View consented aggregate signals'));
    expect(host.textContent).toContain('4 evidence items');
    await click(button('Refresh support queue'));
    expect(host.textContent).toContain('This grant is inactive');
    expect(host.textContent).not.toContain('4 evidence items');
  });

  it('fails closed when consent metadata cannot be read', async () => {
    mock.access.mockRejectedValueOnce(new Error('metadata unavailable'));
    await draw();
    await click(button('Open conversation'));
    expect(host.textContent).toContain('Case access metadata is unavailable');
    expect(button('View consented aggregate signals')).toBeUndefined();
    expect(mock.signals).not.toHaveBeenCalled();
  });

  it('records a reply with the selected next state and refreshes the queue', async () => {
    await draw();
    await click(button('Open conversation'));
    type(host.querySelector('textarea')!, 'Please try again after reloading.');
    type(host.querySelector('select')!, 'resolved');
    await click(button('Send support reply'));
    expect(mock.reply).toHaveBeenCalledExactlyOnceWith(
      '123e4567-e89b-12d3-a456-426614174000',
      'Please try again after reloading.',
      'resolved',
      expect.any(String),
    );
    expect(mock.queue).toHaveBeenCalledTimes(2);
    expect(mock.status).toHaveBeenCalledWith(
      'Reply recorded for SUP-123E-4567-E89B-12D3. Email notice accepted by the provider; delivery is not yet confirmed.',
    );
  });

  it('keeps an in-app reply successful when email delivery is unavailable', async () => {
    mock.reply.mockResolvedValue('queued');
    await draw();
    await click(button('Open conversation'));
    type(host.querySelector('textarea')!, 'The reply remains available here.');
    await click(button('Send support reply'));
    expect(mock.status).toHaveBeenCalledWith(
      'Reply recorded for SUP-123E-4567-E89B-12D3. Email notice is queued for retry; the reply is available in Help.',
    );
  });

  it('reports an already-claimed notice without calling it accepted or cancelled', async () => {
    mock.reply.mockResolvedValue('in_progress');
    await draw();
    await click(button('Open conversation'));
    type(host.querySelector('textarea')!, 'The reply remains available here.');
    await click(button('Send support reply'));
    expect(mock.status).toHaveBeenCalledWith(
      'Reply recorded for SUP-123E-4567-E89B-12D3. Email notice is already being delivered; provider acceptance is not yet confirmed.',
    );
  });

  it('reports a cancelled notice without claiming a durable retry exists', async () => {
    mock.reply.mockResolvedValue('cancelled');
    await draw();
    await click(button('Open conversation'));
    type(host.querySelector('textarea')!, 'The reply remains available here.');
    await click(button('Send support reply'));
    expect(mock.status).toHaveBeenCalledWith(
      'Reply recorded for SUP-123E-4567-E89B-12D3. Email notice was cancelled before delivery; the reply is available in Help.',
    );
  });

  it('reports an explicit in-app-only choice without claiming an email retry', async () => {
    mock.reply.mockResolvedValue('preference_off');
    await draw();
    await click(button('Open conversation'));
    type(host.querySelector('textarea')!, 'The reply remains available here.');
    await click(button('Send support reply'));
    expect(mock.status).toHaveBeenCalledWith(
      'Reply recorded for SUP-123E-4567-E89B-12D3. The student chose in-app replies without email notices.',
    );
  });

  it('reports the email cap without misreporting the student preference', async () => {
    mock.reply.mockResolvedValue('capped');
    await draw();
    await click(button('Open conversation'));
    type(host.querySelector('textarea')!, 'This reply remains in Semester.');
    await click(button('Send support reply'));
    expect(mock.status).toHaveBeenCalledWith(
      'Reply recorded for SUP-123E-4567-E89B-12D3. No email was queued because this question reached its three-notice daily cap.',
    );
  });

  it('routes the write through the console privileged-action gate', async () => {
    let approved: (() => Promise<void>) | undefined;
    const privileged = vi.fn((run: () => Promise<void>) => { approved = run; });
    await draw('', privileged);
    await click(button('Open conversation'));
    type(host.querySelector('textarea')!, 'This requires a fresh privileged session.');
    await click(button('Send support reply'));
    expect(privileged).toHaveBeenCalledTimes(1);
    expect(mock.reply).not.toHaveBeenCalled();
    await act(async () => { await approved?.(); });
    expect(mock.reply).toHaveBeenCalledTimes(1);
  });

  it('reuses one operation id when an unchanged reply is retried after an ambiguous failure', async () => {
    mock.reply.mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce('preference_off');
    await draw();
    await click(button('Open conversation'));
    type(host.querySelector('textarea')!, 'One reply, even if the response is lost.');
    await click(button('Send support reply'));
    const firstOperation = mock.reply.mock.calls[0][3];
    await click(button('Send support reply'));
    expect(mock.reply.mock.calls[1][3]).toBe(firstOperation);
  });

  it('does not report a committed reply as failed when the thread refresh is unavailable', async () => {
    mock.thread.mockResolvedValueOnce([{
      from: 'student', body: 'Please help.', at: '2026-10-01T10:00:00Z', context: null,
    }]).mockRejectedValueOnce(new Error('read unavailable'));
    await draw();
    await click(button('Open conversation'));
    type(host.querySelector('textarea')!, 'Your reply was recorded.');
    await click(button('Send support reply'));
    expect(mock.reply).toHaveBeenCalledTimes(1);
    expect(mock.status).toHaveBeenLastCalledWith(
      'Reply recorded for SUP-123E-4567-E89B-12D3. Email notice accepted by the provider; delivery is not yet confirmed.',
    );
  });

  it('keeps the last-known queue and reports staleness after a committed reply', async () => {
    mock.queue.mockResolvedValueOnce([{
      id: '123e4567-e89b-12d3-a456-426614174000',
      category: 'accessibility', subject: 'Cannot reach Continue', status: 'open', priority: 'high',
      createdAt: '2026-10-01T10:00:00Z', firstResponseDue: '2026-10-02T10:00:00Z', firstRespondedAt: null, overdue: true,
      emailNoticeEnabled: true,
    }]).mockRejectedValueOnce(new Error('queue unavailable'));
    await draw();
    await click(button('Open conversation'));
    type(host.querySelector('textarea')!, 'Your reply was recorded.');
    await click(button('Send support reply'));
    expect(host.textContent).toContain('SUP-123E-4567-E89B-12D3');
    expect(mock.status).toHaveBeenLastCalledWith(
      'Reply recorded for SUP-123E-4567-E89B-12D3. Email notice accepted by the provider; delivery is not yet confirmed. The queue could not be refreshed; retry before acting on its status.',
    );
  });

  it('ignores a stale overlapping queue response that finishes last', async () => {
    let finishOlder: ((tickets: Awaited<ReturnType<typeof mock.queue>>) => void) | undefined;
    mock.queue.mockImplementationOnce(() => new Promise((resolve) => { finishOlder = resolve; }))
      .mockResolvedValueOnce([{
        id: '123e4567-e89b-12d3-a456-426614174000',
        category: 'accessibility', subject: 'Cannot reach Continue', status: 'resolved', priority: 'high',
        createdAt: '2026-10-01T10:00:00Z', firstResponseDue: '2026-10-02T10:00:00Z', firstRespondedAt: '2026-10-01T11:00:00Z', overdue: false,
        emailNoticeEnabled: true,
      }]);
    await act(async () => {
      root.render(<SupportQueue env="Production" scope="All" filter="" onStatus={mock.status} privileged={(run) => void run()} />);
    });
    await click(button('Refresh support queue'));
    expect(host.textContent).toContain('Resolved; student may close');
    await act(async () => { finishOlder?.([{
      id: '123e4567-e89b-12d3-a456-426614174000',
      category: 'accessibility', subject: 'Cannot reach Continue', status: 'open', priority: 'high',
      createdAt: '2026-10-01T10:00:00Z', firstResponseDue: '2026-10-02T10:00:00Z', firstRespondedAt: null, overdue: true,
      emailNoticeEnabled: true,
    }]); });
    expect(host.textContent).toContain('Resolved; student may close');
    expect(host.textContent).not.toContain('Open with support');
  });

  it('keeps a newly selected conversation when the prior ticket finishes sending', async () => {
    const first = '123e4567-e89b-12d3-a456-426614174000';
    const second = '223e4567-e89b-12d3-a456-426614174000';
    mock.queue.mockResolvedValue([
      {
        id: first, category: 'accessibility', subject: 'First ticket', status: 'open', priority: 'high',
        createdAt: '2026-10-01T10:00:00Z', firstResponseDue: '2026-10-02T10:00:00Z', firstRespondedAt: null,
        emailNoticeEnabled: true, overdue: true,
      },
      {
        id: second, category: 'bug', subject: 'Second ticket', status: 'open', priority: 'normal',
        createdAt: '2026-10-01T10:05:00Z', firstResponseDue: '2026-10-04T10:05:00Z', firstRespondedAt: null,
        emailNoticeEnabled: true, overdue: false,
      },
    ]);
    let finishReply: ((value: 'accepted') => void) | undefined;
    let finishSecond: ((value: Awaited<ReturnType<typeof mock.thread>>) => void) | undefined;
    mock.reply.mockImplementationOnce(() => new Promise((resolve) => { finishReply = resolve; }));
    mock.thread.mockImplementation((id: string) => id === first
      ? Promise.resolve([{ from: 'student', body: 'First thread.', at: '2026-10-01T10:00:00Z', context: null }])
      : new Promise((resolve) => { finishSecond = resolve; }));

    await draw();
    await click(button('Open conversation'));
    type(host.querySelector('textarea')!, 'Replying to the first ticket.');
    await click(button('Send support reply'));
    expect(host.querySelector('textarea')?.disabled).toBe(true);
    expect(host.querySelector('select')?.disabled).toBe(true);
    await click(button('Open conversation'));
    await act(async () => { finishReply?.('accepted'); });
    await act(async () => { finishSecond?.([{ from: 'student', body: 'Second thread.', at: '2026-10-01T10:05:00Z', context: null }]); });

    expect(host.textContent).toContain('Second ticket');
    expect(host.textContent).toContain('Second thread.');
    expect(mock.thread.mock.calls.filter(([id]) => id === first)).toHaveLength(1);
  });

  it('shows an initial queue outage as retryable instead of as an empty queue', async () => {
    mock.queue.mockRejectedValueOnce(new Error('queue unavailable')).mockResolvedValueOnce([{
      id: '123e4567-e89b-12d3-a456-426614174000',
      category: 'accessibility', subject: 'Cannot reach Continue', status: 'open', priority: 'high',
      createdAt: '2026-10-01T10:00:00Z', firstResponseDue: '2026-10-02T10:00:00Z', firstRespondedAt: null, overdue: true,
      emailNoticeEnabled: true,
    }]);
    await draw();
    expect(host.textContent).toContain('Support queue unavailable');
    expect(host.textContent).not.toContain('No support questions match');
    await click(button('Refresh support queue'));
    expect(host.textContent).toContain('SUP-123E-4567-E89B-12D3');
    expect(host.textContent).not.toContain('Support queue unavailable');
  });

  it('keeps reply controls unavailable until a failed conversation read is retried successfully', async () => {
    mock.thread.mockRejectedValueOnce(new Error('read unavailable')).mockResolvedValueOnce([{
      from: 'student', body: 'Please help.', at: '2026-10-01T10:00:00Z', context: null,
    }]);
    await draw();
    await click(button('Open conversation'));
    expect(host.textContent).toContain('Replies stay disabled');
    expect(host.querySelector('textarea')).toBeNull();
    await click(button('Retry conversation'));
    expect(host.textContent).toContain('Please help.');
    expect(host.querySelector('textarea')).not.toBeNull();
  });

  it('resets the next disposition when the operator reopens a ticket', async () => {
    await draw();
    await click(button('Open conversation'));
    type(host.querySelector('select')!, 'resolved');
    expect((host.querySelector('select') as HTMLSelectElement).value).toBe('resolved');
    await click(button('Close conversation'));
    await click(button('Open conversation'));
    expect((host.querySelector('select') as HTMLSelectElement).value).toBe('waiting_on_student');
  });

  it('uses the console filter without re-reading the database', async () => {
    await draw('privacy');
    expect(host.textContent).toContain('No support questions match this view.');
    expect(mock.queue).toHaveBeenCalledTimes(1);
  });

  it('uses operator-facing disposition labels and always offers a refresh', async () => {
    mock.queue.mockResolvedValueOnce([{
      id: '123e4567-e89b-12d3-a456-426614174000',
      category: 'accessibility', subject: 'Cannot reach Continue', status: 'waiting_on_student', priority: 'high',
      createdAt: '2026-10-01T10:00:00Z', firstResponseDue: '2026-10-02T10:00:00Z', firstRespondedAt: '2026-10-01T11:00:00Z', overdue: false,
      emailNoticeEnabled: true,
    }]);
    await draw();
    expect(host.textContent).toContain('Waiting for student');
    expect(host.textContent).not.toContain('Support replied — waiting for you');
    await click(button('Refresh support queue'));
    expect(mock.queue).toHaveBeenCalledTimes(2);
  });

  it('refreshes the open conversation with the queue without discarding a reply draft', async () => {
    await draw();
    await click(button('Open conversation'));
    type(host.querySelector('textarea')!, 'Draft response in progress.');
    mock.thread.mockResolvedValueOnce([
      { from: 'student', body: 'Tab skips the button.', at: '2026-10-01T10:00:00Z', context: null },
      { from: 'student', body: 'This is the new detail.', at: '2026-10-01T10:05:00Z', context: null },
    ]);

    await click(button('Refresh support queue'));

    expect(mock.queue).toHaveBeenCalledTimes(2);
    expect(mock.thread).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('This is the new detail.');
    expect((host.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Draft response in progress.');
  });
});
