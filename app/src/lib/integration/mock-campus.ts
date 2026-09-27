/**
 * Mock advising, career, campus-services and bursar providers, for the Phase 6
 * contract tests. Every one is `mock: true`. None is EAB, Handshake, Presence,
 * Rave, Workday or any real product, and none may be registered as one.
 *
 * What each is allowed to carry is the point of the file:
 *
 *   advising      appointment (when, which office, how, a prep link) and
 *                 referral (which office, its link) — the student's, T3.
 *                 Never an advisor's notes or the reason for a referral.
 *   career        internships, jobs and career events — tenant-wide, T0.
 *   events, orgs  campus events and organizations — tenant-wide, T0.
 *   library       services and study spaces — tenant-wide, T0.
 *   tutoring      tutoring services offered — tenant-wide, T0.
 *   calendar      the academic calendar — tenant-wide, T0.
 *   alerts        official campus alerts — tenant-wide, T0, 15-minute target.
 *   transit       route status — tenant-wide, T0.
 *   bursar        an action item: which office, a due date, its link — the
 *                 student's, T3. Never an amount, a balance or a reason; the
 *                 connector flag for it is high-risk and off.
 *
 * Health, counseling, disability, conduct and financial-aid feeds have no mock
 * here on purpose: there is no scope any of them could be approved for.
 */
import type { AdapterDeclaration, EntityMapping } from './adapter.ts';
import type { ProviderDomain } from './catalog.ts';
import type { ExternalRecord } from './pipeline.ts';

function mock(
  id: string,
  domain: ProviderDomain,
  provider: string,
  featureFlag: string,
  sourceOfTruth: string,
  freshnessTargetMinutes: number,
  entities: EntityMapping[],
): AdapterDeclaration {
  const personal = entities.some((e) => e.personal);
  return {
    id, domain, provider, product: 'Fixture 1.0', version: '1',
    authentication: 'oauth2',
    credentialsReference: `vault:sandbox/${id.replace(/_/g, '-')}`,
    scopes: [...new Set(entities.map((e) => e.scope))],
    classificationCeiling: personal ? 'T3' : 'T0',
    direction: 'read',
    modes: freshnessTargetMinutes <= 60 ? ['webhook', 'incremental_api'] : ['incremental_api', 'batch'],
    cursor: 'watermark',
    freshnessTargetMinutes,
    rateLimitPerMinute: 60,
    retry: { maxAttempts: 5, baseMs: 2_000, maxMs: 900_000 },
    deadLetter: 'table',
    sourceOfTruth,
    consentRequired: personal,
    retentionDays: personal ? 400 : 90,
    degradedStates: ['provider_unavailable', 'rate_limited', 'stale'],
    disconnect: 'revoke_token',
    auditEvents: ['connection.approved', 'scope.approved', 'sync.paused', 'sync.resumed', 'replay.requested'],
    featureFlag,
    killSwitch: 'kill.integration_sync',
    contractTests: ['app/src/lib/integration/mock-campus.test.ts'],
    entities,
    mock: true,
  };
}

const s = (external: string, canonical = external, required = true) =>
  ({ external, canonical, type: 'string' as const, required, transform: 'trim' as const });
const t = (external: string, canonical = external, required = true) =>
  ({ external, canonical, type: 'datetime' as const, required, transform: 'iso_datetime' as const });
const u = (external: string, canonical = 'source_url', required = false) =>
  ({ external, canonical, type: 'url' as const, required });
const e = (external: string, values: string[], canonical = external) =>
  ({ external, canonical, type: 'enum' as const, required: true, enumValues: values });

export const MOCK_ADVISING = mock('mock_advising', 'advising', 'Mock Advising', 'integration.advising_crm', 'Advising system', 60, [
  { externalEntity: 'appointment', canonicalEntity: 'appointment', version: 1, scope: 'scope.advising.appointment_read',
    classification: 'T3', personal: true,
    fields: [t('start', 'starts_at'), s('office'), e('mode', ['in_person', 'video', 'phone']), u('prep', 'prep_url')] },
  { externalEntity: 'referral', canonicalEntity: 'referral', version: 1, scope: 'scope.advising.referral_read',
    classification: 'T3', personal: true,
    fields: [s('to_office', 'office'), u('link', 'action_url', true), t('created', 'created_at')] },
]);

