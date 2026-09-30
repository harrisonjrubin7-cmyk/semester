import { fingerprint } from '../conflicts';
import { flagDefinition, type KillSwitchKey } from '../flags';
import { conflicts, type CatalogCourse } from '../registration';
import {
  LIVE_STATES,
  OVERRIDE_KINDS,
  type AuditEvent,
  type Context,
  type Decision,
  type Enrollment,
  type EnrollmentState,
  type Ledger,
  type Outcome,
  type OverrideKind,
  type Reason,
  type Request,
  type Result,
  type Section,
  type StudentFacts,
  type TermWindow,
} from './model';

/**
 * The official registration transaction, as a pure function of a ledger, a
 * request and a context.
 *
 * `submit` is the only way anything changes. It reads no clock (`ctx.now`),
 * no database and no network, so every refusal a registrar applies can be
 * tested by constructing the moment it happens. Every call returns a
 * `Decision` with a reason code, including the ones that succeed, and a
 * refusal returns the ledger it was given — nothing half-applied.
 *
 * ## The order of the checks is the answer
 *
 * The first check that says no is the reason given. Stopped (kill switch)
 * outranks off (flag), which outranks everything about the student, because a
 * student told "your prerequisite is missing" while registration is switched
 * off would go and fix the wrong thing. Among the student's own blockers the
 * order is a registrar's: window, hold, duplicate, prerequisite, clash,
 * credit load, then seats.
 *
 * ## The seat is taken at commit, never at review
 *
 * `review` is `submit` with the ledger thrown away. A student who reviewed a
 * seat and confirmed sends `expect: 'seat'`; if the last seat went in
 * between, the answer is `stale_seat_count` and nothing is written, rather
 * than a waitlist place they did not agree to. That is the two-step
 * confirmation the flag's rollout line asks for.
 *
 * ## Idempotency
 *
 * Every request carries a key. A committed request is stored under its actor
 * and key with a fingerprint of everything else in it: the same key and the
 * same request replays the stored decision (`replayed: true`) and changes
 * nothing; the same key and a different request is `idempotency_conflict`.
 * Refusals are not stored, so a request refused for a hold can be retried
 * under the same key once the hold is cleared.
 */

/** The flag this whole module sits behind. */
export const FLAG = 'writeback.registration_submit';

/** The switches that stop it: the registry's own list, not a second copy. */
export const STOPPED_BY: readonly KillSwitchKey[] = flagDefinition(FLAG)?.killSwitches ?? ['kill.writeback'];

const KEY = /^[A-Za-z0-9:_.-]{8,128}$/;

export const EMPTY_LEDGER: Ledger = {
  terms: {},
  sections: {},
  enrollments: [],
  overrides: [],
  seq: 0,
  processed: {},
  audit: [],
};

// ── Reading the ledger ──────────────────────────────────────────────────

const at = (iso: string) => Date.parse(iso);
const isLive = (s: EnrollmentState) => LIVE_STATES.includes(s);

/** Seats held: enrolled rows, counted rather than stored, so the count cannot drift from the rows. */
export const seatsTaken = (ledger: Ledger, section: string): number =>
  ledger.enrollments.filter((e) => e.section === section && e.state === 'enrolled').length;

/** The waitlist, in the order it will be served. */
export const waitlist = (ledger: Ledger, section: string): Enrollment[] =>
  ledger.enrollments
    .filter((e) => e.section === section && e.state === 'waitlisted')
    .sort((a, b) => (a.waitSeq ?? 0) - (b.waitSeq ?? 0));

/** One-based place in the queue, or 0 when not in it. */
export const waitPosition = (ledger: Ledger, section: string, student: string): number =>
  waitlist(ledger, section).findIndex((e) => e.student === student) + 1;

const liveRow = (ledger: Ledger, student: string, section: string) =>
  ledger.enrollments.find((e) => e.student === student && e.section === section && isLive(e.state));

