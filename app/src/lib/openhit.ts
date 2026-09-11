/**
 * Where a search result goes when you press it.
 *
 * Split out of the Everything screen so the command overlay can use exactly
 * the same table. Two copies of this would drift the first time a new kind of
 * hit was added, and the failure mode is a result that is findable in one
 * place and dead in the other — which reads as the app being broken rather
 * than as one switch statement being out of date.
 */

import type { Hit } from './find';
import type { Screen } from './types';
import type { Action } from '../state/shape';

/**
 * What opening a result does, as data rather than as a side effect.
 *
 * Split out of `openHit` because a tab has to be able to put the app back
 * where it was, and "back where it was" is more than a screen id: the deadline
 * you opened, the unit you were reading and the mode you were reading it in.
 * Actions are plain objects, so a tab can keep the ones that opened it and
 * replay them later — from this session or from next week's.
 *
 * Two of these are a pair rather than one action, and they have to stay a
 * pair: a task has no screen of its own, so it is the tab plus the screen
 * that holds it.
 */
export function actionsFor(hit: Hit): Action[] {
  switch (hit.kind) {
    case 'item':
      return [{ type: 'openItem', id: hit.id }];
    case 'course':
      return [{ type: 'openCourse', id: hit.id }];
    case 'unit':
      return [{ type: 'openGuide', id: hit.courseId, mode: hit.mode, unit: hit.unit }];
    case 'note':
      return [{ type: 'openNote', id: hit.id }];
    case 'task':
      // There is no screen for one task. The tab that holds them is as close
      // as the app gets, and landing there with the list open beats landing
      // nowhere.
      return [
        { type: 'setMineTab', tab: 'tasks' },
        { type: 'go', screen: 'mine' },
      ];
    case 'appointment':
      // Same as a task, and for the same reason: there is no screen for one
      // appointment, and the tab that holds them is as close as the app gets.
      return [
        { type: 'setMineTab', tab: 'appointments' },
        { type: 'go', screen: 'mine' },
      ];
    // The three things the student made in the app. Each has a real screen of
    // its own, so unlike a task these open the thing rather than the list.
    case 'document':
      return [{ type: 'openDocument', id: hit.id }];
    case 'sheet':
      return [{ type: 'openSheet', id: hit.id }];
    case 'deck':
      // `editDeck`, not `openDeck`: that name belongs to the study slideshow,
      // which opens a guide unit and is a different thing. See `state/shape.ts`.
      return [{ type: 'editDeck', id: hit.id }];
    case 'screen':
      return [{ type: 'go', screen: hit.screen }];
  }
}

export function openHit(hit: Hit, dispatch: (a: Action) => void): void {
  for (const action of actionsFor(hit)) dispatch(action);
}

/**
 * Which screen a hit lands on, for the tab that is about to hold it.
 *
 * The same table as `openHit`, read the other way round, and it is in this
 * file for exactly the reason that function is: two copies would drift the
 * first time a kind was added, and a tab labelled "the thing you opened"
 * pointing at the wrong screen is worse than no tab. Every arm here is the
 * screen its action above pushes — `openDocument` pushes `write`, `editDeck`
 * pushes `deck` — so a change to one is a change to both, side by side.
 */
export function landingOf(hit: Hit): Screen {
  switch (hit.kind) {
    case 'item':
      return 'item';
    case 'course':
      return 'course';
    case 'unit':
      return 'guide';
    case 'note':
      return 'note';
    // Neither a task nor an appointment has a screen of its own; the tab that
    // holds them is where `openHit` sends both.
    case 'task':
    case 'appointment':
      return 'mine';
    case 'document':
      return 'write';
    case 'sheet':
      return 'sheet';
    case 'deck':
      return 'deck';
    case 'screen':
      return hit.screen;
  }
}

/** Every hit in every group, in the order they are drawn — for arrow keys. */
export function flatten(groups: { hits: Hit[] }[]): Hit[] {
  return groups.flatMap((g) => g.hits);
}

/** A key that identifies one hit among the results, stable across renders. */
export function hitKey(hit: Hit): string {
  return `${hit.kind}-${hit.title}-${hit.sub}`;
}
