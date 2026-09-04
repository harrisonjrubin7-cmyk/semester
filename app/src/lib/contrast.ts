/**
 * Whether the palette is legible, for all sixty combinations of it.
 *
 * `lib/look.ts` ships ten accents and six grounds, and any accent can be worn
 * on any ground. That is sixty pairings, and the four sample courses in the
 * repo have only ever been looked at in one or two of them. Nothing checked
 * the rest — so a combination that renders section labels at 2.4:1 against
 * their panel would ship, and would only be found by the one person who
 * happened to choose it, who would have no way to know it was a bug rather
 * than a design.
 *
 * This is the arithmetic WCAG defines, run over values already in the file. No
 * browser, no rendering, no screenshots: relative luminance is a formula, and
 * a contrast ratio is a division.
 *
 * ## What the thresholds are, and why they are not all 4.5
 *
 * WCAG AA asks 4.5:1 for body text and 3:1 for large text and for meaningful
 * non-text marks. The app uses the accent for three different jobs and they
 * are held to different bars:
 *
 *   - `--app-accent-deep` sets section labels and kickers — small uppercase
 *     text, so 4.5:1.
 *   - `--app-accent` sets larger figures and active tab labels — 3:1.
 *   - `--app-accent-fill` is a dot, a bar, a meter. It carries meaning without
 *     being read, so 3:1 against what is behind it.
 *
 * Deliberately not held to anything: `--app-accent-wash`, which is a tinted
 * background rather than ink, and the disabled states, which WCAG exempts.
 */

/** One sRGB channel, linearised. The transfer function WCAG specifies. */
function channel(eight: number): number {
  const c = eight / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** #rgb or #rrggbb to its three channels, or null when it is neither. */
export function rgbOf(hex: string): [number, number, number] | null {
  const h = hex.trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Relative luminance, 0 for black and 1 for white. */
export function luminance(hex: string): number | null {
  const rgb = rgbOf(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The contrast between two colours, from 1 to 21.
 *
 * Symmetrical — WCAG puts the lighter one on top, so the order the caller
 * passes them in cannot change the answer. Null when either is not a colour,
 * which is a different thing from a bad ratio and should not be rounded into
 * one.
 */
export function contrast(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA: 4.5 for body text, 3 for large text and non-text marks. */
export const AA_TEXT = 4.5;
export const AA_LARGE = 3;

/**
 * A colour blended over what is behind it.
 *
 * The app writes several tokens at less than full strength — dim and faint
 * text are the ground's `fg` at an alpha — and the contrast of a translucent
 * colour is the contrast of what it actually composites to. Checking the
 * un-blended value would pass things that are illegible on screen.
 */
export function over(front: string, back: string, alpha: number): string | null {
  const f = rgbOf(front);
  const b = rgbOf(back);
  if (!f || !b) return null;
  const mix = f.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)));
  return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export interface Check {
  /** What was measured, for the failure message to be actionable. */
  what: string;
  ratio: number;
  needs: number;
}

export function passes(c: Check): boolean {
  return c.ratio >= c.needs;
}

/** "Jade on Parchment · accent-deep on panel: 3.1:1, needs 4.5:1" */
export function failLine(c: Check): string {
  return `${c.what}: ${c.ratio.toFixed(2)}:1, needs ${c.needs}:1`;
}
