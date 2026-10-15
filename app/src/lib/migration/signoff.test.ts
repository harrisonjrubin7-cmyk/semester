import { describe, expect, it } from 'vitest';
import { APPROVAL_AREAS } from './center';
import { DOMAIN_OWNER, evaluateSignoffs, requiredRoles } from './signoff.ts';
import type { Role, Signoff } from './signoff.ts';
import { DATA_DOMAINS } from './types.ts';

const NOW = '2026-10-10T12:00:00.000Z';
const HEAD = 'h1';
const give = (role: Role, person: string, over: Partial<Signoff> = {}): Signoff => ({
  gate: 'validation_passed', domain: 'finance', role, person, at: '2026-10-09T12:00:00.000Z', evidenceHead: HEAD, decision: 'approve', ...over,
});
const status = (s: Signoff[], head = HEAD, preparers = new Set(['prep']), now = NOW) => evaluateSignoffs('validation_passed', 'finance', s, head, preparers, now);

describe('sign-off', () => {
  it('asks the institution role that owns the data, not only Semester', () => {
    expect(requiredRoles('validation_passed', 'finance')).toEqual(['semester_reviewer', 'finance']);
    expect(requiredRoles('validation_passed', 'academic_records')).toEqual(['semester_reviewer', 'registrar']);
    expect(requiredRoles('cutover_go', 'family')).toEqual(expect.arrayContaining(['semester_security', 'executive_sponsor', 'data_owner', 'counsel']));
  });

  it('puts qualified counsel on the gates that turn on a legal reading', () => {
    for (const d of ['family', 'documents', 'academic_records'] as const) expect(requiredRoles('mapping_approved', d)).toContain('counsel');
    expect(requiredRoles('mapping_approved', 'career')).not.toContain('counsel');
  });

  it('opens when every required role has signed fresh, distinct, non-preparer approvals', () => {
    expect(status([give('semester_reviewer', 'ana'), give('finance', 'bo')])).toEqual({ open: true, problems: [] });
  });

  it('names who is missing, and treats a rejection as the latest word of its role', () => {
    expect(status([give('semester_reviewer', 'ana')]).problems).toEqual([{ code: 'missing', role: 'finance' }]);
    const later = give('finance', 'bo', { at: '2026-10-09T13:00:00.000Z', decision: 'reject' });
    expect(status([give('semester_reviewer', 'ana'), give('finance', 'bo'), later]).problems).toEqual([{ code: 'rejected', role: 'finance' }]);
  });

  it('makes a signature stale the moment new evidence is recorded', () => {
    const s = [give('semester_reviewer', 'ana'), give('finance', 'bo')];
    expect(status(s, 'h2').problems.map((p) => p.code)).toEqual(['stale', 'stale']);
  });

  it('lets a signature expire', () => {
    const s = [give('semester_reviewer', 'ana'), give('finance', 'bo')];
    expect(status(s, HEAD, new Set(), '2026-11-01T00:00:00.000Z').problems.map((p) => p.code)).toEqual(['expired', 'expired']);
  });

  it('refuses a preparer of the evidence and one person in two roles', () => {
    expect(status([give('semester_reviewer', 'prep'), give('finance', 'bo')]).problems).toEqual([{ code: 'preparer_signed', role: 'semester_reviewer' }]);
    expect(status([give('semester_reviewer', 'ana'), give('finance', 'ana')]).problems).toEqual([{ code: 'same_person', role: 'finance' }]);
  });

  it('ignores a signature given at a different gate or for a different domain', () => {
    const wrongGate = give('finance', 'bo', { gate: 'cutover_go' });
    const wrongDomain = give('finance', 'bo', { domain: 'career' });
    expect(status([give('semester_reviewer', 'ana'), wrongGate, wrongDomain]).problems).toEqual([{ code: 'missing', role: 'finance' }]);
  });

  it('names an owner for every kind of data, drawn from the Center\'s approval areas', () => {
    for (const d of DATA_DOMAINS) expect(APPROVAL_AREAS).toContain(DOMAIN_OWNER[d]);
    // The areas the Center knows should each be answerable for some data.
    const used = new Set(Object.values(DOMAIN_OWNER));
    expect([...used].sort()).toEqual(['data_owner', 'faculty', 'finance', 'it', 'registrar']);
  });
});
