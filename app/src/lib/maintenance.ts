import { formatDateTime } from './locale';

/**
 * Repairs you reported to housing, and when to check back on them.
 *
 * Catalog row G-010 ("Maintenance"). The request itself goes to the school:
 * a housing portal, a front desk, a phone call. Semester cannot file it there
 * — `lib/housing.ts` explains why the portal is never read, and the same
 * reason forbids writing to it — so this is the student's own record of what
 * they reported, the reference housing gave them, and the moment they meant
 * to chase it. Nothing here notifies anybody.
 *
 * ## No promised response time
 *
 * The prototype's housing desk answers urgent tickets "within 4 hours". That
 * is a design for a school's staff queue, not a fact about any school, and
 * printing it to a student would be a promise Semester cannot keep. So the
 * check-back time is the student's: a suggestion by urgency that they can
 * change, or the time housing actually told them. The screen and the follow-up
 * both say whose time it is.
 *
 * ## Emergencies are not logged first
 *
 * Water, gas, smoke, no heat in freezing weather, a door that will not lock:
 * the right move is a phone call, not a record. Choosing "Emergency" shows
 * that before the form can be saved, and the record is something to fill in
 * afterwards.
 *
 * The Action Center's follow-ups are built in `lib/maintenance-actions.ts`,
 * so this file imports nothing that leads back to the store: `state/shape.ts`
 * reads stored rows through `readMaintenance` below.
 *
 * ## Statuses
 *
 * `reported` → `scheduled` → `fixed`, with `not_fixed` for a visit that did
 * not fix it (or a repair that failed again) and `withdrawn` for a request
 * the student no longer needs. `fixed` and `withdrawn` are closed. Every move
 * is checked by `move`, appended to a bounded history, and stamps `updated`
 * so two devices merge to the newer copy (`lib/merge.ts` `union`).
 */

export const URGENCIES = ['emergency', 'urgent', 'routine'] as const;
export type Urgency = (typeof URGENCIES)[number];

export const STATUSES = ['reported', 'scheduled', 'not_fixed', 'fixed', 'withdrawn'] as const;
export type MaintenanceStatus = (typeof STATUSES)[number];

export const CHANNELS = ['portal', 'phone', 'email', 'front_desk', 'other'] as const;
export type Channel = (typeof CHANNELS)[number];

export const URGENCY_TEXT: Record<Urgency, string> = {
  emergency: 'Emergency',
  urgent: 'Urgent',
  routine: 'Routine',
};

export const STATUS_TEXT: Record<MaintenanceStatus, string> = {
  reported: 'Reported, waiting to hear back',
  scheduled: 'Visit scheduled',
  not_fixed: 'Still not fixed',
  fixed: 'Fixed',
  withdrawn: 'No longer needed',
};

export const CHANNEL_TEXT: Record<Channel, string> = {
  portal: 'Housing portal',
  phone: 'Phone call',
  email: 'Email',
  front_desk: 'Front desk',
  other: 'Somewhere else',
};

/** Said wherever an emergency could be chosen. No number: Semester does not know your school's. */
export const EMERGENCY_GUIDANCE =
  'If anything is unsafe — water leaking, gas, smoke, no heat in freezing weather, or a door that will not lock — call your housing emergency line or campus safety now. Recording it here does not tell anyone.';

export const LIMITS = { hall: 120, room: 40, what: 280, where: 80, reference: 64, note: 500, history: 20 } as const;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** The check-back Semester suggests, by urgency. A suggestion, never housing's commitment. */
export const SUGGESTED_CHECK_BACK: Record<Urgency, number> = {
  emergency: 1 * HOUR,
  urgent: 4 * HOUR,
  routine: 3 * DAY,
};

/**
 * When to check back by default. Hours are elapsed time ("in an hour"); the
 * routine three days are calendar days, so 10:00 stays 10:00 across a
 * daylight-saving change.
 */
export function suggestedCheckBack(urgency: Urgency, from: number): number {
  return urgency === 'routine' ? addDays(from, 3) : from + SUGGESTED_CHECK_BACK[urgency];
}

/** How long after a scheduled visit Semester asks whether it happened. */
export const AFTER_VISIT = 1 * DAY;

