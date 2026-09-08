/**
 * How long the change strip stays up, and whether one is still worth drawing.
 *
 * The strip is the visible face of the app's live region — the same sentence a
 * screen reader is told, shown to everybody else. That is the whole design:
 * one dispatch, one announcement, one strip, which is what "fires once on a
 * data change and announces once" asks for and what two mechanisms could never
 * guarantee between them.
 *
 * ## Why the arithmetic is here and not in the component
 *
 * `lib/undo.ts` already keeps the undo toast's clock this way, for the reason
 * that a duration is a decision and a decision belongs somewhere it can be
 * read and tested. The component's job is a timeout and some markup.
 */

/**
 * Five seconds.
 *
 * Shorter than the undo toast's eight, deliberately. Undo is an offer with a
 * deadline — miss it and the thing is gone — so it has to outlast a moment of
 * distraction. This is a receipt: it says what already happened, it is safe to
 * miss, and a receipt that sits on the screen long enough to be read twice is
 * a receipt in the way.
 */
export const SHOWN_FOR = 5000;

/** A sentence, when it was said, and where the record it is about lives. */
export interface Change {
  said: string;
  at: number;
}

/** Whether a strip said at `at` is still inside its window. */
export function showing(change: Change | null, now: number): boolean {
  if (!change || change.said.trim() === '') return false;
  // A clock that has gone backwards — a device time change, a restored tab —
  // should not pin a strip open forever, so the future is not fresh either.
  const age = now - change.at;
  return age >= 0 && age < SHOWN_FOR;
}

/** How long is left, for the timeout that retires it. Never negative. */
export function leftOf(change: Change, now: number): number {
  return Math.max(0, change.at + SHOWN_FOR - now);
}

/**
 * The strip's two halves, split on the middot the handoff writes them with.
 *
 * "Grade saved · BUS 1600 now 91%" is a label and the detail it introduces,
 * and they are set differently: the label in small caps, the detail in the
 * body face.
 *
 * A sentence with no middot is all detail and no label. That is the ordinary
 * case — most of the app's announcements are whole sentences, "Marked got it.
 * Next card." — and the alternative was to treat the whole sentence as a
 * label, which would set a line of prose in 11px caps at 0.14em. A label is a
 * word or two by definition; anything longer is a sentence wearing a costume.
 */
export function halves(said: string): { lead: string; detail: string } {
  const at = said.indexOf('·');
  if (at < 0) return { lead: '', detail: said.trim() };
  return { lead: said.slice(0, at).trim(), detail: said.slice(at + 1).trim() };
}
