/**
 * Settings as an index of pages, rather than one screen of everything.
 *
 * The screen had grown to some thirty sections in a single scroll: your name,
 * then navigation, then the accent, the ground, two typefaces, line spacing,
 * reading width, corners, spacing, text size, badges, icon shape, lead days,
 * eight notification toggles, the directory, your school, sample data and the
 * tour. Finding one of them meant scrolling past all the others, and nothing
 * on the way told you whether you had gone too far.
 *
 * So: two levels. The index is a list of grouped rows and nothing else. Each
 * row pushes a page that holds the controls it names. The controls themselves
 * are unchanged — every one of them was already built, and this moves them.
 *
 * ## One list, three consumers
 *
 * The rows below are the index, the search, and the deep-link allowance. A
 * settings page reachable by URL but missing from the index, or findable in
 * search but not actually there, are both bugs that only appear once somebody
 * is looking for something — which is the exact moment this screen exists for.
 * There is one list so they cannot disagree.
 */

import type { Screen } from './types';

export interface SettingsRow {
  /** The screen this pushes. A real screen, so Back and deep links work. */
  screen: Screen;
  label: string;
  /** What is on that page, in the order somebody would look for them. */
  holds: string;
  /**
   * Other words for the same thing.
   *
   * Somebody looking for dark mode does not search "ground", and somebody
   * looking for a font does not search "typeface". Matching only the label is
   * how a search box teaches people it does not work.
   */
  keywords: string;
}

export interface SettingsSection {
  /** Shown above the group. A real heading element on the screen. */
  header: string;
  /** Shown under it. Where explanation goes; never inside a row. */
  footer?: string;
  rows: SettingsRow[];
}

export const SETTINGS: SettingsSection[] = [
  {
    header: 'General',
    rows: [
      {
        screen: 'setNav',
        label: 'Layout and navigation',
        holds: 'Which navigation, how screens are drawn, what Today shows',
        keywords:
          'tabs tab bar navigation nav feed home screen springboard shelves pills icons layout shell grouped drawn soft presentation arrangement structure order sections today rearrange move labels badges directory everything two systems',
      },
      {
        screen: 'setLook',
        label: 'Colour and type',
        holds: 'Ground, accent, fonts, text size, spacing',
        keywords:
          'theme dark light mode colour color accent ground background parchment fog ink paper font fonts typeface heading body text size larger bigger smaller spacing density line height reading width corners rounded contrast appearance look style tone voice',
      },
      {
        screen: 'setAlerts',
        label: 'Alerts',
        holds: 'What you are told about, and when',
        keywords:
          'notifications alerts reminders push notify tell me when lead days ahead quiet hours sleep rest breaks rules permission badge sound',
      },
    ],
  },
  {
    header: 'Academic',
    rows: [
      {
        screen: 'setCourses',
        label: 'Courses',
        holds: 'What is loaded, and where you study',
        keywords:
          'courses course remove delete sample data demo example school university college switch order rearrange import syllabus term',
      },
      {
        screen: 'setGrading',
        label: 'Grading',
        holds: 'Cutoffs, dropped pieces, attendance',
        keywords:
          'grades grading scale cutoffs letter gpa points drop dropped lowest pieces attendance absences policy projection target',
      },
      {
        screen: 'setWorkload',
        label: 'Workload',
        holds: 'Hours a day, and what the term is worth',
        keywords:
          'hours workload work day budget time contract capacity load week busy how long',
      },
    ],
  },
  {
    header: 'Privacy and data',
    rows: [
      {
        screen: 'privacy',
        label: 'Your data',
        holds: 'What is stored, and what leaves the device',
        keywords:
          'privacy data policy gdpr delete erase what is stored sent tracking analytics rights api key anthropic security',
      },
      {
        screen: 'setStorage',
        label: 'Storage and backup',
        holds: 'Space used, copies, export and restore',
        keywords:
          'storage space full quota backup copies snapshot restore export download zip json save room disk drafts',
      },
      {
        screen: 'connect',
        label: 'Connected accounts',
        holds: 'Brightspace, Google, Microsoft, Zoom',
        keywords:
          'connect connected accounts google microsoft onedrive drive zoom brightspace calendar feed sign in link integration',
      },
    ],
  },
  {
    header: 'About',
    rows: [
      {
        screen: 'setAbout',
        label: 'About',
        holds: 'Version, the tour, and where to write',
        keywords: 'about version build what is new changelog tour onboarding restart help support contact email feedback',
      },
    ],
  },
];

