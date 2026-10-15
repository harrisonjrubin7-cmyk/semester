/**
 * Integration quality (Phase 1a): drift, reconciliation, duplicates, lineage
 * and ownership, the provider registry, the simulation sandbox and mapping
 * versions — each against #779's own mock SIS and its fixtures, so these hold
 * the real declaration to account rather than one written for the test.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AdapterDeclaration, EntityMapping } from './adapter';
import { governanceEnvelope } from './governance-envelope';
import { MOCK_SIS, SIS_FIXTURES } from './mock-sis';
import type { CanonicalReference, ExternalRecord, IngestError } from './pipeline';
import { redactReference } from './redact';
import { DRIFT_KINDS, detectDrift, fingerprintBatch, withoutHeld } from './drift';
import { RECONCILE_STATUSES, reconcile, type SourceEntry, type StoredEntry } from './reconcile';
import { NATURAL_KEYS, findDuplicateCandidates, resolveDuplicate, reverseResolution, type Supersession } from './duplicates';
import { alertFor, breachLevel, lineageConflicts, lineageOf, ownerProblems, type SourceOwner } from './lineage';
import { MATURITIES, liveEvidence, providerClaim, providerProblems, type Provider } from './providers';
import { asSimulation, simulate } from './simulate';
import { VERSION_STATUSES, approve, goLive, propose, recordSimulation, rollback, type MappingVersion } from './mapping-versions';

const NOW = new Date('2026-09-27T12:00:00Z');

const SQL = readFileSync(resolve(__dirname, '../../../../supabase/migrations/20260928040000_integration_quality.sql'), 'utf8');

describe('the vocabulary matches the database', () => {
  /*
   * The rules are here and their results are kept there; a status one side
   * knows and the other refuses is a sync run that fails at the insert.
   */
  const inCheck = (list: readonly string[]) => list.filter((v) => !SQL.includes(`'${v}'`));
  it('names every status, kind, entity and maturity the TypeScript does', () => {
    expect(inCheck(RECONCILE_STATUSES.filter((s) => s !== 'matched'))).toEqual([]);
    expect(inCheck(DRIFT_KINDS)).toEqual([]);
    expect(inCheck(Object.keys(NATURAL_KEYS))).toEqual([]);
    expect(inCheck(MATURITIES)).toEqual([]);
    expect(inCheck(VERSION_STATUSES)).toEqual([]);
  });

  it('keeps a matched record as a count, never a discrepancy row', () => {
    const statusCheck = SQL.slice(SQL.indexOf('create table if not exists public.integration_reconciliation_discrepancies'));
    const statuses = statusCheck.slice(statusCheck.indexOf('status'), statusCheck.indexOf('entity_type'));
    expect(statuses).not.toContain("'matched'");
  });
});
const { term, section, window: win, enrollment, hold, requirement } = SIS_FIXTURES;
const withFields = (r: ExternalRecord, fields: Record<string, unknown>, id = r.id): ExternalRecord => ({ ...r, id, fields });

