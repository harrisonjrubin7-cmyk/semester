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

/** Stop. Called on leaving, so a card is not still being read on Today. */
export function hush(): void {
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
