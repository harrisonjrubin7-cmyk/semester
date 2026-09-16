/**
 * A unit, cut into a deck.
 *
 * `screens/Slides.tsx` held this inline, which was fine while a deck was a
 * title, the cards in pairs and an end slide. It is not fine now that a card's
 * *shape* decides how it is drawn: the rules below are the whole of the
 * decision, they are worth reading on their own, and the completion plan's
 * condition for this work is a test that walks every unit of every shipped
 * course — which is not a thing you write against a `useMemo` inside a screen.
 *
 * Not to be confused with `lib/deck.ts` and `lib/pptx.ts`, which are the
 * Production Suite's decks: those are planned from a brief by a model and
 * written out as a `.pptx`. This one is your own material rearranged, with no
 * model, no key and no wait, and COMPLETION-PLAN.md §3.2 says in as many words
 * that the two should not be merged. Nothing here calls anything.
 *
 * ## Three layouts, and the question they are all answers to
 *
 * A deck had six kinds and everything that was not a figure or a stretch of
 * prose was forced through question-then-answer. That is right for most of a
 * course and wrong for three shapes the material keeps producing:
 *
 * - **A comparison.** Twenty-eight cards across the four shipped courses put
 *   `X vs. Y` in the question, and the answer is two sides of a contrast. As
 *   one paragraph of prose the reader has to do the splitting; in two columns
 *   it is the shape of the idea.
 * - **A list.** An answer that enumerates — *name the four hurdles, in
 *   order* — read as a wall.
 * - **A passage.** A reading added to a unit arrives with the source it came
 *   from, and a sentence worth quoting is not the same object as an essay.
 *
 * ## Mechanical, and no model, and that is not a shortcut
 *
 * §3.2 proposed the mechanical rule first "with Claude choosing only where the
 * mechanical rule is ambiguous". There is nowhere for that to happen: a card
 * either has one `vs.` in its question with two sides its answer names, or it
 * does not, and the rule below answers that without a judgement call. The
 * property §3.2 asks to protect — a deck with no wait and no key — is kept by
 * there being nothing to call.
 *
 * ## What each rule refuses, which is the part that was hard
 *
 * The plan's own condition is that no unit maps to a layout "a reviewer calls
 * forced", so the rules are written to decline rather than to reach. Measured
 * against the twenty-five `vs.` cards in the four shipped courses, `comparison`
 * takes twenty and refuses five, and each refusal is the right answer:
 *
 * | Refused | Because |
 * | --- | --- |
 * | *Total vs. marginal analysis — why does marginal win?* | The answer argues for one side; it is not a contrast. |
 * | *Shutdown vs. exit rule?* | The halves are named by run length, not by the two sides. |
 * | *Type I vs. Type II error?* | The two labels share every word that could tell them apart. |
 * | *How does within- vs. between-group variation…* | The `vs.` is inside a clause, not the subject of the question. |
 * | *Owned vs. earned vs. paid media?* | Three sides. Two columns would drop one. |
 *
 * A refusal is not a gap: the card becomes the ordinary answer slide it has
 * always been.
 */

import type { CourseUpdate, Figure, StudyCard, Unit } from './types';

export type Slide =
  | { kind: 'title'; title: string; sub: string }
  | { kind: 'q'; text: string; n: number; of: number }
  | { kind: 'a'; q: string; text: string }
  /** An answer that is two sides of a contrast, drawn as two. */
  | { kind: 'compare'; q: string; left: string; right: string; leftSays: string; rightSays: string; also: string }
  /** An answer that enumerates, drawn as the list it is. */
  | { kind: 'bullet'; q: string; items: string[] }
  | { kind: 'figure'; figure: Figure }
  /** A passage from a reading, with the source it came from. */
  | { kind: 'quote'; text: string; from: string; title: string }
  /** Prose from a reading that never became a question. */
  | { kind: 'note'; title: string; text: string; from: string }
  | { kind: 'end'; title: string; sub: string };

/** The kinds that answer a question, and so must never precede one. */
export const ANSWERS: Slide['kind'][] = ['a', 'compare', 'bullet'];