/** Every settings page, for the deep-link allowance and for tests. */
export const SETTINGS_SCREENS: Screen[] = SETTINGS.flatMap((s) => s.rows.map((r) => r.screen));

/** Whether a screen is one of the settings pages. */
export function isSettingsPage(screen: Screen): boolean {
  return SETTINGS_SCREENS.includes(screen);
}

export function rowFor(screen: Screen): SettingsRow | undefined {
  return SETTINGS.flatMap((s) => s.rows).find((r) => r.screen === screen);
}

/** Which section a page sits under, for the heading on the page itself. */
export function sectionOf(screen: Screen): string {
  return SETTINGS.find((s) => s.rows.some((r) => r.screen === screen))?.header ?? '';
}

export interface Found {
  row: SettingsRow;
  section: string;
  /** The word that matched, so the page can say why it is highlighted. */
  matched: string;
}

/**
 * Search inside settings.
 *
 * Label first, then the summary of what a page holds, then the synonyms —
 * ranked in that order, because somebody who typed the exact name of a page
 * should get that page rather than one that merely mentions it.
 *
 * A blank query finds nothing rather than everything: the index is already
 * on the screen underneath, and repeating it is not an answer.
 */
export function findSetting(query: string): Found[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const out: (Found & { rank: number })[] = [];
  for (const section of SETTINGS) {
    for (const row of section.rows) {
      const label = row.label.toLowerCase();
      const holds = row.holds.toLowerCase();
      const words = row.keywords.split(/\s+/);

      let rank = -1;
      let matched = '';
      if (label === q) {
        rank = 0;
        matched = row.label;
      } else if (label.includes(q)) {
        rank = 1;
        matched = row.label;
      } else if (holds.includes(q)) {
        rank = 2;
        matched = row.holds;
      } else {
        const hit = words.find((w) => w.startsWith(q));
        if (hit) {
          rank = 3;
          matched = hit;
        }
      }
      if (rank >= 0) out.push({ row, section: section.header, matched, rank });
    }
  }
  return out.sort((a, b) => a.rank - b.rank).map(({ row, section, matched }) => ({ row, section, matched }));
}

/** What the search box says it will do. */
export const SEARCH_PLACEHOLDER = 'Search settings';

/** Said when a search finds nothing, naming the thing that was looked for. */
export function nothingFound(query: string): string {
  return `Nothing in settings matches “${query.trim()}”. It may be on the screen it belongs to rather than in here.`;
}

/** How long a group stays lit after search sends you to it. */
export const HIGHLIGHT_MS = 2200;

/**
 * What search was looking for, handed to the page it opened.
 *
 * A module-level note rather than a field in the store, deliberately: it is
 * read once, by the next screen to render, and then gone. Putting it in the
 * reducer would make a two-second highlight part of the state that syncs,
 * persists and merges — which is three kinds of wrong for something that is
 * over before anybody could sync it.
 */
let looking = '';

export function markLooking(term: string): void {
  looking = term.trim().toLowerCase();
}

/** Read it, and clear it. The second caller gets nothing, which is right. */
export function takeLooking(): string {
  const was = looking;
  looking = '';
  return was;
}

/**
 * Whether a group on a page is the one search was after.
 *
 * Matched against the words the group itself declares rather than against its
 * heading, so "dark" finds the ground and "font" finds the typefaces without
 * either heading having to contain the word somebody typed.
 */
export function lights(groupWords: string, term: string): boolean {
  if (!term) return false;
  const words = groupWords.toLowerCase();
  return words.split(/\s+/).some((w) => w.startsWith(term)) || words.includes(term);
}