const waived = (ledger: Ledger, student: string, section: string, kind: OverrideKind) =>
  ledger.overrides.some((o) => o.student === student && o.section === section && o.waives.includes(kind));

/** The sections this student holds a seat in, in the same term. */
function heldInTerm(ledger: Ledger, student: string, term: string, except?: string): Section[] {
  return ledger.enrollments
    .filter((e) => e.student === student && e.state === 'enrolled' && e.section !== except)
    .map((e) => ledger.sections[e.section])
    .filter((s): s is Section => !!s && s.term === term);
}

// ── The gate ────────────────────────────────────────────────────────────

/** Whether registration changes may happen at all. Stopped outranks off. */
export function gateReason(ctx: Context): Reason | null {
  const { gate } = ctx;
  for (const sw of gate.killSwitches) {
    if (!sw.engaged) continue;
    if (sw.tenantId !== null && sw.tenantId !== gate.tenantId) continue;
    if ((STOPPED_BY as readonly string[]).includes(sw.key)) return 'kill_switch';
  }
  // The server reads `feature_state(...) <> 'production'` as off, the way the
  // grade passback gate does; this reads the same.
  if (gate.flag !== 'production') return 'flag_off';
  return null;
}

// ── The student's blockers, in a registrar's order ──────────────────────

/**
 * What stands between this student and a seat in this section, other than
 * the seat itself. Shared by enroll, approval and waitlist promotion so the
 * three can never disagree about who may have a seat.
 */
function blocker(
  ledger: Ledger,
  facts: StudentFacts,
  section: Section,
  term: TermWindow,
  now: Date,
  opts: { window: boolean; ignoreRow?: string },
): Reason | null {
  const t = now.getTime();
  if (opts.window) {
    const opens = Math.max(at(term.opensAt), facts.ticketAt ? at(facts.ticketAt) : -Infinity);
    if (t < opens) return 'window_not_open';
    if (t > at(term.addDropEndsAt) && !waived(ledger, facts.id, section.id, 'late_add')) return 'window_closed';
  }
  if (facts.holds.some((h) => h.active)) return 'hold';
  const live = ledger.enrollments.find(
    (e) => e.student === facts.id && e.section === section.id && isLive(e.state) && e.id !== opts.ignoreRow,
  );
  if (live) return live.state === 'enrolled' ? 'already_enrolled' : live.state === 'waitlisted' ? 'already_waitlisted' : 'already_pending';
  const passed = new Set(facts.completed.map((c) => c.trim().toUpperCase()));
  if (
    section.prerequisiteCodes.some((c) => !passed.has(c.trim().toUpperCase())) &&
    !waived(ledger, facts.id, section.id, 'prerequisite')
  ) {
    return 'prerequisite_missing';
  }
  const held = heldInTerm(ledger, facts.id, section.term, section.id);
  // `conflicts` is the planner's own clash test (`lib/registration.ts`): the
  // cart and the registrar agree on what overlapping means.
  const clash = conflicts([section as CatalogCourse, ...held]).some((p) => p.a.id === section.id || p.b.id === section.id);
  if (clash && !waived(ledger, facts.id, section.id, 'time_conflict')) return 'time_conflict';
  const load = held.reduce((n, s) => n + s.credits, 0) + section.credits;
  if (load > term.maxCredits && !waived(ledger, facts.id, section.id, 'credit_limit')) return 'credit_limit';
  return null;
}

// ── Messages ────────────────────────────────────────────────────────────

