/**
 * Governance joined to the existing rollout inventory, without changing its
 * identities or evidence. Product maturity is not a tenant activation decision.
 * Profiles describe required controls; they never assert those controls are met.
 */
import { CAPABILITIES, type CapabilityState, type RolloutCapability } from '../rollout-capabilities';
import { DOMAINS, REGISTER, type Domain } from '../masterregister';
import { SEATS, type Seat } from '../launchreadiness';
import { PRIMITIVE_IDS, type PrimitiveId } from './constitution';

export const MATURITY_LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9'] as const;
export type MaturityLevel = `L${0|1|2|3|4|5|6|7|8|9}`;
export const MATURITY_MEANINGS: Record<MaturityLevel, string> = {
  L0: 'Vision: product thesis only.',
  L1: 'Designed: approved requirements, boundaries, threat model, data model, UX and policy.',
  L2: 'Built: code, schema, configuration, permissions and interfaces exist.',
  L3: 'Verified: required automated, manual, security, accessibility, failure, load and migration tests pass.',
  L4: 'Institution-ready: support, documentation, governance, evidence, training, monitoring, rollback and implementation materials exist.',
  L5: 'Tenant-approved: one tenant has current contract, scope, configuration, data map and accountable approvals.',
  L6: 'Parallel run: operates beside the authoritative system and reconciles outcomes.',
  L7: 'Bounded system of record: authoritative for one explicitly scoped workflow.',
  L8: 'Tenant GA: the agreed institutional population is operationally supported.',
  L9: 'Repeatable: activation is reusable across institutions with tested templates and evidence.',
};
export const ACTIVATION_CLASSES = ['standard', 'controlled', 'high-risk'] as const;
export type ActivationClass = 'standard' | 'controlled' | 'high-risk';
export const ACTIVATION_MEANINGS: Record<ActivationClass, string> = {
  standard: 'Reversible personal planning, study or creation; ordinary authorization, policy, flag and entitlement checks still apply.',
  controlled: 'Institutional reads, AI assistance, sharing, personal exports, connected communications or campus-service workflows require scoped policy, current evidence, ownership, monitoring, support and approved rollout.',
  'high-risk': 'Family record access, money, transactions, contracts and official writes require the complete domain-specific activation contract. A flag or entitlement alone is insufficient; broad institutional exports and autonomous writes require separately governed high-risk operations.',
};
export type DataAuthority = 'student' | 'semester' | 'institution' | 'external-provider' | 'shared';
export interface DataRule {
  classification: string;
  authority: DataAuthority;
  purpose: string;
  retention: string;
}

/** The nine contract categories in the approved design, required rather than met. */
export const HIGH_RISK_REQUIREMENTS = [
  'agreement', 'dataMap', 'authorization', 'accessibility', 'integration',
  'recovery', 'operations', 'rollout', 'claims',
] as const;
export type HighRiskRequirements = Record<(typeof HIGH_RISK_REQUIREMENTS)[number], string>;

export interface CapabilityProfile {
  domain: Domain;
  /** Only standard activation may use this declared personal default without tenant configuration. */
  safeDefaultEligible: boolean;
  primitives: readonly PrimitiveId[];
  data: readonly DataRule[];
  accessibility: string;
  fallback: string;
  supportOwner: Seat;
  lifecycle: string;
  highRiskRequirements?: HighRiskRequirements;
}
export interface CapabilityPolicy {
  profile: keyof typeof CAPABILITY_PROFILES;
  activationClass: ActivationClass;
  masterRows: readonly string[];
  requiredClaims: string;
  maturity?: MaturityLevel;
}
export interface CapabilityDefinition extends RolloutCapability, CapabilityProfile {
  maturity: MaturityLevel;
  activationClass: ActivationClass;
  masterRows: readonly string[];
  requiredClaims: string;
}

