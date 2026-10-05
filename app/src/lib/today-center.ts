import type { Choice } from './actions';
import type { SourceLabel } from './source';
import type { PathState } from './today-decision';
import type { DatedItem } from './types';

/**
 * What Today says around the Action Center, when `today_action_center` is on.
 *
 * `lib/today-actions.ts` proposes the actions and `components/ActionCenter`
 * ranks and works them (BL-1.4). This is the rest of Phase B's Today: the
 * three sentences the path may be described with, the words it may not use,
 * the time-first labels, "done for today", and the commitments list.
 */

/** The three sentences the path may be described with, and no others. */
export const STATUS_SENTENCE: Record<PathState, string> = {
  moving: 'On track based on your current plan.',
  review: 'A few choices could affect your timeline.',
  incomplete: 'Add a few details to see a clearer path.',
};

/**
 * Words Today does not say about a student. Not a style preference: "behind"
 * and "at risk" are verdicts about a person, made from a calendar.
 */
export const UNCALM = /\b(at[\s-]risk|failing|behind)\b/i;
export const isCalm = (text: string): boolean => !UNCALM.test(text);

/** "Today", "Tomorrow", "In 3 days" — calendar days, the time first. */
export function timeFirstLabel(at: number, now: number): string {
  const day = (t: number) => {
    const x = new Date(t);
    return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  };
  const days = Math.round((day(at) - day(now)) / 86_400_000);
  if (days < 0) return days === -1 ? 'Yesterday' : `${-days} days ago`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/** A course date is imported when the student confirmed it against its source, and otherwise needs review. */
export const itemSource = (item: DatedItem): SourceLabel => (item.checked?.confirmed ? 'imported' : 'needs_review');

/**
 * "You are set for today", and what comes next.
 *
 * Shown when nothing due today or tomorrow is still open, and the student has
 * closed at least one thing today — so it reads as closure after work, not as
 * a verdict on an empty calendar. Never counts, never praises.
 */
export function doneForToday(
  input: { upcoming: DatedItem[]; done: Record<string, boolean>; now: number },
  choices: Record<string, Choice>,
): { line: string } | null {
  const start = new Date(input.now);
  const midnight = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const pressing = input.upcoming.some(
    (item) => !item.isPast && item.daysAway <= 1 && !input.done[item.id]
      && choices[`deadline:${item.id}`]?.status !== 'completed',
  );
  if (pressing) return null;
  const closedToday = Object.values(choices).some((c) => c.history.some((h) => h.event === 'complete' && h.at >= midnight))
    || input.upcoming.some((item) => item.isToday && input.done[item.id]);
  if (!closedToday) return null;
  const next = input.upcoming.find(
    (item) => !input.done[item.id] && !item.isPast && item.daysAway >= 1
      && choices[`deadline:${item.id}`]?.status !== 'completed',
  );
  if (!next) return { line: 'You are set for today. Nothing else is recorded as due.' };
  return { line: `You are set for today. Your next deadline is ${timeFirstLabel(next.date.getTime(), input.now).toLowerCase()}.` };
}

export interface CommitmentRow {
  id: string;
  at: number;
  title: string;
  meta: string;
  kind: 'deadline' | 'task' | 'appointment' | 'class';
  /** Rows sharing a group on the same day are one row. Usually the course. */
  group?: string;
  source?: SourceLabel;
  itemId?: string;
}

export interface Commitments {
  urgent: (CommitmentRow & { when: string }) | null;
  rows: (CommitmentRow & { when: string; count: number })[];
}

/**
 * At most one urgent card and four rows, the time first.
 *
 * Urgent is a deadline or task inside the next 24 hours — not a class, which
 * is on the timetable and needs no alarm — and never the item the Action
 * Center already leads with. Rows on the same day with the same group fold
 * into one ("ECON 1020 · 2 items"), because three lines for one course on one
 * afternoon is three reads for one decision.
 */
export function planCommitments(all: CommitmentRow[], now: number, leading?: string | null): Commitments {
  const named = (r: CommitmentRow) => !!leading && (r.itemId === leading || r.id === leading);
  const sorted = all.filter((r) => r.at >= now - 60_000 && !named(r))
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const urgentRow = sorted.find((r) => (r.kind === 'deadline' || r.kind === 'task') && r.at - now <= 24 * 3_600_000) ?? null;
  const rows: Commitments['rows'] = [];
  for (const r of sorted) {
    if (r === urgentRow) continue;
    const when = timeFirstLabel(r.at, now);
    const same = r.group ? rows.find((x) => x.group === r.group && x.when === when) : undefined;
    if (same) {
      same.count += 1;
      same.meta = `${same.count} items`;
      continue;
    }
    if (rows.length === 4) continue;
    rows.push({ ...r, when, count: 1 });
  }
  return { urgent: urgentRow ? { ...urgentRow, when: timeFirstLabel(urgentRow.at, now) } : null, rows };
}
