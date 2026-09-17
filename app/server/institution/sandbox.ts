import { DatabaseSync } from 'node:sqlite';
import { Refusal } from '../../../packages/institution/src/index.ts';
import type {
  ActionInput,
  ConnectionStatus,
  Receipt,
  RecordPage,
  UniversityArea,
  UniversityRecord,
} from '../../../packages/institution/src/index.ts';
import type { AdapterContext, InstitutionAdapter } from './adapter.ts';

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
  syllabus:
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
      CREATE TABLE IF NOT EXISTS receipts(
        key TEXT PRIMARY KEY,
        body TEXT NOT NULL
      );
    `);

    // The class the course already has, before any tester arrives.
    const seed = this.db.prepare('INSERT OR IGNORE INTO roster VALUES(?,?,?)');
    for (const c of CLASSMATES) seed.run(c.id, c.name, '2026-08-25T09:00:00Z');

    // And the work it opens with. Faculty publish more; see `publish`.
    const first = this.db.prepare('INSERT OR IGNORE INTO assignments VALUES(?,?,?)');
    for (const a of SEEDED) first.run(a.id, '2026-08-25T09:00:00Z', JSON.stringify(a));
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
const isStudent = (context: AdapterContext) => context.identity.roles.includes('student');

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
function connection(area: UniversityArea, context: AdapterContext, write: boolean): ConnectionStatus {
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

const page = (records: UniversityRecord[]): RecordPage => ({
  records,
  nextCursor: null,
  fetchedAt: new Date().toISOString(),
});

/** Free-text search over what a person can read on the record itself. */
const matching = (records: UniversityRecord[], search: string) => {
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
function already(store: SandboxStore, key: string): Receipt | null {
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
        (seen && work ? ` · ${work.mark} of ${outOf(a.criteria)}` : ''),
    };
  });
  if (!on) return pieces;

  const marked = store.published().filter((a) => {
    const work = mine.find((w) => w.assignment === a.id);
    return work?.stage === 'released' || work?.stage === 'archived';
  });
  const share = marked.reduce((n, a) => n + a.weight, 0);
  const earned = marked.reduce((n, a) => n + Number(mine.find((w) => w.assignment === a.id)?.mark ?? 0), 0);
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
    summary: COURSE.syllabus,
    status: on ? 'Enrolled' : 'Open for enrolment',
    version: on ? '2' : '1',
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'Institution', value: SANDBOX_NAME },
      { label: 'Taught by', value: COURSE.faculty },
      { label: 'Enrolled', value: `${roll.length} on the roster` },
      ...(isFaculty(context) ? classFace(store, roll.length) : studentFace(context, store, on)),
      { label: 'Your role here', value: context.identity.roles.join(', ') || 'none' },
    ],
    actions: isFaculty(context)
      ? [
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
  return {
    id: work.id,
    area: 'grades',
    title: `${SANDBOX_MARK} · ${a?.title ?? work.assignment} — marking`,
    summary: seen
      ? `${work.mark} out of ${total}`
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
            { label: 'Mark', value: `${work.mark} out of ${total}` },
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

function archiveRecord(store: SandboxStore, work: Work): UniversityRecord {
  const a = assignmentOf(store, work.assignment);
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
      ...(seen ? [{ label: 'Mark', value: `${work.mark} out of ${outOf(a?.criteria ?? [])}` }] : []),
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
 * The five, over one store.
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
      return page(matching([courseRecord(context, store), ...threads], query.search));
    },
    get: async (context, id) => {
      if (id === COURSE.id) return courseRecord(context, store);
      const thread = threadsOf(store).find((t) => threadId(t.id) === id);
      if (!thread) return null;
      if (!isFaculty(context) && !store.enrolled(context.identity.userId)) return null;
      return threadRecord(context, store, thread);
    },
    review: async (context, input) => {
      const thread = threadsOf(store).find((t) => threadId(t.id) === input.recordId);
      if (thread) return reviewPost(context, store, input, thread);
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
            ? [{ label: 'This is late', value: 'It will be recorded as late. The course decides what that costs.' }]
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

  return [courses, assignments, grades, records, appeals];
}
