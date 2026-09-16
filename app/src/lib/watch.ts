/**
 * A lesson for a unit nobody has recorded, read by the device.
 *
 * Forty-four units across the four shipped courses have a narrated lesson:
 * `pipeline/lessons.py` writes the cue list and `audio/synth.py` renders the
 * voice, and `screens/Lesson.tsx` plays the mp3 with real type changing under
 * it. A course somebody generated from their own syllabus has none of that,
 * for the reason `lib/generate.ts:463` gives — the pipeline is Python in this
 * repository and does not run in a browser — so Watch opened on
 * *has not been recorded* and the name of a script to run, which is an answer
 * for somebody with a checkout and nobody else.
 *
 * This is the other half, and it is the same gap `lib/script.ts` closed for
 * Listen a few items ago: the capability was on the wrong side of the app
 * boundary. The voice is `lib/speak.ts`, which is the browser's own
 * `speechSynthesis` — no network, no account, no coursework leaving the
 * device, which matters more here than almost anywhere because the text being
 * read is somebody's own uploaded material.
 *
 * ## It is not a recording and does not pretend to be one
 *
 * A recorded lesson has a timeline. Every cue carries the second it lands on,
 * the player draws a scrub bar against it, and seeking works because the
 * synthesiser knew where it put every line.
 *
 * `speechSynthesis` has no such thing. There is no duration before it speaks,
 * no seeking, and the rate depends on a voice that differs per device. So a
 * spoken lesson has **beats, not seconds**: one utterance per beat, and the
 * next beat when that one ends. No scrub bar, no estimated total, nothing in
 * the typeface the exact figures use. `lib/script.ts` makes the same refusal
 * about chapter marks and gives the argument at more length.
 *
 * The other half of the same honesty is the label. §3.3 of the completion plan
 * puts it plainly: *a mode that looks identical whether it has forty-four
 * produced lessons behind it or a robot voice is the exact failure
 * `lib/modes.ts` was written to end.* So `lib/modes.ts` says which kind a
 * course has, on the card, before the tap.
 *
 * ## Every word is the guide's
 *
 * A beat is a unit's name, a card's question, a card's answer, or a figure's
 * title and caption. There is no summarising, no bridging line, and no model
 * call — so no key, no wait, and nothing invented. `speakable` is
 * `lib/script.ts`'s, because a formula read out loud should sound the same in
 * both places and two copies of that list is one copy too many.
 */

import { speakable } from './script';
import type { Figure, Unit } from './types';

/** One step of a spoken lesson: what is said, and what is on screen while it is. */
export interface Beat {
  /** 'title' opens the unit, 'q' poses a card, 'a' answers it, 'close' ends. */
  kind: 'title' | 'q' | 'a' | 'figure' | 'close';
  /** What is drawn. */
  text: string;
  /** What is read out, which is not always what is drawn. */
  said: string;
  /** The figure this beat is about, where it is about one. */
  figure?: Figure;
}

export interface Spoken {
  /** Index of the unit this teaches, so it sits beside a recorded `Lesson`. */
  unit: number;
  title: string;
  beats: Beat[];
}

/**
 * How many cards a spoken lesson will take before it stops.
 *
 * A recorded lesson is as long as it is because a person decided; this one
 * runs until the unit does, and a twelve-card unit read aloud is about eight
 * minutes of a voice with no seek bar. That is long, and the cap is not there
 * to save time — it is there because the thing after it is the deck, the
 * cards and the guide, all of which hold the same material and can be moved
 * through at the reader's speed rather than the voice's.
 *
 * Nothing is hidden by it: the last beat says how many cards are left and
 * where they are.
 */
export const MOST_CARDS = 10;

/**
 * The lesson this unit would have, if anybody had recorded it.
 *
 * `null` for a unit with no cards, which is the one honest answer: every beat
 * but the opening and the closing is a card, so a unit without them would
 * produce a voice saying the unit's name and stopping.
 */
export function spokenLesson(unit: number, held: Unit | undefined, figures: Figure[] = []): Spoken | null {
  if (!held || held.cards.length === 0) return null;

  const name = held.name.replace(/^\d+(\/\d+)?\s*·\s*/, '');
  const cards = held.cards.slice(0, MOST_CARDS);
  const over = held.cards.length - cards.length;

  const beats: Beat[] = [
    {
      kind: 'title',
      text: name,
      said: speakable(`${name}. ${plural(cards.length, 'question')} in this unit.`),
    },
  ];

  cards.forEach((card, i) => {
    beats.push({ kind: 'q', text: card.q, said: speakable(`Question ${i + 1}. ${card.q}`) });
    beats.push({ kind: 'a', text: card.a, said: speakable(card.a) });
  });

  /*
   * The figures after the cards rather than under them.
   *
   * A recorded lesson has a figure on screen throughout because the narrator
   * was looking at it while they spoke. Nothing here knows which card a
   * figure belongs to — `lib/live.ts` places figures by unit, not by card —
   * and guessing would put a bar chart under an unrelated question, which
   * reads as the lesson having lost its place.
   */
  for (const figure of figures) {
    const caption = figure.caption.trim();
    beats.push({
      kind: 'figure',
      text: figure.title,
      said: speakable(caption ? `${figure.title}. ${caption}` : figure.title),
      figure,
    });
  }

  beats.push({
    kind: 'close',
    text: over > 0 ? `${plural(over, 'more question')} in this unit` : 'End of the unit',
    said: speakable(
      over > 0
        ? `That is the first ${cards.length}. ${plural(over, 'more question')} in this unit — they are on the cards and in the deck.`
        : 'That is the unit. The cards are next.',
    ),
  });

  return { unit, title: name, beats };
}

function plural(n: number, one: string): string {
  return `${n} ${n === 1 ? one : `${one}s`}`;
}
