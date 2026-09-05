import { createContext, useContext, type CSSProperties } from 'react';
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

/** How far a row's label sits from the panel's own edge. Matches `Rows.tsx`. */
const SIDE = 15;

/**
 * The hairline between rows, inset to start under the label.
 *
 * A background rather than a border: a border paints outside the padding box,
 * so nothing inside a row can cover its left end. Decorative, and invisible to
 * a screen reader either way.
 */
const DIVIDER: CSSProperties = {
  backgroundImage: 'linear-gradient(var(--app-line-soft), var(--app-line-soft))',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: `${SIDE}px 100%`,
  backgroundSize: `calc(100% - ${SIDE}px) 1px`,
};

/**
 * The padding and hairline a row wears, for a screen that draws its own.
 *
 * Some rows in this app are a `<button>` with a flex layout inside it, and the
 * whole button is the tap target. Wrapping one in `CustomRow` would put the
 * padding outside the button, so the top and bottom few pixels of the row
 * would stop being tappable — a real regression for a layout choice. This
 * gives the same two values to spread into the button's own style instead.
 *
 * `pad` is the vertical padding the drawn layout had, so plain does not shift.
 */
export function useRowStyle(pad = 11, line = true): CSSProperties {
  const grouped = useGrouped();
  return {
    padding: grouped ? `calc(12px * var(--density, 1)) ${SIDE}px` : `${pad}px 0`,
    ...(line ? (grouped ? DIVIDER : { borderBottom: '1px solid var(--app-line)' }) : {}),
  };
}
