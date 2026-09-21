/**
 * Asking out loud, and being answered out loud.
 *
 * Both halves of this have been in the app for a while and never met. The
 * microphone is `lib/mic.ts`, which has been filling fields since lecture
 * notes; the voice is `lib/speak.ts`, the browser's own `speechSynthesis`,
 * which reads drill cards between classes. What there was no way to do was
 * *hold a conversation* — ask a question walking to Furman and hear the
 * answer without taking the phone out.
 *
 * That is a loop rather than a feature: listen, send, speak, listen again.
 * This file is the loop, and it is here rather than in the component because
 * a loop with four states and an echo hazard is exactly the thing that should
 * be testable without a microphone in the room.
 *
 * ## The echo, which is the whole reason this is a state machine
 *
 * A phone speaking an answer through its own speaker is a phone whose
 * microphone can hear the answer. Leave recognition running while it talks
 * and the app transcribes its own voice, sends it as the next question,
 * answers that, and is away — a loop that costs money on every turn and
 * cannot be stopped by staying quiet, because the person staying quiet is not
 * the one talking.
 *
 * So the microphone is a function of the phase and nothing else, stated once
 * as {@link Doing.mic} and asserted exhaustively: for every phase, for every
 * event, `mic` is true only while listening. A component that forgets to stop
 * recognition cannot reintroduce the bug, because it is not the component's
 * decision.
 *
 * ## Why the pause matters more than the words
 *
 * Deciding *when somebody has finished talking* is the hard half of hands-free,
 * and it cannot be read off the transcript. Chrome marks a result final at a
 * pause, but people pause mid-thought — "so for the elasticity question…
 * [pause] …do I use the midpoint formula?" is one question, and a loop that
 * sends on the first final sends half of it and answers the wrong thing.
 *
 * So a final result does not send. Silence sends: {@link QUIET_MS} of nothing
 * after the last thing heard, timed by the caller, arriving here as `quiet`.
 * A final result only refreshes what would be sent when that silence comes.
 */

import { speakable } from './script';

/** Where the loop is. The microphone is open in exactly one of these. */
export type Phase = 'off' | 'listening' | 'thinking' | 'speaking';

/**
 * How long a pause means "your turn".
 *
 * A second and a half. Under a second cuts people off mid-sentence — measured
 * against the pause in "so for problem three… do I use the midpoint formula" —
 * and past two the answer feels broken rather than considered.
 */
export const QUIET_MS = 1500;

/**
 * The most that gets read out of one answer, in characters.
 *
 * About ninety seconds at a normal rate. Past that a listener has lost the
 * thread and the thing they want is the screen, so the rest is left there and
 * said to be there — see {@link forSpeech}. It is not a truncation of the
 * answer, which is whole on screen either way; it is the end of the reading.
 */
export const MOST_SPOKEN = 1200;

export type Event =
  | { t: 'start' }
  | { t: 'stop' }
  /** A transcript, from the recogniser. `final` means it will not be revised. */
  | { t: 'heard'; text: string; final: boolean }
  /** {@link QUIET_MS} with nothing new heard. The caller times this. */
  | { t: 'quiet'; text: string }
  /** The answer arrived whole. */
  | { t: 'answered'; text: string }
  /** The voice finished, or refused, or was cut off. */
  | { t: 'spoken' }
  /** Anything went wrong — the mic, the request, the voice. */
  | { t: 'failed' };

export interface Doing {
  phase: Phase;
  /**
   * Whether the microphone should be open.
   *
   * Derived, never passed in. See the note above about the echo: this is the
   * one place that decides, so there is one place to get it right.
   */
  mic: boolean;
  /** A question to send, once, on the step that returns it. */
  send?: string;
  /** Words to say, once, on the step that returns it. */
  speak?: string;
}

const at = (phase: Phase, extra: Omit<Doing, 'phase' | 'mic'> = {}): Doing => ({
  phase,
  mic: phase === 'listening',
  ...extra,
});

