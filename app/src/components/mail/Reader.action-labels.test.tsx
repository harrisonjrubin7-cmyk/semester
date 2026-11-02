// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { conversations, fullStamp, type Mail } from '../../lib/mailbox';
import { Reader } from './Reader';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RECEIVED_AT = new Date(2026, 9, 17, 9, 15).getTime();

function mail(): Mail {
  return {
    id: 'message-two',
    source: 'google',
    threadId: 'thread-two',
    from: { name: 'Avery Rivera', address: 'avery@example.edu' },
    to: [{ name: 'Harrison Rubin', address: 'harrison@example.edu' }],
    cc: [],
    subject: 'Office hours update',
    snippet: 'The room changed.',
    body: 'The room changed.',
    at: RECEIVED_AT,
    unread: true,
    starred: false,
    folder: 'inbox',
    labels: [],
    attachments: 0,
    link: 'https://mail.example.edu/message',
    courseId: null,
  };
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it('identifies the opened conversation and trashes only that thread', async () => {
  const thread = conversations([mail()])[0];
  const onTrash = vi.fn();

  await act(async () => {
    root.render(
      <Reader
        thread={thread}
        narrow={false}
        onClose={vi.fn()}
        onStar={vi.fn()}
        onRead={vi.fn()}
        onArchive={vi.fn()}
        onTrash={onTrash}
        onMenu={vi.fn()}
        onReply={vi.fn()}
        onTask={vi.fn()}
        onChanges={vi.fn()}
      />,
    );
  });

  const identity = `conversation from Avery, Office hours update, ${fullStamp(RECEIVED_AT)}`;
  expect(host.querySelector(`button[aria-label="Archive ${identity} here"]`)).not.toBeNull();
  expect(host.querySelector(`button[aria-label="Snooze ${identity}"]`)).not.toBeNull();
  expect(host.querySelector(`button[aria-label="Mark ${identity} read"]`)).not.toBeNull();
  expect(host.querySelector(`button[aria-label="Star ${identity}"]`)).not.toBeNull();

  const trash = host.querySelector<HTMLButtonElement>(
    `button[aria-label="Move ${identity} to trash here"]`,
  );
  expect(trash).not.toBeNull();

  await act(async () => trash?.click());

  expect(onTrash).toHaveBeenCalledTimes(1);
});
