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
  /**
   * A shorter name, where the full one will not fit the header bar.
   *
   * Optional, and only two pages need it. It is here rather than written out
   * again in `App.tsx` because the name of a page was, until now, in *three*
   * places — this list, the `title` a page hands `SettingsPage`, and a switch
   * in `App.tsx` — and three copies of a name drift the moment one is
   * renamed. They had: the header bar still said "Appearance" and
   * "Navigation" over pages calling themselves "Colour and type" and "Layout
   * and navigation". `settingsTitle` below is the one answer now.
   */
  short?: string;
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
        short: 'Layout',
        holds: 'Which navigation, how screens are drawn, what Today shows',
        keywords:
          'tabs tab bar navigation nav feed home screen springboard shelves pills icons layout shell grouped drawn soft presentation arrangement structure order sections today rearrange move labels badges directory everything two systems',
      },
      {
        screen: 'setLook',
        label: 'Colour and type',
        short: 'Colour',
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
      {
        screen: 'setAssistant',
        label: 'The assistant',
        short: 'Assistant',
        holds: 'Which provider answers, which model, what it costs and what it sees',
        keywords:
          'claude ai assistant chat gpt chatgpt openai anthropic api key proxy model sonnet opus haiku provider cost spend money tokens billing what it can see privacy context',
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

/**
 * The full name of a settings page — the heading on the page itself.
 *
 * `settingsTitle` below is the same name shortened for the header bar, which
 * also holds three icons. Two readings of one entry, never two entries.
 */
export function pageTitle(screen: Screen): string {
  return SETTINGS.flatMap((s) => s.rows).find((r) => r.screen === screen)?.label ?? 'Settings';
}

/**
 * What the header bar calls a settings page. One name, from one list.
 *
 * `short` where the full label would be truncated in a bar that also holds
 * three icons; the label otherwise. Anything that is not a settings page
 * comes back empty, so callers can fall through to their own switch.
 */
export function settingsTitle(screen: Screen): string {
  const row = SETTINGS.flatMap((s) => s.rows).find((r) => r.screen === screen);
  return row ? (row.short ?? row.label) : '';
}

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
 * Does `text` contain `q` starting at a word boundary?
 *
 * The difference between finding what somebody meant and finding what happens
 * to share letters with it. Searching settings for "soft" used to return
 * **Connected accounts**, ahead of the page that holds the Soft layout, because
 * that page's summary says "Microsoft" and a plain `includes` cannot tell the
 * middle of a word from the start of one.
 *
 * A prefix rather than a whole word, because somebody typing "notif" has not
 * finished the word and should still be finding notifications.
 */
function startsAWord(text: string, q: string): boolean {
  let at = text.indexOf(q);
  while (at !== -1) {
    if (at === 0 || /[^a-z0-9]/.test(text[at - 1])) return true;
    at = text.indexOf(q, at + 1);
  }
  return false;
}

/**
 * Search inside settings.
 *
 * Label first, then the synonyms and the summary of what a page holds, and a
 * match in the middle of a word last of all — because somebody who typed the
 * exact name of a page should get that page rather than one that merely shares
 * six letters with it.
 *
 * ## Two bugs this ranking exists to have fixed
 *
 * **Nothing with a space in it could ever match a synonym.** The keywords were
 * split on whitespace and each word tested with `startsWith`, so a query of two
 * words was compared against a list of single words and could never hit — and
 * the keyword lists are written in phrases. "tab bar" is in the navigation
 * page's keywords, word for word, and returned nothing at all. So did "text
 * size", "line height", "reading width", "quiet hours" and "extra credit". The
 * whole keyword string is searched now, phrases included.
 *
 * **A match inside a word outranked a real one.** See `startsAWord`. Those
 * still match, because a partial word is sometimes all somebody can remember,
 * but they now come last instead of first.
 *
 * A blank query finds nothing rather than everything: the index is already
 * on the screen underneath, and repeating it is not an answer.
 */
export function findSetting(query: string): Found[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (q.length < 2) return [];

  const out: (Found & { rank: number })[] = [];
  for (const section of SETTINGS) {
    for (const row of section.rows) {
      const label = row.label.toLowerCase();
      const holds = row.holds.toLowerCase();
      const keywords = row.keywords.toLowerCase();

      /** The synonym that matched, whole, so the page can say what it was. */
      const keyword = (): string => {
        const at = keywords.indexOf(q);
        if (at === -1) return q;
        const from = keywords.lastIndexOf(' ', at) + 1;
        const to = keywords.indexOf(' ', at + q.length);
        return keywords.slice(from, to === -1 ? undefined : to);
      };

      let rank = -1;
      let matched = '';
      if (label === q) {
        rank = 0;
        matched = row.label;
      } else if (startsAWord(label, q)) {
        rank = 1;
        matched = row.label;
      } else if (startsAWord(keywords, q)) {
        // Ahead of `holds`: keywords are the words somebody actually arrives
        // with — "gmail", "gpa", "dark" — and are chosen for this job, while
        // `holds` is a sentence written to be read.
        rank = 2;
        matched = keyword();
      } else if (startsAWord(holds, q)) {
        rank = 3;
        matched = row.holds;
      } else if (keywords.includes(q) || holds.includes(q) || label.includes(q)) {
        // Mid-word, and last. "soft" inside "Microsoft" is not nothing — it is
        // just not as good as any of the four above it.
        rank = 4;
        matched = label.includes(q) ? row.label : keywords.includes(q) ? keyword() : row.holds;
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