function message(reason: Reason, s?: Section, term?: TermWindow, extra = ''): string {
  const what = s ? `${s.code} ${s.section}` : 'that section';
  switch (reason) {
    case 'ok':
      return extra;
    case 'kill_switch':
      return 'Registration changes are stopped by a kill switch right now. Nothing was changed.';
    case 'flag_off':
      return 'Registration through Semester is not turned on for this school. Nothing was changed.';
    case 'bad_request':
      return 'The request needs an idempotency key of 8 to 128 letters, digits or : _ . - and a section.';
    case 'idempotency_conflict':
      return 'That idempotency key was already used for a different request. Nothing was changed.';
    case 'unknown_section':
      return 'No such section this term.';
    case 'unknown_term':
      return 'That section’s term has no registration calendar yet.';
    case 'unknown_student':
      return 'The registrar has no record for this student.';
    case 'not_registrar':
      return 'Only the registrar can do that.';
    case 'window_not_open':
      return `Registration for ${what} is not open for you yet.`;
    case 'window_closed':
      return `Add/drop for ${what} closed ${term?.addDropEndsAt.slice(0, 10) ?? ''}. Ask the registrar about a late add.`;
    case 'hold':
      // The office and its link only. The reason is not known here and is
      // never asked for.
      return 'A hold on your account blocks registration. The office that placed it can clear it.';
    case 'already_enrolled':
      return `You are already enrolled in ${what}.`;
    case 'already_waitlisted':
      return `You are already on the waitlist for ${what}.`;
    case 'already_pending':
      return `Your request for ${what} is already waiting for approval.`;
    case 'prerequisite_missing':
      return `${what} needs ${s?.prerequisiteCodes.join(', ') ?? 'a prerequisite'} first.`;
    case 'time_conflict':
      return `${what} meets at the same time as a section you are enrolled in.`;
    case 'credit_limit':
      return `${what} would take you over ${term?.maxCredits ?? 'the'} credits this term.`;
    case 'full':
      return `${what} is full and its waitlist is full.`;
    case 'stale_seat_count':
      return `The seats in ${what} changed since you reviewed it. ${extra} Review it again; nothing was changed.`;
    case 'approval_required':
      return `${what} needs the registrar’s approval.`;
    case 'not_enrolled':
      return `You are not enrolled or waiting in ${what}.`;
    case 'not_pending':
      return `No request for ${what} is waiting for approval.`;
    case 'drop_deadline_passed':
      return `The add/drop deadline for ${what} has passed. You can withdraw instead, which records a W.`;
    case 'withdraw_not_yet':
      return `Add/drop is still open for ${what}: drop it instead, and no W is recorded.`;
    case 'withdraw_deadline_passed':
      return `The withdrawal deadline for ${what} has passed. Ask the registrar.`;
    case 'bad_override':
      return `An override needs a reason and names only ${OVERRIDE_KINDS.join(', ')}. A hold cannot be overridden here.`;
  }
}

// ── Building answers ────────────────────────────────────────────────────

const refuse = (ledger: Ledger, reason: Reason, s?: Section, term?: TermWindow, extra = '', hold?: Decision['hold']): Result => ({
  ledger,
  decision: { ok: false, outcome: 'refused', reason, message: message(reason, s, term, extra), replayed: false, promoted: 0, ...(hold ? { hold } : {}) },
});

const actorOf = (r: Request) => (r.kind === 'override' || r.kind === 'decide' ? r.registrar : r.student);
const slot = (r: Request) => `${actorOf(r)}\u0000${r.key}`;
const printOf = (r: Request) => fingerprint({ ...r, key: undefined });

function put(ledger: Ledger, row: Enrollment): Ledger {
  const i = ledger.enrollments.findIndex((e) => e.id === row.id);
  const enrollments = i < 0 ? [...ledger.enrollments, row] : ledger.enrollments.map((e, j) => (j === i ? row : e));
  return { ...ledger, enrollments };
}

function audit(ledger: Ledger, now: Date, actor: string, student: string, section: string, action: AuditEvent['action'], reason: Reason): Ledger {
  const seq = ledger.seq + 1;
  return { ...ledger, seq, audit: [...ledger.audit, { seq, at: now.toISOString(), actor, student, section, action, reason }] };
}

