// Faculty Today (owner PDFs S-79/S-82): the homepage is organised around work, and every item carries a data state so
// "nothing due" can never be confused with "could not load". Pure; tested in tests/facultyToday.test.ts.
import { parseMeeting } from './sectionRequestRules';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Next (or current) meeting of a section from its catalog meeting pattern, in the viewer's local time. */
export function nextMeeting(times: string, now: Date): { start: Date; end: Date; inProgress: boolean } | null {
  const m = parseMeeting(times);
  if (!m) return null;
  for (let add = 0; add <= 7; add++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add);
    if (!m.days.includes(DAYS[d.getDay()])) continue;
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(m.start / 60), m.start % 60);
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(m.end / 60), m.end % 60);
    if (end > now) return { start, end, inProgress: start <= now };
  }
  return null;
}

export type Widget<T> = { state: 'ok'; data: T } | { state: 'unavailable'; reason: string } | { state: 'denied'; reason: string };

/** Count to show for a widget: a number only when the data loaded. */
export const countLabel = (w: Widget<{ count: number }> | undefined, loading = false): string =>
  !w ? (loading ? '…' : '—') : w.state === 'ok' ? String(w.data.count) : '—';

/** Runs one widget's loader in isolation, so one failing source never blanks the others. */
export async function widget<T>(load: () => Promise<T>): Promise<Widget<T>> {
  try { return { state: 'ok', data: await load() }; }
  catch (e) {
    const msg = String((e as { userFacingMessage?: string })?.userFacingMessage ?? (e as Error)?.message ?? '');
    return /authz:|not allow|forbidden|access/i.test(msg) ? { state: 'denied', reason: 'Your role does not include this.' } : { state: 'unavailable', reason: 'This could not load.' };
  }
}
