/**
 * How long a piece of coursework is expected to take, as the student says.
 *
 * §91 lists *Estimated effort* as a field of every assignment. The app has
 * never stored one: `lib/pace.ts` infers it per kind of work from the minutes
 * already logged against finished items, and that inference is the default
 * this file does not replace. A stored value is the student's own statement
 * about one specific item, which the inference cannot know — a ten-page
 * reading and a ten-page reading the student already half knows are different
 * amounts of work, and only the student can say which this is.
 *
 * So the stored value sits beside the inferred one rather than overwriting it.
 * `effortLine` shows both, and says which is which, so a disagreement between
 * them is visible instead of being settled silently in one direction.
 *
 * One map of deadline id to minutes, merged across devices the way the other
 * per-item maps are (`lib/merge.ts`). Absence means "no estimate given", which
 * is the common case and is never written as zero.
 */

/** Deadline id to the minutes the student expects it to take. */
export type EffortMap = Record<string, number>;

/**
 * Forty hours. An item the student estimates above this is a typo or a
 * different kind of commitment entirely, and either way the stored value would
 * dominate every calculation that later reads it.
 */
export const MAX_EFFORT_MINUTES = 40 * 60;

/** Stored values made safe. The reader `readStarted` does, for the same reason. */
export function readEffort(raw: unknown): EffortMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: EffortMap = {};
  for (const [id, minutes] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 1 && minutes <= MAX_EFFORT_MINUTES) {
      out[id] = Math.round(minutes);
    }
  }
  return out;
}

/**
 * Sets, replaces or clears one item's estimate.
 *
 * `null` clears it, which is how the student takes an estimate back. A value
 * that is not a finite number is refused by returning the map unchanged,
 * rather than being written as something the reader would then have to undo.
 * Anything else is rounded and clamped into the stored range.
 */
export function setEffort(map: EffortMap, id: string, minutes: number | null): EffortMap {
  if (minutes === null) {
    if (!(id in map)) return map;
    const { [id]: _gone, ...rest } = map;
    return rest;
  }
  if (!Number.isFinite(minutes)) return map;
  const clamped = Math.min(MAX_EFFORT_MINUTES, Math.max(1, Math.round(minutes)));
  if (map[id] === clamped) return map;
  return { ...map, [id]: clamped };
}

/**
 * The sentence under an item's detail that puts the two estimates side by side.
 *
 * `paced` is the inferred figure, or null when the student has never logged
 * anything of this kind in this course. With neither, there is nothing to say
 * and the empty string is returned so the caller can omit the line.
 */
export function effortLine(stated: number | undefined, paced: number | null): string {
  if (stated !== undefined && paced !== null) {
    return `You expect this to take ${stated} min. Your pace in this course says about ${paced} min.`;
  }
  if (stated !== undefined) return `You expect this to take ${stated} min.`;
  if (paced !== null) return `Your pace in this course says about ${paced} min. You have not given your own estimate.`;
  return '';
}
