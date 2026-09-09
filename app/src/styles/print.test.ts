import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What comes off the screen and onto the page.
 *
 * Thirteen screens carry a Print button, and printing is not nostalgia in a
 * university — a cram sheet goes on a wall and an exam hall does not allow a
 * phone. The print rule dropped every `<button>`, on the reasonable ground
 * that anything you press is noise on paper.
 *
 * It is not reasonable in this app. A deadline, a task, an appointment and a
 * campus listing are all drawn as a row you press, so the row is a `<button>`,
 * so the row was not on the paper. Measured on The week ahead, which has a
 * button that says "Print the week": "Reflection #2", "Quiz #2", "Midterm"
 * and "CORE 2500" were all on screen and none of them on the page — the
 * printed week had its headings, its empty days, and not one deadline.
 *
 * ## What this test can and cannot do
 *
 * It cannot print. A browser did that, on every screen that offers the button
 * and a dozen that do not, comparing the text on screen with the text under
 * `print` media before and after — 44% to 92% on The week ahead, 7% to 71% on
 * Courses, with the chrome on paper unchanged from before.
 *
 * What it holds is the pair of rules that survived that measurement, because
 * each is one selector away from silently undoing the other.
 */

const CSS = readFileSync(new URL('./app.css', import.meta.url), 'utf8');
const PRINT = CSS.slice(CSS.indexOf('@media print'));

describe('the print rule', () => {
  it('keeps the rows, which in this app are buttons', () => {
    // `button` alone took 172 of them off the paper.
    expect(PRINT).toContain('button:not(.tappable)');
    expect(PRINT).not.toMatch(/^\s*button,\s*$/m);
  });

  it('still drops the toggles, which never are', () => {
    expect(PRINT).toContain('button[aria-pressed]');
  });
});

describe('a control wearing a row’s clothes', () => {
  /*
   * The rule the selector above cannot express.
   *
   * `aria-pressed` means a two-state control every time in this codebase and
   * never a row, so the stylesheet can find those on its own. A control that
   * is `.tappable` and says nothing about being pressed is invisible to it,
   * and there is no attribute to hang it on — so those say `no-print` where
   * they are written, and this is the list of them.
   *
   * A new one is not a failure here. It is a line to add, once somebody has
   * looked at the printed page and decided which kind it is.
   */
  const NAMED = ['Fold.tsx', 'KindKey.tsx', 'Clashes.tsx'];

  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? sources(join(dir, e.name))
        : e.name.endsWith('.tsx') && !e.name.includes('.test.')
          ? [join(dir, e.name)]
          : [],
    );

  it('says so where it is written, on the three that cannot be found by selector', () => {
    const root = new URL('..', import.meta.url).pathname;
    const marked = sources(root)
      .filter((f) => {
        const src = readFileSync(f, 'utf8');
        /*
         * The class list, not the tag.
         *
         * Matching the whole opening tag counted the comment beside the mark
         * as the mark: removing `no-print` from `Fold.tsx`'s className left
         * the sentence explaining it, the tag still had the words in it, and
         * the mutation ran green. Found by mutating, not by reading.
         */
        return [...src.matchAll(/className="([^"]*)"/g)].some(
          (m) => m[1].includes('tappable') && m[1].includes('no-print'),
        );
      })
      .map((f) => f.split('/').pop() ?? '');
    expect(marked.sort()).toEqual([...NAMED].sort());
  });

  it('leaves no toggle relying on a hand-written mark', () => {
    // Belt and braces on one button is noise; the selector covers every
    // `aria-pressed`, and a `no-print` beside one would hide why.
    const root = new URL('..', import.meta.url).pathname;
    for (const f of sources(root)) {
      const src = readFileSync(f, 'utf8');
      // Same trap the other way: a tag holding both the attribute and a
      // comment about printing would read as a redundant mark.
      for (const m of src.matchAll(/<button\b[\s\S]*?\n\s*>/g)) {
        if (!m[0].includes('aria-pressed')) continue;
        const classes = /className="([^"]*)"/.exec(m[0])?.[1] ?? '';
        expect(classes.includes('no-print'), f).toBe(false);
      }
    }
  });
});
