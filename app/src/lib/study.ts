/**
 * The three parts of a guide that added material could not reach.
 *
 * `lib/figure.ts` closed the same gap for tables and diagrams. This closes it
 * for the long-form end of the app — the field guide and the cram sheet —
 * which are built from three fields the merge never touched:
 *
 *   frames    the cram sheet's spine. What an exam question about this unit
 *             actually looks like, and what it is really testing.
 *   selfTest  the questions at the end of the field guide, written to be
 *             answered out loud rather than clicked through.
 *   cases     the "claim → test → verdict" pairing PSCI's seven debates are
 *             the pure form of.
 *
 * Until this existed, a reading added in week six produced cards and terms, so
 * Cards and Read grew and the field guide and the cram sheet did not. Reading
 * the guide end to end in week twelve gave you the guide as it was written in
 * week one, and the cram sheet before the exam framed the syllabus and not the
 * reading the exam was actually on. That is the wrong way round: the material
 * added latest is usually the material the next exam is about.
 *
 * ## Why these are stricter than cards
 *
 * A card is one thing worth knowing and is drilled with its answer beside it.
 * These three are read as the guide's own voice — a frame tells you what to
 * expect from an exam, a case tells you a scholar tested a claim and what came
 * of it. An invented one is not a wrong flashcard, it is a false statement
 * about the course, sitting in the document you revise from the night before.
 *
 * So every field is required. A case missing its verdict is not a weaker case,
 * it is not a case, and it is dropped whole rather than rendered with a gap.
 */

import type { CaseFile, Example, Frame, StudyCard } from './types';
import { MOST as DEFAULT_CAPS, type Caps } from './controls';

/**
 * How many of each, at most.
 *
 * Small on purpose. One reading should not double the length of a cram sheet:
 * the point of the cram sheet is that it is short enough to read before an
 * exam, and a model asked for "frames" without a ceiling will produce one per
 * paragraph.
 *
 * The numbers moved to `lib/controls.ts`, which is where a student's choice of
 * depth now scales them. This is still the default and still what the app does
 * for anybody who has not touched a control — `capsFor()` with no argument is
 * these four numbers exactly.
 */
export const MOST = DEFAULT_CAPS;

const SHORT = 120;
const LONG = 400;

/**
 * The shapes, at a given set of ceilings.
 *
 * A function rather than a constant because the ceilings are a student's
 * choice now. `STUDY_SHAPES` below is this at the defaults, kept so the
 * callers that have no controls to pass read exactly as they did.
 */
export function studyShapes(caps: Caps = DEFAULT_CAPS): string {
  return `frames: 0 to ${caps.frames} exam frames — what a question about this material \
actually looks like, and what it is testing underneath. {"t":"The framing","d":"What it is really \
asking, and what a good answer has to do."} These go on the cram sheet, so write the ones worth \
reading an hour before an exam and no others.

selfTest: 0 to ${caps.tests} questions to answer out loud, with the answer. {"q":"…","a":"…"} \
Broader than a flashcard — a question that makes you say the whole idea, not name one fact.

cases: 0 to ${caps.cases} claim-and-test pairings, and only where the material genuinely contains \
one: a stated claim, a study or episode that tested it, and what came of it. \
{"title":"…","when":"1968","claim":"What people believed","test":"Who tested it and how", \
"verdict":"What they found","lesson":"What it means for the course"} All six fields are required. \
If the material does not name who tested the claim, there is no case — return none.

examples: 0 to ${caps.examples} worked examples — the concept pointed at something concrete the \
material actually discusses. {"tag":"Elasticity","t":"Short title of the case","d":"What it is and \
why the concept explains it."} Not an illustration you thought of: if the material does not work \
the example, there is no example.

Return an empty list for any of these the material does not support, which is the common case. \
Never infer a frame from what an exam usually asks, a verdict from what is generally believed, or \
a date the material does not give.`;
}

/** The shapes at the default ceilings — what every caller used before. */
export const STUDY_SHAPES = studyShapes();

function text(v: unknown, cap: number): string {
  return typeof v === 'string' ? v.trim().slice(0, cap) : '';
}

/** Exam frames — a title and what it is really testing. */
export function readFrames(raw: unknown, caps: Caps = DEFAULT_CAPS): Frame[] {
  if (!Array.isArray(raw)) return [];
  const out: Frame[] = [];
  for (const one of raw) {
    if (!one || typeof one !== 'object') continue;
    const f = one as { t?: unknown; d?: unknown };
    const t = text(f.t, SHORT);
    const d = text(f.d, LONG);
    if (t && d) out.push({ t, d });
    if (out.length === caps.frames) break;
  }
  return out;
}