export interface MaintenanceEvent {
  at: number;
  from: MaintenanceStatus | null;
  to: MaintenanceStatus;
  note?: string;
}

export interface MaintenanceRequest {
  id: string;
  term: string;
  /** The building and room, copied at the time so a later room change does not rewrite it. */
  hall: string;
  room: string;
  /** What is wrong, in the student's words. */
  what: string;
  /** Where in the room: "bathroom sink". May be empty. */
  where: string;
  urgency: Urgency;
  channel: Channel;
  /** Housing's ticket or work-order number. Empty when they gave none. */
  reference: string;
  /** When it was reported to housing. */
  reportedAt: number;
  /** When the student wants to check back. Theirs, not housing's. */
  checkBackAt: number;
  /** Whether `checkBackAt` is a time housing stated, rather than the student's own. */
  checkBackStated: boolean;
  /** A visit housing scheduled, where they did. */
  scheduledFor: number | null;
  status: MaintenanceStatus;
  history: MaintenanceEvent[];
  created: number;
  updated: number;
}

export interface MaintenanceDraft {
  hall: string;
  room: string;
  what: string;
  where: string;
  urgency: Urgency;
  channel: Channel;
  reference: string;
  reportedAt: number;
  checkBackAt: number;
  checkBackStated: boolean;
}

export type DraftField = 'hall' | 'what' | 'where' | 'reference' | 'reportedAt' | 'checkBackAt';

/** The span a stored repair time may hold; `readMaintenance` uses the same bound, so the form accepts only what reads back unchanged. */
const TIME_MAX = Date.UTC(9999, 11, 31);
const inRange = (v: number): boolean => Number.isFinite(v) && v >= 0 && v <= TIME_MAX;

/** Five minutes of grace on "not in the future": a phone clock and a laptop clock disagree. */
const CLOCK_GRACE = 5 * 60_000;

/** Every field's problem, or an empty string. The screen shows them all at once. */
export function checkDraft(draft: MaintenanceDraft, now: number): Record<DraftField, string> {
  const what = draft.what.trim();
  return {
    hall: !draft.hall.trim()
      ? 'Name the building, as housing does.'
      : draft.hall.trim().length > LIMITS.hall
        ? `Keep the building to ${LIMITS.hall} characters.`
        : '',
    what: !what
      ? 'Say what is wrong, in a few words.'
      : what.length > LIMITS.what
        ? `Keep it to ${LIMITS.what} characters. Housing has the full description.`
        : '',
    where: draft.where.trim().length > LIMITS.where ? `Keep where to ${LIMITS.where} characters.` : '',
    reference:
      draft.reference.trim().length > LIMITS.reference
        ? `A reference number is at most ${LIMITS.reference} characters.`
        : '',
    reportedAt: !Number.isFinite(draft.reportedAt)
      ? 'Give the date you reported it.'
      : !inRange(draft.reportedAt)
        ? 'Give a date after 1970.'
      : draft.reportedAt > now + CLOCK_GRACE
        ? 'The date you reported it cannot be in the future.'
        : '',
    checkBackAt: !Number.isFinite(draft.checkBackAt)
      ? 'Choose when to check back.'
      : !inRange(draft.checkBackAt)
        ? 'Choose a check-back date between 1970 and 9999.'
      : draft.checkBackAt < draft.reportedAt
        ? 'Checking back has to come after you reported it.'
        : '',
  };
}

export const draftOk = (errors: Record<DraftField, string>): boolean => Object.values(errors).every((e) => !e);

export function newMaintenance(id: string, term: string, draft: MaintenanceDraft, now: number): MaintenanceRequest {
  return {
    id,
    term,
    hall: draft.hall.trim().slice(0, LIMITS.hall),
    room: draft.room.trim().slice(0, LIMITS.room),
    what: draft.what.trim().slice(0, LIMITS.what),
    where: draft.where.trim().slice(0, LIMITS.where),
    urgency: draft.urgency,
    channel: draft.channel,
    reference: draft.reference.trim().slice(0, LIMITS.reference),
    reportedAt: draft.reportedAt,
    checkBackAt: draft.checkBackAt,
    checkBackStated: draft.checkBackStated,
    scheduledFor: null,
    status: 'reported',
    history: [{ at: now, from: null, to: 'reported' }],
    created: now,
    updated: now,
  };
}