describe('schema drift', () => {
  it('finds nothing in the fixtures the mock SIS was written for', () => {
    const report = detectDrift(MOCK_SIS, [term, section, win, enrollment, hold]);
    expect(report.changes).toEqual([]);
    expect(report.action).toBe('continue');
  });

  it('never reports a never-ingest field as drift: it is dropped by design', () => {
    // The hold fixture carries `reason` and `amount`, as a real SIS would.
    expect(detectDrift(MOCK_SIS, [hold]).changes.map((c) => c.field)).not.toContain('reason');
    expect(detectDrift(MOCK_SIS, [hold]).changes.map((c) => c.field)).not.toContain('amount');
  });

  it('reads a renamed required field as a breaking removal, and guesses the rename', () => {
    const { description, ...rest } = term.fields;
    const renamed = withFields(term, { ...rest, term_name: description });
    const report = detectDrift(MOCK_SIS, [renamed]);
    expect(report.changes.map((c) => [c.kind, c.field])).toEqual([
      ['removed', 'description'],
      ['added', 'term_name'],
      ['possible_rename', 'description'],
    ]);
    expect(report.breaking).toBe(true);
    expect(report.action).toBe('degrade');
    expect(report.hold).toEqual(['term']);
  });

  it('holds only the entity that broke, and lets the rest through', () => {
    const { description, ...rest } = term.fields;
    const batch = [withFields(term, { ...rest, term_name: description }), section, win];
    const report = detectDrift(MOCK_SIS, batch);
    expect(withoutHeld(batch, report).map((r) => r.entityType)).toEqual(['section', 'registration_window']);
  });

  it('breaks on a required field changing type, and on a new code in a required enum', () => {
    const typed = detectDrift(MOCK_SIS, [withFields(section, { ...section.fields, course: 1010 })]);
    expect(typed.changes).toEqual([
      expect.objectContaining({ kind: 'type_changed', field: 'course', breaking: true }),
    ]);
    const coded = detectDrift(MOCK_SIS, [withFields(enrollment, { ...enrollment.fields, status: 'withdrawn' })]);
    expect(coded.changes).toEqual([
      expect.objectContaining({ kind: 'enum_changed', field: 'status', detail: 'new codes: withdrawn', breaking: true }),
    ]);
  });

  it('does not break when an optional field goes missing, or an unmapped entity arrives', () => {
    const { meeting: _meeting, ...rest } = section.fields;
    const report = detectDrift(MOCK_SIS, [withFields(section, rest), requirement]);
    expect(report.changes.map((c) => [c.kind, c.field, c.breaking])).toEqual([
      ['removed', 'meeting', false],
      ['unmapped_entity', null, false],
    ]);
    expect(report.action).toBe('continue');
  });

  it('fingerprints the shape, not the students: same fields fingerprint the same', () => {
    const other = withFields(enrollment, { ...enrollment.fields, course: 'PSCI 2220', section: '02' }, 'enr-88');
    expect(fingerprintBatch([enrollment])).toBe(fingerprintBatch([other]));
    expect(fingerprintBatch([enrollment])).not.toBe(fingerprintBatch([section]));
  });

  it('keeps no values in a report, apart from enum codes', () => {
    const { description, ...rest } = term.fields;
    const text = JSON.stringify(detectDrift(MOCK_SIS, [withFields(term, { ...rest, term_name: description }), enrollment]));
    for (const value of ['Spring 2027', '202710', 'ECON 1010', 'sis-person-77', 'enr-77-ECON1010']) expect(text).not.toContain(value);
  });
});

describe('reconciliation', () => {
  const stored = (id: string, at: string | null, over: Partial<StoredEntry> = {}): StoredEntry => ({
    entityType: 'section', sourceRecordId: id, sourceTimestamp: at, externalDeletedAt: null, ...over,
  });
  const src = (id: string, at: string | null, over: Partial<SourceEntry> = {}): SourceEntry => ({
    entityType: 'section', id, updatedAt: at, ...over,
  });
  const T = '2026-09-27T06:00:00Z';

  it('counts one of each status, and says the run is not clean', async () => {
    const refused = await redactReference('vu', 'sec-rejected');
    const errors: IngestError[] = [{ category: 'type_mismatch', entityType: 'section', reference: refused, message: 'x', retryable: false }];
    const report = await reconcile({
      tenantId: 'vu',
      source: [
        src('sec-ok', T),
        src('sec-newer', '2026-09-27T09:00:00Z'),
        src('sec-mismatch', T, { version: 'v2' }),
        src('sec-new', T),
        src('sec-dup', T),
        src('sec-dup', T),
        src('sec-rejected', T),
        src('sec-stale', '2026-09-20T06:00:00Z'),
      ],
      stored: [
        stored('sec-ok', T),
        stored('sec-newer', T),
        stored('sec-mismatch', T, { version: 'v1' }),
        stored('sec-dup', T),
        stored('sec-gone', T),
        stored('sec-stale', '2026-09-20T06:00:00Z'),
        stored('sec-deleted', T, { externalDeletedAt: T }),
      ],
      lastRunErrors: errors,
      freshnessTargetMinutes: 24 * 60,
      now: NOW,
    });
    expect(report.counts).toEqual({
      matched: 2, pending: 1, mismatch: 1, missing_in_semester: 1, missing_at_source: 1, duplicate: 1, stale: 1, rejected: 1,
    });
    expect(report.clean).toBe(false);
  });

  it('is clean when all that differs is newer at the provider', async () => {
    const report = await reconcile({
      tenantId: 'vu', source: [src('a', '2026-09-27T09:00:00Z')], stored: [stored('a', T)],
      freshnessTargetMinutes: 60 * 24, now: NOW,
    });
    expect(report.clean).toBe(true);
    expect(report.counts.pending).toBe(1);
  });

  it('shows redacted references only: no provider id reaches the report', async () => {
    const report = await reconcile({
      tenantId: 'vu', source: [src('enr-77-ECON1010', T)], stored: [], freshnessTargetMinutes: 60, now: NOW,
    });
    expect(JSON.stringify(report)).not.toContain('enr-77');
    expect(report.discrepancies[0].reference).toMatch(/^sha256:[0-9a-f]{32}$/);
  });
});

