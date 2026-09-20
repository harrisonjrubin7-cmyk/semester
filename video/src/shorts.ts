import type { Lesson, LessonCue } from '../../app/src/lib/types';

/**
 * One card of a unit, as a short.
 *
 * The roadmap says `shorts.py` should walk `guide.ts` card-by-card. It walks
 * the *cue list* instead, and the difference is the whole reason this is cheap:
 * a cue records the second its narration starts, so a card already has an in
 * and an out inside the unit's MP3. Nothing is re-synthesised and no audio is
 * cut — Remotion trims the file it plays. A short costs the frames it takes to
 * draw and nothing else.
 *
 * The cost of reading it this way is the same one the app already lives with: a
 * card added to a guide after its unit was narrated has no cue, so it has no
 * short until the unit is re-rendered. The player says "Added since this was
 * recorded" about exactly those cards. This is that property, not a new one.
 */
export interface Short {
  unit: number;
  /** Which card of the unit, counting from 0. */
  card: number;
  question: string;
  answer: string;
  /** Seconds into the unit's MP3 where the question starts. */
  start: number;
  /** Seconds into the unit's MP3 where the answer starts. */
  answerAt: number;
  /** Seconds into the unit's MP3 where the next card begins, or the unit ends. */
  end: number;
}

/** Seconds a short runs for. */
export function shortLength(s: Short): number {
  return s.end - s.start;
}

/**
 * Every card of a lesson, as a short.
 *
 * `pipeline/lessons.py` writes cues as `title`, then a `q`/`a` pair per card,
 * then `close`. A short is one of those pairs plus the silence the renderer
 * leaves after the question — `lesson_script` gives every `q` a two-second
 * pause, which on a lecture is a beat to answer in your head and on a short is
 * the hook holding before the payoff.
 *
 * A `q` with no `a` after it is skipped rather than guessed at. That cannot
 * happen from `lesson_script` today, and a short that showed a question with
 * no answer would be worse than one that does not exist.
 */
export function shortsFor(lesson: Lesson): Short[] {
  const cues: readonly LessonCue[] = lesson.cues ?? [];
  const out: Short[] = [];

  for (let i = 0; i < cues.length; i += 1) {
    if (cues[i].kind !== 'q') continue;
    const answer = cues[i + 1];
    if (!answer || answer.kind !== 'a') continue;

    /*
     * The card ends where the next cue after the answer begins — the next
     * question, or the unit's closing slide. Past the last cue there is only
     * the narration's own end.
     */
    const next = cues[i + 2];
    const end = next ? next.at : lesson.seconds;
    if (end <= cues[i].at) continue;

    out.push({
      unit: lesson.unit,
      card: out.length,
      question: cues[i].text,
      answer: answer.text,
      start: cues[i].at,
      answerAt: answer.at,
      end,
    });
  }

  return out;
}
