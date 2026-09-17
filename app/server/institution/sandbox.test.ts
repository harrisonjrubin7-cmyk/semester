import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
      act('grades', toMark.id, toMark.version, 'grade', { method: '7', accuracy: '7', clarity: '3', comments: 'Clear on Q2.' }),
      'k-grade',
    );
    const hidden = await seen('grades', s, 'student-1:a1');
    expect(hidden.summary).toMatch(/not released/i);
    expect(JSON.stringify(hidden.details)).not.toContain('Clear on Q2');

    // Released, and now visible.
    const toRelease = await seen('grades', f, 'student-1:a1');
    await area('grades').execute(f, act('grades', toRelease.id, toRelease.version, 'release'), 'k-release');
    const shown = await seen('grades', s, 'student-1:a1');
    expect(shown.summary).toContain('17 out of 20');
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
      area('grades').execute(s, act('grades', r.id, r.version, 'grade', { method: '8', accuracy: '8', clarity: '4', comments: 'A+' }), 'k-self'),
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
      area('grades').execute(f, act('grades', fresh.id, fresh.version, 'grade', { method: '2', accuracy: '2', clarity: '1', comments: 'x' }), 'k-early'),
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
    await area('grades').execute(f, act('grades', g1.id, g1.version, 'grade', { method: '4', accuracy: '4', clarity: '1', comments: 'ok' }), 'k-g');
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
      act('grades', g.id, g.version, 'grade', { method: '5', accuracy: '4', clarity: '2', comments: 'Secret until released.' }),
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

  it('refuses a criterion mark the rubric cannot carry', async () => {
    const f = faculty();
    await submit();
    const r = await seen('grades', f, 'student-1:a1');
    await expect(
      area('grades').execute(f, act('grades', r.id, r.version, 'grade', { method: '400', accuracy: '1', clarity: '1', comments: 'x' }), 'k-big'),
    ).rejects.toThrow(/Method must be between 0 and 8/);
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

describe('the rubric', () => {
  const mark = async (f: AdapterContext, fields: Record<string, string>, key = 'k-mark') => {
    const g = await seen('grades', f, 'student-1:a1');
    return area('grades').execute(f, act('grades', g.id, g.version, 'grade', fields), key);
  };

  it('is readable before the work is done, not with the grade', async () => {
    const s = student();
    await enrol(s);
    const paper = await seen('assignments', s, 'student-1:a1');
    const said = JSON.stringify(paper.details);
    // A rubric that arrives attached to the mark arrived too late to be used.
    expect(said).toContain('Method');
    expect(said).toContain('The steps are shown');
    expect(said).toMatch(/Marked out of[^}]*20/);
    /*
     * And what the piece is worth, beside what it is marked out of, for the
     * same reason. "Out of 20" is not a weighting: a student deciding where
     * the evening goes needs to know that this one carries a fifth of the
     * course and the paper carries better than a third.
     */
    expect(said, 'what it is worth').toMatch(/Worth[^}]*20% of the course/);
  });

  it('adds the criteria up rather than taking a total on trust', async () => {
    const s = student();
    const f = faculty();
    await enrol(s);
    const r = await seen('assignments', s, 'student-1:a1');
    await area('assignments').execute(s, act('assignments', r.id, r.version, 'submit', { work: 'x' }), 'k-s');
    await mark(f, { method: '6', accuracy: '5', clarity: '4', comments: 'Good method.' });
    const g = await seen('grades', f, 'student-1:a1');
    await area('grades').execute(f, act('grades', g.id, g.version, 'release'), 'k-rel');
    const out = await seen('grades', s, 'student-1:a1');
    expect(out.summary).toContain('15 out of 20');
  });

  it('tells the student which criterion lost the marks', async () => {
    const s = student();
    const f = faculty();
    await enrol(s);
    const r = await seen('assignments', s, 'student-1:a1');
    await area('assignments').execute(s, act('assignments', r.id, r.version, 'submit', { work: 'x' }), 'k-s');
    await mark(f, { method: '8', accuracy: '3', clarity: '4', comments: 'Check your arithmetic.' });
    const g = await seen('grades', f, 'student-1:a1');
    await area('grades').execute(f, act('grades', g.id, g.version, 'release'), 'k-rel');
    const out = await seen('grades', s, 'student-1:a1');
    const said = out.details.map((d) => `${d.label} :: ${d.value}`);
    // The number alone says a student lost five marks. This says where, and
    // what that criterion was asking for — which is a thing to do differently.
    expect(said.join(' | ')).toContain('Accuracy · 3 of 8');
    expect(said.join(' | ')).toContain('with units');
    expect(said.join(' | ')).toContain('Method · 8 of 8');
  });

  it('will not accept a rubric with a box left empty', async () => {
    const s = student();
    const f = faculty();
    await enrol(s);
    const r = await seen('assignments', s, 'student-1:a1');
    await area('assignments').execute(s, act('assignments', r.id, r.version, 'submit', { work: 'x' }), 'k-s');
    // Not scored as zero: a marker who left a box empty has not decided it is
    // worth nothing, they have not finished, and writing the zero for them is
    // the kind of helpfulness that ends up on a transcript.
    await expect(mark(f, { method: '8', clarity: '4', comments: 'x' })).rejects.toThrow(
      /Accuracy has not been marked/,
    );
    await expect(mark(f, { method: '8', accuracy: '', clarity: '4', comments: 'x' })).rejects.toThrow(
      /Accuracy has not been marked/,
    );
  });

  it('says a box is empty at prepare, before anybody confirms', async () => {
    const s = student();
    const f = faculty();
    await enrol(s);
    const r = await seen('assignments', s, 'student-1:a1');
    await area('assignments').execute(s, act('assignments', r.id, r.version, 'submit', { work: 'x' }), 'k-s');
    const g = await seen('grades', f, 'student-1:a1');
    await expect(
      area('grades').review(f, act('grades', g.id, g.version, 'grade', { method: '8', comments: 'x' })),
    ).rejects.toThrow(/Accuracy has not been marked/);
  });

  it('offers a field per criterion and no field for the total', async () => {
    const s = student();
    const f = faculty();
    await enrol(s);
    const r = await seen('assignments', s, 'student-1:a1');
    await area('assignments').execute(s, act('assignments', r.id, r.version, 'submit', { work: 'x' }), 'k-s');
    const g = await seen('grades', f, 'student-1:a1');
    const fields = g.actions.find((a) => a.id === 'grade')?.fields ?? [];
    expect(fields.map((x) => x.id)).toEqual(['method', 'accuracy', 'clarity', 'comments']);
    // No total field: it is the sum, so a marker cannot hand back a number
    // that disagrees with its own parts.
    expect(fields.map((x) => x.id)).not.toContain('mark');
    expect(fields.every((x) => x.required)).toBe(true);
  });
});

