import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { sources, withoutComments } from '../styles/rules';

/**
 * One implementation per control, as a test rather than as a habit.
 *
 * `lib/onehome.test.ts` guards the screen: no screen may be a tab of another.
 * This guards the control below it, and the failure it exists to catch is the
 * one `components/Reorder.tsx` describes from experience — two arrows written
 * out three times, "the same 24-or-26px width chosen by whoever wrote it
 * last", and an audit that found all three wrong at once and had to fix each
 * separately.
 *
 * The block action button reached seventy copies across forty-two files before
 * anybody counted: nine heights between 34 and 52, five letter-spacings, and
 * the same `type="button"`, `btn btn-* btn-block` and
 * `textTransform: 'uppercase'` re-typed every time. `ActionButton` in
 * `components/ui.tsx` owns it now.
 *
 * ## What is deliberately still allowed
 *
 * The rule matches the *toned* form — `btn btn-primary|secondary|ghost
 * btn-block` on a `type="button"` — because that is exactly what the component
 * renders. Three buttons in the app are close to it and are none of its
 * business, and each fails a different clause rather than needing an exception
 * list:
 *
 * - `screens/Account.tsx` is `type="submit"` inside a form. A submit button is
 *   a different control and the component hard-codes `type="button"`.
 * - `screens/Courses.tsx` and `screens/Privacy.tsx` write `btn btn-block` with
 *   no tone class at all, which is a fourth appearance the component does not
 *   offer.
 *
 * An exception list would have had to be maintained; three clauses that are
 * true for the right reason do not.
 */

const SRC = join(process.cwd(), 'src');

/** The component's own markup, which is the one place this may be written. */
const OWNER = 'components/ui.tsx';

const BUTTON = /<button\b[\s\S]{0,900}?<\/button>/g;

/**
 * One element at a time, deliberately.
 *
 * The first version of this was a single regex with lookaheads, and it read
 * fine and was wrong: a lookahead from `<button` runs past that button's own
 * closing tag, so a submit button anywhere above a toned one matched on the
 * *next* button's class. Cutting the file into elements first makes each
 * clause a question about one button, which is what it was always meant to be.
 */
function handWritten(text: string): boolean {
  for (const [el] of text.matchAll(BUTTON)) {
    if (!el.includes('type="button"')) continue;
    if (!/className="btn btn-(?:primary|secondary|ghost) btn-block"/.test(el)) continue;
    if (!el.includes("textTransform: 'uppercase'")) continue;
    return true;
  }
  return false;
}

/** Exported shape for the string cases below. */
const INLINE = { test: handWritten };

describe('the block action button has one implementation', () => {
  it('is not written out by hand anywhere else', () => {
    const offenders = sources(SRC)
      .filter((f) => !f.path.endsWith(OWNER))
      .filter((f) => INLINE.test(withoutComments(f.text)))
      // Named, not counted: "3 problems" is what somebody greps around.
      .map((f) => f.path.slice(f.path.indexOf('/src/') + 5));
    expect(offenders).toEqual([]);
  });
});

/**
 * The rule catching the thing it exists to catch.
 *
 * Against strings, so the shape stays checked after it has been deleted from
 * the forty-two files — otherwise this passes because the code is gone rather
 * than because the rule works.
 */
describe('what it catches', () => {
  const btn = (cls: string, extra = '', type = 'button') =>
    `<button\n  type="${type}"\n  className="${cls}"\n  ${extra}\n  style={{ height: 46, letterSpacing: '0.1em', textTransform: 'uppercase' }}\n>\n  Do it\n</button>`;

  it('catches each tone the component offers', () => {
    for (const tone of ['primary', 'secondary', 'ghost']) {
      expect(INLINE.test(btn(`btn btn-${tone} btn-block`)), tone).toBe(true);
    }
  });

  it('leaves a submit button alone', () => {
    expect(INLINE.test(btn('btn btn-primary btn-block', '', 'submit'))).toBe(false);
  });

  it('leaves a toneless btn-block alone', () => {
    expect(INLINE.test(btn('btn btn-block', 'aria-pressed={on}'))).toBe(false);
  });

  it('leaves a button that is not block alone', () => {
    expect(INLINE.test(btn('btn btn-primary'))).toBe(false);
  });

  it('leaves a block button with no uppercase alone', () => {
    // Forty-seven of these exist and are a different treatment, not this one.
    expect(
      INLINE.test(
        `<button type="button" className="btn btn-secondary btn-block" style={{ height: 44 }}>Go</button>`,
      ),
    ).toBe(false);
  });
});
