import { useCallback, useEffect, useMemo, useState } from 'react';
import { cloud, cloudConfigured } from './cloud';
import { claimedSchoolOrThrow } from './schoolclaim';
import { buildEnvironment, loadRecords, loadRoomRecords } from './integration/school-records';
import { loadOfficial, type OfficialLoad } from './official-notices';

export type SchoolLoad = OfficialLoad;

/**
 * What the school shared, loaded exactly as the Today card loads it: signed in,
 * a claimed school, the tenant's `module.source_freshness_cards` on, then the
 * student's own rows and the school's tenant-wide ones under RLS.
 *
 * `off` is a fact about the school or the account; a failed request is
 * `error` (see `loadOfficial`), and `retry` asks again. `rooms` loads study
 * spaces and their slots instead of the facts Today reads.
 */
export function useSchoolRecords(which: 'records' | 'rooms' = 'records'): SchoolLoad & { retry: () => void } {
  const [load, setLoad] = useState<SchoolLoad>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    void (async () => loadOfficial(
      cloudConfigured ? await cloud() : null,
      claimedSchoolOrThrow,
      buildEnvironment(import.meta.env.MODE),
      new Date(),
      which === 'rooms' ? loadRoomRecords : loadRecords,
    ))().then((next) => { if (live) setLoad(next); }, () => { if (live) setLoad({ status: 'error' }); });
    return () => { live = false; };
  }, [which, attempt]);
  const retry = useCallback(() => { setLoad({ status: 'loading' }); setAttempt((n) => n + 1); }, []);
  // One object per load, so screens that memo on it recompute only when it changes.
  return useMemo(() => ({ ...load, retry }), [load, retry]);
}
