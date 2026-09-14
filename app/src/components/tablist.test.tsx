// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { TabList } from './ui';

/**
 * The keyboard, actually pressed.
 *
 * `onetablist.test.ts` reads the source and checks that the handler is there.
 * That is the rule which stops a tenth hand-rolled strip appearing, but it
 * would pass on a handler that read the keys and did the wrong thing with
 * them — and "the arrow key does something, just not the right thing" is a
 * fault nobody notices from a screenshot.
 *
 * So this presses them. jsdom does not paint, but it does keep an element
 * tree and a `document.activeElement`, and both halves of the roving tabindex
 * are checks about exactly those two things.
 */

let host: HTMLDivElement;
let root: Root;
let chosen: string[];

function draw(value: string) {
  act(() => {
    root.render(
      <TabList
        label="Three things"
        tabs={[
          { id: 'one', label: 'One' },
          { id: 'two', label: 'Two' },
          { id: 'three', label: 'Three' },
        ]}
        value={value}
        onChange={(next) => chosen.push(next)}
      />,
    );
  });
}

const tabs = () => [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];

function press(key: string) {
  const strip = host.querySelector('[role="tablist"]')!;
  act(() => {
    strip.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  chosen = [];
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it('gives the strip one tab stop, not one per tab', () => {
  draw('two');
  // The whole point of a roving tabindex: Tab moves past the group, the
  // arrows move inside it. Every tab being a stop is what all ten call sites
  // did before, and it is why the arrows had nothing to do.
  expect(tabs().map((t) => t.tabIndex)).toEqual([-1, 0, -1]);
});

it('moves along with the arrows, and wraps at both ends', () => {
  draw('two');
  press('ArrowRight');
  expect(chosen).toEqual(['three']);

  draw('three');
  press('ArrowRight');
  // Wrapping rather than stopping: a key that silently does nothing at one
  // end reads as a broken widget when you cannot see the row.
  expect(chosen.at(-1)).toBe('one');

  draw('one');
  press('ArrowLeft');
  expect(chosen.at(-1)).toBe('three');
});

it('takes Home and End', () => {
  draw('two');
  press('Home');
  expect(chosen.at(-1)).toBe('one');
  press('End');
  expect(chosen.at(-1)).toBe('three');
});

it('carries focus to the tab it moved to', () => {
  // The half that is easy to leave out. The other tabs are `-1`, so the
  // browser will not move focus for us: left alone it stays on a button that
  // is no longer a tab stop, and the next arrow press has nothing to move
  // from. That is a dead end a keyboard user cannot get out of.
  draw('one');
  tabs()[0].focus();
  press('ArrowRight');
  draw('two');
  expect(document.activeElement).toBe(tabs()[1]);
});

it('leaves keys that are not its own alone', () => {
  draw('two');
  press('a');
  press('Enter');
  expect(chosen).toEqual([]);
});
