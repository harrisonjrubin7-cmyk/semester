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
import type { Action } from '../state/shape';

export function openHit(hit: Hit, dispatch: (a: Action) => void): void {
  switch (hit.kind) {
    case 'item':
      return dispatch({ type: 'openItem', id: hit.id });
    case 'course':
      return dispatch({ type: 'openCourse', id: hit.id });
    case 'unit':
      return dispatch({ type: 'openGuide', id: hit.courseId, mode: hit.mode, unit: hit.unit });
    case 'note':
      return dispatch({ type: 'openNote', id: hit.id });
    case 'task':
      // There is no screen for one task. The tab that holds them is as close
      // as the app gets, and landing there with the list open beats landing
      // nowhere.
      dispatch({ type: 'setMineTab', tab: 'tasks' });
      return dispatch({ type: 'go', screen: 'mine' });
    case 'screen':
      return dispatch({ type: 'go', screen: hit.screen });
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
