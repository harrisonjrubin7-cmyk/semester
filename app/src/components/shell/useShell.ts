import { createContext, useContext } from 'react';
import { useStore } from '../../state/store';

/**
 * Content that opts out of the grouped layout, for everything below it.
 *
 * A field guide, the calendar's month grid, a flashcard, a map, a chart: each
 * is one object rather than a run of rows, and an inset panel makes it
 * narrower and harder to read for nothing. `FullBleed` sets this, and every
 * primitive inside it then draws itself as it always has.
 *
 * A layout mode that makes reading worse is a bug, and this is the mechanism
 * that stops it being one.
 */
const Exempt = createContext(false);

export const ExemptProvider = Exempt.Provider;

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
export function useShell(): 'plain' | 'grouped' {
  const { state } = useStore();
  const exempt = useContext(Exempt);
  return !exempt && state.shell === 'grouped' ? 'grouped' : 'plain';
}

/** True when the grouped layout is on here. Reads better than a compare. */
export function useGrouped(): boolean {
  return useShell() === 'grouped';
}
