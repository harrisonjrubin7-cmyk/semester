import { cloud } from './cloud';
import { requireOnline } from './offline-mode';

/**
 * Advisor check-ins on a student's share (Advising #5 and part of #6; D-1448),
 * against `supabase/migrations/20261011170000_advisor_check_ins.sql`.
 *
 * - **The advisor** writes one through `record_advisor_check_in` and reads the
 *   share's earlier ones through `list_share_check_ins`. Both refuse unless the
 *   share is live and addressed to them, and their advisor role still holds.
 * - **The student** reads every check-in on their own shares from the table,
 *   and may delete one. Revoking the share stops new ones.
 * - **A retry is safe.** Each draft carries a key; sending it again returns the
 *   check-in the first send made instead of writing a second.
 *
 * The policy itself is `supabase/advisor-checkins.check.sql`.
 */

export const MAX_NOTE = 2000;
export const MAX_STEPS = 5;
export const MAX_STEP = 200;

export interface CheckIn {
  id: string;
  share_id: string;
  note: string;
  next_steps: string[];
  created_at: string;
}

/** Next steps typed one per line: blanks dropped, each trimmed, order kept. */
export function readSteps(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** What the database would refuse, as a sentence an advisor can act on; null when it is fine. */
export function checkInProblem(note: string, steps: string[]): string | null {
  if (!note.trim()) return 'Write what you talked about before recording the check-in.';
  if (note.trim().length > MAX_NOTE) return `Keep the note under ${MAX_NOTE} characters.`;
  if (steps.length > MAX_STEPS) return `List at most ${MAX_STEPS} next steps.`;
  if (steps.some((s) => s.length > MAX_STEP)) return `Keep each next step under ${MAX_STEP} characters.`;
  return null;
}

const REFUSED = 'This share has expired or was revoked, so it takes no more check-ins.';

/** For the advisor: record a check-in. `key` is the draft's; resend it on a retry. */
export async function recordCheckIn(shareId: string, note: string, steps: string[], key: string): Promise<string> {
  const problem = checkInProblem(note, steps);
  if (problem) throw new Error(problem);
  requireOnline('share');
  const { data, error } = await (await cloud()).rpc('record_advisor_check_in', {
    want_share: shareId,
    check_in_note: note.trim(),
    check_in_steps: steps,
    check_in_key: key,
  });
  if (error) throw new Error(/not shared/i.test(error.message) ? REFUSED : error.message);
  return data as string;
}

/** For the advisor: the check-ins already on a live share, newest first. */
export async function checkInsOn(shareId: string): Promise<Omit<CheckIn, 'share_id'>[]> {
  const { data, error } = await (await cloud()).rpc('list_share_check_ins', { want_share: shareId });
  if (error) throw new Error(/not shared/i.test(error.message) ? REFUSED : error.message);
  return (data ?? []) as Omit<CheckIn, 'share_id'>[];
}

/** For the student: every check-in on their own shares, newest first. */
export async function myCheckIns(): Promise<CheckIn[]> {
  const { data, error } = await (await cloud())
    .from('advisor_check_ins')
    .select('id, share_id, note, next_steps, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CheckIn[];
}

/** For the student: remove one check-in from their share. */
export async function deleteCheckIn(id: string): Promise<void> {
  const { error } = await (await cloud()).from('advisor_check_ins').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
