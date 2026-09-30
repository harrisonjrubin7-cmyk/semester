/**
 * The handoff: what a student did when Semester sent them to somebody else,
 * and where it stands.
 *
 * Semester hands a student to an office it deliberately does not hold data
 * from — the registrar's system, aid, accessibility, the bursar — and until
 * this file nothing asked what happened next. `oneos.ts` and `ops/leadership.ts`
 * both say it in their own words: no status after the request leaves.
 *
 * ## What it is, and what it refuses to be
 *
 * It is the *student's* note of where a handoff stands, on the student's device.
 * The specialist system owns the case; Semester is told nothing by it. So:
 *
 *   * **Every status is the student's own report**, and is shown with that
 *     label. Semester cannot see the official system and never says a
 *     registration or an appointment "went through". `describe` says "You marked
 *     this", never "This is".
 *   * **Nothing about the case is stored** — no course list, no reason, no
 *     detail, no free text. A destination, a status, and when it was set.
 *   * **It expires.** A handoff nobody has touched for `EXPIRY_DAYS` stops
 *     being live, rather than sitting as a stale "Submitted" that reads as news.
 *   * **The history is the student's audit trail**: each change and when, capped,
 *     so they can see what they said and when they said it.
 *
 * One vocabulary for every destination, so the next consumer (a help request
 * to an office, an advisor share) reads the same seven words. `fromHelpRequest`
 * maps the statuses `help_requests` already has onto it. Registration is the
 * first consumer; the second is not built.
 */

import { obj } from './device-library';

export const HANDOFF_STATUSES = [
  'not_started',
  'submitted',
  'received',
  'scheduled',
  'completed',
  'need_more_information',
  'contact_office',
] as const;
export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

/** Where a handoff goes. Closed, so a destination cannot smuggle a name or a reason. */
export const HANDOFF_DESTINATIONS = ['registration'] as const;
export type HandoffDestination = (typeof HANDOFF_DESTINATIONS)[number];

export interface HandoffEvent {
  status: HandoffStatus;
  /** Epoch milliseconds the student set it. */
  at: number;
}

export interface Handoff {
  destination: HandoffDestination;
  status: HandoffStatus;
  /** Epoch milliseconds of the last change. */
  updatedAt: number;
  /** What the student said and when, oldest first, capped at {@link MAX_HISTORY}. */
  history: HandoffEvent[];
}

/** Days without a change after which a handoff is no longer live. */
export const EXPIRY_DAYS = 60;
/** Days without a change after which an open handoff asks whether it moved. */
export const STALE_DAYS = 7;
export const MAX_HISTORY = 20;

const DAY = 86_400_000;

interface Words {
  /** The choice, as the student reads it. */
  label: string;
  /** What it means, in the student's voice, so choosing it is not a guess. */
  meaning: string;
  /** What to do next, never "wait for Semester". */
  next: string;
}

export const WORDS: Record<HandoffStatus, Words> = {
  not_started: { label: 'Not started', meaning: 'I have not done this yet.', next: 'Open the official system when you are ready.' },
  submitted: { label: 'Submitted', meaning: 'I sent it in the official system.', next: 'Check the official system for a confirmation, and keep it.' },
  received: { label: 'They have it', meaning: 'The office confirmed it arrived.', next: 'Nothing to do until they answer. Note the date they gave you.' },
  scheduled: { label: 'Appointment scheduled', meaning: 'I have a time with them.', next: 'Put it on your calendar and bring what they asked for.' },
  completed: { label: 'Done', meaning: 'It is finished in the official system.', next: 'Nothing left to do. Keep the confirmation.' },
  need_more_information: { label: 'They need more from me', meaning: 'The office asked for something else.', next: 'Do what they asked in the official system, then mark it submitted again.' },
  contact_office: { label: 'I need to talk to them', meaning: 'Only the office can sort this out.', next: 'Contact the office directly. Semester cannot resolve it for you.' },
};