describe('duplicate candidates', () => {
  const ref = (over: Partial<CanonicalReference>): CanonicalReference => ({
    tenantId: 'vu', canonicalEntity: 'course_section', canonicalId: 'c1', subjectUserId: null,
    sourceSystem: 'Mock SIS Fixture 1.0', sourceRecordId: 's1', sourceTimestamp: '2026-09-27T06:00:00Z',
    sourceOfTruth: 'Registrar / SIS', classification: 'T0', freshness: 'live', mappingVersion: 1, confidence: 1,
    externalDeletedAt: null, metadataOnly: false, values: { term: '202710', course: 'ECON 1010', section: '01' },
    governance: governanceEnvelope(MOCK_SIS, MOCK_SIS.entities[0], 'conn_1', NOW), ...over,
  });

  it('groups two ids that name the same section, and suggests the more recent', () => {
    const a = ref({ canonicalId: 'c-old', sourceRecordId: 'ECON-1010-01', sourceTimestamp: '2026-09-01T00:00:00Z' });
    const b = ref({ canonicalId: 'c-new', sourceRecordId: 'ECON1010.01', values: { term: '202710', course: ' econ  1010', section: '01' } });
    const [c] = findDuplicateCandidates([a, b, ref({ canonicalId: 'c-other', sourceRecordId: 'x', values: { term: '202710', course: 'ECON 1010', section: '02' } })]);
    expect(c.members).toEqual(['c-new', 'c-old']);
    expect(c.suggestedKeep).toBe('c-new');
    expect(JSON.stringify(c)).not.toContain('ECON');
  });

  it('prefers the source of truth over a newer copy from elsewhere', () => {
    const truth = ref({ canonicalId: 'c-sis', sourceSystem: 'Registrar / SIS', sourceTimestamp: '2026-09-01T00:00:00Z' });
    const copy = ref({ canonicalId: 'c-lms', sourceSystem: 'Canvas', sourceRecordId: 's2' });
    expect(findDuplicateCandidates([copy, truth])[0].suggestedKeep).toBe('c-sis');
  });

  it('never merges two students, an entity with no natural key, or a deleted record', () => {
    const e = (id: string, user: string) =>
      ref({ canonicalEntity: 'enrollment', canonicalId: id, sourceRecordId: id, subjectUserId: user });
    expect(findDuplicateCandidates([e('e1', 'u1'), e('e2', 'u2')])).toEqual([]);
    expect(findDuplicateCandidates([e('e1', 'u1'), e('e2', 'u1')])).toHaveLength(1);
    const ev = (id: string) => ref({ canonicalEntity: 'event', canonicalId: id, sourceRecordId: id });
    expect(findDuplicateCandidates([ev('a'), ev('b')])).toEqual([]);
    expect(findDuplicateCandidates([ref({ canonicalId: 'a' }), ref({ canonicalId: 'b', sourceRecordId: 's2', externalDeletedAt: '2026-09-26T00:00:00Z' })])).toEqual([]);
  });

  it('merges, then reverses to exactly what was there', () => {
    const [c] = findDuplicateCandidates([ref({ canonicalId: 'a' }), ref({ canonicalId: 'b', sourceRecordId: 's2' }), ref({ canonicalId: 'z', sourceRecordId: 's3' })]);
    const start: Supersession = { z: 'elsewhere' };
    const merged = resolveDuplicate(start, c, 'a', 'Data Steward', NOW, 'res-1');
    if (!merged.ok) throw new Error(merged.why);
    expect(merged.state).toEqual({ a: null, b: 'a', z: 'a' });
    const undone = reverseResolution(merged.state, merged.resolution, NOW);
    if (!undone.ok) throw new Error(undone.why);
    expect(undone.state).toEqual({ a: null, b: null, z: 'elsewhere' });
    expect(reverseResolution(undone.state, undone.resolution, NOW)).toEqual({ ok: false, why: 'This resolution was already reversed.' });
  });

  it('refuses a keep outside the group, and an undo over a later decision', () => {
    const [c] = findDuplicateCandidates([ref({ canonicalId: 'a' }), ref({ canonicalId: 'b', sourceRecordId: 's2' })]);
    expect(resolveDuplicate({}, c, 'nope', 'x', NOW, 'r')).toMatchObject({ ok: false });
    const merged = resolveDuplicate({}, c, 'a', 'x', NOW, 'r');
    if (!merged.ok) throw new Error(merged.why);
    expect(reverseResolution({ ...merged.state, b: 'c' }, merged.resolution, NOW)).toMatchObject({ ok: false });
  });
});