describe('discussion', () => {
  const say = async (
    context: AdapterContext,
    thread: string,
    body: string,
    audience: string,
    key = `p-${Math.random().toString(36).slice(2)}`,
  ) => {
    const r = await seen('courses', context, `thread:${thread}`);
    return area('courses').execute(
      context,
      act('courses', r.id, r.version, isFacultyCtx(context) ? 'answer' : 'ask', { body, audience }),
      key,
    );
  };
  const isFacultyCtx = (c: AdapterContext) => c.identity.roles.includes('faculty');
  const bodies = async (context: AdapterContext, thread: string) =>
    (await seen('courses', context, `thread:${thread}`)).details.map((d) => d.value).join(' | ');

  it('answers a question once, where the class can read it', async () => {
    const s = student();
    const f = faculty();
    await enrol(s);
    await say(s, 'a1', 'What is Q3 asking for?', 'The class');
    await say(f, 'a1', 'The second derivative, not the first.', 'The class');
    const asStudent = await bodies(s, 'a1');
    expect(asStudent).toContain('What is Q3 asking for?');
    expect(asStudent).toContain('The second derivative');
    expect(asStudent, 'a faculty answer should say so').toContain('(faculty)');
    // And another student, who asked nothing, reads the same thread.
    const other = who('student-2', 'student');
    await enrol(other);
    expect(await bodies(other, 'a1')).toContain('The second derivative');
  });

  /*
   * The load-bearing one, and it is asserted from the other student's side
   * rather than from the poster's. A test that checked the poster can see
   * their own private post would pass on a board with no privacy at all.
   */
  it('keeps a post meant for staff away from the rest of the class', async () => {
    const s = student();
    const other = who('student-2', 'student');
    const f = faculty();
    await enrol(s);
    await enrol(other);
    await say(s, 'general', 'I am struggling and may need an extension.', 'Staff only');

    const theirs = await bodies(other, 'general');
    expect(theirs, 'a private post reached another student').not.toContain('extension');
    expect(theirs, 'and so did the fact that one exists').not.toContain('to staff only');

    // Visible to the faculty it was addressed to, and to its author.
    expect(await bodies(f, 'general')).toContain('extension');
    expect(await bodies(s, 'general')).toContain('extension');
  });

  it('will not let somebody outside the class read or post', async () => {
    const stranger = who('gatecrasher-2', 'student');
    const s = student();
    await enrol(s);
    await say(s, 'a1', 'A question the class can see.', 'The class');
    expect(await area('courses').get(stranger, 'thread:a1')).toBeNull();
    await expect(say(stranger, 'a1', 'Let me in.', 'The class')).rejects.toThrow(
      /the class can read or post|not visible/i,
    );
    // And the threads are not even listed for them. The course and its
    // syllabus are — somebody deciding whether to take a course reads those
    // before they enrol, and neither of them is anybody's question.
    const { records } = await area('courses').list(stranger, { search: '', cursor: null });
    expect(records.map((r) => r.id)).toEqual(['sandbox-101', 'syllabus']);
  });

  it('refuses an outsider who posts without reading first', async () => {
    /*
     * The test above goes through the record, so the read's refusal fires and
     * the one inside the post never runs — a mutation removing it survived.
     * A client does not have to read anything first, which is the whole point
     * of checking at the write as well, so this is the call a hostile one
     * makes: straight to execute, with a guessed version.
     */
    const stranger = who('gatecrasher-3', 'student');
    await expect(
      area('courses').execute(
        stranger,
        act('courses', 'thread:a1', '0', 'ask', { body: 'Straight in.', audience: 'The class' }),
        'p-direct',
      ),
    ).rejects.toThrow(/Only the class can read or post here/);
    // And nothing of theirs is in the thread for the class to read.
    const s = student();
    await enrol(s);
    expect(await bodies(s, 'a1')).not.toContain('Straight in');
  });

  it('makes the choice of audience explicit rather than defaulting it', async () => {
    const s = student();
    await enrol(s);
    const r = await seen('courses', s, 'thread:a1');
    const ask = r.actions.find((a) => a.id === 'ask');
    const field = ask?.fields.find((x) => x.id === 'audience');
    expect(field?.required, 'a person should have to choose').toBe(true);
    expect(field?.options).toEqual(['The class', 'Staff only']);
    // A missing or unknown audience is refused, not guessed at.
    await expect(
      area('courses').execute(s, act('courses', r.id, r.version, 'ask', { body: 'x' }), 'p-none'),
    ).rejects.toThrow(/Choose who sees this/);
    await expect(
      area('courses').execute(
        s,
        act('courses', r.id, r.version, 'ask', { body: 'x', audience: 'Everyone on the internet' }),
        'p-bad',
      ),
    ).rejects.toThrow(/Choose who sees this/);
  });

  it('says who will see it before it is posted, because a post cannot be taken back', async () => {
    const s = student();
    await enrol(s);
    const r = await seen('courses', s, 'thread:general');
    const said = await area('courses').review(
      s,
      act('courses', r.id, r.version, 'ask', { body: 'Private, please.', audience: 'Staff only' }),
    );
    const detail = JSON.stringify(said.details);
    expect(detail).toContain('faculty only');
    expect(detail).toContain('cannot be edited');
    // And reviewing posted nothing.
    expect(await bodies(s, 'general')).not.toContain('Private, please');
  });

  it('does not put a thread on anybody’s work, so the list is not a list of who submitted', async () => {
    const s = student();
    await enrol(s);
    const { records } = await area('courses').list(s, { search: '', cursor: null });
    // The course and its syllabus, then one thread per published assignment
    // plus a general one. Nothing keyed to a person.
    expect(records.map((r) => r.id)).toEqual([
      'sandbox-101',
      'syllabus',
      'thread:general',
      'thread:a1',
      'thread:a2',
    ]);
    for (const r of records) expect(r.title).toContain(SANDBOX_MARK);
  });

  it('is append-only: the same post does not arrive twice', async () => {
    const s = student();
    await enrol(s);
    await say(s, 'a1', 'Asked once.', 'The class', 'p-same');
    await say(s, 'a1', 'Asked once.', 'The class', 'p-same');
    const said = await bodies(s, 'a1');
    expect(said.match(/Asked once/g)?.length).toBe(1);
  });
});

describe('publishing work', () => {
  const RUBRIC = 'Argument | 10 | A claim somebody could disagree with.\nEvidence | 5 | Sources used, not summarised.';
  const soon = () => new Date(Date.now() + 14 * 24 * 3_600_000).toISOString();

  const publish = async (fields: Record<string, string>, key = 'k-pub') => {
    const f = faculty();
    const course = await seen('courses', f, 'sandbox-101');
    return area('courses').execute(f, act('courses', course.id, course.version, 'publish', fields), key);
  };
  const reviewing = async (fields: Record<string, string>) => {
    const f = faculty();
    const course = await seen('courses', f, 'sandbox-101');
    return area('courses').review(f, act('courses', course.id, course.version, 'publish', fields));
  };
  const full = (over: Record<string, string> = {}) => ({
    title: 'Essay two',
    due: soon(),
    brief: 'Eight hundred words.',
    rubric: RUBRIC,
    weight: '10',
    ...over,
  });

  it('reaches the whole roster, with a thread and a rubric', async () => {
    const s = student();
    const f = faculty();
    await enrol(s);
    const receipt = await publish(full());
    expect(receipt.message).toMatch(/Published Essay two, out of 15/);

    // The student has it, with the rubric readable before they start.
    const mine = await seen('assignments', s, 'student-1:essay-two');
    expect(mine.title).toContain('Essay two');
    expect(JSON.stringify(mine.details)).toContain('A claim somebody could disagree with');
    expect(JSON.stringify(mine.details)).toMatch(/Marked out of[^}]*15/);

    // And somewhere to ask about it.
    const { records } = await area('courses').list(s, { search: '', cursor: null });
    expect(records.map((r) => r.id)).toContain('thread:essay-two');

    // And the marker sees it owed by everyone on the roster, not just the tester.
    const course = await seen('courses', f, 'sandbox-101');
    // Four, not three: the seeded class plus the tester who just enrolled.
    // New work is owed by everybody on the roster from the moment it lands.
    expect(store.roster()).toHaveLength(4);
    expect(course.details.find((d) => d.label === 'Essay two')?.value).toMatch(/0 of 4 in hand/);
  });

  it('reads the marking scheme back before anything is published', async () => {
    // The answer to parsing free text: the person sees what was understood
    // rather than what they typed, and nothing exists until they confirm.
    const said = await reviewing(full());
    const detail = JSON.stringify(said.details);
    expect(detail).toContain('Argument · 10 marks');
    expect(detail).toContain('Evidence · 5 marks');
    expect(detail).toMatch(/Marked out of[^}]*15/);
    expect(store.assignment('essay-two'), 'reviewing published it').toBeUndefined();
  });

  it('quotes the line it could not read', async () => {
    await expect(reviewing(full({ rubric: 'Argument | 10 | Fine\nEvidence, 5, oops' }))).rejects.toThrow(
      /"Evidence, 5, oops"/,
    );
    await expect(reviewing(full({ rubric: 'Argument | lots | Fine' }))).rejects.toThrow(
      /"Argument" needs a whole number of marks above zero, not "lots"/,
    );
    await expect(reviewing(full({ rubric: 'Argument | 0 | Fine' }))).rejects.toThrow(/above zero/);
    await expect(reviewing(full({ rubric: '' }))).rejects.toThrow(/at least one criterion/);
  });

  it('will not publish two criteria under one name', async () => {
    await expect(
      reviewing(full({ rubric: 'Argument | 5 | One\nargument | 5 | Two' })),
    ).rejects.toThrow(/Two criteria are both called/);
  });

  it('will not publish into the past, or on top of something', async () => {
    await expect(reviewing(full({ due: '2020-01-01T09:00:00Z' }))).rejects.toThrow(/already passed/);
    await expect(reviewing(full({ due: 'next Tuesday' }))).rejects.toThrow(/not a date this can read/);
    await publish(full());
    await expect(reviewing(full())).rejects.toThrow(/already published/);
  });

  it('is faculty’s to do, and nobody else’s', async () => {
    const s = student();
    await enrol(s);
    const course = await seen('courses', s, 'sandbox-101');
    // Not offered to them...
    expect(course.actions.map((a) => a.id)).not.toContain('publish');
    // ...and refused if they send it anyway.
    await expect(
      area('courses').execute(s, act('courses', course.id, course.version, 'publish', full()), 'k-nope'),
    ).rejects.toThrow(/Only the course faculty can publish/);
    expect(store.assignment('essay-two')).toBeUndefined();
  });

  it('gives the criteria ids the marking form can actually use', async () => {
    // These become field ids, and the gateway's own validator refuses one
    // that does not match its pattern — so a name with punctuation in it must
    // come out as something legal rather than as a form nobody can submit.
    await publish(full({ title: 'Lab report', rubric: 'Method & rigour | 6 | Careful.\nWrite-up | 4 | Clear.' }));
    const a = store.assignment('lab-report');
    expect(a?.criteria.map((c) => c.id)).toEqual(['method-rigour', 'write-up']);
    for (const c of a?.criteria ?? []) expect(c.id).toMatch(/^[a-z][a-z0-9-]{0,63}$/);
  });
});

