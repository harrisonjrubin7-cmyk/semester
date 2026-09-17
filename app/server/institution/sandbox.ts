import { DatabaseSync } from 'node:sqlite';
import { Refusal } from '../../../packages/institution/src/index.ts';
import type {
  ActionInput,
  ConnectionStatus,
  FamilyGrant,
  Receipt,
  RecordPage,
  UniversityArea,
  UniversityRecord,
} from '../../../packages/institution/src/index.ts';
import type { AdapterContext, InstitutionAdapter } from './adapter.ts';
import { registrationAdapter } from './registration.ts';
import { aidAdapter, billingAdapter } from './money.ts';
import { familyAdapter } from './family.ts';
import { careerAdapter } from './career.ts';
import { advisingAdapter, alumniAdapter } from './advising.ts';
import { athleticsAdapter } from './athletics.ts';
import { clubsAdapter } from './clubs.ts';

/**
 * One course, run end to end, at an institution that does not exist.
 *
 * The completion plan's Phase 1 asks for exactly one complete vertical before
 * any breadth — *"faculty creates a course, a student enrolls, an assignment
 * is published, the student studies it in Semester, does the work, submits it,
 * gets a receipt, faculty grades it, feedback is released, and the record is
 * archived"* — and says to build it against **"a clearly labeled sandbox
 * institution and sandbox course … so nothing here is ever a placeholder
 * success state presented as real."**
 *
 * This is that institution. Everything upstream of it already existed: the
 * gateway does authentication, rate limiting, the two-phase action and the
 * journal; `packages/institution` is the contract; `screens/University.tsx`
 * draws whatever the gateway returns. What did not exist was anything on the
 * other end of the wire. `adapters.ts` is empty on purpose, so every route
 * answered 503 and the loop could not be built, demonstrated or tested.
 *
 * ## It is a sandbox in the three ways that can be checked, not just in name
 *
 * 1. **It is never installed unless somebody asks for it.** `adapters.ts`
 *    stays empty — that array is for adapters a school has written and
 *    approved. This one is added by `start.ts` only when
 *    `SEMESTER_SANDBOX_INSTITUTION=1` is set on the server, and the startup
 *    line says so out loud.
 * 2. **It answers only to a sandbox identity.** The gateway resolves an
 *    adapter by `identity.institutionId`, which comes from server-side
 *    `app_metadata` no client can write. An account whose institution is a
 *    real school never reaches this code, whatever it sends.
 * 3. **It says so in every string a person can read.** The institution name,
 *    the connection provider, and the title of every record begin with
 *    SANDBOX. `sandbox.test.ts` reads them back and fails on one that does
 *    not — because "clearly labeled" is the requirement, and a label nobody
 *    checks is a label that comes off in the first refactor.
 *
 * ## Why four adapters and not one
 *
 * Because the contract already has the right four areas and the vertical
 * spans them: `courses` holds the course, its syllabus and its calendar and
 * is where a student enrols; `assignments` is where the work is published and
 * submitted; `grades` is where faculty marks it and releases feedback;
 * `records` is the archive. Inventing a single "coursework" area would have
 * been a fifth vocabulary for a thing the contract already names, and the
 * University screen groups by area, so the four are what a person sees.
 *
 * They share one store, which is the whole point of doing them together: a
 * submission made in `assignments` is the record `grades` marks and the row
 * `records` archives. Four adapters over four stores would be four demos.
 *
 * ## What it refuses, and why that is the interesting part
 *
 * A sandbox that accepts everything proves nothing. The rules here are the
 * ones a real registrar has, and each is tested:
 *
 *  - A student may act only on their own work. Faculty see the whole roster.
 *    Neither is decided by anything the browser sent.
 *  - An action carrying a stale `version` is refused. A student who opened an
 *    assignment on Monday cannot submit against Monday's state on Friday.
 *  - The order is a state machine, not a set of buttons: nothing is graded
 *    before it is submitted, nothing is released before it is graded, nothing
 *    is archived before it is released, and nothing at all happens to an
 *    archived record.
 *  - A second `execute` with the same idempotency key returns the *first*
 *    receipt and changes nothing. That is what makes `reconcile` able to
 *    answer truthfully, and what stops a dropped connection from submitting
 *    twice.
 *  - Nothing in `review` writes. The gateway calls it at prepare and again at
 *    commit and compares; a review that reserved a thing would mean a person
 *    who read it and walked away had still changed the world.
 */

export const SANDBOX_INSTITUTION = 'sandbox';

/** What the gateway reports as the institution's name when this is installed. */
export const SANDBOX_NAME = 'SANDBOX — a demonstration course, not a real institution';

/** Every record a person can read is prefixed with this. See the header. */
export const SANDBOX_MARK = 'SANDBOX';

/** The one course, and the work published in it. */
const COURSE = {
  id: 'sandbox-101',
  code: 'SBX 101',
  title: 'Running a course end to end',
  faculty: 'Sandbox faculty',
  /*
   * What the course *is*, which is not the same thing as its syllabus and
   * used to be doing both jobs. The syllabus is a document faculty publish
   * and revise; this is the line under the title.
   */
  about:
    'A demonstration course with two published assignments, used to exercise the ' +
    'submit → receipt → grade → feedback → archive loop. No credit, no registrar, no real marks.',
};

/**
 * What each piece of work is marked on, and why it is here rather than in a
 * free-text comment.
 *
 * The first version of this took a mark out of twenty and a paragraph. That is
 * a grade, and a grade is not feedback: a student who loses six marks learns
 * nothing from the number about which six, and `lib/assignment.ts` — the
 * student-side half of this app — is built on the opposite premise, that "the
 * rubric, with weights, so effort goes where the marks are rather than where
 * the writing is easiest" is the thing worth having. The completion plan lists
 * rubrics second in what is missing, right after submission.
 *
 * So a criterion carries what it is worth *and what it means*, the marks are
 * per criterion and the total is their sum rather than a number somebody
 * types, and the student can read all of it before they start. A rubric
 * published only with the grade is a rubric that arrived too late to be used.
 */
export interface Criterion {
  id: string;
  name: string;
  outOf: number;
  means: string;
}

export interface Assignment {
  id: string;
  title: string;
  due: string;
  brief: string;
  /**
   * What this piece is worth, as a percentage of the whole course.
   *
   * Separate from what it is *marked* out of, because those are two different
   * facts and the first version had only the second. Problem set 1 is out of
   * twenty and the paper is out of forty, which looks like a weighting and is
   * not one — it is a count of how many criteria somebody happened to write.
   * A student reading those two numbers cannot tell whether the paper is worth
   * twice the problem set or whether its rubric is simply longer.
   *
   * The weights of published work do not have to reach a hundred, and mostly
   * will not: a course in October has not published its exam. What is left is
   * a fact worth stating rather than a gap to hide, and stating it is what
   * keeps a standing from being read as a grade.
   */
  weight: number;
  criteria: Criterion[];
}

/**
 * The two the course opens with.
 *
 * A seed rather than the list itself. The completion plan's chain starts
 * "faculty creates a course, a student enrolls, **an assignment is
 * published**" — and for four commits publishing was a constant in this file,
 * which is to say it was the one stage of the vertical with nothing behind it.
 * Faculty add to this list now; these two are just what is there on the first
 * morning so the course is not empty.
 */
const SEEDED: Assignment[] = [
  {
    id: 'a1',
    title: 'Problem set 1',
    due: '2026-10-02T23:59:00Z',
    brief: 'Four short answers on the reading. Submitted as text.',
    weight: 20,
    criteria: [
      { id: 'method', name: 'Method', outOf: 8, means: 'The steps are shown and each follows from the last.' },
      { id: 'accuracy', name: 'Accuracy', outOf: 8, means: 'The answers are right, with units.' },
      { id: 'clarity', name: 'Clarity', outOf: 4, means: 'A reader can follow it without asking you anything.' },
    ],
  },
  {
    id: 'a2',
    title: 'Short paper',
    due: '2026-10-23T23:59:00Z',
    brief: 'Twelve hundred words on one of the three prompts.',
    weight: 35,
    criteria: [
      { id: 'argument', name: 'Argument', outOf: 16, means: 'A claim somebody could disagree with, defended.' },
      { id: 'evidence', name: 'Evidence', outOf: 14, means: 'Sources used to support the claim, not summarised.' },
      { id: 'writing', name: 'Writing', outOf: 10, means: 'One idea per paragraph, and no padding.' },
    ],
  },
];

/**
 * The syllabus, which the completion plan's chain names between Course and
 * Calendar and which was one sentence on a constant.
 *
 * A description of a course is not a syllabus. The questions a student
 * actually has before one starts are when it meets, when somebody can be
 * asked something, what counts as working together and what counts as
 * copying, and how the marks add up — and the third of those is the one
 * people get wrong and lose a degree over.
 *
 * What is deliberately *not* a field here is the assessment breakdown. A
 * syllabus that says "problem set 20%, paper 35%" is a second copy of the
 * published weights, and the two drift the first time faculty publish
 * anything, at which point the contract with the class says one thing and the
 * course does another. It is derived, every time it is read.
 */
export interface Syllabus {
  about: string;
  meets: string;
  officeHours: string;
  collaboration: string;
  contact: string;
  /** Which revision this is, counting from one. */
  revision: number;
  /** What changed, on every revision after the first. */
  note: string;
  at: string;
  by: string;
}

/**
 * What this course does about late work, once it has said.
 *
 * The deadline commit recorded lateness and refused to act on it, on the
 * argument that *"a sandbox that hard-refused would be modelling one policy as
 * though it were the only one"* — plenty of courses take late work with a
 * penalty, some up to a cut-off, some not at all. That argument was about the
 * absence of a policy, and it left both sides reading the sentence "The course
 * decides what that costs" with no way to find out what it decided.
 *
 * So the course states one, and the two numbers are what nearly every real
 * policy is made of: a rate per day, and the most it can take. `perDay: 0` is
 * a policy too — a course saying late work is not penalised is saying
 * something, and it is not the same as a course that has not said anything.
 */
export interface LatePolicy {
  /** Percentage of the mark deducted for each day, or part of a day, late. */
  perDay: number;
  /** The most the penalty can reach, as a percentage. */
  cap: number;
  setAt: string;
  setBy: string;
}

/** How a policy reads to the person it applies to. */
const policySaid = (p: LatePolicy | null) =>
  !p
    ? 'This course has not said what late work costs.'
    : p.perDay === 0 || p.cap === 0
      ? 'This course does not penalise late work.'
      : `${pct(p.perDay)} of the mark per day late, or part of a day, up to ${pct(p.cap)}.`;

/**
 * What a late submission costs under a policy, worked out from the same two
 * timestamps everything else reads.
 *
 * Part of a day counts as a day, which is the ordinary rule and is said out
 * loud in `policySaid` rather than discovered by a student who was four hours
 * late. Nothing is stored: a kept `penalty` and a kept `submittedAt` are two
 * facts that can disagree, and only one of them is evidence.
 */
function penalty(
  work: Work,
  due: string,
  outOfTotal: number,
  p: LatePolicy | null,
): { days: number; percent: number; marks: number } | null {
  if (!p || !work.submittedAt) return null;
  const by = Date.parse(work.submittedAt) - Date.parse(due);
  if (!Number.isFinite(by)) return null;
  // Part of a day is a day, which is the ordinary rule and is said out loud in
  // `policySaid` rather than discovered by somebody who was four hours late.
  const days = Math.ceil(by / (24 * 3_600_000));
  const percent = Math.min(days * p.perDay, p.cap);
  // The one gate, and it covers work that was early: a negative span gives a
  // non-positive percentage. An earlier version tested `by <= 0` as well, and
  // that second check could not be made to fail — so it was not a guard, it
  // was a comment that looked like one.
  if (percent <= 0) return null;
  return { days, percent, marks: Number(((outOfTotal * percent) / 100).toFixed(2)) };
}

/**
 * The mark that goes on the record, and the reason it is computed rather than
 * stored.
 *
 * Never below zero — a negative mark is not a thing a transcript can carry —
 * and never taken out of a criterion. "Accuracy 6 of 8" is a judgement about
 * the answers; lateness is not a statement about accuracy, and scaling the
 * criteria would make the rubric lie about the work in order to carry a fact
 * about the clock.
 */
function recorded(work: Work, due: string, outOfTotal: number, p: LatePolicy | null): number {
  const earned = Number(work.mark || 0);
  const cost = penalty(work, due, outOfTotal, p);
  return Math.max(0, Number((earned - (cost?.marks ?? 0)).toFixed(2)));
}

/** What a piece of work is out of: the rubric's own total, never a second number. */
const outOf = (criteria: readonly Criterion[]) => criteria.reduce((n, c) => n + c.outOf, 0);

/** A share of the course, written the way a person writes one. */
const pct = (n: number) => `${Number(n.toFixed(2))}%`;

/** Percentages are added, so a comparison of two of them needs a little slack. */
const DUST = 1e-9;

/**
 * The class, as the course's own list rather than as a side effect.
 *
 * The first version of this file had no roster: faculty saw "every row that
 * exists", and a row came into being the first time a student *looked*. Three
 * things followed, and the middle one is a real bug rather than a thin
 * demonstration.
 *
 *  - A marker's list of outstanding work left out everybody who had not
 *    opened the app — which is to say, it under-reported exactly the students
 *    who owed work, in the one direction that matters.
 *  - Anybody at all with the student role could submit to the course. There
 *    was nothing to be enrolled *in*, so there was nothing to check against.
 *  - There was no way to see the class as a class, which is the difference
 *    the completion plan draws between organising a course and running one.
 *
 * These three are the roster, seeded so that a faculty view is a view of a
 * class rather than of one tester. Their names say what they are; nobody
 * should ever wonder whether Quiet Student is a real person.
 */
const CLASSMATES = [
  { id: 'quiet-1', name: 'SANDBOX Student A (has not opened the app)' },
  { id: 'busy-1', name: 'SANDBOX Student B' },
  { id: 'late-1', name: 'SANDBOX Student C' },
] as const;

/**
 * Who a post is for, and why this is the only field that matters here.
 *
 * "Discussion" is the last thing the completion plan lists as missing, and it
 * is the first feature in this loop that is many-to-many. Everything before it
 * concerned one student's work: the refusals were about *whose* it was. A
 * question is different — the useful ones are useful to the whole class, and
 * some of them must never reach it.
 *
 * "I do not understand what Q3 is asking" should be answered once where
 * everybody can read it. "I am struggling and may need an extension" is
 * addressed to the same person and must not be. A board with one visibility
 * either loses the first or publishes the second, and a student cannot be
 * expected to keep a rule the system does not enforce.
 *
 * So every post carries who it is for, it is chosen when the post is made, and
 * a `staff` post is visible to its author and to faculty and to nobody else.
 * That is the load-bearing refusal in this file and it is tested from the
 * other student's side rather than from the poster's.
 */
type Audience = 'class' | 'staff';

interface Post {
  id: string;
  thread: string;
  at: string;
  who: string;
  /** What the class sees instead of a user id. */
  name: string;
  fromFaculty: boolean;
  audience: Audience;
  body: string;
}

type Stage = 'published' | 'submitted' | 'graded' | 'released' | 'archived';

/** What a person reads instead of the stage's internal name. */
const SAID: Record<Stage, string> = {
  published: 'Published — not yet submitted',
  submitted: 'Submitted — awaiting marking',
  graded: 'Marked — feedback not yet released',
  released: 'Feedback released',
  archived: 'Archived',
};

interface Work {
  id: string;
  student: string;
  assignment: string;
  stage: Stage;
  version: number;
  enrolledAt: string | null;
  submittedAt: string | null;
  body: string;
  /** The total, kept as the sum of `marks` rather than as its own number. */
  mark: string;
  /** Criterion id → the mark it was given. */
  marks: Record<string, number>;
  comments: string;
  gradedAt: string | null;
  releasedAt: string | null;
  archivedAt: string | null;
  /**
   * The open or answered appeal, if there has been one.
   *
   * `was` keeps the mark as it stood when the appeal was raised. Amending a
   * mark must not erase the one it replaced: an academic record that only
   * holds the latest number cannot answer "what changed, and why", which is
   * the one question an appeal exists to leave an answer to.
   */
  appeal: {
    at: string;
    reason: string;
    was: string;
    state: 'open' | 'upheld' | 'amended';
    answer: string;
    answeredAt: string | null;
  } | null;
  /** Every transition, in order — this is the Record the vertical ends at. */
  history: { at: string; who: string; what: string; receipt: string }[];
}

/**
 * The sandbox's own store.
 *
 * SQLite on disk rather than a map in memory, and that is not gold-plating: a
 * demonstration whose submission disappears when the process restarts would
 * undercut the one thing the plan says this dependency exists to establish —
 * that *"submissions or grades can be trusted to persist correctly"*. It is
 * the same `node:sqlite` the journal beside it uses.
 */
/* ── Registration ─────────────────────────────────────────────────────────
 *
 * The build-out plan puts this first in Phase 3 and calls it "the
 * transactional standard's first full application": live seats, prerequisite
 * and hold checks, real enrolment submission, waitlists, add/drop.
 *
 * It is here, against the sandbox, as a **labelled demonstration**. Every
 * record it produces carries `SANDBOX_MARK`, every receipt says nothing here
 * reaches a real institution, and no seat taken in it is a seat anywhere. What
 * is real is the shape: a finite number of seats is what makes enrolling a
 * transaction rather than a preference, because two people can want the last
 * one and only one can have it.
 *
 * ## Why the seat count is derived and not stored
 *
 * A `taken` column and a table of enrolments are two answers to one question,
 * and they come apart the first time a write half-fails. The count is
 * `enrolments(section).length`, every time. It is a scan of a handful of rows
 * in a demonstration and it cannot disagree with itself.
 */

