/**
 * Source, scope, status: the one pattern every fact in Semester is meant to
 * wear.
 *
 * The app already answers "where did this come from" per row (`lib/where.ts`,
 * `lib/source.ts`) and "how fresh is it" per record (`lib/status.ts`). What it
 * did not have is the three questions asked together, in a fixed order, in
 * the same words on every surface — a course requirement, an advisor agenda,
 * a connected account and a course policy each answering:
 *
 *   Source  — where did this come from?
 *   Scope   — who can see it, or act on it?
 *   Status  — is it current, estimated, draft, pending, restricted, stale or verified?
 *
 * This file is the shape and the sentence. It decides nothing about any
 * particular row; the caller says what the three are, and the app says them
 * the same way everywhere. `sourceScopeStatus` is the sentence, and
 * `lib/journal.ts` is its one consumer today, holding every entry to
 * `wellFormed` in `journal.test.ts`. No component draws the three together
 * yet: `SourceBadge` shows source and freshness, and the one-system page
 * (`docs/ONE-SYSTEM-PLATFORM-GRAMMAR.md`) counts one trust component among
 * what to converge.
 */

export interface Provenance {
  /** "Institution verified", "Student entered", "Workday Student API", "You". */
  source: string;
  /** "Your planning workspace", "Shared with Dr. Smith until 4 October", "Biology 101". */
  scope: string;
  /** "Updated 2 hours ago", "Active", "Last sync failed 12 minutes ago", "Effective 15 September". */
  status: string;
}

/** The words that may open a status, so screens do not each coin their own. */
export const STATUS_WORDS = ['Current', 'Estimated', 'Draft', 'Pending', 'Restricted', 'Stale', 'Verified', 'Active', 'Revoked', 'Updated', 'Effective', 'Last sync', 'Requested', 'Done', 'Archived'] as const;

/** Whether a status opens with one of the agreed words. Tests use it; screens need not. */
export function wellFormed(p: Provenance): boolean {
  return p.source.trim().length > 0 && p.scope.trim().length > 0 && STATUS_WORDS.some((w) => p.status.startsWith(w));
}

/** The three, on three lines, labelled. */
export function sourceScopeStatus(p: Provenance): string {
  return `Source: ${p.source}\nScope: ${p.scope}\nStatus: ${p.status}`;
}