const PERSONAL_RETENTION = 'docs/DATA-RETENTION-EXPORT-DELETION.md';
const INSTITUTION_RETENTION = 'docs/DATA-PORTABILITY-AND-OFFBOARDING.md';
const data = (classification: string, authority: DataAuthority, purpose: string, retention = PERSONAL_RETENTION): DataRule => ({ classification, authority, purpose, retention });
const personalPrimitives: readonly PrimitiveId[] = ['data-provenance', 'action-workflow', 'experience-accessibility'];
const connectedPrimitives: readonly PrimitiveId[] = ['identity-tenancy', 'permission-consent-authority', 'data-provenance', 'integration-gateway', 'trust-evidence', 'experience-accessibility'];
const accessible = 'Keyboard and screen-reader completion, visible focus, mobile reflow, reduced motion and a text alternative are release criteria; expose errors and saved status without color alone.';
const personalLifecycle = 'Preserve student work until explicit deletion; support export and recovery before migration or retirement; follow the retention reference for server records and disclose device-only storage.';
const institutionLifecycle = 'Keep disabled until the scoped tenant approval and source mapping are current; pause on stale authority or unhealthy integration; revoke access and execute approved export, archive and deletion at offboarding.';
function personal(domain: Domain, rules: readonly DataRule[], fallback: string, primitives = personalPrimitives, supportOwner: Seat = 'success'): CapabilityProfile {
  return { domain, safeDefaultEligible: true, primitives, data: rules, accessibility: accessible, fallback, supportOwner, lifecycle: personalLifecycle };
}
function connected(domain: Domain, rules: readonly DataRule[], fallback: string, supportOwner: Seat = 'data'): CapabilityProfile {
  return { domain, safeDefaultEligible: false, primitives: connectedPrimitives, data: rules, accessibility: accessible, fallback, supportOwner, lifecycle: institutionLifecycle };
}
/** Shared contract mechanics retain a domain-specific authorization and test boundary. */
function highRisk(subject: string, authorization: string, integration: string, recovery: string, support: string): HighRiskRequirements {
  return {
    agreement: `Require executed agreement, DPA, scoped statement of work and named institutional and Semester owners for ${subject}; reapprove after scope or contract changes.`,
    dataMap: `Approve the ${subject} data map: authority, classification, minimum purpose, retention, correction, export and offboarding; review source and policy versions before activation and after changes.`,
    authorization,
    accessibility: `Verify ${subject} with keyboard, screen reader and mobile UAT, an accessible confirmation and receipt, and an official human fallback; renew evidence after workflow changes.`,
    integration,
    recovery,
    operations: `Before enabling ${subject}, name ${support}, approve monitoring, SLOs, alert routing, incident contacts and support coverage; exercise the kill switch and renew evidence after adapter or policy changes.`,
    rollout: `Train staff for ${subject}, collect tenant UAT, stage the rollout and obtain signed go-live authorization for the exact version and scope; expired approvals block activation.`,
    claims: `Review the Product Status Map and public claims for ${subject} against current evidence and actual tenant activation; renew review after maturity, scope or operational changes.`,
  };
}

