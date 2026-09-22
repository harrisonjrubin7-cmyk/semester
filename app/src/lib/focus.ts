/**
 * Focus: the term, and nothing else, for as long as you ask.
 *
 * Experience §377 asks for an application-wide mode that hides campus
 * recommendations, the marketplace, social activity and nonessential
 * notifications, and keeps classes, assignments, study, the calendar and
 * documents. Useful in a study period and in finals week, which is when the
 * fourth shelf of a launcher is a distraction with a name.
 *
 * ## A fourth gate, of a different kind from the other three
 *
 * `lib/school.ts` hides what a university has no equivalent of; `lib/role.ts`
 * hides what is not addressed to the person holding the phone;
 * `lib/reveal.ts` hides what is not useful *yet*. This hides what the person
 * has asked, in Settings, not to be shown *for now*. Three things follow from
 * that, and each is a departure from `reveal.ts` worth stating:
 *
 * - **It gates the chrome.** `components/nav/ShelfNav.tsx` argues that the
 *   rows you navigate by must not change length as the term goes on, because
 *   a row whose positions cannot be learned is half a navigation. That is an
 *   argument against a gate that moves *on its own*. This one moves once,
 *   when you flip it, and stays where you put it — which is exactly a row
 *   whose positions can be learned.
 * - **Search still finds everything.** Hiding a screen from a directory is a
 *   claim about what you want in front of you; hiding it from search would be
 *   a claim about what you are allowed to want. A student in focus who types
 *   "meal plan" gets the meal plan.
 * - **Favourites and the tab bar are not touched.** Both are lists the person
 *   arranged by hand. An app that takes away something you pinned is worse
 *   than one that showed too much — `reveal.ts`'s own rule, one floor up.
 *
 * ## What is set aside, by shelf, with two exceptions
 *
 * Three of the eight shelves are not this term's work: Campus (the map, meals,
 * housing, classmates, activities), Life (money, people, the profile) and
 * Beyond (career, athletics, family, the next degree). Two screens on Life
 * stay, because a shelf is a filing decision and a study period is not:
 * Timers and alarms is the one screen in the app you open *in order to*
 * study, and Email is where a professor's note about the exam arrives. Both
 * are named below rather than moved, so the shelf they live on is unchanged
 * for everybody not in focus.
 *
 * There is no marketplace in this app. The spec names one; there is nothing
 * to hide, and this file does not pretend otherwise.
 *
 * ## Notifications
 *
 * Two of the ten reminder rules say nothing a deadline does not: the
 * "nothing due tonight" all-clear and the Sunday report, whose every item
 * also fires on its own morning. Both go quiet in focus. Every other rule is
 * a class, a deadline, an exam, a registrar date, an attendance line or a
 * tuition payment, and a mode that silenced any of those during finals would
 * be the opposite of what it is for.
 */

import type { NotifKey } from '../data/misc';
import type { Destination, Group } from './nav';

/** The two states, as strings, so the setting stores like every other look id. */
export const FOCUS = [
  { id: 'off', label: 'Everything', blurb: 'Every shelf, every screen, every reminder.' },
  {
    id: 'on',
    label: 'The term',
    blurb: 'Classes, deadlines, study, the calendar and documents. The rest waits.',
  },
] as const;

/** A stored setting turned into one of the two that mean something. */
export function focusOf(id: string | undefined): string {
  return id === 'on' ? 'on' : 'off';
}

export function inFocusMode(id: string | undefined): boolean {
  return focusOf(id) === 'on';
}

/** The shelves that wait. */
export const SET_ASIDE: readonly Group[] = ['Campus', 'Life', 'Beyond'];

/**
 * Screens on a set-aside shelf that stay anyway.
 *
 * See the header: a timer is a study tool, and email is where the exam note
 * arrives. Anything added here must be on a shelf in `SET_ASIDE`, or it is
 * an exception to nothing — `focus.test.ts` checks.
 */
export const KEPT_IN_FOCUS: readonly string[] = ['clocks', 'mail'];

/** Whether one destination is drawn while focus is on. */
export function inFocus(d: Destination): boolean {
  return !SET_ASIDE.includes(d.group) || KEPT_IN_FOCUS.includes(d.screen);
}

/**
 * The rows, minus what waits — or the rows themselves when focus is off.
 *
 * The same array back, not a copy, when there is nothing to do: several
 * callers hand the result to `useMemo` and a fresh array every render is a
 * memo that never holds.
 */
export function focused<T extends Destination>(rows: T[], focus: string | undefined): T[] {
  return inFocusMode(focus) ? rows.filter(inFocus) : rows;
}

/** How many of these rows focus would set aside. Zero when it is off. */
export function setAside(rows: Destination[], focus: string | undefined): number {
  return rows.length - focused(rows, focus).length;
}

/** The reminder rules that say nothing a deadline does not. */
export const NONESSENTIAL: readonly NotifKey[] = ['free', 'sun'];

/**
 * The reminder switches, with the nonessential ones off while focus is on.
 *
 * The person's own switches are not written to: this is a view over them for
 * the tick that fires reminders, so turning focus off gives back exactly the
 * settings they had. The same object back when focus is off, for the reason
 * `focused` gives.
 */
export function essentialOnly(
  on: Record<NotifKey, boolean>,
  focus: string | undefined,
): Record<NotifKey, boolean> {
  if (!inFocusMode(focus)) return on;
  const out = { ...on };
  for (const k of NONESSENTIAL) out[k] = false;
  return out;
}

/** The sentence under the directory, and under the switch, while focus is on. */
export function focusLine(aside: number): string {
  if (aside === 0) return 'Focus is on. Nothing on this list is set aside.';
  return `Focus is on. ${aside === 1 ? 'One screen is' : `${aside} screens are`} set aside — campus, life and what comes after the degree. Search still finds them.`;
}
