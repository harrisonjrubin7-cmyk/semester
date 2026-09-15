/**
 * Opening a task, an appointment, a note or a file — which means opening the
 * list that holds it.
 *
 * None of the four has a screen of its own. A task is a title and a tick; a
 * screen per task would be a screen that says less than the row you tapped.
 * So opening one means the Mine screen, on the tab that holds it, and that is
 * two dispatches in a fixed order: set the tab, then go.
 *
 * Two dispatches, one meaning, and nothing in the type system tying them
 * together. That pairing was written out by hand at thirteen call sites across
 * `Calendar`, `Today`, `Mine` and `openHit` — and at a fourteenth, the aside
 * on Today's *Yours today* section, the first half was missing. Its label
 * counts undone tasks and its click landed on whichever tab Mine happened to
 * be showing, so a button reading "1 left" delivered the appointments list.
 * Not a wrong screen, which somebody would have reported, but the right screen
 * wearing the wrong face.
 *
 * `mineTab` is ephemeral, which is why this survived: it resets to `tasks` on
 * load, so the first visit of every session is correct and the fault only
 * appears once you have been to another tab. A bug that is right until you use
 * the app for a minute is a bug nobody files.
 *
 * Hence one function. The tab is an argument, so it cannot be forgotten, and
 * the order is written once. `openhit.ts` wants the pair as data and the
 * screens want it dispatched, so the pair is the export and `goMine` is the
 * two-line convenience over it.
 */

import type { Action } from '../state/shape';

/**
 * The four lists Mine holds.
 *
 * Named here rather than spelled out a fourth time. It was already written
 * three times — the `Ephemeral` field, the `setMineTab` action, and Mine's own
 * `Segmented` options — and a fourth copy is a fourth place to forget a tab.
 */
export type MineTab = 'tasks' | 'appointments' | 'notes' | 'files';

/**
 * Opening Mine on a given tab, as data.
 *
 * Returned rather than dispatched because a tab has to be able to replay it —
 * see `placeFor` in `openhit.ts`, which stores what opening a result does so
 * the app can be put back where it was.
 */
export function openMine(tab: MineTab): Action[] {
  return [
    { type: 'setMineTab', tab },
    { type: 'go', screen: 'mine' },
  ];
}

/** `openMine`, dispatched. What a click handler wants. */
export function goMine(dispatch: (a: Action) => void, tab: MineTab): void {
  for (const action of openMine(tab)) dispatch(action);
}
