import { describe, expect, it } from 'vitest';
import { DOMAINS } from './domains';
import { countParity, proveProbes, runDomain } from './engine';
import { blockers, decide, exceptionId, ingest, overdue, snapshot, SLA_HOURS, type Queue } from './exceptions';
import { syntheticPair } from './fixtures';
import { POLICY, evaluateDomain, tightenPolicy, toReport, type Evaluation } from './quality';
import { approvalKey, approvalsNeeded, scopeFlags, scopeProblems } from './scope';
import type { DomainSpec, Pair, Row } from './types';

const d = (id: string) => DOMAINS.find((x) => x.id === id)!;
const academic = d('academic_records');
const identity = d('identity');
const courses = d('courses');

const evaluate = (domain: DomainSpec, pair: Pair, over: { probes?: boolean; attestedEmpty?: string[] } = {}): Evaluation =>
  evaluateDomain({
    domain,
    results: runDomain(domain, pair),
    parity: countParity(domain, pair),
    probes: over.probes === false ? undefined : proveProbes(domain, syntheticPair(domain)),
    attestedEmpty: over.attestedEmpty,
  });
const edit = (pair: Pair, side: 'source' | 'target', entity: string, change: (rows: Row[]) => Row[]): Pair => ({ ...pair, [side]: { ...pair[side], [entity]: change([...pair[side][entity]]) } });
const set = (rows: Row[], i: number, patch: Record<string, unknown>) => rows.map((r, n) => (n === i ? { ...r, ...patch } : r));

describe('the verdict', () => {
  it('passes only clean data that was checked and whose checks were proven', () => {
    expect(evaluate(academic, syntheticPair(academic))).toMatchObject({ verdict: 'pass', reasons: [], probes: 'proven', countParity: 'ok' });
  });

  it('fails a critical defect the migration introduced, however few rows', () => {
    const pair = edit(syntheticPair(academic), 'target', 'course_result', (r) => set(r, 0, { grade: 'F' }));
    const e = evaluate(academic, pair);
    expect(e.verdict).toBe('fail');
    expect(e.migration.critical).toBeGreaterThan(0);
  });

  it('fails when the counts do not reconcile, and says by how much', () => {
    const pair = edit(syntheticPair(identity), 'target', 'role_grant', (r) => r.slice(1));
    const e = evaluate(identity, pair);
    expect(e.countParity).toBe('mismatch');
    expect(e.reasons.join(' ')).toMatch(/role_grant: \d+ rows loaded, \d+ expected/);
  });

  it('does not fail the migration for a defect the source already had, but counts it', () => {
    const clean = syntheticPair(academic);
    const dirty = edit(edit(clean, 'source', 'student_record', (r) => set(r, 0, { gpa: 0.1 })), 'target', 'student_record', (r) => set(r, 0, { gpa: 0.1 }));
    const e = evaluate(academic, dirty);
    expect(e.verdict).toBe('pass');
    expect(e.inherited.critical).toBe(1);
    expect(e.migration.critical).toBe(0);
  });

  it('holds, rather than passes, when a check examined nothing', () => {
    const pair = syntheticPair(d('enrollments'));
    const noWaitlist: Pair = { ...pair, source: { ...pair.source, waitlist_entry: [] }, target: { ...pair.target, waitlist_entry: [] } };
    const e = evaluate(d('enrollments'), noWaitlist);
    expect(e.verdict).toBe('hold');
    expect(e.vacuous).toContain('enrollments.waitlist.order');
    const attested = evaluateDomain({
      domain: d('enrollments'), results: runDomain(d('enrollments'), noWaitlist), parity: countParity(d('enrollments'), noWaitlist),
      probes: proveProbes(d('enrollments'), syntheticPair(d('enrollments'))), attestedEmpty: ['enrollments.waitlist.order', 'enrollments.waitlist.crosswalk', 'enrollments.waitlist.preserved'],
    });
    expect(attested.verdict).toBe('pass');
    expect(attested.attestedEmpty).toHaveLength(3);
  });

  it('holds when the checks were never proven, and when one of them is not proven', () => {
    expect(evaluate(academic, syntheticPair(academic), { probes: false })).toMatchObject({ verdict: 'hold', probes: 'missing' });
    const pair = syntheticPair(academic);
    const probes = proveProbes(academic, pair).map((p, i) => (i === 0 ? { ...p, status: 'missed' as const } : p));
    const e = evaluateDomain({ domain: academic, results: runDomain(academic, pair), parity: countParity(academic, pair), probes });
    expect(e).toMatchObject({ verdict: 'hold', probes: 'incomplete' });
  });

  it('tolerates a small rate of minor defects in a standard domain and none of major in a high-stakes one', () => {
    const base = syntheticPair(courses, 32);
    const oneMinor = edit(base, 'target', 'section_meeting', (r) => set(r, 0, { starts_at: '2026-06-30', ends_at: '2026-01-01' }));
    expect(evaluate(courses, oneMinor).migration.minor).toBeGreaterThan(0);
    const major = edit(base, 'target', 'course', (r) => set(r, 0, { title: 'Changed' }));
    // 1 of 4 courses is far above 0.1%.
    expect(evaluate(courses, major).verdict).toBe('fail');
    expect(POLICY.high.majorMaxRate).toBe(0);
  });

  it('lets a school tighten a threshold and refuses a looser one', () => {
    expect(tightenPolicy(POLICY.standard, { majorMaxRate: 0, minorMaxRate: 0.001 })).toMatchObject({ ok: true });
    expect(tightenPolicy(POLICY.high, { majorMaxRate: 0.01, minorMaxRate: 0.001 })).toMatchObject({ ok: false });
    expect(tightenPolicy(POLICY.high, { majorMaxRate: -1, minorMaxRate: 0 })).toMatchObject({ ok: false });
  });
});

