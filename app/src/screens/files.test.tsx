// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { ORDER } from '../lib/menus';
import { Write } from './Write';
import { Sheet } from './Sheet';
import { Deck } from './Deck';

/**
 * The bar across the top of the three screens that make a file.
 *
 * `lib/menus.test.ts` holds the rules about a menu bar — greying a command
 * with nothing behind it, the order the menus are read in, ids that clash.
 * None of that reaches the thing those rules exist for, which is that Write,
 * Sheet and the deck editor each build a real bar and that all three build it
 * the same way. A screen could pass every rule in that file by declaring no
 * menus at all.
 *
 * So this mounts each of the three cold, starts a file from the shelf the way
 * somebody would, and reads the bar off the DOM. It is the test that fails if
 * one of them drifts back to a screen of stacked buttons, or invents a
 * seventh menu called Actions, or puts Insert before Edit.
 *
 * ## It runs at both widths
 *
 * The responsive rule is the one part of this that is genuinely two drawings,
 * and the promise made in `components/Bench.tsx` is that nothing is lost in
 * the narrow one. So the phone is checked for exactly that: one button, and
 * behind it every menu that the wide bar shows.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

/**
 * A viewport, for `lib/media.ts` to read.
 *
 * jsdom has no layout, so `matchMedia` answers false to everything and every
 * component that asks would believe it is on a phone. This answers the two
 * queries `useTier` asks by the width it is given.
 */
