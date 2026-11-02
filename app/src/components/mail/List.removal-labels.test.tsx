// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { conversations, fullStamp, type Mail } from '../../lib/mailbox';
import { List } from './List';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RECEIVED_AT = new Date(2026, 9, 17, 9, 15).getTime();

function mail(id: string): Mail {
  return {
    id,
    source: 'google',
    threadId: `thread-${id}`,
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

it('distinguishes repeated conversations and trashes only the represented thread', async () => {
  const threads = conversations([mail('one'), mail('two')]);
  const onTrash = vi.fn();

  await act(async () => {
    root.render(
      <List
        threads={threads}
        folder="inbox"
        category={null}
        onCategory={vi.fn()}
        open={null}
        picked={[]}
        onOpen={vi.fn()}
        onPick={vi.fn()}
        onStar={vi.fn()}
        onRead={vi.fn()}
        onArchive={vi.fn()}
        onTrash={onTrash}
        onSnooze={vi.fn()}
        now={new Date(RECEIVED_AT)}
        empty={null}
      />,
    );
  });

  const received = fullStamp(RECEIVED_AT);
  const expected = [
    `Move conversation 1 of 2, Avery, Office hours update, ${received} to trash here`,
    `Move conversation 2 of 2, Avery, Office hours update, ${received} to trash here`,
  ];
  const trashLabels = [...host.querySelectorAll<HTMLButtonElement>('button')]
    .map((button) => button.getAttribute('aria-label'))
    .filter((label): label is string => Boolean(label?.startsWith('Move conversation')));
  expect(trashLabels).toEqual(expected);
  const first = host.querySelector<HTMLButtonElement>(
    `button[aria-label="${expected[0]}"]`,
  );
  const second = host.querySelector<HTMLButtonElement>(
    `button[aria-label="${expected[1]}"]`,
  );

  expect(first).not.toBeNull();
  expect(second).not.toBeNull();

  await act(async () => second?.click());

  expect(onTrash).toHaveBeenCalledTimes(1);
  expect(onTrash).toHaveBeenCalledWith(threads[1]);
});
