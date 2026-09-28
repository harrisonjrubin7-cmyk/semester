// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Threads } from './Threads';
import type { Thread } from '../lib/threads';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/*
 * PIN, RENAME and DELETE belong to the conversation you have open.
 *
 * They were drawn under every row, so a list of forty conversations was forty
 * copies of the same three words, and an empty "New conversation" offered to
 * pin, rename and delete nothing. They stay written out — never behind a
 * gesture — but only under the open conversation, and only once it has
 * something in it.
 */
const NOW = 1_800_000_000_000;
const thread = (id: string, asked: boolean): Thread => ({
  id,
  title: asked ? `Question ${id}` : '',
  turns: asked
    ? ([
        { role: 'user', content: `Question ${id}` },
        { role: 'assistant', content: 'An answer' },
      ] as Thread['turns'])
    : [],
  at: NOW - 60_000,
});

describe('conversation row actions', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const draw = (threads: Thread[], openId: string) =>
    act(() =>
      root.render(
        <Threads
          threads={threads}
          openId={openId}
          onOpen={() => {}}
          onDrop={() => {}}
          onNew={() => {}}
          onRename={() => {}}
          onPin={() => {}}
          archived={[]}
          onRestore={() => {}}
          now={NOW}
        />,
      ),
    );
  const renames = () =>
    [...host.querySelectorAll('button')].filter((b) => /^Rename/.test(b.getAttribute('aria-label') ?? ''));

  it('draws them once, under the open conversation', () => {
    draw([thread('a', true), thread('b', true), thread('c', true)], 'b');
    expect(renames()).toHaveLength(1);
    expect(renames()[0].getAttribute('aria-label')).toContain('Question b');
  });

  it('draws none under an empty conversation', () => {
    draw([thread('new', false), thread('a', true)], 'new');
    expect(renames()).toHaveLength(0);
  });
});
