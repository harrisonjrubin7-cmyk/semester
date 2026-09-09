/**
 * What an exam actually covers, which the app has been assuming is everything.
 *
 * `lib/runway.ts` counts the units of the course's guide and reports how many
 * you have never opened. Every figure on that screen — units untouched, cards
 * unseen, what is due before the exam, which unit is weakest — is computed over
 * *all* of them, because nothing in the app has ever known which ones are on
 * the paper.
 *
 * For a final that is fair. For the midterm that PSCI 1104's syllabus describes
 * as "units 1 to 8" it is wrong in the direction that hurts: fourteen units
 * counted where eight are examinable, six of them dragging the "untouched"
 * figure up, and a weakest-unit recommendation that can point at material the
 * exam will not ask about. A student in the week before a midterm is the last
 * person who should be sent to revise the wrong thing.
 *
 * ## Three sources, and it always says which
 *
 * - **The syllabus said so.** "Units 1 to 8", "covers chapters 4–7", "sessions
 *   3 through 9" — read out of the deadline's own words, which the app already
 *   keeps verbatim.
 * - **You said so.** A box on the runway. The syllabus is often silent or
 *   ambiguous, the professor says it in the last lecture, and what you were
 *   told beats what the PDF managed to write down.
 * - **Nobody said.** The whole course, exactly as before — and the screen says
 *   plainly that it is counting everything because it was not told otherwise,
 *   rather than presenting a default as a fact.
 *
 * ## What it will not do is guess
 *
 * There is an obvious inference available: three exams, fourteen units, split
 * them evenly. It is not made. A student told "Midterm 2 covers units 6 to 10"
 * by arithmetic rather than by their syllabus will revise 6 to 10, and when the
 * real split was 5 to 9 the app has actively caused the one failure it exists
 * to prevent. A default that is visibly a default costs nothing; a guess that
 * looks like a fact costs a grade.
 */

import { unitNumber } from './session.place';
import { flatten } from './cite';

export type Source = 'said' | 'yours' | 'whole';

export interface Coverage {
  /** Indices into the guide's units. */
  units: number[];
  source: Source;
  /** The words that decided it, when something did. */
  words: string;
  /** The numbered span, where one was read. */
  span: Span | null;
}

export interface Span {
  from: number;
  to: number;
}

/**
 * The words a syllabus uses for the thing a course is divided into.
 *
 * All of them, because a course calls its own divisions whatever it likes and
 * the guide's unit numbers are the same numbers whichever word the syllabus
 * chose. A course that numbers weeks and a course that numbers chapters both
 * mean "the fifth one" by 5.
 */
const PARTS = 'units?|sessions?|chapters?|weeks?|lectures?|modules?|topics?|parts?';

const TO = '-|–|—|to|through|thru|until|till|and';

/**
 * A numbered span out of a sentence, or null.
 *
 * Deliberately narrow. It wants the word and the numbers together — "units 1
 * to 8", "chapters 4–7" — and refuses a bare "1 to 8", which in a line about a
 * deadline is as likely to be a time, a page range or a mark scheme. A parser
 * that fires on a bare range would silently narrow an exam to two units
 * because the syllabus wrote "worth 25 to 30%".
 */
export function readSpan(text: string): Span | null {
  const said = flatten(text);
  const both = new RegExp(`\\b(?:${PARTS})\\s*(\\d{1,2})\\s*(?:${TO})\\s*(\\d{1,2})\\b`).exec(said);
  if (both) {
    const from = Number(both[1]);
    const to = Number(both[2]);
    return from <= to ? { from, to } : { from: to, to: from };
  }
  // "covers unit 7" — one part, which is a span of one rather than a
  // different kind of answer.
  const one = new RegExp(`\\b(?:${PARTS})\\s*(\\d{1,2})\\b`).exec(said);
  if (one) {
    const n = Number(one[1]);
    return { from: n, to: n };
  }
  return null;
}

/** Whether the words say, in so many terms, that it is the whole course. */
export function saysEverything(text: string): boolean {
  return /\b(cumulative|comprehensive|all material|everything (?:we|covered|from)|whole course|entire course)\b/i.test(
    text,
  );
}

