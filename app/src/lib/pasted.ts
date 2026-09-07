/**
 * Pasted material, as pieces the review sheet can show.
 *
 * The file path has had a review since it existed: read the file, work out
 * what is in it, diff it against the course, show every change and write
 * nothing until it is accepted. Pasted text had none. It went from a textarea
 * straight into the guide — cards, terms, a figure, an exam framing, a
 * claim-and-test pairing and a worked example, all of it, unseen.
 *
 * That is the wrong way round. Pasting is the *less* verified door of the two:
 * a file at least has a name and a hash and a classifier that says what it
 * thinks it is, and pasted text is whatever was on the clipboard. The path
 * with less provenance had less review.
 *
 * So this turns what `readMaterial` and `parseMaterial` produced into the same
 * `Piece[]` the file path produces, and the screen runs the same `diff` and
 * shows the same `ReviewSheet`. One review, one vocabulary, one commit.
 *
 * ## Why hashes are per piece
 *
 * `diff` de-duplicates within a set by `hash`, and `adopt` needs each accepted
 * piece to be identifiable. Hashing the piece's own text rather than its
 * position means pasting the same reading with one card added is nine
 * duplicates and one new card, rather than ten new cards.
 */

import { hashOf } from './intake';
import type { Piece, Where } from './harvest';
import type { CaseFile, Example, Figure, Frame, StudyCard, Term } from './types';

export interface Pasted {
  cards: StudyCard[];
  terms: Term[];
  figures: Figure[];
  frames: Frame[];
  selfTest: StudyCard[];
  cases: CaseFile[];
  examples: Example[];
  /** Prose that never split into a question and an answer. */
  body: string;
  /** What the student called it, and where they say it came from. */
  title: string;
  source: string;
}

/**
 * Every piece a paste proposes, in the order they are worth reading.
 *
 * Cards and terms first because they are the bulk and the least surprising;
 * the long-form parts after, because a figure or a claim-and-test pairing is
 * the thing somebody will actually want to look at before agreeing to it.
 */
export function piecesFrom(p: Pasted, where: Where): Piece[] {
  const out: Piece[] = [];
  const at = (kind: string, text: string) => hashOf(`${kind}:${text}`);
  const unit = p.title.trim();

  for (const card of p.cards) {
    out.push({ what: 'card', unit, card, where, hash: at('card', `${card.q}|${card.a}`) });
  }
  for (const term of p.terms) {
    out.push({ what: 'term', term, where, hash: at('term', `${term.t}|${term.d}`) });
  }
  for (const figure of p.figures) {
    out.push({ what: 'figure', figure, where, hash: at('figure', figure.title) });
  }
  for (const frame of p.frames) {
    out.push({ what: 'frame', frame, where, hash: at('frame', `${frame.t}|${frame.d}`) });
  }
  for (const card of p.selfTest) {
    out.push({ what: 'selftest', card, where, hash: at('selftest', `${card.q}|${card.a}`) });
  }
  for (const file of p.cases) {
    out.push({ what: 'case', file, where, hash: at('case', `${file.title}|${file.verdict}`) });
  }
  for (const example of p.examples) {
    out.push({ what: 'example', example, where, hash: at('example', `${example.t}|${example.d}`) });
  }

  /*
   * The prose goes last, as a unit.
   *
   * `unit` rather than `note`: both end up as the update's body, and a unit
   * carries the name as well, which is what makes the added material appear
   * in the guide's contents under the title the student gave it. A note would
   * put the prose in and leave the heading blank.
   */
  if (p.body.trim()) {
    out.push({
      what: 'unit',
      name: unit || 'Added material',
      body: p.body,
      where,
      hash: at('unit', `${unit}|${p.body}`),
    });
  }

  return out;
}

/** Whether there is anything at all to review. */
export function anything(p: Pasted): boolean {
  return (
    p.cards.length > 0 ||
    p.terms.length > 0 ||
    p.figures.length > 0 ||
    p.frames.length > 0 ||
    p.selfTest.length > 0 ||
    p.cases.length > 0 ||
    p.examples.length > 0 ||
    Boolean(p.body.trim())
  );
}
