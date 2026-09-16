/**
 * Worked examples a course can have without somebody writing them.
 *
 * The Cases tab shows two things and a generated course has neither. Measured
 * across the four shipped courses: **32 applied examples**, eight each, and
 * **7 claim-and-test pairings, all of them in PSCI 1104** — §3.4 of the
 * completion plan says eight, and seven is what is there.
 *
 * The examples are also thinner than the name suggests. `Example` was
 * `{ tag, t, d }`: a tag, a title, a paragraph. That is a worked example in
 * the sense of a short illustrated case and not in the sense of a problem
 * carried through its steps with the arithmetic shown — which is the thing a
 * problem set is made of and the thing a quantitative course grades.
 *
 * ## Three shapes, and an absent discriminator means the old one
 *
 * `Example` is a union now: `applied` as it was, `worked` (a statement, the
 * steps in order, a result) and `study` (a situation, the question it poses,
 * the analysis, and what it turned on). `kind` is optional and absent reads as
 * `applied`, so all thirty-two shipped examples are still valid and nothing is
 * migrated — the same choice `Figure` made about `figures?` and for the same
 * reason: everything written before a field existed has to keep working.
 *
 * The typecheck is what made this safe. Widening the union broke six files
 * that read `.d`, each of which had to say what a worked example says instead,
 * and `says` below is the answer they now share rather than six switches.
 *
 * ## What shape a unit calls for is read off the unit
 *
 * §3.4 proposed "the course type selecting the few-shot template". There is no
 * course type: `Course` in `lib/types.ts` has a code, a name, a professor and
 * a grading table, and nothing that says whether the course is quantitative.
 * Inventing one to select on would be a field somebody has to maintain and
 * nobody has a reason to fill in.
 *
 * The material answers the question directly, so `shapeFor` reads it. A unit
 * whose cards are full of formulas and figures wants a worked problem; one
 * whose cards argue wants a case study. Measured against the four shipped
 * courses in `casework.test.ts`, which is the only way to know a rule like
 * this is not describing its author's expectations.
 *
 * ## Nothing is kept that the material does not support
 *
 * This is the part §3.4 is most insistent about, and it is the same question
 * `lib/cite.ts` asks of a generated quote: does this trace back to the
 * material, or did the model supply it? A case that introduces a fact the
 * course does not support is refused rather than shown with a caveat.
 *
 * So every case has to carry `from` — a sentence copied **exactly** out of the
 * unit it was written from — and `readCases` checks it against that material.
 * A case whose quote is not found is dropped whole, not trimmed. It is the
 * arrangement `lib/covers.ts` uses for exam scope, and it works for the same
 * reason: a model that has to quote the source to be believed cannot support
 * an invented claim with an invented citation, because the citation is the
 * thing being checked.
 *
 * That is a weaker claim than "every fact in this case is in the course", and
 * it is the strongest one that can actually be checked. It is stated here so
 * that nobody reads the refusal as more than it is.
 */

import { flatten } from './cite';
import { EXAMPLE_KINDS, exampleKind, type Example, type ExampleKind, type Unit } from './types';

/** At most this many cases from one ask, and at most this long. */
const MOST = 3;
const SHORT = 120;
const LONG = 400;
const MOST_STEPS = 8;

function text(v: unknown, cap: number): string {
  return typeof v === 'string' ? v.trim().slice(0, cap) : '';
}

/**
 * An example's body as prose, whatever shape it is.
 *
 * Six files read `.d` before this existed — a cram sheet, a document template,
 * a changeset summary, a review sheet, the paste reader and the Cases tab —
 * and every one of them wanted the same thing: the words. One function rather
 * than six switches, so a fourth shape is a change here instead of a hunt.
 */
export function says(e: Example): string {
  switch (exampleKind(e)) {
    case 'worked': {
      const w = e as Extract<Example, { kind: 'worked' }>;
      return [w.statement, ...w.steps, w.result].filter(Boolean).join(' ');
    }
    case 'study': {
      const s = e as Extract<Example, { kind: 'study' }>;
      return [s.situation, s.question, s.analysis, s.turned].filter(Boolean).join(' ');
    }
    default:
      return (e as Extract<Example, { kind?: 'applied' }>).d;
  }
}

/** Whether an example has anything in it at all. */
export function filled(e: Example): boolean {
  return e.tag.trim() !== '' && e.t.trim() !== '' && says(e).trim() !== '';
}

/**
 * Every word a unit holds, which is what a case is checked against.
 *
 * The unit's own cards and nothing else. Not the whole guide: a case written
 * from unit three and quoting unit nine has wandered, and the point of the
 * check is that the case came from the material it says it came from.
 */
export function material(unit: Unit): string {
  return [unit.name, ...unit.cards.flatMap((c) => [c.q, c.a])].join('\n');
}

/**
 * How much of a unit reads as quantitative, from 0 to 1.
 *
 * Counted over cards rather than characters, because one formula-heavy answer
 * in a unit of prose is an aside and a unit where half the cards carry numbers
 * is a quantitative unit. What counts: a run of digits with an operator near
 * it, a Greek letter, a per-cent, or one of the relational symbols a formula
 * uses. What does not: a bare year or a page number, which is why a digit on
 * its own is not enough.
 */
export function numeric(unit: Unit): number {
  if (unit.cards.length === 0) return 0;
  const sums = unit.cards.filter((c) => {
    const said = `${c.q} ${c.a}`;
    return (
      /\d\s*[-+×÷*/=<>≤≥]\s*\d/.test(said) ||
      /[α-ωΑ-Ω∑∫√±≤≥≈]/.test(said) ||
      /\d\s*%/.test(said) ||
      /\b[A-Z]{1,3}\s*=\s*/.test(said)
    );
  });
  return sums.length / unit.cards.length;
}

