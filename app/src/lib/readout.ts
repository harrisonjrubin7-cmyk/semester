/**
 * The score in a photograph of somebody else's screen.
 *
 * `lib/claude.ts:readPages` already turns a photograph into text, and
 * `lib/score.ts:interpret` already reads a score once it is a string. Between
 * them there was nothing: a shot went to the course importer and came out as
 * a course, which is the wrong destination for a student holding up their
 * Top Hat page to copy one number off it.
 *
 * Top Hat is the case that asked for this and it is not the only one. Its only
 * integration surface is LTI, which joins it to an institution's LMS — there
 * is no public API and no student export, so no app can read a student's own
 * score, and `TOPHAT.md` files the live sync as a thing to earn rather than
 * build. What a student *can* do is show the app the number that is already on
 * their screen. iClicker, Poll Everywhere, a departmental gradebook and a
 * printed sheet all arrive the same way, and nothing here knows which it is.
 *
 * ## Why this refuses more than it reads
 *
 * A score screen is mostly not scores. It has a course code, a week number, a
 * date, a section, a count of questions answered, and — in the deck this app
 * ships — a Top Hat *join code*, `782449`, which is a six-digit number sitting
 * on the same page as the grade. A reader that took every number it saw would
 * offer that one, and a student tapping the first suggestion would file a
 * 782,449% attendance mark.
 *
 * So a bare number is never a candidate on its own. It counts only where the
 * line it sits on says what it is, and the shapes that state their own meaning
 * — `92%`, `17/20`, `17 out of 20` — count anywhere. Everything else is
 * dropped, and a photograph with nothing readable in it says so rather than
 * proposing the best of a bad set.
 *
 * ## Nothing is saved from here
 *
 * This returns candidates. The screen shows them and the student picks one,
 * because the number a projection is built on has to be one somebody agreed
 * to — the same reason `components/Attendance.tsx` keeps a read policy
 * editable, and the same reason `lib/generate.ts` quotes the sentence it took
 * a rule from. A transcription is a proposal, not a fact.
 */

import { interpret, type Reading } from './score';
import type { GradeSystem } from './cutoffs';

/** One score found in the text, and where it was found. */
export interface Found {
  /** Exactly as it appeared, so the student can recognise it on their screen. */
  saw: string;
  /** What it reads as, through the same reader the field uses. */
  reading: Reading;
  /** The line it sat on, trimmed — what tells two 90s apart. */
  line: string;
}

/**
 * Words that make a bare number on the same line mean a score.
 *
 * Deliberately short. Every word here is one that turns an unlabelled number
 * into a candidate, so a loose list is how the join code gets back in — the
 * test keeps a photograph full of plausible numbers as its control.
 */
const SAYS_SCORE =
  /\b(?:score|scored|grade|graded|mark|marks|total|overall|average|percent|percentage|points?|pts?|participation|attendance|correct)\b/i;

/**
 * Shapes that state their own meaning, and need no word beside them.
 *
 * `\d+\s*\/\s*\d+` also matches a date written `9/20`, which is why a match
 * has to survive `interpret` and the range check below: 9/20 reads as 45%,
 * which is a real score, so the line it sits on still has to look like a
 * score line. See `plausible`.
 */
const SELF_EVIDENT = /\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?\s*(?:\/|\bout\s+of\b)\s*\d+(?:\.\d+)?/gi;

/** A bare number, for lines that have already said what they are about. */
const BARE = /\b\d+(?:\.\d+)?\b/g;

/** A letter grade standing alone, which only means something against a scale. */
const LETTER = /(?:^|[\s:·|])([A-DF][+−-]?)(?=$|[\s.,;:·|])/g;

/**
 * Whether a reading is worth offering at all.
 *
 * Over a hundred is not refused outright — extra credit is real and
 * `lib/grades.ts` counts it — but a number in the thousands is a code, an
 * identifier or a total in points nobody scored out of. The ceiling is high
 * enough to keep a genuine 110% and low enough to drop `782449`.
 */
function plausible(reading: Reading): boolean {
  return reading.pct !== null && reading.pct >= 0 && reading.pct <= 150;
}

