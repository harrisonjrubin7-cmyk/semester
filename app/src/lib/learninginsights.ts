/**
 * What a student can see about their own studying, and nothing about them.
 *
 * Coverage by concept, what is marked for review, and — only if the student
 * turned it on — one pattern in when they review. Every figure is arithmetic
 * over the cards answered and stays on the device.
 *
 * ## What it refuses
 *
 * No score, prediction, at-risk label, ranking or "productivity" figure, and
 * nothing built from time online or clicks: coverage counts cards *answered*,
 * not minutes spent. A pattern is spoken only above a floor and is phrased as a
 * question the student can dismiss, as `lib/again.ts` does for mistakes.
 */

import type { ConceptState } from './learning-loop';
import type { Reviews } from './review';
import { cardIdentity } from './review';
import type { Guide } from './types';

export interface Coverage {
  unit: string;
  answered: number;
  total: number;
}

/** Per unit: how many of its cards have been answered at least once. */
export function coverage(courseId: string, guide: Guide, reviews: Reviews): Coverage[] {
  return guide.units.map((u) => ({
    unit: u.name,
    total: u.cards.length,
    answered: u.cards.filter((c) => (reviews[cardIdentity(courseId, c)]?.seen ?? 0) > 0).length,
  }));
}

export const coverageWords = (c: Coverage) =>
  c.total === 0 ? `${c.unit}: no cards yet` : `${c.unit}: ${c.answered} of ${c.total} cards answered`;

/** Concepts currently reading "Review later". */
export const forReview = (states: ConceptState[]) => states.filter((s) => s.state === 'needs-review').map((s) => s.name);

/** A pattern is not spoken on fewer answered cards than this. */
export const PATTERN_FLOOR = 8;

/**
 * "Most of the cards you last answered were answered late in the evening."
 * Reads only when a student opted in, and only above the floor. `hourOf` is
 * injected so the reading does not depend on the machine's zone.
 */
export function eveningPattern(reviews: Reviews, hourOf: (ms: number) => number): string | null {
  const seen = Object.values(reviews).map((r) => r.seen).filter((s) => s > 0);
  if (seen.length < PATTERN_FLOOR) return null;
  const late = seen.filter((s) => hourOf(s) >= 22 || hourOf(s) < 4).length;
  if (late / seen.length < 0.5) return null;
  return `${late} of your last ${seen.length} answered cards were answered after 10 PM. Would an earlier block help? You can ignore this.`;
}
