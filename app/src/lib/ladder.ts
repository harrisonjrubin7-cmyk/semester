/**
 * Hints, in rungs, for a question you are stuck on.
 *
 * The practice quiz has one move: pick, and be told. Stuck on question four,
 * the choice is a guess or the back button, and both teach nothing — a guess
 * because a right answer arrived at by coin toss is recorded as knowledge, and
 * the back button because leaving is leaving.
 *
 * A ladder is the third option, and the reason it is a ladder rather than a
 * "show answer" is that each rung has to leave work. The teaching happens in
 * the step the student still takes; a hint that closes the gap entirely has
 * moved the answer, not helped anybody across.
 *
 * ## Built from the course, not from a model
 *
 * Every rung here is assembled out of what the guide already holds — its key
 * terms, the question's own options, the wording of the answer. Nothing is
 * generated, nothing is fetched, and the whole thing works on a train. That is
 * not a limitation being made a virtue: the blueprint asks for a hint ladder
 * in quantitative practice, and the version that needs a configured model is
 * the version a student cannot rely on at eleven at night.
 *
 * ## A rung that cannot be built is not offered
 *
 * `ladderFor` returns only the rungs it can honestly make. A question whose
 * answer contains no key term gets no term rung — not an empty one, and not a
 * vague one. Three rungs is the most; one is common; none is a real answer and
 * the screen says so rather than showing a button that apologises.
 *
 * ## The last rung is not the answer
 *
 * `opening` gives the first clause and stops, and refuses to speak at all when
 * the first clause *is* the answer — a two-word answer has no opening to give.
 * This is the rule the whole module turns on and `ladder.test.ts` pins it from
 * both sides.
 *
 * It also refuses when the answer is **on screen**, which is the failure the
 * first version shipped with and a screenshot caught. In this app's quiz the
 * options are the answers: `buildQuiz` puts a clipped `full` in as the correct
 * option, so "It begins: *Insurers raise premiums to cover a sick pool…*"
 * appeared directly under an option starting with those exact words. Every
 * test passed — `opening` was behaving perfectly, and the rung was a pointer.
 *
 * So the opening rung is for recall, where the answer is not among the
 * choices, and `answerShown` is what tells the two apart. It is detected
 * rather than declared by the caller: a screen that forgets to pass a flag
 * gets a ladder that gives the answer away, and there is no version of that
 * which is the caller's fault.
 */

import type { Term } from './types';

/** One step of help. */
export interface Rung {
  /** Which kind it is, for the label above it and for what gets recorded. */
  kind: 'term' | 'narrow' | 'opening';
  /** What the student reads. */
  says: string;
  /** Option indexes this rung strikes out. Only ever on a `narrow` rung. */
  out?: number[];
}

/** The shape a question has to have for a ladder to be built from it. */
export interface Askable {
  q: string;
  /** The full, unclipped answer. */
  full: string;
  opts: { text: string; ok: boolean }[];
}

/** Words too common to mean anything when two answers share them. */
const NOISE = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'is', 'it', 'and', 'or', 'that', 'this', 'for', 'on', 'as',
  'by', 'with', 'be', 'are', 'was', 'were', 'at', 'from', 'but', 'not', 'its', 'their', 'when',
  'which', 'than', 'then', 'they', 'you', 'your', 'has', 'have', 'had', 'can', 'will', 'more',
]);

/** The words of a string, lowercased, with the noise dropped. */
function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []).filter((w) => !NOISE.has(w));
}

/**
 * A key term the answer actually turns on.
 *
 * Matched on a word boundary against the answer, longest term first. Longest
 * because terms nest — "marginal cost" and "cost" are both in the guide, and
 * the useful hint is the specific one. Substring matching without the boundary
 * found "cost" inside "opportunity cost" and inside "costly", which produced
 * hints that were true and useless.
 */
export function termIn(full: string, terms: Term[]): Term | null {
  const hay = full.toLowerCase();
  const byLength = [...terms].sort((a, b) => b.t.length - a.t.length);
  for (const term of byLength) {
    const t = term.t.toLowerCase().trim();
    if (t.length < 3) continue;
    const at = hay.indexOf(t);
    if (at === -1) continue;
    const before = at === 0 ? ' ' : hay[at - 1];
    const after = at + t.length >= hay.length ? ' ' : hay[at + t.length];
    if (/[a-z]/.test(before) || /[a-z]/.test(after)) continue;
    return term;
  }
  return null;
}

/**
 * How much two answers have in common, in words that carry meaning.
 *
 * Used to decide which decoys to strike out: the ones *least* like the right
 * answer go first, so what is left is the discrimination the question was
 * actually asking for. Striking the near-misses instead would leave the two
 * obviously-wrong ones and turn a hint into a giveaway.
 */
export function overlap(a: string, b: string): number {
  const left = new Set(words(a));
  return words(b).filter((w) => left.has(w)).length;
}

/**
 * The first clause of an answer — enough to start from, not enough to copy.
 *
 * Returns null when there is nothing to give that is not the whole thing. Two
 * cases, and they are different: an answer of a handful of words has no first
 * clause, and an answer whose first clause runs to nearly all of it has one
 * that is not worth the name.
 */