export const MOCK_CAREER = mock('mock_career', 'career', 'Mock Career', 'integration.career', 'Career office platform', 24 * 60, [
  { externalEntity: 'posting', canonicalEntity: 'internship', version: 1, scope: 'scope.career.posting_read',
    classification: 'T0', personal: false,
    fields: [s('title'), s('employer'), t('apply_by', 'deadline_at'), u('url')] },
]);

export const MOCK_EVENTS = mock('mock_events', 'events', 'Mock Events', 'integration.campus_services', 'Events calendar', 24 * 60, [
  { externalEntity: 'event', canonicalEntity: 'event', version: 1, scope: 'scope.events.event_read',
    classification: 'T0', personal: false,
    fields: [s('name', 'title'), t('start', 'starts_at'), s('where', 'location', false), u('url')] },
  { externalEntity: 'group', canonicalEntity: 'organization', version: 1, scope: 'scope.events.organization_read',
    classification: 'T0', personal: false,
    fields: [s('name'), u('url')] },
]);

/**
 * Room availability: free and busy slots per study space, on its own adapter
 * because it moves in minutes where the space list moves in days. Carries a
 * slot's space, start, end and free/busy — never who holds a busy slot.
 */
export const MOCK_SPACE_AVAILABILITY = mock('mock_space_availability', 'library', 'Mock Room Availability', 'integration.campus_services', 'Library room booking', 10, [
  { externalEntity: 'slot', canonicalEntity: 'space_availability', version: 1, scope: 'scope.library.availability_read',
    classification: 'T0', personal: false,
    fields: [s('space'), t('from', 'starts_at'), t('to', 'ends_at'), e('state', ['free', 'busy'], 'status'), u('book', 'book_url')] },
]);

/**
 * Booking a room on a student's behalf is a write to the school's system, so
 * it sits behind `writeback.space_booking` (high-risk, off, needs an approved
 * connection) and `kill.writeback`. It declares the contract only: there is no
 * code path that sends a booking, and `validateDeclaration` holds that any
 * write direction is behind a writeback flag with a kill switch.
 */
export const MOCK_SPACE_BOOKING = {
  ...mock('mock_space_booking', 'library', 'Mock Room Booking', 'writeback.space_booking', 'Library room booking', 10, []),
  scopes: ['scope.library.booking_write'],
  direction: 'approved_write' as const,
  killSwitch: 'kill.writeback',
};

export const MOCK_LIBRARY = mock('mock_library', 'library', 'Mock Library', 'integration.campus_services', 'Library', 24 * 60, [
  { externalEntity: 'space', canonicalEntity: 'study_space', version: 1, scope: 'scope.library.space_read',
    classification: 'T0', personal: false,
    // `quiet` feeds the sensory-friendly ordering on Support › Campus; a
    // provider that does not send it leaves every room unmarked, never guessed.
    fields: [s('name'), s('hours', 'hours', false), u('book_url'),
      { external: 'quiet', canonical: 'quiet', type: 'boolean' as const, required: false }] },
]);

export const MOCK_TUTORING = mock('mock_tutoring', 'tutoring', 'Mock Tutoring', 'integration.campus_services', 'Tutoring center', 24 * 60, [
  { externalEntity: 'service', canonicalEntity: 'service', version: 1, scope: 'scope.tutoring.service_read',
    classification: 'T0', personal: false,
    fields: [s('name'), s('subjects', 'subjects', false), u('book_url')] },
]);

export const MOCK_CALENDAR = mock('mock_calendar', 'calendar', 'Mock Academic Calendar', 'integration.campus_services', 'Registrar calendar', 24 * 60, [
  { externalEntity: 'date', canonicalEntity: 'calendar_event', version: 1, scope: 'scope.calendar.academic_read',
    classification: 'T0', personal: false,
    fields: [s('label', 'title'), t('on', 'starts_at'), u('url')] },
]);

