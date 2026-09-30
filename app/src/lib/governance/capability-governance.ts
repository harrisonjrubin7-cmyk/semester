/** Canonical governance projection for the sixty stable rollout capabilities. */
import { CAPABILITIES, type CapabilityState, type RolloutCapability } from '../rollout-capabilities';
import { REGISTER, type Domain } from '../masterregister';
import type { Seat } from '../launchreadiness';
import { PRIMITIVE_IDS, type PrimitiveId } from './constitution';

export const MATURITY_LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9'] as const;
export type MaturityLevel = (typeof MATURITY_LEVELS)[number];
export const ACTIVATION_CLASSES = ['standard', 'controlled', 'high-risk'] as const;
export type ActivationClass = (typeof ACTIVATION_CLASSES)[number];
export type DataAuthority = 'student' | 'semester' | 'institution' | 'external-provider' | 'shared';

export const HIGH_RISK_REQUIREMENTS = [
  'executed agreement and accountable owners',
  'approved data authority, classification, retention, correction, export and offboarding map',
  'tenant role, purpose, consent and separation-of-duty rules',
  'accessible workflow and official fallback',
  'sandbox security, idempotency, concurrency, failure and reconciliation evidence',
  'migration, parallel run, rollback and last-known-good procedure',
  'monitoring, SLO, incident, support and tested kill switch',
  'training, UAT, staged rollout and signed go-live authorization',
  'truthful Product Status Map and public-claim review',
] as const;

export interface DataRule {
  classification: string;
  authority: DataAuthority;
  purpose: string;
  retention: string;
}

export interface CapabilityProfile {
  domain: Domain;
  primitives: readonly PrimitiveId[];
  data: readonly DataRule[];
  accessibility: string;
  fallback: string;
  supportOwner: Seat;
  lifecycle: string;
}

export interface CapabilityPolicy {
  profile: keyof typeof CAPABILITY_PROFILES;
  activationClass: ActivationClass;
  masterRows: readonly string[];
  requiredClaims: string;
  maturity?: MaturityLevel;
}

export interface CapabilityDefinition extends RolloutCapability, CapabilityProfile {
  purpose: string;
  maturity: MaturityLevel;
  activationClass: ActivationClass;
  masterRows: readonly string[];
  requiredClaims: string;
  highRiskRequirements: readonly string[];
}

const studentData: readonly DataRule[] = [{
  classification: 'student-controlled personal workspace data', authority: 'student',
  purpose: 'Deliver the capability the student explicitly uses.', retention: 'RETENTION.md#student-workspace',
}];
const educationData: readonly DataRule[] = [{
  classification: 'education record or institution-sourced academic data', authority: 'shared',
  purpose: 'Deliver an authorized academic workflow with source and correction context.', retention: 'RETENTION.md#education-records',
}];
const institutionalData: readonly DataRule[] = [{
  classification: 'institutional operational data', authority: 'institution',
  purpose: 'Perform the institution-approved bounded workflow.', retention: 'RETENTION.md#institutional-data',
}];

