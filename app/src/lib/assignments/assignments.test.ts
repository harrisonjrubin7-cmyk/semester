/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LIMITS, STATUSES } from './model';
import type { Assignment, Draft, Extension, Receipt, Version } from './model';
import {
  accepting,
  bodyProblem,
  byUrgency,
  canSubmit,
  draftProblem,
  extensionProblem,
  fingerprint,
  latest,
  publishProblem,
  receiptMatches,
  receiptText,
  sha256Hex,
  standing,
  standingText,
  windowFor,
} from './views';

/**
 * Assignments' rules, worked out from rows, and held to the migration.
 *
 * `20261001094000_assignments.sql` is the authority. Two kinds of test here:
 * the pure functions on hand-built cases, and a parity block that reads the
 * migration's text and holds every limit, state and argument name in
 * `model.ts` and `client.ts` equal to it, so a screen cannot promise what the
 * database would refuse. `supabase/assignments.check.sql` runs the same cases
 * against a real Postgres; this file keeps the TypeScript half honest.
 */

const SQL = readFileSync(join(__dirname, '..', '..', '..', '..', 'supabase', 'migrations', '20261001094000_assignments.sql'), 'utf8');

// ── Hand-built rows ────────────────────────────────────────────────────

const T = (h: number): string => new Date(Date.UTC(2026, 9, 1, h)).toISOString();
const at = (h: number): Date => new Date(T(h));

const assignment = (patch: Partial<Assignment> = {}): Assignment => ({
  id: 'a1', course: 'ECON 1020', term: '2026FA', title: 'Problem set 1', instructions: 'Do the first five.',
  dueAt: T(12), closesAt: T(36), allowResubmission: true, maxVersions: 3, status: 'published',
  createdAt: T(0), publishedAt: T(1), closedAt: null, ...patch,
});
const extension = (patch: Partial<Extension> = {}): Extension => ({
  id: 'e1', assignmentId: 'a1', studentId: 'ana', dueAt: T(24), closesAt: null, reason: 'Hospital', at: T(2), ...patch,
});
const version = (patch: Partial<Version> = {}): Version => ({
  id: 'v1', submissionId: 's1', assignmentId: 'a1', studentId: 'ana', version: 1, body: 'Answer one.',
  contentSha256: '0'.repeat(64), dueAtThen: T(12), late: false, submittedAt: T(10), ...patch,
});

// ── Parity with the migration ──────────────────────────────────────────

describe('the migration and the client say the same thing', () => {
  // The control: the probe must be able to read this file at all.
  it('can read the migration and find what it is looking for', () => {
    expect(SQL.length).toBeGreaterThan(10000);
    expect(SQL).toContain('create table if not exists public.assignments');
    expect(SQL).not.toContain('create table if not exists public.no_such_table_zz');
  });

  it('holds every limit equal', () => {
    expect(SQL).toContain(`length(btrim(title)) between 1 and ${LIMITS.title}`);
    expect(SQL).toContain(`length(instructions) <= ${LIMITS.instructions}`);
    expect(SQL).toContain(`length(btrim(reason)) between 1 and ${LIMITS.reason}`);
    expect(SQL).toContain(`length(btrim(body)) between 1 and ${LIMITS.body}`);
    expect(SQL).toContain(`max_versions between 1 and ${LIMITS.versionsMax}`);
    expect(SQL).toContain(`default ${LIMITS.versionsDefault} check (max_versions`);
  });

  it('holds the states and the event kinds equal', () => {
    expect(SQL).toContain(`status in (${STATUSES.map((s) => `'${s}'`).join(', ')})`);
    expect(SQL).toContain("action in ('created', 'revised', 'published', 'closed', 'extended')");
    expect(SQL).toContain("kind in ('create', 'revise', 'publish', 'close', 'extend', 'submit')");
  });

  it('names the two capabilities the client reads grants for', () => {
    expect(SQL).toContain("'assignments:author'");
    expect(SQL).toContain("'assignments:review'");
  });

  // Every RPC's argument names, read out of the function signature.
  const signature = (name: string): string[] => {
    const m = new RegExp(`create or replace function public\\.${name}\\(([^)]*)\\)`, 's').exec(SQL);
    if (!m) throw new Error(`no function ${name}`);
    return [...m[1].matchAll(/want_[a-z_]+/g)].map((x) => x[0]);
  };
  it('reads a function signature at all, and a wrong one is not found', () => {
    expect(signature('assignments_publish')).toEqual(['want_assignment', 'want_key']);
    expect(() => signature('no_such_function_zz')).toThrow();
  });
  it('gives each writer exactly the arguments its function takes', () => {
    expect(signature('assignments_create')).toEqual(['want_course', 'want_term', 'want_title', 'want_instructions', 'want_due', 'want_closes', 'want_resubmit', 'want_max_versions', 'want_key']);
    expect(signature('assignments_revise')).toEqual(['want_assignment', 'want_title', 'want_instructions', 'want_due', 'want_closes', 'want_resubmit', 'want_max_versions', 'want_key']);
    expect(signature('assignments_close')).toEqual(['want_assignment', 'want_key']);
    expect(signature('assignments_extend')).toEqual(['want_assignment', 'want_student', 'want_due', 'want_closes', 'want_reason', 'want_key']);
    expect(signature('submissions_submit')).toEqual(['want_assignment', 'want_body', 'want_key']);
  });
});