/**
 * Whether a transcript is worth sending.
 *
 * A recogniser hands back "uh", "mm" and a bare full stop from a cough, a
 * door, or someone else's conversation. Sending those costs a request and
 * answers a question nobody asked — and in a loop that speaks its answers, it
 * is a phone that starts talking to an empty room.
 *
 * Two words, or one long one. "Yes" and "no" are real answers to something the
 * assistant asked, so the bar is not a word count alone.
 */
export function enough(text: string): boolean {
  const said = text.trim();
  if (said.length < 3) return false;
  if (!/[a-z0-9]/i.test(said)) return false;
  // A single filler is not a question, however long the recogniser made it.
  if (/^(uh|um+|er+|hm+|mm+|ah+|oh)\b[\s.,!?]*$/i.test(said)) return false;
  return true;
}

/**
 * One step of the loop.
 *
 * Pure, and total: every phase answers every event, because a loop that is
 * driven by a microphone and a network will be handed events in orders nobody
 * drew on the diagram — an answer arriving after the person pressed stop, a
 * `spoken` from an utterance that was cancelled two phases ago.
 *
 * What the recogniser has heard so far is not a parameter. It lives in the
 * caller, which is the only thing that can accumulate it across results, and
 * arrives here on the one event that needs it — `quiet`, carrying the whole
 * turn. A `held` argument was written first and never read: it looked like
 * state this function owned, and it owned none.
 */
export function step(phase: Phase, e: Event): Doing {
  // Stopping is unconditional and answerable from anywhere, including from a
  // phase this file does not know it is in. It is the control somebody reaches
  // for when the app is talking over them.
  if (e.t === 'stop' || e.t === 'failed') return at('off');

  switch (phase) {
    case 'off':
      // Nothing but `start` wakes it. A late `answered` or `spoken` from the
      // turn before is exactly what arrives after somebody presses stop, and
      // it must not restart the microphone.
      return e.t === 'start' ? at('listening') : at('off');

    case 'listening':
      /*
       * A final result does not send — see the note at the top about pauses.
       * It is the `quiet` that sends, and what it sends is what the caller
       * has accumulated, so a question spoken across three pauses goes as one
       * question.
       */
      if (e.t === 'quiet') {
        return enough(e.text) ? at('thinking', { send: e.text.trim() }) : at('listening');
      }
      return at('listening');

    case 'thinking':
      if (e.t === 'answered') {
        const words = forSpeech(e.text);
        // An answer with nothing sayable in it — a bare table, an empty reply
        // — must not leave the loop stuck waiting for a `spoken` that the
        // voice will never fire, because it was never asked to say anything.
        return words ? at('speaking', { speak: words }) : at('listening');
      }
      // Anything heard while it is thinking is dropped rather than queued.
      // The microphone is shut in this phase, so this is a stray event from
      // the recogniser winding down; treating it as the next question would
      // send half a sentence nobody finished.
      return at('thinking');

    case 'speaking':
      // Back to listening the moment the voice stops, which is what makes it
      // a conversation rather than a series of separate questions.
      return e.t === 'spoken' ? at('listening') : at('speaking');
  }
}

/** Held for the reader: the loop is only ever listening with the mic open. */
export const PHASES: Phase[] = ['off', 'listening', 'thinking', 'speaking'];

/**
 * An answer, as something worth hearing.
 *
 * The assistant writes markdown for a screen: headings, bullets, bold, tables,
 * links, and the `[d-3]` ids the context gives its deadlines. Read literally
 * that is "hash hash What is due asterisk asterisk Wednesday asterisk asterisk
 * bracket d dash three", which is not a worse version of the answer — it is
 * not the answer at all.
 *
 * So the marks come off and the structure becomes sentences. Two things are
 * dropped rather than converted, and that is the interesting half:
 *
 * - **Tables.** A row read as "ECON pipe problem set two pipe Wednesday" is
 *   gibberish, and read without the pipes it is three nouns in a row with no
 *   grammar. There is no good spoken form of a table, so it is left on the
 *   screen and said to be there.
 * - **Fenced code.** Same argument, more so.
 *
 * The maths is `speakable` from `lib/script.ts` rather than a second list
 * here. That file says why: a formula should sound the same wherever the app
 * reads one, and two copies of that list is one copy too many.
 */
