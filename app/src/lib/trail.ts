import type { Screen } from './types';

/**
 * Where you have been in this app, and when — the record behind Semester
 * History.
 *
 * **This is not `lib/history.ts`.** That one is undo and redo inside a thing
 * you are editing: a ring of states, a finger, and two moves. Same English
 * word, entirely different fact, and bolting one onto the other would give
 * the app a list that is sometimes a spreadsheet's keystrokes and sometimes a
 * course you opened on Tuesday. Hence a module of its own and a different
 * name.
 *
 * **And it is not `lib/since.ts`.** That is the other half of the line master
 * spec 176 draws and it is worth stating in both files, because the two are
 * easy to collapse into one list and impossible to separate afterwards:
 *
 * | | `lib/since.ts` — activity | `lib/trail.ts` — history |
 * | --- | --- | --- |
 * | answers | what *changed* | where *you went* |
 * | caused by | another device, a feed, an import | you, on this device |
 * | dies | once you have seen it | on a retention window |
 *
 * `since.ts` already says the half that binds it — *"It does not list what
 * you did"* — and this is the half that binds this one: **nothing here
 * records a change.** A deadline moving is not a visit. A trail that quietly
 * grew change entries would be a second answer to a question the app already
 * answers on Today, which is the fault `lib/onehome.test.ts` exists for.
 *
 * ## On the device, not in the account
 *
 * For the reason `browser.hook.ts` gives about the tab strip, and more
 * sharply. The store syncs to the cloud and is what a backup contains; a
 * record of everything a student *looked at* is a different kind of thing to
 * put on a server from a record of their courses, and master spec 169 —
 * history and audit logs must be separate systems — is strongest when the
 * history never leaves the machine. Cross-device history is master spec 175,
 * deferred with its own argument in `HISTORY-WORKSPACE-QUEUE.md`.
 *
 * ## A place, never what was on it
 *
 * A visit carries a screen and an id and nothing else — never a title, never
 * a body, never a search someone typed. Master spec 162 asks for that and the
 * shape is what keeps it: there is nowhere in {@link Visit} to put the
 * content even by accident.
 *
 * It buys something beyond the promise. Titles are looked up against the live
 * library when the history is *drawn*, so a course deleted this morning has
 * no name to resolve and drops out of the record on sight — the history
 * cannot outlive the thing it is about. A trail that stored titles would go
 * on naming a dropped module for as long as the retention window ran.
 */
export interface Visit {
  screen: Screen;
  /**
   * Which one, where the screen names something. Empty where it does not.
   *
   * The id as `lib/route.ts` knows it — the same string `NAMED` picks out of
   * the state and `toHash` puts in the address. Not a second vocabulary: a
   * visit is a place, and the app already has one way of saying where it is.
   */
  id: string;
  /** When it was last opened. Epoch ms. */
  at: number;
}

/** How many places are kept. Past this the least recently opened goes. */
export const DEEPEST = 200;

/** The device's copy. Not the account's — see the header. */
export const TRAIL_KEY = 'semester.trail.v1';

/**
 * Screens that are not places you went.
 *
 * `onboarding` is the app being set up rather than somewhere visited, and it
 * is the one screen a person is *sent* to rather than choosing. Recording it
 * would put "you opened Setting up" at the top of the first history anybody
 * ever sees.
 */
const NOWHERE: readonly string[] = ['onboarding'];

/** Whether a place is one worth remembering having been to. */
export const worthKeeping = (screen: Screen): boolean => !NOWHERE.includes(screen);

/** Two visits naming the same place, whatever their times. */
export const samePlace = (a: Visit, b: Visit): boolean => a.screen === b.screen && a.id === b.id;

/**
 * The trail with this place at the top of it.
 *
 * **One entry per place, moved rather than stacked**, which is the decision
 * everything else here follows from and is worth the paragraph.
 *
 * A browser stacks: ten visits to one page are ten rows. This app's
 * navigation bounces in a way a browser's does not — a tab bar is four
 * screens one tap apart, and opening a course and coming back leaves Today
 * twice inside ten seconds. Stacking would make the record mostly its own
 * noise, and the question people actually bring to a history is *"what was
 * that course page I had open on Tuesday"*, which a list of distinct places
 * answers and a list of returns buries.
 *
 * It is also the shape the app already chose. `remember` in
 * `state/slices/navigate.ts` has done exactly this for screens since the
 * directory's Lately row was written — `[screen, ...rest.filter(...)]`. This
 * is that list generalised: a place rather than a screen, with the time, and
 * a cap two orders larger. So the app gains a better answer rather than a
 * second one.
 *
 * Returned by reference when the place is already on top with a time this
 * close, so the effect that calls this on every navigation does not re-render
 * the app each time the clock moves.
 */
export function stepped(trail: Visit[], visit: Visit): Visit[] {
  if (!worthKeeping(visit.screen)) return trail;
  const top = trail[0];
  if (top && samePlace(top, visit) && top.at === visit.at) return trail;
  return [visit, ...trail.filter((v) => !samePlace(v, visit))].slice(0, DEEPEST);
}

/**
 * A trail off the device, keeping only what is a visit.
 *
 * Anything malformed is dropped rather than repaired, and the whole thing
 * becomes an empty trail rather than an exception — the cost of a wrong
 * answer here is a list of places; the cost of throwing is an app that will
 * not start. `lib/browser.ts` reads the strip the same way and for the same
 * reason.
 *
 * **Screens this build has not got are not filtered here**, which is the one
 * place this reader is deliberately laxer than `storedTabs` in
 * `lib/browser.ts`. That one drops an unknown screen because a tab is a thing
 * you click and a dead tab is a dead click. A trail is a record, and `recent`
 * — the list this generalises — already settled the question the other way in
 * `state/slices/navigate.ts`: *"filtered to real destinations at render time
 * rather than on the way in, so the list follows the directory when the
 * directory changes"*. A capability switched on in March should bring its
 * rows back, not find them quietly deleted in February.
 */
export function readTrail(raw: string | null): Visit[] {
  try {
    if (!raw) return [];
    const saved = JSON.parse(raw) as unknown;
    if (!Array.isArray(saved)) return [];
    const out: Visit[] = [];
    for (const entry of saved) {
      const v = entry as Partial<Visit>;
      if (typeof v?.screen !== 'string' || !worthKeeping(v.screen as Screen)) continue;
      if (typeof v.id !== 'string') continue;
      if (typeof v.at !== 'number' || !Number.isFinite(v.at)) continue;
      const visit: Visit = { screen: v.screen as Screen, id: v.id, at: v.at };
      // The same fold the writer holds, applied on the way in: a store edited
      // by hand, or written by a build whose rule was different, cannot put
      // one place in the list twice.
      if (out.some((o) => samePlace(o, visit))) continue;
      out.push(visit);
    }
    return out.slice(0, DEEPEST);
  } catch {
    return [];
  }
}

/** The trail, for the device. */
export const writeTrail = (trail: Visit[]): string => JSON.stringify(trail);