export const CAPABILITY_PROFILES = {
  personal: {
    domain: 'STU', primitives: ['action-workflow', 'experience-accessibility'], data: studentData,
    accessibility: 'Keyboard, screen-reader, narrow-screen, reduced-motion and offline/degraded behavior are acceptance criteria.',
    fallback: 'Keep the student-entered record editable on device and provide an explicit manual alternative.',
    supportOwner: 'success', lifecycle: 'Measure use and student outcome quarterly; merge or retire with export and migration.',
  },
  identity: {
    domain: 'IAM', primitives: ['identity-tenancy', 'permission-consent-authority'], data: educationData,
    accessibility: 'Authentication, recovery, consent and account-state errors remain accessible without relying on color or motion.',
    fallback: 'Preserve local work, explain account state and route recovery to an authorized human process.',
    supportOwner: 'engineering', lifecycle: 'Retain stable account identifiers and provide migration, recovery and deletion routes.',
  },
  academic: {
    domain: 'LMS', primitives: ['data-provenance', 'action-workflow', 'experience-accessibility'], data: educationData,
    accessibility: 'Academic content and actions require accessible source, editing, review and recovery paths.',
    fallback: 'Label the information unofficial or stale and hand off to the authoritative course or registrar source.',
    supportOwner: 'product', lifecycle: 'Preserve source history and student exports when a course workflow is merged or retired.',
  },
  intelligence: {
    domain: 'AI', primitives: ['policy-rules', 'data-provenance', 'trust-evidence', 'experience-accessibility'], data: educationData,
    accessibility: 'AI output has readable structure, citations, limitations and a non-AI route to the underlying source or work.',
    fallback: 'Disable generation and preserve source-grounded planning, study and human-support routes.',
    supportOwner: 'product', lifecycle: 'Re-evaluate providers, policies, quality and data use on change; retain a tested kill switch.',
  },
  workspace: {
    domain: 'UX', primitives: ['action-workflow', 'experience-accessibility', 'data-provenance'], data: studentData,
    accessibility: 'Creation, editing, history, export and recovery work with keyboard and assistive technology.',
    fallback: 'Preserve the original file and offer a standards-based export or local editing route.',
    supportOwner: 'product', lifecycle: 'Retire only with format-compatible export, migration and recovery of student work.',
  },
  integration: {
    domain: 'INT', primitives: ['integration-gateway', 'data-provenance', 'trust-evidence'], data: institutionalData,
    accessibility: 'Connection state, freshness, errors, revocation and official fallback are presented accessibly.',
    fallback: 'Stop synchronization, label cached data and route the person to the authoritative external system.',
    supportOwner: 'data', lifecycle: 'Version adapters; revoke credentials and export mappings before replacement or retirement.',
  },
  institutional: {
    domain: 'UOS', primitives: ['permission-consent-authority', 'policy-rules', 'action-workflow', 'trust-evidence'], data: institutionalData,
    accessibility: 'Institutional workflows include accessible review, approval, denial, correction and fallback states.',
    fallback: 'Keep Semester read-only and hand off to the accountable institutional office or system.',
    supportOwner: 'success', lifecycle: 'Review ownership, use, support cost and risk quarterly; communicate and migrate before retirement.',
  },
  highImpact: {
    domain: 'UOS', primitives: ['permission-consent-authority', 'policy-rules', 'action-workflow', 'integration-gateway', 'trust-evidence'], data: educationData,
    accessibility: 'The consequential workflow and its official fallback pass an accessibility review before tenant activation.',
    fallback: 'Fail closed without data loss and route to the authoritative institution-controlled workflow.',
    supportOwner: 'operations', lifecycle: 'Retire only through approved parallel-run exit, reconciliation, export, revocation and customer communication.',
  },
} as const satisfies Record<string, CapabilityProfile>;

const P = (profile: keyof typeof CAPABILITY_PROFILES, activationClass: ActivationClass, masterRows: readonly string[], requiredClaims: string): CapabilityPolicy => ({ profile, activationClass, masterRows, requiredClaims });

