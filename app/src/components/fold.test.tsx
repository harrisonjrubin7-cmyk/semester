// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { Page } from './Page';
import { SectionLabel } from './ui';
import { FoldAll, FoldScope } from './Fold';
import { FOLDS_KEY } from '../lib/folds';
import { forgetFolds } from '../lib/folds.hook';

/**
 * The transform, against the shapes screens are actually written in.
 *
 * `components/Fold.tsx` reads a screen's own markup looking for headings, and
 * the thing it must never do is change what a screen renders when it is not
 * folding anything. That is not a claim a reader can check by eye across
 * fifty-seven screens, so it is checked here on the four shapes those screens
 * use: headings at the top level, headings nested in a wrapper, a heading
 * inside a list that decides its own children, and a screen with none.
 *
 * The app has no other React rendering test. This is the first, and it is
 * here rather than absent because the alternative — trusting a tree walk over
 * every screen in the app — is exactly the kind of thing that is fine until
 * the day it silently is not.
 */

// React asks to be told that a test is driving it, so `act` can flush what a
// browser would have flushed on its own.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function show(node: ReactNode) {
  act(() => {
    root.render(node);
  });
}

function heads(): string[] {
  return [...host.querySelectorAll('h2 button')].map((b) => (b.textContent ?? '').trim());
}

function tap(said: string) {
  const button = [...host.querySelectorAll('h2 button')].find(
    (b) => (b.textContent ?? '').trim() === said,
  );
  if (!button) throw new Error(`no heading reading “${said}”`);
  act(() => {
    (button as HTMLButtonElement).click();
  });
}

beforeEach(() => {
  localStorage.clear();
  forgetFolds();
  // Unmounted, not just dropped: a section registers itself while it is on
  // screen, and a root left mounted goes on counting towards the next test's
  // "how many sections are here".
  if (root) act(() => root.unmount());
  host?.remove();
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

describe('a screen’s sections', () => {
  const screen = (
    <FoldScope value="home">
      <Page>
        <SectionLabel>What’s coming</SectionLabel>
        <p id="coming">three deadlines</p>
        <div>
          <SectionLabel>Today’s schedule</SectionLabel>
          <p id="rail">two lectures</p>
        </div>
      </Page>
    </FoldScope>
  );

  it('are found at the top level and inside a wrapper', () => {
    show(screen);
    expect(heads()).toEqual(['What’s coming', 'Today’s schedule']);
  });

  it('start open, with everything a screen wrote still on it', () => {
    show(screen);
    expect(host.querySelector('#coming')).not.toBeNull();
    expect(host.querySelector('#rail')).not.toBeNull();
    for (const b of host.querySelectorAll('h2 button')) {
      expect(b.getAttribute('aria-expanded')).toBe('true');
    }
  });

  it('take the section away when its heading is tapped, and only that one', () => {
    show(screen);
    tap('What’s coming');
    expect(host.querySelector('#coming')).toBeNull();
    // The one nested in a wrapper below it is a peer on screen, not part of
    // this section, and stays put. That rule is the whole of `walk`.
    expect(host.querySelector('#rail')).not.toBeNull();
    // The heading itself stays: it is what says the section is there.
    expect(heads()).toEqual(['What’s coming', 'Today’s schedule']);
  });

  it('come back on a second tap', () => {
    show(screen);
    tap('Today’s schedule');
    expect(host.querySelector('#rail')).toBeNull();
    tap('Today’s schedule');
    expect(host.querySelector('#rail')).not.toBeNull();
  });

  it('are still folded on the next visit', () => {
    show(screen);
    tap('What’s coming');
    expect(localStorage.getItem(FOLDS_KEY)).toContain('home');

    show(null);
    forgetFolds();
    show(screen);
    expect(host.querySelector('#coming')).toBeNull();
  });

  it('are remembered per screen, not per heading', () => {
    show(screen);
    tap('What’s coming');
    show(
      <FoldScope value="courses">
        <Page>
          <SectionLabel>What’s coming</SectionLabel>
          <p id="coming">a course’s version</p>
        </Page>
      </FoldScope>,
    );
    expect(host.querySelector('#coming')).not.toBeNull();
  });
});

describe('the control above them', () => {
  // `FoldAll` lives in `ShellBody` in the app — above the screen rather than
  // inside its frame, so a sub-view that keeps its own frame still gets one.
  const two = (
    <FoldScope value="home">
      <FoldAll />
      <Page>
        <SectionLabel>One</SectionLabel>
        <p id="a">a</p>
        <SectionLabel>Two</SectionLabel>
        <p id="b">b</p>
      </Page>
    </FoldScope>
  );

  function all(): HTMLButtonElement | null {
    return [...host.querySelectorAll('button')].find(
      (b) => /Collapse all|Expand all/.test(b.textContent ?? ''),
    ) as HTMLButtonElement | null;
  }

  it('folds and unfolds the whole screen', () => {
    show(two);
    expect(all()?.textContent).toBe('Collapse all');
    act(() => all()?.click());
    expect(host.querySelector('#a')).toBeNull();
    expect(host.querySelector('#b')).toBeNull();
    expect(all()?.textContent).toBe('Expand all');
    act(() => all()?.click());
    expect(host.querySelector('#a')).not.toBeNull();
  });

  it('stays away from a screen with one section, where the heading is it', () => {
    show(
      <FoldScope value="home">
        <FoldAll />
        <Page>
          <SectionLabel>Only</SectionLabel>
          <p id="a">a</p>
        </Page>
      </FoldScope>,
    );
    expect(all()).toBeUndefined();
    expect(heads()).toEqual(['Only']);
  });
});

describe('what it leaves alone', () => {
  it('a screen with no headings at all', () => {
    show(
      <FoldScope value="home">
        <Page>
          <p id="only">nothing to fold</p>
        </Page>
      </FoldScope>,
    );
    expect(heads()).toEqual([]);
    expect(host.querySelector('#only')?.textContent).toBe('nothing to fold');
  });

  it('a list’s own children, which stay its children', () => {
    show(
      <FoldScope value="home">
        <Page>
          <ul>
            <li>
              <SectionLabel>Inside a list</SectionLabel>
              <p id="deep">a</p>
            </li>
          </ul>
        </Page>
      </FoldScope>,
    );
    // It folds — nothing is wrapped around a section, so a heading inside a
    // list is a heading like any other and the list is still a list.
    expect(heads()).toEqual(['Inside a list']);
    expect(host.querySelector('ul > li > h2')).not.toBeNull();
    tap('Inside a list');
    expect(host.querySelector('#deep')).toBeNull();
  });

  it('a screen that has asked not to fold', () => {
    show(
      <FoldScope value="home">
        <Page folds={false}>
          <SectionLabel>Left alone</SectionLabel>
          <p id="a">a</p>
        </Page>
      </FoldScope>,
    );
    expect(heads()).toEqual([]);
    expect(host.querySelector('#a')).not.toBeNull();
  });
});
