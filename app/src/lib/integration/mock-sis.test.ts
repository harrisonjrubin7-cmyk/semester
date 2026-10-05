/**
 * The SIS and degree-audit contract, run against the mocks. A real read-only
 * academic adapter joins this file with its provider's fixtures.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NEVER_DISPLAY, NEVER_INGEST } from './catalog';
import { validateDeclaration } from './adapter';
import { memoryStore, mockBatch } from './mock-adapter';
import { MOCK_DEGREE_AUDIT, MOCK_SIS, SIS_FIXTURES } from './mock-sis';
import { ingest, type ConnectionState, type ExternalRecord } from './pipeline';

const NOW = new Date('2026-09-27T12:00:00Z');
const conn = (over: Partial<ConnectionState> = {}): ConnectionState => ({
  tenantId: 'vu', publicId: 'conn_sis0000000000000000a', status: 'healthy', approved: true,
  approvedScopes: [...MOCK_SIS.scopes, ...MOCK_DEGREE_AUDIT.scopes], classificationCeiling: 'T3', ...over,
});
const consented = () => memoryStore({
  subjects: { 'sis-person-77': 'u77' },
  consents: [`u77:integration:${conn().publicId}`],
});
const run = (records: ExternalRecord[], over: Partial<Parameters<typeof ingest>[0]> = {}) =>
  ingest({ adapter: MOCK_SIS, connection: conn(), batch: mockBatch(records), store: consented(),
    killSwitchEngaged: false, now: NOW, ...over });

describe('the mock academic adapters', () => {
  it('declare themselves validly, read-only, as mocks', () => {
    for (const a of [MOCK_SIS, MOCK_DEGREE_AUDIT]) {
      expect(validateDeclaration(a), a.id).toEqual([]);
      expect(a.direction).toBe('read');
      expect(a.mock).toBe(true);
    }
  });

  it('hold personal records at T3 and everything tenant-wide at T0', () => {
    for (const e of [...MOCK_SIS.entities, ...MOCK_DEGREE_AUDIT.entities]) {
      expect(e.classification, e.externalEntity).toBe(e.personal ? 'T3' : 'T0');
    }
  });
});

describe('what may be stored', () => {
  it('refuses a mapping that would store a hold reason or an amount', () => {
    const hold = MOCK_SIS.entities.find((e) => e.externalEntity === 'hold')!;
    for (const canonical of ['reason', 'amount_due', 'balance']) {
      const bad = { ...MOCK_SIS, entities: [{ ...hold,
        fields: [...hold.fields, { external: 'x', canonical, type: 'string' as const, required: false }] }] };
      expect(validateDeclaration(bad).join(), canonical).toMatch(/never stored/);
    }
  });

  it('is the list the database refuses, word for word', () => {
    const sql = readFileSync(resolve(__dirname, '../../../../supabase/migrations/20260927190000_canonical_display.sql'), 'utf8');
    const listed = sql.match(/\(\^\|_\)\(([a-z_|?]+)\)\(_\|\$\)/)![1];
    // `grades?` is the SQL for "grade or grades".
    const words = listed.split('|').flatMap((w) => (w.endsWith('?') ? [w.slice(0, -1), w.slice(0, -2)] : [w]));
    for (const w of [...NEVER_INGEST, ...NEVER_DISPLAY]) {
      const base = w.replace(/s$/, '');
      expect(words.some((x) => x === w || x === base), w).toBe(true);
    }
  });
});

describe('ingest, academic', () => {
  it('maps tenant-wide facts with no subject', async () => {
    const r = await run([SIS_FIXTURES.term, SIS_FIXTURES.window, SIS_FIXTURES.section]);
    expect(r.status).toBe('succeeded');
    expect(r.references.map((x) => [x.canonicalEntity, x.subjectUserId, x.classification])).toEqual([
      ['term', null, 'T0'], ['registration_window', null, 'T0'], ['course_section', null, 'T0'],
    ]);
    expect(r.references[1].values).toMatchObject({ audience: 'Juniors', opens_at: '2026-11-02T13:00:00.000Z' });
  });

  it('ties an enrollment to its student, with consent', async () => {
    const r = await run([SIS_FIXTURES.enrollment]);
    expect(r.references[0]).toMatchObject({ canonicalEntity: 'enrollment', subjectUserId: 'u77', classification: 'T3',
      sourceOfTruth: 'Registrar / SIS' });
  });

  it('refuses a student’s records without consent', async () => {
    const r = await run([SIS_FIXTURES.enrollment, SIS_FIXTURES.hold],
      { store: memoryStore({ subjects: { 'sis-person-77': 'u77' } }) });
    expect(r.errors.map((e) => e.category)).toEqual(['consent_block', 'consent_block']);
  });

  it('keeps a hold’s office and link, and never its reason or amount', async () => {
    const r = await run([SIS_FIXTURES.hold]);
    expect(r.references[0].values).toEqual({
      office: 'Student Accounts', blocks_registration: true, action_url: 'https://accounts.example.edu/holds',
    });
    expect(JSON.stringify(r)).not.toContain('Balance past due');
    expect(JSON.stringify(r)).not.toContain('1250');
  });

  it('reads degree-audit status with the audit system as the source of truth', async () => {
    const r = await run([SIS_FIXTURES.requirement], { adapter: MOCK_DEGREE_AUDIT });
    expect(r.references[0]).toMatchObject({ canonicalEntity: 'academic_requirement', sourceOfTruth: 'Degree audit system',
      values: { name: 'Core: writing', status: 'in_progress' } });
  });

  it('refuses a grade that arrives inside an enrollment', async () => {
    const r = await run([{ ...SIS_FIXTURES.enrollment, fields: { ...SIS_FIXTURES.enrollment.fields, grade: 'A-' } }]);
    expect(r.errors[0].category).toBe('classification_block');
  });

  it('refuses personal records on a connection approved only to T0', async () => {
    const r = await run([SIS_FIXTURES.term, SIS_FIXTURES.enrollment], { connection: conn({ classificationCeiling: 'T3' }),
      adapter: { ...MOCK_SIS, classificationCeiling: 'T3' } });
    expect(r.created).toBe(2);
    const low = await run([SIS_FIXTURES.enrollment], {
      connection: conn({ classificationCeiling: 'T0' }), adapter: { ...MOCK_SIS, classificationCeiling: 'T0' } });
    expect(low.errors[0].category).toBe('classification_block');
  });

  it('refuses an enrollment status outside the enum and a window missing its dates', async () => {
    const r = await run([
      { ...SIS_FIXTURES.enrollment, fields: { ...SIS_FIXTURES.enrollment.fields, status: 'audit' } },
      { ...SIS_FIXTURES.window, fields: { term: '202710', audience: 'Juniors' } },
    ]);
    expect(r.errors.map((e) => e.category)).toEqual(['enum_mismatch', 'missing_required']);
  });
});
