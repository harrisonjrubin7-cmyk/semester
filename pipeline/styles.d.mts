/**
 * Types for `styles.mjs`.
 *
 * Same arrangement as `restyle.d.mts`, `align.d.mts`, `personas.d.mts`,
 * `broll.d.mts` and `explainer.d.mts`.
 */

export interface Style {
  label: string;
  blurb: string;
  rules: string[];
  /** What the renderer has to be able to do: `level` or `expressive`. */
  voice: string;
}

export const STYLES: Record<string, Style>;
export const STYLE_IDS: string[];
export const VOICES: string[];

export function performableWith(voice: string): string[];
