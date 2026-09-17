import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SANDBOX_INSTITUTION, SANDBOX_MARK, SANDBOX_NAME, SandboxStore, sandboxAdapters } from './sandbox.ts';
import { createGateway } from './gateway.ts';
import { ActionJournal } from './journal.ts';
import type { AdapterContext, InstitutionAdapter } from './adapter.ts';
import type { ActionInput, UniversityArea, UniversityRole } from '../../../packages/institution/src/index.ts';

/**
 * One course, run end to end, and every way of running it wrong.
 *
 * The completion plan's Phase 1 asks for one complete vertical before any
 * breadth, against a clearly labelled sandbox, *"so nothing here is ever a
 * placeholder success state presented as real"*. A sandbox that accepts
 * everything would be exactly that placeholder — it would demonstrate the
 * happy path and prove nothing about whether the loop can be trusted. So the
 * refusals below outnumber the acceptances, deliberately.
 */
let dir = '';
let store: SandboxStore;
let four: InstitutionAdapter[];

const area = (id: UniversityArea) => {
  const found = four.find((a) => a.area === id);
  if (!found) throw new Error(`no sandbox adapter for ${id}`);
  return found;
};

/** A verified identity, as `auth.ts` would build it — never from a request. */
const who = (userId: string, ...roles: UniversityRole[]): AdapterContext => ({
  identity: { userId, institutionId: SANDBOX_INSTITUTION, roles },
  signal: new AbortController().signal,
});

const act = (
  a: UniversityArea,
  recordId: string,
  version: string,
  actionId: string,
  fields: Record<string, string> = {},
): ActionInput => ({ area: a, recordId, version, actionId, fields });

const student = () => who('student-1', 'student');
const faculty = () => who('prof-1', 'faculty');

/**
 * Get on the roster, because submitting without doing so is now refused.
 *
 * Its own helper rather than a line in `beforeEach`: the order matters and is
 * part of what these tests are about. A student who has not enrolled is a
 * stranger to this course, and one test below is exactly that person.
 */
async function enrol(context: AdapterContext, key = `enrol-${context.identity.userId}`) {
  const course = await area('courses').get(context, 'sandbox-101');
  if (!course) throw new Error('the sandbox course is not visible');
  await area('courses').execute(context, act('courses', course.id, course.version, 'enrol'), key);
}

