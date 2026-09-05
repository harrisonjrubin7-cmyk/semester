/**
 * Guessing at a unit before you have read it.
 *
 * Trying to answer a question about material you have not been taught, and
 * getting it wrong, makes the material stick better when you then read it.
 * That is the finding, it replicates, and the size of it is not small. It is
 * also the single least-used study technique there is, because every part of
 * it feels like a waste of time: you do not know the answer, you know you do
 * not know the answer, and being marked wrong four times before you have even
 * started reading feels like the opposite of progress.
 *
 * So the whole design problem here is the same one as interleaving in
 * `lib/interleave.ts` — the technique works and it feels bad, and an app that
 * offers it without saying why gets it switched off after one go.
 *
 * ## Being wrong is the mechanism, so nothing may punish it
 *
 * A guess is **never scored**. It does not go into `state.reviews`, so it
 * cannot shorten a card's interval or mark it as struggled with; it does not
 * go into `state.answers`, so it cannot drag down the calibration figure in
 * `lib/sure.ts`. Both would be quietly wrong: the scheduler would be recording
 * failures on cards nobody has been taught, and the calibration screen would
 * tell somebody they are overconfident on the basis of guesses they were told
 * to make.
 *
 * The only thing recorded is that a unit was pretested, and when. That is
 * enough to stop offering it twice and to say something true about it later.
 *
 * ## Only where there is something to pre-test
 *
 * Offering "guess first" on a unit somebody drilled yesterday is nonsense —
 * they are not guessing, they are being quizzed, and the framing is a lie. So
 * it is offered only for units whose cards have no answer history at all.
 *
 * ## A few questions, not all of them
 *
 * Four. A thirty-question pretest on material you have not read is a chore
 * that gets abandoned halfway, and the effect does not need volume — it needs
 * the attempt. They are taken evenly across the unit rather than off the
 * front, so the guesses cover what the unit covers.
 */

import type { StudyCard } from './types';
import type { Reviews } from './review';
import { cardKey } from './review';

/** How many questions a pretest asks. */
export const ASK = 4;

/** What separates a course id from a unit number in a pretest record's key. */
export const KEY_SEP = ':';

/** The key one unit's pretest record is stored under. */
export function unitKey(courseId: string, unit: number): string {
  return `${courseId}${KEY_SEP}${unit}`;
}

/** Whether any card in this unit has ever been answered. */
export function studied(courseId: string, cards: StudyCard[], reviews: Reviews): boolean {
  return cards.some((c) => Boolean(reviews[cardKey(courseId, c.q)]));
}

/**
 * Whether to offer a guess-first run on this unit.
 *
 * Never twice, never on material already answered, and never on a unit too
 * small to ask anything of — one card is not a pretest, it is a riddle.
 */
export function worthGuessing(
  courseId: string,
  unit: number,
  cards: StudyCard[],
  reviews: Reviews,
  pretested: Record<string, number>,
): boolean {
  if (cards.length < 2) return false;
  if (pretested[unitKey(courseId, unit)]) return false;
  return !studied(courseId, cards, reviews);
}

/**
 * The questions to ask, spread across the unit.
 *
 * Evenly spaced rather than the first four, so the guesses cover what the unit
 * covers. Deterministic, because a pretest that asks different questions each
 * time it is opened is one somebody can reroll until it looks easy.
 */
export function pick(cards: StudyCard[], ask = ASK): StudyCard[] {
  if (cards.length <= ask) return [...cards];
  const out: StudyCard[] = [];
  const step = cards.length / ask;
  for (let i = 0; i < ask; i++) out.push(cards[Math.floor(i * step)]);
  return out;
}

/**
 * What it says before somebody starts, where the objection lives.
 *
 * The objection is "I have not read this yet", and it is correct — so the
 * answer is not to deny it but to say that is the point.
 */
export function invite(n: number, unitName: string): string {
  return `${n} questions on ${unitName}, before you read it. You will not know the answers. Guessing wrong and then reading is what makes the reading stick — it is the best-supported thing in the whole of study technique that nobody does, because it feels like failing.`;
}

/** What it says while somebody is staring at a question they cannot answer. */
export const NUDGE =
  'Say what you think, even if it is a shrug. The attempt is the part that works — a blank is the one answer that does nothing.';

/**
 * What it says at the end.
 *
 * Deliberately does not congratulate a high score and does not console a low
 * one. A high score means the unit was not new, which is worth knowing and is
 * not an achievement; a low score is the ordinary case and is the mechanism
 * working. Either way nothing was recorded against them, and that gets said,
 * because "will this count against me" is the thing somebody is actually
 * wondering.
 */
export function verdict(right: number, asked: number): string {
  const kept = 'None of this was scored — no card schedule moved, and nothing went into your record.';
  if (asked === 0) return kept;
  if (right === asked) {
    return `You had all ${asked}. That means this unit is not new to you, so read it quickly and spend the time on one that is. ${kept}`;
  }
  if (right === 0) {
    return `None right, which is what a pretest on unread material normally looks like. The reading will land differently now than it would have. ${kept}`;
  }
  return `${right} of ${asked}. The ones you missed are the ones the reading will now stick to. ${kept}`;
}

/** How a pretested unit reads later, so the record is worth having. */
export function guessedLine(at: number | undefined, now = Date.now()): string {
  if (!at) return '';
  const days = Math.floor((now - at) / 86_400_000);
  if (days <= 0) return 'You guessed at this one before reading it, today.';
  if (days === 1) return 'You guessed at this one before reading it, yesterday.';
  return `You guessed at this one before reading it, ${days} days ago.`;
}

/** Every stored record, made safe to read. */
export function readPretested(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, at] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof at === 'number' && Number.isFinite(at) && at > 0) out[key] = at;
  }
  return out;
}