export function opening(full: string): string | null {
  const trimmed = full.trim();
  if (words(trimmed).length < 6) return null;
  // The first clause, by the punctuation that ends one. Failing that, the
  // first six words, which is a clause's worth of a sentence with no commas.
  const cut = trimmed.search(/[,;:—(]|\.\s/);
  const head = cut > 0 ? trimmed.slice(0, cut).trim() : trimmed.split(/\s+/).slice(0, 6).join(' ');
  // More than two thirds of the answer is not an opening, it is the answer.
  if (head.length >= trimmed.length * 0.67) return null;
  if (words(head).length < 2) return null;
  return head;
}

/**
 * How many options a ladder always leaves standing.
 *
 * Two. Striking down to one is not a hint, it is the answer with an extra
 * press in front of it.
 */
export const LEAVE = 2;

/**
 * The rungs this question can honestly offer, easiest help first.
 *
 * Order is deliberate and it is the order of how much each gives away. The
 * term rung points at the material and leaves the whole question; narrowing
 * removes the options nobody was choosing anyway; the opening hands over
 * wording. A ladder climbed in the other direction is a ladder whose first
 * step is the last one.
 */
export function ladderFor(question: Askable, terms: Term[]): Rung[] {
  const rungs: Rung[] = [];

  /*
   * The answer first, then the question.
   *
   * The answer is where the useful term usually is. But a question like
   * "Explain the death spiral" names the thing and the answer never repeats
   * it, and on those the answer-only search found nothing and the ladder
   * opened on "Take two away" — the rung that gives the most, offered first.
   * Measured on ECON's own deck, which is where it showed up.
   */
  const term = termIn(question.full, terms) ?? termIn(question.q, terms);
  if (term) {
    rungs.push({
      kind: 'term',
      says: `It turns on ${term.t} — ${term.d}`,
    });
  }

  /*
   * One option at a time, not two.
   *
   * The first version struck a pair in a single rung, and the census across
   * the four shipped decks said what that cost: 24 of 40 questions offered
   * exactly one rung, which is a "take two away" button with a longer name.
   * Splitting it is a real progression — each press gives less than the last —
   * and it takes the four-option questions to two or three rungs without
   * inventing anything.
   *
   * Least like the right answer first, so what is left is the discrimination
   * the question was asking for. Striking the near-miss would leave the
   * obviously-wrong ones and turn a hint into a giveaway.
   */
  const right = question.opts.findIndex((o) => o.ok);
  if (right !== -1) {
    const wrong = question.opts
      .map((o, i) => ({ i, o }))
      .filter(({ i, o }) => i !== right && !o.ok)
      .sort((a, b) => overlap(question.opts[right].text, a.o.text) - overlap(question.opts[right].text, b.o.text));
    const canStrike = Math.max(0, question.opts.length - LEAVE);
    const out: number[] = [];
    for (const { i } of wrong.slice(0, canStrike)) {
      out.push(i);
      const left = question.opts.length - out.length;
      rungs.push({
        kind: 'narrow',
        says: out.length === 1 ? `One of these is out. ${left} left.` : `Another is out. ${left} left.`,
        // A copy per rung: the rung says which options are gone *by the time
        // it is reached*, so a screen can render any prefix of the ladder
        // without accumulating the strikes itself.
        out: [...out],
      });
    }
  }

  const head = opening(question.full);
  if (head && !answerShown(question, head)) {
    rungs.push({ kind: 'opening', says: `It begins: “${head}…”` });
  }

  return rungs;
}

/**
 * Whether quoting this opening would just point at an option.
 *
 * True when any option on screen starts with the same words. In a
 * multiple-choice question that is the normal case — the correct option *is*
 * the answer, clipped — and quoting its first clause underneath it is not a
 * hint, it is a finger.
 *
 * Checked against **every** option rather than only the right one, because the
 * failure is the same either way: a rung that singles out any one option has
 * decided the question.
 */
export function answerShown(question: Askable, head: string): boolean {
  const start = head.toLowerCase().trim();
  return question.opts.some((o) => o.text.toLowerCase().trim().startsWith(start));
}

/** What the button offering the next rung should say. */
export function nextRungLabel(rungs: Rung[], taken: number): string | null {
  const rung = rungs[taken];
  if (!rung) return null;
  switch (rung.kind) {
    case 'term':
      return 'What is this about?';
    case 'narrow':
      // "another" reads as a second press of the same thing, which it is.
      return taken === 0 || rungs[taken - 1]?.kind !== 'narrow'
        ? 'Take one away'
        : 'Take another away';
    case 'opening':
      return 'How does it start?';
  }
}

/**
 * The score, with what it cost said beside it.
 *
 * A quiz that counts a hinted answer the same as an unaided one reports a
 * number that is not about the student. This is the same argument
 * `lib/knowing.ts` makes about the mastery percentage, one screen along: the
 * app should report what happened, and what happened here is seven right, three
 * of them with help.
 *
 * The hinted ones are not *subtracted*. Getting there with a hint is better
 * than not getting there, and a scoring rule that punishes asking is a scoring
 * rule that teaches people not to ask.
 */
export function scoreLine(right: number, outOf: number, helped: number): string {
  const base = `${right} of ${outOf}`;
  if (helped === 0) return `${base}, none with help`;
  return `${base}, ${helped} with help`;
}
