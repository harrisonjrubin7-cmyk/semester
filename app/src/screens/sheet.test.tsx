// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { Sheet } from './Sheet';

/**
 * The spreadsheet, driven the way somebody drives one.
 *
 * `lib/sheetedit.test.ts` holds the arithmetic of moving a formula and
 * `lib/ribbon.test.ts` the rules a toolbar has to hold. Neither reaches the
 * thing those exist for, which is that pressing a button on this screen does
 * what the button says — a ribbon can pass every rule in `ribbon.ts` while
 * being wired to nothing.
 *
 * So this mounts the screen cold, starts a blank sheet the way the shelf does,
 * and presses the controls. Every test here is a thing that was impossible on
 * this screen before the ribbon existed.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

/** jsdom has no layout, so `useTier` would believe every screen is a phone. */
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

function press(named: RegExp) {
  const button = [...host.querySelectorAll('button')].find((b) =>
    named.test((b.textContent ?? '').trim()),
  );
  if (!button) throw new Error(`no button reading ${named}`);
  act(() => {
    (button as HTMLButtonElement).click();
  });
}

/** Press the control with this accessible name — the glyph buttons have no words. */
function pressNamed(label: string) {
  const el = host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
  if (!el) throw new Error(`no control named “${label}”`);
  act(() => {
    el.click();
  });
}

/**
 * Open a ribbon tab.
 *
 * By role rather than by the words on it, because the menu bar above the
 * ribbon has a View and a Data of its own — pressing the first button that
 * reads "View" opens the menu and leaves the ribbon where it was, which is a
 * test that passes nothing and fails confusingly.
 */
function tab(name: string) {
  const el = [...host.querySelectorAll('[role="tab"]')].find(
    (t) => (t.textContent ?? '').trim() === name,
  ) as HTMLButtonElement | undefined;
  if (!el) throw new Error(`no ribbon tab called “${name}”`);
  act(() => {
    el.click();
  });
}

/**
 * Put the cursor in a cell.
 *
 * A click on an `<input>` does not focus it in jsdom, and the cell *is* an
 * input — so a test that clicked one moved nothing and then acted on
 * wherever the cursor happened to be.
 */
function at(address: string) {
  const el = field(`Cell ${address}`);
  act(() => {
    el.focus();
  });
}

/** Take the cursor out of the grid, so every cell shows its answer again. */
function away() {
  const el = host.querySelector('input:focus') as HTMLInputElement | null;
  act(() => {
    el?.blur();
  });
}

/**
 * The box with this label.
 *
 * A wrapped cell is a `<textarea>` and every other box an `<input>` — see
 * `CellStyle.wrap` — so this asks for either. Both answer `value`,
 * `selectionStart` and `focus`, which is all any test here does with one.
 */
function field(label: string): HTMLInputElement {
  const el = host.querySelector(
    `input[aria-label="${label}"], textarea[aria-label="${label}"]`,
  ) as HTMLInputElement | null;
  if (!el) throw new Error(`no field labelled “${label}”`);
  return el;
}