export function forSpeech(text: string): string {
  let dropped = false;

  const body = text
    // Fenced code, whole. Before anything else, so a heading inside a fence is
    // not lifted out of it.
    .replace(/```[\s\S]*?```/g, () => {
      dropped = true;
      return '\n';
    })
    .replace(/^ {4,}\S.*$/gm, () => {
      dropped = true;
      return '';
    })
    // A table is any run of lines with pipes in them, including its rule.
    .replace(/^\|.*\|\s*$/gm, () => {
      dropped = true;
      return '';
    })
    // The ids the context puts on deadlines, which are for the app's own
    // matching and are not words.
    .replace(/\[d-\d+\]\s*/g, '')
    // A link is its text. A URL read aloud is a minute of "h t t p s colon".
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    // A heading is a sentence, so it gets the full stop that makes the voice
    // fall rather than run it into the line below.
    .replace(/^#{1,6}\s+(.*)$/gm, (_, head: string) => `${head.replace(/[.:]$/, '')}.`)
    // A bullet or a numbered step, likewise: the marker goes, the break stays.
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    // Emphasis marks, kept as their words.
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/(^|\s)_([^_]+)_(?=\s|$)/g, '$1$2')
    // A rule is a pause on a page and nothing at all out loud.
    .replace(/^\s*([-*_])\1{2,}\s*$/gm, '')
    // Every line is its own sentence now, so a newline is a sentence break.
    .replace(/\n{2,}/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (/[.!?:,;]$/.test(line) ? line : `${line}.`))
    .join(' ');

  const said = speakable(body);
  if (!said) return dropped ? SEE_SCREEN : '';

  const cut = clip(said, MOST_SPOKEN);
  const more = cut.length < said.length;
  // One closing line, however many reasons there are for it. Two — "there is
  // a table on screen. There is more on screen." — is the app apologising
  // twice for the same thing.
  return more || dropped ? `${cut} ${more ? MORE_ON_SCREEN : SEE_SCREEN}` : cut;
}

/** Said when a table or a code block was left where it can be read. */
export const SEE_SCREEN = 'The rest of it is on the screen.';

/** Said when the answer was longer than {@link MOST_SPOKEN}. */
export const MORE_ON_SCREEN = 'There is more on the screen.';

/**
 * Cut at the last sentence that fits, or at a word if there is no sentence.
 *
 * Mid-word is the one place it must never stop: a voice that ends on "the
 * midpoint for—" sounds like the app crashed, and a listener with the phone in
 * a pocket has no way to tell whether it did.
 */
function clip(text: string, most: number): string {
  if (text.length <= most) return text;
  const window = text.slice(0, most);
  const stop = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '));
  if (stop > most * 0.5) return window.slice(0, stop + 1);
  const space = window.lastIndexOf(' ');
  return `${window.slice(0, space > 0 ? space : most).trimEnd()}…`;
}

/**
 * What to add when the answer came with offers attached.
 *
 * The assistant proposes things — tick this off, add that task — as rows with
 * a button beside each. In voice mode there is nothing to tap and the phone
 * may be in a pocket, so the offers are named and left standing. Nothing is
 * ever run because it was spoken: `ai/prompt.ts` promises that a tool call
 * becomes a line the student reads with a button beside it, and a hands-free
 * mode that quietly started applying them would be the one way to break that
 * promise without anybody seeing it happen.
 */
export function offersLine(count: number): string {
  if (count <= 0) return '';
  return count === 1
    ? 'There is one thing it offers to do, waiting on the screen.'
    : `There are ${count} things it offers to do, waiting on the screen.`;
}
