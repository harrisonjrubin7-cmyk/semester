/**
 * "Lowest two dropped", which most syllabi say and none of this app knew.
 *
 * The grade calculator held one score per *category* — "Quizzes, 20%" — and a
 * category is not what a syllabus drops. It drops pieces: eight quizzes with
 * the lowest two struck out, thirteen reflections counting the best ten. A
 * student with those rules who enters a category average is entering a number
 * their course does not use, and every "to finish with, you need" figure below
 * it is then wrong in the direction that matters — it reads worse than the
 * truth, so it advises panic.
 *
 * ## The pieces are typed as a list, because that is how they arrive
 *
 * A person reading scores off a gradebook has a column of numbers, not a mean.
 * So the field takes the column: "88, 92, 76" or one per line, and each entry
 * goes through the same reader the single-score box uses — so "17/20" works
 * here exactly as it does there.
 *
 * ## Dropping is not the same as not having sat it
 *
 * A quiz you missed is a zero and it is droppable; a quiz not yet held is
 * nothing at all. Only what is entered is counted, so a term half-finished
 * gives a half-term average rather than a figure quietly divided by eight.
 */

import { readScore } from './grades';

/** A column of scores, as typed. Commas, spaces or newlines all separate. */
export function readScores(text: string): number[] {
  return text
    .split(/[\n,;]+/)
    .map((piece) => piece.trim())
    .filter(Boolean)
    .map((piece) => readScore(piece))
    .filter((n): n is number => n !== null);
}

export interface Kept {
  kept: number[];
  dropped: number[];
  /** The average of what counts, or null when nothing does. */
  mean: number | null;
}

/**
 * The scores that count, after the lowest `drop` are struck out.
 *
 * Never drops everything: a rule that says "lowest two dropped" and a student
 * who has sat two so far means one counts, not none. A category averaging
 * nothing would silently leave itself out of the projection, which is a worse
 * answer than a thin one.
 */
export function afterDrops(scores: number[], drop: number): Kept {
  if (scores.length === 0) return { kept: [], dropped: [], mean: null };

  const howMany = Math.max(0, Math.min(Math.floor(drop), scores.length - 1));
  const sorted = [...scores].sort((a, b) => a - b);
  const dropped = sorted.slice(0, howMany);
  const kept = sorted.slice(howMany);

  return {
    kept,
    dropped,
    mean: kept.length === 0 ? null : kept.reduce((n, s) => n + s, 0) / kept.length,
  };
}

/**
 * "Best 6 of 8 — 91.2%, with 54 and 68 dropped."
 *
 * Names the figures struck out rather than only the count. A student checking
 * this against their own gradebook needs to see *which* two went, because the
 * commonest cause of a wrong average here is a score typed in twice.
 */
export function dropLine(scores: number[], drop: number): string {
  if (scores.length === 0) return '';
  const out = afterDrops(scores, drop);
  const mean = out.mean === null ? '—' : `${Math.round(out.mean * 10) / 10}%`;

  if (out.dropped.length === 0) {
    return `${scores.length} entered, averaging ${mean}.`;
  }
  return `Best ${out.kept.length} of ${scores.length} — ${mean}, with ${out.dropped
    .map((n) => Math.round(n * 10) / 10)
    .join(' and ')} dropped.`;
}

/**
 * Whether dropping changed anything worth telling somebody about.
 *
 * A rule that drops the lowest of eight identical scores is real and makes no
 * difference, and a screen that announces it every time is noise.
 */
export function dropHelped(scores: number[], drop: number): number {
  const withRule = afterDrops(scores, drop).mean;
  const without = afterDrops(scores, 0).mean;
  if (withRule === null || without === null) return 0;
  return withRule - without;
}

/** A stored drop count, made safe. */
export function readDrop(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 40) : 0;
}