/** Type into a real input the way a person does, through React's own setter. */
function type(label: string, text: string) {
  const el = field(label);
  act(() => {
    el.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/**
 * A key pressed in a cell, as that cell's own handler sees it.
 *
 * Returned so a test can ask whether the grid took the key or left it to the
 * browser, which is the whole question over ⌘C in a text box.
 */
function key(
  address: string,
  named: string,
  held: { meta?: boolean; shift?: boolean } = {},
): KeyboardEvent {
  const el = field(`Cell ${address}`);
  const event = new KeyboardEvent('keydown', {
    key: named,
    metaKey: held.meta ?? false,
    shiftKey: held.shift ?? false,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    el.dispatchEvent(event);
  });
  return event;
}

/** Select part of what is typed in a cell, the way a caret dragged over it does. */
function within(address: string, from: number, to: number) {
  const el = field(`Cell ${address}`);
  act(() => {
    el.focus();
    el.setSelectionRange(from, to);
  });
}

/** What a cell is showing right now: its answer, or its formula while focused. */
function cell(address: string): string {
  return field(`Cell ${address}`).value;
}

function status(): string {
  return (host.querySelector('.sbar-stat')?.textContent ?? '').trim();
}

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  localStorage.clear();
  viewport(1280);
  if (root) act(() => root.unmount());
  host?.remove();
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
  act(() => {
    root.render(
      <StoreProvider>
        <Sheet />
      </StoreProvider>,
    );
  });
  press(/^Blank sheet/);
});

/** A small gradebook with a total under it, which is what all of this is for. */
function marks() {
  type('Cell A1', 'Mark');
  type('Cell A2', '80');
  type('Cell A3', '90');
  type('Cell A4', '=SUM(A2:A3)');
}

describe('the ribbon', () => {
  it('draws the tabs a spreadsheet has, with Home open', () => {
    const tabs = [...host.querySelectorAll('[role="tab"]')].map((t) => (t.textContent ?? '').trim());
    expect(tabs).toEqual(['Home', 'Insert', 'Formulas', 'Data', 'View']);
    expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Home');
  });

  it('names every group, which is the whole reason it is a ribbon', () => {
    const groups = [...host.querySelectorAll('.rib-group-name')].map((g) =>
      (g.textContent ?? '').trim(),
    );
    expect(groups).toEqual(['Clipboard', 'Font', 'Alignment', 'Number', 'Cells', 'Editing']);
  });

  it('changes what is under it when another tab is pressed', () => {
    tab('View');
    const groups = [...host.querySelectorAll('.rib-group-name')].map((g) =>
      (g.textContent ?? '').trim(),
    );
    expect(groups).toEqual(['Show', 'Zoom']);
  });
});

describe('editing the shape of the sheet', () => {
  it('puts a row in the middle and takes the formula with it', () => {
    // The move the old screen could not make at all: it grew at the bottom,
    // so a forgotten reading meant retyping everything under it.
    marks();
    at('A2');
    pressNamed('Insert a row above the selection');
    away();
    expect(cell('A3')).toBe('80');
    expect(cell('A5')).toBe('170');
  });

  it('deletes a reading out of the middle and shrinks the total over it', () => {
    // Not #REF!: only part of what was summed has gone, so `=SUM(A2:A3)`
    // becomes `=SUM(A2:A2)` and the gradebook still adds up.
    marks();
    at('A2');
    pressNamed('Delete the selected rows');
    away();
    expect(cell('A2')).toBe('90');
    expect(cell('A3')).toBe('90');
  });

  it('says #REF! for a formula whose one cell was deleted', () => {
    type('Cell A1', '5');
    type('Cell B1', '=A2');
    type('Cell A2', '7');
    at('A2');
    pressNamed('Delete the selected rows');
    away();
    expect(cell('B1')).toBe('#REF!');
  });

  it('fills a formula down a selected column', () => {
    type('Cell A1', '4');
    type('Cell A2', '6');
    type('Cell B1', '=A1*2');
    pressNamed('Select column B');
    pressNamed('Fill down');
    away();
    expect(cell('B2')).toBe('12');
  });
});

describe('what the ribbon writes', () => {
  it('totals the run of cells above the cursor', () => {
    type('Cell A1', '80');
    type('Cell A2', '90');
    at('A3');
    pressNamed('AutoSum');
    // What lands in the cell is the formula, not the number — read off the
    // formula bar, which is where somebody checks the range it guessed.
    expect(field('What is in A3').value).toBe('=SUM(A1:A2)');
    expect(cell('A3')).toBe('170');
  });

  it('totals a selected block into the cell under it', () => {
    type('Cell A1', '80');
    type('Cell A2', '90');
    pressNamed('Select column A');
    pressNamed('AutoSum');
    away();
    // Selecting the letter takes the whole twelve-row column, so there is no
    // row under it — the grid grows one rather than putting the SUM inside
    // its own range, which used to read #CYCLE!.
    expect(cell('A13')).toBe('170');
  });

  it('formats a cell without changing what is in it', () => {
    // The one promise a spreadsheet must not break: the picture is over the
    // number, never instead of it.
    type('Cell A1', '0.8');
    away();
    const pick = host.querySelector('select[aria-label="Number format"]') as HTMLSelectElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(
        pick,
        'percent',
      );
      pick.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(cell('A1')).toBe('80%');
    tab('Formulas');
    press(/^Show formulas$/);
    expect(cell('A1')).toBe('0.8');
  });
});

describe('the bars round the grid', () => {
  it('says what a selection comes to, without anybody writing a SUM', () => {
    type('Cell A1', '10');
    type('Cell A2', '30');
    pressNamed('Select column A');
    expect(status()).toContain('Sum 40');
    expect(status()).toContain('Average 20');
  });

  it('names the one cell the cursor is in, and what is in it', () => {
    type('Cell A1', '=1+1');
    at('A1');
    expect(status()).toContain('A1: =1+1');
    expect(status()).toContain('→ 2');
  });

  it('goes to a cell typed into the name box', () => {
    const box = host.querySelector('.fx-name') as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(box, 'C3');
      box.dispatchEvent(new Event('input', { bubbles: true }));
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect((host.querySelector('.fx-name') as HTMLInputElement).placeholder).toBe('C3');
  });

  it('edits the cell from the formula bar, where the formula fits', () => {
    at('B2');
    type('What is in B2', '=2*21');
    away();
    expect(cell('B2')).toBe('42');
  });

  it('has a tab for every sheet and a button for one more', () => {
    expect(host.querySelectorAll('.stab').length).toBe(2); // the sheet, and +
    pressNamed('A new sheet');
    expect(host.querySelectorAll('.stab').length).toBe(3);
  });
});

/**
 * Cells joined into one, and the values that were under them.
 *
 * Joining does two things at once — it makes the block, and it clears the
 * cells the block now covers — and the screen says so: *undo brings them
 * back*. That sentence was false when it was first written. The clearing went
 * into the undo history and the block did not, so undoing put the values back
 * *underneath* a block still covering them: restored, and invisible, which is
 * the exact fault `lib/joined.ts` exists to avoid.
 *
 * So these are not tests of `joined.ts` — that file has its own — but of the
 * one thing it cannot check: that the screen keeps the promise it makes.
 */
describe('joining cells', () => {
  /** Select a block by putting the cursor in one corner and shift-arrowing. */
  function selectAcross(from: string, steps: number) {
    at(from);
    const el = field(`Cell ${from}`);
    /*
     * One `act` per press, not one round them all.
     *
     * Each shift-right extends from where the selection *now* reaches, and
     * React batches inside a single `act` — so two presses in one batch both
     * read the selection as it was before either, and the block comes out one
     * cell wide however many times the key is pressed.
     */
    act(() => {
      // Right only leaves a cell from its right-hand end — see `moves` in
      // `onKey`. Typing puts the caret there; `focus()` in jsdom does not.
      el.setSelectionRange(el.value.length, el.value.length);
    });
    for (let i = 0; i < steps; i += 1) {
      act(() => {
        el.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }),
        );
      });
    }
  }

  function joined(): { colSpan: number } | null {
    const td = host.querySelector('td.sjoin') as HTMLTableCellElement | null;
    return td ? { colSpan: td.colSpan } : null;
  }

  /** Whether a cell is drawn at all. A covered one is not. */
  function drawn(address: string): boolean {
    return Boolean(host.querySelector(`[aria-label="Cell ${address}"]`));
  }

  function undo() {
    const el = host.querySelector('input:focus, textarea:focus') ?? field('Cell A1');
    act(() => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    });
  }

  beforeEach(() => {
    type('Cell A1', 'Autumn term');
    type('Cell B1', 'under it');
    type('Cell C1', 'under it too');
    away();
  });

  it('draws the block as one cell reaching across the ones it covers', () => {
    selectAcross('A1', 2);
    press(/^Join cells$/);
    expect(joined()).toEqual({ colSpan: 3 });
  });

  it('stops drawing the cells underneath, so nothing invisible is focusable', () => {
    selectAcross('A1', 2);
    press(/^Join cells$/);
    expect(drawn('B1')).toBe(false);
    expect(drawn('C1')).toBe(false);
  });

  it('keeps the top-left value', () => {
    selectAcross('A1', 2);
    press(/^Join cells$/);
    expect(cell('A1')).toBe('Autumn term');
  });

  /*
   * The clearing itself. The *sentence* that reports it cannot be checked
   * here — `say` renders in the app shell, which this test does not mount —
   * so what is pinned is the fact it reports, which is the part that would be
   * a data loss if it changed.
   */
  it('clears what the block now covers, so what is shown is what is summed', () => {
    selectAcross('A1', 2);
    press(/^Join cells$/);
    at('A1');
    press(/^Split apart$/);
    expect(cell('B1')).toBe('');
    expect(cell('C1')).toBe('');
  });

  /*
   * The regression this describe exists for. Both halves have to come back
   * together: the values alone would be worse than neither, because they would
   * be back and covered.
   */
  it('gives back the block and the values together on undo', () => {
    selectAcross('A1', 2);
    press(/^Join cells$/);
    at('A1');
    undo();
    expect(joined()).toBeNull();
    expect(cell('B1')).toBe('under it');
    expect(cell('C1')).toBe('under it too');
  });

  it('splits back apart, though what was cleared stays cleared', () => {
    selectAcross('A1', 2);
    press(/^Join cells$/);
    at('A1');
    press(/^Split apart$/);
    expect(joined()).toBeNull();
    expect(drawn('B1')).toBe(true);
    expect(cell('B1')).toBe('');
  });
});