export const CAPABILITY_PROFILES = {
  planning: personal('STU', [data('Private personal academic plans and completion records', 'student', 'Help the student decide and revise their own next action.')], 'Keep the last saved personal plan visible with freshness; allow manual edits and refer official deadline disputes to the course source.'),
  timers: personal('STU', [data('Private device timer preferences and sessions', 'student', 'Run cancellable personal reminders without promising background delivery.')], 'Show remaining time as text and recommend a device alarm when the browser cannot deliver.'),
  identity: connected('IAM', [data('Restricted account identifiers, tenant membership and recovery metadata', 'shared', 'Authenticate the account and verify tenant membership with the authoritative identity provider.')], 'Expose local versus signed-in state; use verified account recovery or institutional identity support without granting new access.', 'engineering'),
  links: personal('UOS', [data('Private saved links and public campus URLs', 'student', 'Organize references the student chose to save.')], 'Keep saved URLs copyable and open the official service directly; do not infer authentication from a link.'),
  integration: connected('INT', [data('Restricted provider grants, scopes and source synchronization metadata', 'external-provider', 'Connect only the approved source and permissions; record freshness and disconnection.', INSTITUTION_RETENTION)], 'Display disconnected or stale status and hand off to the official provider; stop writes and revoke grants on disconnect.'),
  dataRights: connected('TRUST', [data('Restricted personal data inventory, consent and rights-request records', 'student', 'Explain stored data and exercise scoped access, correction, consent and deletion rights.')], 'Explain uncovered device or provider data and route unresolved rights requests to the privacy owner; never report an incomplete deletion as complete.', 'privacy'),
  export: personal('TRUST', [data('Restricted student-owned export archives and restore metadata', 'student', 'Create and validate a student-requested personal backup or portable export.')], 'Retain the original data and report missing device files or invalid versions; restore only after validation and confirmation.', ['permission-consent-authority', 'data-provenance', 'action-workflow', 'trust-evidence', 'experience-accessibility'], 'engineering'),
  settings: personal('UX', [data('Private interface, notification and learning preferences', 'student', 'Apply explicitly selected accessible personal preferences without inferring sensitive traits.')], 'Restore accessible defaults while preserving work and expose a keyboard-accessible reset.'),
  alerts: connected('STU', [data('Private notification preferences, deadline references and delivery metadata', 'shared', 'Deliver opted-in, deduplicated reminders with honest delivery state.')], 'Keep deadlines visible in Plan and state that browser alerts are not guaranteed; offer device reminders.', 'operations'),
  help: personal('SUP', [data('Public help content and private user-selected troubleshooting context', 'semester', 'Explain product limitations and route support without automatically disclosing student records.')], 'Provide readable troubleshooting and an accessible support route with known ownership and response limits.', ['experience-accessibility', 'trust-evidence'], 'success'),
  courses: personal('STU', [data('Private course copies, assignments, dates and student-entered grades', 'student', 'Organize personal coursework; the course or LMS remains authoritative for official instructions and grades.')], 'Show source, previous value and freshness; permit correction of the personal copy and use the official course or instructor for disputed records.'),
  ingestion: personal('STU', [data('Private uploaded syllabus and reading content with source citations', 'student', 'Extract or organize material the student is authorized to supply, with review before saving.')], 'Keep the original material accessible and allow manual entry if extraction fails; flag uncertain dates and policies for confirmation.', ['data-provenance', 'policy-rules', 'action-workflow', 'experience-accessibility']),
  learning: personal('STU', [data('Private study material, practice attempts and learning evidence', 'student', 'Support formative practice within course policy without issuing official grades.')], 'Retain saved notes and attempts; show the original source and manual practice when generation or scoring is unavailable.', ['data-provenance', 'policy-rules', 'action-workflow', 'experience-accessibility']),
  assistant: personal('AI', [data('Restricted authorized source excerpts, prompts and assistant drafts', 'student', 'Provide source-grounded academic assistance under course and institution policy; never authorize autonomous writes.')], 'Refuse unsupported answers, expose missing or stale sources and return the student to source material or a human instructor.', ['permission-consent-authority', 'data-provenance', 'policy-rules', 'trust-evidence', 'experience-accessibility'], 'product'),
  creation: personal('STU', [data('Private student-authored documents, datasets, media and version history', 'student', 'Create and revise personal work; preserve provenance and require an explicit choice for export or sharing.')], 'Preserve the editable original, show unsupported formats and provide plain-text or tabular alternatives before export.'),
  sources: personal('TRUST', [data('Private citation metadata, quotations and reference relationships', 'student', 'Attribute source material and distinguish cited evidence from unsupported generated claims.')], 'Keep original citations and quotations visible; permit manual corrections and disclose incomplete export metadata.', ['data-provenance', 'trust-evidence', 'experience-accessibility']),
  files: personal('STU', [data('Private original uploads, notes, file metadata and recoverable trash', 'student', 'Preserve student-owned originals with stable identity, explicit download and recoverable deletion.')], 'Keep originals downloadable and show unavailable previews or sync gaps; recover from Trash before permanent deletion.', ['permission-consent-authority', 'data-provenance', 'action-workflow', 'experience-accessibility']),
  campus: connected('UOS', [data('Public campus service information and restricted scoped service records', 'institution', 'Discover approved services and prepare bounded requests with authority and freshness.', INSTITUTION_RETENTION)], 'Show source and freshness; use the official service or named campus office when data, authority or the adapter is unavailable.'),
  degree: connected('STU', [data('Restricted degree requirements, course mappings and personal what-if plans', 'shared', 'Compare a personal plan against an approved catalog without certifying completion.', INSTITUTION_RETENTION)], 'Label estimates and incomplete mappings; refer certification, exceptions and official audits to the registrar or advisor.'),
  registrar: connected('STU', [data('Public authoritative term dates and private personal reminders', 'institution', 'Show registrar dates with source and freshness without changing enrollment.', INSTITUTION_RETENTION)], 'Open the official registrar calendar and ask the registrar about conflicting or missing dates.'),
  maps: personal('UOS', [data('Public campus places and private student-selected schedule locations', 'student', 'Calculate approximate departure guidance without tracking location history.')], 'Provide textual building and route instructions and the official accessibility route service; disclose unavailable or estimated routing.'),
  career: personal('UOS', [data('Private experience, relationship, application and lifecycle planning records', 'student', 'Prepare student-controlled plans and truthful opportunity materials without inferred eligibility or automatic submission.')], 'Keep drafts and checklists local and editable; refer official eligibility, recommendation and application decisions to the responsible office.'),
  communication: connected('UOS', [data('Restricted participant membership, messages, meeting permissions and delivery metadata', 'shared', 'Communicate only with authorized members or explicitly confirmed recipients through an approved provider.', INSTITUTION_RETENTION)], 'Retain unsent drafts, expose connection and delivery status, and use the official mail, meeting or course channel; never turn sample messages into delivery claims.', 'trust'),
  family: {
    ...connected('UOS', [data('Restricted education-record categories and supporter consent grants', 'shared', 'Expose only explicitly authorized categories to a verified supporter for an approved purpose.', INSTITUTION_RETENTION)], 'Deny unavailable, expired or revoked access and refer the supporter to the institution consent office.', 'privacy'),
    primitives: PRIMITIVE_IDS,
    highRiskRequirements: highRisk('supporter education-record access',
      'Verify the supporter relationship, tenant, purpose and category-specific consent; enforce expiry and immediate revocation, separate student authorization from support administration and audit each disclosure.',
      'Test sandbox identity mapping, category filtering, revocation races, duplicate grants, denied reads, audit receipts and reconciliation against the institution consent record; renew security evidence after identity or policy changes.',
      'Parallel-run consent and disclosure decisions; migrate only approved grants, roll back to deny access, archive required access evidence and prove last-known-good recovery without restoring revoked grants.', 'privacy and institutional records support'),
  },
  finance: {
    ...connected('UOS', [data('Restricted bursar charges, aid summaries and financial ledger records', 'institution', 'Explain authorized balances and costs without calculating awards or storing payment credentials.', INSTITUTION_RETENTION)], 'Stop transactions, label balances as stale and route disputes or payment to the official bursar or financial-aid office.', 'finance'),
    primitives: PRIMITIVE_IDS,
    highRiskRequirements: highRisk('bursar and financial-aid records and transactions',
      'Approve tenant and purpose-scoped finance roles, verified payer authority and required consent; separate ledger preparation, approval and reconciliation and preview every consequential transaction.',
      'Validate sandbox ledger mappings, currencies and signed source balances; test security, idempotency, concurrency, duplicate charges, partial failure, transaction receipts and ledger reconciliation before any financial write.',
      'Rehearse migration and parallel ledger reconciliation; retain required financial archives, use approved compensating entries rather than deleting posted transactions, and prove rollback and last-known-good recovery.', 'finance and bursar incident support'),
  },
  dining: {
    ...connected('UOS', [data('Restricted dining entitlement, balance and scoped transaction records', 'institution', 'Explain plan usage and projections using approved campus-card data without storing payment credentials or inventing purchases.', INSTITUTION_RETENTION)], 'Label projections as estimates, stop balance-changing actions and use the official dining or campus-card office.', 'success'),
    primitives: PRIMITIVE_IDS,
    highRiskRequirements: highRisk('meal-plan entitlements and transactions',
      'Verify cardholder identity, tenant, meal-plan scope and purpose; separate balance adjustments from reconciliation, obtain explicit confirmation for transactions and prevent unrelated purchase-history disclosure.',
      'Validate sandbox dining transaction and entitlement mapping; test security, duplicate swipes, idempotency, concurrent balance use, interrupted transactions and reconciliation with the campus-card ledger.',
      'Parallel-run balance and entitlement reconciliation; migrate only approved records, archive required receipts, test transaction reversal with dining staff and recover the last-known-good balance without double credit.', 'dining and campus-card support'),
  },
  housing: {
    ...connected('UOS', [data('Restricted housing preferences, allocation and contract records', 'institution', 'Support approved housing choices and move plans without exposing incidents or location histories.', INSTITUTION_RETENTION)], 'Preserve preferences, stop contract or allocation actions and hand off to the official housing office.', 'success'),
    primitives: PRIMITIVE_IDS,
    highRiskRequirements: highRisk('housing allocation and contract workflows',
      'Verify tenant eligibility, purpose and housing roles; separate contract preparation from approval, require explicit acceptance of the exact contract version and restrict roommate and allocation disclosures.',
      'Validate sandbox room and contract mappings; test security, idempotency, competing room allocations, duplicate acceptance, partial failures and signed contract or allocation reconciliation.',
      'Parallel-run assignments and contract versions; rehearse migration, archive signed versions, obtain housing approval for rollback or cancellation and restore last-known-good state without silently voiding a contract.', 'housing contracts and residence support'),
  },
  registration: {
    ...connected('STU', [data('Restricted eligibility, holds, enrollment and registration transaction records', 'institution', 'Prepare schedules and perform only separately approved official SIS registration operations.', INSTITUTION_RETENTION)], 'Stop registration writes, preserve the proposed schedule and hand off to the official SIS or registrar; never infer enrollment from a pending request.', 'data'),
    primitives: PRIMITIVE_IDS,
    highRiskRequirements: highRisk('official SIS registration',
      'Verify student identity, tenant, registration window, holds and scoped write authority; separate override approval from execution and require an explicit preview and confirmation of official enrollment changes.',
      'Validate sandbox SIS course and section mappings; test security, idempotency, concurrent seat claims, prerequisites, duplicate submissions, partial add/drop failures, receipts and authoritative enrollment reconciliation.',
      'Rehearse enrollment migration and a reconciled parallel run; archive transaction receipts, test registrar-approved rollback and last-known-good recovery, and never retry an ambiguous write before reconciliation.', 'registrar and integration incident support'),
  },
} satisfies Record<string, CapabilityProfile>;

