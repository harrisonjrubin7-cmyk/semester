/** Personal registration work never adopts a different or unknown legacy owner.
 * Unsigned data keeps its original keys; signed accounts start separately. */
export const REGISTRATION_KEY = 'semester.registration.v1';
export const SHORTLIST_KEY = 'semester.course-shortlist.v1';
export const REGISTRATION_DAY_KEY = 'semester.registration-day.v1';
const key = (prefix: string, owner?: string | null) => owner && owner !== 'device' ? `${prefix}:${owner}` : prefix;
export const registrationKey = (owner?: string | null) => key(REGISTRATION_KEY, owner);
export const shortlistKey = (owner?: string | null) => key(SHORTLIST_KEY, owner);
export const registrationDayKey = (owner?: string | null) => key(REGISTRATION_DAY_KEY, owner);
