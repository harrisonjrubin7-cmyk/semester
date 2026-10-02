// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Message } from '../../lib/classmates';

const messages: Message[] = [
  {
    id: 'before',
    term: '2026FA',
    code: 'vanderbilt/ECON 1020',
    user_id: 'kayo',
    body: 'The first note',
    created_at: '2026-10-01T14:00:00.000Z',
  },
  {
    id: 'after',
    term: '2026FA',
    code: 'vanderbilt/ECON 1020',
    user_id: 'kayo',
    body: 'The unread note',
    created_at: '2026-10-01T14:10:00.000Z',
  },
];

vi.mock('../../lib/classmates', async (original) => ({
  ...(await original<typeof import('../../lib/classmates')>()),
  recent: async () => messages,
  whoIsIn: async () => [{ user_id: 'kayo', handle: 'Kayo', about: '' }],
  reactionsIn: async () => [],
  listen: () => () => {},
  listenReactions: () => () => {},
  here: () => () => {},
}));

const { Talk } = await import('./Talk');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const noop = () => undefined;
const props = {
  term: '2026FA',
  roomKey: 'vanderbilt/ECON 1020',
  code: 'ECON 1020',
  me: 'me',
  myHandle: 'Ray',
  pinned: false,
  muted: false,
  draft: '',
  wide: true,
  onBack: noop,
  onLeave: noop,
  onPin: noop,
  onMute: noop,
  onCopyLink: noop,
  onMessages: noop,
  onRead: noop,
  onPaper: noop,
  paperOf: () => null,
};

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function show(mark: string) {
  await act(async () => {
    root.render(<Talk {...props} mark={mark} />);
    await Promise.resolve();
  });
}

describe('the unread rule in an open class chat', () => {
  it('stays at the mark captured when the room opened', async () => {
    await show('2026-10-01T14:05:00.000Z');
    expect(host.textContent).toContain('NEW');

    // The outer room list advances its mark as the visible message is read.
    // The line in this already-open transcript must not chase that update.
    await show('2026-10-01T14:15:00.000Z');
    expect(host.textContent).toContain('NEW');
    expect(host.querySelector('#say-after')?.previousElementSibling?.textContent).toContain('NEW');
  });
});