/**
 * Text that folds instead of running past the edge.
 *
 * A cell is an `<input>`, and no CSS makes one wrap — so a wrapped cell is a
 * different element. That is the whole cost of the feature, and the thing
 * worth pinning is that it is paid only where somebody asked for it.
 */
describe('wrapping text', () => {
  it('leaves an ordinary cell the input it has always been', () => {
    type('Cell A1', 'a note');
    expect(host.querySelector('[aria-label="Cell A1"]')?.tagName).toBe('INPUT');
  });

  it('draws a wrapped cell as a box that can hold more than one line', () => {
    type('Cell A1', 'a note long enough to need folding');
    at('A1');
    pressNamed('Wrap text');
    expect(host.querySelector('[aria-label="Cell A1"]')?.tagName).toBe('TEXTAREA');
  });

  it('keeps what was in it when it changes element', () => {
    type('Cell A1', 'a note long enough to need folding');
    at('A1');
    pressNamed('Wrap text');
    expect(cell('A1')).toBe('a note long enough to need folding');
  });

  it('turns back off, and is an input again', () => {
    type('Cell A1', 'a note');
    at('A1');
    pressNamed('Wrap text');
    pressNamed('Wrap text');
    expect(host.querySelector('[aria-label="Cell A1"]')?.tagName).toBe('INPUT');
  });
});

