import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A field on a touch device is never smaller than 16px.
 *
 * iOS zooms the page in whenever a focused input is under 16px, and it does
 * not zoom back out: you are left on a screen scrolled sideways, typing into
 * a field you can half see. The rule that prevents it has been in `app.css`
 * for a long time — and it did nothing, on every screen that has a field.
 *
 * About a hundred inputs in this app set `fontSize` inline, and an inline
 * style beats a stylesheet rule of any specificity. Measured against the
 * deployed build on an iPhone 14 Pro profile: the seventeen score boxes on
 * Grades computed to 14px and the settings search to 13.5px. The stylesheet
 * said 16 and the browser said 14, which is the kind of bug that survives
 * every review because the rule you would go and check reads correctly.
 *
 * ## What this test can and cannot do
 *
 * It cannot measure a computed style: that needs a browser with a coarse
 * pointer, and jsdom has neither a cascade worth trusting nor media queries.
 * What it can do — the same thing `taps.test.ts` does for tap targets — is
 * hold the mechanism in place, so that the three things this fix depends on
 * cannot be edited away without a failure saying why they were there:
 *
 *   1. the rule is inside `@media (pointer: coarse)`, so a mouse still gets
 *      the drawn sizes;
 *   2. it carries `!important`, without which the inline sizes win and the
 *      rule is decorative again;
 *   3. it is a floor rather than a fixed size, so the text-size setting still
 *      reaches the field at Largest.
 */
const css = readFileSync('src/styles/app.css', 'utf8');

/** The `@media (pointer: coarse)` block that sizes form controls. */
function coarseFieldRule(): string {
  for (const m of css.matchAll(/@media \(pointer: coarse\) \{/g)) {
    // Two nested levels: the query, then the rule inside it.
    const open = m.index + m[0].length;
    const close = css.indexOf('\n}', open);
    const block = css.slice(open, close);
    if (/input/.test(block) && /font-size/.test(block)) return block;
  }
  return '';
}

describe('form fields on a touch device', () => {
  it('sizes them in a coarse-pointer query, not for everybody', () => {
    const block = coarseFieldRule();
    expect(block, 'no `@media (pointer: coarse)` rule sizes inputs').not.toBe('');
    for (const sel of ['input', 'textarea', 'select']) {
      expect(block, `${sel} is not covered, so it still zooms`).toContain(sel);
    }
  });

  it('wins against the inline sizes the screens set', () => {
    // The whole point. Without this the rule is outranked by roughly a
    // hundred `style={{ fontSize: … }}` fields and does nothing at all.
    expect(
      coarseFieldRule(),
      'the rule must be `!important` or the inline font sizes beat it',
    ).toContain('!important');
  });

  it('is a floor, so the text size setting still reaches a field', () => {
    // `max(16px, …)`, never a bare `font-size: 16px`: at Largest the rest of
    // the app is at 16.52px and a fixed 16 would shrink the one element
    // somebody is typing into.
    expect(coarseFieldRule()).toMatch(/font-size:\s*max\(\s*16px\s*,/);
  });

  it('still has fields whose own size is under the floor', () => {
    // The reason the rule has to exist, asserted rather than assumed: if a
    // later pass ever gets every field onto 16px by hand, this fails and the
    // rule above can be reconsidered on purpose instead of by accident.
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx$/.test(e) && !/\.test\./.test(e)) files.push(p);
      }
    };
    walk('src');

    const small = files.filter((f) => {
      const text = readFileSync(f, 'utf8');
      // A field and a small inline size inside the same element: from an
      // `<input` or `<textarea` tag to the `/>` that closes it. The window is
      // generous because these tags carry their handlers inline and run to
      // forty lines — a tighter one matched nothing and quietly passed.
      return [...text.matchAll(/<(?:input|textarea)\b[\s\S]{0,4000}?\/>/g)].some((m) =>
        /fontSize: (?:'var\(--type-(?:xs|sm|base|md)\)'|'calc\((?:1[0-5])(?:\.\d)?px)/.test(m[0]),
      );
    });
    expect(small.length, 'no field sets an inline size under 16px any more').toBeGreaterThan(0);
  });
});
