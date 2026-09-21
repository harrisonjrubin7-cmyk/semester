/**
 * One thing said, several things meant.
 *
 * `lib/capture.ts` turns *"econ ps4 friday 5pm"* into a deadline, and it is
 * the best thing in the app for adding something you were just told about —
 * as long as you add one thing. Walking out of a lecture you have three, and
 * the box takes them one at a time: type, confirm, clear, type, confirm,
 * clear. The third one does not get added.
 *
 * Speaking is the natural shape for that moment and the browser already
 * transcribes speech — `dictate` in `lib/mic.ts`, which has been there for
 * lecture notes. What comes back is one run of text with three things in it,
 * and dropping that whole run into the capture box produces one deadline
 * called "econ problem set four friday psci reading response tuesday pick up
 * my library book". That is worse than nothing, because it is *plausible*:
 * it has a course, a kind and a date, so it commits, and the other two things
 * are gone.
 *
 * This is the missing step. It cuts a run into the things it is made of and
 * hands each one to `capture`, so what comes back is rows.
 *
 * ## Four ways to find a seam, in the order they can be trusted
 *
 * 1. **Written breaks.** A newline, a semicolon, a bullet. Somebody pasting a
 *    list has already done the splitting and the only way to get it wrong is
 *    to ignore them.
 * 2. **A full stop.** Both iOS and Chrome punctuate a pause, so a spoken list
 *    usually arrives with sentence breaks in it. Guarded: `p.m.` is not the
 *    end of a sentence and neither is `Dr.`, and a splitter that thought so
 *    would cut in the middle of the one field people always dictate.
 * 3. **The words people join lists with.** "also", "and then", "next", "oh
 *    and". Plain "and" is deliberately *not* one: "read chapters four and
 *    five" is one reading, and cutting it produces two items neither of which
 *    is true.
 * 4. **A second course.** The structural one, and the only one that works on a
 *    run with no punctuation and no joining words at all: a fragment that
 *    already has both a course *and* a date is a finished item, so another
 *    course name after it is the start of the next.
 *
 *    Both halves of that condition are load-bearing. Without the date, "the
 *    ECON and PSCI joint session Friday" is cut into two things that were one.
 *    A second *date* is deliberately not a seam at all, though it sounds like
 *    the symmetric rule: a course name marks where the next item begins, and
 *    a date does not — "read the chapter Friday return the book Tuesday" would
 *    cut at "Tuesday" and leave a piece that is nothing but a date.
 *
 * ## Over-cutting and under-cutting are not the same mistake
 *
 * Both are recoverable here, and only because nothing is written. Every piece
 * is drawn, read back through `capture`, and committed one press at a time —
 * the rule `lib/capture.ts` states for itself: *"a blank the student fills is
 * recoverable and a wrong date they never noticed is not"*. Splitting inherits
 * it. A run cut into four when it was three is four rows on screen, one of
 * which gets deleted. A run left whole is one row that gets edited.
 *
 * What neither may do is lose words. {@link split} is a partition: every
 * non-separator character of the input comes back in exactly one piece, and
 * there is a test that says so over a corpus rather than over an example.
 *
 * ## No model, for `lib/capture.ts`'s reason
 *
 * A model would split better at the tail. It would also occasionally invent a
 * fourth item, or move a date from one thing to another, and neither is
 * visible to somebody skimming four rows before pressing Add. Rules are worse
 * and checkable, and this one is checked by the student every time.
 */

import { capture, type Caught, type Named } from './capture';

/** Which seam produced a piece, so the screen can say why it cut. */
export type Seam =
  /** The first piece: nothing was cut to produce it. */
  | 'first'
  /** A newline, semicolon or bullet in the text itself. */
  | 'written'
  /** A sentence ended. */
  | 'stop'
  /** A word people join lists with — "also", "and then". */
  | 'said'
  /** A second course name, where the piece before it was already complete. */
  | 'course';

export interface Piece {
  /** The words, tidied of the separator that produced them. */
  text: string;
  /** What cut here. */
  seam: Seam;
}

/**
 * Words that end a list item rather than a sentence.
 *
 * Only the ones that genuinely join — "and" on its own joins two halves of
 * one thing as often as it joins two things, which is why it is absent.
 */
const JOINERS =
  /\s+(?:and\s+then|oh\s*,?\s*and|also\s*,?|then\s*,?|next\s*,?|after\s+that\s*,?|plus\s+)\s*/gi;

/**
 * Abbreviations whose full stop is not the end of anything.
 *
 * `p.m.` is the one that matters — it is in the field people dictate most —
 * and the rest are here because a list of one looks like an oversight.
 */
const NOT_AN_END = /\b(?:a\.?m|p\.?m|mr|mrs|ms|dr|prof|st|vs|no|approx|etc|e\.g|i\.e)\.$/i;

/** A written break: a line, a semicolon, or a bullet somebody typed. */
const WRITTEN = /\s*(?:\r?\n+|;|•|\s+–\s+|\s+-\s+)\s*/;

/**
 * A piece, without the punctuation that separated it from its neighbour.
 *
 * The trailing full stop goes: it ended the sentence rather than belonging to
 * the item, and a title reading "psci reading tuesday." would carry it into
 * the deadline. Except where it is an abbreviation's — the same guard
 * {@link onStops} needs, for the same reason. "due at 5 p.m." must not come
 * back as "due at 5 p.m", which is the one field people always dictate.
 */
function tidy(s: string): string {
  const one = s.replace(/\s+/g, ' ').replace(/^[\s,.;:•-]+|[\s,;:]+$/g, '').trim();
  return NOT_AN_END.test(one) ? one : one.replace(/[.!?]+$/, '').trim();
}