/** Statuses that still wait on someone, and so can go stale. */
const OPEN: ReadonlySet<HandoffStatus> = new Set(['submitted', 'received', 'scheduled', 'need_more_information']);

export function isStatus(value: unknown): value is HandoffStatus {
  return typeof value === 'string' && (HANDOFF_STATUSES as readonly string[]).includes(value);
}

/** A new handoff, at `not_started`. */
export function startHandoff(destination: HandoffDestination, now: number): Handoff {
  return { destination, status: 'not_started', updatedAt: now, history: [{ status: 'not_started', at: now }] };
}

/**
 * The student reports a status. Any status may follow any other — the student
 * is reporting what they see, and refusing a report would make the note wrong
 * rather than the world right — but re-marking the same status is not a change,
 * and the history is capped so it cannot grow without end.
 */
export function report(handoff: Handoff, status: HandoffStatus, now: number): Handoff {
  if (handoff.status === status) return handoff;
  const history = [...handoff.history, { status, at: now }].slice(-MAX_HISTORY);
  return { ...handoff, status, updatedAt: now, history };
}

/** Whether nobody has touched it for {@link EXPIRY_DAYS}. An expired handoff is not shown as live. */
export function expired(handoff: Handoff, now: number): boolean {
  return now - handoff.updatedAt > EXPIRY_DAYS * DAY;
}

/** Whether it is waiting on someone and the student has not said anything for {@link STALE_DAYS}. */
export function stale(handoff: Handoff, now: number): boolean {
  return OPEN.has(handoff.status) && !expired(handoff, now) && now - handoff.updatedAt > STALE_DAYS * DAY;
}

const ago = (ms: number): string => {
  const days = Math.floor(ms / DAY);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
};

export interface Described {
  label: string;
  /** Always says the status is the student's own report. */
  line: string;
  next: string;
  stale: boolean;
}

/** What to show. `null` for an expired handoff: it is history, not news. */
export function describe(handoff: Handoff, now: number): Described | null {
  if (expired(handoff, now)) return null;
  const w = WORDS[handoff.status];
  const isStale = stale(handoff, now);
  return {
    label: w.label,
    line: `You marked this “${w.label}” ${ago(now - handoff.updatedAt)}. Semester cannot see the official system, so this is your note, not a record.`,
    next: isStale ? `It has been a while. Has it moved? ${w.next}` : w.next,
    stale: isStale,
  };
}

/**
 * The statuses `help_requests` already has, in this vocabulary, for the second
 * consumer. `withdrawn` is the student taking it back, which is where a
 * handoff starts.
 */
export function fromHelpRequest(status: string): HandoffStatus | null {
  switch (status) {
    case 'sent': return 'submitted';
    case 'acknowledged': return 'received';
    case 'scheduled': return 'scheduled';
    case 'closed': return 'completed';
    case 'withdrawn': return 'not_started';
    default: return null;
  }
}

/**
 * Read a stored handoff, tolerantly: anything that is not exactly a handoff is
 * `null` rather than an error, because a note the student can re-make is not
 * worth refusing the whole registration plan over.
 */
export function readHandoff(value: unknown): Handoff | null {
  if (!obj(value)) return null;
  const destination = value.destination;
  if (!(HANDOFF_DESTINATIONS as readonly unknown[]).includes(destination)) return null;
  if (!isStatus(value.status)) return null;
  const updatedAt = value.updatedAt;
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt) || updatedAt <= 0) return null;
  if (!Array.isArray(value.history)) return null;
  const history: HandoffEvent[] = [];
  for (const e of value.history.slice(-MAX_HISTORY)) {
    if (!obj(e) || !isStatus(e.status) || typeof e.at !== 'number' || !Number.isFinite(e.at) || e.at <= 0) return null;
    history.push({ status: e.status, at: e.at });
  }
  if (history.length === 0) return null;
  return { destination: destination as HandoffDestination, status: value.status, updatedAt, history };
}