// ── The due time that applies to one student ───────────────────────────

describe('windowFor', () => {
  it('is the assignment’s own when nobody has an extension', () => {
    expect(windowFor(assignment(), [], 'ana')).toEqual({ dueAt: T(12), closesAt: T(36), extended: false });
  });

  it('is the extension’s for that student only', () => {
    const ext = [extension()];
    expect(windowFor(assignment(), ext, 'ana').dueAt).toBe(T(24));
    expect(windowFor(assignment(), ext, 'ana').extended).toBe(true);
    expect(windowFor(assignment(), ext, 'ben')).toEqual({ dueAt: T(12), closesAt: T(36), extended: false });
  });

  it('ignores an extension on another assignment', () => {
    expect(windowFor(assignment(), [extension({ assignmentId: 'other' })], 'ana').extended).toBe(false);
  });

  // The four cases of `private.assignments_window`'s closing time.
  it('keeps the assignment’s closing time when it is still after the extended due time', () => {
    expect(windowFor(assignment({ closesAt: T(36) }), [extension({ dueAt: T(24) })], 'ana').closesAt).toBe(T(36));
  });
  it('moves a closing time that would fall before the extended due time up to it', () => {
    expect(windowFor(assignment({ closesAt: T(20) }), [extension({ dueAt: T(30) })], 'ana').closesAt).toBe(T(30));
  });
  it('takes the extension’s own closing time when it has one', () => {
    expect(windowFor(assignment({ closesAt: T(36) }), [extension({ dueAt: T(24), closesAt: T(48) })], 'ana').closesAt).toBe(T(48));
  });
  it('stays open-ended when neither has a closing time', () => {
    expect(windowFor(assignment({ closesAt: null }), [extension()], 'ana').closesAt).toBeNull();
  });

  it('uses the newest extension, and the id breaks a tie the way the database does', () => {
    const older = extension({ id: 'e1', dueAt: T(20), at: T(2) });
    const newer = extension({ id: 'e2', dueAt: T(40), at: T(3) });
    expect(windowFor(assignment({ closesAt: null }), [newer, older], 'ana').dueAt).toBe(T(40));
    const tieA = extension({ id: 'a', dueAt: T(20), at: T(3) });
    const tieB = extension({ id: 'b', dueAt: T(30), at: T(3) });
    expect(windowFor(assignment({ closesAt: null }), [tieA, tieB], 'ana').dueAt).toBe(T(30));
  });
});

// ── Where a student stands ─────────────────────────────────────────────

describe('standing', () => {
  const w = (a: Assignment, ex: Extension[] = []) => windowFor(a, ex, 'ana');

  it('is not open for a draft, whatever the time', () => {
    const a = assignment({ status: 'draft' });
    expect(standing(a, w(a), [], at(5))).toBe('not-open');
  });
  it('is open before the due time, and open-late after it while work is still taken', () => {
    const a = assignment();
    expect(standing(a, w(a), [], at(5))).toBe('open');
    expect(standing(a, w(a), [], at(20))).toBe('open-late');
  });
  it('is missed once the closing time passes with nothing submitted', () => {
    const a = assignment();
    expect(standing(a, w(a), [], at(40))).toBe('missed');
    expect(standing(assignment({ status: 'closed' }), w(a), [], at(5))).toBe('missed');
  });
  it('reports what was submitted, on time or late, and after closing', () => {
    const a = assignment();
    expect(standing(a, w(a), [version()], at(11))).toBe('submitted');
    expect(standing(a, w(a), [version({ late: true })], at(20))).toBe('submitted-late');
    expect(standing(a, w(a), [version()], at(40))).toBe('closed-submitted');
  });
  it('reads an extension as time to spare, for that student only', () => {
    const a = assignment();
    const ext = [extension({ dueAt: T(30) })];
    expect(standing(a, w(a, ext), [], at(20))).toBe('open');
    expect(standing(a, windowFor(a, ext, 'ben'), [], at(20))).toBe('open-late');
  });
  it('says each in a sentence and never a bare word', () => {
    const a = assignment();
    for (const s of ['not-open', 'open', 'open-late', 'submitted', 'submitted-late', 'missed', 'closed-submitted'] as const) {
      expect(standingText(s, w(a), [version()]).length, s).toBeGreaterThan(10);
    }
    expect(standingText('open', w(a, [extension()]), [])).toContain('extended');
    expect(standingText('submitted', w(a), [version(), version({ version: 2 })])).toContain('2 versions');
  });
  it('accepts work only while published and not past the closing time', () => {
    const a = assignment();
    expect(accepting(a, w(a), at(30))).toBe(true);
    expect(accepting(a, w(a), at(40))).toBe(false);
    expect(accepting(assignment({ status: 'draft' }), w(a), at(5))).toBe(false);
    const open = assignment({ closesAt: null });
    expect(accepting(open, w(open), at(400))).toBe(true);
  });
});