describe('find and replace', () => {
  it('searches what was typed rather than what is shown, and replaces it', () => {
    type('Cell A1', 'Midterm');
    type('Cell A2', 'Midterm two');
    away();
    tab('Data');
    press(/^Find and replace$/);
    type('Find', 'Midterm');
    expect((host.querySelector('[role="search"]')?.textContent ?? '')).toContain('2 found');
    type('Replace with', 'Final');
    press(/^Replace all$/);
    expect(cell('A1')).toBe('Final');
    expect(cell('A2')).toBe('Final two');
  });
});

describe('the View tab', () => {
  it('takes the headings away and puts them back', () => {
    expect(host.querySelector('[aria-label="Select column A"]')).not.toBe(null);
    tab('View');
    press(/^Headings$/);
    expect(host.querySelector('[aria-label="Select column A"]')).toBe(null);
    press(/^Headings$/);
    expect(host.querySelector('[aria-label="Select column A"]')).not.toBe(null);
  });

  it('zooms to a step somebody can get back from', () => {
    const shown = () => (host.querySelector('.sbar-pc')?.textContent ?? '').trim();
    expect(shown()).toBe('100%');
    pressNamed('Zoom in');
    expect(shown()).toBe('125%');
    pressNamed('Zoom out');
    expect(shown()).toBe('100%');
  });
});

