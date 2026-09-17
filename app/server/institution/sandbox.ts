import { DatabaseSync } from 'node:sqlite';
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

const PUBLISHED = [
  {
    id: 'a1',
    title: 'Problem set 1',
    due: '2026-10-02T23:59:00Z',
    brief: 'Four short answers on the reading. Submitted as text.',
    outOf: 20,
  },
  {
    id: 'a2',
    title: 'Short paper',
    due: '2026-10-23T23:59:00Z',
    brief: 'Twelve hundred words on one of the three prompts.',
    outOf: 40,
  },
] as const;

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
  mark: string;
  comments: string;
  gradedAt: string | null;
  releasedAt: string | null;
  archivedAt: string | null;
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
      CREATE TABLE IF NOT EXISTS roster(
        student TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        joinedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS receipts(
        key TEXT PRIMARY KEY,
        body TEXT NOT NULL
      );
    `);

    // The class the course already has, before any tester arrives.
    const seed = this.db.prepare('INSERT OR IGNORE INTO roster VALUES(?,?,?)');
    for (const c of CLASSMATES) seed.run(c.id, c.name, '2026-08-25T09:00:00Z');
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
      comments: '',
      gradedAt: null,
      releasedAt: null,
      archivedAt: null,
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
    return PUBLISHED.map((a) => this.row(student, a.id));
  }

  /**
   * Every enrolled student's row for every published assignment.
   *
   * From the roster rather than from the work table, so a student who has
   * never opened the app is in a marker's list with nothing submitted — which
   * is the entire reason the roster exists.
   */
  everyWork(): Work[] {
    return this.roster().flatMap((r) => PUBLISHED.map((a) => this.row(r.student, a.id)));
  }

  one(student: string, assignment: string): Work {
    return this.row(student, assignment);
  }

  byId(id: string): Work | null {
    const got = this.db.prepare('SELECT body FROM work WHERE id=?').get(id) as { body: string } | undefined;
    return got ? (JSON.parse(got.body) as Work) : null;
  }

  receipt(key: string): Receipt | null {
    const got = this.db.prepare('SELECT body FROM receipts WHERE key=?').get(key) as
      | { body: string }
      | undefined;
    return got ? (JSON.parse(got.body) as Receipt) : null;
  }

  /** Apply a transition to one row, and write its receipt under `key`. */
  commit(work: Work, key: string, who: string, what: string, at: string, change: (w: Work) => void): Receipt {
    return this.commitAll([work], key, who, what, at, change);
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
      message: `${SANDBOX_MARK} · ${what}. Nothing here reaches a real institution.`,
      recordedAt: at,
    };
    this.db.prepare('INSERT INTO receipts VALUES(?,?)').run(key, JSON.stringify(receipt));
    return receipt;
  }
}

/* ── The four adapters ────────────────────────────────────────────────── */

const assignmentOf = (id: string) => PUBLISHED.find((a) => a.id === id);

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
  if (!assignmentOf(assignment)) return null;
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
    throw new Error('Only the course faculty can do that.');
  }
  if (needs === 'student' && !isStudent(context)) {
    throw new Error('Only an enrolled student can do that.');
  }
  if (needs === 'student' && store && !store.enrolled(context.identity.userId)) {
    /*
     * Before the roster existed there was nothing to be enrolled *in*, so
     * anybody holding the student role could submit to this course. A test
     * with a user called `gatecrasher-1` walked straight in.
     */
    throw new Error('You are not on this course’s roster. Enrol first.');
  }
  if (!work) throw new Error('No such record in the sandbox course.');
  if (needs === 'student') {
    // The check that matters: a well-formed id for somebody else's work is
    // the oldest bug in this shape of API, and the id is client-supplied.
    if (work.student !== context.identity.userId) throw new Error('That is not your work.');
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

/** Refuse an action prepared against a record that has since moved. */
function fresh(work: Work, input: ActionInput): void {
  if (input.version !== String(work.version)) {
    throw new Error('This record has changed since you opened it. Open it again to see the current state.');
  }
}

function expect(work: Work, stage: Stage, what: string): void {
  if (work.stage === 'archived') throw new Error('This record is archived and cannot be changed.');
  if (work.stage !== stage) throw new Error(`Cannot ${what} — this is ${SAID[work.stage].toLowerCase()}.`);
}

/** The trail, as the details a record carries. This is the Record stage. */
function trail(work: Work): { label: string; value: string }[] {
  return work.history.map((h) => ({
    label: new Date(h.at).toISOString().slice(0, 16).replace('T', ' '),
    value: `${h.what} · ${h.who} · receipt ${h.receipt.slice(0, 12)}`,
  }));
}

function courseRecord(context: AdapterContext, store: SandboxStore): UniversityRecord {
  /*
   * Being on the roster *is* being enrolled. The stamp on each work row is
   * when it happened, for the trail; the list is the fact.
   */
  const on = store.enrolled(context.identity.userId);
  const roll = store.roster();
  const work = store.everyWork();
  const owed = PUBLISHED.map((a) => {
    const rows = work.filter((w) => w.assignment === a.id);
    return {
      a,
      inHand: rows.filter((w) => w.stage !== 'published').length,
      toMark: rows.filter((w) => w.stage === 'submitted').length,
    };
  });
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
      ...owed.map((o) => ({
        label: o.a.title,
        value:
          `due ${o.a.due.slice(0, 10)} · ${o.inHand} of ${roll.length} in hand · ` +
          `${roll.length - o.inHand} outstanding · ${o.toMark} to mark`,
      })),
      { label: 'Your role here', value: context.identity.roles.join(', ') || 'none' },
    ],
    actions:
      on || !isStudent(context)
        ? []
        : [{ id: 'enrol', label: 'Enrol in this sandbox course', fields: [] }],
  };
}

function assignmentRecord(work: Work): UniversityRecord {
  const a = assignmentOf(work.assignment);
  return {
    id: work.id,
    area: 'assignments',
    title: `${SANDBOX_MARK} · ${a?.title ?? work.assignment}`,
    summary: a?.brief ?? '',
    status: SAID[work.stage],
    version: String(work.version),
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'Course', value: `${COURSE.code} (${SANDBOX_MARK})` },
      { label: 'Due', value: a?.due.slice(0, 16).replace('T', ' ') ?? '' },
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

function gradeRecord(work: Work): UniversityRecord {
  const a = assignmentOf(work.assignment);
  const seen = work.stage === 'released' || work.stage === 'archived';
  return {
    id: work.id,
    area: 'grades',
    title: `${SANDBOX_MARK} · ${a?.title ?? work.assignment} — marking`,
    summary: seen
      ? `${work.mark} out of ${a?.outOf ?? '—'}`
      : 'Not released. A mark is not a mark until the student can see it.',
    status: SAID[work.stage],
    version: String(work.version),
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'Student', value: work.student },
      { label: 'Out of', value: String(a?.outOf ?? '') },
      ...(seen
        ? [
            { label: 'Mark', value: work.mark },
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
              label: 'Record a mark',
              fields: [
                { id: 'mark', label: 'Mark', kind: 'number', required: true },
                { id: 'comments', label: 'Feedback for the student', kind: 'textarea', required: true },
              ],
            },
          ]
        : work.stage === 'graded'
          ? [{ id: 'release', label: 'Release the feedback to the student', fields: [] }]
          : [],
  };
}

function archiveRecord(work: Work): UniversityRecord {
  const a = assignmentOf(work.assignment);
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

/**
 * The four, over one store.
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
    status: async (context) => connection('courses', context, isStudent(context)),
    list: async (context, query) =>
      page(matching([courseRecord(context, store)], query.search)),
    get: async (context, id) =>
      id === COURSE.id ? courseRecord(context, store) : null,
    review: async (context) => {
      if (!isStudent(context)) throw new Error('Only a student can enrol.');
      return {
        title: `Enrol in ${COURSE.code}`,
        details: [
          { label: 'Institution', value: SANDBOX_NAME },
          { label: 'Course', value: `${COURSE.code} — ${COURSE.title}` },
          { label: 'This is not real', value: 'No registrar is contacted and no credit is awarded.' },
        ],
      };
    },
    execute: async (context, _input, key) => {
      const done = already(store, key);
      if (done) return done;
      if (!isStudent(context)) throw new Error('Only a student can enrol.');
      const at = now();
      if (store.enrolled(context.identity.userId)) {
        throw new Error('You are already enrolled in this sandbox course.');
      }
      const rows = PUBLISHED.map((a) => store.one(context.identity.userId, a.id));
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
      return page(matching(rows.map(assignmentRecord), query.search));
    },
    get: async (context, id) => {
      const work = rowFor(store, context, id);
      if (!work) return null;
      if (!isFaculty(context) && work.student !== context.identity.userId) return null;
      return assignmentRecord(work);
    },
    review: async (context, input) => {
      const work = allow(context, rowFor(store, context, input.recordId), 'student', store);
      expect(work, 'published', 'submit');
      const a = assignmentOf(work.assignment);
      const body = input.fields.work ?? '';
      return {
        title: `Submit ${a?.title ?? work.assignment}`,
        details: [
          { label: 'Course', value: `${COURSE.code} (${SANDBOX_MARK})` },
          { label: 'Due', value: a?.due.slice(0, 16).replace('T', ' ') ?? '' },
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
      return store.commit(work, key, context.identity.userId, 'Submitted', at, (w) => {
        w.stage = 'submitted';
        w.submittedAt = at;
        w.body = input.fields.work ?? '';
      });
    },
    reconcile: async (_context, _input, key) => store.receipt(key),
  };

  const grades: InstitutionAdapter = {
    area: 'grades',
    institutionId: SANDBOX_INSTITUTION,
    status: async (context) => connection('grades', context, isFaculty(context)),
    list: async (context, query) => {
      const rows = isFaculty(context) ? store.everyWork() : store.mine(context.identity.userId);
      return page(matching(rows.map(gradeRecord), query.search));
    },
    get: async (context, id) => {
      const work = rowFor(store, context, id);
      if (!work) return null;
      if (!isFaculty(context) && work.student !== context.identity.userId) return null;
      return gradeRecord(work);
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
      const a = assignmentOf(work.assignment);
      return {
        title: `Mark ${a?.title ?? work.assignment}`,
        details: [
          { label: 'Student', value: work.student },
          { label: 'Mark', value: `${input.fields.mark ?? ''} out of ${a?.outOf ?? ''}` },
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
      const a = assignmentOf(work.assignment);
      const mark = Number(input.fields.mark);
      // The gateway's validator knows this is a number; only the adapter
      // knows what it is out of, which is exactly the split the contract
      // draws between a well-formed request and a permitted one.
      if (!Number.isFinite(mark) || mark < 0 || mark > (a?.outOf ?? 0)) {
        throw new Error(`A mark must be between 0 and ${a?.outOf ?? 0}.`);
      }
      return store.commit(work, key, 'faculty', 'Marked', at, (w) => {
        w.stage = 'graded';
        w.gradedAt = at;
        w.mark = String(mark);
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
      return page(matching(rows.map(archiveRecord), query.search));
    },
    get: async (context, id) => {
      const work = rowFor(store, context, id);
      if (!work) return null;
      if (!isFaculty(context) && work.student !== context.identity.userId) return null;
      return archiveRecord(work);
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
      const at = now();
      return store.commit(work, key, 'faculty', 'Archived', at, (w) => {
        w.stage = 'archived';
        w.archivedAt = at;
      });
    },
    reconcile: async (_context, _input, key) => store.receipt(key),
  };

  return [courses, assignments, grades, records];
}
