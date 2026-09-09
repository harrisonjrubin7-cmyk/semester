/**
 * Reading a row back out of storage.
 *
 * `state/shape.ts` has a `list()` whose docblock says exactly why it exists:
 * "Storage is not a trusted input. It holds whatever an older build wrote, a
 * half-finished sync left behind, a quota error truncated, or somebody typed
 * into devtools." It checks that a saved list is a list, which stopped the
 * whole page dying on `e.tasks.map is not a function`.
 *
 * It says nothing about what is *in* the list. Twenty-two of them go straight
 * into the app as whatever storage held, and a row missing one field is enough
 * to take a screen down. Measured, one row carrying only its id in each list in
 * turn, driven against the running app:
 *
 *     windows       hoursOn      w.days.includes      — the whole app, not one
 *                                                       screen: an uncaught
 *                                                       TypeError before any
 *                                                       boundary
 *     commitments   clashes      c.days.includes      <WorstDay>, <ClashList>
 *     updates       factsFrom    update.cards         <Insights>
 *     spent         courseCode   id.toUpperCase       <Me>
 *     appointments  isoToDate    iso.split            <MonthView>
 *     feedEvents    isoToDate    iso.split            <MonthView>
 *     registrar     daysTo       iso.split            <Feed_registrar>
 *
 * These are the primitives the readers are built from. Coercion rather than
 * rejection: a row is somebody's data and dropping it silently is worse than
 * drawing it with a blank where a word should be — the exception is a row that
 * is not an object at all, which holds nothing to keep.
 *
 * ## Spread first, then guarantee
 *
 * Every reader here keeps the row it was given and overwrites the fields it
 * promises, rather than building a new object from those fields alone. That is
 * the opposite of `tidyCourse` in `lib/handoff.ts`, deliberately: a pack from
 * another person is rebuilt because the spread *widens what leaves the device*,
 * and none of that applies to reading your own storage. What does apply is
 * `lib/migrate.ts`, which loads a copy written by a newer build and says of it
 * "the app reads what it recognises and ignores the rest" — ignoring a field is
 * not the same as deleting it, and a rebuild here would delete it on the next
 * save. So the spread stays and the guarantee goes on top of it.
 */

/** A string, or empty. */
export function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** A finite number, or the fallback. */
export function num(v: unknown, or = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : or;
}

/** True only for `true`, so a truthy string does not become a flag. */
export function bool(v: unknown): boolean {
  return v === true;
}

/** A list of finite numbers, or empty. */
export function nums(v: unknown): number[] {
  return Array.isArray(v) ? v.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)) : [];
}

/**
 * The objects in a stored list, with an id.
 *
 * Anything that is not an object holds nothing to repair. An id is the one
 * field with no sensible blank: it is what every list in this app keys its
 * rows off, and two rows without one collide as React children — which omits
 * a row rather than reporting anything. So one is made from the position,
 * which is stable for as long as the list is.
 */
export function rows<T extends { id: string }>(raw: unknown, at: string): Partial<T>[] {
  if (!Array.isArray(raw)) return [];
  const out: Partial<T>[] = [];
  raw.forEach((r, i) => {
    if (!r || typeof r !== 'object') return;
    const row = r as Partial<T>;
    out.push(typeof row.id === 'string' && row.id ? row : ({ ...row, id: `${at}${i}` } as Partial<T>));
  });
  return out;
}
