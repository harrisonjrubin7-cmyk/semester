/**
 * The drafts a device is holding, as a list somebody can read.
 *
 * `lib/draft.ts` keeps long text safe as it is typed, on this device only, and
 * puts it back when the screen that wrote it opens again. What it never did was
 * say what it was holding. A student who typed an essay paragraph on Thursday,
 * left, and came back on Monday to a screen they had forgotten was involved
 * would find it only by opening the right one of five. `Data` counts the bytes
 * and stops there.
 *
 * So this lists them — which screen, how much, when, how long they will last —
 * for `Recovery`. It only reads. Discarding a draft is emptying its field, on
 * the screen that owns it; a delete button here would be an irreversible
 * removal with no undo, which `DO-NOT-BUILD.md` #11 does not allow.
 *
 * It carries the text as well as the counts. Opening the owning screen is not
 * always a way back to it: the problem solver, for one, asks for the assistant
 * before it shows its field, so somebody without a key would be sent to a
 * "Needs Claude" card and never see the words this list says are kept.
 * Recovery is where they are handed back, whatever state the screen is in.
 */

import { KEEP_DAYS, type Drafts } from './draft';
import type { Screen } from './types';

const DAY = 86_400_000;

/**
 * Which screen each draft belongs to, by the first part of its key.
 *
 * Every `useDraft`, `handOver` and `draftKey` call in the source has to have
 * its first argument here; `recoverydrafts.test.ts` reads the tree and fails on
 * one that does not, so a new screen that keeps drafts cannot be invisible to
 * the one place that lists them. `study-studio` is a component, not a screen: it
 * is reached from Study.
 */
export const DRAFT_HOMES: Record<string, { screen: Screen; what: string; opens?: false }> = {
  analyse: { screen: 'analyse', what: 'A reading or some data you were analysing' },
  essay: { screen: 'essay', what: 'An essay you were drafting' },
  solve: { screen: 'solve', what: 'A problem you were working through' },
  work: { screen: 'work', what: 'A piece of coursework' },
  // Study opens on its tabs, with the studio closed. The field is only mounted
  // after "Create study guide" and a course are chosen, so going to Study does
  // not put this draft back, and an Open that does not is worse than none.
  'study-studio': { screen: 'study', what: 'A study guide', opens: false },
};

export interface DraftRow {
  key: string;
  /** The screen to open, or null when this list does not know the key. */
  home: Screen | null;
  /** Whether going to `home` puts this draft back in its field. */
  opens: boolean;
  /** What it is, in words that do not need the screen's own name. */
  what: string;
  /** The whole text, so it can be read and copied here whatever state its screen is in. */
  text: string;
  /** Whatever followed the screen and field in the key: a course, a term. */
  about: string;
  words: number;
  /** Milliseconds, when it was last typed. */
  at: number;
  /** Whole days before it is dropped, never below one while it is listed. */
  daysLeft: number;
  /** Set when another screen filled the field rather than somebody typing. */
  from?: string;
}

/** Newest first, and only the ones still worth showing. */
export function draftRows(drafts: Drafts, now: number): DraftRow[] {
  return Object.entries(drafts)
    .filter(([, d]) => now - d.at <= KEEP_DAYS * DAY && d.text.trim() !== '')
    .map(([key, d]): DraftRow => {
      const [screen = '', , ...rest] = key.split(':');
      return {
        key,
        home: DRAFT_HOMES[screen]?.screen ?? null,
        opens: DRAFT_HOMES[screen] ? DRAFT_HOMES[screen].opens !== false : false,
        what: DRAFT_HOMES[screen]?.what ?? 'Text kept from a screen this list does not know',
        text: d.text,
        about: rest.join(':'),
        words: d.text.trim().split(/\s+/).length,
        at: d.at,
        daysLeft: Math.max(1, Math.ceil(KEEP_DAYS - (now - d.at) / DAY)),
        ...(d.from ? { from: d.from } : {}),
      };
    })
    .sort((a, b) => b.at - a.at);
}

/** "About 340 words · last typed 2 days ago · kept 12 more days" */
export function draftLine(row: DraftRow, ago: string): string {
  const words = `${row.words} ${row.words === 1 ? 'word' : 'words'}`;
  const left = `${row.daysLeft} more ${row.daysLeft === 1 ? 'day' : 'days'}`;
  return `${words} · ${row.from ? 'filled in from another screen' : `last typed ${ago}`} · kept ${left}`;
}