/** Push a candidate, unless the same reading off the same line is already in. */
function add(out: Found[], found: Found): void {
  if (!plausible(found.reading)) return;
  const same = out.some((f) => f.saw === found.saw && f.line === found.line);
  if (!same) out.push(found);
}

/**
 * Every score a transcribed screen appears to hold, best-labelled first.
 *
 * Order is the order they were read, which is the order they appear down the
 * page — so the first candidate is the top of the screen, where a gradebook
 * puts the figure it is about. Not sorted by confidence: a ranking implies a
 * judgement this has no way to make, and the student can see the lines.
 */
export function scoresIn(text: string, system: GradeSystem): Found[] {
  const out: Found[] = [];

  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) continue;

    // The self-evident shapes, wherever they are.
    for (const match of line.matchAll(SELF_EVIDENT)) {
      const saw = match[0].replace(/\s+/g, ' ').trim();
      add(out, { saw, reading: interpret(saw, system), line });
    }

    // Bare numbers and letters, only where the line says what it is about.
    if (!SAYS_SCORE.test(line)) continue;

    for (const match of line.matchAll(BARE)) {
      const saw = match[0];
      // Already offered as part of a percentage or a fraction on this line.
      if (out.some((f) => f.line === line && f.saw.includes(saw))) continue;
      add(out, { saw, reading: interpret(saw, system), line });
    }

    for (const match of line.matchAll(LETTER)) {
      const saw = match[1];
      add(out, { saw, reading: interpret(saw, system), line });
    }
  }

  return out;
}

/**
 * What to say when a photograph held nothing, said in the student's terms.
 *
 * A screen that reports "no scores found" about a page with a grade plainly on
 * it teaches somebody to stop trying. This names the two things that actually
 * go wrong — the shot, and the shape of what is on it — and leaves typing as
 * the route that always works, because it does.
 */
export const NOTHING_READ =
  'No score read from that. A tighter shot of the line with the number on it usually does it — or type it in, which always works.';

/**
 * Words too common to tie a line to a category.
 *
 * Shorter than `lib/ladder.ts`'s list and for a narrower job: this is matching
 * a gradebook line against a syllabus category, and both sides are two or
 * three words long. "Score", "grade" and "total" appear on nearly every line
 * of a score screen and in a fair few category names, so matching on them
 * would tie the first candidate to the first category every time.
 */
const COMMON = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'and', 'or', 'for', 'on', 'your', 'my',
  'score', 'scores', 'grade', 'grades', 'total', 'overall', 'average', 'percent',
  'percentage', 'points', 'point', 'pts', 'pt', 'mark', 'marks', 'class', 'course',
]);

/** The words of a string that are worth matching on. */
function meaningful(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/[a-z][a-z'-]+/g) ?? []).filter(
      (w) => w.length > 2 && !COMMON.has(w),
    ),
  );
}

/**
 * Which grading category a transcribed line appears to be about, or nothing.
 *
 * Proposed, never applied. The screen pre-selects what this returns and the
 * student can move it, because a number filed against the wrong category is a
 * projection that is wrong in both directions at once — the category that
 * gained it and the one that did not.
 *
 * Nothing rather than a best guess when no word is shared. A chooser that
 * opens on an arbitrary category invites the tap that files it there, and
 * "Attendance" landing in "Final exam" is a worse outcome than a chooser the
 * student has to think about for a moment.
 */
export function categoryFor(line: string, categories: string[]): number | null {
  const words = meaningful(line);
  if (words.size === 0) return null;

  let best = -1;
  let score = 0;
  let tied = false;

  categories.forEach((name, i) => {
    let shared = 0;
    for (const word of meaningful(name)) if (words.has(word)) shared++;
    if (shared === 0) return;
    if (shared > score) {
      score = shared;
      best = i;
      tied = false;
    } else if (shared === score) {
      tied = true;
    }
  });

  // A tie is not an answer. Two categories sharing one word with the line —
  // "Quiz average" against "Quizzes" and "Quiz participation" — is exactly
  // when picking either is a coin toss the student pays for.
  return best >= 0 && !tied ? best : null;
}