/**
 * The units a span picks out, by the numbers the guide's own names carry.
 *
 * A unit named `5 · Surplus & elasticity` is unit five in the only sense the
 * syllabus and the student share. Where a guide numbers nothing — a course
 * imported from a syllabus that listed no sessions — no span can select
 * anything, and the caller falls back to the whole course rather than to an
 * empty one, which would be a runway with nothing on it.
 */
export function unitsIn(units: { name: string }[], span: Span): number[] {
  const out: number[] = [];
  units.forEach((u, i) => {
    const n = unitNumber(u.name);
    if (n !== null && n >= span.from && n <= span.to) out.push(i);
  });
  return out;
}

const all = (units: { name: string }[]): number[] => units.map((_, i) => i);

export interface CoverInput {
  /** The exam, in the words the app already keeps: title, detail, quote. */
  exam: { title: string; detail?: string; quote?: string };
  units: { name: string }[];
  /** What the student typed for this exam, if anything. */
  yours?: string;
}

/**
 * What to count, and on whose authority.
 *
 * The student's own words come first — not because they are more likely to be
 * right, but because they were typed *after* reading whatever the syllabus
 * said, in front of this screen, on purpose. An app that let a parse of a PDF
 * overrule that would be unusable the first time the PDF was ambiguous.
 */
export function coverage(input: CoverInput): Coverage {
  const { exam, units } = input;

  const yours = (input.yours ?? '').trim();
  if (yours) {
    if (saysEverything(yours) || /^(all|everything)$/i.test(yours)) {
      return { units: all(units), source: 'yours', words: yours, span: null };
    }
    // A bare range is fine here and refused from a syllabus: this box asks one
    // question, so "5-9" in it can only be an answer to that question.
    const span = readSpan(yours) ?? bareSpan(yours);
    const picked = span ? unitsIn(units, span) : [];
    if (picked.length > 0) return { units: picked, source: 'yours', words: yours, span };
  }

  const words = [exam.title, exam.detail ?? '', exam.quote ?? ''].filter(Boolean).join(' · ');
  if (!saysEverything(words)) {
    const span = readSpan(words);
    const picked = span ? unitsIn(units, span) : [];
    if (picked.length > 0) return { units: picked, source: 'said', words, span };
  }

  return { units: all(units), source: 'whole', words: '', span: null };
}

/** "5-9" and "5 to 9", for the box that asks nothing else. */
function bareSpan(text: string): Span | null {
  const m = new RegExp(`^\\s*(\\d{1,2})\\s*(?:${TO})\\s*(\\d{1,2})\\s*$`).exec(flatten(text));
  if (m) {
    const from = Number(m[1]);
    const to = Number(m[2]);
    return from <= to ? { from, to } : { from: to, to: from };
  }
  const one = /^\s*(\d{1,2})\s*$/.exec(text);
  return one ? { from: Number(one[1]), to: Number(one[1]) } : null;
}

/**
 * The sentence above the unit list, which is a claim about authority as much
 * as about arithmetic.
 *
 * The default case is the one that had to be written carefully: "counting all
 * fourteen" is what the app has always done, and saying so — with the reason
 * and the fix in the same breath — is the difference between a default and a
 * pretence.
 */
export function coverageLine(c: Coverage, total: number): string {
  const n = c.units.length;
  switch (c.source) {
    case 'said':
      return `Covering ${n} of ${total} units — the syllabus says ${
        c.span ? `${c.span.from} to ${c.span.to}` : 'so'
      }.`;
    case 'yours':
      return n === total
        ? `Covering all ${total} units, because you said so.`
        : `Covering ${n} of ${total} units, because you said so.`;
    default:
      return `Counting all ${total} units. Nothing in this deadline says what the exam covers, so the app is not assuming a narrower answer — say what it covers and everything here follows it.`;
  }
}

/** Whether saying so would change anything. False for a one-unit course. */
export function worthSaying(total: number): boolean {
  return total > 1;
}