/** The record as this person currently sees it, with its live version. */
async function seen(a: UniversityArea, context: AdapterContext, id: string) {
  const record = await area(a).get(context, id);
  if (!record) throw new Error(`${id} is not visible in ${a}`);
  return record;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sandbox-'));
  store = new SandboxStore(join(dir, 'sandbox.sqlite'));
  four = sandboxAdapters(store);
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('the one complete vertical', () => {
  it('runs enrol → submit → receipt → mark → release → archive', async () => {
    const s = student();
    const f = faculty();

    // Enrol. The course is the only record in `courses`, and enrolling is the
    // only thing a student can do to it.
    const course = await seen('courses', s, 'sandbox-101');
    expect(course.status).toBe('Open for enrolment');
    expect(course.actions.map((a) => a.id)).toEqual(['enrol']);
    await area('courses').execute(s, act('courses', course.id, course.version, 'enrol'), 'k-enrol');
    expect((await seen('courses', s, 'sandbox-101')).status).toBe('Enrolled');

    // Submit. The receipt is the thing the plan names, so it is asserted
    // rather than assumed: an id, a completed status, and a time.
    const before = await seen('assignments', s, 'student-1:a1');
    expect(before.status).toMatch(/not yet submitted/i);
    const receipt = await area('assignments').execute(
      s,
      act('assignments', before.id, before.version, 'submit', { work: 'Four answers.' }),
      'k-submit',
    );
    expect(receipt.status).toBe('completed');
    expect(receipt.id).toBe('k-submit');
    expect(Number.isNaN(Date.parse(receipt.recordedAt))).toBe(false);
    expect((await seen('assignments', s, 'student-1:a1')).status).toMatch(/awaiting marking/i);

    // Marked, and not yet visible. This is the step that is easy to skip and
    // is the whole reason `grades` has two actions rather than one.
    const toMark = await seen('grades', f, 'student-1:a1');
    await area('grades').execute(
      f,
      act('grades', toMark.id, toMark.version, 'grade', { mark: '17', comments: 'Clear on Q2.' }),
      'k-grade',
    );
    const hidden = await seen('grades', s, 'student-1:a1');
    expect(hidden.summary).toMatch(/not released/i);
    expect(JSON.stringify(hidden.details)).not.toContain('Clear on Q2');

    // Released, and now visible.
    const toRelease = await seen('grades', f, 'student-1:a1');
    await area('grades').execute(f, act('grades', toRelease.id, toRelease.version, 'release'), 'k-release');
    const shown = await seen('grades', s, 'student-1:a1');
    expect(shown.summary).toContain('17');
    expect(JSON.stringify(shown.details)).toContain('Clear on Q2');

    // Archived, and closed.
    const toArchive = await seen('records', f, 'student-1:a1');
    expect(toArchive.actions.map((a) => a.id)).toEqual(['archive']);
    await area('records').execute(f, act('records', toArchive.id, toArchive.version, 'archive'), 'k-archive');
    const closed = await seen('records', f, 'student-1:a1');
    expect(closed.status).toBe('Archived');
    expect(closed.actions).toEqual([]);

    // And the record is the trail, which is the stage the vertical ends at.
    const said = closed.details.map((d) => d.value).join(' | ');
    for (const step of ['Enrolled', 'Submitted', 'Marked', 'Feedback released', 'Archived']) {
      expect(said, `${step} is missing from the record`).toContain(step);
    }
  });
});

describe('what it refuses', () => {
  const submit = async (s = student()) => {
    await enrol(s);
    const r = await seen('assignments', s, `${s.identity.userId}:a1`);
    return area('assignments').execute(
      s,
      act('assignments', r.id, r.version, 'submit', { work: 'Done.' }),
      `k-${s.identity.userId}`,
    );
  };

  it('will not let a student read or submit somebody else’s work', async () => {
    const other = who('student-2', 'student');
    await enrol(other);
    await submit();
    expect(await area('assignments').get(other, 'student-1:a1')).toBeNull();
    await expect(
      area('assignments').execute(
        other,
        act('assignments', 'student-1:a1', '2', 'submit', { work: 'Mine now.' }),
        'k-theft',
      ),
    ).rejects.toThrow(/not your work/i);
  });

  it('will not hand one person’s row to another whose id contains a colon', async () => {
    // A user id is opaque and may contain a colon; a resolver that split on
    // the first one would read `a:b:a1` as student `a`, and hand `a:b` their
    // work. Refused at the ownership check either way, but the record must
    // not even resolve — the split is the bug, and the check is the net.
    const odd = who('tenant:9', 'student');
    await enrol(odd);
    const mine = await seen('assignments', odd, 'tenant:9:a1');
    expect(mine.id).toBe('tenant:9:a1');
    // `tenant:a1` would be this person's row only under a first-colon split;
    // under a last-colon one it names a student called `tenant`, who is not
    // on the roster and has no row.
    expect(await area('assignments').get(odd, 'tenant:a1')).toBeNull();
  });

  it('will not let a student mark, or faculty submit', async () => {
    const s = student();
    const f = faculty();
    await submit(s);
    const r = await seen('grades', s, 'student-1:a1');
    await expect(
      area('grades').execute(s, act('grades', r.id, r.version, 'grade', { mark: '20', comments: 'A+' }), 'k-self'),
    ).rejects.toThrow(/only the course faculty/i);
    // Faculty have no work of their own, so there is nothing of theirs to submit.
    await expect(
      area('assignments').execute(f, act('assignments', 'prof-1:a1', '1', 'submit', { work: 'x' }), 'k-prof'),
    ).rejects.toThrow(/enrolled student/i);
  });

  it('will not act on a record that has moved since it was read', async () => {
    const s = student();
    const r = await seen('assignments', s, 'student-1:a1');
    await submit(s);
    // `r.version` is now stale — the submission bumped it.
    await expect(
      area('assignments').execute(
        s,
        act('assignments', r.id, r.version, 'submit', { work: 'Again.' }),
        'k-stale',
      ),
    ).rejects.toThrow(/changed since you opened it/i);
  });

  it('keeps the order: no marking before submission, no release before marking', async () => {
    const s = student();
    const f = faculty();
    await enrol(s);
    const fresh = await seen('grades', f, 'student-1:a1');
    await expect(
      area('grades').execute(f, act('grades', fresh.id, fresh.version, 'grade', { mark: '5', comments: 'x' }), 'k-early'),
    ).rejects.toThrow(/cannot mark this/i);
    await submit();
    const marked = await seen('grades', f, 'student-1:a1');
    await expect(
      area('grades').execute(f, act('grades', marked.id, marked.version, 'release'), 'k-early-release'),
    ).rejects.toThrow(/cannot release feedback/i);
  });

  it('will not archive a record whose feedback is not out, and will not touch an archived one', async () => {
    const f = faculty();
    await submit();
    const open = await seen('records', f, 'student-1:a1');
    await expect(
      area('records').execute(f, act('records', open.id, open.version, 'archive'), 'k-early-archive'),
    ).rejects.toThrow(/cannot archive this/i);

    const g1 = await seen('grades', f, 'student-1:a1');
    await area('grades').execute(f, act('grades', g1.id, g1.version, 'grade', { mark: '9', comments: 'ok' }), 'k-g');
    const g2 = await seen('grades', f, 'student-1:a1');
    await area('grades').execute(f, act('grades', g2.id, g2.version, 'release'), 'k-r');
    const g3 = await seen('records', f, 'student-1:a1');
    await area('records').execute(f, act('records', g3.id, g3.version, 'archive'), 'k-a');

    const closed = await seen('records', f, 'student-1:a1');
    await expect(
      area('records').execute(f, act('records', closed.id, closed.version, 'archive'), 'k-again'),
    ).rejects.toThrow(/archived and cannot be changed/i);
  });

  it('shows a mark to nobody until it is released', async () => {
    const s = student();
    const f = faculty();
    await enrol(s);
    const r0 = await seen('assignments', s, 'student-1:a1');
    await area('assignments').execute(
      s,
      act('assignments', r0.id, r0.version, 'submit', { work: 'x' }),
      'k-sub',
    );
    const g = await seen('grades', f, 'student-1:a1');
    await area('grades').execute(
      f,
      act('grades', g.id, g.version, 'grade', { mark: '11', comments: 'Secret until released.' }),
      'k-mark',
    );
    // Not even to the marker: `released` is a property of the record, not of
    // who is looking, so a summary that leaked the mark would leak it to the
    // screen a student and a faculty member both read.
    for (const eyes of [s, f]) {
      const seenNow = await seen('grades', eyes, 'student-1:a1');
      expect(seenNow.summary).toMatch(/not released/i);
      expect(JSON.stringify(seenNow)).not.toContain('Secret until released');
    }
  });

  it('refuses a mark the assignment cannot carry', async () => {
    const f = faculty();
    await submit();
    const r = await seen('grades', f, 'student-1:a1');
    await expect(
      area('grades').execute(f, act('grades', r.id, r.version, 'grade', { mark: '400', comments: 'x' }), 'k-big'),
    ).rejects.toThrow(/between 0 and 20/);
  });
});

describe('the class, as a class', () => {
  it('shows faculty a student who has never opened the app', async () => {
    const f = faculty();
    // The whole point of a roster: somebody who owes work and has not been
    // near a computer is the one person a marker most needs in the list.
    const { records } = await area('assignments').list(f, { search: '', cursor: null });
    const ids = records.map((r) => r.id);
    expect(ids, 'a roster member with no activity is missing').toContain('quiet-1:a1');
  });

  it('says what the class owes, on the course record', async () => {
    const s = student();
    const f = faculty();
    await enrol(s);
    const r = await seen('assignments', s, 'student-1:a1');
    await area('assignments').execute(
      s,
      act('assignments', r.id, r.version, 'submit', { work: 'Mine.' }),
      'k-one',
    );
    const course = await seen('courses', f, 'sandbox-101');
    const said = JSON.stringify(course.details);
    expect(said, 'the course should say how many are enrolled').toMatch(/enrolled/i);
    expect(said, 'and how much work is outstanding').toMatch(/outstanding|not submitted|to mark/i);
  });

  it('is not joined twice, however the second attempt is keyed', async () => {
    const s = student();
    await enrol(s);
    const course = await seen('courses', s, 'sandbox-101');
    // A different idempotency key, so this is a second *attempt* rather than a
    // retry of the first — the retry path is tested under the receipt.
    await expect(
      area('courses').execute(s, act('courses', course.id, course.version, 'enrol'), 'enrol-again'),
    ).rejects.toThrow(/already enrolled/i);
    expect(store.roster().filter((r) => r.student === 'student-1')).toHaveLength(1);
  });

  it('writes nothing when it is only being read', async () => {
    // The first version of the store made a row the first time anybody looked,
    // which turned every faculty list into a write and made the stored rows a
    // record of who had *browsed*. Reads are reads.
    const f = faculty();
    await area('assignments').list(f, { search: '', cursor: null });
    await area('grades').list(f, { search: '', cursor: null });
    await area('records').list(f, { search: '', cursor: null });
    await seen('assignments', student(), 'student-1:a1');
    expect(store.roster().length, 'the seeded class').toBe(3);
    expect(store.byId('quiet-1:a1'), 'a read materialised a row').toBeNull();
    expect(store.byId('student-1:a1'), 'a read materialised a row').toBeNull();
  });

  it('will not take work from somebody who is not on the roster', async () => {
    const stranger = who('gatecrasher-1', 'student');
    await expect(
      area('assignments').execute(
        stranger,
        act('assignments', 'gatecrasher-1:a1', '1', 'submit', { work: 'Let me in.' }),
        'k-crash',
      ),
    ).rejects.toThrow(/roster|not enrolled/i);
  });
});

describe('the receipt', () => {
  it('is issued once, however many times the same action arrives', async () => {
    const s = student();
    await enrol(s);
    const r = await seen('assignments', s, 'student-1:a1');
    const input = act('assignments', r.id, r.version, 'submit', { work: 'First.' });
    const first = await area('assignments').execute(s, input, 'same-key');
    // The case this exists for: execute ran, the connection died, and the
    // gateway retried with the same idempotency key. Submitting twice would
    // be the bug; a second receipt claiming a second submission would be too.
    const again = await area('assignments').execute(s, input, 'same-key');
    expect(again).toEqual(first);
    // Submissions, not entries: enrolling writes to the same trail, so a bare
    // length would have counted it and passed for the wrong reason.
    expect(store.byId('student-1:a1')?.history.filter((h) => h.what === 'Submitted').length).toBe(1);
  });

  it('is issued once for enrolment too, which takes a different path', async () => {
    // `courses.execute` loops over the published work instead of touching one
    // row, so it does not share the guard the other three have. Asserted
    // rather than assumed: the shape that differs is the one that breaks.
    const s = student();
    const course = await seen('courses', s, 'sandbox-101');
    const input = act('courses', course.id, course.version, 'enrol');
    await area('courses').execute(s, input, 'enrol-once');
    await area('courses').execute(s, input, 'enrol-once');
    expect(store.byId('student-1:a1')?.history.filter((h) => h.what === 'Enrolled').length).toBe(1);
  });

  it('can be found afterwards by the key, which is what reconcile is for', async () => {
    const s = student();
    await enrol(s);
    const r = await seen('assignments', s, 'student-1:a1');
    const input = act('assignments', r.id, r.version, 'submit', { work: 'First.' });
    await area('assignments').execute(s, input, 'lost-key');
    const found = await area('assignments').reconcile?.(s, input, 'lost-key');
    expect(found?.id).toBe('lost-key');
    // And an operation that never happened is honestly unknown, rather than
    // being reported as fine — the gateway tells the student to wait on null.
    expect(await area('assignments').reconcile?.(s, input, 'never')).toBeNull();
  });

  it('survives the process, because a demonstration that forgets proves nothing', async () => {
    const s = student();
    await enrol(s);
    const r = await seen('assignments', s, 'student-1:a1');
    await area('assignments').execute(
      s,
      act('assignments', r.id, r.version, 'submit', { work: 'Persisted.' }),
      'k-persist',
    );
    store.close();

    const reopened = new SandboxStore(join(dir, 'sandbox.sqlite'));
    try {
      const after = sandboxAdapters(reopened);
      const got = await after
        .find((a) => a.area === 'assignments')!
        .get(s, 'student-1:a1');
      expect(got?.status).toMatch(/awaiting marking/i);
      expect(reopened.receipt('k-persist')?.id).toBe('k-persist');
    } finally {
      // Handed to the hook rather than closed here: closing it twice is what
      // the first version did, and "database is not open" in the teardown of
      // a passing test is a failure nobody reads carefully.
      store = reopened;
    }
  });
});

describe('a review changes nothing', () => {
  it('is safe to read and walk away from', async () => {
    const s = student();
    await enrol(s);
    const r = await seen('assignments', s, 'student-1:a1');
    const input = act('assignments', r.id, r.version, 'submit', { work: 'Two words here.' });
    const said = await area('assignments').review(s, input);
    expect(said.title).toMatch(/submit/i);
    // The gateway runs review at prepare and again at commit and compares the
    // two; a review that had written something would differ from itself.
    expect(await area('assignments').review(s, input)).toEqual(said);
    const after = await seen('assignments', s, 'student-1:a1');
    expect(after.version).toBe(r.version);
    expect(after.status).toMatch(/not yet submitted/i);
  });
});

/*
 * "Clearly labeled" is a requirement of the plan, and a label nobody checks
 * is a label that comes off in the first refactor. So it is checked — in the
 * strings a person actually reads, and in the source, for the one rule that
 * cannot be read off a string: this is never in the approved registry.
 */
describe('it is unmistakably a sandbox', () => {
  it('says so on every record and every connection', async () => {
    const s = student();
    const f = faculty();
    await enrol(s);
    const r1 = await seen('assignments', s, 'student-1:a1');
    await area('assignments').execute(
      s,
      act('assignments', r1.id, r1.version, 'submit', { work: 'x' }),
      'k-1',
    );
    for (const a of four) {
      const status = await a.status(f);
      expect(status.provider, `${a.area} provider`).toContain(SANDBOX_MARK);
      const { records } = await a.list(f, { search: '', cursor: null });
      expect(records.length, `${a.area} listed nothing`).toBeGreaterThan(0);
      for (const r of records) {
        expect(r.title, `${a.area}: "${r.title}"`).toContain(SANDBOX_MARK);
      }
    }
  });

  it('is not in the registry of approved adapters, and is opt-in at the server', () => {
    const registry = readFileSync('server/institution/adapters.ts', 'utf8');
    expect(registry, 'the approved registry must stay empty').toMatch(
      /export const adapters: InstitutionAdapter\[\] = \[\];/,
    );
    // The import, not the word: that file's header now explains why the
    // sandbox is *not* in this list, and a check that banned the word banned
    // the explanation. What must not appear is a line that pulls it in.
    expect(registry, 'the sandbox must not be imported into the approved registry').not.toMatch(
      /^\s*import[^\n]*sandbox/m,
    );

    // The only way in is an explicit environment variable on the server, and
    // it is the *test* that must be asserted rather than the name: the first
    // version of this checked that start.ts mentioned the variable anywhere,
    // which a mutation replacing the condition with `true` passed, because
    // the header comment still named it.
    const start = readFileSync('server/institution/start.ts', 'utf8');
    expect(start).toMatch(/const sandboxOn = process\.env\.SEMESTER_SANDBOX_INSTITUTION === '1';/);
    expect(start, 'the adapters must be installed only when it is on').toMatch(
      /sandboxStore \? \[\.\.\.adapters, \.\.\.sandboxAdapters\(sandboxStore\)\] : adapters/,
    );
  });
});

/*
 * And the same loop through the gateway, which is the thing that will actually
 * run it.
 *
 * Everything above calls the adapters directly, which is the right level for
 * a state machine and the wrong level for the claim that matters here: that
 * the vertical works *end to end*. Between a browser and these adapters sit
 * authentication, the origin check, the rate limiter, the two-phase action
 * and the journal — and the two-phase part is not a formality. The gateway
 * runs `review` at prepare, stores it encrypted, runs `review` again at
 * commit, and refuses if the answer moved. An adapter can pass every test
 * above and still fail that.
 *
 * So this drives HTTP requests in, reads status codes and JSON out, over a
 * real journal on a real file — the same shape `gateway.test.ts` uses, and
 * for the same reason.
 */
describe('the vertical, through the gateway', () => {
  const journalKey = Buffer.alloc(32, 9);

  function wire(roles: UniversityRole[]) {
    const journal = new ActionJournal(join(dir, `journal-${roles.join('-')}.sqlite`), journalKey);
    const gateway = createGateway({
      origin: 'http://localhost:5173',
      institutionName: SANDBOX_NAME,
      authenticate: async () => ({
        userId: roles.includes('faculty') ? 'prof-1' : 'student-1',
        institutionId: SANDBOX_INSTITUTION,
        roles,
      }),
      adapters: four,
      journal,
    });
    const call = (path: string, body?: unknown) =>
      gateway(
        new Request(`http://local${path}`, {
          method: body === undefined ? 'GET' : 'POST',
          headers: {
            origin: 'http://localhost:5173',
            authorization: 'Bearer sandbox',
            'content-type': 'application/json',
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
      );
    return { journal, call };
  }

  /** Prepare, then confirm — the only way an action reaches an institution. */
  async function through(
    call: (path: string, body?: unknown) => Promise<Response>,
    input: ActionInput,
  ) {
    const prepared = await call('/actions/prepare', input);
    expect(prepared.status, await prepared.clone().text()).toBe(200);
    const review = (await prepared.json()) as { id: string; title: string };
    const done = await call('/actions/commit', { reviewId: review.id, confirmed: true });
    expect(done.status, await done.clone().text()).toBe(200);
    return { review, receipt: (await done.json()) as { id: string; status: string; message: string } };
  }

  it('carries one piece of work from enrolment to an archived record', async () => {
    const asStudent = wire(['student']);
    const asFaculty = wire(['faculty']);
    try {
      const status = await (await asStudent.call('/status')).json();
      expect(status.institutionName).toBe(SANDBOX_NAME);
      const courses = status.connections.find((c: { area: string }) => c.area === 'courses');
      expect(courses.state).toBe('connected');
      expect(courses.provider).toContain(SANDBOX_MARK);

      const enrol = await through(asStudent.call, act('courses', 'sandbox-101', '1', 'enrol'));
      expect(enrol.receipt.status).toBe('completed');
      expect(enrol.receipt.message).toContain(SANDBOX_MARK);

      const listed = await (await asStudent.call('/records?area=assignments')).json();
      const paper = listed.records.find((r: { id: string }) => r.id === 'student-1:a1');
      expect(paper.title).toContain(SANDBOX_MARK);

      const submitted = await through(
        asStudent.call,
        act('assignments', paper.id, paper.version, 'submit', { work: 'My four answers.' }),
      );
      expect(submitted.review.title).toMatch(/submit/i);
      expect(submitted.receipt.status).toBe('completed');

      const forMarking = await (await asFaculty.call('/records?area=grades')).json();
      const mine = forMarking.records.find((r: { id: string }) => r.id === 'student-1:a1');
      await through(
        asFaculty.call,
        act('grades', mine.id, mine.version, 'grade', { mark: '18', comments: 'Strong on Q3.' }),
      );

      const toRelease = await (await asFaculty.call('/records?area=grades')).json();
      const graded = toRelease.records.find((r: { id: string }) => r.id === 'student-1:a1');
      await through(asFaculty.call, act('grades', graded.id, graded.version, 'release'));

      const studentSees = await (await asStudent.call('/records?area=grades')).json();
      const released = studentSees.records.find((r: { id: string }) => r.id === 'student-1:a1');
      expect(released.summary).toContain('18');
      expect(JSON.stringify(released.details)).toContain('Strong on Q3');

      const archivable = await (await asFaculty.call('/records?area=records')).json();
      const open = archivable.records.find((r: { id: string }) => r.id === 'student-1:a1');
      await through(asFaculty.call, act('records', open.id, open.version, 'archive'));

      const closed = await (await asFaculty.call('/records?area=records')).json();
      const final = closed.records.find((r: { id: string }) => r.id === 'student-1:a1');
      expect(final.status).toBe('Archived');
      expect(final.actions).toEqual([]);
    } finally {
      asStudent.journal.close();
      asFaculty.journal.close();
    }
  });

  it('refuses a confirmation whose review has moved under it', async () => {
    const asStudent = wire(['student']);
    const other = wire(['student']);
    try {
      await through(asStudent.call, act('courses', 'sandbox-101', '1', 'enrol'));
      const paper = (await (await asStudent.call('/records?area=assignments')).json()).records.find(
        (r: { id: string }) => r.id === 'student-1:a1',
      );
      const input = act('assignments', paper.id, paper.version, 'submit', { work: 'Prepared.' });

      // Prepared, and then the same work submitted by another tab before this
      // one is confirmed. The gateway re-runs `review` at commit; the adapter
      // now refuses it, and the commit must fail rather than run anyway.
      const prepared = await asStudent.call('/actions/prepare', input);
      expect(prepared.status).toBe(200);
      const review = (await prepared.json()) as { id: string };
      await through(other.call, input);

      const late = await asStudent.call('/actions/commit', { reviewId: review.id, confirmed: true });
      expect(late.status).toBeGreaterThanOrEqual(400);
      // And nothing was submitted twice.
      expect(store.byId('student-1:a1')?.history.filter((h) => h.what === 'Submitted').length).toBe(1);
    } finally {
      asStudent.journal.close();
      other.journal.close();
    }
  });

  it('answers 503 for the areas the sandbox does not implement', async () => {
    const asStudent = wire(['student']);
    try {
      expect((await asStudent.call('/records?area=billing')).status).toBe(503);
      const status = await (await asStudent.call('/status')).json();
      const billing = status.connections.find((c: { area: string }) => c.area === 'billing');
      // The sandbox is four services, not thirty-seven. The other thirty-three
      // must keep saying they are not configured — a demonstration that lit up
      // the whole University screen would be the placeholder the plan forbids.
      expect(billing.state).toBe('not-configured');
      expect(billing.canWrite).toBe(false);
    } finally {
      asStudent.journal.close();
    }
  });
});