/** Explicit policy keys preserve the original inventory and make every binding reviewable. */
export const CAPABILITY_POLICIES = {
  'CAP-001': { profile: 'planning', activationClass: 'standard', masterRows: ['STU-001'], requiredClaims: 'Personal Today view of recorded work; no institutional priority or outcome guarantee.' },
  'CAP-002': { profile: 'planning', activationClass: 'standard', masterRows: ['STU-001', 'TRUST-004'], requiredClaims: 'Summaries of recorded activity only; no fabricated productivity or academic-outcome score.' },
  'CAP-003': { profile: 'planning', activationClass: 'controlled', masterRows: ['STU-010', 'INT-011'], requiredClaims: 'Partial calendar with source-aware dates; connected feeds require their own approved configuration.' },
  'CAP-004': { profile: 'planning', activationClass: 'standard', masterRows: ['STU-010'], requiredClaims: 'Editable personal exam plan; no guarantee of readiness or exam results.' },
  'CAP-005': { profile: 'planning', activationClass: 'standard', masterRows: ['STU-001', 'STU-010'], requiredClaims: 'Seven-day view from recorded schedule and workload; missing events remain missing.' },
  'CAP-006': { profile: 'planning', activationClass: 'standard', masterRows: ['STU-002'], requiredClaims: 'Student-controlled recovery planning and explicit tradeoffs; no clinical or predictive-risk decision.' },
  'CAP-007': { profile: 'planning', activationClass: 'standard', masterRows: ['STU-001'], requiredClaims: 'Editable short personal plan from stated inputs; estimates are not obligations.' },
  'CAP-008': { profile: 'timers', activationClass: 'standard', masterRows: ['STU-010'], requiredClaims: 'Cancellable browser timers with stated background and alarm delivery limits.' },
  'CAP-009': { profile: 'planning', activationClass: 'standard', masterRows: ['STU-011', 'TRUST-004'], requiredClaims: 'Progress and grade estimates from recorded inputs; no official grade certification.' },
  'CAP-010': { profile: 'identity', activationClass: 'controlled', masterRows: ['IAM-001', 'IAM-002'], requiredClaims: 'Partial account and recovery experience; distinguish device data, cloud state and institutional identity.' },
  'CAP-011': { profile: 'identity', activationClass: 'controlled', masterRows: ['IAM-002', 'STU-011'], requiredClaims: 'Account-owned profile fields; a selected institution does not prove verified membership.' },
  'CAP-012': { profile: 'links', activationClass: 'standard', masterRows: ['UOS-002'], requiredClaims: 'Saved campus and personal links; a link is not an active provider integration.' },
  'CAP-013': { profile: 'integration', activationClass: 'controlled', masterRows: ['INT-001', 'INT-014'], requiredClaims: 'Connection configuration is blocked pending credentials and approval; no live sync claim.' },
  'CAP-014': { profile: 'dataRights', activationClass: 'controlled', masterRows: ['STU-011', 'TRUST-001', 'TRUST-002'], requiredClaims: 'Partial data and health visibility; disclose records and operational signals not covered.' },
  'CAP-015': { profile: 'dataRights', activationClass: 'controlled', masterRows: ['STU-011', 'SEC-008'], requiredClaims: 'Available privacy controls with explicit deletion and consent gaps; no compliance certification.' },
  'CAP-016': { profile: 'export', activationClass: 'controlled', masterRows: ['STU-011', 'MIG-006'], requiredClaims: 'Personal export and restore tools with format and device-file limits; no complete institutional export claim.' },
  'CAP-017': { profile: 'settings', activationClass: 'standard', masterRows: ['UX-001', 'A11Y-003'], requiredClaims: 'Explicit personal settings; preferences do not grant additional institutional permissions.' },
  'CAP-018': { profile: 'alerts', activationClass: 'controlled', masterRows: ['STU-010', 'SRE-001'], requiredClaims: 'Partial deduplicated reminders with visible delivery limits; no guaranteed notification delivery.' },
  'CAP-019': { profile: 'help', activationClass: 'standard', masterRows: ['STU-012', 'SUP-001'], requiredClaims: 'Help and documented limitations; support availability must match staffed coverage.' },
  'CAP-020': { profile: 'courses', activationClass: 'standard', masterRows: ['STU-006', 'TRUST-001'], requiredClaims: 'Personal source-aware course hub; no native-LMS replacement or official grade-write authority.' },
  'CAP-021': { profile: 'courses', activationClass: 'standard', masterRows: ['STU-002', 'TRUST-001'], requiredClaims: 'Partial personal assignment workflow; no official submission, grading or system-of-record authority.' },
  'CAP-022': { profile: 'ingestion', activationClass: 'controlled', masterRows: ['STU-006', 'AI-005'], requiredClaims: 'Cited syllabus extraction with confirmation; parsing is fallible and does not amend official course policy.' },
  'CAP-023': { profile: 'courses', activationClass: 'standard', masterRows: ['STU-006', 'TRUST-001'], requiredClaims: 'Correction of the student course copy; no changes to the official course or gradebook.' },
  'CAP-024': { profile: 'courses', activationClass: 'standard', masterRows: ['STU-010', 'TRUST-001'], requiredClaims: 'Source-preserving personal date reconciliation; official deadlines remain with the instructor or registrar.' },
  'CAP-025': { profile: 'learning', activationClass: 'controlled', masterRows: ['AI-001', 'AI-007'], requiredClaims: 'Partial source-grounded study tools within course policy; no official assessment or learning guarantee.' },
  'CAP-026': { profile: 'learning', activationClass: 'controlled', masterRows: ['AI-004', 'AI-005'], requiredClaims: 'Source-based concept comparisons; related material is not proof of equivalency or transfer credit.' },
  'CAP-027': { profile: 'assistant', activationClass: 'controlled', masterRows: ['AI-001', 'AI-004', 'AI-005', 'AI-006'], requiredClaims: 'Partial source-grounded assistant with policy and uncertainty disclosure; no autonomous writes or consequential decisions.' },
  'CAP-028': { profile: 'ingestion', activationClass: 'controlled', masterRows: ['AI-004', 'TRUST-001'], requiredClaims: 'User-supplied reading ingestion with source attribution; no claim of licensed institutional library access.' },
  'CAP-029': { profile: 'learning', activationClass: 'controlled', masterRows: ['AI-007', 'AI-011'], requiredClaims: 'Formative generated practice and hints; fallible feedback is not an official grade.' },
  'CAP-030': { profile: 'learning', activationClass: 'controlled', masterRows: ['AI-007', 'AI-011'], requiredClaims: 'Personal practice exams and review; no proctoring, certification or gradebook passback.' },
  'CAP-031': { profile: 'creation', activationClass: 'standard', masterRows: ['STU-002', 'UX-001'], requiredClaims: 'Partial personal creation workspace; linked tools retain their own export and sharing boundaries.' },
  'CAP-032': { profile: 'creation', activationClass: 'controlled', masterRows: ['TRUST-004', 'AI-005'], requiredClaims: 'Transparent local CSV summaries; any AI explanation is optional, source-bound and fallible.' },
  'CAP-033': { profile: 'creation', activationClass: 'standard', masterRows: ['A11Y-002', 'TRUST-004'], requiredClaims: 'Partial editable graphs and described diagrams; mathematical and visual limitations remain disclosed.' },
  'CAP-034': { profile: 'creation', activationClass: 'controlled', masterRows: ['STU-002', 'A11Y-002'], requiredClaims: 'Partial deck editing and supported PPTX export; disclose fidelity and accessibility limitations.' },
  'CAP-035': { profile: 'creation', activationClass: 'controlled', masterRows: ['STU-002', 'A11Y-002'], requiredClaims: 'Partial document editing with supported output; no unsupported DOCX or PDF fidelity guarantee.' },
  'CAP-036': { profile: 'creation', activationClass: 'controlled', masterRows: ['STU-002', 'TRUST-004'], requiredClaims: 'Partial spreadsheet editing and supported exports; disclose formula and format limitations.' },
  'CAP-037': { profile: 'creation', activationClass: 'controlled', masterRows: ['A11Y-002', 'STU-002'], requiredClaims: 'Structured mathematical notation and explicit export; rendering is not verification of mathematical correctness.' },
  'CAP-038': { profile: 'sources', activationClass: 'controlled', masterRows: ['TRUST-001', 'AI-005'], requiredClaims: 'Reference and quotation tracking with honest BibTeX export; metadata is not independent source verification.' },
  'CAP-039': { profile: 'assistant', activationClass: 'controlled', masterRows: ['AI-005', 'AI-007'], requiredClaims: 'Factual personal writing assistance requiring author review; no invented experience or automatic submission.' },
  'CAP-040': { profile: 'files', activationClass: 'controlled', masterRows: ['IAM-009', 'INT-012'], requiredClaims: 'Partial personal file and notes storage with explicit local, sync and recovery limits.' },
  'CAP-041': { profile: 'family', activationClass: 'high-risk', masterRows: ['UOS-007', 'SEC-009', 'IAM-007'], requiredClaims: 'Partial revocable supporter-sharing controls; institutional record access requires verified relationship, consent and tenant activation.' },
  'CAP-042': { profile: 'planning', activationClass: 'standard', masterRows: ['STU-010', 'UOS-002'], requiredClaims: 'Partial personal athletics and academic conflict planning; no eligibility certification or health decision.' },
  'CAP-043': { profile: 'campus', activationClass: 'controlled', masterRows: ['UOS-002', 'INT-001'], requiredClaims: 'Campus-service integration remains blocked; service discovery does not authorize downstream financial, housing or registration writes.' },
  'CAP-044': { profile: 'degree', activationClass: 'controlled', masterRows: ['STU-003', 'STU-004'], requiredClaims: 'Partial degree what-if planning with approved-source gaps; no certification of graduation or transfer equivalency.' },
  'CAP-045': { profile: 'registrar', activationClass: 'controlled', masterRows: ['STU-010', 'TRUST-002'], requiredClaims: 'Partial source-aware term deadlines pending authoritative feed; verify dates with the registrar.' },
  'CAP-046': { profile: 'finance', activationClass: 'high-risk', masterRows: ['UOS-002', 'INT-001', 'SEC-006'], requiredClaims: 'Partial sourced cost explanations only; no official balance, aid award, payment or ledger authority without approved adapters and activation.' },
  'CAP-047': { profile: 'dining', activationClass: 'high-risk', masterRows: ['UOS-002', 'INT-001', 'TRUST-004'], requiredClaims: 'Partial meal-plan estimates; no live balance or transaction claim without approved campus-card integration and activation.' },
  'CAP-048': { profile: 'housing', activationClass: 'high-risk', masterRows: ['UOS-002', 'INT-001', 'SEC-006'], requiredClaims: 'Partial housing preferences and move planning; no binding contract or room-allocation claim without approved activation.' },
  'CAP-049': { profile: 'maps', activationClass: 'standard', masterRows: ['UOS-001', 'A11Y-002'], requiredClaims: 'Partial campus search and estimated departure guidance; no continuous tracking or guaranteed accessible route.' },
  'CAP-050': { profile: 'registration', activationClass: 'high-risk', masterRows: ['STU-005', 'STU-007', 'INT-009'], requiredClaims: 'Official registration is blocked; planning and validation do not enroll a student or prove SIS write authority.' },
  'CAP-051': { profile: 'campus', activationClass: 'controlled', masterRows: ['UOS-003', 'TRUST-005'], requiredClaims: 'Organization and event integration is blocked pending approved sources; do not present sample events as live.' },
  'CAP-052': { profile: 'career', activationClass: 'controlled', masterRows: ['UOS-004', 'UOS-007'], requiredClaims: 'Partial relationship tracking and reviewed recommendation-request drafts; no automatic sending or implied recommender consent.' },
  'CAP-053': { profile: 'career', activationClass: 'standard', masterRows: ['STU-003', 'UOS-006'], requiredClaims: 'Partial student-controlled lifecycle planning; official admissions, immigration and transfer decisions remain external.' },
  'CAP-054': { profile: 'career', activationClass: 'standard', masterRows: ['UOS-004'], requiredClaims: 'Partial student-maintained career records; experience and credentials are not independently verified.' },
  'CAP-055': { profile: 'career', activationClass: 'standard', masterRows: ['UOS-004', 'UOS-005'], requiredClaims: 'Partial personal application tracking; no automatic submission, offer or eligibility guarantee.' },
  'CAP-056': { profile: 'assistant', activationClass: 'controlled', masterRows: ['AI-005', 'AI-007'], requiredClaims: 'Writing and citation review supporting the author; no plagiarism certification or replacement of authorship.' },
  'CAP-057': { profile: 'communication', activationClass: 'controlled', masterRows: ['UOS-002', 'IAM-007'], requiredClaims: 'Partial browser calling subject to device permissions and approved provider configuration; no guaranteed connection.' },
  'CAP-058': { profile: 'communication', activationClass: 'controlled', masterRows: ['UOS-007', 'IAM-007'], requiredClaims: 'Partial group coordination with explicit membership and sync status; no live collaboration claim while backend approval is absent.' },
  'CAP-059': { profile: 'communication', activationClass: 'controlled', masterRows: ['INT-001', 'IAM-007'], requiredClaims: 'Partial email tools; receiving and sending require an explicit approved connection and confirmed recipient scope.' },
  'CAP-060': { profile: 'communication', activationClass: 'controlled', masterRows: ['UOS-007', 'IAM-007', 'TRUST-005'], requiredClaims: 'Partial membership-aware messaging; sample and undelivered content must never be described as live delivery.' },
} satisfies Record<RolloutCapability['id'], CapabilityPolicy>;

