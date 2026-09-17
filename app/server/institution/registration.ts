import { Refusal } from '../../../packages/institution/src/index.ts';
import type { ActionInput, Receipt, UniversityRecord } from '../../../packages/institution/src/index.ts';
import type { AdapterContext, InstitutionAdapter } from './adapter.ts';
import {
  SANDBOX_INSTITUTION,
  SANDBOX_MARK,
  already,
  connection,
  isStudent,
  matching,
  page,
  type Enrolment,
  type SandboxStore,
  type Section,
} from './sandbox.ts';

/**
 * Course registration, against the sandbox, as a labelled demonstration.
 *
 * The build-out plan's Phase 3 opens with this and calls it "the transactional
 * standard's first full application" — live seats, prerequisite and hold
 * checks, real enrolment submission, waitlists, add/drop. Phase 3 is gated in
 * that document on a pilot and an institutional partnership, and this does not
 * change that: **nothing here touches a registrar**. What it demonstrates is
 * the shape the real thing would have, against a sandbox that says so on every
 * record it produces.
 *
 * ## Why registration is the right thing to demonstrate first
 *
 * Because it is the first part of a university that is genuinely a
 * *transaction*. Reading a bill is a query. Submitting coursework is a write
 * nobody competes for. A seat is finite: two people can want the last one and
 * only one can have it, and everything hard about institutional software lives
 * in that sentence. The two-phase prepare/commit the gateway already enforces
 * exists for exactly this, and here it is carrying something that can actually
 * be lost.
 *
 * ## Five refusals, and each one is a real registrar's
 *
 *  1. **A hold on the account.** A registrar will not let somebody enrol with
 *     an unpaid bill or an unsigned form, and the refusal names which.
 *  2. **A prerequisite not met.** Checked against what this student has
 *     actually passed here, not against what they say.
 *  3. **Add/drop closed.** A date, in the section, in the past.
 *  4. **No seat.** Which is not a refusal at all but a redirection — the
 *     waitlist — and the difference is the point of it.
 *  5. **A clash**, or enrolling twice in the same section.
 *
 * ## The seat is taken at commit, never at prepare
 *
 * `sandbox.ts`'s header already argues this and it matters most here: a review
 * that reserved a seat would mean somebody who read the confirmation and
 * walked away had taken a seat from somebody who would have used it. So
 * `review` re-reads the seat count and says what it currently is, `execute`
 * checks again, and the window between them is where a waitlist comes from.
 */

/** Which of the registry's rules this person is currently failing. */
export interface Holds {
  reasons: string[];
}

/**
 * Whether the registry is holding this account.
 *
 * Read from the settings table so a demonstration can put one on and take it
 * off, rather than being a constant that makes the refusal unreachable.
 */
export function holdsOn(store: SandboxStore, student: string): string[] {
  const raw = store.setting(`hold:${student}`);
  if (!raw) return [];
  return raw
    .split('|')
    .map((r: string) => r.trim())
    .filter(Boolean);
}

/** The codes this student has passed here, for the prerequisite check. */
export function passed(store: SandboxStore, student: string): string[] {
  const done = new Set<string>();
  for (const e of store.enrolmentsOf(student)) {
    if (e.state !== 'enrolled') continue;
    const section = store.section(e.section);
    // An enrolment in progress is not a pass. The sandbox has no term end, so
    // "passed" is recorded deliberately by faculty rather than inferred from
    // time — see the `pass` action below. Anything else would make the
    // prerequisite check quietly true for everybody after a while.
    if (section && store.setting(`passed:${student}:${section.code}`) === 'yes') done.add(section.code);
  }
  // A pass can also be recorded for a course the student never enrolled in
  // here — transfer credit, in a real registry.
  for (const code of (store.setting(`passed:${student}`) ?? '').split('|')) {
    if (code.trim()) done.add(code.trim());
  }
  return [...done];
}

/** How many seats are currently held, counted rather than stored. */
export const taken = (store: SandboxStore, section: string): number =>
  store.enrolments(section).filter((e) => e.state === 'enrolled').length;

