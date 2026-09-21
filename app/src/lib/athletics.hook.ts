import { useStore } from '../state/store';
import { useDeviceLibrary } from './device-library';
import { EMPTY_ATHLETICS, athleticsKey, readAthletics, type AthleticEvent } from './athletics';

/**
 * The season, wherever in the app it is needed.
 *
 * `screens/Athletics.tsx` owned this library alone until the week-ahead
 * arithmetic needed it, and the thing a second reader must not do is re-derive
 * the key: a planner keyed on a string one character different from the
 * screen's reports a season of nothing, convincingly, forever. So the key is
 * `athleticsKey`'s and the validator is `readAthletics`, both borrowed rather
 * than restated.
 *
 * Read-only on purpose. Writing a season is the Athletics screen's business —
 * it has the form, the limits and the recovery path for a library that will
 * not parse, and a second writer would be a second set of those.
 *
 * Returns the events rather than the library so that a caller cannot be
 * tempted to write through the value it was handed.
 */
export function useAthleticEvents(): AthleticEvent[] {
  const { state, account } = useStore();
  return useDeviceLibrary(athleticsKey(account?.id, state.term), readAthletics, EMPTY_ATHLETICS).value
    .events;
}