export const MOCK_ALERTS = mock('mock_alerts', 'alerts', 'Mock Alerts', 'integration.campus_services', 'Campus alert system', 15, [
  { externalEntity: 'alert', canonicalEntity: 'notification', version: 1, scope: 'scope.alerts.alert_read',
    classification: 'T0', personal: false,
    fields: [e('level', ['info', 'advisory', 'emergency'], 'severity'), s('headline'), t('issued', 'issued_at'),
             t('expires', 'expires_at', false), u('url')] },
]);

export const MOCK_TRANSIT = mock('mock_transit', 'transit', 'Mock Transit', 'integration.campus_services', 'Transit provider', 15, [
  { externalEntity: 'route', canonicalEntity: 'service', version: 1, scope: 'scope.transit.route_read',
    classification: 'T0', personal: false,
    fields: [s('name'), e('status', ['running', 'delayed', 'suspended']), u('url')] },
]);

export const MOCK_BURSAR = mock('mock_bursar', 'bursar', 'Mock Bursar', 'integration.erp_bursar_actions', 'Bursar', 24 * 60, [
  { externalEntity: 'action_item', canonicalEntity: 'notification', version: 1, scope: 'scope.bursar.action_item_read',
    classification: 'T3', personal: true,
    fields: [s('office'), t('due', 'due_at', false), u('link', 'action_url', true)] },
]);

export const CAMPUS_ADAPTERS = [
  MOCK_ADVISING, MOCK_CAREER, MOCK_EVENTS, MOCK_LIBRARY, MOCK_TUTORING, MOCK_CALENDAR, MOCK_ALERTS, MOCK_TRANSIT, MOCK_BURSAR,
  MOCK_SPACE_AVAILABILITY,
];

const at = '2026-09-27T06:00:00Z';
export const CAMPUS_FIXTURES: Record<string, ExternalRecord> = {
  appointment: { entityType: 'appointment', id: 'apt-1', subject: 'crm-77', updatedAt: at,
    // `notes` is what a real CRM would send; the contract test proves it is refused.
    fields: { start: '2026-10-02T15:00:00Z', office: 'Academic Advising', mode: 'video',
              prep: 'https://advising.example.edu/prep' } },
  referral: { entityType: 'referral', id: 'ref-1', subject: 'crm-77', updatedAt: at,
    fields: { to_office: 'Writing Studio', link: 'https://writing.example.edu/book', created: '2026-09-26T12:00:00Z',
              reason: 'Struggling with thesis' } },
  posting: { entityType: 'posting', id: 'post-1', updatedAt: at,
    fields: { title: 'Policy research intern', employer: 'Example Institute', apply_by: '2026-10-10T23:59:00Z',
              url: 'https://careers.example.edu/p/1' } },
  event: { entityType: 'event', id: 'ev-1', updatedAt: at,
    fields: { name: 'Career fair', start: '2026-10-03T17:00:00Z', where: 'Student Center', url: 'https://events.example.edu/1' } },
  // `booked_by` is what a real booking system would send; the contract test
  // proves it never reaches a stored fact.
  slot: { entityType: 'slot', id: 'sl-1', updatedAt: at,
    fields: { space: 'Library room 214', from: '2026-09-27T14:00:00Z', to: '2026-09-27T16:00:00Z', state: 'busy',
              book: 'https://rooms.example.edu/214', booked_by: 'student@example.edu' } },
  alert: { entityType: 'alert', id: 'al-1', updatedAt: at,
    fields: { level: 'advisory', headline: 'Shuttle service suspended on West Loop', issued: '2026-09-27T05:50:00Z',
              expires: '2026-09-27T20:00:00Z', url: 'https://alerts.example.edu/1' } },
  bursar: { entityType: 'action_item', id: 'ai-1', subject: 'crm-77', updatedAt: at,
    fields: { office: 'Student Accounts', due: '2026-10-15T00:00:00Z', link: 'https://accounts.example.edu/action',
              amount: 1250, balance: 3100 } },
};