function move(ledger: Ledger, row: Enrollment, state: EnrollmentState, now: Date, waitSeq: number | null = row.waitSeq): Ledger {
  return put(ledger, {
    ...row,
    state,
    waitSeq: state === 'waitlisted' ? waitSeq : null,
    grade: state === 'withdrawn' ? 'W' : null,
    version: row.version + 1,
    updatedAt: now.toISOString(),
  });
}

function created(ledger: Ledger, student: string, section: string, state: EnrollmentState, now: Date): [Ledger, Enrollment] {
  const seq = ledger.seq + 1;
  const row: Enrollment = {
    id: `enr-${seq}`,
    student,
    section,
    state,
    waitSeq: state === 'waitlisted' ? seq : null,
    grade: null,
    version: 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  return [put({ ...ledger, seq }, row), row];
}

function done(ledger: Ledger, outcome: Outcome, row: Enrollment | undefined, s: Section | undefined, text: string, extra: Partial<Decision> = {}): Decision {
  return {
    ok: true,
    outcome,
    reason: 'ok',
    message: text,
    replayed: false,
    ...(row ? { enrollment: ledger.enrollments.find((e) => e.id === row.id) ?? row } : {}),
    ...(s ? { seatsTaken: seatsTaken(ledger, s.id), capacity: s.capacity } : {}),
    ...(row && s && ledger.enrollments.find((e) => e.id === row.id)?.state === 'waitlisted' ? { waitPosition: waitPosition(ledger, s.id, row.student) } : {}),
    promoted: 0,
    ...extra,
  };
}

// ── Promotion ───────────────────────────────────────────────────────────

/**
 * Fill free seats from the waitlist, in order.
 *
 * A student at the head who is now blocked — a hold that appeared, a clash
 * with something they enrolled in since, the credit ceiling — is passed over
 * for this seat and keeps their place; the reason is returned so the office
 * can see why the queue skipped. A student the context has no facts for is
 * passed over too: promotion fails closed.
 *
 * Nothing moves when the gate is shut or add/drop has closed: a waitlist is
 * dead after the deadline, and a seat freed by a withdrawal is not re-sold.
 */
export function promote(ledger: Ledger, sectionId: string, ctx: Context, actor: string): { ledger: Ledger; promoted: string[]; skipped: { student: string; reason: Reason }[] } {
  const s = ledger.sections[sectionId];
  const term = s ? ledger.terms[s.term] : undefined;
  const promoted: string[] = [];
  const skipped: { student: string; reason: Reason }[] = [];
  if (!s || !term || gateReason(ctx) || ctx.now.getTime() > at(term.addDropEndsAt)) return { ledger, promoted, skipped };
  let next = ledger;
  for (const row of waitlist(ledger, sectionId)) {
    if (seatsTaken(next, sectionId) >= s.capacity) break;
    const facts = ctx.students[row.student];
    const why: Reason | null = facts ? blocker(next, facts, s, term, ctx.now, { window: false, ignoreRow: row.id }) : 'unknown_student';
    if (why) {
      skipped.push({ student: row.student, reason: why });
      next = audit(next, ctx.now, actor, row.student, sectionId, 'promotion_skipped', why);
      continue;
    }
    next = move(next, row, 'enrolled', ctx.now);
    next = audit(next, ctx.now, actor, row.student, sectionId, 'promoted', 'ok');
    promoted.push(row.id);
  }
  return { ledger: next, promoted, skipped };
}

// ── The five requests ───────────────────────────────────────────────────

/** Where a student who has cleared every blocker lands: a seat, the waitlist, or nowhere. */
function placement(ledger: Ledger, student: string, s: Section): 'seat' | 'waitlist' | 'full' {
  if (seatsTaken(ledger, s.id) < s.capacity || waived(ledger, student, s.id, 'capacity')) return 'seat';
  if (waitlist(ledger, s.id).length < s.waitlistCapacity) return 'waitlist';
  return 'full';
}

function enroll(ledger: Ledger, r: Extract<Request, { kind: 'enroll' }>, s: Section, term: TermWindow, ctx: Context): Result {
  const facts = ctx.students[r.student];
  if (!facts) return refuse(ledger, 'unknown_student', s, term);
  const why = blocker(ledger, facts, s, term, ctx.now, { window: true });
  if (why) {
    const hold = why === 'hold' ? facts.holds.find((h) => h.active) : undefined;
    return refuse(ledger, why, s, term, '', hold ? { office: hold.office, link: hold.link } : undefined);
  }
  if (s.requiresApproval && !waived(ledger, r.student, s.id, 'approval')) {
    const [next, row] = created(ledger, r.student, s.id, 'pending_approval', ctx.now);
    const logged = audit(next, ctx.now, r.student, r.student, s.id, 'pending_approval', 'approval_required');
    return { ledger: logged, decision: done(logged, 'pending_approval', row, s, message('approval_required', s)) };
  }
  const where = placement(ledger, r.student, s);
  if (where === 'full') return refuse(ledger, 'full', s, term);
  if (r.expect && r.expect !== where) {
    const now = where === 'seat' ? 'A seat is open now.' : `It is full now; ${waitlist(ledger, s.id).length} are waiting.`;
    return refuse(ledger, 'stale_seat_count', s, term, now);
  }
  const state = where === 'seat' ? 'enrolled' : 'waitlisted';
  const [next, row] = created(ledger, r.student, s.id, state, ctx.now);
  const logged = audit(next, ctx.now, r.student, r.student, s.id, state, 'ok');
  const text = state === 'enrolled' ? `Enrolled in ${s.code} ${s.section}.` : `On the waitlist for ${s.code} ${s.section}, place ${waitPosition(logged, s.id, r.student)}.`;
  return { ledger: logged, decision: done(logged, state, row, s, text) };
}

function drop(ledger: Ledger, r: Extract<Request, { kind: 'drop' }>, s: Section, term: TermWindow, ctx: Context): Result {
  const row = liveRow(ledger, r.student, s.id);
  if (!row) return refuse(ledger, 'not_enrolled', s, term);
  // Leaving a queue or withdrawing a request never needs a hold cleared: a
  // student under a hold must still be able to get out of something.
  if (row.state !== 'enrolled') {
    const state = row.state === 'waitlisted' ? 'left_waitlist' : 'dropped';
    const next = audit(move(ledger, row, state, ctx.now), ctx.now, r.student, r.student, s.id, state, 'ok');
    return { ledger: next, decision: done(next, state, row, s, state === 'left_waitlist' ? `Left the waitlist for ${s.code} ${s.section}.` : `Withdrew the request for ${s.code} ${s.section}.`) };
  }
  if (ctx.now.getTime() > at(term.addDropEndsAt)) return refuse(ledger, 'drop_deadline_passed', s, term);
  const dropped = audit(move(ledger, row, 'dropped', ctx.now), ctx.now, r.student, r.student, s.id, 'dropped', 'ok');
  const p = promote(dropped, s.id, ctx, r.student);
  return { ledger: p.ledger, decision: done(p.ledger, 'dropped', row, s, `Dropped ${s.code} ${s.section}. Nothing is recorded on your transcript.`, { promoted: p.promoted.length }) };
}

function withdraw(ledger: Ledger, r: Extract<Request, { kind: 'withdraw' }>, s: Section, term: TermWindow, ctx: Context): Result {
  const row = liveRow(ledger, r.student, s.id);
  if (!row || row.state !== 'enrolled') return refuse(ledger, 'not_enrolled', s, term);
  const t = ctx.now.getTime();
  if (t <= at(term.addDropEndsAt)) return refuse(ledger, 'withdraw_not_yet', s, term);
  if (t > at(term.withdrawEndsAt)) return refuse(ledger, 'withdraw_deadline_passed', s, term);
  const next = audit(move(ledger, row, 'withdrawn', ctx.now), ctx.now, r.student, r.student, s.id, 'withdrawn', 'ok');
  return { ledger: next, decision: done(next, 'withdrawn', row, s, `Withdrew from ${s.code} ${s.section}. A W is recorded; the enrollment is kept.`) };
}

function override(ledger: Ledger, r: Extract<Request, { kind: 'override' }>, s: Section, term: TermWindow, ctx: Context): Result {
  if (!ctx.registrars.includes(r.registrar)) return refuse(ledger, 'not_registrar', s, term);
  const kinds = [...new Set(r.waives)];
  if (!kinds.length || kinds.some((k) => !OVERRIDE_KINDS.includes(k)) || !r.reason.trim()) return refuse(ledger, 'bad_override', s, term);
  const seq = ledger.seq + 1;
  let next: Ledger = {
    ...ledger,
    seq,
    overrides: [...ledger.overrides, { id: `ovr-${seq}`, student: r.student, section: s.id, waives: kinds, reason: r.reason.trim(), by: r.registrar, at: ctx.now.toISOString() }],
  };
  next = audit(next, ctx.now, r.registrar, r.student, s.id, 'override_granted', 'ok');
  // A capacity override for somebody already waiting is a seat for them now,
  // out of turn — that is what the registrar granted.
  const waiting = liveRow(next, r.student, s.id);
  let promoted = 0;
  const facts = ctx.students[r.student];
  if (waiting?.state === 'waitlisted' && kinds.includes('capacity') && facts && !blocker(next, facts, s, term, ctx.now, { window: true, ignoreRow: waiting.id })) {
    next = audit(move(next, waiting, 'enrolled', ctx.now), ctx.now, r.registrar, r.student, s.id, 'promoted', 'ok');
    promoted = 1;
  }
  return { ledger: next, decision: done(next, 'override_granted', waiting, s, `Override recorded: ${kinds.join(', ')}.`, { promoted }) };
}

function decide(ledger: Ledger, r: Extract<Request, { kind: 'decide' }>, s: Section, term: TermWindow, ctx: Context): Result {
  if (!ctx.registrars.includes(r.registrar)) return refuse(ledger, 'not_registrar', s, term);
  const row = liveRow(ledger, r.student, s.id);
  if (!row || row.state !== 'pending_approval') return refuse(ledger, 'not_pending', s, term);
  if (!r.reason.trim()) return refuse(ledger, 'bad_override', s, term);
  if (!r.approve) {
    const next = audit(move(ledger, row, 'denied', ctx.now), ctx.now, r.registrar, r.student, s.id, 'denied', 'ok');
    return { ledger: next, decision: done(next, 'denied', row, s, `The request for ${s.code} ${s.section} was not approved.`) };
  }
  // Approval is re-checked against now, not against when the student asked:
  // a hold or a clash that arrived while it waited still stops it.
  const facts = ctx.students[r.student];
  if (!facts) return refuse(ledger, 'unknown_student', s, term);
  const why = blocker(ledger, facts, s, term, ctx.now, { window: true, ignoreRow: row.id });
  if (why) return refuse(ledger, why, s, term);
  const where = placement(ledger, r.student, s);
  if (where === 'full') return refuse(ledger, 'full', s, term);
  const seq = ledger.seq + 1;
  let next: Ledger = {
    ...ledger,
    seq,
    overrides: [...ledger.overrides, { id: `ovr-${seq}`, student: r.student, section: s.id, waives: ['approval'], reason: r.reason.trim(), by: r.registrar, at: ctx.now.toISOString() }],
  };
  const state = where === 'seat' ? 'enrolled' : 'waitlisted';
  next = move(next, row, state, ctx.now, next.seq + 1);
  next = { ...next, seq: next.seq + 1 };
  next = audit(next, ctx.now, r.registrar, r.student, s.id, state, 'ok');
  return { ledger: next, decision: done(next, state, row, s, state === 'enrolled' ? `Approved and enrolled in ${s.code} ${s.section}.` : `Approved; on the waitlist for ${s.code} ${s.section}.`) };
}

// ── The entry points ────────────────────────────────────────────────────

/** Apply one request. The only way the ledger changes. */
export function submit(ledger: Ledger, r: Request, ctx: Context): Result {
  if (!r || typeof r.key !== 'string' || !KEY.test(r.key) || !r.section || !actorOf(r)) return refuse(ledger, 'bad_request');

  // A retry of something already committed gets its answer back even while
  // the gate is shut: it changes nothing, and a client that lost the first
  // response needs to know the seat is theirs.
  const seen = ledger.processed[slot(r)];
  if (seen) {
    if (seen.fingerprint !== printOf(r)) return refuse(ledger, 'idempotency_conflict');
    return { ledger, decision: { ...seen.decision, replayed: true } };
  }

  const shut = gateReason(ctx);
  if (shut) return refuse(ledger, shut);

  const s = ledger.sections[r.section];
  if (!s) return refuse(ledger, 'unknown_section');
  const term = ledger.terms[s.term];
  if (!term) return refuse(ledger, 'unknown_term', s);

  const result =
    r.kind === 'enroll'
      ? enroll(ledger, r, s, term, ctx)
      : r.kind === 'drop'
        ? drop(ledger, r, s, term, ctx)
        : r.kind === 'withdraw'
          ? withdraw(ledger, r, s, term, ctx)
          : r.kind === 'override'
            ? override(ledger, r, s, term, ctx)
            : decide(ledger, r, s, term, ctx);

  if (!result.decision.ok) return result;
  return {
    decision: result.decision,
    ledger: { ...result.ledger, processed: { ...result.ledger.processed, [slot(r)]: { fingerprint: printOf(r), decision: result.decision } } },
  };
}

/** What `submit` would answer now, with nothing kept. The first of the two steps. */
export const review = (ledger: Ledger, r: Request, ctx: Context): Decision => submit(ledger, r, ctx).decision;

// ── From the planner's cart ─────────────────────────────────────────────

/**
 * The registrar's section for a catalog row. The catalog's `seats` is the
 * capacity unless the registrar says otherwise; a section with no known
 * capacity cannot be enrolled into and is refused here rather than guessed.
 */
export function sectionFrom(
  course: CatalogCourse,
  registrar: { capacity?: number; waitlistCapacity?: number; prerequisiteCodes?: readonly string[]; requiresApproval?: boolean } = {},
): Section {
  const capacity = registrar.capacity ?? course.seats;
  if (capacity === null || capacity === undefined || !Number.isInteger(capacity) || capacity < 0) {
    throw new Error(`${course.code} ${course.section}: the registrar has not set a capacity.`);
  }
  return {
    ...course,
    capacity,
    waitlistCapacity: registrar.waitlistCapacity ?? 0,
    prerequisiteCodes: registrar.prerequisiteCodes ?? [],
    requiresApproval: registrar.requiresApproval ?? false,
  };
}

/**
 * One enroll request per section in the student's cart
 * (`useRegistrationPlan().cart`), each with a key derived from one nonce the
 * client makes once per submission — so a resubmitted cart replays rather
 * than enrolls twice, and a new submission is a new nonce.
 */
export function cartRequests(student: string, cart: readonly CatalogCourse[], nonce: string, expect?: 'seat' | 'waitlist'): Request[] {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(nonce)) throw new Error('The submission nonce must be 6 to 64 letters, digits, _ or -.');
  return cart.map((c) => ({ kind: 'enroll' as const, key: `enr.${nonce}.${fingerprint(c.id)}`, student, section: c.id, ...(expect ? { expect } : {}) }));
}