describe('an appeal', () => {
  /** Carry one piece of work all the way to released feedback. */
  const released = async (marks: Record<string, string> = { method: '5', accuracy: '4', clarity: '2' }) => {
    const s = student();
    const f = faculty();
    await enrol(s);
    const r = await seen('assignments', s, 'student-1:a1');
    await area('assignments').execute(s, act('assignments', r.id, r.version, 'submit', { work: 'x' }), 'a-sub');
    const g = await seen('grades', f, 'student-1:a1');
    await area('grades').execute(
      f,
      act('grades', g.id, g.version, 'grade', { ...marks, comments: 'As marked.' }),
      'a-mark',
    );
    const g2 = await seen('grades', f, 'student-1:a1');
    await area('grades').execute(f, act('grades', g2.id, g2.version, 'release'), 'a-rel');
    return { s, f };
  };

  it('can be asked for once the mark has been seen, and not before', async () => {
    const s = student();
    await enrol(s);
    // Nothing to dispute: a mark you cannot see is not a mark you can argue with.
    const early = await area('appeals').get(s, 'student-1:a1');
    expect(early?.actions.map((a) => a.id) ?? []).toEqual([]);

    /*
     * And refused if sent anyway. The check above is about the menu, and a
     * client does not need the menu — the same hole a mutation found in the
     * discussion board, where every test went through the record first and
     * the write's own check was never reached.
     */
    const r = await seen('appeals', s, 'student-1:a1');
    await expect(
      area('appeals').execute(s, act('appeals', r.id, r.version, 'appeal', { reason: 'Early.' }), 'a-early'),
    ).rejects.toThrow(/no released mark to appeal/i);

    await released();
    const now = await seen('appeals', s, 'student-1:a1');
    expect(now.actions.map((a) => a.id)).toEqual(['appeal']);
  });

  it('leaves the original mark standing while it is open', async () => {
    const { s, f } = await released();
    const r = await seen('appeals', s, 'student-1:a1');
    await area('appeals').execute(
      s,
      act('appeals', r.id, r.version, 'appeal', { reason: 'Q2 was marked against the wrong rubric line.' }),
      'a-ask',
    );
    const asked = await seen('appeals', f, 'student-1:a1');
    expect(asked.status).toMatch(/under appeal/i);
    expect(JSON.stringify(asked.details)).toContain('wrong rubric line');
    // 11 of 20 still, and the student can still read it.
    expect((await seen('grades', s, 'student-1:a1')).summary).toContain('11 out of 20');
  });

  it('is upheld with a reason, and the mark does not move', async () => {
    const { s, f } = await released();
    const r = await seen('appeals', s, 'student-1:a1');
    await area('appeals').execute(s, act('appeals', r.id, r.version, 'appeal', { reason: 'Please recheck.' }), 'a-ask');
    const open = await seen('appeals', f, 'student-1:a1');
    await area('appeals').execute(
      f,
      act('appeals', open.id, open.version, 'uphold', { reason: 'The rubric line was applied as written.' }),
      'a-up',
    );
    const done = await seen('appeals', s, 'student-1:a1');
    expect(done.status).toMatch(/upheld/i);
    expect(JSON.stringify(done.details)).toContain('applied as written');
    expect((await seen('grades', s, 'student-1:a1')).summary).toContain('11 out of 20');
  });

  it('is amended by re-marking, and the first mark is still in the record', async () => {
    const { s, f } = await released();
    const r = await seen('appeals', s, 'student-1:a1');
    await area('appeals').execute(s, act('appeals', r.id, r.version, 'appeal', { reason: 'Q2.' }), 'a-ask');
    const open = await seen('appeals', f, 'student-1:a1');
    await area('appeals').execute(
      f,
      act('appeals', open.id, open.version, 'amend', {
        method: '7',
        accuracy: '6',
        clarity: '3',
        reason: 'Q2 was indeed marked against the wrong line.',
      }),
      'a-am',
    );
    expect((await seen('grades', s, 'student-1:a1')).summary).toContain('16 out of 20');
    // The point of an academic record: the first mark is not erased by the second.
    const record = await seen('records', f, 'student-1:a1');
    const trail = record.details.map((d) => d.value).join(' | ');
    expect(trail).toContain('Marked');
    expect(trail).toContain('Appealed');
    expect(trail).toContain('Mark amended');
    expect(JSON.stringify(await seen('appeals', s, 'student-1:a1'))).toContain('11');
  });

  it('is the student’s to raise and faculty’s to answer, and neither may do the other’s part', async () => {
    const { s, f } = await released();
    const r = await seen('appeals', f, 'student-1:a1');
    await expect(
      area('appeals').execute(f, act('appeals', r.id, r.version, 'appeal', { reason: 'On their behalf.' }), 'a-x'),
    ).rejects.toThrow(/Only an enrolled student|not your work/i);
    await area('appeals').execute(
      s,
      act('appeals', r.id, r.version, 'appeal', { reason: 'Mine to raise.' }),
      'a-mine',
    );
    const open = await seen('appeals', s, 'student-1:a1');
    await expect(
      area('appeals').execute(s, act('appeals', open.id, open.version, 'uphold', { reason: 'I agree with me.' }), 'a-y'),
    ).rejects.toThrow(/Only the course faculty/i);
  });

  it('cannot be raised twice, or answered twice', async () => {
    const { s, f } = await released();
    const r = await seen('appeals', s, 'student-1:a1');
    await area('appeals').execute(s, act('appeals', r.id, r.version, 'appeal', { reason: 'One.' }), 'a-1');
    const open = await seen('appeals', s, 'student-1:a1');
    await expect(
      area('appeals').execute(s, act('appeals', open.id, open.version, 'appeal', { reason: 'Two.' }), 'a-2'),
    ).rejects.toThrow(/already under appeal/i);
    const mine = await seen('appeals', f, 'student-1:a1');
    await area('appeals').execute(f, act('appeals', mine.id, mine.version, 'uphold', { reason: 'Stands.' }), 'a-3');
    const closed = await seen('appeals', f, 'student-1:a1');
    await expect(
      area('appeals').execute(f, act('appeals', closed.id, closed.version, 'uphold', { reason: 'Again.' }), 'a-4'),
    ).rejects.toThrow(/already been answered|not under appeal/i);
  });

  /*
   * Archiving was a status change and nothing else. Closing the appeal window
   * is what the stage is *for* — it is the moment a record stops being able to
   * change, which is the only thing that makes it an archive rather than a
   * label.
   */
  it('cannot be raised once the record is archived', async () => {
    const { s, f } = await released();
    const open = await seen('records', f, 'student-1:a1');
    await area('records').execute(f, act('records', open.id, open.version, 'archive'), 'a-arch');
    const shut = await seen('appeals', s, 'student-1:a1');
    expect(shut.actions).toEqual([]);
    await expect(
      area('appeals').execute(s, act('appeals', shut.id, shut.version, 'appeal', { reason: 'Too late.' }), 'a-late'),
    ).rejects.toThrow(/archived/i);
  });

  it('will not let a record be archived while an appeal is open', async () => {
    const { s, f } = await released();
    const r = await seen('appeals', s, 'student-1:a1');
    await area('appeals').execute(s, act('appeals', r.id, r.version, 'appeal', { reason: 'Wait.' }), 'a-open');
    const rec = await seen('records', f, 'student-1:a1');
    // Archiving closes the window, so archiving over an open appeal would
    // answer it by ignoring it.
    await expect(
      area('records').execute(f, act('records', rec.id, rec.version, 'archive'), 'a-shut'),
    ).rejects.toThrow(/under appeal/i);
  });

  it('refuses an appeal with no reason in it', async () => {
    const { s } = await released();
    const r = await seen('appeals', s, 'student-1:a1');
    await expect(
      area('appeals').execute(s, act('appeals', r.id, r.version, 'appeal', { reason: '   ' }), 'a-blank'),
    ).rejects.toThrow(/say what is wrong/i);
  });
});

