import type { Persisted } from './shape';

/**
 * The legacy fallback is a single clear-text localStorage value. Keep advising
 * appointments out of it: they are education records and belong only on the
 * primary IndexedDB/database path. A browser without that path may keep the
 * rest of the local workspace, but it must fail closed for these records.
 */
export function localFallback(persisted: Persisted): Omit<Persisted, 'appointments'> {
  const { appointments, ...safe } = persisted;
  void appointments;
  return safe;
}

