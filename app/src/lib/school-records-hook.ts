import { useEffect, useState } from 'react';
import { cloud, cloudConfigured } from './cloud';
import { claimedSchool } from './schoolclaim';
import { buildEnvironment, cardsEnabled, loadRecords, type RecordRow } from './integration/school-records';

export type SchoolLoad = { status: 'off' | 'loading' } | { status: 'ready'; userId: string; rows: RecordRow[] };

/**
 * What the school shared, loaded exactly as the Today card loads it: signed in,
 * a claimed school, the tenant's `module.source_freshness_cards` on, then the
 * student's own rows and the school's tenant-wide ones under RLS. Any failure
 * is "off" — the hub then says no channel is connected, which is true for it.
 */
export function useSchoolRecords(): SchoolLoad {
  const [load, setLoad] = useState<SchoolLoad>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    void (async (): Promise<SchoolLoad> => {
      if (!cloudConfigured) return { status: 'off' };
      const db = await cloud();
      const { data } = await db.auth.getUser();
      if (!data.user?.id) return { status: 'off' };
      const school = await claimedSchool();
      if (!(await cardsEnabled(db, school, buildEnvironment(import.meta.env.MODE), new Date()))) return { status: 'off' };
      return { status: 'ready', userId: data.user.id, rows: await loadRecords(db) };
    })().then((next) => { if (live) setLoad(next); }, () => { if (live) setLoad({ status: 'off' }); });
    return () => { live = false; };
  }, []);
  return load;
}

