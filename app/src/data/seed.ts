import type { CourseModule } from '../lib/types';
import econ from './courses/econ';
import psci from './courses/psci';
import core from './courses/core';
import bus from './courses/bus';

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
export const SEED_MODULES: CourseModule[] = [econ, psci, core, bus];

export const SEED_SUMMARY = {
  courses: SEED_MODULES.length,
  units: SEED_MODULES.reduce((n, m) => n + m.guide.units.length, 0),
  cards: SEED_MODULES.reduce(
    (n, m) => n + m.guide.units.reduce((k, u) => k + u.cards.length, 0),
    0,
  ),
  lessons: SEED_MODULES.reduce((n, m) => n + Object.keys(m.lessons ?? {}).length, 0),
};
