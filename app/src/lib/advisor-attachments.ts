import { useMemo } from 'react';
import { EMPTY_SHORTLIST, SHORTLIST_KEY, liveShortlist, meetingLine, readShortlist } from './course-detail';
import { useDeviceLibrary } from './device-library';
import { useRegistrationPlan } from './registration-plan';

/**
 * The courses a student saved in Course search (Phase F), as things a meeting
 * can bring (Phase G): the shortlist's ids resolved against the imported
 * catalog, in the order they were saved. A saved id whose section is no
 * longer in the catalog is left out rather than shown half-known.
 */
export function useSavedCourses(): { id: string; code: string; section: string; title: string; credits: number; meets: string }[] {
  const shortlist = useDeviceLibrary(SHORTLIST_KEY, readShortlist, EMPTY_SHORTLIST).value;
  const { catalog } = useRegistrationPlan();
  return useMemo(() => {
    const byId = new Map(catalog.map((c) => [c.id, c]));
    return liveShortlist(shortlist, catalog)
      .saved.map((id) => byId.get(id))
      .filter((c) => c !== undefined)
      .map((c) => ({ id: c.id, code: c.code, section: c.section, title: c.title, credits: c.credits, meets: meetingLine(c) }));
  }, [shortlist, catalog]);
}