/** Where in the queue somebody is, one-based, or 0 when they are not in it. */
export function waitingAt(store: SandboxStore, section: string, student: string): number {
  const queue = store
    .enrolments(section)
    .filter((e) => e.state === 'waiting')
    .sort((a, b) => (a.at < b.at ? -1 : 1));
  return queue.findIndex((e) => e.student === student) + 1;
}

const day = (at: Date) => at.toISOString().slice(0, 10);

/** Whether add/drop has closed for this section. */
export const shut = (section: Section, now: Date) => day(now) > section.until;

const idFor = (student: string, section: string) => `${section}::${student}`;

const mine = (store: SandboxStore, student: string, section: string): Enrolment | null =>
  store.enrolments(section).find((e) => e.student === student) ?? null;

/**
 * One section, as a student reads it.
 *
 * The seat line is the interesting part and it says three different things:
 * how many are left, whether this person holds one, and where they are in the
 * queue if they do not. A registry that says only "full" leaves somebody
 * refreshing.
 */
export function sectionRecord(store: SandboxStore, section: Section, student: string, now: Date): UniversityRecord {
  const held = taken(store, section.id);
  const left = Math.max(0, section.seats - held);
  const ours = mine(store, student, section.id);
  const queue = store.enrolments(section.id).filter((e) => e.state === 'waiting').length;
  const place = waitingAt(store, section.id, student);
  const closed = shut(section, now);

  const state = ours?.state === 'enrolled' ? 'Enrolled' : ours?.state === 'waiting' ? `Waiting · ${place} in the queue` : closed ? 'Add/drop closed' : left > 0 ? `${left} of ${section.seats} seats left` : 'Full';

  return {
    id: section.id,
    area: 'registration',
    title: `${SANDBOX_MARK} · ${section.code} — ${section.title}`,
    summary: `${section.when} · ${section.teacher} · ${section.credits} credits`,
    status: state,
    // The version is what the seat count and this person's own state add up
    // to, so a review prepared when a seat was free is refused once it is not.
    version: `${held}:${queue}:${ours?.version ?? 0}`,
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'Section', value: section.id },
      { label: 'Meets', value: section.when },
      { label: 'Taught by', value: section.teacher },
      { label: 'Credits', value: String(section.credits) },
      { label: 'Seats', value: `${held} of ${section.seats} taken` },
      ...(queue > 0 ? [{ label: 'Waiting', value: `${queue}` }] : []),
      ...(section.needs.length ? [{ label: 'Needs first', value: section.needs.join(', ') }] : []),
      { label: 'Add/drop until', value: section.until },
      ...(ours
        ? [
            { label: 'You', value: ours.state === 'enrolled' ? 'Enrolled' : ours.state === 'waiting' ? `Waiting, ${place} in the queue` : 'Dropped' },
            ...ours.history.map((h) => ({ label: h.at.slice(0, 16).replace('T', ' '), value: `${h.what} — ${h.who}` })),
          ]
        : []),
    ],
    /*
     * Machine-readable beside the display string, for the same reason
     * `UniversityRecord.dates` exists at all: a student's calendar should hold
     * the add/drop deadline as a date rather than as a sentence somebody has
     * to parse back.
     */
    dates: [{ at: `${section.until}T23:59:59.000Z`, what: `${section.code} — last day to add or drop` }],
    actions: closed
      ? []
      : ours?.state === 'enrolled'
        ? [{ id: 'drop', label: 'Drop this section', fields: [] }]
        : ours?.state === 'waiting'
          ? [{ id: 'leave', label: 'Leave the waiting list', fields: [] }]
          : left > 0
            ? [{ id: 'enrol', label: 'Enrol', fields: [] }]
            : [{ id: 'wait', label: 'Join the waiting list', fields: [] }],
  };
}

