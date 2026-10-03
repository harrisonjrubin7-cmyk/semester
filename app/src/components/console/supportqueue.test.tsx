// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mock = vi.hoisted(() => ({
  queue: vi.fn(),
  thread: vi.fn(),
  reply: vi.fn(),
  status: vi.fn(),
}));

vi.mock('../../lib/supporttickets', async (original) => ({
  ...(await original<object>()),
  supportQueue: mock.queue,
  supportThread: mock.thread,
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
    overdue: true,
  }]);
  mock.thread.mockResolvedValue([{
    from: 'student',
    body: 'Tab skips the button.',
    at: '2026-10-01T10:00:00Z',
    context: { device_class: 'tablet', screen: '#/drill' },
  }]);
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
    );
    expect(mock.queue).toHaveBeenCalledTimes(2);
    expect(mock.status).toHaveBeenCalledWith(
      'Reply recorded for SUP-123E-4567-E89B-12D3. Email notice accepted by the provider; delivery is not yet confirmed.',
    );
  });

  it('keeps an in-app reply successful when email delivery is unavailable', async () => {
    mock.reply.mockResolvedValue('in_app_only');
    await draw();
    await click(button('Open conversation'));
    type(host.querySelector('textarea')!, 'The reply remains available here.');
    await click(button('Send support reply'));
    expect(mock.status).toHaveBeenCalledWith(
      'Reply recorded for SUP-123E-4567-E89B-12D3. Email notice is queued for retry; the reply is available in Help.',
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
    }]); });
    expect(host.textContent).toContain('Resolved; student may close');
    expect(host.textContent).not.toContain('Open with support');
  });

  it('shows an initial queue outage as retryable instead of as an empty queue', async () => {
    mock.queue.mockRejectedValueOnce(new Error('queue unavailable')).mockResolvedValueOnce([{
      id: '123e4567-e89b-12d3-a456-426614174000',
      category: 'accessibility', subject: 'Cannot reach Continue', status: 'open', priority: 'high',
      createdAt: '2026-10-01T10:00:00Z', firstResponseDue: '2026-10-02T10:00:00Z', firstRespondedAt: null, overdue: true,
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
    }]);
    await draw();
    expect(host.textContent).toContain('Waiting for student');
    expect(host.textContent).not.toContain('Support replied — waiting for you');
    await click(button('Refresh support queue'));
    expect(mock.queue).toHaveBeenCalledTimes(2);
  });
});