describe('the deadline', () => {
  /** A1 is due 2026-10-02T23:59Z. `vi.setSystemTime` moves both clocks. */
  const DUE = Date.parse('2026-10-02T23:59:00Z');

  afterEach(() => {
    vi.useRealTimers();
  });

  const submitAt = async (when: number) => {
    vi.setSystemTime(when);
    const s = student();
    const r = await seen('assignments', s, 'student-1:a1');
    return area('assignments').execute(
      s,
      act('assignments', r.id, r.version, 'submit', { work: 'Done.' }),
      'k-when',
    );
  };

  it('says on the receipt that the work was on time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(DUE - 3 * 24 * 3_600_000);
    await enrol(student());
    const receipt = await submitAt(DUE - 2 * 24 * 3_600_000);
    expect(receipt.message).toMatch(/On time, with 2 days to spare/);
  });

  it('records a late submission rather than refusing it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(DUE - 3_600_000);
    await enrol(student());
    // Not refused: plenty of courses take late work with a penalty, and a
    // sandbox that hard-refused would model one policy as the only one.
    const receipt = await submitAt(DUE + 3 * 24 * 3_600_000);
    expect(receipt.status).toBe('completed');
    expect(receipt.message).toMatch(/Late by 3 days/);
    expect(store.byId('student-1:a1')?.stage).toBe('submitted');
  });

  it('tells the marker, so a course can apply its own policy', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(DUE - 3_600_000);
    await enrol(student());
    await submitAt(DUE + 26 * 3_600_000);
    const g = await seen('grades', faculty(), 'student-1:a1');
    expect(JSON.stringify(g.details)).toMatch(/Late by 26 hours/);
  });

  it('warns before the confirmation, not after it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(DUE - 3_600_000);
    const s = student();
    await enrol(s);
    vi.setSystemTime(DUE + 3_600_000);
    const r = await seen('assignments', s, 'student-1:a1');
    const said = await area('assignments').review(
      s,
      act('assignments', r.id, r.version, 'submit', { work: 'Late.' }),
    );
    expect(JSON.stringify(said.details)).toMatch(/recorded as late/);
  });

  it('counts overdue separately from merely outstanding', async () => {
    vi.useFakeTimers();
    // Before either deadline: three on the roster, nothing in, nothing late.
    vi.setSystemTime(DUE - 24 * 3_600_000);
    const before = await seen('courses', faculty(), 'sandbox-101');
    expect(JSON.stringify(before.details)).not.toContain('overdue');

    // After the first deadline and before the second: only the first is.
    vi.setSystemTime(DUE + 24 * 3_600_000);
    const after = await seen('courses', faculty(), 'sandbox-101');
    const rows = after.details.filter((d) => d.label === 'Problem set 1' || d.label === 'Short paper');
    expect(rows.find((d) => d.label === 'Problem set 1')?.value).toContain('3 overdue');
    expect(rows.find((d) => d.label === 'Short paper')?.value).not.toContain('overdue');
  });

  it('says a receipt the same way however many times it is asked for', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(DUE - 3_600_000);
    await enrol(student());
    const first = await submitAt(DUE + 3_600_000);
    const again = await area('assignments').execute(
      student(),
      act('assignments', 'student-1:a1', '3', 'submit', { work: 'Done.' }),
      'k-when',
    );
    // The first version of this decorated the returned receipt after storing
    // a plain one, so a retry disagreed with the original about whether the
    // work was late. A receipt is evidence; two versions of it is the one
    // thing it cannot be.
    expect(again).toEqual(first);
    expect(again.message).toMatch(/Late by 1 hour/);
  });
});

describe('the archived record', () => {
  /*
   * The last stage of the completion plan's chain, and the one thing it did
   * not carry was the mark. "Archived. This is the closed record of one piece
   * of work" sat above a course code, a student id and a trail of timestamps
   * — a record of the *transitions*, which is not a record of the work.
   *
   * An academic record that cannot answer "what was it, what did I get, and
   * why" is a filing stub. Every one of those facts already existed; they
   * were on three other screens.
   */
  const DUE = Date.parse('2026-10-02T23:59:00Z');

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Carry A1 all the way to archived, optionally late, and hand back the pair. */
  const archived = async (opts: { lateDays?: number; policy?: boolean } = {}) => {
    const s = student();
    const f = faculty();
    vi.useFakeTimers();
    vi.setSystemTime(DUE - 5 * 24 * 3_600_000);
    await enrol(s);
    if (opts.policy) {
      const c = await seen('courses', f, 'sandbox-101');
      await area('courses').execute(f, act('courses', c.id, c.version, 'policy', { perDay: '10', cap: '30' }), 'r-pol');
    }
    vi.setSystemTime(DUE + (opts.lateDays ?? -2) * 24 * 3_600_000);
    const r = await seen('assignments', s, 'student-1:a1');
    await area('assignments').execute(s, act('assignments', r.id, r.version, 'submit', { work: 'x' }), 'r-sub');
    const g = await seen('grades', f, 'student-1:a1');
    await area('grades').execute(
      f,
      act('grades', g.id, g.version, 'grade', { method: '7', accuracy: '6', clarity: '4', comments: 'Method is strong; check units.' }),
      'r-mark',
    );
    const g2 = await seen('grades', f, 'student-1:a1');
    await area('grades').execute(f, act('grades', g2.id, g2.version, 'release'), 'r-rel');
    const rec = await seen('records', f, 'student-1:a1');
    await area('records').execute(f, act('records', rec.id, rec.version, 'archive'), 'r-arch');
    return { s, f };
  };

  const line = async (label: string) =>
    (await seen('records', student(), 'student-1:a1')).details.find((d) => d.label === label)?.value;

  it('states the mark, what it was out of, what it was worth and when it came in', async () => {
    await archived();
    expect(await line('Mark'), 'the closed record of one piece of work, with no mark on it').toBe('17 out of 20');
    expect(await line('Worth')).toMatch(/20% of the course/);
    expect(await line('Handed in'), 'a record with no date on it').toMatch(/^2026-09-30 /);
    expect(await line('Deadline')).toMatch(/On time, with 2 days to spare/);
  });

  it('says which criterion lost the marks, without another screen', async () => {
    /*
     * The whole argument the rubric was added for. A record holding "17 out
     * of 20" and nothing else is the grade this repository already refused
     * once; there is no reason the archive should be the place it comes back.
     */
    await archived();
    const detail = (await seen('records', student(), 'student-1:a1')).details;
    const crit = detail.find((d) => d.label === 'Accuracy · 6 of 8');
    expect(crit, 'the rubric breakdown, on the record itself').toBeDefined();
    expect(crit?.value).toBe('The answers are right, with units.');
    expect(detail.find((d) => d.label === 'Feedback')?.value).toMatch(/check units/);
  });

  it('carries what was handed in and when, and whether it was late', async () => {
    await archived({ lateDays: 3, policy: true });
    expect(await line('Deadline')).toBe('Late by 3 days');
    expect(await line('Late penalty')).toMatch(/30% of 20 — 6 marks/);
    expect(await line('Recorded'), 'the number that is actually the record').toBe('11 out of 20');
  });

  it('does not show a mark before one has been released', async () => {
    /*
     * The same rule as everywhere else, checked here too, because this is a
     * different function drawing from the same row and nothing made it obey.
     */
    const s = student();
    const f = faculty();
    await enrol(s);
    const r = await seen('assignments', s, 'student-1:a1');
    await area('assignments').execute(s, act('assignments', r.id, r.version, 'submit', { work: 'x' }), 'r-s2');
    const g = await seen('grades', f, 'student-1:a1');
    await area('grades').execute(
      f,
      act('grades', g.id, g.version, 'grade', { method: '7', accuracy: '6', clarity: '4', comments: 'Quiet.' }),
      'r-m2',
    );
    const detail = (await seen('records', s, 'student-1:a1')).details;
    // By label, not by grepping the blob: the trail carries today's date, and
    // "2026-09-17" contains the very number this is trying to prove absent.
    expect(detail.find((d) => d.label === 'Mark'), 'an unreleased mark on the record').toBeUndefined();
    expect(detail.find((d) => d.label === 'Feedback')).toBeUndefined();
    expect(JSON.stringify(detail)).not.toMatch(/Quiet/);
  });

  it('says how an appeal came out, when there was one', async () => {
    const { s } = await archivedAfterAppeal();
    const detail = (await seen('records', s, 'student-1:a1')).details;
    /*
     * By label, because the trail already carries "Mark amended on appeal" as
     * a history entry — grepping the record as one string would pass against
     * a record that says nothing about the appeal at all. Three probes in this
     * file have now been caught doing exactly that.
     */
    expect(detail.find((d) => d.label === 'Appealed')?.value).toMatch(/Q3 was marked wrong/);
    const outcome = detail.find((d) => d.label === 'Mark amended on appeal');
    expect(outcome, 'the record does not say how the appeal came out').toBeDefined();
    expect(outcome?.value, 'and what the mark was before it').toMatch(/Was 11\. Agreed on Q3/);
    expect(detail.find((d) => d.label === 'Mark')?.value, 'the amended mark').toBe('17 out of 20');
  });

  /** Released, appealed, amended, then archived. */
  async function archivedAfterAppeal() {
    const s = student();
    const f = faculty();
    await enrol(s);
    const r = await seen('assignments', s, 'student-1:a1');
    await area('assignments').execute(s, act('assignments', r.id, r.version, 'submit', { work: 'x' }), 'q-sub');
    const g = await seen('grades', f, 'student-1:a1');
    await area('grades').execute(
      f,
      act('grades', g.id, g.version, 'grade', { method: '5', accuracy: '4', clarity: '2', comments: 'As marked.' }),
      'q-mark',
    );
    const g2 = await seen('grades', f, 'student-1:a1');
    await area('grades').execute(f, act('grades', g2.id, g2.version, 'release'), 'q-rel');
    const ap = await seen('appeals', s, 'student-1:a1');
    await area('appeals').execute(s, act('appeals', ap.id, ap.version, 'appeal', { reason: 'Q3 was marked wrong.' }), 'q-ap');
    const ap2 = await seen('appeals', f, 'student-1:a1');
    await area('appeals').execute(
      f,
      act('appeals', ap2.id, ap2.version, 'amend', { method: '7', accuracy: '6', clarity: '4', reason: 'Agreed on Q3.' }),
      'q-am',
    );
    const rec = await seen('records', f, 'student-1:a1');
    await area('records').execute(f, act('records', rec.id, rec.version, 'archive'), 'q-arch');
    return { s, f };
  }

  it('does not move when the course moves on', async () => {
    /*
     * The property that makes it a record rather than a view. Every number on
     * it is composed live — from the rubric, the weight and the policy —
     * which is right, because a stored copy can disagree with what produced
     * it. But composed-live only counts as a record if none of its inputs can
     * be changed underneath it, so: archive one, run the course on, and
     * compare byte for byte.
     */
    await archived();
    const before = JSON.stringify((await seen('records', student(), 'student-1:a1')).details);

    const f = faculty();
    const course = await seen('courses', f, 'sandbox-101');
    await area('courses').execute(
      f,
      act('courses', course.id, course.version, 'publish', {
        title: 'Essay two',
        due: new Date(Date.now() + 14 * 24 * 3_600_000).toISOString(),
        brief: 'Eight hundred words.',
        rubric: 'Argument | 10 | A claim.',
        weight: '45',
      }),
      'r-pub',
    );
    const after = JSON.stringify((await seen('records', student(), 'student-1:a1')).details);
    expect(after, 'an archived record changed because the course did').toBe(before);
  });

  it('is nobody else’s to read', async () => {
    await archived();
    const other = who('student-2', 'student');
    expect(await area('records').get(other, 'student-1:a1')).toBeNull();
  });
});

