/**
 * The private study journal: a mistake written down with what was tried, what
 * was learned and a date to come back to it.
 *
 * The record and its reader live here, rather than inside the panel, so that the
 * workspace backup and the panel share one definition of what a valid journal is.
 * A restored file is checked by the same reader that checks the device's own
 * copy: an entry with a field it cannot read refuses the whole file, never
 * half-restores it.
 */

import { isoDay, obj, textValue } from './device-library';

export const STUDY_JOURNAL_PREFIX = 'semester.study-journal.v1';

export interface Entry {
  id: string;
  courseId: string;
  topic: string;
  attempt: string;
  correction: string;
  kind: string;
  source: string;
  review: string;
  resolved: boolean;
}

export interface Journal {
  version: 1;
  entries: Entry[];
}

export const EMPTY_JOURNAL: Journal = { version: 1, entries: [] };

export function readJournal(v: unknown): Journal {
  if (
    !obj(v) ||
    v.version !== 1 ||
    !Array.isArray(v.entries) ||
    v.entries.length > 150 ||
    v.entries.some(
      (e) =>
        !obj(e) ||
        !['id', 'courseId', 'topic', 'kind', 'source'].every((k) => textValue(e[k], 500)) ||
        !textValue(e.attempt, 8000) ||
        !textValue(e.correction, 8000) ||
        !isoDay(e.review) ||
        typeof e.resolved !== 'boolean',
    )
  )
    throw new Error('Invalid study journal.');
  return v as unknown as Journal;
}
