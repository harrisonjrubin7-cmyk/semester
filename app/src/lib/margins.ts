import type { CSSProperties } from 'react';

/**
 * A style object with the `margin` shorthand written out as its four sides.
 *
 * ## The bug this exists for
 *
 * React applies an inline style property by property, and it diffs the object
 * it was given last render against the one it has now. That is fine until one
 * object holds both a shorthand and one of the longhands it contains, because
 * then the two are separate properties as far as the diff is concerned and
 * React removes one of them without putting the other back. It says so, in a
 * development warning nobody has a console open for:
 *
 *     Removing a style property during rerender (marginBottom) when a
 *     conflicting property is set (margin) can lead to styling bugs.
 *
 * It is not a theoretical bug here. `SectionLabel` writes its own margins as
 * a shorthand — one declaration for the app's whole vertical rhythm, scaled
 * by `--density` — and `components/Fold.tsx` tightens the bottom one when a
 * section is folded shut, as a longhand, because the bottom is the only side
 * it means. Fold a section and open it again and the *whole* shorthand is
 * gone from the element: measured, a heading went 26px above / 12px below,
 * to 26/6 shut, to no inline margin at all on reopening. Every foldable
 * section in the app loses its spacing the first time somebody closes it.
 * `components/shell/Rows.tsx` does the same thing to the grouped shell's
 * group headings, so both shells had it.
 *
 * Splitting the shorthand once, on the merged object, means only longhands
 * ever reach the DOM: an override of one side is then a plain overwrite of
 * one property, which is exactly what React's diff handles well.
 *
 * ## Why it parses rather than just picking one
 *
 * The values are `calc()` and `var()`, which contain spaces of their own —
 * `calc(26px * var(--density, 1)) 0 calc(12px * var(--density, 1))` is three
 * values, not seven — so the split has to count brackets rather than trust
 * whitespace. Ninety-five call sites write their own margin shorthand and
 * they are not all going to be rewritten by hand.
 */
export function longMargins(style: CSSProperties): CSSProperties {
  const { margin, ...rest } = style;
  if (margin === undefined || margin === null) return style;

  // A bare number is pixels to React and unitless nonsense to CSS, so it is
  // kept a number rather than stringified — `margin: 8` has to stay 8px on
  // all four sides and not become the invalid `margin-top: 8`.
  if (typeof margin === 'number') {
    return { marginTop: margin, marginRight: margin, marginBottom: margin, marginLeft: margin, ...rest };
  }

  const sides = fourSides(margin);
  if (!sides) return style;

  const [top, right, bottom, left] = sides;
  // The four sides first, then whatever longhands the caller already wrote,
  // so an explicit `marginBottom` still wins over the shorthand it came with.
  return {
    marginTop: top,
    marginRight: right,
    marginBottom: bottom,
    marginLeft: left,
    ...rest,
  };
}

/**
 * `margin`'s one-to-four values expanded to top, right, bottom, left.
 *
 * Null for anything that is not one of those four shapes — a global keyword
 * (`inherit`, `unset`) means something the four sides cannot say between
 * them, and is left alone rather than approximated.
 */
function fourSides(value: string): [string, string, string, string] | null {
  const v = value.trim();
  if (!v || /^(inherit|initial|unset|revert|revert-layer)$/i.test(v)) return null;

  const parts = splitTopLevel(v);
  if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]];
  if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]];
  if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]];
  if (parts.length === 4) return [parts[0], parts[1], parts[2], parts[3]];
  return null;
}

/** Split on whitespace, but not inside `calc(…)` or `var(…, …)`. */
function splitTopLevel(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (depth === 0 && /\s/.test(ch)) {
      if (current) out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) out.push(current);
  return out;
}