/**
 * The words of a label that could tell it apart from something else.
 *
 * Four letters and up, cut to five, because that is the length at which
 * `shifts` and `shift` are the same word and `statistic` and `statistics` are
 * too. Shorter than four is `the`, `is`, `run` — nothing that identifies a
 * side of anything.
 */
function marks(label: string): string[] {
  return label
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4)
    .map((word) => word.slice(0, 5));
}

/**
 * An answer split where a reader would pause.
 *
 * A semicolon, or a full stop followed by a capital. Not every full stop: an
 * abbreviation and a decimal both end in one, and `1.8 tons` is not two
 * sentences.
 */
function parts(answer: string): string[] {
  return answer
    .split(/;\s+|(?<=[.])\s+(?=[A-Z“"])/)
    .map((piece) => piece.trim())
    .filter(Boolean);
}

/** What one piece of the answer opens with, as a mark. */
function opensWith(piece: string, ws: string[]): boolean {
  const first = piece.toLowerCase().replace(/[^a-z ]/g, ' ').trim().split(/\s+/)[0] ?? '';
  return ws.some((w) => first.startsWith(w));
}

export interface Comparison {
  left: string;
  right: string;
  leftSays: string;
  rightSays: string;
  /** What belonged to neither side — the trap, the mnemonic, the caveat. */
  also: string;
}

/**
 * Two sides, where the card has two sides and says which is which.
 *
 * The question has to name them — one `vs.`, and the construction has to be
 * what the question is *about* rather than buried in a clause — and the answer
 * has to have a piece for each, found by a word that belongs to one label and
 * not the other. The second half of that is what keeps
 * *Total vs. marginal analysis* out: its answer never says `total` at all,
 * because it is an argument for marginal rather than a contrast of the two.
 *
 * The disqualifier is *opens with*, not *mentions*. `Economic profit subtracts
 * all opportunity costs` mentions profit, which is a word from the other
 * label, and is plainly the left side all the same — what would make it the
 * right side is beginning with it.
 */
export function comparison(card: StudyCard): Comparison | null {
  // Everything after a dash is the question's aside — "the #1 tested thing?",
  // "and the trap?" — and belongs to neither side.
  const head = card.q.replace(/\s*[—–-]\s.*$/, '').replace(/[?:]\s*$/, '').trim();
  if (/^(how|what|why|when|which|who)\b/i.test(head)) return null;
  if ((head.match(/\bvs\.?\b|\bversus\b/gi) ?? []).length !== 1) return null;
  const named = /^(.+?)\s+(?:vs\.?|versus)\s+(.+)$/i.exec(head);
  if (!named) return null;

  const left = named[1].trim();
  const right = named[2].trim();
  const leftMarks = marks(left).filter((w) => !marks(right).includes(w));
  const rightMarks = marks(right).filter((w) => !marks(left).includes(w));
  if (!leftMarks.length || !rightMarks.length) return null;

  const pieces = parts(card.a);
  if (pieces.length < 2) return null;
  const says = (piece: string, ws: string[]) => ws.some((w) => piece.toLowerCase().includes(w));
  const first = pieces.findIndex((p) => says(p, leftMarks) && !opensWith(p, rightMarks));
  if (first < 0) return null;
  const second = pieces.findIndex((p, i) => i > first && says(p, rightMarks) && !opensWith(p, leftMarks));
  if (second < 0) return null;

  return {
    left,
    right,
    leftSays: pieces[first],
    rightSays: pieces[second],
    also: pieces.filter((_, i) => i !== first && i !== second).join(' '),
  };
}

/**
 * An answer that is a numbered list, as a list.
 *
 * Numbered and nothing else. Semicolons were the obvious second rule and are
 * wrong: `%ΔQ = −20/90 = −22.2%; %ΔP = 2/5 = 40%; ε = −0.56 → inelastic` is a
 * calculation, and drawn as three bullets it becomes three unrelated facts.
 * Three items minimum, because two is a contrast and has its own layout above.
 *
 * It fires on one card in the two hundred and seventy-nine the four shipped
 * courses hold, and that is the honest yield: this material is written as
 * prose. §3.2 expected more, and the rule is still the right rendering for the
 * card it does find — and for a course generated from a syllabus that answers
 * in lists.
 */
export function bullets(card: StudyCard): string[] | null {
  if (!/(^|\s)1\.\s/.test(card.a)) return null;
  const items = card.a
    .split(/(?:^|\s)(?=[1-9]\.\s)/)
    .map((piece) => piece.trim())
    .filter(Boolean);
  return items.length >= 3 ? items : null;
}

/** As long as a passage can be and still be one, in characters. */
export const PASSAGE = 320;

/**
 * A reading short enough to be quoted rather than summarised.
 *
 * The difference between this and a note is not the source — both have one —
 * it is the length. A paragraph from a reading is prose the deck shows you; a
 * sentence or two is a passage the deck can set as a quotation, which is what
 * §3.2 means by quote-and-source and what `lib/quotes.ts` has been checking
 * student writing against all along.
 *
 * Nothing in the four shipped courses is one of these, because readings are
 * added rather than shipped. That is not a reason to leave the layout out: a
 * student pasting the sentence a seminar turns on is the case it exists for.
 */
export function passage(update: Pick<CourseUpdate, 'body' | 'source' | 'title'>): boolean {
  const body = update.body.trim();
  if (!body || !update.source.trim()) return false;
  if (body.length > PASSAGE) return false;
  // A passage is one thought. Four sentences is a paragraph, whatever its
  // length, and a paragraph in quotation marks reads as a citation nobody
  // trimmed.
  return parts(body).length <= 3;
}

export interface Cut {
  unit: Unit;
  code: string;
  figures: Figure[];
  added: Pick<CourseUpdate, 'body' | 'source' | 'title'>[];
  /** What the last slide says under "End of the unit". */
  standing: string;
}

/**
 * The deck.
 *
 * The order has not moved: title, the cards in the order the unit holds them,
 * every figure, everything a reading added, and the end. What changed is that
 * three of those slides can now be drawn as what they are.
 *
 * **A question still lands before its answer.** `compare` and `bullet` are
 * answer slides — they replace the `a` that would have followed the same `q`,
 * they never replace the `q` — so the invariant the deck is built on survives
 * the new kinds by construction rather than by care. `slides.test.ts` asserts
 * it across every unit of every shipped course anyway, because "by
 * construction" is a claim like any other.
 */
export function deckOf({ unit, code, figures, added, standing }: Cut): Slide[] {
  const out: Slide[] = [
    {
      kind: 'title',
      title: unit.name.replace(/^\d+(\/\d+)?\s*·\s*/, ''),
      sub: `${code} · ${unit.cards.length} things to know`,
    },
  ];

  unit.cards.forEach((card, i) => {
    out.push({ kind: 'q', text: card.q, n: i + 1, of: unit.cards.length });
    const two = comparison(card);
    if (two) {
      out.push({ kind: 'compare', q: card.q, ...two });
      return;
    }
    const listed = bullets(card);
    if (listed) {
      out.push({ kind: 'bullet', q: card.q, items: listed });
      return;
    }
    out.push({ kind: 'a', q: card.q, text: card.a });
  });

  /*
   * Every figure the unit has, not just the one it leads with — a reading that
   * brought three tables used to contribute one slide and drop two.
   */
  for (const figure of figures) out.push({ kind: 'figure', figure });

  // Prose a reading never split into questions. It is in Read and on the cram
  // sheet; leaving it out made the deck the one format without the whole unit.
  for (const up of added) {
    if (!up.body.trim()) continue;
    const from = up.source.trim() || 'Added by you';
    const title = up.title.trim() || 'Added since';
    if (passage(up)) out.push({ kind: 'quote', text: up.body.trim(), from, title });
    else out.push({ kind: 'note', title, text: up.body, from });
  }

  out.push({ kind: 'end', title: 'End of the unit', sub: standing });
  return out;
}