// ── Whether a student may submit ───────────────────────────────────────

describe('canSubmit, in the database’s own order', () => {
  const w = (a: Assignment) => windowFor(a, [], 'ana');
  const reason = (r: ReturnType<typeof canSubmit>): string => (r.ok ? '' : r.reason);

  it('allows a first submission before the due time, and a late one before the closing time', () => {
    const a = assignment();
    expect(canSubmit(a, w(a), [], at(5))).toEqual({ ok: true });
    expect(canSubmit(a, w(a), [], at(20))).toEqual({ ok: true });
  });
  it('refuses a draft, a closed assignment and work after the closing time, each for its own reason', () => {
    const a = assignment();
    expect(reason(canSubmit(assignment({ status: 'draft' }), w(a), [], at(5)))).toContain('not open');
    expect(reason(canSubmit(assignment({ status: 'closed' }), w(a), [], at(5)))).toContain('closed');
    expect(reason(canSubmit(a, w(a), [], at(40)))).toContain('closing time');
  });
  it('refuses a second version where resubmission is off, and one past the cap', () => {
    const once = assignment({ allowResubmission: false, maxVersions: 1 });
    expect(reason(canSubmit(once, w(once), [version()], at(5)))).toContain('one submission');
    const a = assignment({ maxVersions: 2 });
    expect(canSubmit(a, w(a), [version()], at(5))).toEqual({ ok: true });
    expect(reason(canSubmit(a, w(a), [version(), version({ version: 2 })], at(5)))).toContain('at most 2');
  });
  it('lets an extension keep a student open after the class’s own closing time', () => {
    const a = assignment({ closesAt: T(36) });
    const ext = [extension({ dueAt: T(40), closesAt: T(60) })];
    expect(canSubmit(a, windowFor(a, ext, 'ana'), [], at(50))).toEqual({ ok: true });
    expect(reason(canSubmit(a, windowFor(a, ext, 'ben'), [], at(50)))).toContain('closing time');
  });
});

describe('bodyProblem', () => {
  it('refuses nothing written, too much, and a copy of the latest', () => {
    expect(bodyProblem('   ', [])).toContain('Write something');
    expect(bodyProblem('x'.repeat(LIMITS.body + 1), [])).toContain('at most');
    expect(bodyProblem('Answer one.', [version()])).toContain('already submitted');
    expect(bodyProblem('x'.repeat(LIMITS.body), [])).toBeNull();
    expect(bodyProblem('Answer two.', [version()])).toBeNull();
  });
  it('compares against the newest version, not the first', () => {
    const vs = [version({ version: 1, body: 'one' }), version({ id: 'v2', version: 2, body: 'two' })];
    expect(bodyProblem('one', vs)).toBeNull();
    expect(bodyProblem('two', vs)).toContain('already submitted');
    expect(latest(vs)?.version).toBe(2);
    expect(latest([])).toBeNull();
  });
});

// ── What an instructor may set ─────────────────────────────────────────

