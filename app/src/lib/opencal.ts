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
 * **`day` and `week` honour the date. `month` and `semester` do not.**
 *
 * Only two of the four grains anchor on `calDay`: the day view reads it, and
 * the week view reads it as the start of its span. The month view anchors on
 * `calYear` and `calMonth` — separate fields, reachable only through
 * `stepMonth`, which moves by a delta and cannot be sent to a date.
 *
 * So `openCal(date, 'month')` sets a day nothing reads and lands on whatever
 * month the calendar was already showing. It fails silently, which is how it
 * got past a first attempt at this row's own fix.
 *
 * The real fault is underneath: where the calendar is looking is held twice,
 * in two shapes that cannot be set from one another. Recorded in the audit as
 * a row of its own rather than patched around here, because giving the month a
 * "go to this month" action is a change to the calendar rather than to this
 * helper.
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