/** Questions written to be answered out loud. */
export function readSelfTest(raw: unknown, caps: Caps = DEFAULT_CAPS): StudyCard[] {
  if (!Array.isArray(raw)) return [];
  const out: StudyCard[] = [];
  for (const one of raw) {
    if (!one || typeof one !== 'object') continue;
    const c = one as { q?: unknown; a?: unknown };
    const q = text(c.q, LONG);
    const a = text(c.a, LONG);
    if (q && a) out.push({ q, a });
    if (out.length === caps.tests) break;
  }
  return out;
}

/**
 * Claim, test, verdict.
 *
 * All six fields required, and this is the one place where that strictness
 * does visible work: a case rendered without its `test` reads as "people
 * believed X, and in fact Y", which is a claim the app would be making on its
 * own account.
 */
export function readCases(raw: unknown, caps: Caps = DEFAULT_CAPS): CaseFile[] {
  if (!Array.isArray(raw)) return [];
  const out: CaseFile[] = [];
  for (const one of raw) {
    if (!one || typeof one !== 'object') continue;
    const c = one as Record<string, unknown>;
    const made: CaseFile = {
      title: text(c.title, SHORT),
      when: text(c.when, 40),
      claim: text(c.claim, LONG),
      test: text(c.test, LONG),
      verdict: text(c.verdict, LONG),
      lesson: text(c.lesson, LONG),
    };
    if (Object.values(made).every(Boolean)) out.push(made);
    if (out.length === caps.cases) break;
  }
  return out;
}

/** Worked examples — a tag, a title and what it shows. */
export function readExamples(raw: unknown, caps: Caps = DEFAULT_CAPS): Example[] {
  if (!Array.isArray(raw)) return [];
  const out: Example[] = [];
  for (const one of raw) {
    if (!one || typeof one !== 'object') continue;
    const e = one as { tag?: unknown; t?: unknown; d?: unknown };
    const tag = text(e.tag, 40);
    const t = text(e.t, SHORT);
    const d = text(e.d, LONG);
    if (tag && t && d) out.push({ tag, t, d });
    if (out.length === caps.examples) break;
  }
  return out;
}

export interface StudyParts {
  frames: Frame[];
  selfTest: StudyCard[];
  cases: CaseFile[];
  examples: Example[];
}

/** All three out of one reply. */
export function readStudyParts(
  raw: {
    frames?: unknown;
    selfTest?: unknown;
    cases?: unknown;
    examples?: unknown;
  },
  /**
   * The ceilings actually asked for.
   *
   * These readers each stop at a ceiling, and until now it was always the
   * default one — so a student who chose `full` was asked for nine frames in
   * the prompt and kept six, and a student who chose `brief` was asked for two
   * and kept whatever came. The number in the prompt was a request and the
   * number here is the rule, and they have to be the same number or the
   * control only half works. Defaulted, so every caller with no controls to
   * pass behaves exactly as it did.
   */
  caps: Caps = DEFAULT_CAPS,
): StudyParts {
  return {
    frames: readFrames(raw.frames, caps),
    selfTest: readSelfTest(raw.selfTest, caps),
    cases: readCases(raw.cases, caps),
    examples: readExamples(raw.examples, caps),
  };
}

/** What was found, in a line, for the confirmation before it is saved. */
export function describeStudyParts(p: StudyParts): string {
  const bits = [
    p.frames.length && `${p.frames.length} exam ${p.frames.length === 1 ? 'frame' : 'frames'}`,
    p.selfTest.length && `${p.selfTest.length} to answer out loud`,
    p.cases.length && `${p.cases.length} ${p.cases.length === 1 ? 'case' : 'cases'}`,
    p.examples.length && `${p.examples.length} worked ${p.examples.length === 1 ? 'example' : 'examples'}`,
  ].filter(Boolean);
  return bits.join(' · ');
}

/**
 * "3 of these came from material you added" — or nothing at all.
 *
 * The field guide and the cram sheet interleave the guide's own with yours,
 * on purpose: a cram sheet that put your frames in a box at the bottom is a
 * cram sheet you read the top of. So the only place the distinction can be
 * made is a line under the heading, and only when there is something to say.
 */
export function addedLine(n: number, noun: string): string {
  if (n <= 0) return '';
  return `${n} of these ${n === 1 ? 'is' : 'are'} from material you added — ${noun} the guide was written without.`;
}
