/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from './nav';

/**
 * A screen that is in neither the registry nor this list cannot be found.
 *
 * `DESTINATIONS` in `lib/nav.ts` is what the launcher draws, what search
 * searches, what the directory lists and what the shortcut row offers. A
 * `Screen` that is not in it is reachable only from whatever already links to
 * it — which is correct for a detail page and a bug for anything else, and
 * nothing in the types tells the two apart. Adding a screen touches several
 * files; forgetting the registry compiles, renders, and leaves a screen that
 * exists and cannot be reached from anywhere a person would look.
 *
 * So every member of the union is either registered or named below with the
 * reason it is not. Twenty-five are named, and all twenty-five are genuinely not
 * destinations: putting `course` in the launcher would mean "a course",
 * unanswerably, and putting `setLook` there would be a second door into a page
 * Settings already lists.
 *
 * This is the first of the two steps `ENGINEERING-AUDIT.md` §4 asks for. The
 * second — one module per screen, so registering is not a separate act of
 * memory — is architecture and belongs on its own branch.
 */

/** The shell looking at itself. A browser's new-tab page is not a bookmark. */
const SHELL = ['search', 'directory'] as const;

/** Seen once, by somebody who has not got as far as a launcher. */
const FIRST_RUN = ['onboarding'] as const;

/**
 * Detail pages. Each one is *a* course, *an* item, *that* lesson — there is no
 * general version of it to put in a list, and every one of them is opened from
 * a parent that is registered.
 */
const DETAIL = [
  'course',
  'item',
  'event',
  'guide',
  'quiz',
  'drill',
  'guess',
  'gap',
  'lesson',
  'note',
  'slides',
] as const;

/** Pages inside Settings, which lists them itself and is registered. */
const SETTINGS = [
  'setLook',
  'setNav',
  'setAlerts',
  'setCourses',
  'setGrading',
  'setWorkload',
  'setAbout',
  'setAssistant',
] as const;

/**
 * Staff tools. The Trust & Safety console is opened from Community by an
 * account that holds a reviewer role; putting it on a student's shelf would be
 * a door that opens onto "you are not a reviewer" for everybody else.
 */
const STAFF = ['moderation', 'agreements', 'volunteers', 'console'] as const;

/**
 * Present only while a build switch is on. Community is absent from the
 * registry until its flags are set, rather than present as a tile that opens
 * onto "not available" — see `COMMUNITY_DESTINATION` in lib/nav.ts. Volunteer
 * moderation is never a shelf item: it is opened from Community, and only
 * when both its build flag and the school's own switch are on. Dining is the
 * same case with a school's module flag for the switch: off at every school
 * today, opened from its student-kept counterpart (Meal plan) rather than
 * offered as a tile. The
 * registration transaction and the gradebook of record are the same again,
 * with a writeback flag for the switch, reached from the Registration planner
 * and the Grades tab.
 */
const SWITCHED = ['community', 'volunteer', 'dining', 'registration', 'gradebook'] as const;

/**
 * Pages inside the Me control surface, which lists them itself
 * (`lib/mecontrols.ts`, drawn by `components/MeControls.tsx`) and is
 * registered. The same arrangement as Settings and its pages: a second door
 * on a shelf would be a second home, and the Data shelf is full.
 */
const ME_CONTROLS = ['activity', 'whatsnew', 'recovery'] as const;

const NOT_DESTINATIONS = new Set<string>([...SHELL, ...FIRST_RUN, ...DETAIL, ...SETTINGS, ...STAFF, ...SWITCHED, ...ME_CONTROLS]);

/**
 * The union, read out of the file rather than imported.
 *
 * `Screen` is a type and types are gone by the time this runs, so there is
 * nothing to import — and adding a runtime list beside it would be a second
 * copy to keep in step, which is the failure this test exists to catch.
 * `ai/split.test.ts` reads source for the same reason.
 */
const SCREENS: string[] = (() => {
  const types = readFileSync(new URL('./types.ts', import.meta.url), 'utf8');
  const union = /export type Screen =([\s\S]*?);\n/.exec(types);
  if (!union) throw new Error('lib/types.ts no longer declares `export type Screen =`');
  return [...union[1].matchAll(/\|\s*'([a-zA-Z0-9_-]+)'/g)].map((m) => m[1]);
})();

describe('every screen is either offered or accounted for', () => {
  const registered = new Set(DESTINATIONS.map((d) => d.screen as string));

  it('registers every screen that is not on the list above', () => {
    const lost = SCREENS.filter((s) => !registered.has(s) && !NOT_DESTINATIONS.has(s));
    expect(
      lost,
      'add these to DESTINATIONS in lib/nav.ts, or to the list in this file with the reason',
    ).toEqual([]);
  });

  it('keeps the list honest — nothing on it is registered as well', () => {
    const both = [...NOT_DESTINATIONS].filter((s) => registered.has(s));
    expect(both, 'these are registered, so remove them from the list in this file').toEqual([]);
  });

  it('and nothing on it has stopped being a screen', () => {
    const gone = [...NOT_DESTINATIONS].filter((s) => !SCREENS.includes(s));
    expect(gone, 'these are no longer in the Screen union').toEqual([]);
  });
});
