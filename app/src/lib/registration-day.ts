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

import type { SourceLabel } from './source';
import { TIME, localTime } from './registration-window';

export { REGISTRATION_DAY_KEY, localTime, storedWindow, windowReminders, type WindowReminder } from './registration-window';
import { obj, textValue } from './device-library';
import { conflicts, type CatalogCourse } from './registration';
import { readHandoff, type Handoff } from './handoff-status';


/** How many backups one section may carry. Five is already a long night. */
export const MAX_BACKUPS = 5;

/** A time ticket is only ever typed in or imported; the shared labels are in `lib/source.ts`. */
export type TicketSource = Extract<SourceLabel, 'student_entered' | 'imported'>;

export interface RegistrationDayData {
  /** Local wall-clock time, `YYYY-MM-DDTHH:mm`, as a datetime-local input gives it. */
  opensAt: string | null;
  source: TicketSource;
  /** Section id in the cart → ranked backup section ids. */
  backups: Record<string, string[]>;
  /** Ids from {@link CHECKLIST} the student has ticked. */
  checks: string[];
  /**
   * Registration Day Mode (`registration_day_mode`). All four are optional in
   * storage — a plan saved before they existed reads with the defaults — and
   * all four are the student's own entries.
   */
  /** The credits the student means to register for. No default: Semester does not guess a load. */
  creditTarget: number | null;
  /**
   * Three more numbers the student may enter for the term-load check
   * (`lib/termload.ts`). Optional in storage and absent from older saves; the
   * limits are their school's, as they read them, never something Semester knows.
   */
  minCredits: number | null;
  maxCredits: number | null;
  studyHours: number | null;
  /** Their school's registration system, as they typed it. `https:` only (`safePortalUrl`). */
  portalUrl: string | null;
  /** Reminders the day before and an hour before, through the registrar-deadline rule. */
  remind: boolean;
  /** Show the mode on Today now, whatever the date — for a pilot, a demo, or a student who wants it early. */
  manual: boolean;
  /**
   * Where the student says their registration stands in the official system
   * (`lib/handoff-status.ts`). Their own report, on their device, never sent; null
   * until they leave for the portal and say anything.
   */
  handoff: Handoff | null;
}

export const EMPTY_REGISTRATION_DAY: RegistrationDayData = {
  opensAt: null,
  source: 'student_entered',
  backups: {},
  checks: [],
  creditTarget: null,
  minCredits: null,
  maxCredits: null,
  studyHours: null,
  portalUrl: null,
  remind: true,
  manual: false,
  handoff: null,
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
  const target = value.creditTarget;
  const creditTarget = typeof target === 'number' && Number.isFinite(target) && target > 0 && target <= 40 ? target : null;
  const within = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max ? v : null);
  const minCredits = within(value.minCredits, 40);
  const maxCredits = within(value.maxCredits, 40);
  const studyHours = within(value.studyHours, 100);
  const portalUrl = typeof value.portalUrl === 'string' ? safePortalUrl(value.portalUrl) : null;
  const remind = value.remind !== false;
  const manual = value.manual === true;
  // Tolerant on purpose: a note the student can re-make is not worth refusing
  // the whole plan over, so anything that is not a handoff reads as none.
  const handoff = readHandoff(value.handoff);
  return { opensAt, source, backups, checks, creditTarget, minCredits, maxCredits, studyHours, portalUrl, remind, manual, handoff };
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

// ── Registration Day Mode (`registration_day_mode`) ─────────────────────────

/**
 * An address for the student's official registration system, or null.
 *
 * `https:` only, and at most 2,000 characters. The link is handed to the
 * browser behind a confirmation (`components/ConfirmDialog`), and a
 * `javascript:` or `http:` address typed or pasted into that field is exactly
 * what a confirmation cannot make safe.
 */
export function safePortalUrl(value: string): string | null {
  const text = value.trim();
  if (!text || text.length > 2000) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' && url.hostname ? url.toString() : null;
  } catch {
    return null;
  }
}

/** How close the window must be before the mode appears on its own. */
export const MODE_DAYS = 3;

