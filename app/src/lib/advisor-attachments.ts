import { useAccountId } from '../state/store';
import { useMemo } from 'react';
import { EMPTY_SHORTLIST, shortlistKey, liveShortlist, meetingLine, readShortlist } from './course-detail';
import { useDeviceLibrary } from './device-library';
import { useRegistrationPlan } from './registration-plan';

/**
 * The courses a student saved in Course search (Phase F), as things a meeting
 * can bring (Phase G): the shortlist's ids resolved against the imported
 * catalog, in the order they were saved. A saved id whose section is no
 * longer in the catalog is left out rather than shown half-known.
 */
export function useSavedCourses(owner?: string | null): { id: string; code: string; section: string; title: string; credits: number; meets: string }[] {
  const current = useAccountId();
  const accountId = owner === undefined ? current : owner;
  const shortlist = useDeviceLibrary(shortlistKey(accountId), readShortlist, EMPTY_SHORTLIST).value;
  const { catalog } = useRegistrationPlan(accountId);
  return useMemo(() => {
    const byId = new Map(catalog.map((c) => [c.id, c]));
    return liveShortlist(shortlist, catalog)
      .saved.map((id) => byId.get(id))
      .filter((c) => c !== undefined)
      .map((c) => ({ id: c.id, code: c.code, section: c.section, title: c.title, credits: c.credits, meets: meetingLine(c) }));
  }, [shortlist, catalog]);
}
