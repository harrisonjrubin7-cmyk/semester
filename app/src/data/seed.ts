import type { CourseModule } from '../lib/types';

/**
 * The sample semester.
 *
 * These four courses — Fall 2026 at Vanderbilt, built by hand from real syllabi
 * and real readings — were the whole app once. Now they are a sample: a new
 * account starts empty and uploads its own, and this is here so someone can see
 * what a finished course looks like before deciding to build one.
 *
 * They stay compiled in rather than copied into every account's storage,
 * because they are 300 KB of guides, figures and lesson cues that would
 * otherwise be duplicated into a 5 MB budget for no reason. An account holds a
 * flag saying whether it wants them, not a copy of them.
 *
 * The audio they reference — 44 lessons and 8 podcast editions — ships with the
 * site. A course generated from an uploaded syllabus has no recordings, and the
 * app narrates those lessons with the browser's own voice instead.
 */
/**
 * Fetched, not imported.
 *
 * These four courses are 330 KB of guides, figures and lesson cues. Imported
 * at the top of the module graph they were compiled into the main bundle and
 * downloaded by everyone — including the stranger who signs up, starts with an
 * empty semester, and never switches the sample on. A dynamic import moves
 * them into a chunk that is fetched the moment the toggle goes on and never
 * otherwise.
 *
 * The promise is cached, so flicking the toggle does not refetch.
 */
let pending: Promise<CourseModule[]> | null = null;

export function loadSeed(): Promise<CourseModule[]> {
  pending ??= Promise.all([
    import('./courses/econ'),
    import('./courses/psci'),
    import('./courses/core'),
    import('./courses/bus'),
  ])
    .then((mods) => mods.map((m) => m.default))
    /*
     * A failure is not cached, which is the difference between "not yet" and
     * "never".
     *
     * These are four dynamic imports, so they fail in exactly the two ways
     * `components/Boundary.tsx` is written about: there is no connection and
     * these chunks were never fetched, or the app was updated underneath an
     * installed copy and the files it is asking for are no longer served.
     * Both are temporary. Holding the rejected promise made them permanent —
     * the toggle would go on, nothing would appear, and flicking it off and
     * on again returned the same rejection for the rest of the session,
     * because `??=` is satisfied by a promise whatever it settled to.
     *
     * Clearing it means the next attempt is a real one.
     */
    .catch((e: unknown) => {
      pending = null;
      throw e;
    });
  return pending;
}

/**
 * What the sample contains, stated rather than counted.
 *
 * Counting it would mean importing it, which is the whole thing this file
 * exists to avoid — the numbers are on a screen that offers the sample, so
 * computing them would download the sample to describe it. `pipeline/validate.mjs`
 * checks these against the real modules on every build, so they cannot drift.
 *
 * `items` and `episodes` are here for a second reason, and it is the stronger
 * one. The validator finds them by matching the shape of the source, and a
 * pattern that stops matching finds nothing rather than finding a fault — so
 * the item checks could switch themselves off and the run would still say
 * "all checks passed". Measured: putting `c:` on the same line as `id:` in one
 * course dropped four items out of every item check, a planted duplicate id
 * went unreported, and the exit code stayed 0. The only trace was a count in
 * a success line nobody diffs. A declared number turns that silence into a
 * failure, which is what it already did for the four above.
 */
export const SEED_SUMMARY = {
  courses: 4,
  units: 44,
  cards: 278,
  lessons: 44,
  items: 48,
  episodes: 8,
};
