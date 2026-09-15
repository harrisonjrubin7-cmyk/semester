// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Popover } from './Popover';
import { TabPeek } from './TabPeek';

/**
 * What the strip draws over the app is drawn from the frame, not from the strip.
 *
 * The bug this holds shut was live on two of the three layouts and total on
 * one of them. `.device > *` puts every direct child at `z-index: 1` and
 * `isolation: isolate` on `.device` closes the context around them, so the
 * tab strip — a direct child, drawn before the header — was a 1, and the
 * `z-index: 90` this panel declares was spent inside it. The header is a 3.
 *
 * On a phone the result was the tab menu painted behind the screen's title,
 * the sample banner and the page text, with **Pin this tab** invisible and a
 * tap on it landing on the heading: `elementFromPoint` over the row returned
 * `H1.chrome-text`. The workspace had already raised its own strip to 21 for
 * a different reason, which is why the same menu worked there and hid
 * everywhere else.
 *
 * The hover card was the same fault with a quieter symptom: `z-index: 60`
 * inside the same 1, so on the wide layout resting on a tab drew a card that
 * was entirely behind the header — nothing appeared at all, and the
 * screenshot that proved it shows only the strip. It is `pointer-events:
 * none` by design, which is why hit testing alone could not tell: the
 * measurement had to lift that first, and then `elementFromPoint` over the
 * card returned `HEADER.app-header`.
 *
 * jsdom computes no stacking, so the assertions are about the tree rather
 * than the paint — but the tree is the whole of the fix, and it is exactly
 * what a later refactor would undo without noticing. Rendered rather than
 * read off the source because `Popover` is the shell four menus share, and a
 * test on the source would pass on a copy of it that had been moved back.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

/** The app's frame, with the two children the bug was between. */
const frame = () => {
  host = document.createElement('div');
  host.innerHTML = '<div class="device"><div class="strip"></div><header></header></div>';
  document.body.append(host);
  return host.querySelector<HTMLDivElement>('.strip')!;
};

const panel = () => host.querySelector<HTMLDivElement>('[role="dialog"]');

beforeEach(() => {
  const strip = frame();
  act(() => {
    root = createRoot(strip);
  });
  act(() => {
    root.render(
      <Popover label="What this tab can do" corner={{ x: 20, y: 60 }} onClose={() => {}}>
        <button type="button">Pin this tab</button>
      </Popover>,
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('a menu', () => {
  it('is drawn from the frame rather than from the control that opened it', () => {
    const menu = panel();
    expect(menu, 'the panel rendered at all').not.toBeNull();
    expect(menu?.parentElement?.className, 'mounted on `.device` itself').toBe('device');
  });

  it('is not inside the strip, whose z-index it would be trapped in', () => {
    const strip = host.querySelector('.strip');
    expect(strip?.contains(panel()!), 'the panel escaped the strip').toBe(false);
  });

  it('is still drawn in the app materials, which are scoped to the frame', () => {
    // `.device .bare`, `.device .btn`, `.device .input`: outside the frame the
    // rows would be browser buttons. This is why it is not `document.body`.
    expect(host.querySelector('.device')?.contains(panel()!), 'inside `.device`').toBe(true);
  });

  it('keeps what it was given, so the portal is a move and not a rebuild', () => {
    expect(panel()?.getAttribute('aria-label')).toBe('What this tab can do');
    expect(panel()?.textContent).toContain('Pin this tab');
  });
});

describe('the hover card', () => {
  /*
   * Rendered into the strip the way the strip renders it, and read back from
   * the frame. Its own `beforeEach` replaces the menu above.
   */
  beforeEach(() => {
    act(() => {
      root.render(
        <TabPeek
          peek={{ title: 'Calendar', kind: 'Screen' }}
          at={{ left: 20, bottom: 40 }}
          id="peek-1"
        />,
      );
    });
  });

  it('is drawn from the frame, where its z-index is worth something', () => {
    const card = host.querySelector('[role="tooltip"]');
    expect(card, 'the card rendered at all').not.toBeNull();
    expect(card?.parentElement?.className, 'mounted on `.device` itself').toBe('device');
    expect(host.querySelector('.strip')?.contains(card!), 'escaped the strip').toBe(false);
  });

  it('keeps the id the tab points at with aria-describedby', () => {
    // The association is by id across the document, so moving the card does
    // not break it — but an id dropped in the move would.
    expect(document.getElementById('peek-1'), 'findable by id from anywhere').not.toBeNull();
  });
});
