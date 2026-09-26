/**
 * Registration day: the minute a student's time ticket opens, and what they
 * do with it.
 *
 * The registration workspace already builds a cart, checks it for conflicts
 * and saves potential schedules. What it could not answer is the question a
 * student actually has at 7:59 on the morning their window opens: *if the
 * section I want is full, what do I click instead?* Registration systems give
 * a student a few minutes of real contention, and a student who decides their
 * second choice in that minute usually decides badly.
 *
 * So this is the plan made in advance:
 *
 *   * **When.** The student's own time ticket, as they typed it. Semester does
 *     not know it and says so — the label is `student_entered` until an
 *     institution connection supplies it.
 *   * **Instead of what.** For every section in the cart, up to five ranked
 *     backups. Another section of the same course comes first, because it
 *     satisfies the same requirement; then anything else the student picks.
 *   * **Ready or not.** A short checklist, and a readiness count that is only
 *     complete when every course has a backup and nothing overlaps.
 *
 * What it will not do is register anybody. The copyable list and the link to
 * the official portal are the whole of the hand-off, and every screen that
 * uses this says so.
 *
 * Stored beside `semester.registration.v1` under its own key rather than as
 * new fields on it, so a device holding a cart saved before this existed reads
 * exactly as it did — `readRegistration` is unchanged and still rejects what
 * it rejected.
 */

import { obj, textValue } from './device-library';
import { conflicts, type CatalogCourse } from './registration';

export const REGISTRATION_DAY_KEY = 'semester.registration-day.v1';

/** How many backups one section may carry. Five is already a long night. */
export const MAX_BACKUPS = 5;

export type TicketSource = 'student_entered' | 'imported';

export interface RegistrationDayData {
  /** Local wall-clock time, `YYYY-MM-DDTHH:mm`, as a datetime-local input gives it. */
  opensAt: string | null;
  source: TicketSource;
  /** Section id in the cart → ranked backup section ids. */
  backups: Record<string, string[]>;
  /** Ids from {@link CHECKLIST} the student has ticked. */
  checks: string[];
}

export const EMPTY_REGISTRATION_DAY: RegistrationDayData = {
  opensAt: null,
  source: 'student_entered',
  backups: {},
  checks: [],
};

export interface CheckItem {
  id: string;
  label: string;
  why: string;
}

/**
 * The things a registration system refuses you for, in the order they bite.
 * None of them can be checked from here — they are the student's to tick.
 */
export const CHECKLIST: CheckItem[] = [
  {
    id: 'holds',
    label: 'No holds on my account',
    why: 'A hold blocks registration outright. Check the official portal a few days early — clearing one can take a business day.',
  },
  {
    id: 'advisor',
    label: 'Met my advisor or have my registration PIN',
    why: 'Some schools release your registration only after an advising meeting.',
  },
  {
    id: 'prereqs',
    label: 'Confirmed prerequisites for every course',
    why: 'The catalog you imported may describe prerequisites; only the registration system enforces them.',
  },
  {
    id: 'portal',
    label: 'Signed in to the official portal once this week',
    why: 'An expired password or a new MFA device is the most common way to lose the first minutes.',
  },
  {
    id: 'copied',
    label: 'Copied my section list',
    why: 'So you are typing nothing when the window opens.',
  },
];

const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function readRegistrationDay(value: unknown): RegistrationDayData {
  if (!obj(value)) throw new Error('Saved registration-day plan is not valid.');
  const opensAt = value.opensAt;
  if (opensAt !== null && !(textValue(opensAt, 16) && TIME.test(opensAt))) {
    throw new Error('Saved registration time is not valid.');
  }
  const source = value.source === 'imported' ? 'imported' : 'student_entered';
  if (!obj(value.backups)) throw new Error('Saved backups are not valid.');
  const backups: Record<string, string[]> = {};
  const entries = Object.entries(value.backups);
  if (entries.length > 200) throw new Error('Saved backups are not valid.');
  for (const [primary, list] of entries) {
    if (!textValue(primary, 200) || !primary) throw new Error('Saved backups are not valid.');
    if (!Array.isArray(list) || list.length > MAX_BACKUPS || list.some((id) => !textValue(id, 200) || !id)) {
      throw new Error('Saved backups are not valid.');
    }
    // A section is never its own backup, and never twice.
    backups[primary] = [...new Set(list as string[])].filter((id) => id !== primary);
  }
  if (!Array.isArray(value.checks)) throw new Error('Saved checklist is not valid.');
  const known = new Set(CHECKLIST.map((c) => c.id));
  const checks = [...new Set(value.checks.filter((c): c is string => typeof c === 'string' && known.has(c)))];
  return { opensAt, source, backups, checks };
}

