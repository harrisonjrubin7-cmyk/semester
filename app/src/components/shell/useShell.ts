import { useStore } from '../../state/store';

/**
 * Which of the two layouts the app is being drawn in.
 *
 * A hook rather than a prop, because the answer is the same everywhere and
 * threading it through would mean adding a parameter to every component
 * between the screen and the row — which is most of them, and none of which
 * has any business knowing.
 *
 * It reads the store, which every one of these components already does for
 * something. There is no separate provider: a second context holding one
 * string that the first context already holds is a second thing to keep in
 * step.
 */
export function useShell(): 'plain' | 'grouped' {
  const { state } = useStore();
  return state.shell === 'grouped' ? 'grouped' : 'plain';
}

/** True when the grouped layout is on. Reads better at a call site than a compare. */
export function useGrouped(): boolean {
  return useShell() === 'grouped';
}