/** Explicit, reviewable policy binding for every stable CAP id. */
export const CAPABILITY_POLICIES: Readonly<Record<string, CapabilityPolicy>> = {
  'CAP-001': P('personal', 'standard', ['STU-001'], 'Personal planning from recorded student data; not official advice.'),
  'CAP-002': P('personal', 'standard', ['STU-009'], 'Reports summarize recorded activity without surveillance or fabricated scores.'),
  'CAP-003': P('academic', 'controlled', ['STU-004'], 'Dates retain source and freshness; connected dates require tenant approval.'),
  'CAP-004': P('personal', 'standard', ['STU-001'], 'Editable exam planning, not a guarantee of performance.'),
  'CAP-005': P('personal', 'standard', ['STU-001'], 'A student planning view from recorded dates and time.'),
  'CAP-006': P('personal', 'standard', ['STU-002'], 'A recovery aid that avoids risk labels and official determinations.'),
  'CAP-007': P('personal', 'standard', ['STU-001'], 'A short editable plan, not an automated commitment.'),
  'CAP-008': P('personal', 'standard', ['STU-007'], 'Browser timers with honest delivery limits.'),
  'CAP-009': P('personal', 'standard', ['STU-009'], 'Progress from recorded data; not an institutional performance score.'),
  'CAP-010': P('identity', 'controlled', ['IAM-001'], 'Account and recovery behavior only as verified in the current environment.'),
  'CAP-011': P('identity', 'controlled', ['IAM-002'], 'Profile attributes remain scoped to the account and tenant.'),
  'CAP-012': P('personal', 'standard', ['STU-003'], 'Student-managed links; linked services remain external.'),
  'CAP-013': P('integration', 'controlled', ['INT-001'], 'Connections are available only when approved, healthy and revocable.'),
  'CAP-014': P('institutional', 'controlled', ['TRUST-001'], 'Shows stored data and provenance without implying complete institutional coverage.'),
  'CAP-015': P('institutional', 'controlled', ['SEC-008'], 'Privacy controls reflect implemented collection, sharing, deletion and consent behavior.'),
  'CAP-016': P('workspace', 'controlled', ['TRUST-005'], 'Portable export and restore only for formats actually validated.'),
  'CAP-017': P('personal', 'standard', ['UX-001'], 'User-controlled settings with explicit scope and defaults.'),
  'CAP-018': P('institutional', 'controlled', ['STU-007'], 'Notifications disclose channel and delivery state; no delivery guarantee.'),
  'CAP-019': P('personal', 'standard', ['SUP-001'], 'Product guidance with honest requirements and limitations.'),
  'CAP-020': P('academic', 'standard', ['LMS-001'], 'Student course workspace; no unsupported LMS replacement claim.'),
  'CAP-021': P('academic', 'controlled', ['LMS-004'], 'Assignments retain source and confirmation; official submission stays external unless approved.'),
  'CAP-022': P('academic', 'controlled', ['LMS-002'], 'Source-backed extraction requires student confirmation before save.'),
  'CAP-023': P('academic', 'controlled', ['LMS-002'], 'Edits preserve source history and remain unofficial unless institution-authorized.'),
  'CAP-024': P('academic', 'controlled', ['LMS-003'], 'Changed dates preserve both values and their sources.'),
  'CAP-025': P('academic', 'controlled', ['LMS-008'], 'Study material is source-aware and governed by course policy.'),
  'CAP-026': P('academic', 'standard', ['LMS-008'], 'Concept comparison is explanatory and never asserts false equivalence.'),
  'CAP-027': P('intelligence', 'controlled', ['AI-004'], 'Source-grounded assistance with limitations; no autonomous or official action.'),
  'CAP-028': P('academic', 'controlled', ['LMS-008'], 'Student-added reading with permission, provenance and deletion controls.'),
  'CAP-029': P('academic', 'standard', ['LMS-008'], 'Practice and hints are learning aids, not official assessment results.'),
  'CAP-030': P('academic', 'standard', ['LMS-009'], 'Practice exams are not official exams or grades.'),
  'CAP-031': P('workspace', 'standard', ['UX-001'], 'Student-controlled creation workspace with format-specific limitations.'),
  'CAP-032': P('workspace', 'standard', ['UX-001'], 'Transparent local analysis; AI explanation does not alter computed values.'),
  'CAP-033': P('workspace', 'standard', ['UX-001'], 'Editable, described graphs and diagrams from user-controlled inputs.'),
  'CAP-034': P('workspace', 'standard', ['UX-001'], 'Editable presentation output only in formats verified by export tests.'),
  'CAP-035': P('workspace', 'standard', ['UX-001'], 'Editable document output only in formats verified by export tests.'),
  'CAP-036': P('workspace', 'standard', ['UX-001'], 'Spreadsheet calculations and exports retain user-editable formulas and data.'),
  'CAP-037': P('workspace', 'standard', ['UX-001'], 'Structured math editing and export; no claim of symbolic correctness beyond tests.'),
  'CAP-038': P('academic', 'controlled', ['TRUST-001'], 'Sources preserve metadata and quotation context; authority remains explicit.'),
  'CAP-039': P('workspace', 'standard', ['UX-001'], 'Drafting uses user-provided facts and does not invent experience.'),
  'CAP-040': P('workspace', 'controlled', ['TRUST-005'], 'Original files, history, Trash and export remain recoverable within stated limits.'),
  'CAP-041': P('highImpact', 'high-risk', ['SEC-008'], 'Family access requires explicit, revocable, scoped student or institutional authority.'),
  'CAP-042': P('institutional', 'controlled', ['UOS-001'], 'Athletics planning excludes health, injury and eligibility determinations.'),
  'CAP-043': P('institutional', 'controlled', ['UOS-001'], 'Campus service facts require accountable sources and safe official handoff.'),
  'CAP-044': P('institutional', 'controlled', ['STU-011'], 'Degree planning is what-if guidance and never certification.'),
  'CAP-045': P('integration', 'controlled', ['INT-001'], 'Term deadlines require an authoritative, current registrar source.'),
  'CAP-046': P('highImpact', 'high-risk', ['UOS-007'], 'Financial information and actions require approved authority; Semester stores no payment credentials.'),
  'CAP-047': P('highImpact', 'high-risk', ['UOS-007'], 'Meal-plan transactions require approved campus-card authority and reconciliation.'),
  'CAP-048': P('highImpact', 'high-risk', ['UOS-008'], 'Housing contracts or assignments require institution approval and official fallback.'),
  'CAP-049': P('institutional', 'controlled', ['UOS-001'], 'Location guidance uses approved place data and does not track a person.'),
  'CAP-050': P('highImpact', 'high-risk', ['INT-005'], 'Official registration requires SIS authorization, confirmation, receipt and readback.'),
  'CAP-051': P('institutional', 'controlled', ['UOS-001'], 'Organizations and events require an approved source; no popularity ranking.'),
  'CAP-052': P('institutional', 'controlled', ['STU-012'], 'Relationship records and letters use consented, user-verified evidence.'),
  'CAP-053': P('personal', 'controlled', ['STU-011'], 'Lifecycle planning is guidance and not admissions, visa or credential advice.'),
  'CAP-054': P('institutional', 'controlled', ['STU-012'], 'Career evidence remains student-controlled; employer visibility requires opt-in.'),
  'CAP-055': P('personal', 'controlled', ['STU-012'], 'Application tracking does not submit or promise an external outcome.'),
  'CAP-056': P('workspace', 'standard', ['LMS-008'], 'Writing review supports authorship and does not replace it.'),
  'CAP-057': P('integration', 'controlled', ['INT-001'], 'Calls depend on an approved provider and explicit device permissions.'),
  'CAP-058': P('integration', 'controlled', ['INT-001'], 'Group membership and synchronization require authenticated, tenant-bound service.'),
  'CAP-059': P('integration', 'controlled', ['INT-001'], 'Email sending requires an explicitly connected provider and user confirmation.'),
  'CAP-060': P('integration', 'controlled', ['INT-001'], 'Chat requires verified membership and honest delivery state.'),
};

