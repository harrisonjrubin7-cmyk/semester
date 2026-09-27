import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { withoutComments } from './rules';

/**
 * H-2 in docs/UX-ENHANCEMENT-PLAN.md: a button class with no base rule.
 *
 * `.workspace-text-button` had a `:hover` rule and nothing else, and
 * `.today-timeline-row` never reset the browser's button, so Today drew grey
 * system-font slabs where the design had text. Nothing failed: the buttons
 * worked, were labelled and passed every audit — they only looked broken.
 *
 * So the rule here is about the stylesheet, not a screen: every class Today
 * puts on a `<button>` has a rule of its own that takes the browser's
 * background, border and font away.
 */
const css = withoutComments(
  ['app.css', 'features.css'].map((f) => readFileSync(`src/styles/${f}`, 'utf8')).join('\n'),
);

/** The body of the first rule whose selector list is exactly `selector`. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  return match ? match[2] : '';
}

describe('text buttons are text', () => {
  for (const selector of ['.workspace-text-button', '.today-timeline-row', '.commitment-row', '.quick-action', '.explain-close']) {
    it(`${selector} resets the browser's button`, () => {
      // Every rule naming the class, grouped selectors included.
      const all = css.match(new RegExp(`[^}]*${selector.replace('.', '\\.')}[^{]*\\{[^}]*\\}`, 'g'))?.join('\n') ?? '';
      expect(all, `${selector} has no rule`).not.toBe('');
      expect(all).toMatch(/background:\s*(none|var\(--app-[a-z-]+\))/);
      expect(all).toMatch(/font:\s*inherit/);
      expect(all).toMatch(/border(-bottom)?:\s*(0|1px)/);
    });
  }

  it('gives the text button a 44px target', () => {
    expect(rule('.workspace-text-button')).toMatch(/min-height:\s*44px/);
  });
});