describe('lineage and ownership', () => {
  it('has one row per mapped field of the mock SIS, and no conflicts', () => {
    const rows = lineageOf(MOCK_SIS);
    expect(rows).toHaveLength(MOCK_SIS.entities.reduce((n, e) => n + e.fields.length, 0));
    expect(lineageConflicts(rows)).toEqual([]);
    expect(rows.find((r) => r.externalEntity === 'hold' && r.externalField === 'office')).toMatchObject({
      canonicalEntity: 'registration_hold', canonicalField: 'office', classification: 'T3', sourceOfTruth: 'Registrar / SIS',
    });
  });

  it('catches two provider fields writing one canonical field', () => {
    const doubled: AdapterDeclaration = {
      ...MOCK_SIS,
      entities: [{ ...MOCK_SIS.entities[0], fields: [...MOCK_SIS.entities[0].fields, { external: 'title', canonical: 'name', type: 'string', required: false }] }],
    };
    expect(lineageConflicts(lineageOf(doubled))).toEqual(['term.name is written by both term.description and term.title']);
  });

  const owner: SourceOwner = {
    adapterId: 'mock_sis', owner: 'Registrar integrations', backupOwner: 'IT data team', freshnessTargetMinutes: 60,
    staleThresholdMinutes: 100, reviewCadenceDays: 90, escalation: 'CIO office', correctionRoute: 'registrar@example.edu',
  };

  it('refuses an owner row a breach could not be escalated from', () => {
    expect(ownerProblems(owner)).toEqual([]);
    expect(ownerProblems({ ...owner, backupOwner: owner.owner })).toContain('the backup owner must be a different person');
    expect(ownerProblems({ ...owner, staleThresholdMinutes: 30 })).toContain('the stale threshold cannot be sooner than the target');
  });

  it('warns at 80 % of the threshold, breaches at it, and alerts once per change', () => {
    const ago = (m: number) => new Date(NOW.getTime() - m * 60_000);
    expect(breachLevel(ago(79), owner, NOW)).toBe('ok');
    expect(breachLevel(ago(80), owner, NOW)).toBe('warning');
    expect(breachLevel(ago(100), owner, NOW)).toBe('breach');
    expect(breachLevel(null, owner, NOW)).toBe('unavailable');
    expect(alertFor('warning', 'breach')).toBe('breach');
    expect(alertFor('breach', 'breach')).toBeNull();
    expect(alertFor('breach', 'ok')).toBeNull();
  });
});

describe('the provider registry', () => {
  const p: Provider = {
    id: 'canvas', name: 'Canvas', maturity: 'incremental', connectorOwner: 'Integrations', supportOwner: 'Support',
    compatibilityVersion: 'LTI 1.3', lastValidatedAt: '2026-09-20T00:00:00Z',
    evidence: [
      { kind: 'certification', what: 'LTI 1.3 Advantage', verifiedBy: 'A. Person', verifiedAt: '2026-09-01T00:00:00Z', expiresAt: '2027-09-01T00:00:00Z', document: 'docs/evidence/lti.pdf' },
      { kind: 'partnership', what: 'data-sharing agreement', verifiedBy: 'system', verifiedAt: '2026-09-01T00:00:00Z', expiresAt: null, document: 'x' },
      { kind: 'certification', what: 'expired thing', verifiedBy: 'A. Person', verifiedAt: '2025-01-01T00:00:00Z', expiresAt: '2026-01-01T00:00:00Z', document: 'x' },
    ],
  };

  it('says certified only with live evidence a person verified', () => {
    expect(liveEvidence(p, NOW).map((e) => e.what)).toEqual(['LTI 1.3 Advantage']);
    expect(providerClaim(p, NOW)).toEqual({ maturity: 'Keeps up to date', claims: ['Certified: LTI 1.3 Advantage'], lastChecked: '2026-09-20T00:00:00Z' });
  });

  it('drops the claim the day it expires', () => {
    expect(providerClaim(p, new Date('2027-09-01T00:00:00Z')).claims).toEqual([]);
  });

  it('says nothing but maturity for a provider with no evidence', () => {
    expect(providerClaim({ ...p, evidence: [] }, NOW).claims).toEqual([]);
  });

  it('refuses a syncing connector with no recorded contract test run', () => {
    expect(providerProblems(p)).toEqual([]);
    expect(providerProblems({ ...p, lastValidatedAt: null })).toContain('a syncing connector needs a recorded contract test run');
  });
});

