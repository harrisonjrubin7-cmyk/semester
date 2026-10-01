import { useMemo } from 'react';
import { useNow, useStore } from '../state/store';
import { useAthleticEvents } from './athletics.hook';
import { useDeviceLibrary } from './device-library';
import { EMPTY_SETTINGS, lifeBalanceKey, readSettings, type Input, type Settings } from './life-balance';
import { datedItems } from './select';

/**
 * Everything `lib/life-balance.ts` counts, read from where it already lives.
 *
 * The store holds the timetable, commitments, appointments, rest blocks, work
 * windows and deadlines; the athletics season is its own device library, read
 * through `useAthleticEvents` so the key is never restated. The commute is the
 * one input this module adds: an owner-scoped number the student types.
 * Unsigned use retains the legacy device key; signed accounts start separately.
 */
export function useLifeBalance(): {
  input: Input;
  now: Date;
  settings: Settings;
  saveSettings: (next: Settings) => boolean;
  error: string;
} {
  const { state, catalog, account } = useStore();
  const now = useNow();
  const athletics = useAthleticEvents();
  const library = useDeviceLibrary(lifeBalanceKey(account?.id || null), readSettings, EMPTY_SETTINGS);
  const settings = library.value;
  const items = useMemo(
    () => datedItems(catalog, now).filter((i) => !i.isPast && !state.done[i.id]),
    [catalog, now, state.done],
  );
  const input = useMemo<Input>(
    () => ({
      catalog,
      commitments: state.commitments,
      appointments: state.appointments,
      rest: state.rest,
      windows: state.windows,
      floor: state.floor,
      athletics,
      settings,
      items,
      spent: state.spent,
    }),
    [catalog, state.commitments, state.appointments, state.rest, state.windows, state.floor, athletics, settings, items, state.spent],
  );
  return { input, now, settings, saveSettings: library.update, error: library.error };
}