export interface Section {
  id: string;
  code: string;
  title: string;
  teacher: string;
  when: string;
  credits: number;
  seats: number;
  /** Course codes that must already be passed. Empty means none. */
  needs: string[];
  /** After this, add/drop is closed. An ISO day. */
  until: string;
}

export interface Enrolment {
  id: string;
  student: string;
  section: string;
  /** `enrolled` holds a seat; `waiting` does not; `dropped` is history. */
  state: 'enrolled' | 'waiting' | 'dropped';
  at: string;
  version: number;
  history: { at: string; who: string; what: string; receipt: string }[];
}

/**
 * What the demonstration registry opens with.
 *
 * Four sections chosen to make each refusal reachable by a tester rather than
 * only by a test: one with a prerequisite, one with a single seat so the
 * second person meets the waitlist, one already closed for add/drop, and one
 * ordinary. A demonstration where the interesting paths cannot be walked is a
 * screenshot.
 */
export const SECTIONS: Section[] = [
  {
    id: 'econ-1020-001',
    code: 'ECON 1020',
    title: 'Principles of Macroeconomics',
    teacher: 'Dr Alvarez',
    when: 'Tue/Thu 09:30',
    credits: 3,
    seats: 30,
    needs: [],
    until: '2026-09-30',
  },
  {
    id: 'econ-3010-001',
    code: 'ECON 3010',
    title: 'Intermediate Macroeconomics',
    teacher: 'Dr Alvarez',
    when: 'Mon/Wed 13:00',
    credits: 3,
    // The prerequisite. A tester who has not passed ECON 1020 is refused.
    seats: 20,
    needs: ['ECON 1020'],
    until: '2026-09-30',
  },
  {
    id: 'psci-2200-001',
    code: 'PSCI 2200',
    title: 'Security Studies Seminar',
    teacher: 'Dr Okafor',
    when: 'Wed 15:00',
    credits: 3,
    // One seat, so the second person to ask meets the waitlist.
    seats: 1,
    needs: [],
    until: '2026-09-30',
  },
  {
    id: 'bus-1600-001',
    code: 'BUS 1600',
    title: 'Financial Accounting',
    teacher: 'Dr Lindqvist',
    when: 'Tue/Thu 11:00',
    credits: 3,
    seats: 24,
    needs: [],
    // Already shut, so the add/drop refusal is reachable without waiting.
    until: '2026-09-05',
  },
];

/* ── Money ────────────────────────────────────────────────────────────────
 *
 * Phase 3's second domain, and the source documents constrain its shape in one
 * sentence worth obeying exactly: a real account balance *"built as read access
 * to Vanderbilt's own systems first, **not a competing processor**"*.
 *
 * So the demonstration is a ledger the institution owns and Semester reads.
 * The one write a student makes against it — paying — is committed **by the
 * institution's own adapter**, and the receipt comes back from there. That is
 * not a technicality: it is the whole architectural claim. Semester never
 * holds money, never takes a card, and has no payment credential of any kind.
 * What it has is the same two-phase prepare/commit it uses for a seat, with
 * the institution on the far side of it.
 *
 * ## A ledger, not a balance
 *
 * What is owed is `charges` minus what is paid against them, computed every
 * time. A balance column and the rows that add up to it are two answers to one
 * question, and the first half-failed write is where they stop agreeing — the
 * same argument the seat count makes in registration, and it is worth making
 * twice because money is where somebody notices.
 *
 * ## Aid is offered by the institution and answered by the student
 *
 * An award's amount is the institution's to set and nobody else's. The student
 * can accept it or decline it and can do neither to somebody else's, and the
 * amount is never read from a request — which is the obvious attack and is
 * refused in `execute` rather than trusted from the field.
 */

export interface Charge {
  id: string;
  student: string;
  what: string;
  /** Cents, because money in a float is a bug waiting for a decimal. */
  cents: number;
  paid: number;
  due: string;
  at: string;
  version: number;
  history: { at: string; who: string; what: string; receipt: string }[];
}

export interface Award {
  id: string;
  student: string;
  what: string;
  kind: 'Grant' | 'Scholarship' | 'Loan' | 'Work-study';
  cents: number;
  state: 'offered' | 'accepted' | 'declined' | 'disbursed';
  /** The last day the student can answer it. An ISO day. */
  answerBy: string;
  at: string;
  version: number;
  history: { at: string; who: string; what: string; receipt: string }[];
}

/** Money as a person reads it. Cents in, dollars out, always two places. */
export const money = (cents: number): string =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Opening<T> = Omit<T, 'student' | 'at' | 'version' | 'history'>;

/** The bill a demonstration account opens with. */
export const OPENING_CHARGES: Opening<Charge>[] = [
  { id: 'tuition-fall', what: 'Tuition — Fall 2026', cents: 2_950_000, paid: 0, due: '2026-10-15' },
  { id: 'activity-fee', what: 'Student activity fee', cents: 68_500, paid: 0, due: '2026-10-15' },
  { id: 'housing-fall', what: 'Housing — Fall 2026', cents: 640_000, paid: 0, due: '2026-10-15' },
];

/** And the aid against it, in the four kinds a real award letter has. */
export const OPENING_AWARDS: Opening<Award>[] = [
  { id: 'need-grant', what: 'Need-based grant', kind: 'Grant', cents: 1_800_000, state: 'offered', answerBy: '2026-10-01' },
  { id: 'merit', what: 'Merit scholarship', kind: 'Scholarship', cents: 500_000, state: 'disbursed', answerBy: '2026-09-01' },
  { id: 'subsidised-loan', what: 'Federal subsidised loan', kind: 'Loan', cents: 350_000, state: 'offered', answerBy: '2026-10-01' },
  { id: 'work-study', what: 'Work-study award', kind: 'Work-study', cents: 200_000, state: 'offered', answerBy: '2026-10-01' },
];

/**
 * ─── Phase 4: leaving the campus, and the three areas that are about that ───
 *
 * The build-out plan's Phase 4 is "official institutional transactions", and
 * it opens with Career. Everything here is the same demonstration as Phase 3
 * and carries the same warning: **no employer named here exists**, no
 * application reaches anybody, and no appointment is in any adviser's diary.
 * Phase 4 in that document is gated on Phase 3 being *sustained* in a live
 * pilot and on a university choosing to extend trust one function at a time.
 * Neither has happened. What follows is the shape, built so the shape can be
 * argued with.
 *
 * ## Where the finite thing is, in each of them
 *
 * Registration taught this repository that the hard part of institutional
 * software is the sentence "two people can want the last one". Each area here
 * was built by first finding that sentence in it, because an area without one
 * is a list and does not need a transaction at all.
 *
 *   **Career**: not the application — a listing can take a thousand of those.
 *   The finite thing is the *offer*. A posting with two openings cannot make
 *   three offers, and the check for that is made twice, at review and again at
 *   the write, exactly as the seat check is.
 *
 *   **Advising**: the half-hour itself. One person can have it.
 *
 *   **Alumni**: the mentor's attention, which is why a mentor carries a number
 *   of students they are willing to take and why the count is derived from the
 *   accepted connections rather than stored beside them.
 *
 * ## And where the disclosure is
 *
 * Family access established the rule the rest of this repository now follows:
 * a permission is a thing the server holds, and the absence of a permission
 * shows up as an absence of *data*, not as a greyed-out row. Three of those
 * live here, and each is tested by reading the record as somebody who should
 * not see the field and asserting the field is not in it at all:
 *
 *   An employer sees the applicants to their own postings and to no others.
 *   A student never sees who else applied — not the names, not the number.
 *   An alumnus's contact address does not exist on the record until they have
 *   said yes.
 */

/**
 * An employer, as the career office holds it.
 *
 * `state` is the whole reason this table exists rather than employers being
 * implied by whoever posts. A career office vets the people who advertise to
 * its students — it is one of the few things such an office unambiguously
 * does — and a demonstration where anybody with an account can post a job to
 * a student body would be demonstrating the absence of the control rather
 * than the control.
 *
 * `owner` is a user id and is the only thing that grants the right to act for
 * this employer. It is checked on the server against this row. Nothing that
 * arrives in a request can name an employer the caller does not own.
 */
export interface Employer {
  id: string;
  owner: string;
  name: string;
  state: 'pending' | 'approved' | 'suspended';
  /** Why, in a sentence somebody can act on. Empty when approved. */
  why: string;
}

export interface Listing {
  id: string;
  employer: string;
  title: string;
  kind: 'Job' | 'Internship' | 'On-campus';
  where: string;
  pay: string;
  /** How many people can be hired. The finite thing; see the header. */
  openings: number;
  /** The last day an application is accepted. An ISO day. */
  closes: string;
  at: string;
}

export interface Application {
  id: string;
  listing: string;
  student: string;
  /**
   * `withdrawn` is terminal for this listing and deliberately so. See
   * `career.ts` — an employer has already read it, and a demonstration whose
   * "undo" silently un-reads something is teaching the wrong lesson.
   */
  state: 'submitted' | 'shortlisted' | 'offered' | 'accepted' | 'declined' | 'passed' | 'withdrawn';
  note: string;
  at: string;
  version: number;
  history: { at: string; who: string; what: string; receipt: string }[];
}

/**
 * Half an hour with an adviser.
 *
 * `seats` is here rather than assumed to be one because a group advising
 * session is a real thing and a demonstration that hard-coded one would have
 * hidden the general case behind a special one. It is the registration seat
 * count again, and it is derived the same way: by counting bookings.
 */
export interface Slot {
  id: string;
  adviser: string;
  /** What this adviser advises on, which is what a student searches by. */
  about: string;
  /** An ISO timestamp. The past is a refusal; see `advising`. */
  when: string;
  minutes: number;
  seats: number;
  where: string;
}

export interface Booking {
  id: string;
  slot: string;
  student: string;
  state: 'booked' | 'cancelled';
  /** What the student wants to talk about, which the adviser can read. */
  about: string;
  at: string;
  version: number;
  history: { at: string; who: string; what: string; receipt: string }[];
}

/**
 * Somebody who graduated and said they would talk to a student.
 *
 * `email` is on this row and is **not** on the record a student reads until
 * the mentorship is accepted. That is the entire security property of this
 * area and it is asserted from the outside: the test reads the record as a
 * student with a pending request and checks that no detail on it contains the
 * address, rather than checking that some flag is false.
 */
export interface Mentor {
  id: string;
  name: string;
  classOf: string;
  field: string;
  works: string;
  email: string;
  /** How many students this person will mentor at once. */
  capacity: number;
  /** Whether they are taking requests at all just now. */
  open: boolean;
}

export interface Mentorship {
  id: string;
  mentor: string;
  student: string;
  state: 'asked' | 'accepted' | 'declined' | 'ended';
  why: string;
  at: string;
  version: number;
  history: { at: string; who: string; what: string; receipt: string }[];
}

/**
 * What the career office opens with.
 *
 * Chosen, as the sections were, so that every refusal can be walked by a
 * person and not only reached by a test: one employer still pending, one
 * suspended, one listing already closed, and one listing with a single
 * opening so the second offer meets the limit.
 */
export const EMPLOYERS: Employer[] = [
  { id: 'harbour-analytics', owner: 'employer-harbour', name: 'Harbour Analytics', state: 'approved', why: '' },
  { id: 'city-schools', owner: 'employer-schools', name: 'City Schools Partnership', state: 'approved', why: '' },
  {
    id: 'quickcash-partners',
    owner: 'employer-quickcash',
    name: 'QuickCash Partners',
    state: 'pending',
    why: 'Awaiting review by the career office. Nothing can be posted until that is finished.',
  },
  {
    id: 'oldfield-group',
    owner: 'employer-oldfield',
    name: 'Oldfield Group',
    state: 'suspended',
    why: 'Suspended after a complaint about an unpaid placement advertised as paid.',
  },
];

export const LISTINGS: Listing[] = [
  {
    id: 'harbour-analyst-intern',
    employer: 'harbour-analytics',
    title: 'Economics research intern',
    kind: 'Internship',
    where: 'Nashville, hybrid',
    pay: '$22/hour',
    openings: 2,
    closes: '2026-10-20',
    at: '2026-09-01T09:00:00Z',
  },
  {
    id: 'harbour-grad-analyst',
    employer: 'harbour-analytics',
    title: 'Graduate analyst',
    kind: 'Job',
    where: 'Nashville',
    pay: '$71,000',
    // One opening, so the second offer meets the limit rather than only the test.
    openings: 1,
    closes: '2026-11-15',
    at: '2026-09-05T09:00:00Z',
  },
  {
    id: 'schools-tutor',
    employer: 'city-schools',
    title: 'After-school tutor',
    kind: 'On-campus',
    where: 'Metro Nashville',
    pay: '$18/hour',
    openings: 6,
    // Already shut, so the closed refusal is walkable.
    closes: '2026-09-10',
    at: '2026-08-20T09:00:00Z',
  },
];

export const SLOTS: Slot[] = [
  {
    id: 'career-thu-1000',
    adviser: 'M. Okonkwo',
    about: 'Career — résumés, applications, offers',
    when: '2026-09-24T15:00:00Z',
    minutes: 30,
    seats: 1,
    where: 'Career centre, room 2',
  },
  {
    id: 'career-thu-1030',
    adviser: 'M. Okonkwo',
    about: 'Career — résumés, applications, offers',
    when: '2026-09-24T15:30:00Z',
    minutes: 30,
    seats: 1,
    where: 'Career centre, room 2',
  },
  {
    id: 'academic-fri-1400',
    adviser: 'Dr Reyes',
    about: 'Academic — majors, minors, course plans',
    when: '2026-09-25T19:00:00Z',
    minutes: 45,
    seats: 1,
    where: 'Buttrick 210',
  },
  {
    id: 'grad-school-panel',
    adviser: 'Dr Reyes',
    about: 'Graduate school — a group session',
    when: '2026-09-26T18:00:00Z',
    minutes: 60,
    seats: 8,
    where: 'Buttrick 101',
  },
  {
    id: 'career-past-slot',
    adviser: 'M. Okonkwo',
    about: 'Career — résumés, applications, offers',
    // In the past against the sandbox's own clock, so the refusal is walkable.
    when: '2026-09-02T15:00:00Z',
    minutes: 30,
    seats: 1,
    where: 'Career centre, room 2',
  },
];

export const MENTORS: Mentor[] = [
  {
    id: 'a-whitfield',
    name: 'A. Whitfield',
    classOf: '2014',
    field: 'National security',
    works: 'Policy analyst, a federal agency',
    email: 'a.whitfield@example.invalid',
    capacity: 2,
    open: true,
  },
  {
    id: 'j-park',
    name: 'J. Park',
    classOf: '2009',
    field: 'Economics',
    works: 'Central bank research',
    email: 'j.park@example.invalid',
    capacity: 3,
    open: true,
  },
  {
    id: 'r-santos',
    name: 'R. Santos',
    classOf: '2018',
    field: 'Consulting',
    works: 'Strategy, a firm in Chicago',
    email: 'r.santos@example.invalid',
    // Closed, so that refusal is walkable too.
    capacity: 1,
    open: false,
  },
];

/**
 * ─── Athletics ──────────────────────────────────────────────────────────────
 *
 * Phase 4 again, same warning: **no team here exists**, nobody is cleared to
 * play anything, and no bus is going anywhere. Marked on every record.
 *
 * ## Where the finite thing is, and why it is not the roster spot
 *
 * A roster spot looks like the seat and is not. Teams do not usually turn
 * people away for want of a number; what they turn people away for is
 * *eligibility*, and eligibility is not a seat at all — it is a condition that
 * expires. Which makes athletics the first area in this repository whose hard
 * part is **time** rather than contention, and it wanted a different shape:
 *
 *   A clearance has a date it runs out on. It is not a flag somebody sets.
 *   Nothing derives eligibility from "was cleared once"; every check asks
 *   whether the clearance is good *today*, against the clock the adapter was
 *   given. A demonstration that stored `eligible: true` would have been
 *   demonstrating the bug.
 *
 * The genuinely finite thing here is the **seat on the coach** — travel has a
 * capacity, and a player who is not eligible cannot take one whatever the
 * capacity is. So the two rules compose, and the order they compose in is
 * itself a decision: eligibility is checked *before* the seat, because telling
 * somebody the bus is full when the real answer is that their physical lapsed
 * sends them to the wrong office.
 *
 * ## And the disclosure
 *
 * A clearance is a medical fact. `Eligibility.why` — the reason somebody is
 * not cleared — is readable by the athlete themselves and by nobody else,
 * *including their team-mates on the same roster record*. A coach sees that a
 * player is not cleared and does not see why, because "cleared or not" is what
 * a coach needs to pick a team and the reason is between the athlete and the
 * people who took it.
 */

export interface Team {
  id: string;
  name: string;
  sport: string;
  coach: string;
  /** The user id the coaching workflows are authorized against. */
  coachId: string;
  season: string;
}

export interface Athlete {
  id: string;
  team: string;
  student: string;
  name: string;
  position: string;
  /** `rostered` is on the team; `released` is history. */
  state: 'rostered' | 'released';
  at: string;
  version: number;
  history: { at: string; who: string; what: string; receipt: string }[];
}

/**
 * A clearance to play, which is a date and not a flag.
 *
 * `until` is the whole of it. Nothing anywhere asks whether somebody *was*
 * cleared; every check asks whether the clearance is good on the day being
 * asked about. `why` is the reason it is not, and is a medical fact — see the
 * header, and `athletics.test.ts`, which asserts a coach's reading of the
 * roster contains the word "not cleared" and does not contain the reason.
 */