describe('the syllabus', () => {
  /*
   * The completion plan's chain reads Course → **Syllabus** → Calendar, and
   * the syllabus was one sentence on a constant, used as the course record's
   * summary. That is a description, not a syllabus: it does not say when the
   * course meets, when anybody can be asked a question, what counts as
   * working together and what counts as copying, or how the marks add up.
   *
   * Those are the questions a student actually has before a course starts,
   * and the last of them is the one people get wrong and lose a degree over.
   */
  const FULL = {
    about: 'How a course is run from publication to an archived record.',
    meets: 'Tuesdays and Thursdays, 14:00–15:15, Sandbox Hall 101.',
    officeHours: 'Wednesdays 10:00–12:00, or by appointment.',
    collaboration:
      'Talk about the problems with anybody. Write your answers alone. Name anyone you worked with.',
    contact: 'Ask in the course thread first — the answer is usually useful to everybody.',
  };

  const publishSyllabus = async (over: Record<string, string> = {}, key = 's-pub') => {
    const f = faculty();
    const course = await seen('courses', f, 'sandbox-101');
    return area('courses').execute(
      f,
      act('courses', course.id, course.version, 'syllabus', { ...FULL, ...over }),
      key,
    );
  };

  it('is a record of its own, and says so before anybody has written one', async () => {
    const said = await seen('courses', student(), 'syllabus');
    expect(said.title).toContain(SANDBOX_MARK);
    expect(said.status, 'an empty syllabus pretending to be a syllabus').toMatch(/not yet published/i);
    expect(JSON.stringify(said.details)).not.toMatch(/Tuesdays/);
  });

  it('answers the questions a student has before the course starts', async () => {
    await publishSyllabus();
    const said = JSON.stringify((await seen('courses', student(), 'syllabus')).details);
    expect(said, 'when it meets').toMatch(/Tuesdays and Thursdays, 14:00/);
    expect(said, 'when somebody can be asked').toMatch(/Wednesdays 10:00/);
    expect(said, 'what counts as working together').toMatch(/Write your answers alone/);
    expect(said, 'where to ask').toMatch(/course thread first/);
  });

  it('derives how the marks add up, rather than restating it', async () => {
    /*
     * The one section nobody types. A syllabus that says "Problem set 20%,
     * paper 35%" is a second copy of the weights, and the two drift the first
     * time faculty publish anything — at which point the contract with the
     * class says one thing and the course does another.
     */
    await publishSyllabus();
    const said = JSON.stringify((await seen('courses', student(), 'syllabus')).details);
    expect(said).toMatch(/Problem set 1[^}]*20%/);
    expect(said).toMatch(/Short paper[^}]*35%/);
    expect(said, 'and what has not been published yet').toMatch(/45%[^}]*not been published/i);

    // Publish something, and the syllabus says so without being edited.
    const f = faculty();
    const course = await seen('courses', f, 'sandbox-101');
    await area('courses').execute(
      f,
      act('courses', course.id, course.version, 'publish', {
        title: 'Essay two',
        due: new Date(Date.now() + 14 * 24 * 3_600_000).toISOString(),
        brief: 'Eight hundred words.',
        rubric: 'Argument | 10 | A claim.',
        weight: '45',
      }),
      's-more',
    );
    const after = JSON.stringify((await seen('courses', student(), 'syllabus')).details);
    expect(after).toMatch(/Essay two[^}]*45%/);
    expect(after, 'the whole course is published now').not.toMatch(/not been published/i);
  });

  it('carries the late policy rather than a second copy of it', async () => {
    await publishSyllabus();
    const f = faculty();
    const course = await seen('courses', f, 'sandbox-101');
    await area('courses').execute(
      f,
      act('courses', course.id, course.version, 'policy', { perDay: '10', cap: '30' }),
      's-pol',
    );
    expect(JSON.stringify((await seen('courses', student(), 'syllabus')).details)).toMatch(
      /10% of the mark per day/,
    );
  });

  it('says when it last changed, and what changed', async () => {
    /*
     * A syllabus is a contract with a class, and the complaint people have
     * about one is never that it changed — it is that it changed and nobody
     * said. So a revision carries a note, the class can read it, and the
     * record says which revision it is on.
     */
    await publishSyllabus();
    const first = await seen('courses', student(), 'syllabus');
    expect(first.status).toMatch(/Revision 1/);

    await publishSyllabus({ meets: 'Tuesdays only, 14:00–15:15, Sandbox Hall 101.' , note: 'Thursday section dropped.' }, 's-rev');
    const second = await seen('courses', student(), 'syllabus');
    expect(second.status).toMatch(/Revision 2/);
    expect(JSON.stringify(second.details), 'what changed').toMatch(/Thursday section dropped/);
    expect(JSON.stringify(second.details), 'and the one before it').toMatch(/Tuesdays only/);
  });

  it('refuses a revision that does not say what changed', async () => {
    await publishSyllabus();
    // The first one needs no note: there is nothing to have changed from.
    await expect(publishSyllabus({ meets: 'Mondays.' }, 's-silent')).rejects.toThrow(/what changed/i);
    expect(store.syllabus()?.meets, 'a silent revision landed').toBe(FULL.meets);
  });

  it('refuses a section left blank, and anybody who is not faculty', async () => {
    const s = student();
    await enrol(s);
    const course = await seen('courses', s, 'sandbox-101');
    expect(course.actions.map((a) => a.id)).not.toContain('syllabus');
    await expect(
      area('courses').execute(s, act('courses', course.id, course.version, 'syllabus', FULL), 's-no'),
    ).rejects.toThrow(/Only the course faculty/);

    await expect(publishSyllabus({ collaboration: '   ' }, 's-blank')).rejects.toThrow(/what counts as working together/i);
    await expect(publishSyllabus({ meets: '' }, 's-blank2')).rejects.toThrow(/when the course meets/i);
    expect(store.syllabus()).toBeNull();
  });

  it('is read back in full before it is published', async () => {
    const f = faculty();
    const course = await seen('courses', f, 'sandbox-101');
    const said = await area('courses').review(f, act('courses', course.id, course.version, 'syllabus', FULL));
    expect(said.title).toMatch(/syllabus/i);
    expect(JSON.stringify(said.details)).toMatch(/Write your answers alone/);
    expect(JSON.stringify(said.details), 'who it reaches').toMatch(/roster|class/i);
    expect(store.syllabus(), 'reviewing published it').toBeNull();
  });

  it('is pointed at from the course, so it is findable from where people start', async () => {
    await publishSyllabus();
    const { records } = await area('courses').list(student(), { search: '', cursor: null });
    expect(records.map((r) => r.id)).toContain('syllabus');
  });
});