const stateMaturity: Record<CapabilityState, MaturityLevel> = {
  verified: 'L3', partial: 'L2', absent: 'L1', blocked: 'L1', conflict: 'L1',
};

export function maturityForState(state: CapabilityState): MaturityLevel {
  return stateMaturity[state];
}

const level = (value: MaturityLevel) => MATURITY_LEVELS.indexOf(value);

function joinCapability(capability: RolloutCapability): CapabilityDefinition {
  const policy = CAPABILITY_POLICIES[capability.id];
  if (!policy) throw new Error(`missing capability policy: ${capability.id}`);
  const profile = CAPABILITY_PROFILES[policy.profile];
  if (!profile) throw new Error(`unknown capability profile: ${policy.profile}`);
  const derived = maturityForState(capability.currentState);
  const maturity = policy.maturity ?? derived;
  if (level(maturity) > level(derived)) throw new Error(`maturity promotion above source state: ${capability.id}`);
  const knownRows = new Set(REGISTER.map((row) => row.id));
  for (const row of policy.masterRows) if (!knownRows.has(row)) throw new Error(`unknown master row ${row}: ${capability.id}`);
  for (const primitive of profile.primitives) if (!PRIMITIVE_IDS.includes(primitive)) throw new Error(`unknown primitive ${primitive}: ${capability.id}`);
  return {
    ...capability,
    ...profile,
    purpose: capability.promise,
    maturity,
    activationClass: policy.activationClass,
    masterRows: policy.masterRows,
    requiredClaims: policy.requiredClaims,
    highRiskRequirements: policy.activationClass === 'high-risk' ? HIGH_RISK_REQUIREMENTS : [],
  };
}

export const CAPABILITY_DEFINITIONS: readonly CapabilityDefinition[] = CAPABILITIES.map(joinCapability);

export function capabilityDefinition(id: string): CapabilityDefinition | undefined {
  return CAPABILITY_DEFINITIONS.find((capability) => capability.id === id);
}