describe('draftProblem and publishProblem', () => {
  const draft = (patch: Partial<Draft> = {}): Draft => ({
    title: 'Problem set 1', instructions: '', dueAt: T(12), closesAt: null, allowResubmission: true, maxVersions: 5, ...patch,
  });
  it('accepts a sound draft', () => {
    expect(draftProblem(draft())).toBeNull();
  });
  it('refuses each thing the database refuses', () => {
    expect(draftProblem(draft({ title: '  ' }))).toContain('title');
    expect(draftProblem(draft({ title: 'x'.repeat(LIMITS.title + 1) }))).toContain(String(LIMITS.title));
    expect(draftProblem(draft({ instructions: 'x'.repeat(LIMITS.instructions + 1) }))).toContain('instructions');
    expect(draftProblem(draft({ dueAt: '' }))).toContain('due time');
    expect(draftProblem(draft({ closesAt: T(6) }))).toContain('cannot close before');
    expect(draftProblem(draft({ maxVersions: 0 }))).toContain('between 1 and');
    expect(draftProblem(draft({ maxVersions: LIMITS.versionsMax + 1 }))).toContain('between 1 and');
  });
  it('publishes only a draft whose due time is still ahead', () => {
    expect(publishProblem(assignment({ status: 'draft' }), at(5))).toBeNull();
    expect(publishProblem(assignment({ status: 'draft' }), at(20))).toContain('due time has passed');
    expect(publishProblem(assignment({ status: 'published' }), at(5))).toContain('Only a draft');
  });
});

describe('extensionProblem', () => {
  const w = { dueAt: T(12), closesAt: null, extended: false };
  it('needs a reason, a later time, and a closing time that is not before it', () => {
    expect(extensionProblem(w, T(20), null, 'Hospital')).toBeNull();
    expect(extensionProblem(w, T(20), null, '  ')).toContain('reason');
    expect(extensionProblem(w, T(20), null, 'x'.repeat(LIMITS.reason + 1))).toContain(String(LIMITS.reason));
    expect(extensionProblem(w, T(12), null, 'r')).toContain('later');
    expect(extensionProblem(w, T(6), null, 'r')).toContain('later');
    expect(extensionProblem(w, '', null, 'r')).toContain('new due time');
    expect(extensionProblem(w, T(20), T(14), 'r')).toContain('cannot close before');
  });
});

// ── The receipt ────────────────────────────────────────────────────────

describe('the receipt', () => {
  it('hashes text the way the database does: SHA-256 of the UTF-8 bytes', async () => {
    // The standard test vector, and the empty string.
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(await sha256Hex('é')).toBe(await sha256Hex('é'));
    expect(await sha256Hex('é')).not.toBe(await sha256Hex('e'));
  });

  it('matches a version by id and by hash, and catches a changed text', async () => {
    const body = 'Answer one.';
    const sha = await sha256Hex(body);
    const v = version({ body, contentSha256: sha });
    const r: Receipt = {
      id: 'r1', versionId: 'v1', assignmentId: 'a1', studentId: 'ana', code: 'SR-0123456789AB',
      contentSha256: sha, submittedAt: T(10), dueAtThen: T(12), late: false,
    };
    expect(await receiptMatches(r, v)).toBe(true);
    // The control: each way it can fail, failing.
    expect(await receiptMatches(r, version({ body: 'Answer one!', contentSha256: sha }))).toBe(false);
    expect(await receiptMatches({ ...r, versionId: 'other' }, v)).toBe(false);
    expect(await receiptMatches({ ...r, contentSha256: '1'.repeat(64) }, v)).toBe(false);
  });

  it('prints as plain text that says what it proves and that it is not a grade', () => {
    const r: Receipt = {
      id: 'r1', versionId: 'v1', assignmentId: 'a1', studentId: 'ana', code: 'SR-0123456789AB',
      contentSha256: 'a'.repeat(64), submittedAt: T(10), dueAtThen: T(12), late: true,
    };
    const t = receiptText(r, { course: 'ECON 1020', term: '2026FA', title: 'Problem set 1' }, 2);
    for (const part of ['SR-0123456789AB', 'ECON 1020', 'Problem set 1', 'Version: 2', 'a'.repeat(64), 'submitted late', 'not a grade']) {
      expect(t, part).toContain(part);
    }
  });
});

describe('fingerprint and ordering', () => {
  it('names the same text the same and different text differently', () => {
    expect(fingerprint('Answer one.')).toBe(fingerprint('Answer one.'));
    expect(fingerprint('Answer one.')).not.toBe(fingerprint('Answer two.'));
    expect(fingerprint('')).toBe(fingerprint(''));
    expect(fingerprint('a'.repeat(1000))).toMatch(/^[0-9a-z]+-[0-9a-z]+$/);
  });
  it('lists open work first by due time, then drafts, then closed', () => {
    const list = [
      assignment({ id: 'c', status: 'closed', title: 'C' }),
      assignment({ id: 'd', status: 'draft', title: 'D' }),
      assignment({ id: 'late', status: 'published', dueAt: T(30), title: 'Late' }),
      assignment({ id: 'soon', status: 'published', dueAt: T(10), title: 'Soon' }),
    ].sort(byUrgency);
    expect(list.map((a) => a.id)).toEqual(['soon', 'late', 'd', 'c']);
  });
});