describe('the simulation sandbox', () => {
  const mock = asSimulation(MOCK_SIS)!;
  const base = {
    adapter: mock,
    approvedScopes: MOCK_SIS.scopes,
    classificationCeiling: 'T3' as const,
    subjects: { 'sis-person-77': 'user-77' },
    consents: ['user-77:integration:sim_mock_sis'],
    now: NOW,
  };

  it('only takes a mock: a live declaration does not type-check and is refused at run time', async () => {
    const live: AdapterDeclaration = { ...MOCK_SIS, mock: false };
    expect(asSimulation(live)).toBeNull();
    // @ts-expect-error — a live declaration is not a SimulationAdapter.
    await expect(simulate({ ...base, adapter: live, records: [term] })).rejects.toThrow('Only a mock adapter can be simulated.');
  });

  it('calls the fixtures ready', async () => {
    const report = await simulate({ ...base, records: [term, section, win, enrollment, hold] });
    expect(report.verdict).toBe('ready');
    expect(report.result.created).toBe(5);
  });

  it('blocks a batch whose provider renamed a required field, and holds only that entity', async () => {
    const { description, ...rest } = term.fields;
    const report = await simulate({ ...base, records: [withFields(term, { ...rest, term_name: description }), section] });
    expect(report.verdict).toBe('blocked');
    expect(report.drift.hold).toEqual(['term']);
    expect(report.result.received).toBe(1);
  });
});

describe('mapping versions', () => {
  const mapping: EntityMapping = MOCK_SIS.entities[0];
  const step = (s: ReturnType<typeof propose>): MappingVersion[] => {
    if (!s.ok) throw new Error(s.why);
    return s.versions;
  };

  it('go propose → simulate → approve → live, and roll back as a new event', () => {
    let v = step(propose([], mapping, 'ana', NOW));
    v = step(recordSimulation(v, 1, 'sim-1', 'ready', 'ana', NOW));
    v = step(approve(v, 1, 'ben', NOW));
    v = step(goLive(v, 1, 'ben', NOW));
    v = step(propose(v, mapping, 'ana', NOW));
    v = step(recordSimulation(v, 2, 'sim-2', 'review', 'ana', NOW));
    v = step(approve(v, 2, 'ben', NOW));
    v = step(goLive(v, 2, 'ben', NOW));
    expect(v.map((x) => x.status)).toEqual(['retired', 'live']);
    v = step(rollback(v, 'ben', NOW));
    expect(v.map((x) => x.status)).toEqual(['live', 'rolled_back']);
    expect(v[0].events.at(-1)?.what).toBe('live again after rollback of v2');
  });

  it('refuses the shortcuts', () => {
    const v = step(propose([], mapping, 'ana', NOW));
    expect(approve(v, 1, 'ben', NOW)).toEqual({ ok: false, why: 'Simulate it before approving it.' });
    const simmed = step(recordSimulation(v, 1, 'sim', 'ready', 'ana', NOW));
    expect(approve(simmed, 1, 'ana', NOW)).toEqual({ ok: false, why: 'Somebody other than the proposer must approve it.' });
    const blocked = step(recordSimulation(v, 1, 'sim', 'blocked', 'ana', NOW));
    expect(approve(blocked, 1, 'ben', NOW)).toEqual({ ok: false, why: 'Its simulation was blocked.' });
    expect(goLive(v, 1, 'ben', NOW)).toEqual({ ok: false, why: 'Only an approved version can go live.' });
    expect(rollback(v, 'ben', NOW)).toEqual({ ok: false, why: 'Nothing is live to roll back.' });
  });

  it('refuses a transform outside the bounded list', () => {
    const odd = { ...mapping, fields: [{ ...mapping.fields[0], transform: 'eval' as never }] };
    expect(propose([], odd, 'ana', NOW)).toEqual({ ok: false, why: 'code: transform eval is not allowed' });
  });
});
