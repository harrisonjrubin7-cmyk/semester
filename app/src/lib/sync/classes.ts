/**
 * What may be kept, merged, held or refused when the connection goes.
 *
 * Offline and sync each make a decision per write, and until this file the
 * decisions were scattered across the calls that made them: `requireOnline`
 * at five sites, a merge strategy per field in `lib/merge.ts`, and a rule in
 * a docblock. Here they are in one place with the reason, so a new write has
 * to be put in a class to ship (`classes.test.ts` reads the source and fails
 * on one that was not).
 *
 * ## The classes
 *
 * - **device-only** — never leaves the device. Attached files, this device's
 *   own settings (`mine` in the merge table), the rolling snapshots, the
 *   base and the review list that sync keeps about itself, and the outbox.
 * - **synced** — the student's own working state, saved on the device first
 *   and merged with the account's copy per field. Deletions are settled
 *   against the base (`lib/deletions.ts`), a record edited on two devices is
 *   offered as a choice (`lib/conflicts.ts`), and none of it is ever sent
 *   anywhere but the student's own account.
 * - **held-send** — an outward action about the student's own material that
 *   can be saved offline and sent by them later, one tap, never by itself
 *   (`lib/sync/outbox.ts`).
 * - **online-only** — refused offline, with a sentence saying nothing was sent
 *   and nothing is waiting. Small changes to what a school shows this
 *   student, which a late apply could contradict.
 * - **never-queued** — refused offline and never held: an official or
 *   financial write, an irreversible one, or one made by staff to students.
 *   A held one would fire after the situation it was made in has changed,
 *   and there is no version of that which is safe. Registration, the
 *   gradebook, student accounts, the academic record and billing are in
 *   this class by construction: they do not appear in this table because
 *   they are never reached through the offline path at all, and the test
 *   holds the held kinds' calls to functions that name none of them.
 */

export type WriteClass = 'held-send' | 'online-only' | 'never-queued';

export interface Write {
  /** The file that calls `requireOnline`, relative to `app/src`. */
  file: string;
  /** The `requireOnline` kind it passes. */
  kind: 'share' | 'send' | 'publish' | 'delete' | 'handoff';
  class: WriteClass;
  /** What it does, in the student's words. */
  does: string;
  /** Why it is in this class. */
  why: string;
}

export const WRITES: readonly Write[] = [
  {
    file: 'lib/advisor-shares.ts',
    kind: 'share',
    class: 'held-send',
    does: 'Share a meeting agenda with an advisor',
    why: 'The student’s own material, chosen by them, expiring on its own and deletable from the same screen. Held, not sent: one tap when they are back, and a share that may already have gone is checked first.',
  },
  {
    file: 'lib/course-demand-remote.ts',
    kind: 'send',
    class: 'held-send',
    does: 'Send a course plan to the school’s demand count',
    why: 'Replaces itself at the school, so sending it twice is the same as once, and the student can stop contributing at any time. Counts of ten or more and nobody named, on the school’s side.',
  },
  {
    file: 'lib/office-actions-remote.ts',
    kind: 'send',
    class: 'online-only',
    does: 'Choose a program or eligibility, or mark an office action done',
    why: 'Changes what the school shows this student. Tiny and instant when online, and a late apply could undo a later choice, so it waits for a connection rather than for a queue.',
  },
  {
    file: 'lib/office-actions-remote.ts',
    kind: 'publish',
    class: 'never-queued',
    does: 'An office publishes an action to students',
    why: 'Staff writing to students. A held one would reach students hours after the office changed its mind.',
  },
  {
    file: 'lib/cloud.ts',
    kind: 'delete',
    class: 'never-queued',
    does: 'Delete the account',
    why: 'Irreversible. It is never something to leave waiting.',
  },
  {
    file: 'components/ActionCenter.tsx',
    kind: 'handoff',
    class: 'never-queued',
    does: 'Open an official site from an action',
    why: 'The official system is the source of truth; opening it is not a write Semester can hold for later.',
  },
];

/** The two kinds the outbox holds. Everything else is refused offline. */
export const HELD_KINDS = ['share', 'contribute'] as const;

/**
 * Names that an official or financial record is written through. A held send
 * must never call one, and the test reads the two files a held kind calls.
 */
export const OFFICIAL_PREFIXES = [
  'registration_', 'registrar_', 'gradebook_', 'student_account', 'bursar', 'billing', 'aid_', 'record_', 'academic_record',
  'grade_', 'transcript', 'payment', 'charge_', 'refund', 'enroll', 'writeback',
] as const;
