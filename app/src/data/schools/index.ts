/**
 * The schools that ship with the app.
 *
 * Vanderbilt is here rather than only in the account because of the guarantee
 * the rest of the app already keeps: a student who opens this offline, signed
 * out, on a first launch gets the whole thing with no network call. Putting the
 * profile behind a fetch would quietly break that for the one university the
 * app was built for.
 *
 * A row in the account exists so a profile can be corrected without a redeploy.
 * It is not where the app looks first.
 *
 * ## Resolution order
 *
 * 1. The account's row for the student's school, if it has loaded
 * 2. The bundled JSON, if the id matches one here
 * 3. Nothing set — which is not an error, it is roughly eighty per cent of the
 *    app and every screen in that eighty per cent works
 */

import vanderbilt from './vanderbilt.json';
import { NO_SCHOOL, readSchool, type School } from '../../lib/school';

export const BUNDLED: Record<string, School> = {
  vanderbilt: readSchool(vanderbilt),
};

/**
 * The profile to render from.
 *
 * `loaded` is whatever came back from the account, or null. It wins where it
 * exists, so a correction lands without a new build — but only for the school
 * it names, and a bundled school is the fallback rather than the loser.
 */
export function resolveSchool(id: string, loaded: School | null): School {
  if (loaded && loaded.id === id && id) return loaded;
  return BUNDLED[id] ?? { ...NO_SCHOOL };
}

/** For a picker: what the app already knows without asking anyone. */
export function bundledList(): School[] {
  return Object.values(BUNDLED);
}
