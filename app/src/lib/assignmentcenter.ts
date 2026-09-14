import type { DatedItem, PersonalTask } from './types';

export type AssignmentView = 'today' | 'week' | 'upcoming' | 'overdue' | 'working' | 'completed' | 'graded' | 'all';
export function inAssignmentView(item: DatedItem, view: AssignmentView, done: Record<string, boolean>, started: Record<string, number>, grades: Record<string, string>): boolean {
  const finished = !!done[item.id];
  switch (view) {
    case 'today': return item.isToday && !finished;
    case 'week': return item.daysAway >= 0 && item.daysAway < 7 && !finished;
    case 'upcoming': return !item.isPast && !finished;
    case 'overdue': return item.isPast && !finished;
    case 'working': return !!started[item.id] && !finished;
    case 'completed': return finished;
    case 'graded': return !!grades[item.id]?.trim();
    default: return true;
  }
}

/** Checklist progress is personal planning progress, never an LMS receipt. */
export function assignmentProgress(id: string, tasks: PersonalTask[], completed: boolean) {
  const steps = tasks.filter(t => t.from === id);
  const checked = steps.filter(t => t.done).length;
  return { steps, checked, percent: completed ? 100 : steps.length ? Math.round(100 * checked / steps.length) : null };
}

export function workloadByDay(items: DatedItem[], done: Record<string, boolean>, minutes: Map<string, number | null>) {
  const days = new Map<string, { label: string; items: DatedItem[]; minutes: number; unknown: number }>();
  for (const item of items) {
    if (done[item.id] || item.daysAway < 0 || item.daysAway >= 7) continue;
    const key = `${item.date.getFullYear()}-${item.month}-${item.day}`;
    const day = days.get(key) ?? { label: item.dueShort, items: [], minutes: 0, unknown: 0 };
    day.items.push(item);
    const estimate = minutes.get(item.id);
    if (estimate == null) day.unknown++; else day.minutes += estimate;
    days.set(key, day);
  }
  return [...days.values()];
}