describe('what late work costs', () => {
  /*
   * The deadline commit recorded lateness and said, deliberately, that it does
   * not refuse late work: *"a sandbox that hard-refused would be modelling one
   * policy as though it were the only one … it records the truth and leaves
   * the policy to the course."* That was right, and it left a thread hanging —
   * there was nowhere for a course to state a policy, so the sentence both
   * sides read was "The course decides what that costs" and neither of them
   * could find out what it decided.
   */
  const DUE = Date.parse('2026-10-02T23:59:00Z');
  const PS1 = { method: '7', accuracy: '6', clarity: '4', comments: 'Solid.' }; // 17 of 20

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Faculty state the policy, through the action rather than around it. */
  const setPolicy = async (fields: Record<string, string>, key = 'p-set') => {
    const f = faculty();
    const course = await seen('courses', f, 'sandbox-101');
    return area('courses').execute(f, act('courses', course.id, course.version, 'policy', fields), key);
  };

  /** Submit A1 this many days after its deadline, then mark and release it. */
  const lateBy = async (days: number, marks = PS1) => {
    const s = student();
    const f = faculty();
    vi.setSystemTime(DUE + days * 24 * 3_600_000);
    const r = await seen('assignments', s, 'student-1:a1');
    await area('assignments').execute(s, act('assignments', r.id, r.version, 'submit', { work: 'x' }), 'p-sub');
    const g = await seen('grades', f, 'student-1:a1');
    await area('grades').execute(f, act('grades', g.id, g.version, 'grade', marks), 'p-mark');
    const g2 = await seen('grades', f, 'student-1:a1');
    await area('grades').execute(f, act('grades', g2.id, g2.version, 'release'), 'p-rel');
    return { s, f };
  };

  it('says the course has not decided, until it has', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(DUE - 3 * 24 * 3_600_000);
    await enrol(student());
    const r = await seen('assignments', student(), 'student-1:a1');
    vi.setSystemTime(DUE + 24 * 3_600_000);
    const said = await area('assignments').review(
      student(),
      act('assignments', r.id, r.version, 'submit', { work: 'x' }),
    );
    expect(JSON.stringify(said.details)).toMatch(/has not said what late work costs/i);

    // And with no policy, a late mark is the rubric mark. Nothing is invented —
    // there is no deduction, and no second number pretending to be a rule.
    await lateBy(1);
    const detail = (await seen('grades', student(), 'student-1:a1')).details;
    expect(detail.find((d) => d.label === 'Mark')?.value).toBe('17 out of 20');
    expect(detail.find((d) => d.label === 'Late penalty'), 'a penalty under no policy').toBeUndefined();
    expect(detail.find((d) => d.label === 'Recorded'), 'a recorded mark that differs from the mark').toBeUndefined();
  });

  it('is on the course and on the piece, while there is still time to act on it', async () => {
    /*
     * The same argument the rubric is here for. A policy a student meets in
     * the warning attached to submitting three days late arrived too late to
     * change anything they did; on the course and on the piece, it is a thing
     * to plan around.
     */
    vi.useFakeTimers();
    vi.setSystemTime(DUE - 10 * 24 * 3_600_000);
    await enrol(student());
    await setPolicy({ perDay: '10', cap: '30' });
    expect(JSON.stringify((await seen('courses', student(), 'sandbox-101')).details)).toMatch(
      /Late work[^}]*10% of the mark per day/,
    );
    expect(JSON.stringify((await seen('assignments', student(), 'student-1:a1')).details)).toMatch(
      /Late work[^}]*up to 30%/,
    );
  });

  it('is read by the student before they confirm a late submission', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(DUE - 3 * 24 * 3_600_000);
    await enrol(student());
    await setPolicy({ perDay: '10', cap: '30' });
    const r = await seen('assignments', student(), 'student-1:a1');
    vi.setSystemTime(DUE + 3 * 24 * 3_600_000);
    const said = await area('assignments').review(
      student(),
      act('assignments', r.id, r.version, 'submit', { work: 'x' }),
    );
    // Not "the course decides what that costs" — what it decided.
    expect(JSON.stringify(said.details)).toMatch(/10% (of the mark )?per day/i);
    expect(JSON.stringify(said.details)).toMatch(/30%/);
  });

  it('shows the four numbers separately, and records the deducted one', async () => {
    /*
     * A single number cannot answer "what did I lose it on". The rubric mark
     * is a judgement about the work; the deduction is a consequence of when it
     * arrived. Folding them together makes the first unreadable.
     */
    vi.useFakeTimers();
    vi.setSystemTime(DUE - 3 * 24 * 3_600_000);
    await enrol(student());
    await setPolicy({ perDay: '10', cap: '30' });
    await lateBy(3);
    const detail = (await seen('grades', student(), 'student-1:a1')).details;
    const line = (label: string) => detail.find((d) => d.label === label)?.value;
    expect(line('Mark'), 'what the work earned').toBe('17 out of 20');
    expect(line('Deadline'), 'how late it was').toBe('Late by 3 days');
    expect(line('Late penalty'), 'what that cost, and under which rule').toMatch(/30% of 20 — 6 marks, for 3 days/);
    expect(line('Late penalty'), 'the rule quoted beside the number').toMatch(/10% of the mark per day/);
    expect(line('Recorded'), 'and what goes on the record').toBe('11 out of 20');
  });

  it('never takes the penalty out of a criterion', async () => {
    /*
     * The rule this rests on. A criterion mark is a judgement about the work —
     * "Accuracy 6 of 8" means the answers had errors — and lateness is not a
     * statement about accuracy. Scaling the criteria would make the rubric lie
     * about the work in order to carry a fact about the clock.
     */
    vi.useFakeTimers();
    vi.setSystemTime(DUE - 3 * 24 * 3_600_000);
    await enrol(student());
    await setPolicy({ perDay: '10', cap: '30' });
    await lateBy(3);
    expect(store.byId('student-1:a1')?.marks).toEqual({ method: 7, accuracy: 6, clarity: 4 });
    const said = JSON.stringify((await seen('grades', student(), 'student-1:a1')).details);
    expect(said).toMatch(/Accuracy · 6 of 8/);
  });

  it('counts part of a day as a day, which is what it says it does', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(DUE - 3 * 24 * 3_600_000);
    await enrol(student());
    await setPolicy({ perDay: '10', cap: '30' });
    // Four hours late. Rounding the other way would make this free, which is
    // not what "per day, or part of a day" says.
    vi.setSystemTime(DUE + 4 * 3_600_000);
    const s = student();
    const f = faculty();
    const r = await seen('assignments', s, 'student-1:a1');
    await area('assignments').execute(s, act('assignments', r.id, r.version, 'submit', { work: 'x' }), 'h-sub');
    const g = await seen('grades', f, 'student-1:a1');
    await area('grades').execute(f, act('grades', g.id, g.version, 'grade', PS1), 'h-mark');
    const g2 = await seen('grades', f, 'student-1:a1');
    await area('grades').execute(f, act('grades', g2.id, g2.version, 'release'), 'h-rel');
    const detail = (await seen('grades', s, 'student-1:a1')).details;
    expect(detail.find((d) => d.label === 'Late penalty')?.value).toMatch(/10%[^}]*for 1 day/);
    expect(detail.find((d) => d.label === 'Recorded')?.value).toBe('15 out of 20');
  });

  it('caps the deduction where the course said it caps', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(DUE - 3 * 24 * 3_600_000);
    await enrol(student());
    await setPolicy({ perDay: '10', cap: '30' });
    await lateBy(9); // 90% by the daily rate, 30% by the cap.
    const said = JSON.stringify((await seen('grades', student(), 'student-1:a1')).details);
    expect(said).toMatch(/11 out of 20/);
  });

  it('leaves on-time work exactly as it was marked', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(DUE - 5 * 24 * 3_600_000);
    await enrol(student());
    await setPolicy({ perDay: '10', cap: '30' });
    await lateBy(-2);
    const said = JSON.stringify((await seen('grades', student(), 'student-1:a1')).details);
    expect(said).toMatch(/17 out of 20/);
    expect(said, 'a deduction on work that was early').not.toMatch(/penalt/i);
  });

  it('does not take a recorded mark below zero', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(DUE - 3 * 24 * 3_600_000);
    await enrol(student());
    await setPolicy({ perDay: '60', cap: '100' });
    await lateBy(2, { method: '1', accuracy: '1', clarity: '1', comments: 'Thin.' }); // 3 of 20, less 20
    const detail = (await seen('grades', student(), 'student-1:a1')).details;
    const record = detail.find((d) => d.label === 'Recorded')?.value ?? '';
    // Not "-9 out of 20". A transcript cannot carry a negative mark, and the
    // date fields elsewhere in these details are why this reads the one line
    // rather than grepping the lot for a minus sign.
    expect(record).toBe('0 out of 20');
  });

  it('counts the recorded mark towards the standing, not the one before the penalty', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(DUE - 3 * 24 * 3_600_000);
    await enrol(student());
    await setPolicy({ perDay: '10', cap: '30' });
    await lateBy(3);
    const said = JSON.stringify((await seen('courses', student(), 'sandbox-101')).details);
    expect(said).toMatch(/11 of 20 marks/);
  });

  it('is the number an appeal is about, on the appeal', async () => {
    /*
     * Two screens a student reads together, and until this they gave two
     * answers to "what is my mark" — the grades record said 11 and the appeal
     * said 17. An appeal is the one occasion where that question has to have
     * one answer.
     */
    vi.useFakeTimers();
    vi.setSystemTime(DUE - 3 * 24 * 3_600_000);
    await enrol(student());
    await setPolicy({ perDay: '10', cap: '30' });
    await lateBy(3);
    const mark = (await seen('appeals', student(), 'student-1:a1')).details.find((d) => d.label === 'Mark');
    expect(mark?.value).toMatch(/^11 out of 20/);
    expect(mark?.value, 'and where the difference came from').toMatch(/17 marked, less the late penalty/);
  });

  it('cannot be changed once a mark has been released under it', async () => {
    /*
     * A recorded mark is evidence, and the policy is half of what produced it.
     * Changing the rate afterwards would silently restate every mark already
     * released — nobody would be told, and the number on the record would stop
     * matching the number the student was shown.
     */
    vi.useFakeTimers();
    vi.setSystemTime(DUE - 3 * 24 * 3_600_000);
    await enrol(student());
    await setPolicy({ perDay: '10', cap: '30' });
    await lateBy(3);
    await expect(setPolicy({ perDay: '50', cap: '50' }, 'p-again')).rejects.toThrow(/already been released/i);
    expect(store.policy()?.perDay).toBe(10);
  });

  it('is faculty’s to set, and refuses a rate it cannot read', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(DUE - 3 * 24 * 3_600_000);
    const s = student();
    await enrol(s);
    const course = await seen('courses', s, 'sandbox-101');
    // Not offered to them, and refused at the write, which is where it counts.
    expect(course.actions.map((a) => a.id)).not.toContain('policy');
    await expect(
      area('courses').execute(s, act('courses', course.id, course.version, 'policy', { perDay: '5', cap: '20' }), 'p-no'),
    ).rejects.toThrow(/Only the course faculty/);

    await expect(setPolicy({ perDay: 'some', cap: '30' }, 'p-a')).rejects.toThrow(/"some"/);
    await expect(setPolicy({ perDay: '-1', cap: '30' }, 'p-b')).rejects.toThrow(/between 0 and 100/);
    await expect(setPolicy({ perDay: '101', cap: '30' }, 'p-c')).rejects.toThrow(/between 0 and 100/);
    await expect(setPolicy({ perDay: '10', cap: '200' }, 'p-d')).rejects.toThrow(/between 0 and 100/);
    await expect(setPolicy({ perDay: '10', cap: '' }, 'p-e')).rejects.toThrow(/most/i);
    expect(store.policy()).toBeNull();
  });

  it('can say that late work is not penalised, which is also a policy', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(DUE - 3 * 24 * 3_600_000);
    await enrol(student());
    await setPolicy({ perDay: '0', cap: '0' });
    const r = await seen('assignments', student(), 'student-1:a1');
    vi.setSystemTime(DUE + 3 * 24 * 3_600_000);
    const said = await area('assignments').review(
      student(),
      act('assignments', r.id, r.version, 'submit', { work: 'x' }),
    );
    // A stated nothing is different from an unstated anything.
    expect(JSON.stringify(said.details)).toMatch(/does not penalise late work/i);
    expect(JSON.stringify(said.details)).not.toMatch(/has not said what late work costs/i);
  });
});

