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

/**
 * `<ActionButton ... style={{ height: N }}>` — the drift, coming back the other way.
 *
 * The opening tag only, by a brace-balanced scan rather than a regex. The
 * first attempt searched between `<ActionButton` and `</ActionButton>` and
 * flagged `components/RecordButton.tsx`, whose button contains a ten-pixel
 * recording dot: `<span style={{ width: 10, height: 10 }}>`. A height on a
 * child is not this button's height.
 */
function heightOverride(text: string): boolean {
  for (const m of text.matchAll(/<ActionButton\b/g)) {
    let i = m.index + '<ActionButton'.length;
    let depth = 0;
    for (; i < text.length; i += 1) {
      const c = text[i];
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) break;
    }
    if (/height:\s*\d/.test(text.slice(m.index, i))) return true;
  }
  return false;
}

const HEIGHT_OVERRIDE = { test: heightOverride };

describe('the block action button has one implementation', () => {
  it('is not written out by hand anywhere else', () => {
    const offenders = sources(SRC)
      .filter((f) => !f.path.endsWith(OWNER))
      .filter((f) => INLINE.test(withoutComments(f.text)))
      // Named, not counted: "3 problems" is what somebody greps around.
      .map((f) => f.path.slice(f.path.indexOf('/src/') + 5));
    expect(offenders).toEqual([]);
  });

  /*
   * And one height.
   *
   * Nine were in use before `HEIGHT`, which is what happens when every call
   * site may name its own. The prop is gone, so the only way back is `style`,
   * which is spread last and therefore wins — deliberately, since a call site
   * that truly needs a different height should be able to say so. This makes
   * saying so a decision somebody has to take past a failing test rather than
   * one they can take without noticing.
   */
  it('is not given a height back through style', () => {
    const offenders = sources(SRC)
      .filter((f) => !f.path.endsWith(OWNER))
      .filter((f) => HEIGHT_OVERRIDE.test(withoutComments(f.text)))
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

  it('catches a height put back through style', () => {
    expect(
      HEIGHT_OVERRIDE.test(
        `<ActionButton onClick={go} style={{ marginTop: 8, height: 52 }}>Go</ActionButton>`,
      ),
    ).toBe(true);
  });

  it('leaves an ActionButton with an honest style alone', () => {
    expect(
      HEIGHT_OVERRIDE.test(
        `<ActionButton onClick={go} style={{ marginTop: 'var(--sp-6)' }}>Go</ActionButton>`,
      ),
    ).toBe(false);
    // A height on some *other* element between two ActionButtons is not this.
    expect(
      HEIGHT_OVERRIDE.test(`<ActionButton onClick={go}>A</ActionButton>\n<div style={{ height: 22 }} />`),
    ).toBe(false);
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