export interface Eligibility {
  id: string;
  student: string;
  /** What had to be done: a physical, a form, an academic check. */
  what: string;
  /** The last day this clearance is good for. An ISO day. */
  until: string;
  /** Why it is outstanding, if it is. A medical fact; see the header. */
  why: string;
  at: string;
  version: number;
  history: { at: string; who: string; what: string; receipt: string }[];
}

/** A fixture somebody has to be driven to. */
export interface Trip {
  id: string;
  team: string;
  what: string;
  where: string;
  /** An ISO timestamp — when the coach leaves, not when the game starts. */
  leaves: string;
  returns: string;
  /** How many can be carried. The finite thing; see the header. */
  seats: number;
  /** After this, the manifest is with the driver and cannot be changed here. */
  until: string;
}

export interface Seat {
  id: string;
  trip: string;
  student: string;
  state: 'on' | 'off';
  at: string;
  version: number;
  history: { at: string; who: string; what: string; receipt: string }[];
}

export const TEAMS: Team[] = [
  { id: 'rowing', name: 'Rowing', sport: 'Rowing', coach: 'Coach I. Brandt', coachId: 'coach-brandt', season: 'Autumn 2026' },
  { id: 'track', name: 'Track & field', sport: 'Athletics', coach: 'Coach P. Nwosu', coachId: 'coach-nwosu', season: 'Autumn 2026' },
];

/**
 * The clearances the demonstration opens with.
 *
 * One good, one already lapsed and one that lapses inside the demonstration's
 * own window — the third is the important one, because a clearance that is
 * either always good or always stale never exercises the thing that makes
 * this area different from a list. `Opening<T>` is the same helper the billing
 * openings use, above.
 */
export const OPENING_CLEARANCES: Opening<Eligibility>[] = [
  { id: 'physical', what: 'Pre-season physical', until: '2027-06-30', why: '' },
  {
    id: 'concussion-protocol',
    what: 'Return-to-play clearance',
    until: '2026-09-05',
    why: 'Return-to-play assessment outstanding after a head knock on 28 August.',
  },
  { id: 'academic-standing', what: 'Academic standing check', until: '2026-09-30', why: '' },
];

export const TRIPS: Trip[] = [
  {
    id: 'head-of-the-cumberland',
    team: 'rowing',
    what: 'Head of the Cumberland',
    where: 'Chattanooga',
    leaves: '2026-10-03T10:00:00Z',
    returns: '2026-10-03T23:00:00Z',
    // Two seats, so the second person meets the limit rather than only a test.
    seats: 2,
    until: '2026-09-30',
  },
  {
    id: 'conference-relays',
    team: 'track',
    what: 'Conference relays',
    where: 'Lexington',
    leaves: '2026-10-10T07:00:00Z',
    returns: '2026-10-11T20:00:00Z',
    seats: 20,
    until: '2026-10-06',
  },
  {
    id: 'closed-fixture',
    team: 'rowing',
    what: 'Autumn regatta',
    where: 'Oak Ridge',
    leaves: '2026-09-19T09:00:00Z',
    returns: '2026-09-19T19:00:00Z',
    seats: 10,
    // The manifest is already with the driver, so that refusal is walkable.
    until: '2026-09-15',
  },
];

/**
 * ─── Clubs and student organizations ────────────────────────────────────────
 *
 * Phase 4 again, same warning on every record: **no club named here exists**,
 * no money moves, and no election decides anything.
 *
 * This area has four finite things rather than one, and they are not the same
 * *kind* of finite, which is what makes it the most interesting of Phase 4:
 *
 *   A **room** at a time — registration's seat, exactly.
 *   A **budget**, which is money and therefore divisible: the finite thing is
 *   not a count of grants but a sum, and a request for more than is left is
 *   refused against the remainder rather than against a number of slots.
 *   A **vote**, which is finite at one per member and is the only thing in this
 *   repository that must be *both* counted and secret.
 *   And an **event's capacity**, which is a seat again.
 *
 * ## The ballot, which is the hardest thing in Phase 4
 *
 * An election has to satisfy two requirements that pull against each other:
 *
 *   **Nobody votes twice.** Which needs a record of who has voted.
 *   **Nobody can tell how anybody voted.** Which forbids a record joining a
 *   person to a choice.
 *
 * Both at once is the whole problem, and a demonstration that stored
 * `{ voter, choice }` would have solved neither honestly — it would have
 * satisfied the first and pretended at the second by not showing the column.
 *
 * So the ballot is **two tables that are never joined**: a roll of who has
 * voted, carrying no choice, and a pile of choices, carrying no voter. The
 * count comes from the second and the double-vote refusal from the first, and
 * there is no query that can put them back together because nothing in either
 * row identifies a row in the other. `clubs.test.ts` asserts that by reading
 * every ballot row and every roll row and checking no value in one appears in
 * the other.
 *
 * That is the honest version of what a paper ballot box does: a marked
 * electoral roll by the door and unordered papers inside.
 *
 * ## Dues, which are money the university does not hold
 *
 * The same constraint Money was built under — Semester is not a processor —
 * applies with an extra turn: these are a *club's* funds, not the
 * institution's. A dues record says what is owed and records that a treasurer
 * marked it settled. Nothing here takes a payment from anybody.
 */

export interface Club {
  id: string;
  name: string;
  what: string;
  /** The user id the officer workflows are authorized against. */
  officer: string;
  officerName: string;
  /** Cents a member owes for the year. Zero means the club charges nothing. */
  duesCents: number;
  /** What the student government granted this club for the year, in cents. */
  budgetCents: number;
}

export interface Member {
  id: string;
  club: string;
  student: string;
  name: string;
  state: 'member' | 'left';
  /** Whether the treasurer has recorded their dues as settled. */
  duesPaid: boolean;
  at: string;
  version: number;
  history: { at: string; who: string; what: string; receipt: string }[];
}

/**
 * A room, at a time, which is registration's seat wearing a different hat.
 *
 * Named for what it is rather than "booking", because `Booking` is already an
 * advising appointment and two types one letter apart in the same store is how
 * somebody eventually saves one into the other's table.
 */
export interface RoomHold {
  id: string;
  room: string;
  club: string;
  /** An ISO timestamp. Two clubs cannot hold the same room at the same one. */
  when: string;
  what: string;
  /** How many the room holds. */
  holds: number;
  at: string;
  version: number;
  history: { at: string; who: string; what: string; receipt: string }[];
}

export interface Room {
  id: string;
  name: string;
  holds: number;
}

/**
 * A claim against the club's budget.
 *
 * The finite thing is a **sum**, not a count, which is the only reason this is
 * not a copy of the seat check: two requests of forty dollars each fit in a
 * hundred and a third does not, and no number of slots expresses that.
 */
export interface Spend {
  id: string;
  club: string;
  what: string;
  cents: number;
  state: 'asked' | 'approved' | 'refused' | 'paid';
  by: string;
  at: string;
  version: number;
  history: { at: string; who: string; what: string; receipt: string }[];
}

export interface Election {
  id: string;
  club: string;
  post: string;
  candidates: string[];
  /** ISO timestamps. A vote outside them is refused. */
  opens: string;
  closes: string;
}

/**
 * One name on the electoral roll. Carries **no choice**.
 *
 * Its id is the club election and the voter, so a second vote collides on the
 * primary key as well as being refused — belt and braces on the one rule an
 * election cannot bend.
 */
export interface Voted {
  id: string;
  election: string;
  voter: string;
  at: string;
}

/**
 * One paper in the box. Carries **no voter**.
 *
 * Its id is random and is the only thing that distinguishes it from another
 * paper for the same candidate. Deliberately not a hash of anything a person
 * could reproduce: an id derived from the voter would be a join waiting for
 * somebody who knew the recipe.
 */
export interface Ballot {
  id: string;
  election: string;
  choice: string;
}

export const CLUBS: Club[] = [
  {
    id: 'model-un',
    name: 'Model United Nations',
    what: 'Conference delegations and weekly committee practice',
    officer: 'officer-mun',
    officerName: 'H. Osei, President',
    duesCents: 4_500,
    budgetCents: 250_000,
  },
  {
    id: 'econ-society',
    name: 'Economics Society',
    what: 'Speakers, reading groups and the spring case competition',
    officer: 'officer-econ',
    officerName: 'D. Lindqvist, Treasurer',
    duesCents: 0,
    budgetCents: 90_000,
  },
];

export const ROOMS: Room[] = [
  { id: 'buttrick-101', name: 'Buttrick 101', holds: 120 },
  { id: 'sarratt-216', name: 'Sarratt 216', holds: 30 },
];

export const ELECTIONS: Election[] = [
  {
    id: 'mun-president-2027',
    club: 'model-un',
    post: 'President, 2027',
    candidates: ['A. Osei', 'B. Farouk', 'C. Nakamura'],
    opens: '2026-09-18T00:00:00Z',
    closes: '2026-09-30T23:59:59Z',
  },
  {
    id: 'econ-treasurer-2027',
    club: 'econ-society',
    post: 'Treasurer, 2027',
    candidates: ['R. Devi', 'S. Mbeki'],
    // Not yet open, so that refusal is walkable rather than only testable.
    opens: '2026-11-01T00:00:00Z',
    closes: '2026-11-14T23:59:59Z',
  },
];

export class SandboxStore {
  private db: DatabaseSync;