export const isOpen = (r: MaintenanceRequest): boolean => r.status !== 'fixed' && r.status !== 'withdrawn';

const norm = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * An open request this draft probably repeats, or null.
 *
 * The same reference number is the same ticket. Without one, the same words
 * about the same room within a week are very likely the same leak recorded
 * twice — a double tap, or the phone and the laptop. The screen asks before
 * saving a second; it does not refuse, because the sink can break twice.
 */
export function likelyDuplicate(list: MaintenanceRequest[], draft: MaintenanceDraft): MaintenanceRequest | null {
  const ref = norm(draft.reference);
  const what = norm(draft.what);
  const place = `${norm(draft.hall)}|${norm(draft.room)}`;
  return (
    list.find((r) => {
      if (!isOpen(r)) return false;
      if (ref && norm(r.reference) === ref) return true;
      return (
        what !== ''
        && norm(r.what) === what
        && `${norm(r.hall)}|${norm(r.room)}` === place
        && Math.abs(r.reportedAt - draft.reportedAt) <= 7 * DAY
      );
    }) ?? null
  );
}

/** Which statuses each status may move to. `withdrawn` is terminal; delete it instead. */
export const NEXT: Record<MaintenanceStatus, readonly MaintenanceStatus[]> = {
  reported: ['scheduled', 'fixed', 'withdrawn'],
  scheduled: ['reported', 'fixed', 'not_fixed', 'withdrawn'],
  not_fixed: ['reported', 'scheduled', 'fixed', 'withdrawn'],
  fixed: ['not_fixed'],
  withdrawn: [],
};

export interface MaintenanceChange {
  to: MaintenanceStatus;
  at: number;
  note?: string;
  /** Required when moving to `scheduled`. */
  scheduledFor?: number | null;
  /** A new check-back, for "still waiting" or a re-report. */
  checkBackAt?: number;
  checkBackStated?: boolean;
  /** A new reference, when it was re-reported under another ticket. */
  reference?: string;
}

/** Why a visit time cannot be recorded, or an empty string. A visit before the report is a typo. */
export function visitProblem(request: Pick<MaintenanceRequest, 'reportedAt'>, at: unknown): string {
  if (!(typeof at === 'number' && Number.isFinite(at))) return 'Give the date and time housing scheduled the visit for.';
  if (at < request.reportedAt) return 'The visit cannot be before you reported the repair. Check the date.';
  if (!inRange(at)) return 'Give a visit date before the year 10000.';
  return '';
}

/** Why a check-back time cannot be recorded, or an empty string. Before the report it reads as a typo. */
export function checkBackProblem(after: number, at: unknown): string {
  if (!(typeof at === 'number' && Number.isFinite(at))) return 'Give the date and time housing gave.';
  if (at < after) return 'The check-back cannot be before you reported it. Check the date.';
  if (!inRange(at)) return 'Choose a check-back date between 1970 and 9999.';
  return '';
}

/** The ways a student picks when to check back. */
export type CheckBackChoice = 'suggested' | 'tomorrow' | 'week' | 'stated';

/**
 * What a check-back choice means, as a time. "Tomorrow" and "In a week" count
 * from when the student chooses them — a repair recorded today but reported
 * two days ago is checked tomorrow, not yesterday. The suggestion counts from
 * the report, because it is housing's usual response time, and it says so.
 */
export function checkBackAtFor(choice: CheckBackChoice, o: { urgency: Urgency; reportedAt: number; now: number; stated: number }): number {
  if (choice === 'stated') return o.stated;
  if (choice === 'tomorrow') return addDays(o.now, 1);
  if (choice === 'week') return addDays(o.now, 7);
  return suggestedCheckBack(o.urgency, o.reportedAt);
}

/**
 * The same wall-clock time `days` calendar days later, in this device's zone.
 * "Tomorrow" across a daylight-saving change is 23 or 25 hours, not 24.
 */
