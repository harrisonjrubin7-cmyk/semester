import { createContext, useContext } from 'react';
import { useStore } from '../../state/store';

export type Shell = 'plain' | 'grouped';

/**
 * A layout forced for one part of the app, whatever the setting says.
 *
 * Two callers, pulling in opposite directions, and both are right:
 *
 *   `FullBleed` forces **plain**. A field guide, the calendar's month grid, a
 *   flashcard, a map: each is one object rather than a run of rows, and an
 *   inset panel makes it narrower and harder to read for nothing. A layout
 *   mode that makes reading worse is a bug, and this is what stops it.
 *
 *   The settings screens force **grouped**. Settings is an index of rows and
 *   is always drawn that way — it was rebuilt as one before the app-wide
 *   layout existed, and it does not become a run of loose sections because
 *   somebody prefers drawn cards everywhere else.
 *
 * `null` is the ordinary case: follow the setting.
 */
const Forced = createContext<Shell | null>(null);

export const ForcedProvider = Forced.Provider;

/**
 * Which of the two layouts this part of the app is being drawn in.
 *
 * A hook rather than a prop, because the answer is the same nearly everywhere
 * and threading it through would mean adding a parameter to every component
 * between a screen and a row — which is most of them, and none of which has
 * any business knowing.
 *
 * It reads the store, which these components already do for something else.
 * There is no separate provider for the setting itself: a second context
 * holding one string the first context already holds is a second thing to
 * keep in step.
 */
export function useShell(): Shell {
  const { state } = useStore();
  const forced = useContext(Forced);
  if (forced) return forced;
  return state.shell === 'grouped' ? 'grouped' : 'plain';
}

/** True when the grouped layout is on here. Reads better than a compare. */
export function useGrouped(): boolean {
  return useShell() === 'grouped';
}
