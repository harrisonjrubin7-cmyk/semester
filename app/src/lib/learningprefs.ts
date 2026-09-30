/**
 * How a student wants the study views to behave.
 *
 * This is the study-specific half. Text size, line spacing, reading width,
 * motion, plain language and the accessibility presets already live in
 * Settings → Look and move every screen; nothing here repeats them. What is
 * here changes only the learning views: how long a sitting is, and how much of
 * the evidence behind a suggestion is spelled out.
 *
 * Nothing is inferred from anything and nothing is shown to anyone else. These
 * are choices about the tool, not a record about the person, and they are not
 * an accommodations database.
 */

import { obj } from './device-library';

export const SESSIONS = [5, 15, 30] as const;
export type Session = (typeof SESSIONS)[number];

export const DENSITIES = ['concise', 'standard', 'expanded'] as const;
export type Density = (typeof DENSITIES)[number];

export interface Prefs {
  version: 1;
  /** Minutes a study sitting should take. Sizes the Start Here Check. */
  session: Session;
  /** How much of the evidence behind a concept is shown. */
  density: Density;
  /** Off until the student turns it on: personal patterns are opt-in. */
  patterns: boolean;
}

export const DEFAULT_PREFS: Prefs = { version: 1, session: 15, density: 'standard', patterns: false };

/** The Start Here Check's length for a sitting: five to ten questions, shorter for a short sitting. */
export function checkLengthFor(session: Session): number {
  return session === 5 ? 5 : session === 15 ? 8 : 10;
}

export const PREFS_PREFIX = 'semester.learning-prefs.v1';

export function readPrefs(v: unknown): Prefs {
  if (!obj(v) || v.version !== 1 || !(SESSIONS as readonly unknown[]).includes(v.session) || !(DENSITIES as readonly unknown[]).includes(v.density) || typeof v.patterns !== 'boolean')
    throw new Error('Invalid learning preferences.');
  return v as unknown as Prefs;
}