/** A datetime-local string read as local time, or null when it is not one. */
export function localTime(value: string | null): Date | null {
  if (!value || !TIME.test(value)) return null;
  const [date, clock] = value.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = clock.split(':').map(Number);
  const at = new Date(y, m - 1, d, hh, mm, 0, 0);
  return Number.isNaN(at.getTime()) ? null : at;
}

export type Phase = 'unset' | 'later' | 'soon' | 'open';

export interface Countdown {
  phase: Phase;
  /** Whole minutes until the window opens; zero or negative once open. */
  minutes: number;
  line: string;
}

/**
 * Where the student stands against their window.
 *
 * `soon` is the last seventy-two hours, which is when this plan should take
 * over the screen; before that it is a date to remember, and after it opens
 * the useful thing is the list, not a clock.
 */
export function countdown(opensAt: string | null, now: Date): Countdown {
  const at = localTime(opensAt);
  if (!at) return { phase: 'unset', minutes: 0, line: 'Add your registration time to see a countdown.' };
  const minutes = Math.ceil((at.getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return { phase: 'open', minutes, line: 'Your registration window is open.' };
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts = [
    days ? `${days} day${days === 1 ? '' : 's'}` : '',
    hours ? `${hours} hour${hours === 1 ? '' : 's'}` : '',
    !days && mins ? `${mins} minute${mins === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  return {
    phase: minutes <= 72 * 60 ? 'soon' : 'later',
    minutes,
    line: `Opens in ${parts.join(', ') || 'under a minute'}.`,
  };
}

const overlaps = (a: CatalogCourse, b: CatalogCourse) => conflicts([a, b]).length > 0;

/**
 * Sections worth offering as a backup for one in the cart, best first.
 *
 * Another section of the same course comes first, open ones before closed,
 * because it counts for the same requirement and is the backup a student
 * nearly always wants. Then courses in the same department. Anything already
 * in the cart, already chosen, in another term, or clashing with the rest of
 * the cart is left out — a backup that conflicts with a course you are keeping
 * is not a backup.
 */
export function candidates(
  primary: CatalogCourse,
  catalog: CatalogCourse[],
  cart: CatalogCourse[],
  chosen: string[],
  limit = 12,
): CatalogCourse[] {
  const inCart = new Set(cart.map((c) => c.id));
  const taken = new Set(chosen);
  const keeping = cart.filter((c) => c.id !== primary.id);
  const seatRank = (c: CatalogCourse) => (c.seats === null ? 1 : c.seats > 0 ? 0 : 2);
  return catalog
    .filter(
      (c) =>
        c.id !== primary.id &&
        c.term === primary.term &&
        !inCart.has(c.id) &&
        !taken.has(c.id) &&
        !keeping.some((k) => overlaps(k, c)),
    )
    .map((c) => ({ c, same: c.code === primary.code ? 0 : c.department === primary.department ? 1 : 2 }))
    .filter((x) => x.same < 2)
    .sort((a, b) => a.same - b.same || seatRank(a.c) - seatRank(b.c) || a.c.code.localeCompare(b.c.code) || a.c.section.localeCompare(b.c.section))
    .slice(0, limit)
    .map((x) => x.c);
}

export function addBackup(data: RegistrationDayData, primary: string, backup: string): RegistrationDayData {
  const list = data.backups[primary] ?? [];
  if (backup === primary || list.includes(backup) || list.length >= MAX_BACKUPS) return data;
  return { ...data, backups: { ...data.backups, [primary]: [...list, backup] } };
}

export function removeBackup(data: RegistrationDayData, primary: string, backup: string): RegistrationDayData {
  const list = (data.backups[primary] ?? []).filter((id) => id !== backup);
  const backups = { ...data.backups };
  if (list.length) backups[primary] = list;
  else delete backups[primary];
  return { ...data, backups };
}

/** Move one backup a place up (-1) or down (+1). Out of range is a no-op. */
export function moveBackup(data: RegistrationDayData, primary: string, backup: string, by: -1 | 1): RegistrationDayData {
  const list = [...(data.backups[primary] ?? [])];
  const at = list.indexOf(backup);
  const to = at + by;
  if (at < 0 || to < 0 || to >= list.length) return data;
  [list[at], list[to]] = [list[to], list[at]];
  return { ...data, backups: { ...data.backups, [primary]: list } };
}

export function toggleCheck(data: RegistrationDayData, id: string): RegistrationDayData {
  if (!CHECKLIST.some((c) => c.id === id)) return data;
  const checks = data.checks.includes(id) ? data.checks.filter((c) => c !== id) : [...data.checks, id];
  return { ...data, checks };
}

export interface Readiness {
  done: number;
  total: number;
  /** Cart sections with no backup that still exists in the catalog. */
  unbacked: CatalogCourse[];
  conflicts: number;
  ready: boolean;
}

/**
 * One count for the whole plan: every checklist item, one step for "every
 * course has a backup", one for "nothing overlaps", one for "time entered".
 */
export function readiness(data: RegistrationDayData, cart: CatalogCourse[], catalog: CatalogCourse[]): Readiness {
  const exists = new Set(catalog.map((c) => c.id));
  const unbacked = cart.filter((c) => !(data.backups[c.id] ?? []).some((id) => exists.has(id)));
  const clash = conflicts(cart).length;
  const steps = [
    ...CHECKLIST.map((c) => data.checks.includes(c.id)),
    cart.length > 0 && unbacked.length === 0,
    cart.length > 0 && clash === 0,
    localTime(data.opensAt) !== null,
  ];
  const done = steps.filter(Boolean).length;
  return { done, total: steps.length, unbacked, conflicts: clash, ready: done === steps.length };
}

const label = (c: CatalogCourse) => `${c.code} ${c.section}`.trim();

/**
 * The list to paste on the night, primaries first, each followed by its
 * backups in order. Plain text on purpose: it goes into a notes app, a text
 * to yourself, or a sticky note, and none of those render anything else.
 */
export function sectionList(data: RegistrationDayData, cart: CatalogCourse[], catalog: CatalogCourse[]): string {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const lines = cart.map((c) => {
    const backups = (data.backups[c.id] ?? []).map((id) => byId.get(id)).filter((b): b is CatalogCourse => !!b);
    const tail = backups.length ? ` — if full: ${backups.map(label).join(' → ')}` : ' — no backup chosen';
    return `${label(c)} · ${c.title}${tail}`;
  });
  return [
    'Registration plan (planning only — nothing was submitted)',
    ...lines,
  ].join('\n');
}

/**
 * Drop backups for sections that have left the cart or the catalog. Called
 * when the plan is shown, so importing a new catalog never leaves a backup
 * pointing at a section nobody can find.
 */
export function prune(data: RegistrationDayData, cart: CatalogCourse[], catalog: CatalogCourse[]): RegistrationDayData {
  const inCart = new Set(cart.map((c) => c.id));
  const exists = new Set(catalog.map((c) => c.id));
  let changed = false;
  const backups: Record<string, string[]> = {};
  for (const [primary, list] of Object.entries(data.backups)) {
    if (!inCart.has(primary)) {
      changed = true;
      continue;
    }
    const kept = list.filter((id) => exists.has(id) && !inCart.has(id));
    if (kept.length !== list.length) changed = true;
    if (kept.length) backups[primary] = kept;
  }
  return changed ? { ...data, backups } : data;
}
