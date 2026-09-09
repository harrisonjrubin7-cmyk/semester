import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { longhandMargins, splitMargin } from './margins';

/*
 * `SectionLabel` wrote the app's vertical rhythm as one `margin` shorthand and
 * `Fold` tightened only its bottom, as a longhand. React applies inline styles
 * one property at a time and diffs last render against this one, so a
 * shorthand and one of its own longhands are two unrelated names: removing the
 * longhand cleared that side and did not put the shorthand's value back.
 *
 * Measured in a browser on one heading, before the fix:
 *
 *   open      margin: 26px 0 12px         bottom 12px
 *   folded    marginBottom: var(--sp-3)   bottom  6px
 *   reopened  nothing at all              bottom  6.8px  ← the stylesheet
 *
 * The rhythm never came back until the element unmounted.
 */
describe('splitting a margin shorthand', () => {
  it('follows CSS’s own rule for one, two, three and four values', () => {
    expect(splitMargin('4px')).toEqual(['4px', '4px', '4px', '4px']);
    expect(splitMargin('4px 8px')).toEqual(['4px', '8px', '4px', '8px']);
    expect(splitMargin('4px 8px 12px')).toEqual(['4px', '8px', '12px', '8px']);
    expect(splitMargin('1px 2px 3px 4px')).toEqual(['1px', '2px', '3px', '4px']);
  });

  it('counts brackets rather than trusting whitespace', () => {
    // The real value. Three values, not seven — and the comma inside
    // `var(--density, 1)` means a comma split is wrong too.
    expect(splitMargin('calc(26px * var(--density, 1)) 0 calc(12px * var(--density, 1))')).toEqual([
      'calc(26px * var(--density, 1))',
      '0',
      'calc(12px * var(--density, 1))',
      '0',
    ]);
  });

  it('gives back nothing it cannot read, rather than a guess', () => {
    expect(splitMargin('1px 2px 3px 4px 5px')).toBeNull();
    expect(splitMargin('')).toBeNull();
  });
});

describe('a style object with the shorthand expanded', () => {
  it('reaches the DOM as longhands only', () => {
    const out = longhandMargins({ margin: '26px 0 12px', color: 'red' });
    expect(out).toEqual({
      marginTop: '26px',
      marginRight: '0',
      marginBottom: '12px',
      marginLeft: '0',
      color: 'red',
    });
    expect(out && 'margin' in out, 'the shorthand must not survive').toBe(false);
  });

  it('lets a longhand override win, which is the whole point', () => {
    // This is `Fold` tightening the bottom of a heading it did not write.
    const out = longhandMargins({ margin: '26px 0 12px', marginBottom: 'var(--sp-3)' });
    expect(out?.marginBottom).toBe('var(--sp-3)');
    expect(out?.marginTop, 'the other three sides are untouched').toBe('26px');
  });

  it('leaves a style it cannot parse exactly as it was', () => {
    // Better a heading with its original spacing than one with none.
    const odd = { margin: '1px 2px 3px 4px 5px' };
    expect(longhandMargins(odd)).toBe(odd);
    expect(longhandMargins(undefined)).toBeUndefined();
    expect(longhandMargins({ color: 'red' })).toEqual({ color: 'red' });
  });
});

/*
 * The splitter above is only useful if `SectionLabel` actually uses it. This
 * holds the two halves that made the bug: the component must not write a
 * `margin` shorthand of its own, and it must expand a caller's.
 *
 * Read from the source rather than rendered, because the failure was never
 * visible in a render — it took a second render, after a fold, to appear.
 */
describe('SectionLabel, where the bug lived', () => {
  const source = () => readFileSync('src/components/ui.tsx', 'utf8');
  const body = () => {
    const src = source();
    const at = src.indexOf('export function SectionLabel');
    expect(at, 'SectionLabel has moved; point this test at it').toBeGreaterThan(-1);
    // To the next top-level export rather than a fixed number of characters:
    // this component is mostly doc comment, and a window guessed at the wrong
    // size is a test that passes because it looked at nothing.
    const next = src.indexOf('\nexport ', at + 1);
    return src.slice(at, next === -1 ? src.length : next);
  };

  it('writes its rhythm as longhands, never as a shorthand', () => {
    expect(body()).not.toMatch(/^\s*margin:/m);
    expect(body()).toMatch(/marginTop:/);
    expect(body()).toMatch(/marginBottom:/);
  });

  it('expands a caller’s shorthand before it reaches the DOM', () => {
    expect(body()).toMatch(/longhandMargins\(style\)/);
  });
});
