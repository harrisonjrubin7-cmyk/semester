// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { focusablesIn, nextInRing } from './modal';

/**
 * The trap, and the rule that keeps every modal using it.
 *
 * Two halves again, the way `title.test.ts` is. The ring is arithmetic over a
 * list and is checked directly. Whether a dialog is *wired* to it is a fact
 * about seven files, and the reason this is worth a test rather than a review
 * is that the failure is silent: a dialog with `aria-modal="true"` and no
 * trap looks correct, reads correctly, and passes every other check in this
 * suite. It is wrong only under the Tab key, which nothing here presses.
 */

function box(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.append(el);
  return el;
}

describe('the tab ring', () => {
  it('takes the controls a browser would offer, in order', () => {
    const el = box('<button id="a"></button><input id="b"><a href="#" id="c"></a><textarea id="d"></textarea>');
    expect(focusablesIn(el).map((n) => n.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('leaves out what cannot take focus', () => {
    const el = box(`
      <button id="a"></button>
      <button id="off" disabled></button>
      <input id="scripted" tabindex="-1">
      <button id="attr" hidden></button>
      <button id="quiet" aria-hidden="true"></button>
      <input id="filepicker" style="display: none">
      <div hidden><button id="inside"></button></div>
      <button id="z"></button>
    `);
    // A trap that offers a control which cannot take focus calls `focus()` on
    // nothing, focus stays where it was, and the ring stops — somebody stuck
    // in a dialog by the code that was keeping them in it.
    expect(focusablesIn(el).map((n) => n.id)).toEqual(['a', 'z']);
  });

  it('does not reach past the dialog it was given', () => {
    const outside = box('<button id="behind"></button>');
    const el = box('<button id="in"></button>');
    expect(focusablesIn(el).map((n) => n.id)).toEqual(['in']);
    expect(outside.querySelector('#behind')).not.toBeNull();
  });
});

describe('where Tab goes', () => {
  const ring = ['a', 'b', 'c'].map((id) => {
    const el = document.createElement('button');
    el.id = id;
    return el;
  });
  const [first, mid, last] = ring;

  it('lets the browser do the middle of the ring', () => {
    expect(nextInRing(ring, first, false)).toBeNull();
    expect(nextInRing(ring, mid, false)).toBeNull();
    expect(nextInRing(ring, mid, true)).toBeNull();
    expect(nextInRing(ring, last, true)).toBeNull();
  });

  it('wraps at both ends', () => {
    expect(nextInRing(ring, last, false)).toBe(first);
    expect(nextInRing(ring, first, true)).toBe(last);
  });

  it('pulls focus back in when it is already outside', () => {
    /*
     * The case a hand-rolled trap misses. Delete the row that had focus — or
     * disable the button — and focus is on `<body>`: it is neither the first
     * element nor the last, so a trap asking only about the two ends does
     * nothing, and the next Tab starts at the top of the app behind the
     * dialog.
     */
    expect(nextInRing(ring, document.body, false)).toBe(first);
    expect(nextInRing(ring, document.body, true)).toBe(last);
    expect(nextInRing(ring, null, false)).toBe(first);
  });

  it('has nothing to say about an empty dialog', () => {
    expect(nextInRing([], document.body, false)).toBeNull();
  });
});

/**
 * Every `aria-modal="true"` in the app is wired to the trap.
 *
 * `aria-modal` tells a screen reader that nothing outside the element exists.
 * Declaring it without confining the Tab key is a promise the markup does not
 * keep — and six of the seven dialogs that declare it were not keeping it.
 *
 * The check is on the source rather than in a browser, for the same reason
 * `taps.test.ts` and `fields.test.ts` are: what can be held here is the
 * mechanism — that a file saying `aria-modal="true"` also reaches for
 * `a11y/modal.ts` — so a dialog added next term cannot quietly ship without
 * one.
 */
function tsx(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) tsx(p, out);
    else if (/\.tsx$/.test(e) && !/\.test\./.test(e)) out.push(p);
  }
  return out;
}

describe('every dialog that says aria-modal', () => {
  const files = tsx('src').map((f) => ({ file: f, src: readFileSync(f, 'utf8') }));
  /*
   * `"true"` and the dynamic ones. Not `aria-modal="false"`, which is a real
   * and different claim: `Keys` is a 300px card in the corner of a wide
   * window with the app live behind it, and saying so is correct — it is not
   * a modal and must not trap anything.
   */
  const modals = files.filter(({ src }) => /aria-modal=(?:"true"|\{)/.test(src));

  it('is a set this test still knows about', () => {
    // Guards the assertions below: were the attribute renamed or the dialogs
    // moved, an empty list would pass everything that follows.
    expect(modals.length).toBeGreaterThanOrEqual(7);
  });

  it('keeps the Tab key inside it', () => {
    const untrapped = modals
      .filter(({ src }) => !/from '.*a11y\/modal'/.test(src))
      .map(({ file }) => file);
    expect(untrapped, 'declares aria-modal without using a11y/modal.ts').toEqual([]);
  });

  it('has no second copy of the ring', () => {
    /*
     * Two existed — `Folder` asked for `button:not([disabled])`, `Assistant`
     * for buttons, links and fields but not for `[disabled]` — and each was
     * wrong in a way the other was not. What makes a third one easy is
     * copying either. The shape they shared was a `querySelectorAll` of a
     * focusable-looking selector inside a key handler.
     */
    const copies = files
      .filter(({ file }) => !file.endsWith('a11y/modal.ts'))
      .filter(({ src }) => /querySelectorAll<HTMLElement>\(\s*\n?\s*['"`][^'"`]*\[tabindex\]/.test(src))
      .map(({ file }) => file);
    expect(copies, 'the tab ring lives in a11y/modal.ts').toEqual([]);
  });
});
