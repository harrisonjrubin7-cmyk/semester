// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BOTTOM_CHROME, FOCUS_BAR_INSET, insetOf, useBottomChrome } from '../lib/bottomchrome.hook';

/**
 * The Focus bar and the assistant's button do not sit on each other.
 *
 * Both are fixed over the bottom of the window. At 320x640 (WCAG 1.4.10's
 * reflow width) the Focus bar takes the gutters' full width, and nothing told
 * the button it was there. Measured in Chromium before the fix, in Focused
 * mode on Today:
 *
 *   workspace, feed, shelves, guides: bar 518–628, button 576–628 — on it
 *   springboard:                      bar 518–628, button 481–533 — on it
 *   tabs:                             button at -64 — off the top of the screen
 *
 * The last is the same fault from the other side: Focused hides the tab bar
 * with `display: none`, a box that is not drawn reports its top as 0, and the
 * inset read as the whole window. After: the button at 454–506 on all five,
 * above the bar; at 1280 the pill is centred and the button clear of it.
 *
 * There is no layout in jsdom, so the geometry is pinned in two halves: the
 * measuring is driven for real with a stubbed box, and the arithmetic that
 * consumes it is read out of the source it lives in.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BUTTON = readFileSync(join(process.cwd(), 'src/ai/Assistant.tsx'), 'utf8');
const SHEET = readFileSync(join(process.cwd(), 'src/styles/app.css'), 'utf8');
const BAR = readFileSync(join(process.cwd(), 'src/components/unity/modes.tsx'), 'utf8');

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
  document.documentElement.style.removeProperty(BOTTOM_CHROME);
  document.documentElement.style.removeProperty(FOCUS_BAR_INSET);
});

/** A box whose top edge is `top`, or one that is not drawn at all. */
function stub(node: HTMLElement, top: number | 'hidden') {
  node.getClientRects = () =>
    (top === 'hidden' ? [] : [new DOMRect(0, top, 10, 10)]) as unknown as DOMRectList;
  node.getBoundingClientRect = () => new DOMRect(0, top === 'hidden' ? 0 : top, 10, 10);
}

function Bar({ top, property }: { top: number | 'hidden'; property?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useBottomChrome(ref, property);
  return (
    <div
      ref={(node) => {
        if (node) stub(node, top);
        ref.current = node;
      }}
    />
  );
}

const read = (p: string) => document.documentElement.style.getPropertyValue(p);

describe('measuring what is along the bottom', () => {
  it('reads a drawn bar as the distance from its top to the bottom of the window', () => {
    const node = document.createElement('div');
    stub(node, window.innerHeight - 122);
    expect(insetOf(node)).toBe(122);
  });

  it('reads a bar that is not drawn as nothing, not as the whole window', () => {
    // The tab bar under Focused mode: mounted, `display: none`, top 0.
    const node = document.createElement('div');
    stub(node, 'hidden');
    expect(insetOf(node)).toBe(0);
  });

  it('writes the Focus bar to its own property, leaving the tab bar’s alone', () => {
    document.documentElement.style.setProperty(BOTTOM_CHROME, '76px');
    act(() => root.render(<Bar top={window.innerHeight - 122} property={FOCUS_BAR_INSET} />));
    expect(read(FOCUS_BAR_INSET)).toBe('122px');
    expect(read(BOTTOM_CHROME)).toBe('76px');
    act(() => root.render(<></>));
    expect(read(FOCUS_BAR_INSET)).toBe('');
    expect(read(BOTTOM_CHROME)).toBe('76px');
  });

  it('writes nothing for a hidden tab bar, so the button falls back to the edge', () => {
    act(() => root.render(<Bar top="hidden" />));
    expect(read(BOTTOM_CHROME)).toBe('');
  });
});

describe('the button and the Focus bar', () => {
  it('has the Focus bar report itself', () => {
    expect(BAR).toMatch(/useBottomChrome\(bar, FOCUS_BAR_INSET\)/);
    expect(BAR).toMatch(/<div ref=\{bar\} className="focus-bar"/);
  });

  it('stands the button on whichever is taller, the bottom chrome or the Focus bar', () => {
    const narrow = BUTTON.match(/bottom: wide \? `([^`]*)` : `([^`]*)`/);
    expect(narrow, 'the button is placed some other way now; re-point this test').toBeTruthy();
    expect(narrow![2]).toContain('max(var(--bottom-chrome, 0px), var(--focus-bar-inset, 0px))');
    expect(narrow![1]).toContain('var(--focus-bar-inset, 0px)');
  });

  it('keeps a focused control out from under the Focus bar (WCAG 2.4.11)', () => {
    // A control under a fixed bar is inside the scroller's box, so tabbing to
    // it scrolls nothing unless the scroller's padding says that strip is out
    // of view. Measured at 320x640 in Focused mode, two laps of Tab: eight of
    // Today's 39 stops and six of Settings' landed under the bar before
    // this, none after. (`scroll-margin` on the focused element was tried
    // first and changed nothing, for the same reason: no scroll happens.)
    expect(SHEET).toMatch(
      /:root\[data-workspace='focused'\] \.scrollarea \{[^}]*scroll-padding-bottom: calc\(var\(--focus-bar-inset, 0px\) \+ var\(--assistant-strip\)\)/s,
    );
  });

  it('reserves the Focus bar under the last card in Focused mode', () => {
    expect(SHEET).toMatch(
      /:root\[data-workspace='focused'\] \.pane-body::after \{[^}]*height: calc\(var\(--assistant-strip\) \+ var\(--focus-bar-inset, 0px\)\)/s,
    );
  });
});
