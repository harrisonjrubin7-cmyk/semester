/**
 * Reading a card out loud.
 *
 * The between-classes mode is for a phone in motion, and the thing that
 * actually stops somebody using a phone in motion is having to look at it.
 * A question read aloud is a question you can answer with the phone at your
 * side, which is the difference between drilling on the way to Furman and
 * putting it back in your pocket at the first kerb.
 *
 * ## On the device, and only the device
 *
 * `speechSynthesis` is the browser's own voice: no network, no account, no
 * text leaving the phone. That matters more here than it might elsewhere —
 * the text being read is your coursework, and shipping it to a speech service
 * to be synthesised would be sending your syllabus to a third party to solve
 * a problem the browser already solves.
 *
 * It is also why there is no voice picker. Which voices exist depends
 * entirely on the phone, they load asynchronously, and offering a list that
 * is empty on first paint and different on every device is worse than
 * offering none.
 *
 * ## It is allowed to be missing
 *
 * Not every browser has it, a locked-down one may have it and refuse, and a
 * phone on silent will do nothing audible either way. Every call here is
 * guarded and every failure is silent: the mode works without it, so a
 * missing voice costs a feature rather than a screen.
 */

/** Whether this browser will speak at all. */
export function canSpeak(): boolean {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  } catch {
    return false;
  }
}

/**
 * Say something, cancelling whatever was being said.
 *
 * Cancelling first is the whole behaviour that matters in a drill: tapping
 * through three cards quickly should leave the third being read, not all
 * three queued and the person listening to a card they have already answered.
 */
export function say(text: string, rate = 1): void {
  if (!canSpeak() || !text.trim()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    window.speechSynthesis.speak(u);
  } catch {
    /* a browser that has the object and refuses the call */
  }
}

/**
 * The utterance being spoken, held so it is not collected mid-sentence.
 *
 * A known and long-standing browser bug: an utterance with no reference to it
 * can be garbage-collected while `speechSynthesis` is still reading it, and
 * what a listener gets is a sentence that stops halfway. `say` above does not
 * need this — it fires and forgets a line short enough to survive — and a
 * lesson does, because the next beat is waiting on `onend` and a collected
 * utterance never fires one.
 */
let speaking: SpeechSynthesisUtterance | null = null;

/**
 * Below this, nothing was said.
 *
 * `canSpeak` asks whether the object is there, and the object being there is
 * not the same as a voice being there. Measured in headless Chromium:
 * `'speechSynthesis' in window` is true, `getVoices()` is empty, and every
 * utterance completes instantly — so a lesson advancing on `onend` raced
 * through six beats in under a second and a half, in silence.
 *
 * Counting voices is the obvious check and is not reliable: the list loads
 * asynchronously and is empty on the first call in browsers that do have one.
 * The time an utterance took is reliable, because it does not matter *why*
 * nothing was said. Every line here is a sentence, and no voice says a
 * sentence in a quarter of a second.
 */
const SPOKE_MS = 250;

/**
 * Say something, and call back when it has been said — or was not.
 *
 * This is what a spoken lesson advances on. There is no duration to schedule
 * against — `speechSynthesis` does not offer one before it speaks, and the
 * rate depends on a voice that differs per device — so the next beat begins
 * when this one ends, which is also how a person would read it out.
 *
 * The callback's argument is whether it was really spoken. A caller that
 * advanced on every completion would flick through a whole lesson on a
 * browser with no voice installed, which is worse than not offering to read
 * it: the reader watches the slides go past and hears nothing.
 *
 * Returns the way to stop. `onend` does not fire on a cancel, so stopping is
 * the caller's to notice: the returned function detaches the callbacks first,
 * which makes a cancel silent rather than a completion.
 *
 * `onerror` also calls back, as not spoken. A browser that refuses one line
 * should not leave a lesson waiting for an event that will not come.
 */
export function speakThen(text: string, rate: number, done: (spoke: boolean) => void): () => void {
  if (!canSpeak() || !text.trim()) {
    return () => {};
  }
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const began = Date.now();
    u.rate = rate;
    u.onend = () => done(Date.now() - began >= SPOKE_MS);
    u.onerror = () => done(false);
    speaking = u;
    window.speechSynthesis.speak(u);
    return () => {
      u.onend = null;
      u.onerror = null;
      if (speaking === u) speaking = null;
      hush();
    };
  } catch {
    return () => {};
  }
}

/** Stop. Called on leaving, so a card is not still being read on Today. */
export function hush(): void {
  speaking = null;
  if (!canSpeak()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* nothing to stop */
  }
}

/**
 * What to read for a card in a given state.
 *
 * The question on its own before the turn — reading "the answer is" into
 * somebody's ear before they have tried to recall it defeats the exercise.
 * After the turn, the answer alone, because the question was read ten
 * seconds ago and hearing it twice is what makes people switch the voice off.
 */
export function spoken(card: { q: string; a: string }, shown: boolean): string {
  return shown ? card.a : card.q;
}

const ALOUD_KEY = 'semester.aloud';

/**
 * Whether to read aloud, on the device rather than the account.
 *
 * A phone in a pocket with an earphone in and a laptop open in a quiet
 * library are the same account and opposite answers, and syncing this would
 * make one of them wrong — loudly, in a reading room.
 */
export function readAloud(): boolean {
  try {
    return localStorage.getItem(ALOUD_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeAloud(on: boolean): void {
  try {
    localStorage.setItem(ALOUD_KEY, on ? '1' : '0');
  } catch {
    /* storage off; the setting lasts the session and no longer */
  }
}
