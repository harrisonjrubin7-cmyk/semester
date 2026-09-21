/**
 * Opening the calendar on a particular day takes three dispatches, not one.
 *
 * `setCalDay` alone changes which day the calendar has selected and leaves you
 * looking at the screen you were already on — which is a tappable row that
 * appears to do nothing. The view has to be put into `day` and the calendar
 * has to be gone to as well.
 *
 * That paragraph is not new. It was written in `components/Clashes.tsx`, above
 * a correct three-dispatch helper, by somebody who had hit the bug and worked
 * out the rule. It was a module-private `useOpenDay`, so `screens/Calendar.tsx`
 * and `screens/me/You.tsx` each re-derived the same three lines, and
 * `screens/Today.tsx` dispatched only the third.
 *
 * Which is the argument for this file. A helper nobody can import is a rule
 * nobody can follow, and it is worse than no helper at all, because the
 * paragraph is in the repository saying the thing while the app still has the
 * fault it describes. The fix that stays fixed is an export plus a census.
 *
 * ## A bare `go` to the calendar is still fine
 *
 * The tab bar, the `k` shortcut and the directory all mean *open the calendar*
 * and promise no particular day, so landing on whatever the session last
 * showed is right for them. What goes wrong is a control that names a day or a
 * period and then does not travel to it — see `Today`'s aside, which offered
 * "the calendar has the rest" and opened a single day inside the week it had
 * just called insufficient.
 */

import type { Action } from '../state/shape';

/** Which grain to arrive in. `day` is what a row naming one date wants. */
export type CalView = 'day' | 'week' | 'month' | 'semester';

/**
 * **`day`, `week` and `month` honour the date. `semester` does not.**
 *
 * Three of the four grains anchor on `calDay`: the day view reads it, the week
 * view reads it as the start of its span, and the month view derives both the
 * month on screen and the day selected in it from the same field. `semester`
 * anchors on `useNow()` and honours no date at all — it is the term, and a
 * term is not somewhere you can be sent by picking a Tuesday.
 *
 * ## What this paragraph used to say, and why it is worth recording
 *
 * Until the pass that merged the calendar's position onto one field, it read:
 *
 * > `month` and `semester` do not. The month view anchors on `calYear` and
 * > `calMonth` — separate fields, reachable only through `stepMonth`, which
 * > moves by a delta and cannot be sent to a date. So `openCal(date, 'month')`
 * > sets a day nothing reads and lands on whatever month the calendar was
 * > already showing. It fails silently.
 *
 * All of that was true when it was written, and none of it is now. `calMonth`,
 * `calYear` and the month view's private `selDate` are deleted; `stepMonth`
 * moves `calDay`; `openCal(date, 'month')` arrives. The audit recorded the
 * merge as closing that row "without needing the 'go to this month' action" —
 * because once the month is *derived* from a date, setting the date is setting
 * the month.
 *
 * The sentence outlived the fault by several passes, which is the same shape
 * as the fault this file was extracted for: there, a correct rule was written
 * down somewhere nobody could import it; here, a correct warning was left
 * standing after the thing it warned about was gone. Both read as settled and
 * both were wrong, and a warning that is wrong costs more than the missing
 * helper did — it tells the next author to avoid a grain that works.
 *
 * `Calendar.opencal.test.tsx` is what holds the corrected half, through the
 * view rather than the action list, and was measured against a revert of the
 * anchor before it was trusted.
 */

/**
 * Opening the calendar on a date, as data.
 *
 * Returned rather than dispatched for the same reason as `openMine`: a tab has
 * to be able to replay it, and `placeFor` in `openhit.ts` stores what opening
 * a thing does so the app can be put back where it was.
 *
 * `view` defaults to `day` because every caller that existed when this was
 * extracted wanted the day — a row naming one date should land on that date.
 * Today's aside names a *period* rather than a day and passes `month`, which
 * is the one case where a wider grain is the honest answer.
 */
export function openCal(date: string, view: CalView = 'day'): Action[] {
  return [
    { type: 'setCalDay', date },
    { type: 'setCalView', view },
    { type: 'go', screen: 'calendar' },
  ];
}

/** `openCal`, dispatched. What a click handler wants. */
export function goCal(dispatch: (a: Action) => void, date: string, view: CalView = 'day'): void {
  for (const action of openCal(date, view)) dispatch(action);
}