/** The refusals, in the order a registrar applies them. */
function checked(store: SandboxStore, context: AdapterContext, section: Section, actionId: string, now: Date): void {
  if (!isStudent(context)) throw new Refusal('Only a student can change their own registration.');

  if (shut(section, now)) {
    throw new Refusal(`Add/drop for ${section.code} closed on ${section.until}. Ask an advisor.`);
  }

  // Leaving never needs a hold cleared or a prerequisite met: somebody under a
  // hold must still be able to get out of a queue they are in.
  if (actionId === 'drop' || actionId === 'leave') return;

  const holds = holdsOn(store, context.identity.userId);
  if (holds.length) {
    throw new Refusal(
      `There is a hold on your account: ${holds.join('; ')}. Registration is blocked until it is cleared.`,
    );
  }

  const has = passed(store, context.identity.userId);
  const missing = section.needs.filter((code) => !has.includes(code));
  if (missing.length) {
    throw new Refusal(`${section.code} needs ${missing.join(' and ')} first, and that is not recorded here yet.`);
  }

  const ours = mine(store, context.identity.userId, section.id);
  if (ours?.state === 'enrolled') throw new Refusal(`You are already enrolled in ${section.code}.`);
  if (ours?.state === 'waiting' && actionId === 'wait') {
    throw new Refusal(`You are already on the waiting list for ${section.code}.`);
  }

  /*
   * A clash. Checked against what this student already holds rather than
   * against the timetable in the abstract, and it refuses rather than warns —
   * a registry that lets somebody enrol in two things at once has produced a
   * record that cannot be true.
   */
  if (actionId === 'enrol') {
    for (const e of store.enrolmentsOf(context.identity.userId)) {
      if (e.state !== 'enrolled') continue;
      const other = store.section(e.section);
      if (other && other.id !== section.id && other.when === section.when) {
        throw new Refusal(`That clashes with ${other.code}, which meets at the same time.`);
      }
    }
  }
}

/** The seat check, made twice: once for the review, once for the commit. */
function seatFor(store: SandboxStore, section: Section, actionId: string): void {
  const left = section.seats - taken(store, section.id);
  if (actionId === 'enrol' && left <= 0) {
    throw new Refusal(`${section.code} filled while you were reading. The waiting list is open.`);
  }
  if (actionId === 'wait' && left > 0) {
    throw new Refusal(`A seat opened in ${section.code} while you were reading. Enrol instead.`);
  }
}

const commitRow = (
  store: SandboxStore,
  row: Enrolment,
  key: string,
  who: string,
  what: string,
  at: string,
  change: (e: Enrolment) => void,
): Receipt => {
  change(row);
  row.version += 1;
  row.history.push({ at, who, what, receipt: key });
  store.saveEnrolment(row);
  const receipt: Receipt = {
    id: key,
    status: 'completed',
    message: `${SANDBOX_MARK} · ${what}. No seat here is a seat at any real institution.`,
    recordedAt: at,
  };
  store.keep(receipt);
  return receipt;
};

/**
 * Whoever is next, given a seat.
 *
 * Called when somebody drops. The queue is by the moment each person joined
 * it, and the person promoted is told in their own record rather than by a
 * message this demonstration has no way to send.
 */
function promote(store: SandboxStore, section: Section, at: string, key: string): Enrolment | null {
  if (section.seats - taken(store, section.id) <= 0) return null;
  const next = store
    .enrolments(section.id)
    .filter((e) => e.state === 'waiting')
    .sort((a, b) => (a.at < b.at ? -1 : 1))[0];
  if (!next) return null;
  next.state = 'enrolled';
  next.version += 1;
  next.history.push({ at, who: 'registry', what: 'A seat opened and the waiting list moved', receipt: key });
  store.saveEnrolment(next);
  return next;
}

