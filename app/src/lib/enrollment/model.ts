import type { FeatureState } from '../../intelligence/contracts';
import type { KillSwitchRow } from '../flags';
import type { CatalogCourse } from '../registration';

/**
 * The official registration transaction's vocabulary.
 *
 * The student-side planning (`lib/registration.ts`, `registration-day.ts`)
 * works on `CatalogCourse`: what a catalog says a section is. A section a
 * registrar actually enrolls into is that plus the four things only the
 * registrar knows — how many seats, how long a waitlist, what must be passed
 * first, and whether somebody must say yes. So `Section` extends the catalog
 * row rather than restating it, and a cart built in the planner is already a
 * list of the things this module enrolls into.
 *
 * The server half is `supabase/migrations/20260929300000_registration_transaction.sql`;
 * the names here are the columns and reason codes there.
 */

/** What a registrar may waive for one student in one section. A hold is not on the list, by design. */
export type OverrideKind = 'capacity' | 'prerequisite' | 'time_conflict' | 'credit_limit' | 'approval' | 'late_add';

export const OVERRIDE_KINDS: readonly OverrideKind[] = [
  'capacity',
  'prerequisite',
  'time_conflict',
  'credit_limit',
  'approval',
  'late_add',
];

export interface Section extends CatalogCourse {
  /** Seats. A capacity override may put more people in than this; nothing else can. */
  capacity: number;
  /** How many may wait. Zero means the section has no waitlist. */
  waitlistCapacity: number;
  /** Course codes that must be passed first, structured — not the catalog's free-text `prerequisites`. */
  prerequisiteCodes: readonly string[];
  /** Whether a registrar must approve each enrollment (permission of instructor, a restricted section). */
  requiresApproval: boolean;
}

/** One term's registration calendar, as ISO instants, and its credit ceiling. */
export interface TermWindow {
  term: string;
  opensAt: string;
  /** The last instant to add or drop. After it, leaving is a withdrawal and earns a W. */
  addDropEndsAt: string;
  /** The last instant to withdraw. */
  withdrawEndsAt: string;
  maxCredits: number;
}

/** `enrolled`, `waitlisted` and `pending_approval` are live; the rest are history and are never deleted. */
export type EnrollmentState =
  | 'enrolled'
  | 'waitlisted'
  | 'pending_approval'
  | 'dropped'
  | 'left_waitlist'
  | 'withdrawn'
  | 'denied';

export const LIVE_STATES: readonly EnrollmentState[] = ['enrolled', 'waitlisted', 'pending_approval'];

export interface Enrollment {
  id: string;
  student: string;
  section: string;
  state: EnrollmentState;
  /** The waitlist's order: a ledger counter, never a timestamp, so two requests in one millisecond still have one order. */
  waitSeq: number | null;
  /** 'W' exactly when withdrawn. A withdrawal is a grade on the record, not a deletion of it. */
  grade: 'W' | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * A hold, as this module is allowed to know it: that it exists, and which
 * office to go to. There is no reason field. `scope.sis.registration_hold_summary_read`
 * says "never the reason", and the surest way to never show a reason is to
 * never be handed one — anything extra a caller passes is not read.
 */
export interface Hold {
  id: string;
  office: string;
  link: string;
  active: boolean;
}

/** What the registrar's records say about one student, read before the decision and passed in. */
export interface StudentFacts {
  id: string;
  holds: readonly Hold[];
  /** Course codes passed, for prerequisites. */
  completed: readonly string[];
  /** The student's own time ticket, when the school staggers opening. */
  ticketAt?: string | null;
}

export interface Override {
  id: string;
  student: string;
  section: string;
  waives: readonly OverrideKind[];
  reason: string;
  by: string;
  at: string;
}

/**
 * Whether registration changes may happen at all for this school: the
 * `writeback.registration_submit` tenant state and every kill switch row that
 * could apply. Read by the caller; the decision never reads a clock, a
 * database or the network.
 */
export interface Gate {
  tenantId: string;
  flag: FeatureState;
  killSwitches: readonly KillSwitchRow[];
}

export interface AuditEvent {
  seq: number;
  at: string;
  actor: string;
  student: string;
  section: string;
  action: Outcome | 'promoted' | 'promotion_skipped';
  reason: Reason;
}

/** Every mutation carries a key. The same key and the same request is the same answer, once. */
export type Request =
  | { kind: 'enroll'; key: string; student: string; section: string; expect?: 'seat' | 'waitlist' }
  | { kind: 'drop'; key: string; student: string; section: string }
  | { kind: 'withdraw'; key: string; student: string; section: string }
  | { kind: 'override'; key: string; registrar: string; student: string; section: string; waives: readonly OverrideKind[]; reason: string }
  | { kind: 'decide'; key: string; registrar: string; student: string; section: string; approve: boolean; reason: string };

export interface Processed {
  fingerprint: string;
  decision: Decision;
}

export interface Ledger {
  terms: Readonly<Record<string, TermWindow>>;
  sections: Readonly<Record<string, Section>>;
  enrollments: readonly Enrollment[];
  overrides: readonly Override[];
  /** Monotonic: waitlist order, enrollment ids and audit order all come from it. */
  seq: number;
  /** Committed requests by `actor + key`. Refusals are not kept, so a refused request may be retried under its key. */
  processed: Readonly<Record<string, Processed>>;
  audit: readonly AuditEvent[];
}

export interface Context {
  now: Date;
  gate: Gate;
  students: Readonly<Record<string, StudentFacts>>;
  /** Accounts holding `registration:administer` at this school, verified by the caller. */
  registrars: readonly string[];
}

export type Outcome =
  | 'enrolled'
  | 'waitlisted'
  | 'pending_approval'
  | 'dropped'
  | 'left_waitlist'
  | 'withdrawn'
  | 'override_granted'
  | 'denied'
  | 'refused';

export type Reason =
  | 'ok'
  | 'kill_switch'
  | 'flag_off'
  | 'bad_request'
  | 'idempotency_conflict'
  | 'unknown_section'
  | 'unknown_term'
  | 'unknown_student'
  | 'not_registrar'
  | 'window_not_open'
  | 'window_closed'
  | 'hold'
  | 'already_enrolled'
  | 'already_waitlisted'
  | 'already_pending'
  | 'prerequisite_missing'
  | 'time_conflict'
  | 'credit_limit'
  | 'full'
  | 'stale_seat_count'
  | 'approval_required'
  | 'not_enrolled'
  | 'not_pending'
  | 'drop_deadline_passed'
  | 'withdraw_not_yet'
  | 'withdraw_deadline_passed'
  | 'bad_override';

export interface Decision {
  ok: boolean;
  outcome: Outcome;
  reason: Reason;
  /** A sentence the student or registrar can act on. Never a hold's reason. */
  message: string;
  /** True when this is the stored answer to a request already committed. */
  replayed: boolean;
  enrollment?: Enrollment;
  /** One-based, when waitlisted. */
  waitPosition?: number;
  seatsTaken?: number;
  capacity?: number;
  /** Where to resolve a hold: the office and its link, never why. */
  hold?: { office: string; link: string };
  /**
   * How many waiting students this request moved into a seat. A count, not
   * who: the student who dropped is told a seat went on, never whose it was
   * or why somebody ahead was passed over. The registrar reads those in the
   * audit.
   */
  promoted: number;
}

export interface Result {
  decision: Decision;
  ledger: Ledger;
}
