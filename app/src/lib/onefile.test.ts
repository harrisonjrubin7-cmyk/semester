import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { sources, withoutComments } from '../styles/rules';

/**
 * One file picker, as a test rather than as a habit.
 *
 * `lib/onecontrol.test.ts` guards the block action button; this guards the
 * control that had the worse failure. Twelve file inputs across nine screens
 * were all written the same way — `type="file"` with `display: none` or
 * `hidden`, a ref, and a button whose `onClick` called `.click()` on it — and
 * every one of them could fail with nothing on screen:
 *
 *  - a scripted `.click()` has to land inside what the browser counts as a
 *    user gesture, and some engines decline to open a picker for an element
 *    that is not rendered at all;
 *  - the ref can be null;
 *  - the input keeps its value, so choosing the same file twice in a row
 *    fires `change` once.
 *
 * None of the three throws. The button simply does nothing, which is
 * indistinguishable from a broken app — and it is exactly what was reported
 * on New course.
 *
 * `FilePick` in `components/ui.tsx` owns it now: the input itself lies across
 * the button at zero opacity, so the press lands on the control the browser
 * already knows how to open. This is what keeps the four-line version from
 * coming back, because the four-line version looks like it works.
 *
 * ## The rule
 *
 * No `<input type="file">` anywhere but the component. Not "no hidden one" —
 * every case in this app is expressible through `FilePick`, including the two
 * that need `capture` for the rear camera, so the flat rule is the true one
 * and there is nothing to argue about at the edges.
 */

const SRC = join(process.cwd(), 'src');

/** The component's own markup, which is the one place this may be written. */
const OWNER = 'components/ui.tsx';

/**
 * `<input … type="file" …>`, however the attributes are ordered.
 *
 * Two patterns rather than one lookahead: `type` is written before the other
 * attributes about as often as after, and a single scan from `<input` to the
 * closing `>` would run past a self-closing tag into the next element.
 */
const FILE_INPUT = /<input\b[^>]*\btype="file"/;

function handWritten(text: string): boolean {
  return FILE_INPUT.test(text);
}

describe('the file picker has one implementation', () => {
  it('is not written out by hand anywhere else', () => {
    const offenders = sources(SRC)
      .filter((f) => !f.path.endsWith(OWNER))
      // Named, not counted: "3 problems" is what somebody greps around.
      .map((f) => ({ path: f.path.slice(f.path.indexOf('/src/') + 5), text: withoutComments(f.text) }))
      .filter((f) => handWritten(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('is still written in the component, or this rule is guarding nothing', () => {
    const owner = sources(SRC).find((f) => f.path.endsWith(OWNER));
    expect(owner && handWritten(withoutComments(owner.text))).toBe(true);
  });
});

/**
 * The rule catching the thing it exists to catch.
 *
 * Against strings, so the shape stays checked after it has been deleted from
 * the nine files — otherwise this passes because the code is gone rather than
 * because the rule works.
 */
describe('what it catches', () => {
  it('catches the pattern this replaced, hidden either way', () => {
    expect(
      handWritten(`<input ref={file} type="file" multiple style={{ display: 'none' }} />`),
    ).toBe(true);
    expect(handWritten(`<input ref={file} type="file" accept=".csv" hidden />`)).toBe(true);
  });

  it('catches one with the type written last', () => {
    expect(handWritten(`<input\n  ref={camera}\n  accept="image/*"\n  type="file"\n/>`)).toBe(true);
  });

  it('catches a visible one too — the rule is about where it lives', () => {
    expect(handWritten(`<input type="file" onChange={take} />`)).toBe(true);
  });

  it('leaves every other input alone', () => {
    expect(handWritten(`<input className="input" value={hint} onChange={set} />`)).toBe(false);
    expect(handWritten(`<input type="checkbox" checked={on} />`)).toBe(false);
    expect(handWritten(`<input type="date" value={iso} />`)).toBe(false);
    // The word in prose, or in a variable, is not a control.
    expect(handWritten(`const kind = 'file';`)).toBe(false);
  });

  it('leaves a FilePick alone, which is the whole point', () => {
    expect(
      handWritten(`<FilePick accept=".pdf" onPick={(f) => void read(f)}>Choose files</FilePick>`),
    ).toBe(false);
  });
});