export function registrationAdapter(store: SandboxStore, clock: () => Date = () => new Date()): InstitutionAdapter {
  const sectionOr = (id: string): Section => {
    const section = store.section(id);
    if (!section) throw new Refusal('No such section in the sandbox registry.');
    return section;
  };

  const adapter: InstitutionAdapter = {
    area: 'registration',
    institutionId: SANDBOX_INSTITUTION,
    status: async (context) => connection('registration', context, isStudent(context)),
    list: async (context, query) => {
      const now = clock();
      const me = context.identity.userId;
      return page(matching(store.sections().map((t) => sectionRecord(store, t, me, now)), query.search));
    },
    get: async (context, id) => {
      const section = store.section(id);
      return section ? sectionRecord(store, section, context.identity.userId, clock()) : null;
    },
    review: async (context, input) => {
      const now = clock();
      const section = sectionOr(input.recordId);
      checked(store, context, section, input.actionId, now);
      seatFor(store, section, input.actionId);

      const left = section.seats - taken(store, section.id);
      const queue = store.enrolments(section.id).filter((e) => e.state === 'waiting').length;

      if (input.actionId === 'enrol') {
        return {
          title: `Enrol in ${section.code}`,
          details: [
            { label: 'Section', value: `${section.code} — ${section.title}` },
            { label: 'Meets', value: section.when },
            { label: 'Seats left now', value: String(left) },
            { label: 'After this', value: `${left - 1} left. You can drop until ${section.until}.` },
          ],
        };
      }
      if (input.actionId === 'wait') {
        return {
          title: `Join the waiting list for ${section.code}`,
          details: [
            { label: 'Section', value: `${section.code} — ${section.title}` },
            { label: 'Ahead of you', value: String(queue) },
            { label: 'After this', value: 'A waiting list place is not a seat. You are told if one opens.' },
          ],
        };
      }
      if (input.actionId === 'drop') {
        return {
          title: `Drop ${section.code}`,
          details: [
            { label: 'Section', value: `${section.code} — ${section.title}` },
            { label: 'Waiting for it', value: String(queue) },
            {
              label: 'After this',
              value: queue > 0 ? 'Your seat goes to whoever is first in the queue.' : 'The seat goes back to the pool.',
            },
          ],
        };
      }
      return {
        title: `Leave the waiting list for ${section.code}`,
        details: [
          { label: 'Section', value: `${section.code} — ${section.title}` },
          { label: 'After this', value: 'You lose your place. Re-joining puts you at the back.' },
        ],
      };
    },
    execute: async (context: AdapterContext, input: ActionInput, key: string) => {
      const done = already(store, key);
      if (done) return done;

      const now = clock();
      const at = now.toISOString();
      const section = sectionOr(input.recordId);
      checked(store, context, section, input.actionId, now);
      // Again, because the review is not a reservation. This is the check that
      // makes the last seat go to one person.
      seatFor(store, section, input.actionId);

      const me = context.identity.userId;
      const row: Enrolment = mine(store, me, section.id) ?? {
        id: idFor(me, section.id),
        student: me,
        section: section.id,
        state: 'dropped',
        at,
        version: 0,
        history: [],
      };

      if (input.actionId === 'enrol') {
        return commitRow(store, row, key, me, `Enrolled in ${section.code}`, at, (e) => {
          e.state = 'enrolled';
          e.at = at;
        });
      }
      if (input.actionId === 'wait') {
        return commitRow(store, row, key, me, `Joined the waiting list for ${section.code}`, at, (e) => {
          e.state = 'waiting';
          e.at = at;
        });
      }
      if (input.actionId === 'leave') {
        return commitRow(store, row, key, me, `Left the waiting list for ${section.code}`, at, (e) => {
          e.state = 'dropped';
        });
      }

      if (row.state !== 'enrolled') throw new Refusal(`You are not enrolled in ${section.code}.`);
      const receipt = commitRow(store, row, key, me, `Dropped ${section.code}`, at, (e) => {
        e.state = 'dropped';
      });
      // The seat is free now, so the queue moves — inside the same commit, so
      // a seat cannot sit empty with somebody waiting for it.
      const moved = promote(store, section, at, key);
      if (moved) {
        const said: Receipt = {
          ...receipt,
          message: `${receipt.message} A waiting place was promoted.`,
        };
        store.keep(said);
        return said;
      }
      return receipt;
    },
    reconcile: async (_context: AdapterContext, _input: ActionInput, key: string) => store.receipt(key),
  };
  return adapter;
}
