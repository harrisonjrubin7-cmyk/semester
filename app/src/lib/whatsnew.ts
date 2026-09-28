import type { ModuleFlag, ModuleFlags } from './experience-flags';
import { moduleOn } from './experience-flags';
import type { Screen } from './types';

/**
 * What changed, inside the app.
 *
 * `CHANGELOG.md` is for people testing Semester and it lives in the
 * repository, which is exactly where a student never looks. This is the same
 * discipline — anything a person can notice, dated by when it reached the
 * live page, including things taken away — as data the app can draw under Me,
 * with the four things a release note needs to be useful: what is new, what
 * changed *for you*, whether anything is known to be wrong, and where to say
 * so.
 *
 * ## Filtered to what is switched on
 *
 * An institution runs the modules it turned on and no others (D-012). A note
 * about Course Studio shown to a student whose school has it off is a note
 * about somebody else's app, so an entry names the modules it concerns and
 * `visible()` drops it when none of them is on. An entry with no modules is
 * about the app everyone has.
 *
 * ## Not generated from git
 *
 * The commit history has the reasoning and the measurements, and a commit
 * message is written for the person who reviews it. These are written for the
 * person who opens the app, in the second person, and `whatsnew.test.ts` holds
 * each one to a date, a screen that exists and a sentence about what to do.
 */
export interface Note {
  /** The day it reached the live page, `YYYY-MM-DD`. */
  date: string;
  title: string;
  /** What you will see, in one or two sentences. */
  sees: string;
  /** What, if anything, you have to do. "Nothing to do." is the usual answer. */
  doTo: string;
  /** Where to look. */
  screens: Screen[];
  /** Modules this is about; empty means everyone's app. */
  modules?: ModuleFlag[];
  /** Set when this note is about something known to be wrong. */
  known?: true;
}

export const NOTES: readonly Note[] = [
  {
    date: '2026-09-29',
    title: 'One place for what Semester knows about you',
    sees: 'Under Me, a list of every control in one order: profile, data, connected accounts, sharing, AI controls, notifications, accessibility, activity, what changed, recovery, export, deletion, support access, billing and security. Each row opens the screen that already held it.',
    doTo: 'Nothing to do.',
    screens: ['me'],
  },
  {
    date: '2026-09-29',
    title: 'Your own activity, in order',
    sees: 'A trail of what you did and what you shared — a plan saved, an agenda shared, support let in or shut out, an export requested — each with where it came from, who can see it and whether it still stands. Nothing in it is content, and it stays on this device.',
    doTo: 'Nothing to do. Open Activity under Me to read it.',
    screens: ['activity'],
  },
  {
    date: '2026-09-29',
    title: 'What changed, here',
    sees: 'This list. Anything you can notice, dated by when it reached the live page, including things taken away again, and filtered to the parts of the app your school has switched on.',
    doTo: 'Nothing to do.',
    screens: ['whatsnew'],
  },
  {
    date: '2026-09-29',
    title: 'Recovery, in one place',
    sees: 'Whether your work has synced, whether this device is holding anything unsynced, a recovery copy of this device’s libraries, and the way back to a connected account or to a person.',
    doTo: 'Nothing to do unless something went missing; then start there.',
    screens: ['recovery'],
  },
  {
    date: '2026-09-29',
    title: 'Service notices only where they apply',
    sees: 'When the service has an incident or planned maintenance, the screens it affects say so in one line, with what still works. Unrelated screens say nothing. Help links to the status page.',
    doTo: 'Nothing to do.',
    screens: ['help'],
  },
  {
    date: '2026-09-28',
    title: 'Setting up ends at your first course, not at somebody else’s Today',
    sees: 'Finishing the introduction lands on the screen for adding your first course. Once you add one, the sample semester steps aside on its own.',
    doTo: 'Nothing to do.',
    screens: ['home', 'import'],
  },
  {
    date: '2026-09-28',
    title: 'Ask Semester works without a gateway, and says why when it cannot help',
    sees: 'Without a configured assistant the Ask tab still answers from your own material, and says plainly what it can see and what each mode does.',
    doTo: 'Nothing to do.',
    screens: ['ask'],
  },
  {
    date: '2026-09-28',
    title: 'Course Studio: an instructor’s rules, beside the course',
    sees: 'Where your school has switched it on, what your instructor published about the course — including its AI policy — appears beside the course and before the assistant answers.',
    doTo: 'Nothing to do.',
    screens: ['course'],
    modules: ['course_studio'],
  },
];

/** The notes a build should show: everyone's, plus those for modules that are on. Newest first. */
export function visible(flags: ModuleFlags, notes: readonly Note[] = NOTES): Note[] {
  return notes
    .filter((n) => !n.modules || n.modules.length === 0 || n.modules.some((m) => moduleOn(flags[m])))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** The notes that concern one screen: "what changed for you", where you are. */
export function forScreen(screen: Screen, notes: readonly Note[]): Note[] {
  return notes.filter((n) => n.screens.includes(screen));
}

/** The known issues among the notes shown. */
export const knownIssues = (notes: readonly Note[]): Note[] => notes.filter((n) => n.known);