function viewport(width: number) {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    return {
      matches: min ? width >= Number(min[1]) : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

function show(node: ReactNode) {
  act(() => {
    root.render(<StoreProvider>{node}</StoreProvider>);
  });
}

function buttons(): HTMLButtonElement[] {
  return [...host.querySelectorAll('button')] as HTMLButtonElement[];
}

function press(named: RegExp) {
  const button = buttons().find((b) => named.test((b.textContent ?? '').trim()));
  if (!button) {
    throw new Error(
      `no button reading ${named} — saw ${JSON.stringify(buttons().map((b) => (b.textContent ?? '').trim()))}`,
    );
  }
  act(() => {
    button.click();
  });
}

/** The menu names drawn on the bar, as they read. */
function bar(): string[] {
  return [...host.querySelectorAll('.bench-name')].map((b) => (b.textContent ?? '').trim());
}

/** Every item in whatever menu is open, and whether it can be pressed. */
function items(): { label: string; live: boolean }[] {
  return [...host.querySelectorAll('.bench-item')].map((b) => ({
    label: (b.textContent ?? '').trim(),
    live: !(b as HTMLButtonElement).disabled,
  }));
}

beforeAll(async () => {
  await loadSeed();
});

/** A clean tree, for a test that has to change the viewport half-way through. */
function remount() {
  if (root) act(() => root.unmount());
  host?.remove();
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
}

beforeEach(() => {
  localStorage.clear();
  viewport(1280);
  remount();
});

/**
 * The three, with the starter that opens an empty one of each and the field
 * that puts something in it.
 *
 * The empty state and the filled one are genuinely different bars — File
 * cannot export a document with nothing in it, and Sheet's Edit menu has
 * nothing to clear or copy until a cell holds something — so both are
 * checked, and the rule about a live command is only asked of the one where
 * there is something to do.
 */
const SCREENS = [
  {
    name: 'Write',
    node: <Write />,
    blank: /^Blank document$/,
    title: 'Document title',
    into: 'Paragraph',
    text: 'The recommendation first.',
    exports: /Download as Word/,
  },
  {
    name: 'Sheet',
    node: <Sheet />,
    blank: /^Blank sheet/,
    title: 'Sheet title',
    into: 'Cell A1',
    text: '12',
    exports: /Download as Excel/,
  },
  {
    name: 'the deck editor',
    node: <Deck />,
    blank: /^Blank presentation$/,
    title: 'Deck title',
    into: 'Title on slide 1',
    text: 'Federalism',
    exports: /Download as PowerPoint/,
  },
] as const;

describe.each(SCREENS)('$name', ({ node, blank, title, into, text, exports }) => {
  const open = () => {
    show(node);
    press(blank);
  };

  /** Open one and put something in it, so the bar is the one people see. */
  const openFilled = () => {
    open();
    const el = host.querySelector(`[aria-label="${into}"]`) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    if (!el) throw new Error(`no field labelled “${into}”`);
    act(() => {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, 'value')!.set!.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  it('opens a new file from the shelf, into an editor with a title', () => {
    open();
    expect(host.querySelector(`[aria-label="${title}"]`)).not.toBe(null);
  });

  it('draws a menu bar rather than a screen of stacked buttons', () => {
    open();
    expect(bar().length).toBeGreaterThanOrEqual(3);
    expect(bar()).toContain('File');
  });

  it('reads its menus in the order every other editor reads them', () => {
    open();
    const names = bar().map((n) => n.toLowerCase());
    const ranks = names.map((n) => (ORDER as readonly string[]).indexOf(n));
    expect(ranks).not.toContain(-1);
    expect([...ranks]).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('names each menu once', () => {
    open();
    expect(new Set(bar()).size).toBe(bar().length);
  });

  it('has something live behind every menu, once the file has something in it', () => {
    openFilled();
    for (const name of bar()) {
      press(new RegExp(`^${name}$`));
      const drawn = items();
      expect(drawn.length, `${name} drew no items`).toBeGreaterThan(0);
      expect(drawn.some((i) => i.live), `nothing in ${name} can be pressed`).toBe(true);
      // Close it again, so the next menu's items are the only ones counted.
      press(new RegExp(`^${name}$`));
    }
  });

  it('offers the same export whether or not there is anything to export yet', () => {
    /*
     * The item stays on the menu when it cannot be done.
     *
     * "There is no such thing in this app" and "there is nothing here to do it
     * to yet" are different facts, and a menu that hides the second teaches
     * somebody the first. So File always names the file this screen makes;
     * whether it is live is `lib/menus.ts`'s business.
     */
    open();
    press(/^File$/);
    expect(items().some((i) => exports.test(i.label))).toBe(true);

    // A clean tree rather than the same one: the store keeps the file that
    // was just made, so the shelf this started from is no longer drawn.
    remount();
    openFilled();
    press(/^File$/);
    expect(items().some((i) => exports.test(i.label) && i.live)).toBe(true);
  });

  it('folds the whole bar into one button on a phone, losing no menu', () => {
    open();
    const wide = bar();
    expect(wide.length).toBeGreaterThan(1);

    // A fresh root: `useMedia` reads the query once per mount, so a viewport
    // changed under a live tree is a viewport nothing has been told about.
    viewport(390);
    remount();
    open();

    expect(bar()).toEqual(['Menu']);
    expect(host.querySelector('.bench-all')).toBe(null);
    press(/^Menu$/);
    expect(
      [...host.querySelectorAll('.bench-all-name')].map((n) => (n.textContent ?? '').trim()),
    ).toEqual(wide);
  });
});

/**
 * The shelf all three open on.
 *
 * `lib/shelf.test.ts` holds the sorting and the four date headings. This is
 * the drawing of them, checked once — the component is shared, so checking it
 * three times would be checking React — and what it is really guarding is
 * that the shelf is a shelf: something to start from at the top, what you
 * already have below, and controls that change what is shown rather than
 * decoration that does not.
 */
describe('the shelf', () => {
  /** Every heading on the shelf: the two section names and the date groups. */
  const headings = () =>
    [...host.querySelectorAll('.gal-head-name, .gal-when')].map((h) =>
      (h.textContent ?? '').trim(),
    );

  const names = () =>
    [...host.querySelectorAll('.gal-name')].map((n) => (n.textContent ?? '').trim());

  it('opens with something to start from and somewhere for what you have', () => {
    show(<Write />);
    expect(headings()).toEqual(['Start a new document', 'Recent documents']);
  });

  it('puts a blank first, then the shapes, all of them on the row', () => {
    show(<Write />);
    const starters = [...host.querySelectorAll('.gal-starter .gal-name')].map((n) =>
      (n.textContent ?? '').trim(),
    );
    expect(starters[0]).toBe('Blank document');
    // The seven templates used to be behind a button that had to be pressed
    // before anybody could find out there were any.
    expect(starters.length).toBeGreaterThan(4);
  });

  it('says a new shelf is empty rather than drawing an empty grid', () => {
    show(<Write />);
    expect(host.textContent).toContain('Nothing written yet');
  });

  it('files what you just made under today', () => {
    show(<Write />);
    press(/^Blank document$/);
    press(/^All documents$/);
    expect(headings()).toContain('Today');
    expect(names()).toContain('Untitled document');
  });

  it('drops the date headings when the sort stops being by date', () => {
    show(<Write />);
    press(/^Blank document$/);
    press(/^All documents$/);
    const sort = host.querySelector('[aria-label="What to sort by"]') as HTMLSelectElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(
        sort,
        'name',
      );
      sort.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(headings()).not.toContain('Today');
  });

  it('swaps thumbnails for rows, and back', () => {
    show(<Write />);
    press(/^Blank document$/);
    press(/^All documents$/);
    expect(host.querySelector('.gal-grid')).not.toBe(null);
    press(/^List$/);
    expect(host.querySelector('.gal-rows')).not.toBe(null);
    expect(host.querySelector('.gal-grid')).toBe(null);
    press(/^Grid$/);
    expect(host.querySelector('.gal-grid')).not.toBe(null);
  });
});