describe('the report', () => {
  it('names no value and no source key, only salted references', async () => {
    const pair = edit(syntheticPair(identity), 'target', 'person', (r) => set(r, 0, { legal_name: 'Alexandra Q. Student' }));
    const results = runDomain(identity, pair);
    const report = await toReport('tenant-a', evaluate(identity, pair), results);
    const text = JSON.stringify(report);
    expect(text).not.toContain('Alexandra');
    expect(text).not.toContain('person-0');
    expect(report.invariants.flatMap((i) => i.findings).every((f) => f.ref.startsWith('sha256:'))).toBe(true);
    const other = await toReport('tenant-b', evaluate(identity, pair), results);
    expect(other.invariants.flatMap((i) => i.findings.map((f) => f.ref))).not.toEqual(report.invariants.flatMap((i) => i.findings.map((f) => f.ref)));
  });
});

describe('scope: what may move at all', () => {
  it('requires a named approval for grades and refuses a blocked class outright', () => {
    const flags = scopeFlags(academic);
    expect(flags.some((f) => f.field === 'grade' && f.reason === 'never_ingest' && f.approval === approvalKey('academic_records', 'course_result'))).toBe(true);
    expect(scopeProblems(academic, []).length).toBeGreaterThan(0);
    expect(scopeProblems(academic, approvalsNeeded(academic))).toEqual([]);
    const sneaky: DomainSpec = { ...courses, entities: [{ ...courses.entities[0], fields: [...courses.entities[0].fields, { name: 'diagnosis_code', class: 'T4' }] }, ...courses.entities.slice(1)] };
    expect(scopeProblems(sneaky, approvalsNeeded(sneaky)).join(' ')).toContain('the platform floor allows it nowhere');
  });

  it('keeps money and holds visible as flagged, since the platform never displays a balance or a reason by default', () => {
    expect(approvalsNeeded(d('finance')).length).toBeGreaterThan(0);
  });
});

