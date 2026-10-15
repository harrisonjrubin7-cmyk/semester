/**
 * Reminders the student has put away, kept on this device.
 *
 * Reminder ids are per day (see `Reminder.id`), so this list never needs to be
 * cleared by hand: yesterday's ids simply stop matching. It replaces the
 * global "Clear all" that hid the whole screen until the end of time.
 */

const KEY = 'semester.feed.dismissed';

export function readDismissed(): Set<string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

export function writeDismissed(ids: ReadonlySet<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids].slice(-400)));
  } catch {
    /* storage off: put-away items come back on reload, which is the safe direction */
  }
}
