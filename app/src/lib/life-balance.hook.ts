import { useMemo } from 'react';
import { useNow, useStore } from '../state/store';
import { useAthleticEvents } from './athletics.hook';
import { useDeviceLibrary } from './device-library';
import { EMPTY_SETTINGS, LIFE_BALANCE_KEY, readSettings, type Input, type Settings } from './life-balance';
import { datedItems } from './select';

/**
 * Everything `lib/life-balance.ts` counts, read from where it already lives.
 *
 * The store holds the timetable, commitments, appointments, rest blocks, work
 * windows and deadlines; the athletics season is its own device library, read
 * through `useAthleticEvents` so the key is never restated. The commute is the
 * one input this module adds, and it is device-only: a number the student
 * types, kept in `semester.life-balance.v1`, never sent anywhere.
 */
export function useLifeBalance(): {
  input: Input;
  now: Date;
  settings: Settings;
  saveSettings: (next: Settings) => boolean;
  error: string;
} {
  const { state, catalog } = useStore();
  const now = useNow();
  const athletics = useAthleticEvents();
  const library = useDeviceLibrary(LIFE_BALANCE_KEY, readSettings, EMPTY_SETTINGS);
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