/**
 * The clipboard, which is the app's before it is the system's.
 *
 * `cutOrCopy` fills `clip`, and `pasteIn` prefers `clip` over the system
 * clipboard so a copied `=SUM(B2:B9)` keeps its formula. That preference is
 * what makes a ⌘C the grid does not hear into something worse than nothing:
 * `clip` goes on holding the last block, and the next paste puts that down
 * with no sign on screen that anything was missed. So every route to ⌘C has
 * to leave `clip` holding what was last copied.
 */
describe('copy, cut and paste from the keyboard', () => {
  it('copies the one cell the cursor is in', () => {
    type('Cell A1', '7');
    at('A1');
    key('A1', 'c', { meta: true });
    at('C1');
    pressNamed('Paste');
    away();
    expect(cell('C1')).toBe('7');
  });

  it('replaces what a block left on the clipboard, rather than pasting it again', () => {
    // The silent one: copy a block, copy a single cell, paste — and before
    // this the block came back, two steps late and looking deliberate.
    type('Cell A1', '10');
    type('Cell A2', '20');
    type('Cell B1', '99');
    at('A1');
    key('A1', 'ArrowDown', { shift: true });
    key('A1', 'c', { meta: true });
    at('B1');
    key('B1', 'c', { meta: true });
    at('D1');
    pressNamed('Paste');
    away();
    expect(cell('D1')).toBe('99');
    expect(cell('D2')).toBe('');
  });

  it('leaves a part-selected cell to the browser, clipboard and all', () => {
    type('Cell A1', '10');
    type('Cell A2', '20');
    at('A1');
    key('A1', 'ArrowDown', { shift: true });
    key('A1', 'c', { meta: true });
    type('Cell B1', 'Midterm');
    within('B1', 0, 3);
    const event = key('B1', 'c', { meta: true });
    // Not taken, so `Mid` is copied by the text box the way it always was.
    expect(event.defaultPrevented).toBe(false);
    at('D1');
    pressNamed('Paste');
    away();
    expect(cell('D1')).toBe('10');
    expect(cell('D2')).toBe('20');
  });

  it('copies a cell whose whole value is selected, which is what tabbing in leaves', () => {
    // Sequential focus navigation selects a text input's contents, so a cell
    // reached with Tab from the ribbon arrives fully selected. Measured in
    // Chromium: (0, length). Left to the browser it would copy the same
    // characters and leave `clip` holding the block below.
    type('Cell A1', '10');
    type('Cell A2', '20');
    at('A1');
    key('A1', 'ArrowDown', { shift: true });
    key('A1', 'c', { meta: true });
    type('Cell B1', '99');
    within('B1', 0, 2);
    key('B1', 'c', { meta: true });
    at('D1');
    pressNamed('Paste');
    away();
    expect(cell('D1')).toBe('99');
    expect(cell('D2')).toBe('');
  });

  it('cuts the one cell the cursor is in, and pastes it back elsewhere', () => {
    type('Cell A1', '5');
    at('A1');
    key('A1', 'x', { meta: true });
    at('C1');
    pressNamed('Paste');
    away();
    expect(cell('A1')).toBe('');
    expect(cell('C1')).toBe('5');
  });
});