export function addDays(ms: number, days: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** A status move, or a sentence saying why it cannot happen. Pure; the reducer stores the result. */
export function move(
  request: MaintenanceRequest,
  change: MaintenanceChange,
): { ok: true; request: MaintenanceRequest } | { ok: false; why: string } {
  if (!NEXT[request.status].includes(change.to)) {
    return { ok: false, why: `A request that is “${STATUS_TEXT[request.status].toLowerCase()}” cannot become “${STATUS_TEXT[change.to].toLowerCase()}”.` };
  }
  if (change.to === 'scheduled') {
    const why = visitProblem(request, change.scheduledFor);
    if (why) return { ok: false, why };
  }
  const reopened = change.to === 'reported' || change.to === 'not_fixed';
  if (change.checkBackAt !== undefined) {
    // A re-report starts the wait again, so its check-back counts from now.
    const why = checkBackProblem(reopened ? change.at : request.reportedAt, change.checkBackAt);
    if (why) return { ok: false, why };
  }
  const note = change.note?.trim().slice(0, LIMITS.note);
  const event: MaintenanceEvent = { at: change.at, from: request.status, to: change.to, ...(note ? { note } : {}) };
  const checkBackAt =
    typeof change.checkBackAt === 'number' && Number.isFinite(change.checkBackAt)
      ? change.checkBackAt
      : reopened
        ? suggestedCheckBack(request.urgency, change.at)
        : request.checkBackAt;
  return {
    ok: true,
    request: {
      ...request,
      status: change.to,
      scheduledFor: change.to === 'scheduled' ? (change.scheduledFor as number) : change.to === 'reported' ? null : request.scheduledFor,
      checkBackAt,
      checkBackStated: typeof change.checkBackAt === 'number' ? Boolean(change.checkBackStated) : reopened ? false : request.checkBackStated,
      reference: change.reference !== undefined ? change.reference.trim().slice(0, LIMITS.reference) : request.reference,
      history: [...request.history, event].slice(-LIMITS.history),
      updated: Math.max(change.at, request.updated + 1),
    },
  };
}

/** "Still waiting": the same status, a later check-back. */
export function snoozeCheckBack(request: MaintenanceRequest, until: number, at: number): MaintenanceRequest | null {
  if (!isOpen(request) || !Number.isFinite(until) || until <= at) return null;
  return { ...request, checkBackAt: until, checkBackStated: false, updated: Math.max(at, request.updated + 1) };
}

/** Open requests first, the one to chase soonest at the top; closed ones after, newest first. */
export function ordered(list: MaintenanceRequest[]): MaintenanceRequest[] {
  const open = list.filter(isOpen).sort((a, b) => followUpAt(a) - followUpAt(b) || a.created - b.created);
  const closed = list.filter((r) => !isOpen(r)).sort((a, b) => b.updated - a.updated);
  return [...open, ...closed];
}

/** When this request next wants the student's attention. Infinity when closed. */
export function followUpAt(r: MaintenanceRequest): number {
  if (!isOpen(r)) return Number.POSITIVE_INFINITY;
  if (r.status === 'not_fixed') return r.updated;
  if (r.status === 'scheduled' && r.scheduledFor !== null) return r.scheduledFor + AFTER_VISIT;
  return r.checkBackAt;
}

export const needsFollowUp = (r: MaintenanceRequest, now: number): boolean => followUpAt(r) <= now;

/** "Branscomb 214 · bathroom sink" — where, for one line. */
export function placeLine(r: Pick<MaintenanceRequest, 'hall' | 'room' | 'where'>): string {
  const home = r.room.trim() ? `${r.hall.trim()} ${r.room.trim()}` : r.hall.trim();
  return r.where.trim() ? `${home} · ${r.where.trim()}` : home;
}

/**
 * A time a repair could really carry: 1970 to the end of 9999. Not merely a
 * valid `Date` (±8.64e15 ms) — a value at that edge is valid until the reader
 * adds three days for a fallback check-back or a day after a visit, and then
 * `Intl` throws on Housing and Today. This bound leaves millennia of room.
 */
const isNum = (v: unknown): v is number => typeof v === 'number' && inRange(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const oneOf = <T extends string>(all: readonly T[], v: unknown, fallback: T): T =>
  (all as readonly unknown[]).includes(v) ? (v as T) : fallback;

/** The line a request is known by, even when its description was lost. */
export const titleOf = (r: Pick<MaintenanceRequest, 'what'>): string =>
  r.what.trim() || 'Repair with no description recorded';

/**
 * A stored or synced row made safe, or null.
 *
 * A restored backup and another device's copy have been through no reducer, so
 * every field is read rather than trusted: unknown enums fall back to the
 * calmest value and text is clipped to its limit.
 *
 * Only a row with no id is dropped. `maintenance` is in `DELETABLE`, so a row
 * this device once agreed on and then dropped here would read to
 * `settleDeletions` as the student deleting it, and the account's good copy
 * would go too. A damaged row is kept, shown with what it still has, and can
 * be edited or removed on purpose — `readModule` treats a course the same way.
 * Fields this build does not know are carried through, so an older build
 * reading a newer one's row does not strip them on its next save.
 */
export function readMaintenance(row: unknown): MaintenanceRequest | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (!isStr(r.id) || !r.id) return null;
  const created = isNum(r.created) ? r.created : 0;
  const reportedAt = isNum(r.reportedAt) ? r.reportedAt : created;
  const status = oneOf(STATUSES, r.status, 'reported');
  const history = Array.isArray(r.history)
    ? r.history
        .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
        .filter((e) => isNum(e.at) && (STATUSES as readonly unknown[]).includes(e.to))
        .map((e) => ({
          at: e.at as number,
          from: (STATUSES as readonly unknown[]).includes(e.from) ? (e.from as MaintenanceStatus) : null,
          to: e.to as MaintenanceStatus,
          ...(isStr(e.note) && e.note.trim() ? { note: e.note.slice(0, LIMITS.note) } : {}),
        }))
        .slice(-LIMITS.history)
    : [];
  return {
    ...r,
    id: r.id,
    term: isStr(r.term) ? r.term : '',
    hall: isStr(r.hall) ? r.hall.trim().slice(0, LIMITS.hall) : '',
    room: isStr(r.room) ? r.room.trim().slice(0, LIMITS.room) : '',
    what: isStr(r.what) ? r.what.trim().slice(0, LIMITS.what) : '',
    where: isStr(r.where) ? r.where.trim().slice(0, LIMITS.where) : '',
    urgency: oneOf(URGENCIES, r.urgency, 'routine'),
    channel: oneOf(CHANNELS, r.channel, 'other'),
    reference: isStr(r.reference) ? r.reference.trim().slice(0, LIMITS.reference) : '',
    reportedAt,
    // A check-back before the report is a timeline `checkDraft` refuses; it is
    // rebuilt from the report, and housing is no longer said to have stated it.
    checkBackAt: isNum(r.checkBackAt) && r.checkBackAt >= reportedAt ? r.checkBackAt : suggestedCheckBack(oneOf(URGENCIES, r.urgency, 'routine'), reportedAt),
    checkBackStated: r.checkBackStated === true && isNum(r.checkBackAt) && r.checkBackAt >= reportedAt,
    // A visit before the report is the same impossible timeline `visitProblem`
    // refuses on screen; arriving by sync or restore, it is dropped the same way.
    scheduledFor: isNum(r.scheduledFor) && r.scheduledFor >= reportedAt ? r.scheduledFor : null,
    status: status === 'scheduled' && !(isNum(r.scheduledFor) && r.scheduledFor >= reportedAt) ? 'reported' : status,
    history,
    created,
    updated: isNum(r.updated) ? r.updated : created,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** An instant as a `datetime-local` value in this device's zone: "2026-10-12T09:30". */
export function toLocalInput(ms: number): string {
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A `datetime-local` value as an instant, or NaN when it is empty or unreadable. */
export function fromLocalInput(value: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return Number.NaN;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const at = new Date(y, mo - 1, d, h, mi);
  // `new Date` rolls 2026-02-31 into March, and 02:30 in a spring-forward gap
  // into 03:30. A wall time that did not survive is not one the student chose.
  const same = at.getFullYear() === y && at.getMonth() === mo - 1 && at.getDate() === d
    && at.getHours() === h && at.getMinutes() === mi;
  return same ? at.getTime() : Number.NaN;
}

/** "Mon Oct 12, 9:30 AM", in this device's zone. */
export function whenLine(ms: number): string {
  return formatDateTime(ms, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
