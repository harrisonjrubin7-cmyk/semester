import type { CSSProperties } from 'react';

/**
 * A style object with its `margin` shorthand written out as four longhands.
 *
 * ## Why this has to exist
 *
 * React applies inline styles one property at a time and diffs the last
 * render against this one. A shorthand and one of its own longhands are two
 * unrelated names to it, so when a longhand goes away it clears that property
 * and does not put the shorthand's value back.
 *
 * `SectionLabel` writes the app's whole vertical rhythm as one `margin`
 * shorthand. `Fold` tightens only the bottom of it, as a longhand, because
 * the bottom is the only side it means. Measured on one heading:
 *
 *   open        margin: 26px 0 12px          bottom 12px
 *   folded      marginBottom: var(--sp-3)    bottom 6px
 *   reopened    nothing at all               bottom 6.8px  ← from the
 *                                                            stylesheet
 *
 * The heading never gets its rhythm back until the element unmounts. React
 * warns about exactly this, in a console nobody has open.
 *
 * Splitting on the merged object rather than choosing one form at each site
 * is what makes it stable: ninety-five call sites write their own shorthand,
 * and any of them can be handed a longhand override by `Fold`. Once only
 * longhands reach the DOM, overriding one side is a plain overwrite.
 *
 * ## Why the split counts brackets
 *
 * The values are `calc(26px * var(--density, 1)) 0 calc(12px * var(--density,
 * 1))` — three values, not seven. Splitting on whitespace would tear the
 * `calc()` apart, and the comma inside `var(--density, 1)` means a naive
 * comma split is wrong too.
 */
export function splitMargin(value: string): [string, string, string, string] | null {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value.trim()) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (depth === 0 && /\s/.test(ch)) {
      if (current) parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) parts.push(current);

  // CSS's own rule: one value is every side, two are vertical then
  // horizontal, three name the bottom separately, four go clockwise.
  const [a, b, c, d] = parts;
  if (parts.length === 1) return [a, a, a, a];
  if (parts.length === 2) return [a, b, a, b];
  if (parts.length === 3) return [a, b, c, b];
  if (parts.length === 4) return [a, b, c, d];
  return null;
}

/**
 * The same style object, with any `margin` shorthand expanded in place.
 *
 * Anything already set as a longhand wins, since it was written later and
 * means the side it names. A value this cannot parse is left as the shorthand
 * rather than dropped — a heading with its original spacing is better than
 * one with none.
 */
export function longhandMargins(style: CSSProperties | undefined): CSSProperties | undefined {
  if (!style || typeof style.margin !== 'string') return style;
  const sides = splitMargin(style.margin);
  if (!sides) return style;
  const { margin: _shorthand, ...rest } = style;
  const [top, right, bottom, left] = sides;
  return {
    marginTop: top,
    marginRight: right,
    marginBottom: bottom,
    marginLeft: left,
    ...rest,
  };
}
