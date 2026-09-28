import { formatTime } from './locale';
/**
 * The registration window, for the notifier.
 *
 * Split out of `lib/registration-day.ts` so the reminder code that runs on
 * every page — the in-page tick in `state/store.tsx` and both push fillers —
 * does not pull the catalog parser and the rest of registration planning
 * into the app's first download. It reads two fields of the stored plan and
 * nothing else.
 */

/** Where the registration-day plan lives on this device. */
export const REGISTRATION_DAY_KEY = 'semester.registration-day.v1';

export const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** A datetime-local string read as local time, or null when it is not one. */
export function localTime(value: string | null): Date | null {
  if (!value || !TIME.test(value)) return null;
  const [date, clock] = value.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = clock.split(':').map(Number);
  const at = new Date(y, m - 1, d, hh, mm, 0, 0);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** A reminder the notifier can fire (`lib/notify.ts`). */
export interface WindowReminder {
  id: string;
  title: string;
  body: string;
}

/**
 * The day before at 8 a.m. or later, and the hour before. Two, like the
 * registrar rule it rides on: enough that the window is not a surprise, not
 * so many that the student turns reminders off the week it matters.
 *
 * Quiet hours are not checked here — `dueReminders` returns nothing inside
 * them before any rule runs, and a reminder held back is still unseen when
 * the window lifts.
 */
export function windowReminders(opensAt: number | null, now: Date): WindowReminder[] {
  if (opensAt === null) return [];
  const minutes = (opensAt - now.getTime()) / 60_000;
  const at = new Date(opensAt);
  const clockText = formatTime(at, { hour: 'numeric', minute: '2-digit' });
  const out: WindowReminder[] = [];
  const opens = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAway = Math.round((opens.getTime() - today.getTime()) / 86_400_000);
  if (daysAway === 1 && now.getHours() >= 8) {
    out.push({
      id: `regday:${opensAt}:day`,
      title: `Registration opens tomorrow at ${clockText}`,
      body: 'Check your backups and the checklist tonight. Semester does not register you.',
    });
  }
  if (minutes > 0 && minutes <= 60) {
    out.push({
      id: `regday:${opensAt}:hour`,
      title: `Registration opens at ${clockText}`,
      body: 'Sign in to your school\u2019s registration system now. Your section list is in Semester.',
    });
  }
  return out;
}

/**
 * The registration time the notifier should know about, read straight from
 * this device's store. The three places that build the notifier's source (the
 * in-page tick and both push fillers) all call this, so none of them can
 * forget it — `notify.registration.test.ts` checks each passes it.
 */
export function storedWindow(): number | null {
  try {
    const raw = localStorage.getItem(REGISTRATION_DAY_KEY);
    if (!raw) return null;
    // The two fields this needs, read the way `readRegistrationDay` reads
    // them: `remind` is on unless it is exactly `false`, and a time that is
    // not a datetime-local string is no time at all.
    const data = JSON.parse(raw) as { opensAt?: unknown; remind?: unknown } | null;
    if (!data || typeof data !== 'object' || data.remind === false) return null;
    return typeof data.opensAt === 'string' ? (localTime(data.opensAt)?.getTime() ?? null) : null;
  } catch {
    return null;
  }
}
