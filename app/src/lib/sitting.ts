/**
 * A practice paper, after it has been sat.
 *
 * The score used to be thrown away the moment you left the screen, which made
 * the whole exercise a mirror: it told you how you did and then forgot, so it
 * could never tell you whether you were getting better. Three things want it
 * back — Grades, which knows what the rest of the semester has to average and
 * had no evidence about whether that is happening; the drill deck, because
 * every question you missed is already a question with a key; and the class
 * room, where a paper with a fixed code is a thing two people can both sit.
 *
 * ## What is kept, and what is not
 *
 * The marks, the shape, the code, and the questions you got wrong. Not the
 * answers you wrote. A short answer typed in a hurry at midnight is not
 * something anybody wants to reread in November, it is the bulkiest part of a
 * sitting by an order of magnitude, and the app has a five-megabyte storage
 * budget it shares with everything else.
 *
 * ## Why a percentage is not a grade
 *
 * A practice paper is a paper you wrote for yourself out of your own cards. It
 * is evidence about whether you know the material and it is not evidence about
 * what a professor will give you, and every line of copy around it says so.
 * The number is a trend, and the trend is the useful part.
 */

import type { Kind, Question } from './exam';

export interface Missed {
  prompt: string;
  /** The model answer, or the right option spelled out. */
  answer: string;
  why: string;
  kind: Kind;
}

export interface Sitting {
  id: string;
  courseId: string;
  /** The paper's title as it was sat. */
  title: string;
  /** Epoch ms. */
  at: number;
  minutes: number;
  got: number;
  outOf: number;
  pct: number;
  /** The reproducible code, for a paper drawn from cards. Empty otherwise. */
  code: string;
  /** What you did not get, kept for the drill deck. */
  missed: Missed[];
}

/** How many marks a paper is worth, and how many you took. */
export function pctOf(got: number, outOf: number): number {
  return outOf === 0 ? 0 : Math.round((got / outOf) * 100);
}

/**
 * The questions to keep, from a marked paper.
 *
 * A choice question you got wrong keeps the right option spelled out, because
 * "B" is not an answer you can revise from three weeks later. A written one
 * keeps the key. Anything left blank counts as missed — not answering is the
 * same gap in knowledge as answering wrongly, and a paper where you ran out of
 * time has plenty of both.
 */
export function missedFrom(
  questions: Question[],
  marks: Record<string, { given: string; mark?: 'right' | 'partly' | 'wrong' }>,
): Missed[] {
  const out: Missed[] = [];
  for (const q of questions) {
    const answer = marks[q.id];
    if (q.kind === 'choice') {
      const right = answer?.given !== '' && answer?.given === q.answer;
      if (right) continue;
      const index = Number(q.answer);
      out.push({
        prompt: q.prompt,
        answer: q.options[index] ?? q.answer,
        why: q.why,
        kind: q.kind,
      });
      continue;
    }
    // Written: "right" is the only mark that keeps it out. "Partly" belongs in
    // the deck — a half-answer is the kind you most need to see again.
    if (answer?.mark === 'right') continue;
    out.push({ prompt: q.prompt, answer: q.answer, why: q.why, kind: q.kind });
  }
  return out;
}

/** The cards a sitting's misses make. Shaped for a CourseUpdate. */
export function cardsFrom(missed: Missed[]): { q: string; a: string }[] {
  return missed.map((m) => ({
    q: m.prompt,
    // The key, then what the question was testing. Both are on the card
    // because the second is the part that stops you memorising the first.
    a: m.why ? `${m.answer}\n\n${m.why}` : m.answer,
  }));
}

/** Sittings for one course, newest first. */
export function forCourse(all: Sitting[], courseId: string): Sitting[] {
  return all.filter((s) => s.courseId === courseId).sort((a, b) => b.at - a.at);
}

export interface Trend {
  /** How many papers, and the average across them. */
  papers: number;
  average: number;
  /** The most recent, and the one before it. */
  latest: number | null;
  previous: number | null;
  /** Signed points of change between those two, or null. */
  change: number | null;
  /** Marks dropped across every paper, for the "what to drill" line. */
  missed: number;
}

export function trend(sittings: Sitting[]): Trend {
  if (sittings.length === 0) {
    return { papers: 0, average: 0, latest: null, previous: null, change: null, missed: 0 };
  }
  const newest = [...sittings].sort((a, b) => b.at - a.at);
  const average = Math.round(newest.reduce((n, s) => n + s.pct, 0) / newest.length);
  const latest = newest[0].pct;
  const previous = newest.length > 1 ? newest[1].pct : null;
  return {
    papers: newest.length,
    average,
    latest,
    previous,
    change: previous === null ? null : latest - previous,
    missed: newest.reduce((n, s) => n + s.missed.length, 0),
  };
}

/**
 * What a run of papers says, in one line.
 *
 * Careful about two things. It never calls a practice score a grade, because
 * it is not one. And it will not read a trend from two papers of different
 * lengths as though they were comparable — a fifteen-minute paper and a
 * ninety-minute one are different exercises, and saying "up eleven points"
 * across them would be a number invented out of a coincidence.
 */
export function trendLine(t: Trend, sittings: Sitting[]): string {
  if (t.papers === 0) return 'No practice papers yet.';
  if (t.papers === 1) {
    return `One paper, ${t.latest}%. Sit another to see whether that is going anywhere.`;
  }

  const newest = [...sittings].sort((a, b) => b.at - a.at);
  const comparable = newest[0].minutes === newest[1].minutes;
  if (!comparable) {
    return `${t.papers} papers, ${t.average}% on average. The last two were different lengths, so the change between them is not worth reading.`;
  }
  if (t.change === null || t.change === 0) {
    return `${t.papers} papers, ${t.average}% on average, and the last two came out level.`;
  }
  const size = Math.abs(t.change);
  const way = t.change > 0 ? 'up' : 'down';
  return `${t.papers} papers, ${t.average}% on average — ${way} ${size} ${
    size === 1 ? 'point' : 'points'
  } on the last one.`;
}

/**
 * A practice average beside what a course's remaining work has to average.
 *
 * Deliberately not folded into the projection. The grade projection is
 * arithmetic on weights a syllabus states; a practice score is evidence about
 * you. Averaging the two would produce a number that is neither, and it would
 * be the number people quoted.
 */
export function against(practice: number, needed: number | null): string {
  if (needed === null) return '';
  const gap = Math.round(practice - needed);
  if (gap >= 10) return `Comfortably above what the rest has to average.`;
  if (gap >= 0) return `About level with what the rest has to average.`;
  if (gap >= -10) return `A little under what the rest has to average.`;
  return `Well under what the rest has to average — ${Math.abs(gap)} points under.`;
}

/** A file name for a sitting, when one is exported. */
export function sittingName(s: Sitting): string {
  const day = new Date(s.at).toISOString().slice(0, 10);
  return `${day}-${s.code ? `paper-${s.code.toLowerCase()}` : 'practice-paper'}.md`;
}