/** Step 1: the breaks somebody typed. Nothing here is a guess. */
function onWritten(text: string): string[] {
  return text.split(WRITTEN);
}

/**
 * Step 2: sentences, where a full stop really ended one.
 *
 * Walks the stops rather than splitting on a pattern, because the decision
 * needs the text to the *left* of each one — "5 p.m." and "Friday." differ
 * only there.
 */
function onStops(text: string): string[] {
  const out: string[] = [];
  let from = 0;
  const re = /[.!?]+(?=\s)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const head = text.slice(from, m.index + m[0].length);
    if (NOT_AN_END.test(head.trimEnd())) continue;
    // A single letter before the stop is an initial, not a sentence.
    if (/(?:^|\s)[A-Za-z][.!?]+$/.test(head.trimEnd())) continue;
    out.push(head);
    from = m.index + m[0].length;
  }
  out.push(text.slice(from));
  return out.filter((s) => s.trim() !== '');
}

/** Step 3: the words people join a spoken list with. */
function onJoiners(text: string): string[] {
  return text.split(JOINERS);
}

/**
 * Step 4: a second course or a second date, on a run with no seams in it.
 *
 * The rule is narrow on purpose. A cut happens only where the fragment so far
 * already carries the thing being met again — a second course after a course,
 * a second date after a date — because that is the only configuration in
 * which the new word cannot belong to what came before. "ECON problem set due
 * Friday PSCI reading Tuesday" cuts; "the ECON and PSCI joint session Friday"
 * does not, because the first fragment has no date yet when PSCI arrives.
 *
 * Words are walked rather than the string scanned, so a cut always lands on a
 * word boundary and the two halves put back together are the input again.
 */
function onStructure(text: string, courses: Named[], now: Date): { text: string; seam: Seam }[] {
  const words = text.split(/\s+/).filter((w) => w !== '');
  if (words.length < 4) return [{ text, seam: 'first' }];

  const out: { text: string; seam: Seam }[] = [];
  let from = 0;
  for (let i = 1; i < words.length; i++) {
    const soFar = words.slice(from, i).join(' ');
    const here = capture(soFar, courses, now);
    // A finished item is the only thing worth cutting away from. Both halves
    // matter — see the note on this function.
    if (!here.courseId || !here.date) continue;

    // What this word starts, as against what it would join. A cut is only
    // right where the word begins something new, so the word itself has to be
    // where the next course name is read from.
    const next = capture(words.slice(i).join(' '), courses, now);
    const secondCourse =
      Boolean(next.courseId) &&
      next.courseId !== here.courseId &&
      startsWith(words[i], next.from.course);

    if (!secondCourse) continue;
    out.push({ text: soFar, seam: out.length === 0 ? 'first' : 'course' });
    from = i;
  }
  out.push({ text: words.slice(from).join(' '), seam: out.length === 0 ? 'first' : 'course' });
  return out;
}

/** Whether this word is where that matched phrase begins. */
function startsWith(word: string, phrase: string): boolean {
  if (!phrase) return false;
  const first = phrase.trim().split(/\s+/)[0] ?? '';
  const strip = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return strip(word) !== '' && strip(word) === strip(first);
}


/**
 * One run of text, cut into the things it is made of.
 *
 * Applied in order, each step over the pieces the last one produced, so a run
 * with a written break in one half and none in the other is cut correctly in
 * both. A piece that survives every step whole is one thing, which is the
 * common case and has to stay cheap.
 */
export function split(text: string, courses: Named[], now: Date): Piece[] {
  const first: Piece[] = [];
  for (const [i, piece] of onWritten(text).entries()) {
    if (tidy(piece) === '') continue;
    first.push({ text: piece, seam: i === 0 || first.length === 0 ? 'first' : 'written' });
  }

  const stops: Piece[] = [];
  for (const p of first) {
    for (const [i, s] of onStops(p.text).entries()) {
      if (tidy(s) === '') continue;
      stops.push({ text: s, seam: i === 0 ? p.seam : 'stop' });
    }
  }

  const said: Piece[] = [];
  for (const p of stops) {
    for (const [i, s] of onJoiners(p.text).entries()) {
      if (tidy(s) === '') continue;
      said.push({ text: s, seam: i === 0 ? p.seam : 'said' });
    }
  }

  const out: Piece[] = [];
  for (const p of said) {
    for (const [i, s] of onStructure(p.text, courses, now).entries()) {
      if (tidy(s.text) === '') continue;
      out.push({ text: tidy(s.text), seam: i === 0 ? p.seam : s.seam });
    }
  }

  // Empty only for input that was blank to begin with. Every step above
  // either passes a piece through or replaces it with pieces, and
  // `onStructure` always emits its tail — so a run with a word in it cannot
  // come back as nothing, and there is a test over a corpus saying so rather
  // than a guard here that has never fired and could not be known to work.
  return out;
}

/** A piece, with what `capture` made of it. */
export interface Read extends Piece {
  caught: Caught;
}

/**
 * The whole job: cut the run up, and read each piece.
 *
 * The one function a screen needs. Reading happens here rather than in the
 * component so that the split and the parse are tested together — a seam that
 * cuts a date in half is a splitting bug that only shows up as a parsing one.
 */
export function readAloud(text: string, courses: Named[], now: Date): Read[] {
  return split(text, courses, now).map((p) => ({ ...p, caught: capture(p.text, courses, now) }));
}

/** What to say above the rows, naming the count rather than claiming success. */
export function heardLine(rows: Read[]): string {
  if (rows.length === 0) return 'Nothing was heard.';
  if (rows.length === 1) return 'One thing. Check it before adding it.';
  return `${rows.length} things. Check each before adding it — anything cut wrongly can be edited or dropped.`;
}
