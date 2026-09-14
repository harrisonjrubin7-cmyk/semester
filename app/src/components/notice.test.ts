import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { sources, withoutComments } from '../styles/rules';

/**
 * The screen talking back, drawn once.
 *
 * Seven copies of one box: `role="status"`, a hairline at `--r-md`, `--sp-5`
 * of padding and `textWrap: 'pretty'`, opened by `{(lib.error || notice) &&`
 * on the six screens that keep their data in a device library — Create,
 * Career, Athletics, Family, Pathway, University — and once more in the video
 * editor, where it had drifted one type step larger.
 *
 * They are `Notice` in `components/ui.tsx` now. This holds that, for the
 * reason `GROUPED-AUDIT.md` gives for every idiom in this app that has a
 * component and hand-drawn copies as well: the copies do not arrive by
 * somebody rejecting the component, they arrive by somebody not knowing it
 * exists. A test is how they find out.
 *
 * ## What it checks, and what it deliberately does not
 *
 * It fails a hand-drawn `role="status"` box carrying this box's own three
 * measurements — `--sp-5` of padding, `--sp-4` of block margin, and
 * `textWrap: 'pretty'` — in that order. It does not fail `role="status"`
 * itself: that is the right attribute on a good many things that are not this
 * box, and a rule that fought the accessibility attribute would be a rule
 * people work around rather than satisfy.
 *
 * The first version of this rule matched on the hairline border instead, and
 * `components/Replaced.tsx` failed it — an undo toast on `--app-panel` with
 * its own margins, which shares a border with this box and nothing else. A
 * rule that catches the wrong file teaches people to add exceptions to it, so
 * it matches the measurements rather than the decoration.
 */

/*
 * The role half matches either politeness, and either spelling of it.
 *
 * `Notice` took an `alert` prop in `SIMPLIFY-AUDIT.md` E3 — the ported campus
 * screens' recovery notices are assertive, and rightly — so the component now
 * reads `role={alert ? 'alert' : 'status'}` and a rule keyed to the literal
 * `role="status"` stopped matching the very component it exists to protect.
 * That is the guard working: it failed the moment the box changed shape.
 *
 * Widened rather than pinned to the new spelling, because for the first rule
 * below it is strictly more coverage: a hand-rolled box with these three
 * measurements is a copy of this component whichever politeness it asks for,
 * and before this an assertive one would have walked straight past.
 *
 * What this still cannot see is unchanged and is the limit written in the
 * audit: a copy that puts the measurements in a CSS class rather than inline
 * — which is exactly what the port's `portal-warning` did — matches nothing
 * here. The role was never the reason for that blind spot and widening it is
 * not a fix for it.
 */
const NOTICE_BOX =
  /role=(?:"(?:status|alert)"|\{[^}]*'(?:status|alert)'[^}]*\})[\s\S]{0,400}?padding: 'var\(--sp-5\)'[\s\S]{0,200}?marginBlock: 'var\(--sp-4\)'[\s\S]{0,200}?textWrap: 'pretty'/;

describe('the notice box', () => {
  it('is drawn by the component and nowhere else', () => {
    const offenders = sources(join(process.cwd(), 'src'))
      .filter((f) => !f.path.includes('.test.') && !f.path.endsWith(join('components', 'ui.tsx')))
      .filter((f) => NOTICE_BOX.test(withoutComments(f.text)))
      // Named rather than counted, so a failure says which screen drew its own.
      .map((f) => f.path.slice(f.path.indexOf('/src/') + 5));
    expect(offenders).toEqual([]);
  });

  it('still exists to be used', () => {
    // A guard on the guard: if `Notice` were renamed away, the rule above
    // would pass on an app that had lost the component entirely.
    const ui = sources(join(process.cwd(), 'src', 'components')).find((f) => f.path.endsWith('ui.tsx'));
    expect(ui?.text).toContain('export function Notice(');
    expect(ui?.text).toMatch(NOTICE_BOX);
  });
});

describe('what it catches', () => {
  // Written against strings, so the shape is still checked after it has been
  // deleted from the seven files — otherwise this passes because the code is
  // gone rather than because the rule works.
  it('catches the block all seven had', () => {
    expect(
      NOTICE_BOX.test(`<p
          role="status"
          style={{
            fontSize: 'var(--type-sm)',
            lineHeight: 'var(--leading-normal)',
            border: '1px solid var(--app-line)',
            borderRadius: 'var(--r-md)',
            padding: 'var(--sp-5)',
            marginBlock: 'var(--sp-4)',
            textWrap: 'pretty',
          }}
        >`),
    ).toBe(true);
  });

  it('catches it at the size the video editor had drifted to', () => {
    expect(
      NOTICE_BOX.test(`role="status" style={{ fontSize: 'var(--type-base)',
        border: '1px solid var(--app-line)', borderRadius: 'var(--r-md)',
        padding: 'var(--sp-5)', marginBlock: 'var(--sp-4)', textWrap: 'pretty' }}`),
    ).toBe(true);
  });

  it('leaves other live regions alone', () => {
    expect(NOTICE_BOX.test('<p role="status">Saved</p>')).toBe(false);
    expect(
      NOTICE_BOX.test(`<div role="status" style={{ padding: '10px 18px', background: 'var(--app-warn-wash)' }}>`),
    ).toBe(false);
    // The undo toast the first version of this rule wrongly caught.
    expect(
      NOTICE_BOX.test(`role="status" style={{ margin: '0 14px 10px', padding: '11px 13px',
        borderRadius: 'var(--r-md)', border: '1px solid var(--app-line)',
        background: 'var(--app-panel)', display: 'flex' }}`),
    ).toBe(false);
  });
});