/** Above this share of a unit's cards carrying arithmetic, it wants a worked problem. */
export const QUANTITATIVE = 0.25;

/**
 * The shape this unit's material calls for.
 *
 * Read off the unit, for the reason at the top of this file: there is no
 * course type to select on, and the material answers the question anyway.
 * `applied` is not a fallback here — it is what a unit of definitions wants,
 * and it is the shape the four shipped courses chose thirty-two times.
 */
export function shapeFor(unit: Unit): ExampleKind {
  if (numeric(unit) >= QUANTITATIVE) return 'worked';
  /*
   * A case study needs a situation, and a situation needs somebody in it.
   * A unit of definitions has no actor, and asking for a case study of one
   * produces an invented company doing an invented thing — which is exactly
   * the fabrication the grounding check below exists to refuse, arrived at by
   * asking the wrong question rather than by getting a wrong answer.
   */
  const peopled = unit.cards.filter((c) => /\b(19|20)\d\d\b|\bwho\b|\bfirm\b|\bcompany\b|\bcase\b|\bstudy\b|\bfound\b/i.test(`${c.q} ${c.a}`));
  return peopled.length >= Math.max(2, unit.cards.length * 0.3) ? 'study' : 'applied';
}

/** What to ask for, for one unit, in the shape its material calls for. */
export function casePrompt(unit: Unit, shape: ExampleKind = shapeFor(unit)): string {
  const cards = unit.cards
    .slice(0, 12)
    .map((c) => `Q: ${c.q}\nA: ${c.a}`)
    .join('\n\n');

  const wanted =
    shape === 'worked'
      ? `{"kind":"worked","tag":"the concept","t":"a title","statement":"the problem, with its numbers",\
"steps":["each step, in order, with the arithmetic shown"],"result":"the answer and what it means",\
"from":"a sentence copied word for word from the material above"}`
      : shape === 'study'
        ? `{"kind":"study","tag":"the concept","t":"a title","situation":"what was happening",\
"question":"what had to be decided","analysis":"how the course's idea applies to it",\
"turned":"what the answer turned on","from":"a sentence copied word for word from the material above"}`
        : `{"kind":"applied","tag":"the concept","t":"a title","d":"the idea pointed at something \
concrete","from":"a sentence copied word for word from the material above"}`;

  return `Here is one unit of a university course, as the questions and answers a student drills.

${unit.name}

${cards}

Write at most ${MOST} worked examples from this material. Answer with a JSON array and nothing else. \
Each item:

  ${wanted}

Rules:
· "from" must be a sentence copied **exactly** from the material above. Not a paraphrase, not a \
summary, not a sentence you composed. It is checked against the material, and an example whose \
quote is not found is discarded whole.
· Use only what the material says. Do not add a figure, a date, a study or a name that is not in \
it. An example that needs a fact the material does not have is one you should not write.
· Fewer is better than padded. Two good ones beat three.
· If the material will not support an example of this kind, answer [].`;
}

/** An example that was written by a model, with the sentence it came from. */
export interface Grounded {
  example: Example;
  /** The sentence it was written from, verified to be in the unit. */
  from: string;
}

/**
 * The examples in a reply that the material actually supports.
 *
 * Every one is checked twice: that it is a complete example of the shape it
 * claims, and that the sentence it says it came from is in the unit, word for
 * word. A failure of either drops that example and keeps the rest — one bad
 * item in a reply of three is not a reason to lose the two good ones, which is
 * the difference between this and `lib/figure.ts`, where a malformed arm makes
 * the whole figure unusable.
 */
export function readCases(raw: unknown, unit: Unit): Grounded[] {
  if (!Array.isArray(raw)) return [];
  const held = flatten(material(unit));
  const out: Grounded[] = [];

  for (const one of raw) {
    if (out.length >= MOST) break;
    if (!one || typeof one !== 'object') continue;
    const r = one as Record<string, unknown>;

    const from = text(r.from, LONG);
    // The grounding check, and the reason it is before the shape check: an
    // example nobody can trace is not worth reading closely first.
    if (!from || !held.includes(flatten(from))) continue;

    const example = shaped(r);
    if (!example || !filled(example)) continue;
    out.push({ example, from });
  }
  return out;
}

/** One reply item as an example, or nothing where it is not one. */
function shaped(r: Record<string, unknown>): Example | null {
  const kind = typeof r.kind === 'string' && (EXAMPLE_KINDS as readonly string[]).includes(r.kind)
    ? (r.kind as ExampleKind)
    : 'applied';
  const tag = text(r.tag, 40);
  const t = text(r.t, SHORT);
  if (!tag || !t) return null;

  if (kind === 'worked') {
    const statement = text(r.statement, LONG);
    const steps = Array.isArray(r.steps)
      ? r.steps.map((s) => text(s, LONG)).filter(Boolean).slice(0, MOST_STEPS)
      : [];
    const result = text(r.result, LONG);
    // A worked problem with no steps is a paragraph claiming to be one, which
    // is the shape this arm exists to stop being written as.
    if (!statement || steps.length < 2 || !result) return null;
    return { kind: 'worked', tag, t, statement, steps, result };
  }

  if (kind === 'study') {
    const situation = text(r.situation, LONG);
    const question = text(r.question, LONG);
    const analysis = text(r.analysis, LONG);
    const turned = text(r.turned, LONG);
    if (!situation || !question || !analysis || !turned) return null;
    return { kind: 'study', tag, t, situation, question, analysis, turned };
  }

  const d = text(r.d, LONG);
  return d ? { kind: 'applied', tag, t, d } : null;
}
