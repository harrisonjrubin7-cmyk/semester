/**
 * What the drive opens on.
 *
 * The drive opened on a folder listing, which is the right answer to "where
 * did I put it" and the wrong answer to the question somebody actually has
 * when they open a drive, which is "the thing I was working on". By the middle
 * of a term that is two hundred files across four courses, and the one wanted
 * was touched an hour ago.
 *
 * So there is a home, and it is the two rows every file store has settled on:
 * the folders with something happening in them, and the files with a reason
 * beside each. The reason is the part that matters. A list of six files in an
 * order nobody can see is a list you distrust; "You opened it on Tuesday" is
 * checkable, and where it is wrong you can see that it is wrong.
 *
 * Pure, and it takes the clock as an argument: the bands below are "today" and
 * "this week", and a function that read `Date.now()` itself could not be
 * tested for either without waiting.
 */

import type { Settled } from './files';
import { childrenOf, type Shown } from './folders';

/** How many of each the home shows. A home that scrolls is a listing. */
export const SUGGESTED_FILES = 6;
export const SUGGESTED_FOLDERS = 3;

/** How far back counts as "lately" for the folder row. */
export const LATELY = 14 * 86_400_000;

/** Why a file is on the home screen. In the order they beat each other. */
export type Why = 'opened' | 'added' | 'starred';

export interface Suggestion {
  file: Settled;
  why: Why;
  /** The sentence in the "Reason suggested" column. */
  says: string;
}

/** When a file was last anything — opened if it has been, added otherwise. */
export function touchedAt(file: Settled): number {
  return Math.max(file.openedAt ?? 0, file.added);
}

/**
 * A moment, said the way a file list says it.
 *
 * A time for today, a weekday for this week, a date for anything older —
 * which is the rule every mail and file client uses, because the useful part
 * of a timestamp changes with how old it is. Nobody needs the year of
 * something from this morning and nobody needs the minute of something from
 * March.
 */
export function when(at: number, now: number): string {
  const day = 86_400_000;
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const date = new Date(at);
  if (at >= midnight.getTime()) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  if (at >= midnight.getTime() - 6 * day) {
    return date.toLocaleDateString(undefined, { weekday: 'long' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * The files worth putting in front of somebody, each with its reason.
 *
 * Opened beats added beats starred, and that order is the whole argument: what
 * you opened is what you are working on, what arrived is what you have not
 * looked at yet, and a star is a standing instruction rather than news. Within
 * a reason it is the most recent first.
 *
 * A file appears once, under its strongest reason. The same file three times
 * with three different sentences beside it is how a suggestion row stops being
 * read.
 */
export function suggest(files: Settled[], now: number, howMany = SUGGESTED_FILES): Suggestion[] {
  const out: Suggestion[] = [];
  const taken = new Set<string>();

  const take = (rows: Settled[], why: Why, says: (f: Settled) => string) => {
    for (const file of rows) {
      if (out.length >= howMany) return;
      if (taken.has(file.id)) continue;
      taken.add(file.id);
      out.push({ file, why, says: says(file) });
    }
  };

  take(
    files.filter((f) => f.openedAt !== null).sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0)),
    'opened',
    (f) => `You opened it · ${when(f.openedAt ?? f.added, now)}`,
  );
  take(
    [...files].sort((a, b) => b.added - a.added),
    'added',
    (f) => `You added it · ${when(f.added, now)}`,
  );
  take(
    files.filter((f) => f.starred),
    'starred',
    () => 'You starred it',
  );
  return out;
}

export interface FolderHint {
  folder: Shown;
  /** How many files are in it, counting nothing deeper. */
  count: number;
  says: string;
}

/**
 * The folders with something happening in them.
 *
 * Measured by when a file in the folder was last touched, not by how many are
 * in it: the fullest folder is the one from September and the interesting one
 * is the one with a reading in it from this morning. A folder nothing has
 * happened in for a fortnight is not suggested at all — an empty row of course
 * folders in January is chrome.
 */
export function suggestFolders(
  folders: Shown[],
  files: Settled[],
  now: number,
  howMany = SUGGESTED_FOLDERS,
): FolderHint[] {
  const top = childrenOf(folders, null);
  const rows = top.map((folder) => {
    const inside = files.filter((f) => f.folderId === folder.id);
    const last = inside.reduce((n, f) => Math.max(n, touchedAt(f)), 0);
    return { folder, count: inside.length, last };
  });
  return rows
    .filter((r) => r.last > 0 && now - r.last < LATELY)
    .sort((a, b) => b.last - a.last)
    .slice(0, howMany)
    .map((r) => ({
      folder: r.folder,
      count: r.count,
      says: `${r.count} ${r.count === 1 ? 'file' : 'files'} · ${when(r.last, now)}`,
    }));
}
