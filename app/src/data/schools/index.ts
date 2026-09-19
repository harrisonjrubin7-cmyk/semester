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
 * 1. A data pack loaded from a file on this device, if it names this school
 * 2. The account's row for the student's school, if it has loaded
 * 3. The bundled JSON, if the id matches one here
 * 4. A school the student added themselves, which is how anyone outside the
 *    bundled list gets a profile at all
 * 5. Nothing set — which is not an error, it is roughly eighty per cent of the
 *    app and every screen in that eighty per cent works
 *
 * ## Why the file wins
 *
 * A pack is the most deliberate of these. Somebody was sent a file by their
 * university, opened it, read a summary of what was in it and confirmed it —
 * see `lib/schoolpack.ts`. If the bundled copy then quietly won, a student
 * who loaded a corrected calendar would see the old dates and have no way to
 * tell why, which is the "built and unreachable" state
 * [COMPLETION-PLAN.md](../../../COMPLETION-PLAN.md) §8b names as worse than
 * unbuilt. It is not a trap either way: the import is reviewable before it
 * lands and removable afterwards, and removing it falls straight back to the
 * bundled profile.
 *
 * The bundle still ships, and still answers first launch, offline, signed
 * out, with no file loaded. Nothing about that guarantee changes.
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
export function resolveSchool(
  id: string,
  loaded: School | null,
  mine: School[] = [],
  pack: School | null = null,
): School {
  if (pack && pack.id === id && id) return pack;
  if (loaded && loaded.id === id && id) return loaded;
  return BUNDLED[id] ?? mine.find((s) => s.id === id) ?? { ...NO_SCHOOL };
}

/**
 * Everything searchable: what ships, plus what this person added.
 *
 * A loaded pack is not a separate entry here. It either corrects a school
 * already in this list, in which case a second row for the same university
 * would be the confusing thing, or it names one nobody has — and that one
 * needs to be findable, so it is passed in and folded over the top.
 */
export function everySchool(mine: School[], pack: School | null = null): School[] {
  const all = [...Object.values(BUNDLED), ...mine];
  if (!pack || !pack.id) return all;
  return all.some((s) => s.id === pack.id)
    ? all.map((s) => (s.id === pack.id ? pack : s))
    : [...all, pack];
}