export function maturityForState(state: CapabilityState): MaturityLevel {
  switch (state) {
    case 'verified': return 'L3';
    case 'partial': return 'L2';
    case 'absent': case 'blocked': case 'conflict': return 'L1';
    default: throw new Error(`Unknown capability state: ${String(state)}`);
  }
}

/** Pure join, also exposed so malformed registries can be tested without mutating canonical data. */
export function buildCapabilityDefinitions(
  sources: readonly RolloutCapability[] = CAPABILITIES,
  policies: Readonly<Record<string, CapabilityPolicy>> = CAPABILITY_POLICIES,
  profiles: Readonly<Record<string, CapabilityProfile>> = CAPABILITY_PROFILES,
): CapabilityDefinition[] {
  const seen = new Set<string>();
  const rows = new Set(REGISTER.map((r) => r.id));
  return sources.map((source) => {
    if (seen.has(source.id)) throw new Error(`Duplicate source ID: ${source.id}`);
    seen.add(source.id);
    const policy = Object.hasOwn(policies, source.id) ? policies[source.id] : undefined;
    if (!policy) throw new Error(`Missing policy: ${source.id}`);
    const profile = Object.hasOwn(profiles, policy.profile) ? profiles[policy.profile] : undefined;
    if (!profile) throw new Error(`Unknown profile: ${source.id} / ${policy.profile}`);
    if (policy.masterRows.length === 0) throw new Error(`Missing master rows: ${source.id}`);
    for (const row of policy.masterRows) if (!rows.has(row)) throw new Error(`Unknown master row: ${source.id} / ${row}`);
    if (!Object.hasOwn(DOMAINS, profile.domain) || !SEATS.includes(profile.supportOwner)) throw new Error(`Unknown domain or support owner: ${source.id}`);
    if (!profile.primitives.length || profile.primitives.some((p) => !PRIMITIVE_IDS.includes(p))) throw new Error(`Unknown or missing primitive: ${source.id}`);
    if (!ACTIVATION_CLASSES.includes(policy.activationClass)) throw new Error(`Unknown activation class: ${source.id}`);
    if ([source.owner, source.promise, profile.accessibility, profile.fallback, profile.lifecycle, policy.requiredClaims].some((value) => !value.trim())) throw new Error(`Incomplete governance: ${source.id}`);
    if (!profile.data.length || profile.data.some((rule) => !rule.classification.trim() || !rule.purpose.trim() || !rule.retention.trim() || !['student', 'semester', 'institution', 'external-provider', 'shared'].includes(rule.authority))) throw new Error(`Incomplete data rule: ${source.id}`);
    if (policy.activationClass === 'high-risk' && HIGH_RISK_REQUIREMENTS.some((key) => !profile.highRiskRequirements?.[key]?.trim())) throw new Error(`Incomplete high-risk profile: ${source.id}`);
    const derived = maturityForState(source.currentState);
    const maturity = policy.maturity ?? derived;
    if (!MATURITY_LEVELS.includes(maturity)) throw new Error(`Unknown maturity: ${source.id} / ${maturity}`);
    if (MATURITY_LEVELS.indexOf(maturity) > MATURITY_LEVELS.indexOf(derived)) throw new Error(`Maturity promotion is forbidden: ${source.id} / ${derived} to ${maturity}`);
    return { ...profile, ...source, maturity, activationClass: policy.activationClass, masterRows: policy.masterRows, requiredClaims: policy.requiredClaims };
  });
}

export const CAPABILITY_DEFINITIONS: readonly CapabilityDefinition[] = buildCapabilityDefinitions();
export function capabilityDefinition(id: string): CapabilityDefinition | undefined {
  return CAPABILITY_DEFINITIONS.find((c) => c.id === id);
}
