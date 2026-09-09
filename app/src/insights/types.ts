import type { CoursesTab, Screen } from '../lib/types';

/**
 * One thing the data supports saying, and the record it rests on.
 *
 * The rule this whole directory exists to keep is `worked`'s: evidence-based,
 * and silent when the evidence is thin. Every insight is a pure function of
 * state, declares how many records it needs, and returns nothing below that —
 * no placeholder, no greyed-out card, no "not enough data yet". A report with
 * two insights and no filler is better than eight with six hedged.
 *
 * ## Why evidence is a field and not a nicety
 *
 * An insight whose evidence cannot be shown does not ship. That is the line
 * between analysis and a horoscope: "you work best in the evening" is a claim
 * about somebody's life, and the only thing that makes it fair to put on a
 * screen is that the twelve sittings behind it are one tap away.
 */

/** A record this insight was computed from, and how to reach it. */
export interface EvidenceRef {
  /** What it is, so the list reads: "Problem Set 3", "Tuesday 14 October". */
  says: string;
  /** Where it lives, when it has a screen of its own. */
  screen?: Screen;
  /** The record's own id, for a screen that can open one. */
  id?: string;
  /** When it happened, for ordering. */
  at?: number;
}

export type Kind = 'observation' | 'pattern' | 'projection' | 'recommendation';
export type Scope = 'day' | 'week' | 'term' | 'course';

export interface Insight {
  id: string;
  kind: Kind;
  scope: Scope;
  courseId?: string;
  /** One sentence, factual. Never about the student — about the records. */
  headline: string;
  /** One or two sentences of context. */
  detail?: string;
  /** The actual records. Never empty: an insight with none does not ship. */
  evidence: EvidenceRef[];
  /**
   * `firm` where the sample is well past the minimum and the reading is not
   * close; `tentative` where it is either near the threshold or near a
   * boundary. Stated out loud in the card rather than hedged into the prose.
   */
  confidence: 'firm' | 'tentative';
  sampleSize: number;
  /**
   * Where to go, and — where the screen has grains — which one.
   *
   * The grain exists because the grade table stopped being a screen and became
   * the third tab of Courses: an action that named `courses` alone would land
   * a projection about a grade on whichever tab was last open.
   */
  action?: { label: string; screen: Screen; tab?: CoursesTab };
  /** Lower sorts first. Impact, never recency. */
  rank: number;
}

/**
 * Everything an insight is allowed to read.
 *
 * Passed in rather than reached for, so every insight is a pure function of
 * its input and produces identical output from identical state — which is what
 * makes the engine work offline and makes a test of it mean something.
 */
export interface Facts {
  now: Date;
  courses: import('../lib/types').Course[];
  items: import('../lib/types').Item[];
  scores: Record<string, string>;
  pieces: Record<string, string>;
  drops: Record<string, number>;
  attendance: import('../lib/attend').Attended[];
  attendPolicy: Record<string, import('../lib/attend').AttendPolicy>;
  answers: import('../lib/sure').Answer[];
  spent: import('../lib/pace').Spent[];
  /** Deadlines with their live dates folded in — see `lib/select.ts`. */
  dated: import('../lib/types').DatedItem[];
  done: Record<string, boolean>;
  sittings: import('../lib/sitting').Sitting[];
  /** Card key to when it was last seen, for finding a course nobody has opened. */
  reviews: Record<string, { seen: number }>;
  /** Card keys to the unit they belong to, for naming a weak topic. */
  unitOf: (courseId: string, key: string) => string;
  codeOf: (courseId: string) => string;
}

/** One insight: what it needs, and what it says when it has enough. */
export interface Source {
  id: string;
  /** Records required before it says anything at all. */
  minimum: number;
  run: (facts: Facts) => Insight[];
}
