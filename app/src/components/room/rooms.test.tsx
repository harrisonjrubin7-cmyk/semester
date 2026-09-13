// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { Rooms } from './Rooms';
import { Says } from './Says';
import { Write } from './Write';
import type { Listed, Run, Tally } from '../../lib/roomchat';

/**
 * The chat, drawn.
 *
 * Everything about a class conversation that is arithmetic is tested in
 * `lib/roomchat.test.ts` without a DOM. What is left is the part only a render
 * can answer: whether the count reaches the row, whether the menu opens,
 * whether a mention is painted, whether the control under somebody else's
 * message says REPORT and the one under your own says DELETE. Those are the
 * pieces that would silently stop being drawn, because nothing else refers to
 * them.
 *
 * It follows `components/fold.test.tsx`, which is where this way of rendering
 * in the suite was established.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function show(node: ReactNode) {
  act(() => {
    root.render(node);
  });
}

const text = () => host.textContent ?? '';
const buttons = () => [...host.querySelectorAll('button')];
const named = (name: string | RegExp) =>
  buttons().find((b) =>
    typeof name === 'string'
      ? (b.getAttribute('aria-label') ?? b.textContent ?? '').includes(name)
      : name.test(b.getAttribute('aria-label') ?? b.textContent ?? ''),
  );
const click = (el: Element | undefined) => act(() => (el as HTMLElement | undefined)?.click());

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const row = (over: Partial<Listed> = {}): Listed => ({
  key: 'vu/ECON 1020',
  code: 'ECON 1020',
  joined: true,
  pinned: false,
  muted: false,
  preview: 'Kayo Miwa: is the deck up?',
  when: '9:00a',
  at: 1,
  unread: 0,
  mentions: 0,
  ...over,
});

const noop = () => undefined;

function list(rows: Listed[], over: Partial<Parameters<typeof Rooms>[0]> = {}) {
  return (
    <Rooms
      rows={rows}
      openKey=""
      onOpen={noop}
      onJoin={noop}
      onPin={noop}
      onMute={noop}
      onLeave={noop}
      onCopyLink={noop}
      adding=""
      onAdding={noop}
      onAdd={noop}
      busy={false}
      {...over}
    />
  );
}

describe('the list of class chats', () => {
  it('says what the last line was and when', () => {
    show(list([row()]));
    expect(text()).toContain('ECON 1020');
    expect(text()).toContain('Kayo Miwa: is the deck up?');
    expect(text()).toContain('9:00a');
  });

  it('shows the count, and the @ that is not the same news', () => {
    show(list([row({ unread: 12, mentions: 1 })]));
    // Nine is where a number stops being read.
    expect(text()).toContain('9+');
    expect(host.querySelector('[aria-label="1 mention"]')).not.toBeNull();
  });

  it('shows no count at all for a room you muted', () => {
    show(list([row({ unread: 4, muted: true })]));
    expect(text()).not.toContain('4');
    expect(text()).toContain('muted');
  });

  it('puts pinned rooms under their own heading', () => {
    show(list([row({ pinned: true }), row({ key: 'vu/PSCI 1104', code: 'PSCI 1104' })]));
    expect(text()).toContain('Pinned');
    expect(text()).toContain('Recent');
  });

  it('opens a joined room and joins one you are not in', () => {
    const opened: string[] = [];
    const joined: string[] = [];
    show(
      list([row(), row({ key: 'vu/MATH 1300', code: 'MATH 1300', joined: false })], {
        onOpen: (k) => opened.push(k),
        onJoin: (k) => joined.push(k),
      }),
    );
    click(buttons().find((b) => (b.textContent ?? '').includes('ECON 1020')));
    click(buttons().find((b) => (b.textContent ?? '').includes('MATH 1300')));
    expect(opened).toEqual(['vu/ECON 1020']);
    expect(joined).toEqual(['vu/MATH 1300']);
  });

  it('has pin, mute, a link and the way out behind one control', () => {
    const pinned: boolean[] = [];
    show(list([row()], { onPin: (_k, on) => pinned.push(on) }));
    expect(text()).not.toContain('Copy link');
    click(named('More for ECON 1020'));
    expect(text()).toContain('Pin');
    expect(text()).toContain('Mute');
    expect(text()).toContain('Copy link');
    expect(text()).toContain('Leave');
    click(buttons().find((b) => (b.textContent ?? '').trim().endsWith('Pin')));
    expect(pinned).toEqual([true]);
  });

  it('searches what is on the rows', () => {
    show(list([row(), row({ key: 'vu/PSCI 1104', code: 'PSCI 1104', preview: 'moved to 210' })]));
    const field = host.querySelector('input') as HTMLInputElement;
    act(() => {
      // The value has to be set the way React sees it, not by assignment.
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set?.call(field, 'psci');
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(text()).toContain('PSCI 1104');
    expect(text()).not.toContain('ECON 1020');
  });
});

const run = (over: Partial<Run> = {}): Run => ({
  user_id: 'u1',
  at: '2026-09-11T09:00:00',
  says: [
    {
      id: 'm1',
      user_id: 'u1',
      body: 'morning @Ray — paper 7Q2X is up',
      created_at: '2026-09-11T09:00:00',
    },
  ],
  ...over,
});

function said(over: Partial<Parameters<typeof Says>[0]> = {}) {
  const tallies: Record<string, Tally[]> = {};
  return (
    <Says
      run={run()}
      name="Kayo Miwa"
      mine={false}
      present={false}
      handles={['Kayo Miwa', 'Ray']}
      myHandle="Ray"
      tallies={tallies}
      onReact={noop}
      onDelete={noop}
      onReport={noop}
      onPaper={noop}
      paperOf={(body) => /paper ([0-9A-Z]{4})/.exec(body)?.[1] ?? null}
      markId={null}
      hitId=""
      {...over}
    />
  );
}

describe('one person talking', () => {
  it('draws the name once, the time once, and the words', () => {
    show(said());
    expect(text()).toContain('Kayo Miwa');
    expect(text()).toContain('9:00a');
    expect(text()).toContain('morning @Ray');
  });

  it('marks the message that is addressed to you', () => {
    show(said());
    const edge = [...host.querySelectorAll('div')].some((d) =>
      (d.getAttribute('style') ?? '').includes('var(--app-warn)'),
    );
    expect(edge, 'a message mentioning you carries the coloured edge').toBe(true);
  });

  it('offers the paper in a message that carries one', () => {
    const sat: string[] = [];
    show(said({ onPaper: (c) => sat.push(c) }));
    click(buttons().find((b) => (b.textContent ?? '').startsWith('Sit paper')));
    expect(sat).toEqual(['7Q2X']);
  });

  it('counts reactions and hands back the one that is yours', () => {
    const back: [string, string, boolean][] = [];
    show(
      said({
        tallies: { m1: [{ emoji: '👍', count: 2, mine: true, who: ['You', 'Kayo Miwa'] }] },
        onReact: (id, emoji, mine) => back.push([id, emoji, mine]),
      }),
    );
    expect(text()).toContain('2');
    click(named('👍 from You, Kayo Miwa'));
    // Tapping your own is taking it back, which is what the third value says.
    expect(back).toEqual([['m1', '👍', true]]);
  });

  it('puts a report under somebody else’s message and a delete under your own', () => {
    show(said());
    click(named('React or report'));
    expect(text()).toContain('REPORT');
    expect(text()).not.toContain('DELETE');

    show(said({ mine: true, name: 'Ray' }));
    click(named('React or report'));
    expect(text()).toContain('DELETE');
    expect(text()).not.toContain('REPORT');
  });

  it('draws the NEW rule above the first thing you have not seen', () => {
    show(said({ markId: 'm1' }));
    expect(text()).toContain('NEW');
    show(said({ markId: null }));
    expect(text()).not.toContain('NEW');
  });
});

describe('the composer', () => {
  const people = [
    { user_id: 'u1', handle: 'Kayo Miwa' },
    { user_id: 'u2', handle: 'Ray' },
  ];

  function write(value: string, over: Partial<Parameters<typeof Write>[0]> = {}) {
    return (
      <Write
        value={value}
        onChange={noop}
        onSend={noop}
        people={people}
        code="ECON 1020"
        sending={false}
        {...over}
      />
    );
  }

  it('says how to send, and which room it is sending to', () => {
    show(write(''));
    expect(text()).toContain('Enter sends');
    expect((host.querySelector('textarea') as HTMLTextAreaElement).placeholder).toBe(
      'Say something to ECON 1020',
    );
  });

  it('sends on Enter and leaves Shift + Enter to the newline', () => {
    const sent = vi.fn();
    show(write('hello', { onSend: sent }));
    const box = host.querySelector('textarea') as HTMLTextAreaElement;
    act(() => {
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(sent).toHaveBeenCalledTimes(1);
    act(() => {
      box.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }),
      );
    });
    expect(sent).toHaveBeenCalledTimes(1);
  });

  it('will not send an empty message', () => {
    show(write('   '));
    expect((named('Send') as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers the names in the room once an @ is being typed', () => {
    show(write('hey @ka'));
    const box = host.querySelector('textarea') as HTMLTextAreaElement;
    act(() => {
      box.setSelectionRange(7, 7);
      box.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
    });
    expect(text()).toContain('@Kayo Miwa');
    expect(text()).not.toContain('@Ray');
  });
});
