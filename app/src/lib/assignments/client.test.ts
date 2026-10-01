import { describe, expect, it } from 'vitest';
import {
  assignmentOfferings, fileProblem, openness, readAssignment, receiptText, when, type Assignment,
} from './client';

const A = (o: Partial<Assignment> = {}): Assignment => ({
  id: 'a1', title: 'Problem set 1', instructions: '', points: 10, dueAt: '2026-10-10T17:00:00Z',
  latePolicy: 'refuse', lateUntil: null, attempts: 2, status: 'published', ...o,
});
const at = (iso: string) => new Date(iso);

describe('which courses a person teaches or takes', () => {
  const grants = [
    { capability: 'assignments:author', scopeKind: 'course', scopeId: 'vu/ECON 1020/2026FA' },
    { capability: 'assignments:submit', scopeKind: 'course', scopeId: 'vu/HIST 2100/2027SP' },
    { capability: 'assignments:submit', scopeKind: 'course', scopeId: 'vu/HIST 2100' },
    { capability: 'assignments:submit', scopeKind: 'course', scopeId: 'other/ECON 1020/2026FA' },
    { capability: 'assignments:review', scopeKind: 'course', scopeId: 'vu/BUS 1600/2026FA' },
    { capability: 'assignments:author', scopeKind: 'school', scopeId: 'vu' },
  ];
  it('reads each grant over exactly school/CODE/TERM and no other', () => {
    expect(assignmentOfferings(grants, 'vu')).toEqual({
      teaching: [{ course: 'ECON 1020', term: '2026FA' }],
      taking: [{ course: 'HIST 2100', term: '2027SP' }],
    });
  });
  it('reads nothing for a grant with no term, another school, or no school', () => {
    expect(assignmentOfferings(grants, 'other').taking).toEqual([{ course: 'ECON 1020', term: '2026FA' }]);
    expect(assignmentOfferings(grants, '')).toEqual({ teaching: [], taking: [] });
  });
});

describe('reading a row', () => {
  it('keeps the rules and defaults an unknown status to draft', () => {
    const a = readAssignment({ id: 'x', title: 'T', due_at: '2026-10-10T00:00:00Z', late_policy: 'accept', late_until: '2026-10-12T00:00:00Z', attempts_allowed: 3, status: 'weird', points_possible: '12.5' });
    expect(a).toMatchObject({ latePolicy: 'accept', lateUntil: '2026-10-12T00:00:00Z', attempts: 3, status: 'draft', points: 12.5 });
  });
});

describe('whether work would be taken now', () => {
  it('takes it before the due date', () => {
    expect(openness(A(), undefined, 0, at('2026-10-09T00:00:00Z'))).toEqual({ ok: true, late: false, why: '' });
  });
  it('refuses a draft and a closed assignment', () => {
    expect(openness(A({ status: 'draft' }), undefined, 0, at('2026-10-09T00:00:00Z')).ok).toBe(false);
    expect(openness(A({ status: 'closed' }), undefined, 0, at('2026-10-09T00:00:00Z')).why).toMatch(/closed/);
  });
  it('refuses once the attempts are used', () => {
    expect(openness(A(), undefined, 2, at('2026-10-09T00:00:00Z'))).toMatchObject({ ok: false, why: 'You have used all 2 attempts.' });
  });
  it('refuses late work where the assignment takes none', () => {
    expect(openness(A(), undefined, 0, at('2026-10-11T00:00:00Z'))).toMatchObject({ ok: false, late: true });
  });
  it('takes late work and says it is marked late, until the cut-off', () => {
    const a = A({ latePolicy: 'accept', lateUntil: '2026-10-12T00:00:00Z' });
    expect(openness(a, undefined, 0, at('2026-10-11T00:00:00Z'))).toMatchObject({ ok: true, late: true });
    expect(openness(a, undefined, 0, at('2026-10-13T00:00:00Z'))).toMatchObject({ ok: false, late: true });
  });
  it('holds a student to their extension, not the assignment’s date', () => {
    const ext = { dueAt: '2026-10-15T00:00:00Z', lateUntil: null };
    expect(openness(A(), ext, 0, at('2026-10-11T00:00:00Z'))).toEqual({ ok: true, late: false, why: '' });
    expect(openness(A(), ext, 0, at('2026-10-16T00:00:00Z')).ok).toBe(false);
  });
});

describe('a file', () => {
  it('is refused empty, too large, or of a type the bucket does not take', () => {
    expect(fileProblem({ name: 'a.pdf', size: 0, type: 'application/pdf' })).toMatch(/empty/);
    expect(fileProblem({ name: 'a.pdf', size: 30_000_000, type: 'application/pdf' })).toMatch(/25 MB/);
    expect(fileProblem({ name: 'a.exe', size: 10, type: 'application/x-msdownload' })).toMatch(/not a type/);
  });
  it('is accepted in size and type', () => {
    expect(fileProblem({ name: 'a.pdf', size: 1000, type: 'application/pdf' })).toBeNull();
  });
});

describe('words', () => {
  it('shows a moment in the school’s timezone, and survives a bad one', () => {
    expect(when('2026-10-10T17:00:00Z', 'America/Chicago')).toContain('12:00');
    expect(when('2026-10-10T17:00:00Z', 'Not/AZone')).toContain('2026-10-10');
  });
  it('writes a receipt that says it is not a grade', () => {
    const t = receiptText('Problem set 1', 'ECON 1020', '2026FA', { attempt: 1, submittedAt: '2026-10-09T10:00:00Z', late: false, receiptHash: 'ab'.repeat(32) });
    expect(t).toContain('Receipt hash (SHA-256): ' + 'ab'.repeat(32));
    expect(t).toContain('not a grade');
  });
});