describe('the exception queue', () => {
  const NOW = '2026-10-04T12:00:00.000Z';
  const finding = (over: Partial<{ invariant: string; ref: string; severity: 'critical' | 'major' | 'minor'; origin: 'migration' | 'source' }> = {}) => ({
    invariant: 'academic_records.student.gpa', ref: 'sha256:aaaaaaaaaaaaaaaaaaaa', origin: 'source' as const, severity: 'critical' as const, what: 'x', ...over,
  });
  const open = (f = finding()) => ingest([], 'academic_records', [f.invariant], [f], NOW);
  const id = (f = finding()) => exceptionId(f.invariant, f.ref);
  const ok = (r: ReturnType<typeof decide>): Queue => { if (!r.ok) throw new Error(r.why); return r.queue; };

  it('opens one exception per finding, due by severity, and does not open it twice', () => {
    const q = open();
    expect(q).toHaveLength(1);
    expect(Date.parse(q[0].dueAt) - Date.parse(q[0].openedAt)).toBe(SLA_HOURS.critical * 3_600_000);
    expect(ingest(q, 'academic_records', ['academic_records.student.gpa'], [finding()], NOW)).toHaveLength(1);
  });

  it('never lets the migration\'s own defect be waived, excluded or passed to the source', () => {
    const q = open(finding({ origin: 'migration' }));
    for (const disposition of ['waive', 'exclude', 'fix_source'] as const) {
      expect(decide(q, id(finding({ origin: 'migration' })), { disposition, by: 'a', approvedBy: 'b', reason: 'a perfectly good sounding reason', expiresOn: '2026-11-01', highStakes: true, now: NOW })).toMatchObject({ ok: false });
    }
    expect(decide(q, id(finding({ origin: 'migration' })), { disposition: 'fix_mapping', by: 'a', highStakes: true, now: NOW })).toMatchObject({ ok: true });
  });

  it('refuses to fix the mapping for something the source already had', () => {
    expect(decide(open(), id(), { disposition: 'fix_mapping', by: 'a', highStakes: true, now: NOW })).toMatchObject({ ok: false });
  });

  it('holds a waiver to a reason, an independent approver, an end date, and a countersignature where the stakes are high', () => {
    const q = open();
    const base = { disposition: 'waive' as const, by: 'ana', highStakes: true, now: NOW };
    expect(decide(q, id(), { ...base, approvedBy: 'reg', reason: 'ok', expiresOn: '2026-11-01' })).toMatchObject({ ok: false });
    expect(decide(q, id(), { ...base, approvedBy: 'ana', reason: 'The registrar will correct this record at source.', expiresOn: '2026-11-01' })).toMatchObject({ ok: false });
    expect(decide(q, id(), { ...base, approvedBy: 'reg', reason: 'The registrar will correct this record at source.' })).toMatchObject({ ok: false });
    expect(decide(q, id(), { ...base, approvedBy: 'reg', reason: 'The registrar will correct this record at source.', expiresOn: '2027-06-01' })).toMatchObject({ ok: false });
    expect(decide(q, id(), { ...base, approvedBy: 'reg', reason: 'The registrar will correct this record at source.', expiresOn: '2026-11-01' })).toMatchObject({ ok: false });
    expect(decide(q, id(), { ...base, approvedBy: 'reg', countersignedBy: 'reg', reason: 'The registrar will correct this record at source.', expiresOn: '2026-11-01' })).toMatchObject({ ok: false });
    expect(decide(q, id(), { ...base, approvedBy: 'reg', countersignedBy: 'lead', reason: 'The registrar will correct this record at source.', expiresOn: '2026-11-01' })).toMatchObject({ ok: true });
    expect(decide(q, id(), { ...base, highStakes: false, approvedBy: 'reg', reason: 'The registrar will correct this record at source.', expiresOn: '2026-11-01' })).toMatchObject({ ok: true });
  });

  it('proves a fix by the next run: still found reopens it, no longer found closes it', () => {
    const fixed = ok(decide(open(), id(), { disposition: 'fix_source', by: 'reg', highStakes: true, now: NOW }));
    expect(blockers(fixed, NOW)).toHaveLength(1);
    const again = ingest(fixed, 'academic_records', ['academic_records.student.gpa'], [finding()], NOW);
    expect(again[0].status).toBe('open');
    expect(again[0].history.at(-1)!.what).toMatch(/reopened/);
    const gone = ingest(fixed, 'academic_records', ['academic_records.student.gpa'], [], NOW);
    expect(gone[0]).toMatchObject({ status: 'closed', closedBy: 'rerun' });
    expect(blockers(gone, NOW)).toHaveLength(0);
  });

  it('does not close an exception on a run that never ran its check', () => {
    const q = open();
    expect(ingest(q, 'academic_records', ['some.other.check'], [], NOW)[0].status).toBe('open');
    expect(ingest(q, 'finance', ['academic_records.student.gpa'], [], NOW)[0].status).toBe('open');
  });

  it('stops blocking while a waiver stands and blocks again the day after it ends', () => {
    const waived = ok(decide(open(), id(), { disposition: 'waive', by: 'ana', approvedBy: 'reg', countersignedBy: 'lead', reason: 'The registrar will correct this record at source.', expiresOn: '2026-11-01', highStakes: true, now: NOW }));
    expect(blockers(waived, NOW)).toHaveLength(0);
    expect(snapshot(waived, 'academic_records', NOW)).toMatchObject({ openCritical: 0, standingWaivers: 1 });
    expect(blockers(waived, '2026-11-02T00:00:00Z')).toHaveLength(1);
  });

  it('counts overdue exceptions and never lets a minor one block cutover', () => {
    const q = ingest([], 'courses', ['c'], [finding({ invariant: 'c', severity: 'minor' }), finding({ invariant: 'c', ref: 'sha256:bbbbbbbbbbbbbbbbbbbb', severity: 'major' })], NOW);
    expect(blockers(q, NOW)).toHaveLength(1);
    const later = '2026-10-20T00:00:00Z';
    expect(overdue(q, later)).toHaveLength(2);
    expect(snapshot(q, 'courses', NOW)).toMatchObject({ openMajor: 1, openMinor: 1 });
  });
});
