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

/**
 * The fourth source, and the weakest: a reading of the line, offered.
 *
 * `readSpan` above is deliberately narrow — it wants the word and the numbers
 * together, and refuses a bare range, because a parser that fires on "worth 25
 * to 30%" narrows an exam to two units and is believed. The cost of that
 * narrowness is the case it cannot take: a syllabus that describes the scope
 * in a sentence rather than a span. *"Everything up to and including the
 * Fisher paper"* says exactly what is on the paper and matches nothing here,
 * so the runway falls through to the whole course.
 *
 * A model can read that sentence. What it must not do is decide with it.
 *
 * ## It proposes; the student disposes
 *
 * Nothing below is a source. {@link coverage} takes the same three it always
 * did, and a proposal changes no count on any screen until a person presses
 * the button that writes it into the box they could have typed it into
 * themselves — at which point it is `yours`, which is the source that already
 * means "you said so". That is the whole design, and it is why the refusal
 * this file opens with survives intact: the app still never infers what an
 * exam covers. It offers a reading, says where the reading came from, and
 * waits.
 *
 * ## The quote is checked, not trusted
 *
 * The reply carries the sentence it read the span out of, and
 * {@link readProposal} verifies that sentence is *in* the words it was given
 * before the proposal is shown. A model that paraphrases, or that supplies a
 * plausible line the syllabus never contained, produces no proposal rather
 * than an unverifiable one — the same rule `lib/cite.ts` applies to every
 * quote this app generates, for the same reason: a fabricated sentence about
 * what is on the exam is worse than no sentence.
 */
export function scopePrompt(units: { name: string }[]): string {
  const numbered = units
    .map((u) => u.name)
    .slice(0, 40)
    .join('\n  ');
  return `A university syllabus says something about what one exam covers. Read it and say which \
of the course's units are on the paper.

The units, in order:
  ${numbered}

Answer with JSON and nothing else:

  {"from": 1, "to": 8, "because": "the sentence you read it out of, word for word"}

Rules:
· "because" must be a sentence copied **exactly** from the text you were given. Not a paraphrase, \
not a summary, not a sentence you composed. It is checked against the source, and a proposal whose \
quote is not found is discarded.
· "from" and "to" are unit numbers as the list above numbers them.
· If the text does not actually say what the exam covers, answer {"from": null}. That is the \
common case and it is the right answer — a guess here sends somebody to revise the wrong material \
in the week before an exam.
· Do not infer a split from how many exams there are, or from where the exam falls in the term.`;
}

export interface Proposal {
  span: Span;
  /** Indices into the guide's units, as {@link unitsIn} reads them. */
  units: number[];
  /** The sentence it was read out of, verified to be in the source. */
  because: string;
  /** What pressing "use this" would put in the box — the student's own words. */
  text: string;
}

/**
 * A proposal out of a reply, or null.
 *
 * Null is the ordinary outcome twice over: most deadlines say nothing about
 * scope, and a reply that answers anyway has to survive three checks — the
 * numbers must be numbers, the span must select at least one unit the guide
 * actually has, and the quote must be findable in the words that were read.
 */
export function readProposal(
  raw: unknown,
  units: { name: string }[],
  source: string,
): Proposal | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { from?: unknown; to?: unknown; because?: unknown };

  const from = typeof r.from === 'number' && Number.isInteger(r.from) ? r.from : null;
  if (from === null || from < 1 || from > 99) return null;
  const to = typeof r.to === 'number' && Number.isInteger(r.to) ? r.to : from;
  if (to < 1 || to > 99) return null;

  const span: Span = from <= to ? { from, to } : { from: to, to: from };
  const picked = unitsIn(units, span);
  // A span that selects nothing is a span about a course this is not — the
  // same reason `coverage` falls back to the whole course rather than to an
  // empty one.
  if (picked.length === 0) return null;

  // A proposal that covers everything is not worth confirming: it is what the
  // screen already does, and offering it as a finding dresses the default up
  // as a discovery.
  if (picked.length === units.length) return null;

  const because = typeof r.because === 'string' ? r.because.trim() : '';
  if (!because || !flatten(source).includes(flatten(because))) return null;

  return {
    span,
    units: picked,
    because,
    // Written the way the box's own placeholder asks for it, so what lands
    // there is something the student could have typed and can edit after.
    text: span.from === span.to ? `unit ${span.from}` : `units ${span.from} to ${span.to}`,
  };
}
