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
  mock.reply.mockResolvedValue(undefined);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function draw(filter = '') {
  await act(async () => {
    root.render(<SupportQueue env="Production" scope="All" filter={filter} onStatus={mock.status} privileged={(run) => void run()} />);
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
    expect(host.textContent).toContain('SUP-123E4567');
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
    expect(mock.status).toHaveBeenCalledWith('Reply recorded for SUP-123E4567.');
  });

  it('uses the console filter without re-reading the database', async () => {
    await draw('privacy');
    expect(host.textContent).toContain('No support questions match this view.');
    expect(mock.queue).toHaveBeenCalledTimes(1);
  });
});