/**
 * Whether Registration Day Mode is showing: the student asked for it, or
 * their window opens within 72 hours, or it opened less than a day ago. After
 * that the day is over and Today goes back to being Today.
 */
export function modeActive(data: RegistrationDayData, now: Date): boolean {
  if (data.manual) return true;
  const at = localTime(data.opensAt);
  if (!at) return false;
  const minutes = (at.getTime() - now.getTime()) / 60_000;
  return minutes <= MODE_DAYS * 1440 && minutes > -24 * 60;
}

/**
 * "01:42:18" in the last day, ticking; null further out, where the sentence
 * from `countdown` reads better than a clock with a day count in front.
 */
export function clockDigits(opensAt: string | null, now: Date): string | null {
  const at = localTime(opensAt);
  if (!at) return null;
  const seconds = Math.ceil((at.getTime() - now.getTime()) / 1000);
  if (seconds <= 0 || seconds > 24 * 3600) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
}

export interface SummaryLine {
  ok: boolean;
  text: string;
}

/**
 * The three lines at the top of the mode, in the brief's shape:
 *
 *   ✓ 15 credits selected
 *   ✓ No schedule conflicts
 *   ! One backup option needed
 *
 * The credit line is only a check against a target the student set; with no
 * target it states the number and asks for nothing, because Semester does not
 * know what load is right for anybody.
 */
export function summaryLines(data: RegistrationDayData, cart: CatalogCourse[], catalog: CatalogCourse[]): SummaryLine[] {
  const ready = readiness(data, cart, catalog);
  const credits = cart.reduce((sum, c) => sum + c.credits, 0);
  const creditText = `${credits} credit${credits === 1 ? '' : 's'} selected`;
  const lines: SummaryLine[] = [];
  if (data.creditTarget === null) {
    lines.push({ ok: true, text: creditText });
  } else if (credits === data.creditTarget) {
    lines.push({ ok: true, text: `${creditText}, your target` });
  } else {
    const gap = data.creditTarget - credits;
    lines.push({ ok: false, text: `${creditText}, ${Math.abs(gap)} ${gap > 0 ? 'under' : 'over'} your ${data.creditTarget}-credit target` });
  }
  lines.push(
    ready.conflicts === 0
      ? { ok: true, text: 'No schedule conflicts' }
      : { ok: false, text: `${ready.conflicts} schedule conflict${ready.conflicts === 1 ? '' : 's'} to resolve` },
  );
  const missing = ready.unbacked.length;
  lines.push(
    missing === 0
      ? { ok: true, text: 'Every course has a backup' }
      : { ok: false, text: `${missing === 1 ? 'One backup option' : `${missing} backup options`} needed` },
  );
  return lines;
}

/**
 * The parts of the brief's checklist Semester can see for itself. Worked out,
 * never ticked: a checkbox for "no schedule conflicts" would let a student
 * tick a claim the cart contradicts.
 */
export function derivedChecks(data: RegistrationDayData, cart: CatalogCourse[], catalog: CatalogCourse[]) {
  const ready = readiness(data, cart, catalog);
  const credits = cart.reduce((sum, c) => sum + c.credits, 0);
  return [
    { id: 'schedule', label: 'Schedule reviewed: no time conflicts', ok: cart.length > 0 && ready.conflicts === 0 },
    {
      id: 'credits',
      label: data.creditTarget === null ? 'Credit target set' : `Credit target checked (${credits} of ${data.creditTarget})`,
      ok: data.creditTarget !== null && credits === data.creditTarget,
    },
    { id: 'backups', label: 'Backup courses saved for every section', ok: cart.length > 0 && ready.unbacked.length === 0 },
  ];
}

/**
 * What a student types into the registration system, and nothing else: code,
 * section and the course reference number where the catalog has one. The
 * full plan with backups is `sectionList`; this is the paste.
 */
export function courseReferences(cart: CatalogCourse[]): string {
  return cart
    .map((c) => `${c.code} ${c.section}`.trim() + (c.crn ? ` · CRN ${c.crn}` : ' · reference number not in your catalog'))
    .join('\n');
}
