/**
 * The advising, career, campus-services and bursar contract, run against the
 * mocks. A real adapter for any of these domains joins this file with its
 * provider's fixtures before it may be registered.
 */
import { describe, expect, it } from 'vitest';
import { validateDeclaration, type AdapterDeclaration } from './adapter';
import { memoryStore, mockBatch } from './mock-adapter';
import {
  CAMPUS_ADAPTERS, CAMPUS_FIXTURES, MOCK_ADVISING, MOCK_LIBRARY, MOCK_ALERTS, MOCK_BURSAR, MOCK_CAREER, MOCK_EVENTS, MOCK_TUTORING,
  MOCK_SPACE_AVAILABILITY, MOCK_SPACE_BOOKING,
} from './mock-campus';
import { ingest, type ConnectionState, type ExternalRecord } from './pipeline';
import { FLAGS } from '../flags';

const NOW = new Date('2026-09-27T12:00:00Z');
function run(adapter: AdapterDeclaration, records: ExternalRecord[], consent = true) {
  const connection: ConnectionState = {
    tenantId: 'vu', publicId: 'conn_campus0000000000000', status: 'healthy', approved: true,
    approvedScopes: adapter.scopes, classificationCeiling: adapter.classificationCeiling,
  };
  return ingest({
    adapter, connection, batch: mockBatch(records), killSwitchEngaged: false, now: NOW,
    store: memoryStore({ subjects: { 'crm-77': 'u77' }, consents: consent ? [`u77:integration:${connection.publicId}`] : [] }),
  });
}

describe('the campus adapters', () => {
  it('declare themselves validly, read-only, as mocks, within their domain ceilings', () => {
    for (const a of CAMPUS_ADAPTERS) {
      expect(validateDeclaration(a), a.id).toEqual([]);
      expect(a.direction, a.id).toBe('read');
      expect(a.mock, a.id).toBe(true);
    }
  });

  it('carry personal records only for advising and bursar, and ask consent for them', () => {
    const personal = CAMPUS_ADAPTERS.filter((a) => a.entities.some((e) => e.personal)).map((a) => a.id);
    expect(personal).toEqual(['mock_advising', 'mock_bursar']);
    for (const a of CAMPUS_ADAPTERS) expect(a.consentRequired, a.id).toBe(personal.includes(a.id));
  });

  it('sit behind a connector flag that is high-risk and off, bursar included', () => {
    for (const a of CAMPUS_ADAPTERS) {
      const flag = FLAGS.find((f) => f.key === a.featureFlag);
      expect(flag, a.id).toBeDefined();
      expect(flag!.highRisk, a.id).toBe(true);
      expect(flag!.defaultEnabled, a.id).toBe(false);
    }
  });

  it('refuse to be declared for anything sensitive', () => {
    const health: AdapterDeclaration = { ...MOCK_TUTORING, scopes: ['scope.tutoring.health_read'] };
    expect(validateDeclaration(health).join()).toMatch(/never ingested/);
    const notes: AdapterDeclaration = { ...MOCK_ADVISING, entities: [{ ...MOCK_ADVISING.entities[0],
      fields: [...MOCK_ADVISING.entities[0].fields, { external: 'advisor_comment', canonical: 'notes', type: 'string', required: false }] }] };
    expect(validateDeclaration(notes).join()).toMatch(/never stored/);
    const aid: AdapterDeclaration = { ...MOCK_BURSAR, scopes: [...MOCK_BURSAR.scopes, 'scope.bursar.financial_aid_read'] };
    expect(validateDeclaration(aid).join()).toMatch(/never ingested/);
  });

  it('cannot approve a campus-wide domain above its ceiling', () => {
    expect(validateDeclaration({ ...MOCK_EVENTS, classificationCeiling: 'T3' }).join()).toMatch(/above what events/);
  });
});

