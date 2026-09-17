/**
 * Opening Today on a particular tab takes two dispatches, not one.
 *
 * `setHomeTab` alone changes which of Today's four tabs is selected and leaves
 * you looking at the screen you were already on — a control that names a
 * period and then appears to do nothing. `go` alone arrives on whichever tab
 * the session last showed, which for a link that said "the week ahead" is the
 * promise technically kept and actually broken.
 *
 * That is `lib/opencal.ts`'s paragraph, one screen over, and this file exists
 * because of what that one learned: the rule was written down correctly in a
 * module-private helper, three call sites re-derived it, and one of them
 * dispatched only the third of its three actions. A helper nobody can import
 * is a rule nobody can follow.
 *
 * ## Why there is anything to open Today *at* now
 *
 * Until this merge, "the next seven days in hours" and "how long you have
 * tonight" were each built twice — once as a screen (`screens/Ahead.tsx`,
 * `screens/Tonight.tsx`) and once as a tab on Today (`ThisWeek` and
 * `HoursToday`, both private to `screens/Today.tsx`, sharing no code with the
 * screens). `lib/reveal.ts` unlocked both screens at one or two courses, so
 * every student with a term in the app was offered both copies of both
 * questions and had to guess which one was meant.
 *
 * The tabs won because Today is in `DEFAULT_TABS`: the survivor is the one a
 * student already opens. So the five controls that used to send somebody to a
 * screen now send them to a tab, and they go through here rather than each
 * writing the pair out.
 *
 * ## A bare `go` to Today is still fine
 *
 * The tab bar, the directory and every "back to Today" mean *open Today* and
 * promise no particular tab, so landing on whatever the session last showed is
 * right for them — the same carve-out `opencal.ts` makes for the calendar.
 * What needs this is a control that names a horizon.
 */

import type { Action } from '../state/shape';
import type { HomeTab } from './types';

/**
 * Opening Today on a tab, as data.
 *
 * Returned rather than dispatched for the reason `openCal` gives: a tab has to
 * be able to replay it, and `placeFor` in `openhit.ts` stores what opening a
 * thing does so the app can be put back where it was.
 *
 * The tab comes first so that a re-render caused by `go` already has it — the
 * other order paints Today's default tab for a frame and then switches, which
 * reads as the app changing its mind.
 */
export function openHome(tab: HomeTab): Action[] {
  return [
    { type: 'setHomeTab', tab },
    { type: 'go', screen: 'home' },
  ];
}

/** `openHome`, dispatched. What a click handler wants. */
export function goHome(dispatch: (a: Action) => void, tab: HomeTab): void {
  for (const action of openHome(tab)) dispatch(action);
}