  constructor(file: string) {
    this.db = new DatabaseSync(file, { timeout: 5000 });
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS work(
        id TEXT PRIMARY KEY,
        student TEXT NOT NULL,
        assignment TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS assignments(
        id TEXT PRIMARY KEY,
        at TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS roster(
        student TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        joinedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS posts(
        id TEXT PRIMARY KEY,
        thread TEXT NOT NULL,
        at TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings(
        id TEXT PRIMARY KEY,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS receipts(
        key TEXT PRIMARY KEY,
        body TEXT NOT NULL
      );
      /*
       * Registration — the demonstration of the transactional standard the
       * build-out plan puts first in Phase 3. A section is a thing with a
       * finite number of seats, which is what makes enrolling a transaction
       * rather than a preference: two people can want the last one.
       */
      CREATE TABLE IF NOT EXISTS sections(
        id TEXT PRIMARY KEY,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS enrolments(
        id TEXT PRIMARY KEY,
        student TEXT NOT NULL,
        section TEXT NOT NULL,
        body TEXT NOT NULL
      );
      /*
       * Money. A ledger rather than a balance column, for the reason the seat
       * count is derived rather than stored: a balance and the rows that add
       * up to it are two answers to one question, and the first half-failed
       * write is where they stop agreeing.
       */
      CREATE TABLE IF NOT EXISTS charges(
        id TEXT PRIMARY KEY,
        student TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS awards(
        id TEXT PRIMARY KEY,
        student TEXT NOT NULL,
        body TEXT NOT NULL
      );
      -- Family access. The institution contract says it in as many words:
      -- a real grant lives in verified server storage, every resource
      -- operation is checked against it, and a permission object that
      -- arrived from a browser is a request and never an authority. This
      -- table is that storage, for the demonstration.
      CREATE TABLE IF NOT EXISTS grants(
        id TEXT PRIMARY KEY,
        student TEXT NOT NULL,
        recipient TEXT NOT NULL,
        body TEXT NOT NULL
      );
      -- Career. The owner column is the one the authorization question is
      -- asked of on every employer write: which employer, if any, is this
      -- caller allowed to act for. A demonstration can scan four rows; the
      -- shape of the question is what is being demonstrated.
      CREATE TABLE IF NOT EXISTS employers(
        id TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS listings(
        id TEXT PRIMARY KEY,
        employer TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS applications(
        id TEXT PRIMARY KEY,
        listing TEXT NOT NULL,
        student TEXT NOT NULL,
        body TEXT NOT NULL
      );
      -- Advising. A slot is finite in exactly the way a seat is, so the
      -- bookings are rows and the count is derived from them.
      CREATE TABLE IF NOT EXISTS slots(
        id TEXT PRIMARY KEY,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS bookings(
        id TEXT PRIMARY KEY,
        slot TEXT NOT NULL,
        student TEXT NOT NULL,
        body TEXT NOT NULL
      );
      -- Alumni. A mentor's address lives in this body and is kept off the
      -- record a student reads until the mentorship is accepted.
      CREATE TABLE IF NOT EXISTS mentors(
        id TEXT PRIMARY KEY,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS mentorships(
        id TEXT PRIMARY KEY,
        mentor TEXT NOT NULL,
        student TEXT NOT NULL,
        body TEXT NOT NULL
      );
      -- Athletics. The coach column on teams is what a coaching write is
      -- authorized against, the same way employers.owner is.
      CREATE TABLE IF NOT EXISTS teams(
        id TEXT PRIMARY KEY,
        coach TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS athletes(
        id TEXT PRIMARY KEY,
        team TEXT NOT NULL,
        student TEXT NOT NULL,
        body TEXT NOT NULL
      );
      -- A clearance is a date and not a flag, so nothing here stores whether
      -- somebody is eligible; the date is stored and the question is asked
      -- against a clock. See the athletics adapter.
      CREATE TABLE IF NOT EXISTS clearances(
        id TEXT PRIMARY KEY,
        student TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS trips(
        id TEXT PRIMARY KEY,
        team TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS seats(
        id TEXT PRIMARY KEY,
        trip TEXT NOT NULL,
        student TEXT NOT NULL,
        body TEXT NOT NULL
      );
      -- Clubs. The officer column authorizes an officer write, the way
      -- employers.owner and teams.coach do.
      CREATE TABLE IF NOT EXISTS clubs(
        id TEXT PRIMARY KEY,
        officer TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS members(
        id TEXT PRIMARY KEY,
        club TEXT NOT NULL,
        student TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rooms(
        id TEXT PRIMARY KEY,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS holds(
        id TEXT PRIMARY KEY,
        room TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS spends(
        id TEXT PRIMARY KEY,
        club TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS elections(
        id TEXT PRIMARY KEY,
        club TEXT NOT NULL,
        body TEXT NOT NULL
      );
      /*
       * The ballot box, in two tables that are never joined.
       *
       * The roll says who voted and carries no choice. The ballots carry a
       * choice and no voter. Nobody votes twice because of the first; nobody
       * can tell how anybody voted because there is no column in either that
       * names a row in the other. A single table of (voter, choice) would have
       * satisfied the first rule and only pretended at the second.
       *
       * Two tables and not two columns, because a column somebody can select
       * is a column somebody will select.
       */
      CREATE TABLE IF NOT EXISTS roll(
        id TEXT PRIMARY KEY,
        election TEXT NOT NULL,
        voter TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ballots(
        id TEXT PRIMARY KEY,
        election TEXT NOT NULL,
        body TEXT NOT NULL
      );
    `);

    // The class the course already has, before any tester arrives.
    const seed = this.db.prepare('INSERT OR IGNORE INTO roster VALUES(?,?,?)');
    for (const c of CLASSMATES) seed.run(c.id, c.name, '2026-08-25T09:00:00Z');

    // And the work it opens with. Faculty publish more; see `publish`.
    const first = this.db.prepare('INSERT OR IGNORE INTO assignments VALUES(?,?,?)');
    for (const a of SEEDED) first.run(a.id, '2026-08-25T09:00:00Z', JSON.stringify(a));

    // The sections registration opens with. See `SECTIONS`.
    const sec = this.db.prepare('INSERT OR IGNORE INTO sections VALUES(?,?)');
    for (const t of SECTIONS) sec.run(t.id, JSON.stringify(t));

    // Phase 4's openings: the employers the career office has vetted or not,
    // what they have posted, the diary, and who said they would talk.
    const emp = this.db.prepare('INSERT OR IGNORE INTO employers VALUES(?,?,?)');
    for (const e of EMPLOYERS) emp.run(e.id, e.owner, JSON.stringify(e));
    const post = this.db.prepare('INSERT OR IGNORE INTO listings VALUES(?,?,?)');
    for (const l of LISTINGS) post.run(l.id, l.employer, JSON.stringify(l));
    const when = this.db.prepare('INSERT OR IGNORE INTO slots VALUES(?,?)');
    for (const t of SLOTS) when.run(t.id, JSON.stringify(t));
    const who = this.db.prepare('INSERT OR IGNORE INTO mentors VALUES(?,?)');
    for (const m of MENTORS) who.run(m.id, JSON.stringify(m));

    // The teams and the fixtures. A student's clearance file is opened the
    // first time they are put on a roster, not here, for the same reason
    // their bill is: opening one for everybody who ever logs in would be
    // recording a medical fact about somebody who has no business with it.
    const team = this.db.prepare('INSERT OR IGNORE INTO teams VALUES(?,?,?)');
    for (const t of TEAMS) team.run(t.id, t.coachId, JSON.stringify(t));
    const trip = this.db.prepare('INSERT OR IGNORE INTO trips VALUES(?,?,?)');
    for (const t of TRIPS) trip.run(t.id, t.team, JSON.stringify(t));

    // The clubs, the rooms they ask for, and the elections they are running.
    const club = this.db.prepare('INSERT OR IGNORE INTO clubs VALUES(?,?,?)');
    for (const c of CLUBS) club.run(c.id, c.officer, JSON.stringify(c));
    const room = this.db.prepare('INSERT OR IGNORE INTO rooms VALUES(?,?)');
    for (const r of ROOMS) room.run(r.id, JSON.stringify(r));
    const vote = this.db.prepare('INSERT OR IGNORE INTO elections VALUES(?,?,?)');
    for (const e of ELECTIONS) vote.run(e.id, e.club, JSON.stringify(e));
  }

  /**
   * A named setting, as a string, or null.
   *
   * The `settings` table already held the late policy and the syllabus under
   * fixed ids. Registration needs a handful more — a hold on an account, a
   * recorded pass — and they are keyed rather than columned because a
   * demonstration that needs a migration to put a hold on somebody is a
   * demonstration nobody will put a hold on.
   */
  setting(id: string): string | null {
    const got = this.db.prepare('SELECT body FROM settings WHERE id=?').get(id) as
      | { body: string }
      | undefined;
    return got ? got.body : null;
  }

  /** Set one, or clear it with an empty string. */
  setSetting(id: string, body: string): void {
    if (!body) {
      this.db.prepare('DELETE FROM settings WHERE id=?').run(id);
      return;
    }
    this.db
      .prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body')
      .run(id, body);
  }

  /* ── Registration ───────────────────────────────────────────────────── */

  sections(): Section[] {
    const rows = this.db.prepare('SELECT body FROM sections ORDER BY id').all() as { body: string }[];
    return rows.map((r) => JSON.parse(r.body) as Section);
  }

  section(id: string): Section | null {
    const got = this.db.prepare('SELECT body FROM sections WHERE id=?').get(id) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as Section) : null;
  }

  saveSection(section: Section): void {
    this.db.prepare('INSERT OR REPLACE INTO sections VALUES(?,?)').run(section.id, JSON.stringify(section));
  }

  /* ── Clubs ──────────────────────────────────────────────────────────── */

  clubs(): Club[] {
    const rows = this.db.prepare('SELECT body FROM clubs ORDER BY id').all() as { body: string }[];
    return rows.map((r) => JSON.parse(r.body) as Club);
  }

  club(id: string): Club | null {
    const got = this.db.prepare('SELECT body FROM clubs WHERE id=?').get(id) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as Club) : null;
  }

  /** The club this person is an officer of, or null. Asked of the table. */
  officerOf(userId: string): Club | null {
    const got = this.db.prepare('SELECT body FROM clubs WHERE officer=?').get(userId) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as Club) : null;
  }

  saveClub(row: Club): void {
    this.db.prepare('INSERT OR REPLACE INTO clubs VALUES(?,?,?)').run(row.id, row.officer, JSON.stringify(row));
  }

  members(club?: string): Member[] {
    const rows = (
      club
        ? this.db.prepare('SELECT body FROM members WHERE club=? ORDER BY id').all(club)
        : this.db.prepare('SELECT body FROM members ORDER BY id').all()
    ) as { body: string }[];
    return rows.map((r) => JSON.parse(r.body) as Member);
  }

  saveMember(row: Member): void {
    this.db
      .prepare('INSERT OR REPLACE INTO members VALUES(?,?,?,?)')
      .run(row.id, row.club, row.student, JSON.stringify(row));
  }

  rooms(): Room[] {
    const rows = this.db.prepare('SELECT body FROM rooms ORDER BY id').all() as { body: string }[];
    return rows.map((r) => JSON.parse(r.body) as Room);
  }

  room(id: string): Room | null {
    const got = this.db.prepare('SELECT body FROM rooms WHERE id=?').get(id) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as Room) : null;
  }

  /** Every hold on a room, so a clash can be found rather than assumed. */
  holds(room?: string): RoomHold[] {
    const rows = (
      room
        ? this.db.prepare('SELECT body FROM holds WHERE room=? ORDER BY id').all(room)
        : this.db.prepare('SELECT body FROM holds ORDER BY id').all()
    ) as { body: string }[];
    return rows.map((r) => JSON.parse(r.body) as RoomHold);
  }

  hold(id: string): RoomHold | null {
    const got = this.db.prepare('SELECT body FROM holds WHERE id=?').get(id) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as RoomHold) : null;
  }

  saveHold(row: RoomHold): void {
    this.db.prepare('INSERT OR REPLACE INTO holds VALUES(?,?,?)').run(row.id, row.room, JSON.stringify(row));
  }

  /**
   * Give a room back, by removing the row.
   *
   * The first version kept the row and blanked its club, and the room stayed
   * unbookable: the clash check found a hold, saw a club that was not the one
   * asking, and refused on behalf of nobody. A hold nobody holds is not a
   * hold, and the honest way to say that in a table is for the row not to be
   * in it.
   */
  dropHold(id: string): void {
    this.db.prepare('DELETE FROM holds WHERE id=?').run(id);
  }

  spends(club: string): Spend[] {
    const rows = this.db.prepare('SELECT body FROM spends WHERE club=? ORDER BY id').all(club) as { body: string }[];
    return rows.map((r) => JSON.parse(r.body) as Spend);
  }

  spend(id: string): Spend | null {
    const got = this.db.prepare('SELECT body FROM spends WHERE id=?').get(id) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as Spend) : null;
  }

  saveSpend(row: Spend): void {
    this.db.prepare('INSERT OR REPLACE INTO spends VALUES(?,?,?)').run(row.id, row.club, JSON.stringify(row));
  }

  elections(club?: string): Election[] {
    const rows = (
      club
        ? this.db.prepare('SELECT body FROM elections WHERE club=? ORDER BY id').all(club)
        : this.db.prepare('SELECT body FROM elections ORDER BY id').all()
    ) as { body: string }[];
    return rows.map((r) => JSON.parse(r.body) as Election);
  }

  election(id: string): Election | null {
    const got = this.db.prepare('SELECT body FROM elections WHERE id=?').get(id) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as Election) : null;
  }

  /*
   * The two halves of the ballot box, and the reason they are two methods
   * rather than one: there is no call anywhere that wants both, and a single
   * method returning both would be the join this design exists to make
   * impossible. See the header above `Voted`.
   */

  /** The electoral roll: who has voted. Carries no choice. */
  roll(election: string): Voted[] {
    const rows = this.db.prepare('SELECT body FROM roll WHERE election=? ORDER BY id').all(election) as {
      body: string;
    }[];
    return rows.map((r) => JSON.parse(r.body) as Voted);
  }

  /** Whether this person has voted. The only question the roll is asked. */
  hasVoted(election: string, voter: string): boolean {
    const got = this.db.prepare('SELECT 1 AS yes FROM roll WHERE election=? AND voter=?').get(election, voter);
    return got !== undefined;
  }

  /** The box: the papers. Carries no voter. */
  ballots(election: string): Ballot[] {
    const rows = this.db.prepare('SELECT body FROM ballots WHERE election=? ORDER BY id').all(election) as {
      body: string;
    }[];
    return rows.map((r) => JSON.parse(r.body) as Ballot);
  }

  /**
   * Mark the roll and drop the paper, in one transaction.
   *
   * One method because the two writes must not come apart: a marked roll with
   * no paper loses somebody's vote, and a paper with no mark lets them vote
   * again. It takes the two rows already built rather than building the
   * ballot from the voter, so that nothing in this function ever holds a value
   * that could relate one to the other.
   */
  castVote(mark: Voted, paper: Ballot): void {
    this.db.exec('BEGIN');
    try {
      this.db.prepare('INSERT INTO roll VALUES(?,?,?,?)').run(mark.id, mark.election, mark.voter, JSON.stringify(mark));
      this.db.prepare('INSERT INTO ballots VALUES(?,?,?)').run(paper.id, paper.election, JSON.stringify(paper));
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }


  /* ── Athletics ──────────────────────────────────────────────────────── */

  teams(): Team[] {
    const rows = this.db.prepare('SELECT body FROM teams ORDER BY id').all() as { body: string }[];
    return rows.map((r) => JSON.parse(r.body) as Team);
  }

  team(id: string): Team | null {
    const got = this.db.prepare('SELECT body FROM teams WHERE id=?').get(id) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as Team) : null;
  }

  /** The team this person coaches, or null. Asked of the table, never a claim. */
  coaches(userId: string): Team | null {
    const got = this.db.prepare('SELECT body FROM teams WHERE coach=?').get(userId) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as Team) : null;
  }

  saveTeam(row: Team): void {
    this.db.prepare('INSERT OR REPLACE INTO teams VALUES(?,?,?)').run(row.id, row.coachId, JSON.stringify(row));
  }

  athletes(team?: string): Athlete[] {
    const rows = (
      team
        ? this.db.prepare('SELECT body FROM athletes WHERE team=? ORDER BY id').all(team)
        : this.db.prepare('SELECT body FROM athletes ORDER BY id').all()
    ) as { body: string }[];
    return rows.map((r) => JSON.parse(r.body) as Athlete);
  }

  athletesOf(student: string): Athlete[] {
    const rows = this.db.prepare('SELECT body FROM athletes WHERE student=? ORDER BY id').all(student) as {
      body: string;
    }[];
    return rows.map((r) => JSON.parse(r.body) as Athlete);
  }

  saveAthlete(row: Athlete): void {
    this.db
      .prepare('INSERT OR REPLACE INTO athletes VALUES(?,?,?,?)')
      .run(row.id, row.team, row.student, JSON.stringify(row));
  }

  /**
   * Every clearance this person holds, good or lapsed.
   *
   * Deliberately not filtered by date here. Whether a clearance is *good* is a
   * question about a moment, and the moment belongs to whoever is asking — an
   * adapter with a clock, not a store that would have to guess one.
   */
  clearances(student: string): Eligibility[] {
    const rows = this.db.prepare('SELECT body FROM clearances WHERE student=? ORDER BY id').all(student) as {
      body: string;
    }[];
    return rows.map((r) => JSON.parse(r.body) as Eligibility);
  }

  clearance(id: string): Eligibility | null {
    const got = this.db.prepare('SELECT body FROM clearances WHERE id=?').get(id) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as Eligibility) : null;
  }

  saveClearance(row: Eligibility): void {
    this.db
      .prepare('INSERT OR REPLACE INTO clearances VALUES(?,?,?)')
      .run(row.id, row.student, JSON.stringify(row));
  }

  /** Open a student's clearance file, the way `openAccount` opens their bill. */
  openClearances(student: string, at: string): void {
    const put = this.db.prepare('INSERT OR IGNORE INTO clearances VALUES(?,?,?)');
    for (const c of OPENING_CLEARANCES) {
      const row: Eligibility = { ...c, id: `${student}::${c.id}`, student, at, version: 0, history: [] };
      put.run(row.id, student, JSON.stringify(row));
    }
  }

  trips(team?: string): Trip[] {
    const rows = (
      team
        ? this.db.prepare('SELECT body FROM trips WHERE team=? ORDER BY id').all(team)
        : this.db.prepare('SELECT body FROM trips ORDER BY id').all()
    ) as { body: string }[];
    return rows.map((r) => JSON.parse(r.body) as Trip);
  }

  trip(id: string): Trip | null {
    const got = this.db.prepare('SELECT body FROM trips WHERE id=?').get(id) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as Trip) : null;
  }

  saveTrip(row: Trip): void {
    this.db.prepare('INSERT OR REPLACE INTO trips VALUES(?,?,?)').run(row.id, row.team, JSON.stringify(row));
  }

  /** Every place on one coach, so the manifest can be counted rather than stored. */
  seats(trip: string): Seat[] {
    const rows = this.db.prepare('SELECT body FROM seats WHERE trip=? ORDER BY id').all(trip) as { body: string }[];
    return rows.map((r) => JSON.parse(r.body) as Seat);
  }

  saveSeat(row: Seat): void {
    this.db.prepare('INSERT OR REPLACE INTO seats VALUES(?,?,?,?)').run(row.id, row.trip, row.student, JSON.stringify(row));
  }


  /* ── Career, advising and alumni ────────────────────────────────────── */

  employers(): Employer[] {
    const rows = this.db.prepare('SELECT body FROM employers ORDER BY id').all() as { body: string }[];
    return rows.map((r) => JSON.parse(r.body) as Employer);
  }

  employer(id: string): Employer | null {
    const got = this.db.prepare('SELECT body FROM employers WHERE id=?').get(id) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as Employer) : null;
  }

  /**
   * The employer this person may act for, or null.
   *
   * Asked of the server's own table and never of the request. It is the whole
   * of the employer authorization story, which is why it is one function: a
   * second place that decided the same thing is a second place that can come
   * to decide it differently.
   */
  employerOf(owner: string): Employer | null {
    const got = this.db.prepare('SELECT body FROM employers WHERE owner=?').get(owner) as
      | { body: string }
      | undefined;
    return got ? (JSON.parse(got.body) as Employer) : null;
  }

  saveEmployer(row: Employer): void {
    this.db.prepare('INSERT OR REPLACE INTO employers VALUES(?,?,?)').run(row.id, row.owner, JSON.stringify(row));
  }

  listings(): Listing[] {
    const rows = this.db.prepare('SELECT body FROM listings ORDER BY id').all() as { body: string }[];
    return rows.map((r) => JSON.parse(r.body) as Listing);
  }

  listing(id: string): Listing | null {
    const got = this.db.prepare('SELECT body FROM listings WHERE id=?').get(id) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as Listing) : null;
  }

  saveListing(row: Listing): void {
    this.db.prepare('INSERT OR REPLACE INTO listings VALUES(?,?,?)').run(row.id, row.employer, JSON.stringify(row));
  }

  /** Every application to one listing, so the offer count can be derived. */
  applications(listing?: string): Application[] {
    const rows = (
      listing
        ? this.db.prepare('SELECT body FROM applications WHERE listing=? ORDER BY id').all(listing)
        : this.db.prepare('SELECT body FROM applications ORDER BY id').all()
    ) as { body: string }[];
    return rows.map((r) => JSON.parse(r.body) as Application);
  }

  applicationsOf(student: string): Application[] {
    const rows = this.db.prepare('SELECT body FROM applications WHERE student=? ORDER BY id').all(student) as {
      body: string;
    }[];
    return rows.map((r) => JSON.parse(r.body) as Application);
  }

  application(id: string): Application | null {
    const got = this.db.prepare('SELECT body FROM applications WHERE id=?').get(id) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as Application) : null;
  }

  saveApplication(row: Application): void {
    this.db
      .prepare('INSERT OR REPLACE INTO applications VALUES(?,?,?,?)')
      .run(row.id, row.listing, row.student, JSON.stringify(row));
  }

  slots(): Slot[] {
    const rows = this.db.prepare('SELECT body FROM slots ORDER BY id').all() as { body: string }[];
    return rows.map((r) => JSON.parse(r.body) as Slot);
  }

  slot(id: string): Slot | null {
    const got = this.db.prepare('SELECT body FROM slots WHERE id=?').get(id) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as Slot) : null;
  }

  saveSlot(row: Slot): void {
    this.db.prepare('INSERT OR REPLACE INTO slots VALUES(?,?)').run(row.id, JSON.stringify(row));
  }

  bookings(slot?: string): Booking[] {
    const rows = (
      slot
        ? this.db.prepare('SELECT body FROM bookings WHERE slot=? ORDER BY id').all(slot)
        : this.db.prepare('SELECT body FROM bookings ORDER BY id').all()
    ) as { body: string }[];
    return rows.map((r) => JSON.parse(r.body) as Booking);
  }

  bookingsOf(student: string): Booking[] {
    const rows = this.db.prepare('SELECT body FROM bookings WHERE student=? ORDER BY id').all(student) as {
      body: string;
    }[];
    return rows.map((r) => JSON.parse(r.body) as Booking);
  }

  saveBooking(row: Booking): void {
    this.db
      .prepare('INSERT OR REPLACE INTO bookings VALUES(?,?,?,?)')
      .run(row.id, row.slot, row.student, JSON.stringify(row));
  }

  mentors(): Mentor[] {
    const rows = this.db.prepare('SELECT body FROM mentors ORDER BY id').all() as { body: string }[];
    return rows.map((r) => JSON.parse(r.body) as Mentor);
  }

  mentor(id: string): Mentor | null {
    const got = this.db.prepare('SELECT body FROM mentors WHERE id=?').get(id) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as Mentor) : null;
  }

  saveMentor(row: Mentor): void {
    this.db.prepare('INSERT OR REPLACE INTO mentors VALUES(?,?)').run(row.id, JSON.stringify(row));
  }

  mentorships(mentor?: string): Mentorship[] {
    const rows = (
      mentor
        ? this.db.prepare('SELECT body FROM mentorships WHERE mentor=? ORDER BY id').all(mentor)
        : this.db.prepare('SELECT body FROM mentorships ORDER BY id').all()
    ) as { body: string }[];
    return rows.map((r) => JSON.parse(r.body) as Mentorship);
  }

  mentorshipsOf(student: string): Mentorship[] {
    const rows = this.db.prepare('SELECT body FROM mentorships WHERE student=? ORDER BY id').all(student) as {
      body: string;
    }[];
    return rows.map((r) => JSON.parse(r.body) as Mentorship);
  }

  mentorship(id: string): Mentorship | null {
    const got = this.db.prepare('SELECT body FROM mentorships WHERE id=?').get(id) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as Mentorship) : null;
  }

  saveMentorship(row: Mentorship): void {
    this.db
      .prepare('INSERT OR REPLACE INTO mentorships VALUES(?,?,?,?)')
      .run(row.id, row.mentor, row.student, JSON.stringify(row));
  }


  /* ── Family access ──────────────────────────────────────────────────── */

  /** Every grant this student has made. */
  grantsBy(student: string): FamilyGrant[] {
    const rows = this.db.prepare('SELECT body FROM grants WHERE student=? ORDER BY id').all(student) as {
      body: string;
    }[];
    return rows.map((r) => JSON.parse(r.body) as FamilyGrant);
  }

  /** Every grant made to this person. */
  grantsTo(recipient: string): FamilyGrant[] {
    const rows = this.db.prepare('SELECT body FROM grants WHERE recipient=? ORDER BY id').all(recipient) as {
      body: string;
    }[];
    return rows.map((r) => JSON.parse(r.body) as FamilyGrant);
  }

  grant(id: string): FamilyGrant | null {
    const got = this.db.prepare('SELECT body FROM grants WHERE id=?').get(id) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as FamilyGrant) : null;
  }

  saveGrant(row: FamilyGrant): void {
    this.db
      .prepare('INSERT OR REPLACE INTO grants VALUES(?,?,?,?)')
      .run(row.id, row.studentId, row.recipientId, JSON.stringify(row));
  }

  /* ── Money ──────────────────────────────────────────────────────────── */

  charges(student: string): Charge[] {
    const rows = this.db.prepare('SELECT body FROM charges WHERE student=? ORDER BY id').all(student) as {
      body: string;
    }[];
    return rows.map((r) => JSON.parse(r.body) as Charge);
  }

  charge(id: string): Charge | null {
    const got = this.db.prepare('SELECT body FROM charges WHERE id=?').get(id) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as Charge) : null;
  }

  saveCharge(row: Charge): void {
    this.db.prepare('INSERT OR REPLACE INTO charges VALUES(?,?,?)').run(row.id, row.student, JSON.stringify(row));
  }

  awards(student: string): Award[] {
    const rows = this.db.prepare('SELECT body FROM awards WHERE student=? ORDER BY id').all(student) as {
      body: string;
    }[];
    return rows.map((r) => JSON.parse(r.body) as Award);
  }

  award(id: string): Award | null {
    const got = this.db.prepare('SELECT body FROM awards WHERE id=?').get(id) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as Award) : null;
  }

  saveAward(row: Award): void {
    this.db.prepare('INSERT OR REPLACE INTO awards VALUES(?,?,?)').run(row.id, row.student, JSON.stringify(row));
  }

  /**
   * The bill and the aid this student has, made the first time they look.
   *
   * A demonstration where the money screens are empty until somebody runs a
   * seeding script is a demonstration nobody sees. Made on read, keyed to the
   * student, and idempotent — `INSERT OR IGNORE` semantics via a check, so
   * looking twice does not double a bill.
   */
  openAccount(student: string, at: string): void {
    if (this.charges(student).length || this.awards(student).length) return;
    for (const c of OPENING_CHARGES) {
      this.saveCharge({ ...c, id: `${student}::${c.id}`, student, paid: 0, at, version: 0, history: [] });
    }
    for (const a of OPENING_AWARDS) {
      this.saveAward({ ...a, id: `${student}::${a.id}`, student, at, version: 0, history: [] });
    }
  }

  /** Every enrolment, so a seat count can be derived rather than stored. */
  enrolments(section?: string): Enrolment[] {
    const rows = (
      section
        ? this.db.prepare('SELECT body FROM enrolments WHERE section=? ORDER BY id').all(section)
        : this.db.prepare('SELECT body FROM enrolments ORDER BY id').all()
    ) as { body: string }[];
    return rows.map((r) => JSON.parse(r.body) as Enrolment);
  }

  enrolmentsOf(student: string): Enrolment[] {
    const rows = this.db.prepare('SELECT body FROM enrolments WHERE student=? ORDER BY id').all(student) as {
      body: string;
    }[];
    return rows.map((r) => JSON.parse(r.body) as Enrolment);
  }

  saveEnrolment(row: Enrolment): void {
    this.db
      .prepare('INSERT OR REPLACE INTO enrolments VALUES(?,?,?,?)')
      .run(row.id, row.student, row.section, JSON.stringify(row));
  }

  /** Everything published in this course, oldest first. */
  published(): Assignment[] {
    const rows = this.db.prepare('SELECT body FROM assignments ORDER BY at, id').all() as {
      body: string;
    }[];
    return rows.map((r) => JSON.parse(r.body) as Assignment);
  }

  assignment(id: string): Assignment | undefined {
    const got = this.db.prepare('SELECT body FROM assignments WHERE id=?').get(id) as
      | { body: string }
      | undefined;
    return got ? (JSON.parse(got.body) as Assignment) : undefined;
  }

  /** What this course does about late work, or nothing if it has not said. */
  policy(): LatePolicy | null {
    const got = this.db.prepare("SELECT body FROM settings WHERE id='late'").get() as
      | { body: string }
      | undefined;
    return got ? (JSON.parse(got.body) as LatePolicy) : null;
  }

  setPolicy(p: LatePolicy): void {
    this.db
      .prepare("INSERT INTO settings VALUES('late',?) ON CONFLICT(id) DO UPDATE SET body=excluded.body")
      .run(JSON.stringify(p));
  }

  /** The published syllabus, or nothing if nobody has written one. */
  syllabus(): Syllabus | null {
    const got = this.db.prepare("SELECT body FROM settings WHERE id='syllabus'").get() as
      | { body: string }
      | undefined;
    return got ? (JSON.parse(got.body) as Syllabus) : null;
  }

  setSyllabus(v: Syllabus): void {
    this.db
      .prepare("INSERT INTO settings VALUES('syllabus',?) ON CONFLICT(id) DO UPDATE SET body=excluded.body")
      .run(JSON.stringify(v));
  }

  publish(a: Assignment, at: string): void {
    this.db.prepare('INSERT INTO assignments VALUES(?,?,?)').run(a.id, at, JSON.stringify(a));
  }

  close(): void {
    this.db.close();
  }

  /** Everybody the course has, in the order they joined. */
  roster(): { student: string; name: string; joinedAt: string }[] {
    return this.db
      .prepare('SELECT student, name, joinedAt FROM roster ORDER BY joinedAt, student')
      .all() as { student: string; name: string; joinedAt: string }[];
  }

  enrolled(student: string): boolean {
    return Boolean(this.db.prepare('SELECT 1 FROM roster WHERE student=?').get(student));
  }

  add(student: string, name: string, at: string): void {
    this.db.prepare('INSERT OR IGNORE INTO roster VALUES(?,?,?)').run(student, name, at);
  }

  /**
   * This student's row for this assignment — stored, or the empty one it
   * would be.
   *
   * It does **not** write, and the earlier version did. A row that does not
   * exist and a row at `published` are the same situation — nothing has
   * happened — so materialising one on a read bought nothing and cost two
   * things: every faculty list became a write, and the stored set of rows was
   * a record of who had *looked* rather than of who was enrolled. The roster
   * answers the second question now, and this answers only the first.
   */
  private row(student: string, assignment: string): Work {
    const id = `${student}:${assignment}`;
    const got = this.db.prepare('SELECT body FROM work WHERE id=?').get(id) as
      | { body: string }
      | undefined;
    if (got) return JSON.parse(got.body) as Work;
    const fresh: Work = {
      id,
      student,
      assignment,
      stage: 'published',
      version: 1,
      enrolledAt: null,
      submittedAt: null,
      body: '',
      mark: '',
      marks: {},
      comments: '',
      gradedAt: null,
      releasedAt: null,
      archivedAt: null,
      appeal: null,
      history: [],
    };
    return fresh;
  }

  /** Written on commit, which is the only thing that creates a row. */
  private save(work: Work): void {
    this.db
      .prepare('INSERT INTO work VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body')
      .run(work.id, work.student, work.assignment, JSON.stringify(work));
  }

  mine(student: string): Work[] {
    return this.published().map((a) => this.row(student, a.id));
  }

  /**
   * Every enrolled student's row for every published assignment.
   *
   * From the roster rather than from the work table, so a student who has
   * never opened the app is in a marker's list with nothing submitted — which
   * is the entire reason the roster exists.
   */
  everyWork(): Work[] {
    const work = this.published();
    return this.roster().flatMap((r) => work.map((a) => this.row(r.student, a.id)));
  }

  one(student: string, assignment: string): Work {
    return this.row(student, assignment);
  }

  byId(id: string): Work | null {
    const got = this.db.prepare('SELECT body FROM work WHERE id=?').get(id) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as Work) : null;
  }

  /**
   * A thread's posts, filtered to what this person may read.
   *
   * The filter is here, in the store, rather than in the adapter that draws
   * the record — so there is one place to get it wrong instead of three, and
   * a caller cannot forget it by reaching for the rows directly.
   */
  posts(thread: string, reader: string, faculty: boolean): Post[] {
    const rows = this.db
      .prepare('SELECT body FROM posts WHERE thread=? ORDER BY at, id')
      .all(thread) as { body: string }[];
    return rows
      .map((r) => JSON.parse(r.body) as Post)
      .filter((p) => p.audience === 'class' || faculty || p.who === reader);
  }

  say(post: Post): void {
    this.db.prepare('INSERT INTO posts VALUES(?,?,?,?)').run(post.id, post.thread, post.at, JSON.stringify(post));
  }

  /**
   * Write a receipt down, so `already` can answer for this key next time.
   *
   * Its own method because two paths issue receipts — a transition on a work
   * row, and a post — and the second was written without it. A retry after a
   * dropped connection then re-ran the insert and died on the primary key,
   * which is the same failure the idempotency guard exists to prevent, wearing
   * a database error instead of a duplicate submission.
   */
  keep(receipt: Receipt): void {
    this.db.prepare('INSERT OR IGNORE INTO receipts VALUES(?,?)').run(receipt.id, JSON.stringify(receipt));
  }

  receipt(key: string): Receipt | null {
    const got = this.db.prepare('SELECT body FROM receipts WHERE key=?').get(key) as
      | { body: string }
      | undefined;
    return got ? (JSON.parse(got.body) as Receipt) : null;
  }

  /** Apply a transition to one row, and write its receipt under `key`. */
  commit(
    work: Work,
    key: string,
    who: string,
    what: string,
    at: string,
    change: (w: Work) => void,
    note = '',
  ): Receipt {
    return this.commitAll([work], key, who, what, at, change, note);
  }

  /**
   * The same, over every row a single action touches.
   *
   * Enrolling touches both assignments at once, and the first version of that
   * wrote a receipt per row under a composite key — which meant enrolment was
   * the one action whose repeat was caught somewhere other than `already()`,
   * and a mutation removing the check inside this method survived because the
   * other three no longer needed it. One receipt, under the key the gateway
   * handed down, for all four.
   */
  commitAll(
    rows: Work[],
    key: string,
    who: string,
    what: string,
    at: string,
    change: (w: Work) => void,
    /**
     * A sentence for the receipt, stored with it rather than added to the
     * copy that is handed back.
     *
     * Its own parameter because the first version decorated the returned
     * receipt after this method had already written the plain one — so the
     * receipt a retry produced disagreed with the receipt the first attempt
     * produced, about whether the work was late. A receipt is evidence; two
     * versions of it is the one thing it cannot be.
     */
    note = '',
  ): Receipt {
    for (const work of rows) {
      change(work);
      work.version += 1;
      work.history.push({ at, who, what, receipt: key });
      this.save(work);
    }
    const receipt: Receipt = {
      id: key,
      status: 'completed',
      message: `${SANDBOX_MARK} · ${what}.${note ? ` ${note}.` : ''} Nothing here reaches a real institution.`,
      recordedAt: at,
    };
    this.keep(receipt);
    return receipt;
  }
}

/* ── The four adapters ────────────────────────────────────────────────── */

const assignmentOf = (store: SandboxStore, id: string) => store.assignment(id);

const isFaculty = (context: AdapterContext) => context.identity.roles.includes('faculty');
export const isStudent = (context: AdapterContext) => context.identity.roles.includes('student');

/**
 * The row a record id names, if this person is allowed to see it at all.
 *
 * A student's own row is *made* here rather than looked up, because a row
 * that does not exist yet and a row at `published` are the same situation —
 * nothing has happened — and requiring an enrolment write before a student
 * can read their own assignment would make the first read a write.
 *
 * Everybody else gets a lookup, so this can only ever hand back a row that
 * already exists. Splitting on the last colon rather than the first: a user
 * id is opaque and may contain one, and a split that guessed wrong would
 * resolve one person's id to another person's row — which is the bug the
 * ownership check below exists to catch, arriving one step earlier.
 */
function rowFor(store: SandboxStore, context: AdapterContext, id: string): Work | null {
  const cut = id.lastIndexOf(':');
  if (cut <= 0) return null;
  const student = id.slice(0, cut);
  const assignment = id.slice(cut + 1);
  if (!assignmentOf(store, assignment)) return null;
  if (isStudent(context) && student === context.identity.userId) return store.one(student, assignment);
  return store.byId(id);
}

/**
 * The same connection answer for all four, differing only in what the person
 * may write. `canWrite` is per role rather than per account, because a
 * student can submit and cannot mark, and the screen should say which before
 * somebody goes looking for a button that is not theirs.
 */
export function connection(area: UniversityArea, context: AdapterContext, write: boolean): ConnectionStatus {
  return {
    area,
    state: 'connected',
    provider: `${SANDBOX_MARK} — demonstration adapter, not a university system`,
    canRead: true,
    canWrite: write,
    lastSyncAt: new Date().toISOString(),
    permissions: context.identity.roles.map((r) => `sandbox:${r}`),
    message:
      'A sandbox course for demonstrating the submit → receipt → grade → feedback → archive loop. ' +
      'No credit is awarded and no record here is an official one.',
  };
}

export const page = (records: UniversityRecord[]): RecordPage => ({
  records,
  nextCursor: null,
  fetchedAt: new Date().toISOString(),
});

/** Free-text search over what a person can read on the record itself. */
export const matching = (records: UniversityRecord[], search: string) => {
  const q = search.trim().toLowerCase();
  if (!q) return records;
  return records.filter((r) => `${r.title} ${r.summary} ${r.status}`.toLowerCase().includes(q));
};

/**
 * The refusal every adapter makes before anything else.
 *
 * Its own function because the same four checks are the whole authorization
 * story and writing them four times is how one of them comes to differ.
 */
function allow(
  context: AdapterContext,
  work: Work | null,
  needs: 'student' | 'faculty',
  store?: SandboxStore,
): Work {
  /*
   * The role first, and the record's existence second.
   *
   * Both orders refuse, so this looks like a style choice and is not: asked
   * the other way round, somebody with no business here learns whether a
   * record exists from which refusal they get. It also gives the honest
   * message — a faculty member who tried to submit is told that submitting
   * is a student's action, rather than that their own coursework is missing,
   * which is true and useless.
   */
  if (needs === 'faculty' && !isFaculty(context)) {
    throw new Refusal('Only the course faculty can do that.');
  }
  if (needs === 'student' && !isStudent(context)) {
    throw new Refusal('Only an enrolled student can do that.');
  }
  if (needs === 'student' && store && !store.enrolled(context.identity.userId)) {
    /*
     * Before the roster existed there was nothing to be enrolled *in*, so
     * anybody holding the student role could submit to this course. A test
     * with a user called `gatecrasher-1` walked straight in.
     */
    throw new Refusal('You are not on this course’s roster. Enrol first.');
  }
  if (!work) throw new Refusal('No such record in the sandbox course.');
  if (needs === 'student') {
    // The check that matters: a well-formed id for somebody else's work is
    // the oldest bug in this shape of API, and the id is client-supplied.
    if (work.student !== context.identity.userId) throw new Refusal('That is not your work.');
  }
  return work;
}

/**
 * Has this exact operation already been done?
 *
 * Asked *before* the version check and before the state machine, and that
 * order is the whole point rather than an optimisation. The case this exists
 * for is: execute ran, it worked, the connection died on the way back, and
 * the gateway retried with the same idempotency key. By then the version has
 * moved — the first attempt moved it — so a version check reached first
 * answers "this record has changed" to a person whose submission is sitting
 * safely in the store. They would submit again, or be told their work was
 * lost. The first test written for this failed exactly that way.
 */
export function already(store: SandboxStore, key: string): Receipt | null {
  return store.receipt(key);
}

/**
 * Whether an appeal action is possible on this record at all.
 *
 * One function for all three, because the states they need are the same
 * question asked from two sides and writing it out three times is how one of
 * them comes to differ.
 */
function openable(work: Work, actionId: string): void {
  if (work.stage === 'archived') {
    throw new Refusal('This record is archived. The time to appeal it has passed.');
  }
  if (actionId === 'appeal') {
    if (work.stage !== 'released') {
      throw new Refusal('There is no released mark to appeal yet.');
    }
    if (work.appeal) throw new Refusal('This mark is already under appeal, or has already been answered.');
    return;
  }
  if (work.appeal?.state !== 'open') {
    throw new Refusal('This mark is not under appeal, or the appeal has already been answered.');
  }
}

/** Refuse an action prepared against a record that has since moved. */
function fresh(work: Work, input: ActionInput): void {
  if (input.version !== String(work.version)) {
    throw new Refusal('This record has changed since you opened it. Open it again to see the current state.');
  }
}

function expect(work: Work, stage: Stage, what: string): void {
  if (work.stage === 'archived') throw new Refusal('This record is archived and cannot be changed.');
  if (work.stage !== stage) throw new Refusal(`Cannot ${what} — this is ${SAID[work.stage].toLowerCase()}.`);
}

/**
 * Every criterion's mark, or a refusal naming the one that is wrong.
 *
 * A missing criterion is an error rather than a zero. A marker who left a box
 * empty has not decided it is worth nothing — they have not finished — and
 * writing a zero on their behalf is the kind of helpfulness that ends up on a
 * transcript.
 */
function readMarks(criteria: readonly Criterion[], fields: Record<string, string>): Record<string, number> {
  const marks: Record<string, number> = {};
  for (const c of criteria) {
    const raw = fields[c.id];
    if (raw === undefined || raw.trim() === '') throw new Refusal(`${c.name} has not been marked.`);
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > c.outOf) {
      throw new Refusal(`${c.name} must be between 0 and ${c.outOf}.`);
    }
    marks[c.id] = n;
  }
  return marks;
}

/**
 * A marking scheme as somebody would paste it, into criteria.
 *
 * One line each, `Name | marks | what it means`. The alternative within this
 * contract was a fixed number of criterion slots — `ActionField` has no
 * repeating group — and three slots would have been a rubric with exactly
 * three criteria, which is not a rubric, it is a form.
 *
 * Parsing free text is the risk, and the two-phase action is what makes it
 * safe: `review` reads it back — every criterion, every mark, the total — and
 * nothing is published until somebody has looked at that and confirmed. A
 * line that does not parse is refused with the line quoted, at prepare, so
 * the person fixing it can see which one.
 */
function readRubric(text: string): Criterion[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) throw new Refusal('A rubric needs at least one criterion.');
  const criteria: Criterion[] = [];
  for (const line of lines) {
    const parts = line.split('|').map((x) => x.trim());
    if (parts.length !== 3 || !parts[0] || !parts[2]) {
      throw new Refusal(`Write each criterion as "Name | marks | what it means". This one is not: "${line}"`);
    }
    const outOf = Number(parts[1]);
    if (!Number.isInteger(outOf) || outOf <= 0) {
      throw new Refusal(`"${parts[0]}" needs a whole number of marks above zero, not "${parts[1]}".`);
    }
    const id = parts[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    // The id becomes a field id on the marking form, and the gateway's own
    // validator will not accept one that does not match its pattern — so it
    // is checked here, where the message can say which name caused it.
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(id)) {
      throw new Refusal(`"${parts[0]}" needs a name with some letters in it.`);
    }
    if (criteria.some((c) => c.id === id)) throw new Refusal(`Two criteria are both called "${parts[0]}".`);
    criteria.push({ id, name: parts[0], outOf, means: parts[2] });
  }
  return criteria;
}

/**
 * What a new piece is worth, or a refusal naming how much of the course is
 * actually left.
 *
 * The refusal is the interesting half. Nothing stops a course from publishing
 * four pieces at forty percent each except somebody checking, and a course
 * whose weights add to a hundred and sixty cannot report a standing at all —
 * every fraction it prints is a fraction of a course that does not exist.
 * Refusing at publish is the only place it can be caught while it is still one
 * person's typing error rather than the whole class's arithmetic.
 */
function readWeight(store: SandboxStore, raw: string): number {
  const said = raw.trim();
  if (!said) throw new Refusal('Say what this is worth, as a percentage of the course.');
  const weight = Number(said);
  if (!Number.isFinite(weight)) throw new Refusal(`"${said}" is not a percentage this can read.`);
  if (weight <= 0) throw new Refusal('A piece of work needs a share of the course above zero.');
  const left = 100 - store.published().reduce((n, a) => n + a.weight, 0);
  if (weight > left + DUST) {
    throw new Refusal(`Only ${pct(left)} of this course is unpublished, and this asks for ${pct(weight)}.`);
  }
  return weight;
}

/**
 * A late-work policy out of the fields, or a refusal naming the number.
 *
 * The interesting refusal is the last one. A recorded mark is evidence, and
 * the policy is half of what produced it — the mark is computed from the
 * rubric and the rate rather than stored, precisely so the two can never
 * disagree. Change the rate afterwards and every mark already released
 * silently restates itself: nobody is told, and the number on the record stops
 * matching the number the student was shown. So the course may decide its
 * policy right up until the first mark goes out under it, and not after.
 */
function readPolicy(store: SandboxStore, context: AdapterContext, input: ActionInput): LatePolicy {
  if (!isFaculty(context)) throw new Refusal('Only the course faculty can set what late work costs.');
  const already = store.everyWork().some((w) => w.stage === 'released' || w.stage === 'archived');
  if (already) {
    throw new Refusal(
      'A mark has already been released under this course’s current policy, and changing it now would ' +
        'restate that mark without telling anybody.',
    );
  }
  const read = (id: string, what: string) => {
    const raw = (input.fields[id] ?? '').trim();
    if (!raw) throw new Refusal(`Say ${what}.`);
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Refusal(`"${raw}" is not a percentage this can read.`);
    if (n < 0 || n > 100) throw new Refusal(`${what[0].toUpperCase()}${what.slice(1)} must be between 0 and 100.`);
    return n;
  };
  return {
    perDay: read('perDay', 'how much a day late costs'),
    cap: read('cap', 'the most a late penalty can reach'),
    setAt: new Date().toISOString(),
    setBy: context.identity.userId,
  };
}

/**
 * A syllabus out of the fields, or a refusal naming the section left blank.
 *
 * The rule worth reading is the note. A syllabus is a contract with a class,
 * and the complaint people have about one is never that it changed — courses
 * change — it is that it changed and nobody said. So every revision after the
 * first carries what changed, the class reads it on the record, and a silent
 * edit is refused rather than accepted quietly.
 */
function readSyllabus(store: SandboxStore, context: AdapterContext, input: ActionInput): Syllabus {
  if (!isFaculty(context)) throw new Refusal('Only the course faculty can publish the syllabus.');
  const section = (id: string, what: string) => {
    const said = (input.fields[id] ?? '').trim();
    if (!said) throw new Refusal(`Say ${what}.`);
    return said;
  };
  const before = store.syllabus();
  const note = (input.fields.note ?? '').trim();
  if (before && !note) {
    throw new Refusal('Say what changed. A syllabus that is revised without saying so is the thing people complain about.');
  }
  return {
    about: section('about', 'what the course is about'),
    meets: section('meets', 'when the course meets'),
    officeHours: section('officeHours', 'when somebody can be asked a question'),
    collaboration: section('collaboration', 'what counts as working together and what counts as copying'),
    contact: section('contact', 'where to ask'),
    revision: (before?.revision ?? 0) + 1,
    note,
    at: new Date().toISOString(),
    by: context.identity.userId,
  };
}

/** How the marks add up, read off what is published rather than retyped. */
function assessment(store: SandboxStore): { label: string; value: string }[] {
  const out = store.published().map((a) => ({
    label: a.title,
    value: `${pct(a.weight)} of the course, marked out of ${outOf(a.criteria)}`,
  }));
  const left = 100 - store.published().reduce((n, a) => n + a.weight, 0);
  return left > DUST
    ? [...out, { label: 'Still to come', value: `${pct(left)} of the course has not been published yet.` }]
    : out;
}

/** The syllabus as a record, published or not. */
function syllabusRecord(store: SandboxStore): UniversityRecord {
  const v = store.syllabus();
  return {
    id: 'syllabus',
    area: 'courses',
    title: `${SANDBOX_MARK} · ${COURSE.code} — syllabus`,
    summary: v?.about ?? COURSE.about,
    // Not an empty document dressed as a published one. A course with no
    // syllabus should say so, because "there isn't one yet" is an answer and
    // a blank page is not.
    status: v
      ? `Revision ${v.revision}, ${v.at.slice(0, 10)}`
      : 'Not yet published — the course faculty have not written one',
    version: String(v?.revision ?? 0),
    updatedAt: new Date().toISOString(),
    details: v
      ? [
          { label: 'About', value: v.about },
          { label: 'Meets', value: v.meets },
          { label: 'Office hours', value: v.officeHours },
          { label: 'Working together', value: v.collaboration },
          { label: 'Where to ask', value: v.contact },
          { label: 'Late work', value: policySaid(store.policy()) },
          ...assessment(store),
          ...(v.note ? [{ label: `What changed in revision ${v.revision}`, value: v.note }] : []),
        ]
      : [{ label: 'Nothing here yet', value: 'The course faculty have not published a syllabus.' }],
    actions: [],
  };
}

/** A new assignment out of the fields, or a refusal saying which one is wrong. */
function readAssignment(store: SandboxStore, input: ActionInput): Assignment {
  const title = (input.fields.title ?? '').trim();
  const brief = (input.fields.brief ?? '').trim();
  const due = (input.fields.due ?? '').trim();
  if (!title) throw new Refusal('An assignment needs a title.');
  if (!brief) throw new Refusal('Say what the work is, however briefly.');
  const when = Date.parse(due);
  if (!Number.isFinite(when)) throw new Refusal(`"${due}" is not a date this can read.`);
  if (when < Date.now()) throw new Refusal('That deadline has already passed.');
  const criteria = readRubric(input.fields.rubric ?? '');
  const weight = readWeight(store, input.fields.weight ?? '');
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(id)) throw new Refusal('The title needs some letters in it.');
  if (store.assignment(id)) throw new Refusal(`Something called "${title}" is already published.`);
  return { id, title, due: new Date(when).toISOString(), brief, weight, criteria };
}

/** Who may speak in a thread, and as whom. */
function speaker(context: AdapterContext, store: SandboxStore) {
  const faculty = isFaculty(context);
  if (!faculty && !store.enrolled(context.identity.userId)) {
    throw new Refusal('Only the class can read or post here.');
  }
  const row = store.roster().find((r) => r.student === context.identity.userId);
  return { faculty, name: faculty ? COURSE.faculty : (row?.name ?? context.identity.userId) };
}

function chosen(input: ActionInput): Audience {
  const said = input.fields.audience ?? '';
  const audience = AUDIENCE[said];
  if (!audience) throw new Refusal('Choose who sees this: the class, or staff only.');
  return audience;
}

function reviewPost(
  context: AdapterContext,
  store: SandboxStore,
  input: ActionInput,
  thread: Thread,
) {
  const { faculty } = speaker(context, store);
  const audience = chosen(input);
  const body = (input.fields.body ?? '').trim();
  if (!body) throw new Refusal('There is nothing to post.');
  return {
    title: `${faculty ? 'Answer' : 'Ask'} in ${thread.title}`,
    details: [
      { label: 'Thread', value: thread.title },
      {
        label: 'Who will see it',
        value:
          audience === 'class'
            ? 'Everybody on the roster, and the faculty.'
            : 'The faculty only. Nobody else in the class.',
      },
      /*
       * Said at prepare, because this is the one action in the sandbox whose
       * mistake cannot be undone by a later one: posts are append-only, and a
       * question meant for staff that went to the class has been read by the
       * time anybody notices.
       */
      { label: 'After this', value: 'A post cannot be edited or taken back.' },
    ],
  };
}

function post(
  context: AdapterContext,
  store: SandboxStore,
  input: ActionInput,
  thread: Thread,
  key: string,
): Receipt {
  const { faculty, name } = speaker(context, store);
  const audience = chosen(input);
  const body = (input.fields.body ?? '').trim();
  if (!body) throw new Refusal('There is nothing to post.');
  const at = new Date().toISOString();
  store.say({
    id: key,
    thread: threadId(thread.id),
    at,
    who: context.identity.userId,
    name,
    fromFaculty: faculty,
    audience,
    body,
  });
  const receipt: Receipt = {
    id: key,
    status: 'completed',
    message:
      `${SANDBOX_MARK} · Posted to ${thread.title}, visible to ` +
      `${audience === 'class' ? 'the class' : 'the faculty only'}.`,
    recordedAt: at,
  };
  store.keep(receipt);
  return receipt;
}

/**
 * Whether a piece of work met its deadline, worked out rather than stored.
 *
 * Derived from the two timestamps it already has, so it cannot disagree with
 * them — a stored `late` flag and a `submittedAt` are two facts that can drift,
 * and only one of them is evidence.
 *
 * **It does not refuse a late submission**, and that is the design rather than
 * an omission. Plenty of courses take late work with a penalty, some take it
 * up to a cut-off, some do not take it at all; a sandbox that hard-refused
 * would be modelling one policy as though it were the only one, which is the
 * kind of quiet assumption this whole package is written against. What it does
 * is record the truth and say it out loud to both sides, and leave the policy
 * to the course.
 */
function lateness(submittedAt: string | null, due: string): { late: boolean; said: string } {
  if (!submittedAt) {
    const over = Date.parse(due) < Date.now();
    return { late: over, said: over ? 'Overdue — not submitted' : 'Not submitted yet' };
  }
  const by = Date.parse(submittedAt) - Date.parse(due);
  if (by <= 0) return { late: false, said: `On time, with ${spanOf(-by)} to spare` };
  return { late: true, said: `Late by ${spanOf(by)}` };
}

/** A gap in milliseconds, in the largest unit that does not read as absurd. */
function spanOf(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60_000));
  if (mins < 60) return `${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** The trail, as the details a record carries. This is the Record stage. */
function trail(work: Work): { label: string; value: string }[] {
  return work.history.map((h) => ({
    label: new Date(h.at).toISOString().slice(0, 16).replace('T', ' '),
    value: `${h.what} · ${h.who} · receipt ${h.receipt.slice(0, 12)}`,
  }));
}

/**
 * The course as the person marking it needs to see it: the class's queue.
 *
 * This is what the course record used to say to *everybody*, which was the
 * bug. It is exactly right for one reader and wrong for all the others.
 */
function classFace(store: SandboxStore, roll: number): { label: string; value: string }[] {
  const work = store.everyWork();
  return store.published().map((a) => {
    const rows = work.filter((w) => w.assignment === a.id);
    const missing = rows.filter((w) => w.stage === 'published');
    const inHand = rows.length - missing.length;
    const toMark = rows.filter((w) => w.stage === 'submitted').length;
    // Outstanding and overdue are different facts and a course runs on the
    // difference: one is work still coming, the other is work that is not.
    const overdue = Date.parse(a.due) < Date.now() ? missing.length : 0;
    return {
      label: a.title,
      value:
        `worth ${pct(a.weight)} of the course · due ${a.due.slice(0, 10)} · ` +
        `${inHand} of ${roll} in hand · ${missing.length} outstanding` +
        `${overdue ? ` (${overdue} overdue)` : ''} · ${toMark} to mark`,
    };
  });
}

/**
 * The course as the person taking it needs to see it: their own work, and
 * where it has got them.
 *
 * Two things this deliberately does not say, and the second is a rule rather
 * than a choice of emphasis.
 *
 *  - **How the rest of the class is doing.** The marker's queue was on this
 *    record for everybody, and on a class of four "3 of 4 in hand · 1
 *    outstanding" tells an enrolled student exactly how many of their
 *    classmates have not handed in. That is a fact about other people,
 *    published to someone with no business in it, and on a small class it is
 *    one step away from a name.
 *  - **A mark that has not been released.** A standing that moved when the
 *    marking was done rather than when it was shown would release the mark
 *    through the back door: the student would not be shown the number, but
 *    they could subtract their way to it. "Not released" has to mean not
 *    counted, or it means nothing.
 */
function studentFace(
  context: AdapterContext,
  store: SandboxStore,
  on: boolean,
): { label: string; value: string }[] {
  const mine = store.mine(context.identity.userId);
  const pieces = store.published().map((a) => {
    const work = mine.find((w) => w.assignment === a.id);
    const seen = work?.stage === 'released' || work?.stage === 'archived';
    return {
      label: a.title,
      value:
        `worth ${pct(a.weight)} of the course · due ${a.due.slice(0, 10)}` +
        // Before enrolling this is the syllabus: what the work is and what it
        // is worth. There is no "your" anything until there is a roster row.
        (on && work ? ` · ${SAID[work.stage]}` : '') +
        (seen && work ? ` · ${recorded(work, a.due, outOf(a.criteria), store.policy())} of ${outOf(a.criteria)}` : ''),
    };
  });
  if (!on) return pieces;

  const marked = store.published().filter((a) => {
    const work = mine.find((w) => w.assignment === a.id);
    return work?.stage === 'released' || work?.stage === 'archived';
  });
  const share = marked.reduce((n, a) => n + a.weight, 0);
  // The recorded mark, not the one before the penalty. A standing built from
  // the rubric mark would disagree with every record it is a summary of.
  const earned = marked.reduce((n, a) => {
    const work = mine.find((w) => w.assignment === a.id);
    return n + (work ? recorded(work, a.due, outOf(a.criteria), store.policy()) : 0);
  }, 0);
  const possible = marked.reduce((n, a) => n + outOf(a.criteria), 0);
  return [
    ...pieces,
    {
      label: 'Marked so far',
      value: marked.length
        ? `${earned} of ${possible} marks. ${pct(share)} of this course has been marked.`
        : 'Nothing has been marked yet. 0% of this course has been marked.',
    },
    /*
     * And the remainder, said out loud, because the alternative is a number
     * that reads like a grade. Seventeen out of twenty on a fifth of a course
     * is not an eighty-five — it is seventeen out of twenty, and the other
     * four fifths have not happened. The app projects a term elsewhere, with a
     * band and its name on it (`lib/termgpa.ts`); an institutional record
     * states what happened and stops.
     */
    ...(marked.length
      ? [
          {
            label: 'Not a course grade',
            value: `${pct(100 - share)} of this course has not been marked, and nothing here guesses at it.`,
          },
        ]
      : []),
  ];
}

function courseRecord(context: AdapterContext, store: SandboxStore): UniversityRecord {
  /*
   * Being on the roster *is* being enrolled. The stamp on each work row is
   * when it happened, for the trail; the list is the fact.
   */
  const on = store.enrolled(context.identity.userId);
  const roll = store.roster();
  return {
    id: COURSE.id,
    area: 'courses',
    title: `${SANDBOX_MARK} · ${COURSE.code} — ${COURSE.title}`,
    summary: COURSE.about,
    status: on ? 'Enrolled' : 'Open for enrolment',
    version: on ? '2' : '1',
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'Institution', value: SANDBOX_NAME },
      { label: 'Taught by', value: COURSE.faculty },
      { label: 'Enrolled', value: `${roll.length} on the roster` },
      // Where somebody reads it while they still have time to act on it,
      // rather than in the warning attached to submitting three days late.
      { label: 'Late work', value: policySaid(store.policy()) },
      ...(isFaculty(context) ? classFace(store, roll.length) : studentFace(context, store, on)),
      { label: 'Your role here', value: context.identity.roles.join(', ') || 'none' },
    ],
    actions: isFaculty(context)
      ? [
          {
            id: 'syllabus',
            label: 'Publish or revise the syllabus',
            fields: [
              { id: 'about', label: 'What the course is about', kind: 'textarea', required: true },
              { id: 'meets', label: 'When and where it meets', kind: 'text', required: true },
              { id: 'officeHours', label: 'Office hours', kind: 'text', required: true },
              {
                id: 'collaboration',
                label: 'What counts as working together, and what counts as copying',
                kind: 'textarea',
                required: true,
              },
              { id: 'contact', label: 'Where to ask a question', kind: 'text', required: true },
              {
                id: 'note',
                label: 'What changed (required when revising)',
                kind: 'text',
                required: false,
              },
            ],
          },
          {
            id: 'policy',
            label: 'Set what late work costs',
            fields: [
              { id: 'perDay', label: 'Deducted per day late, as a percentage', kind: 'number', required: true },
              { id: 'cap', label: 'The most a late penalty can reach, as a percentage', kind: 'number', required: true },
            ],
          },
          {
            id: 'publish',
            label: 'Publish a piece of work',
            fields: [
              { id: 'title', label: 'Title', kind: 'text', required: true },
              { id: 'due', label: 'Due', kind: 'datetime-local', required: true },
              { id: 'brief', label: 'What the work is', kind: 'textarea', required: true },
              {
                id: 'weight',
                label: 'What it is worth, as a percentage of the course',
                kind: 'number',
                required: true,
              },
              {
                id: 'rubric',
                label: 'Marking scheme — one criterion a line, as "Name | marks | what it means"',
                kind: 'textarea',
                required: true,
              },
            ],
          },
        ]
      : on
        ? []
        : [{ id: 'enrol', label: 'Enrol in this sandbox course', fields: [] }],
  };
}

/** The threads a course has: one per published assignment, and one general. */
const threadsOf = (store: SandboxStore) => [
  { id: 'general', title: 'About this course', about: 'Anything that is not about one piece of work.' },
  // A thread per published assignment, derived rather than listed — so work
  // published by faculty arrives with somewhere to ask about it.
  ...store.published().map((a) => ({ id: a.id, title: a.title, about: a.brief })),
];

type Thread = ReturnType<typeof threadsOf>[number];

const threadId = (id: string) => `thread:${id}`;

/**
 * One discussion thread.
 *
 * Attached to the *course* and its published work rather than to anybody's
 * work row, which is not a filing decision. A thread hanging off a submission
 * would make the list of threads a list of who has submitted, and the fact
 * that a question exists would say something about the person who asked it
 * before a word of it was read.
 */
function threadRecord(context: AdapterContext, store: SandboxStore, thread: Thread): UniversityRecord {
  const mine = context.identity.userId;
  const faculty = isFaculty(context);
  const posts = store.posts(threadId(thread.id), mine, faculty);
  const said = (p: Post) =>
    `${p.name}${p.fromFaculty ? ' (faculty)' : ''}${p.audience === 'staff' ? ' · to staff only' : ''}: ${p.body}`;
  return {
    id: threadId(thread.id),
    area: 'courses',
    title: `${SANDBOX_MARK} · Discussion — ${thread.title}`,
    summary: posts.length
      ? `${posts.length} ${posts.length === 1 ? 'post' : 'posts'} you can see`
      : 'Nothing asked yet.',
    status: thread.about,
    // Posts are append-only, so a thread's version is how many it holds.
    version: String(posts.length),
    updatedAt: posts.at(-1)?.at ?? new Date().toISOString(),
    details: posts.map((p) => ({ label: p.at.slice(0, 16).replace('T', ' '), value: said(p) })),
    actions: faculty
      ? [
          {
            id: 'answer',
            label: 'Answer',
            fields: [
              { id: 'body', label: 'Your answer', kind: 'textarea', required: true },
              {
                id: 'audience',
                label: 'Who sees it',
                kind: 'select',
                required: true,
                options: ['The class', 'Staff only'],
              },
            ],
          },
        ]
      : [
          {
            id: 'ask',
            label: 'Ask',
            fields: [
              { id: 'body', label: 'Your question', kind: 'textarea', required: true },
              {
                id: 'audience',
                label: 'Who sees it',
                kind: 'select',
                required: true,
                // Deliberately not defaulted and deliberately required: a
                // person about to say something they would not say to the
                // class should have had to choose, not have had a default
                // chosen for them.
                options: ['The class', 'Staff only'],
              },
            ],
          },
        ],
  };
}

const AUDIENCE: Record<string, Audience> = { 'The class': 'class', 'Staff only': 'staff' };

function assignmentRecord(store: SandboxStore, work: Work): UniversityRecord {
  const a = assignmentOf(store, work.assignment);
  const when = lateness(work.submittedAt, a?.due ?? '');
  return {
    id: work.id,
    area: 'assignments',
    title: `${SANDBOX_MARK} · ${a?.title ?? work.assignment}`,
    summary: a?.brief ?? '',
    status: work.stage === 'published' && when.late ? `${SAID[work.stage]} · overdue` : SAID[work.stage],
    version: String(work.version),
    updatedAt: new Date().toISOString(),
    // The same due date the `Due` detail is written from, in a form a
    // calendar can read without parsing a sentence back.
    ...(a ? { dates: [{ at: a.due, what: 'Due' }] } : {}),
    details: [
      { label: 'Course', value: `${COURSE.code} (${SANDBOX_MARK})` },
      { label: 'Due', value: a?.due.slice(0, 16).replace('T', ' ') ?? '' },
      { label: 'Deadline', value: when.said },
      { label: 'Marked out of', value: String(outOf(a?.criteria ?? [])) },
      // Beside what it is marked out of, for the same reason the rubric is
      // here rather than with the grade: effort goes where the marks are, and
      // a piece worth a fifth of the course is not the same call as a piece
      // worth a fortieth even when both are out of twenty.
      { label: 'Worth', value: a ? `${pct(a.weight)} of the course` : '' },
      { label: 'Late work', value: policySaid(store.policy()) },
      /*
       * Before the work is done, not with the mark. A rubric that arrives
       * attached to the grade arrived too late to be used, which is the
       * argument `lib/assignment.ts` makes for pulling one out of an
       * instruction sheet in the first place.
       */
      ...(a?.criteria ?? []).map((c) => ({
        label: `${c.name} · ${c.outOf} marks`,
        value: c.means,
      })),
      { label: 'Submitted', value: work.submittedAt ?? 'Not yet' },
      ...trail(work),
    ],
    actions:
      work.stage === 'published'
        ? [
            {
              id: 'submit',
              label: 'Submit this work',
              fields: [
                { id: 'work', label: 'Your work', kind: 'textarea', required: true },
                { id: 'note', label: 'Note for the marker', kind: 'textarea', required: false },
              ],
            },
          ]
        : [],
  };
}

function gradeRecord(store: SandboxStore, work: Work): UniversityRecord {
  const a = assignmentOf(store, work.assignment);
  const criteria = a?.criteria ?? [];
  const total = outOf(criteria);
  const seen = work.stage === 'released' || work.stage === 'archived';
  const cost = penalty(work, a?.due ?? '', total, store.policy());
  const onRecord = recorded(work, a?.due ?? '', total, store.policy());
  return {
    id: work.id,
    area: 'grades',
    title: `${SANDBOX_MARK} · ${a?.title ?? work.assignment} — marking`,
    summary: seen
      ? `${work.mark} out of ${total}${cost ? ` · ${onRecord} out of ${total} recorded, after ${pct(cost.percent)} for lateness` : ''}`
      : 'Not released. A mark is not a mark until the student can see it.',
    status: SAID[work.stage],
    version: String(work.version),
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'Student', value: work.student },
      { label: 'Out of', value: String(total) },
      // Said to the marker, because it is the second most consequential fact
      // about a submission after what is in it, and no course's policy can be
      // applied by somebody who cannot see it.
      { label: 'Deadline', value: lateness(work.submittedAt, a?.due ?? '').said },
      ...(seen
        ? [
            /*
             * Four numbers, kept apart. What the work earned, how late it
             * was, what that cost under the course's stated rule, and what
             * goes on the record. One number cannot answer "what did I lose
             * it on", and folding the penalty into the rubric mark makes the
             * rubric unreadable as a judgement about the work.
             */
            { label: 'Mark', value: `${work.mark} out of ${total}` },
            ...(cost
              ? [
                  {
                    label: 'Late penalty',
                    value:
                      `${pct(cost.percent)} of ${total} — ${cost.marks} marks, for ${cost.days} ` +
                      `${cost.days === 1 ? 'day' : 'days'}. ${policySaid(store.policy())}`,
                  },
                  { label: 'Recorded', value: `${onRecord} out of ${total}` },
                ]
              : []),
            /*
             * Per criterion, and this is the whole point of the change. A
             * student who has lost six marks can see which six and read what
             * that criterion was asking for, which is a thing to do
             * differently next time rather than a number to be upset about.
             */
            ...criteria.map((c) => ({
              label: `${c.name} · ${work.marks[c.id] ?? 0} of ${c.outOf}`,
              value: c.means,
            })),
            { label: 'Feedback', value: work.comments },
          ]
        : []),
      ...trail(work),
    ],
    actions:
      work.stage === 'submitted'
        ? [
            {
              id: 'grade',
              label: 'Mark against the rubric',
              fields: [
                // One field per criterion, named by it. There is no field for
                // the total: it is the sum, so a marker cannot hand back a
                // number that disagrees with its own parts.
                ...criteria.map((c) => ({
                  id: c.id,
                  label: `${c.name} (out of ${c.outOf}) — ${c.means}`,
                  kind: 'number' as const,
                  required: true,
                })),
                { id: 'comments', label: 'Feedback for the student', kind: 'textarea' as const, required: true },
              ],
            },
          ]
        : work.stage === 'graded'
          ? [{ id: 'release', label: 'Release the feedback to the student', fields: [] }]
          : [],
  };
}

/**
 * The closed record of one piece of work, and what it has to carry to be one.
 *
 * For eleven commits this said "Archived. This is the closed record of one
 * piece of work" above a course code, a student id and a trail of timestamps.
 * A trail is a record of the *transitions*; it is not a record of the work. An
 * academic record that cannot answer "what was it, what did I get, and why" is
 * a filing stub, and every one of those facts already existed — on three other
 * screens.
 *
 * Everything here is composed live, from the rubric, the weight and the
 * policy, rather than copied in at archive time. A stored copy is a second
 * version of a fact that can disagree with the first, which is the argument
 * the recorded mark and the lateness sentence are both built on. That only
 * counts as a record if none of its inputs can move underneath it — and none
 * can: a published assignment's weight and criteria have no edit action, and
 * the late policy is frozen the moment a mark goes out under it. A test
 * archives one, runs the course on, and compares the two byte for byte.
 */
function archiveRecord(store: SandboxStore, work: Work): UniversityRecord {
  const a = assignmentOf(store, work.assignment);
  const criteria = a?.criteria ?? [];
  const total = outOf(criteria);
  // The same gate as everywhere else. This is a different function drawing
  // from the same row, and nothing about being the archive makes it exempt.
  const seen = work.stage === 'released' || work.stage === 'archived';
  const cost = penalty(work, a?.due ?? '', total, store.policy());
  const onRecord = recorded(work, a?.due ?? '', total, store.policy());
  const appeal = work.appeal;
  return {
    id: work.id,
    area: 'records',
    title: `${SANDBOX_MARK} · ${a?.title ?? work.assignment} — record`,
    summary:
      work.stage === 'archived'
        ? 'Archived. This is the closed record of one piece of work.'
        : 'Open. A record can be archived once its feedback has been released.',
    status: SAID[work.stage],
    version: String(work.version),
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'Course', value: `${COURSE.code} (${SANDBOX_MARK})` },
      { label: 'Student', value: work.student },
      { label: 'Worth', value: a ? `${pct(a.weight)} of the course` : '' },
      { label: 'Handed in', value: work.submittedAt?.slice(0, 16).replace('T', ' ') ?? 'Not submitted' },
      { label: 'Deadline', value: lateness(work.submittedAt, a?.due ?? '').said },
      ...(seen
        ? [
            { label: 'Mark', value: `${work.mark} out of ${total}` },
            ...(cost
              ? [
                  {
                    label: 'Late penalty',
                    value:
                      `${pct(cost.percent)} of ${total} — ${cost.marks} marks, for ${cost.days} ` +
                      `${cost.days === 1 ? 'day' : 'days'}. ${policySaid(store.policy())}`,
                  },
                  { label: 'Recorded', value: `${onRecord} out of ${total}` },
                ]
              : []),
            // Which criterion lost the marks, on the record itself. "17 out of
            // 20" and nothing else is the grade this repository refused once
            // already; the archive is not the place for it to come back.
            ...criteria.map((c) => ({
              label: `${c.name} · ${work.marks[c.id] ?? 0} of ${c.outOf}`,
              value: c.means,
            })),
            { label: 'Feedback', value: work.comments },
          ]
        : []),
      ...(appeal && seen
        ? [
            { label: 'Appealed', value: `${appeal.at.slice(0, 10)} — ${appeal.reason}` },
            {
              label:
                appeal.state === 'amended'
                  ? 'Mark amended on appeal'
                  : appeal.state === 'upheld'
                    ? 'Appeal answered — mark upheld'
                    : 'Appeal open',
              value: appeal.state === 'open' ? 'Not yet answered.' : `Was ${appeal.was}. ${appeal.answer}`,
            },
          ]
        : []),
      ...trail(work),
    ],
    actions:
      work.stage === 'released' ? [{ id: 'archive', label: 'Archive this record', fields: [] }] : [],
  };
}

/** What the appeal record says, and what may be done to it. */
function appealRecord(store: SandboxStore, work: Work): UniversityRecord {
  const a = assignmentOf(store, work.assignment);
  const seen = work.stage === 'released' || work.stage === 'archived';
  const open = work.appeal?.state === 'open';
  const said = !work.appeal
    ? seen
      ? 'No appeal raised'
      : 'Nothing to appeal yet — no mark has been released'
    : open
      ? 'Under appeal'
      : work.appeal.state === 'upheld'
        ? 'Appeal answered — the mark was upheld'
        : 'Appeal answered — the mark was amended';
  return {
    id: work.id,
    area: 'appeals',
    title: `${SANDBOX_MARK} · ${a?.title ?? work.assignment} — appeal`,
    summary: said,
    status: said,
    version: String(work.version),
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'Student', value: work.student },
      /*
       * The recorded mark, which is the one being disputed. Showing the
       * pre-penalty number here would put two answers to "what is my mark" on
       * the two screens a student reads together, on the one occasion where
       * that question has to have one answer.
       */
      ...(seen
        ? [
            {
              label: 'Mark',
              value:
                `${recorded(work, a?.due ?? '', outOf(a?.criteria ?? []), store.policy())} out of ` +
                `${outOf(a?.criteria ?? [])}` +
                (penalty(work, a?.due ?? '', outOf(a?.criteria ?? []), store.policy())
                  ? ` (${work.mark} marked, less the late penalty)`
                  : ''),
            },
          ]
        : []),
      ...(work.appeal
        ? [
            { label: 'Raised', value: work.appeal.at.slice(0, 16).replace('T', ' ') },
            { label: 'Because', value: work.appeal.reason },
            // The mark as it stood when the appeal was raised, kept whatever
            // happens to the mark afterwards.
            { label: 'Mark at the time', value: work.appeal.was },
            ...(work.appeal.answeredAt
              ? [
                  { label: 'Answered', value: work.appeal.answeredAt.slice(0, 16).replace('T', ' ') },
                  { label: 'The answer', value: work.appeal.answer },
                ]
              : []),
          ]
        : []),
      ...trail(work),
    ],
    actions: archivedOrUnseen(work, seen)
      ? []
      : open
        ? [
            {
              id: 'uphold',
              label: 'Answer: the mark stands',
              fields: [{ id: 'reason', label: 'Why it stands', kind: 'textarea', required: true }],
            },
            {
              id: 'amend',
              label: 'Answer: re-mark it',
              fields: [
                ...(a?.criteria ?? []).map((c) => ({
                  id: c.id,
                  label: `${c.name} (out of ${c.outOf}) — ${c.means}`,
                  kind: 'number' as const,
                  required: true,
                })),
                { id: 'reason', label: 'What changed, and why', kind: 'textarea' as const, required: true },
              ],
            },
          ]
        : work.appeal
          ? []
          : [
              {
                id: 'appeal',
                label: 'Ask for this to be looked at again',
                fields: [{ id: 'reason', label: 'What is wrong with the mark', kind: 'textarea', required: true }],
              },
            ],
  };
}

const archivedOrUnseen = (work: Work, seen: boolean) => work.stage === 'archived' || !seen;

/**
 * The nine, over one store.
 *
 * Built by a function rather than exported as a constant so the store is an
 * argument: the tests open one on a temporary file, and `start.ts` opens one
 * beside the journal. A module-level store would have made the tests share a
 * database and run in an order that mattered.
 */
export function sandboxAdapters(store: SandboxStore): InstitutionAdapter[] {
  const now = () => new Date().toISOString();

  const courses: InstitutionAdapter = {
    area: 'courses',
    institutionId: SANDBOX_INSTITUTION,
    /*
     * Written by both, and it said students only.
     *
     * `canWrite` was `isStudent` from the commit that added enrolling, when
     * enrolling was the only thing anybody did to a course. Publishing landed
     * here later, and so did posting in a thread — both of which faculty do —
     * and the gateway checks this before it asks the adapter anything. So
     * every faculty write to this area answered 403 "This connection does not
     * permit that action", and the thing that *starts* the whole loop could
     * not be reached from a browser at all.
     *
     * Sixty adapter tests did not notice, because every one of them calls the
     * adapter directly. It took driving publish through the gateway.
     */
    status: async (context) => connection('courses', context, isStudent(context) || isFaculty(context)),
    list: async (context, query) => {
      /*
       * The threads only once somebody is in the class. Not a nicety: a
       * person who is not on the roster has no business reading the questions
       * a class is asking, and the emptiness of the list is the refusal.
       */
      const open = isFaculty(context) || store.enrolled(context.identity.userId);
      const threads = open ? threadsOf(store).map((t) => threadRecord(context, store, t)) : [];
      // The syllabus beside the course, not behind it: somebody deciding
      // whether to take a course reads it before they enrol, so it is not
      // gated on the roster the way the threads are.
      return page(matching([courseRecord(context, store), syllabusRecord(store), ...threads], query.search));
    },
    get: async (context, id) => {
      if (id === COURSE.id) return courseRecord(context, store);
      if (id === 'syllabus') return syllabusRecord(store);
      const thread = threadsOf(store).find((t) => threadId(t.id) === id);
      if (!thread) return null;
      if (!isFaculty(context) && !store.enrolled(context.identity.userId)) return null;
      return threadRecord(context, store, thread);
    },
    review: async (context, input) => {
      const thread = threadsOf(store).find((t) => threadId(t.id) === input.recordId);
      if (thread) return reviewPost(context, store, input, thread);
      if (input.actionId === 'syllabus') {
        const v = readSyllabus(store, context, input);
        return {
          title: v.revision === 1 ? 'Publish the syllabus' : `Publish revision ${v.revision} of the syllabus`,
          details: [
            { label: 'About', value: v.about },
            { label: 'Meets', value: v.meets },
            { label: 'Office hours', value: v.officeHours },
            { label: 'Working together', value: v.collaboration },
            { label: 'Where to ask', value: v.contact },
            ...(v.note ? [{ label: 'What changed', value: v.note }] : []),
            {
              label: 'After this',
              value: `Everybody on the roster, and anybody looking at the course, reads this.`,
            },
          ],
        };
      }
      if (input.actionId === 'policy') {
        const p = readPolicy(store, context, input);
        return {
          title: 'Set what late work costs',
          details: [
            { label: 'The rule', value: policySaid(p) },
            { label: 'A piece three days late, out of 20', value: `loses ${((20 * Math.min(3 * p.perDay, p.cap)) / 100).toFixed(2)} marks` },
            {
              label: 'After this',
              value:
                'Everybody sees it before they submit, and it cannot be changed once a mark has gone ' +
                'out under it.',
            },
          ],
        };
      }
      if (input.actionId === 'publish') {
        if (!isFaculty(context)) throw new Refusal('Only the course faculty can publish work.');
        const a = readAssignment(store, input);
        /*
         * The rubric read back, in full, before anything is published. This
         * is the answer to parsing free text: the two-phase action exists so
         * that a person sees what was understood rather than what they typed.
         */
        return {
          title: `Publish ${a.title}`,
          details: [
            { label: 'Due', value: a.due.slice(0, 16).replace('T', ' ') },
            ...a.criteria.map((c) => ({ label: `${c.name} · ${c.outOf} marks`, value: c.means })),
            { label: 'Marked out of', value: String(outOf(a.criteria)) },
            { label: 'Worth', value: `${pct(a.weight)} of the course` },
            {
              label: 'Still unpublished after this',
              value: `${pct(100 - store.published().reduce((n, p) => n + p.weight, 0) - a.weight)} of the course`,
            },
            {
              label: 'After this',
              value: `Everybody on the roster gets it, with a thread to ask about it.`,
            },
          ],
        };
      }
      if (!isStudent(context)) throw new Refusal('Only a student can enrol.');
      return {
        title: `Enrol in ${COURSE.code}`,
        details: [
          { label: 'Institution', value: SANDBOX_NAME },
          { label: 'Course', value: `${COURSE.code} — ${COURSE.title}` },
          { label: 'This is not real', value: 'No registrar is contacted and no credit is awarded.' },
        ],
      };
    },
    execute: async (context, input, key) => {
      const done = already(store, key);
      if (done) return done;
      const thread = threadsOf(store).find((t) => threadId(t.id) === input.recordId);
      if (thread) return post(context, store, input, thread, key);
      if (input.actionId === 'syllabus') {
        const v = readSyllabus(store, context, input);
        store.setSyllabus(v);
        return {
          id: key,
          status: 'completed',
          message:
            `${SANDBOX_MARK} · Syllabus ${v.revision === 1 ? 'published' : `revised to revision ${v.revision}`}, ` +
            `to ${store.roster().length} on the roster.`,
          recordedAt: v.at,
        };
      }
      if (input.actionId === 'policy') {
        const p = readPolicy(store, context, input);
        store.setPolicy(p);
        return {
          id: key,
          status: 'completed',
          message: `${SANDBOX_MARK} · ${policySaid(p)}`,
          recordedAt: p.setAt,
        };
      }
      if (input.actionId === 'publish') {
        if (!isFaculty(context)) throw new Refusal('Only the course faculty can publish work.');
        const a = readAssignment(store, input);
        const at = now();
        store.publish(a, at);
        return {
          id: key,
          status: 'completed',
          message:
            `${SANDBOX_MARK} · Published ${a.title}, out of ${outOf(a.criteria)} and worth ` +
            `${pct(a.weight)} of the course, to ${store.roster().length} on the roster.`,
          recordedAt: at,
        };
      }
      if (!isStudent(context)) throw new Refusal('Only a student can enrol.');
      const at = now();
      if (store.enrolled(context.identity.userId)) {
        throw new Refusal('You are already enrolled in this sandbox course.');
      }
      const rows = store.published().map((a) => store.one(context.identity.userId, a.id));
      /*
       * Self-enrolment, which a real course does not have, and which this one
       * keeps on purpose: a pilot tester needs a way onto the roster and there
       * is no registrar here to put them on it. It is the sandbox's one
       * concession to not being an institution, and it is a concession rather
       * than a pretence — the roster it joins is the same list faculty mark
       * from, and a person who has not joined it cannot submit.
       */
      store.add(context.identity.userId, `SANDBOX tester ${context.identity.userId}`, at);
      return store.commitAll(rows, key, context.identity.userId, 'Enrolled', at, (w) => {
        w.enrolledAt = at;
      });
    },
    reconcile: async (_context, _input, key) => store.receipt(key),
  };

  const assignments: InstitutionAdapter = {
    area: 'assignments',
    institutionId: SANDBOX_INSTITUTION,
    status: async (context) => connection('assignments', context, isStudent(context)),
    list: async (context, query) => {
      const rows = isFaculty(context) ? store.everyWork() : store.mine(context.identity.userId);
      return page(matching(rows.map((w) => assignmentRecord(store, w)), query.search));
    },
    get: async (context, id) => {
      const work = rowFor(store, context, id);
      if (!work) return null;
      if (!isFaculty(context) && work.student !== context.identity.userId) return null;
      return assignmentRecord(store, work);
    },
    review: async (context, input) => {
      const work = allow(context, rowFor(store, context, input.recordId), 'student', store);
      expect(work, 'published', 'submit');
      const a = assignmentOf(store, work.assignment);
      const body = input.fields.work ?? '';
      const over = Date.parse(a?.due ?? '') < Date.now();
      return {
        title: `Submit ${a?.title ?? work.assignment}`,
        details: [
          { label: 'Course', value: `${COURSE.code} (${SANDBOX_MARK})` },
          { label: 'Due', value: a?.due.slice(0, 16).replace('T', ' ') ?? '' },
          ...(over
            ? [
                {
                  label: 'This is late',
                  // Not "the course decides what that costs" any more, which
                  // was true and useless. What it decided, before they confirm.
                  value: `It will be recorded as late. ${policySaid(store.policy())}`,
                },
              ]
            : []),
          { label: 'Length', value: `${body.trim().split(/\s+/).filter(Boolean).length} words` },
          { label: 'After this', value: 'It can be marked, and you cannot submit it again.' },
        ],
      };
    },
    execute: async (context, input, key) => {
      const done = already(store, key);
      if (done) return done;
      const work = allow(context, rowFor(store, context, input.recordId), 'student', store);
      fresh(work, input);
      expect(work, 'published', 'submit');
      const at = now();
      const a = assignmentOf(store, work.assignment);
      /*
       * On the receipt, which is the thing the student keeps. A submission
       * whose lateness is only visible to the marker is a dispute waiting to
       * happen: both sides should be reading the same sentence.
       */
      const when = lateness(at, a?.due ?? '');
      return store.commit(
        work,
        key,
        context.identity.userId,
        'Submitted',
        at,
        (w) => {
          w.stage = 'submitted';
          w.submittedAt = at;
          w.body = input.fields.work ?? '';
        },
        when.said,
      );
    },
    reconcile: async (_context, _input, key) => store.receipt(key),
  };

  const grades: InstitutionAdapter = {
    area: 'grades',
    institutionId: SANDBOX_INSTITUTION,
    status: async (context) => connection('grades', context, isFaculty(context)),
    list: async (context, query) => {
      const rows = isFaculty(context) ? store.everyWork() : store.mine(context.identity.userId);
      return page(matching(rows.map((w) => gradeRecord(store, w)), query.search));
    },
    get: async (context, id) => {
      const work = rowFor(store, context, id);
      if (!work) return null;
      if (!isFaculty(context) && work.student !== context.identity.userId) return null;
      return gradeRecord(store, work);
    },
    review: async (context, input) => {
      const work = allow(context, rowFor(store, context, input.recordId), 'faculty');
      if (input.actionId === 'release') {
        expect(work, 'graded', 'release feedback');
        return {
          title: 'Release this feedback',
          details: [
            { label: 'Student', value: work.student },
            { label: 'Mark', value: work.mark },
            { label: 'After this', value: 'The student can see the mark and the feedback.' },
          ],
        };
      }
      expect(work, 'submitted', 'mark this');
      const a = assignmentOf(store, work.assignment);
      const criteria = a?.criteria ?? [];
      // Validated here as well as at execute, because the gateway runs this
      // at prepare: a marker should be told a box is empty before they
      // confirm, not after.
      const marks = readMarks(criteria, input.fields);
      const sum = Object.values(marks).reduce((n, m) => n + m, 0);
      return {
        title: `Mark ${a?.title ?? work.assignment}`,
        details: [
          { label: 'Student', value: work.student },
          ...criteria.map((c) => ({ label: c.name, value: `${marks[c.id]} of ${c.outOf}` })),
          { label: 'Total', value: `${sum} out of ${outOf(criteria)}` },
          { label: 'After this', value: 'It is marked but not released — the student sees nothing yet.' },
        ],
      };
    },
    execute: async (context, input, key) => {
      const done = already(store, key);
      if (done) return done;
      const work = allow(context, rowFor(store, context, input.recordId), 'faculty');
      fresh(work, input);
      const at = now();
      if (input.actionId === 'release') {
        expect(work, 'graded', 'release feedback');
        return store.commit(work, key, 'faculty', 'Feedback released', at, (w) => {
          w.stage = 'released';
          w.releasedAt = at;
        });
      }
      expect(work, 'submitted', 'mark this');
      const a = assignmentOf(store, work.assignment);
      // The gateway's validator knows these are numbers; only the adapter
      // knows what each is out of, which is exactly the split the contract
      // draws between a well-formed request and a permitted one.
      const marks = readMarks(a?.criteria ?? [], input.fields);
      return store.commit(work, key, 'faculty', 'Marked', at, (w) => {
        w.stage = 'graded';
        w.gradedAt = at;
        w.marks = marks;
        w.mark = String(Object.values(marks).reduce((n, m) => n + m, 0));
        w.comments = input.fields.comments ?? '';
      });
    },
    reconcile: async (_context, _input, key) => store.receipt(key),
  };

  const records: InstitutionAdapter = {
    area: 'records',
    institutionId: SANDBOX_INSTITUTION,
    status: async (context) => connection('records', context, isFaculty(context)),
    list: async (context, query) => {
      const rows = isFaculty(context) ? store.everyWork() : store.mine(context.identity.userId);
      return page(matching(rows.map((w) => archiveRecord(store, w)), query.search));
    },
    get: async (context, id) => {
      const work = rowFor(store, context, id);
      if (!work) return null;
      if (!isFaculty(context) && work.student !== context.identity.userId) return null;
      return archiveRecord(store, work);
    },
    review: async (context, input) => {
      const work = allow(context, rowFor(store, context, input.recordId), 'faculty');
      expect(work, 'released', 'archive this');
      return {
        title: 'Archive this record',
        details: [
          { label: 'Student', value: work.student },
          { label: 'Entries', value: String(work.history.length) },
          { label: 'After this', value: 'The record is closed. Nothing further can be done to it.' },
        ],
      };
    },
    execute: async (context, input, key) => {
      const done = already(store, key);
      if (done) return done;
      const work = allow(context, rowFor(store, context, input.recordId), 'faculty');
      fresh(work, input);
      expect(work, 'released', 'archive this');
      // Archiving closes the appeal window, so archiving over an open appeal
      // would answer it by ignoring it.
      if (work.appeal?.state === 'open') {
        throw new Refusal('This mark is under appeal. Answer the appeal before archiving the record.');
      }
      const at = now();
      return store.commit(work, key, 'faculty', 'Archived', at, (w) => {
        w.stage = 'archived';
        w.archivedAt = at;
      });
    },
    reconcile: async (_context, _input, key) => store.receipt(key),
  };

  /**
   * Recourse, which the loop did not have.
   *
   * A released mark was final and an archived record was terminal, so the
   * whole vertical assumed nobody would ever be marked wrongly. Every real
   * course has a way to say so, and the contract already had the area for
   * it — `appeals`, "Feedback & appeals" — with nothing behind it.
   *
   * Two rules give the thing its shape. An appeal can only be raised against
   * a mark the student has actually seen, because a mark you cannot read is
   * not one you can dispute. And it can only be raised before the record is
   * archived — which is what finally gives archiving a consequence. Until
   * now it changed a status and nothing else; closing the window is what
   * makes it an archive rather than a label.
   *
   * Nothing is overwritten. An amended mark does not erase the one it
   * replaces: the appeal keeps the mark as it stood when it was raised, and
   * the trail keeps Marked, Appealed and Mark amended as three separate
   * entries. An academic record that holds only the latest number cannot
   * answer "what changed, and why", which is the one question an appeal
   * exists to leave an answer to.
   */
  const appeals: InstitutionAdapter = {
    area: 'appeals',
    institutionId: SANDBOX_INSTITUTION,
    status: async (context) => connection('appeals', context, true),
    list: async (context, query) => {
      const rows = isFaculty(context) ? store.everyWork() : store.mine(context.identity.userId);
      return page(matching(rows.map((w) => appealRecord(store, w)), query.search));
    },
    get: async (context, id) => {
      const work = rowFor(store, context, id);
      if (!work) return null;
      if (!isFaculty(context) && work.student !== context.identity.userId) return null;
      return appealRecord(store, work);
    },
    review: async (context, input) => {
      const raising = input.actionId === 'appeal';
      const work = allow(
        context,
        rowFor(store, context, input.recordId),
        raising ? 'student' : 'faculty',
        raising ? store : undefined,
      );
      openable(work, input.actionId);
      const a = assignmentOf(store, work.assignment);
      if (raising) {
        return {
          title: 'Ask for this to be looked at again',
          details: [
            { label: 'The mark now', value: `${work.mark} out of ${outOf(a?.criteria ?? [])}` },
            { label: 'Your reason', value: (input.fields.reason ?? '').trim() },
            { label: 'After this', value: 'The mark stands while it is looked at. It can go up, down, or stay.' },
          ],
        };
      }
      if (input.actionId === 'uphold') {
        return {
          title: 'Answer: the mark stands',
          details: [
            { label: 'Student', value: work.student },
            { label: 'They said', value: work.appeal?.reason ?? '' },
            { label: 'After this', value: 'The mark is unchanged and the appeal is closed.' },
          ],
        };
      }
      const marks = readMarks(a?.criteria ?? [], input.fields);
      const sum = Object.values(marks).reduce((n, m) => n + m, 0);
      return {
        title: 'Answer: re-mark it',
        details: [
          { label: 'Student', value: work.student },
          { label: 'Was', value: work.mark },
          { label: 'Becomes', value: `${sum} out of ${outOf(a?.criteria ?? [])}` },
          { label: 'After this', value: 'Both marks stay in the record, with the reason for the change.' },
        ],
      };
    },
    execute: async (context, input, key) => {
      const done = already(store, key);
      if (done) return done;
      const raising = input.actionId === 'appeal';
      const work = allow(
        context,
        rowFor(store, context, input.recordId),
        raising ? 'student' : 'faculty',
        raising ? store : undefined,
      );
      openable(work, input.actionId);
      const at = now();
      const a = assignmentOf(store, work.assignment);
      const reason = (input.fields.reason ?? '').trim();
      if (!reason) throw new Refusal('Say what is wrong with the mark.');

      if (raising) {
        return store.commit(work, key, context.identity.userId, 'Appealed', at, (w) => {
          w.appeal = { at, reason, was: w.mark, state: 'open', answer: '', answeredAt: null };
        });
      }
      if (input.actionId === 'uphold') {
        return store.commit(work, key, 'faculty', 'Appeal answered — mark upheld', at, (w) => {
          if (w.appeal) {
            w.appeal.state = 'upheld';
            w.appeal.answer = reason;
            w.appeal.answeredAt = at;
          }
        });
      }
      const marks = readMarks(a?.criteria ?? [], input.fields);
      return store.commit(work, key, 'faculty', 'Mark amended on appeal', at, (w) => {
        if (w.appeal) {
          w.appeal.state = 'amended';
          w.appeal.answer = reason;
          w.appeal.answeredAt = at;
        }
        w.marks = marks;
        w.mark = String(Object.values(marks).reduce((n, m) => n + m, 0));
      });
    },
    reconcile: async (_context, _input, key) => store.receipt(key),
  };

  return [
    courses,
    assignments,
    grades,
    records,
    appeals,
    registrationAdapter(store),
    billingAdapter(store),
    aidAdapter(store),
    familyAdapter(store),
    careerAdapter(store),
    advisingAdapter(store),
    alumniAdapter(store),
    athleticsAdapter(store),
    clubsAdapter(store),
  ];
}
