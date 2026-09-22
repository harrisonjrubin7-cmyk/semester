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
 * reason it is not. Twenty-two are named, and all twenty-two are genuinely not
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
 * The one screen the app is not allowed to offer.
 *
 * Not a detail page, not a settings page and not part of the shell — the
 * report queue is a place, and it would be a destination like any other but
 * for one fact: the client cannot know who should see it. `public.app_admins`
 * has no select policy, which is what makes the queue's own policy
 * un-spoofable, so a browser cannot ask whether the account it is signed in as
 * belongs there. `lib/reveal.ts` gates the directory on facts about a
 * semester, and this is not one.
 *
 * Listing it anyway would offer a report queue to every student who imported a
 * course. The address is the door and `SETUP.md` is where it is written down.
 * See `screens/Moderation.tsx`.
 */
const BY_ADDRESS = ['moderation'] as const;

const NOT_DESTINATIONS = new Set<string>([
  ...SHELL,
  ...FIRST_RUN,
  ...DETAIL,
  ...SETTINGS,
  ...BY_ADDRESS,
]);

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
