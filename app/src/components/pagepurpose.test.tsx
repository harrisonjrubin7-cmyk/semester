// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { Page, PagePurpose } from './Page';

/**
 * Every screen says what it is for.
 *
 * `App.tsx` hands `Page` the current destination's registry sentence, and
 * `Page` draws it unless the screen said something of its own or opted out
 * with `blurb={null}`. See the note on `PagePurpose` in `Page.tsx`.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SENTENCE = 'Care, basic needs and which door to knock on.';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function show(node: ReactNode, purpose: { is: string | undefined } = { is: SENTENCE }) {
  act(() => {
    root.render(<PagePurpose.Provider value={purpose.is}>{node}</PagePurpose.Provider>);
  });
}

const count = (text: string) => host.textContent!.split(text).length - 1;

describe('the purpose sentence', () => {
  it('is the registry sentence when the screen gives none', () => {
    show(
      <Page>
        <p>body</p>
      </Page>,
    );
    expect(count(SENTENCE)).toBe(1);
  });

  it('gives way to the screen’s own sentence', () => {
    show(
      <Page blurb="Three sources, two unread.">
        <p>body</p>
      </Page>,
    );
    expect(count(SENTENCE)).toBe(0);
    expect(count('Three sources, two unread.')).toBe(1);
  });

  it('is not drawn when the screen opts out with null', () => {
    show(
      <Page blurb={null}>
        <p>body</p>
      </Page>,
    );
    expect(count(SENTENCE)).toBe(0);
  });

  it('is not drawn where there is no destination to take it from', () => {
    // A course, a deadline, a flashcard: nested screens with no registry row.
    show(
      <Page>
        <p>body</p>
      </Page>,
      { is: undefined },
    );
    expect(host.textContent).toBe('body');
  });

  it('is drawn once, not again by a frame inside the frame', () => {
    show(
      <Page>
        <Page>
          <p>body</p>
        </Page>
      </Page>,
    );
    expect(count(SENTENCE)).toBe(1);
  });
});
