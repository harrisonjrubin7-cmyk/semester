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
  ]).then((mods) => mods.map((m) => m.default));
  return pending;
}

/**
 * What the sample contains, stated rather than counted.
 *
 * Counting it would mean importing it, which is the whole thing this file
 * exists to avoid — the numbers are on a screen that offers the sample, so
 * computing them would download the sample to describe it. `pipeline/validate.mjs`
 * checks these against the real modules on every build, so they cannot drift.
 */
export const SEED_SUMMARY = { courses: 4, units: 44, cards: 278, lessons: 44 };