describe('ingest, campus', () => {
  it('keeps an appointment’s time, office, mode and prep link for its student', async () => {
    const r = await run(MOCK_ADVISING, [CAMPUS_FIXTURES.appointment]);
    expect(r.references[0]).toMatchObject({ canonicalEntity: 'appointment', subjectUserId: 'u77', classification: 'T3',
      values: { starts_at: '2026-10-02T15:00:00.000Z', office: 'Academic Advising', mode: 'video',
                prep_url: 'https://advising.example.edu/prep' } });
  });

  it('refuses an appointment that carries an advisor’s notes', async () => {
    const r = await run(MOCK_ADVISING, [{ ...CAMPUS_FIXTURES.appointment,
      fields: { ...CAMPUS_FIXTURES.appointment.fields, instructor_notes: 'Worried about workload' } }]);
    expect(r.errors[0].category).toBe('classification_block');
  });

  it('keeps a referral’s office and link and drops its reason', async () => {
    const r = await run(MOCK_ADVISING, [CAMPUS_FIXTURES.referral]);
    expect(r.references[0].values).toEqual({ office: 'Writing Studio', action_url: 'https://writing.example.edu/book',
      created_at: '2026-09-26T12:00:00.000Z' });
    expect(JSON.stringify(r)).not.toContain('thesis');
  });

  it('needs consent for advising and bursar records', async () => {
    const r = await run(MOCK_ADVISING, [CAMPUS_FIXTURES.appointment], false);
    expect(r.errors[0].category).toBe('consent_block');
    const b = await run(MOCK_BURSAR, [CAMPUS_FIXTURES.bursar], false);
    expect(b.errors[0].category).toBe('consent_block');
  });

  it('keeps a bursar action’s office, due date and link, never an amount or balance', async () => {
    const r = await run(MOCK_BURSAR, [CAMPUS_FIXTURES.bursar]);
    expect(r.references[0].values).toEqual({ office: 'Student Accounts', due_at: '2026-10-15T00:00:00.000Z',
      action_url: 'https://accounts.example.edu/action' });
    expect(JSON.stringify(r)).not.toMatch(/1250|3100/);
  });

  it('reads career, events and alerts as tenant-wide facts', async () => {
    const career = await run(MOCK_CAREER, [CAMPUS_FIXTURES.posting]);
    expect(career.references[0]).toMatchObject({ canonicalEntity: 'internship', subjectUserId: null, classification: 'T0' });
    const alert = await run(MOCK_ALERTS, [CAMPUS_FIXTURES.alert]);
    expect(alert.references[0]).toMatchObject({ canonicalEntity: 'notification', subjectUserId: null,
      sourceOfTruth: 'Campus alert system', values: { severity: 'advisory' } });
  });

  it('reads room availability as tenant-wide free/busy, and never who booked', async () => {
    const r = await run(MOCK_SPACE_AVAILABILITY, [CAMPUS_FIXTURES.slot]);
    expect(r.references[0]).toMatchObject({ canonicalEntity: 'space_availability', subjectUserId: null, classification: 'T0',
      values: { status: 'busy', space: 'Library room 214' } });
    expect(JSON.stringify(r.references)).not.toContain('student@example.edu');
  });

  it('keeps a study space’s quiet flag, which sensory-friendly ordering reads', async () => {
    const space = { entityType: 'space', id: 'sp-1', updatedAt: '2026-09-27T06:00:00Z',
      fields: { name: 'Quiet room', book_url: 'https://rooms.example.edu/q', quiet: true } };
    const r = await run(MOCK_LIBRARY, [space]);
    expect(r.references[0]).toMatchObject({ canonicalEntity: 'study_space', values: { name: 'Quiet room', quiet: true } });
  });

  it('declares room booking as a gated write that nothing sends', () => {
    expect(validateDeclaration(MOCK_SPACE_BOOKING)).toEqual([]);
    expect(MOCK_SPACE_BOOKING).toMatchObject({ direction: 'approved_write', featureFlag: 'writeback.space_booking', killSwitch: 'kill.writeback' });
    // The control for validateDeclaration: the same write without its writeback flag is refused.
    expect(validateDeclaration({ ...MOCK_SPACE_BOOKING, featureFlag: 'integration.campus_services' }).join()).toMatch(/writeback/);
    const f = FLAGS.find((x) => x.key === 'writeback.space_booking')!;
    expect(f).toMatchObject({ highRisk: true, needsConnection: true, defaultEnabled: false });
    expect(f.killSwitches).toContain('kill.writeback');
  });

  it('refuses an alert level it does not know rather than guessing one', async () => {
    const r = await run(MOCK_ALERTS, [{ ...CAMPUS_FIXTURES.alert, fields: { ...CAMPUS_FIXTURES.alert.fields, level: 'critical' } }]);
    expect(r.errors[0].category).toBe('enum_mismatch');
  });
});