describe('where you stand', () => {
  /*
   * The completion plan's chain ends at Record, and for eight commits the
   * Record was per piece of work: a trail, a mark, an archive. Nothing
   * anywhere answered the question a student actually asks — *how am I doing
   * in this course* — and the course record answered a different question
   * instead, the marker's one, to everybody who could read it.
   */

  /** Submit, mark and optionally release one piece, and hand back the pair. */
  const carry = async (
    assignment: string,
    marks: Record<string, string>,
    to: 'submitted' | 'graded' | 'released',
  ) => {
    const s = student();
    const f = faculty();
    if (!store.enrolled('student-1')) await enrol(s);
    const id = `student-1:${assignment}`;
    const r = await seen('assignments', s, id);
    await area('assignments').execute(s, act('assignments', r.id, r.version, 'submit', { work: 'x' }), `w-sub-${assignment}`);
    if (to === 'submitted') return { s, f };
    const g = await seen('grades', f, id);
    await area('grades').execute(f, act('grades', g.id, g.version, 'grade', { ...marks, comments: 'As marked.' }), `w-mark-${assignment}`);
    if (to === 'graded') return { s, f };
    const g2 = await seen('grades', f, id);
    await area('grades').execute(f, act('grades', g2.id, g2.version, 'release'), `w-rel-${assignment}`);
    return { s, f };
  };

  const PS1 = { method: '7', accuracy: '6', clarity: '4' }; // 17 of 20

  it('does not read the class’s marking queue to a student', async () => {
    /*
     * The first version put the marker's view on the course record for
     * everybody. With a class of four, "3 of 4 in hand · 1 outstanding" tells
     * an enrolled student precisely how many of their classmates have not
     * submitted, and how many are sitting unmarked. That is the course's
     * business and the marker's; it is not theirs, and on a class this size it
     * is one step from a name.
     */
    const s = student();
    await enrol(s);
    const mine = JSON.stringify((await seen('courses', s, 'sandbox-101')).details);
    expect(mine, 'a student is reading the class’s queue').not.toMatch(/in hand|to mark|outstanding|overdue/i);
    expect(mine, 'and the size of it').not.toMatch(/of 4\b/);

    // Faculty still get it. The view is wrong for one reader, not wrong.
    const theirs = JSON.stringify((await seen('courses', faculty(), 'sandbox-101')).details);
    expect(theirs).toMatch(/in hand/i);
    expect(theirs).toMatch(/to mark/i);
  });

  it('tells a student where their own work is, piece by piece', async () => {
    await carry('a1', PS1, 'submitted');
    const said = JSON.stringify((await seen('courses', student(), 'sandbox-101')).details);
    expect(said, 'the piece they have handed in').toMatch(/Problem set 1[^}]*[Ss]ubmitted/);
    expect(said, 'and the piece they have not').toMatch(/Short paper[^}]*not yet submitted/);
  });

  it('says what each piece is worth, not only what it is marked out of', async () => {
    /*
     * Twenty marks and forty marks is not a weighting. Two rubrics of
     * different lengths produce those numbers by accident, and a student
     * reading them has no way to tell whether the second piece is worth twice
     * the first or whether somebody wrote twice as many criteria.
     */
    const said = JSON.stringify((await seen('courses', student(), 'sandbox-101')).details);
    expect(said, 'Problem set 1’s share of the course').toMatch(/Problem set 1[^}]*20% of the course/);
    expect(said, 'Short paper’s share of the course').toMatch(/Short paper[^}]*35% of the course/);
  });

  it('is a syllabus, and not a standing, to somebody not in the class', async () => {
    /*
     * Before enrolling, what is published and what it is worth is exactly the
     * thing worth reading — it is how you decide. A place in the course is
     * not: "nothing has been marked yet" says you are in a class you have not
     * joined.
     */
    const said = JSON.stringify((await seen('courses', student(), 'sandbox-101')).details);
    expect(said, 'the work is the syllabus').toMatch(/Problem set 1[^}]*20% of the course/);
    expect(said, 'a standing for somebody with no place in the course').not.toMatch(/has been marked/i);
    expect(said).not.toMatch(/Not submitted|not yet submitted/i);
  });

  it('counts a released mark towards a standing', async () => {
    await carry('a1', PS1, 'released');
    const said = JSON.stringify((await seen('courses', student(), 'sandbox-101')).details);
    expect(said, 'against the piece that earned them').toMatch(/Problem set 1[^}]*17 of 20/);
    expect(said, 'the marks earned, over the marks that carried them').toMatch(/17 of 20 marks/);
    expect(said, 'stated as a share of the whole course').toMatch(/20% of this course has been marked/);
  });

  it('does not count a mark the student has not been shown', async () => {
    /*
     * A marked-but-unreleased piece is a mark the student cannot read. Putting
     * it in their standing would release it through the back door: they would
     * not see the number, but they could subtract their way to it.
     */
    await carry('a1', PS1, 'graded');
    const said = JSON.stringify((await seen('courses', student(), 'sandbox-101')).details);
    expect(said, 'an unreleased mark reached the standing').not.toMatch(/17/);
    expect(said, 'nothing of this course has been marked, as far as the student can see').toMatch(
      /nothing[^}]*marked|0% of this course has been marked/i,
    );

    // And it appears the moment it is released, so this is about release
    // rather than about the standing never working.
    const g = await seen('grades', faculty(), 'student-1:a1');
    await area('grades').execute(faculty(), act('grades', g.id, g.version, 'release'), 'w-late-rel');
    expect(JSON.stringify((await seen('courses', student(), 'sandbox-101')).details)).toMatch(/17 of 20/);
  });

  it('never states a standing as a grade for the course', async () => {
    /*
     * 17 of 20 on a fifth of the course is not 85%, and an institutional
     * record that says it is has made a forecast wearing the clothes of a
     * fact. The app projects elsewhere, with a band and a name for it; a
     * record states what happened.
     */
    await carry('a1', PS1, 'released');
    const course = await seen('courses', student(), 'sandbox-101');
    const said = JSON.stringify(course.details);
    expect(said, 'the unmarked remainder has to be said out loud').toMatch(/80%[^}]*not been marked/i);
    expect(said, 'a projected course grade').not.toMatch(/85%|on track|projected|estimated/i);
  });

  it('refuses work published without a share of the course', async () => {
    const soon = new Date(Date.now() + 14 * 24 * 3_600_000).toISOString();
    const f = faculty();
    const course = await seen('courses', f, 'sandbox-101');
    const fields = (weight: string) => ({
      title: 'Essay two',
      due: soon,
      brief: 'Eight hundred words.',
      rubric: 'Argument | 10 | A claim.\nEvidence | 5 | Sources.',
      weight,
    });
    const send = (weight: string, key: string) =>
      area('courses').execute(f, act('courses', course.id, course.version, 'publish', fields(weight)), key);

    // Refused at the write as well as at the review: a client does not have
    // to prepare anything first.
    await expect(send('', 'w-p1')).rejects.toThrow(/worth/i);
    await expect(send('none', 'w-p2')).rejects.toThrow(/"none"/);
    await expect(send('0', 'w-p3')).rejects.toThrow(/above zero/);
    await expect(send('-5', 'w-p4')).rejects.toThrow(/above zero/);
    expect(store.assignment('essay-two'), 'one of those published it').toBeUndefined();
  });

  it('refuses work that would take the course past all of itself', async () => {
    // 20 and 35 are already published, so 45 is left and 50 is not there.
    const soon = new Date(Date.now() + 14 * 24 * 3_600_000).toISOString();
    const f = faculty();
    const course = await seen('courses', f, 'sandbox-101');
    const fields = (weight: string) => ({
      title: 'Essay two',
      due: soon,
      brief: 'Eight hundred words.',
      rubric: 'Argument | 10 | A claim.\nEvidence | 5 | Sources.',
      weight,
    });
    await expect(
      area('courses').execute(f, act('courses', course.id, course.version, 'publish', fields('50')), 'w-over'),
    ).rejects.toThrow(/45% of this course is unpublished/);
    expect(store.assignment('essay-two')).toBeUndefined();

    // And the whole of what is left is fine.
    await area('courses').execute(f, act('courses', course.id, course.version, 'publish', fields('45')), 'w-fits');
    expect(store.assignment('essay-two')?.weight).toBe(45);
  });

  it('reads the share back before publishing it', async () => {
    const soon = new Date(Date.now() + 14 * 24 * 3_600_000).toISOString();
    const f = faculty();
    const course = await seen('courses', f, 'sandbox-101');
    const said = await area('courses').review(
      f,
      act('courses', course.id, course.version, 'publish', {
        title: 'Essay two',
        due: soon,
        brief: 'Eight hundred words.',
        rubric: 'Argument | 10 | A claim.\nEvidence | 5 | Sources.',
        weight: '10',
      }),
    );
    // 20 and 35 are out already, so 10 more leaves 35 unpublished — the number
    // that stops the next piece being published at fifty.
    expect(JSON.stringify(said.details)).toMatch(/10% of the course/);
    expect(JSON.stringify(said.details)).toMatch(/[Ss]till unpublished[^}]*35% of the course/);
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

  it('refuses with a Refusal, everywhere, so the sentence reaches the person', () => {
    /*
     * Structural, and deliberately so. Forty refusals live in `sandbox.ts`,
     * and a runtime test can only pin the ones it drives through the gateway
     * — two of them, below. The rest read identically whether they throw
     * `Error` or `Refusal`, because a test calling the adapter directly sees
     * the message either way. That is exactly how all forty came to be
     * invisible over the wire while sixty tests passed.
     *
     * So this reads the file. It cannot be fooled by which paths a test
     * happens to exercise, and the next refusal somebody writes is covered
     * the moment it is written rather than the moment somebody thinks to
     * drive it through a gateway.
     */
    const source = readFileSync('server/institution/sandbox.ts', 'utf8');
    const plain = source
      .split('\n')
      .map((line, i) => ({ line: line.trim(), at: i + 1 }))
      .filter((l) => l.line.includes('throw new Error('))
      .map((l) => `${l.at}: ${l.line}`);
    expect(plain, 'a refusal the gateway will flatten into a 503').toEqual([]);
    // And the count, so deleting them all is not how this goes green.
    expect(source.split('throw new Refusal(').length - 1).toBeGreaterThanOrEqual(40);
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
        act('grades', mine.id, mine.version, 'grade', { method: '7', accuracy: '8', clarity: '3', comments: 'Strong on Q3.' }),
      );

      const toRelease = await (await asFaculty.call('/records?area=grades')).json();
      const graded = toRelease.records.find((r: { id: string }) => r.id === 'student-1:a1');
      await through(asFaculty.call, act('grades', graded.id, graded.version, 'release'));

      const studentSees = await (await asStudent.call('/records?area=grades')).json();
      const released = studentSees.records.find((r: { id: string }) => r.id === 'student-1:a1');
      expect(released.summary).toContain('18 out of 20');
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

  it('hands the person the sentence the adapter refused them with', async () => {
    /*
     * Sixty refusals in this file, every one of them a sentence written to be
     * read, and none of them had ever been read through the wire. A plain
     * Error is not an HttpError, so the gateway's outer handler flattened all
     * of them into "The university service is unavailable. Please try again
     * later." — a 503, which invites a retry of something that can never work.
     *
     * The two-phase action's whole argument for accepting a pasted rubric is
     * that "a line that does not parse is refused at prepare, with the line
     * quoted, so the person fixing it can see which one". The quote could not
     * reach them.
     */
    const asFaculty = wire(['faculty']);
    try {
      const refused = await asFaculty.call(
        '/actions/prepare',
        act('courses', 'sandbox-101', '1', 'publish', {
          title: 'Essay two',
          due: new Date(Date.now() + 14 * 24 * 3_600_000).toISOString().slice(0, 16),
          brief: 'Eight hundred words.',
          rubric: 'Argument | 10 | Fine\nEvidence, 5, oops',
          weight: '10',
        }),
      );
      expect(refused.status, 'a mistyped line is not an outage').toBe(400);
      expect((await refused.json()).error).toContain('"Evidence, 5, oops"');
      expect(store.assignment('essay-two')).toBeUndefined();
    } finally {
      asFaculty.journal.close();
    }
  });

  it('lets faculty publish through the gateway, which it did not', async () => {
    /*
     * Found by writing the refusal test above. `canWrite` on `courses` was
     * `isStudent`, from back when enrolling was the only thing done to a
     * course, and the gateway checks it before it asks the adapter anything —
     * so publishing, the stage the completion plan's chain *starts* at,
     * answered 403 from a browser while every adapter test passed.
     */
    const asFaculty = wire(['faculty']);
    const asStudent = wire(['student']);
    try {
      const published = await through(
        asFaculty.call,
        act('courses', 'sandbox-101', '1', 'publish', {
          title: 'Essay two',
          due: new Date(Date.now() + 14 * 24 * 3_600_000).toISOString().slice(0, 16),
          brief: 'Eight hundred words.',
          rubric: 'Argument | 10 | A claim.\nEvidence | 5 | Sources.',
          weight: '10',
        }),
      );
      expect(published.receipt.message).toMatch(/Published Essay two/);

      // And it reaches the class, over the wire, with its share of the course.
      await through(asStudent.call, act('courses', 'sandbox-101', '1', 'enrol'));
      const mine = (await (await asStudent.call('/records?area=assignments')).json()).records.find(
        (r: { id: string }) => r.id === 'student-1:essay-two',
      );
      expect(JSON.stringify(mine.details)).toMatch(/10% of the course/);
    } finally {
      asFaculty.journal.close();
      asStudent.journal.close();
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
      /*
       * Specifically, not merely "not a success". `>= 400` was what this said
       * for nine commits, and a 503 satisfies it — which is exactly what every
       * refusal in this file was arriving as. A test that cannot tell a
       * refusal from an outage is the reason nobody noticed.
       */
      expect(late.status, await late.clone().text()).toBe(409);
      expect((await late.clone().json()).error).toMatch(/changed/i);
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
