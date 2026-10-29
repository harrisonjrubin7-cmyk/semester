// Term lifecycle rules (lib/termMigration.ts enforces the same words in SQL). A completed or archived term is
// closed to registration writes; its records are retained and stay readable — archiving never deletes.
export type TermState = 'open' | 'completed' | 'archived';

export const termWritable = (state: TermState): boolean => state === 'open';

export function completionBlocker(i: { hasApprovedCalendar: boolean; classesEnded: boolean; state: TermState }): string | null {
  if (!i.hasApprovedCalendar) return 'There is no approved calendar for this term.';
  if (i.state === 'completed') return 'This term is already completed.';
  if (i.state === 'archived') return 'This term is already archived.';
  if (!i.classesEnded) return 'Classes have not ended for this term yet.';
  return null;
}

export function archiveBlocker(state: TermState): string | null {
  if (state === 'open') return 'Complete the term before archiving it.';
  if (state === 'archived') return 'This term is already archived.';
  return null;
}

/** Why a registration write is refused in a closed term; null while the term is open. */
export function closedTermMessage(state: TermState): string | null {
  if (state === 'completed') return 'This term is completed; registration changes are closed for it.';
  if (state === 'archived') return 'This term is archived; registration changes are closed for it.';
  return null;
}
