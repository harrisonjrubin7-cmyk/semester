import { CAPABILITIES, type CapabilityState, type RolloutCapability } from '../rollout-capabilities';

export const MASTER_PLAN_TITLE = 'Semester Master Plan: From Registration Readiness Pilot to University Operating System';
export const AS_OF = '2026-09-30';

export const VISION = [
  'Now: a private, source-aware academic operating system that helps a student decide what to do next.',
  'Next: a governed registration-readiness workflow that a university can pilot without surrendering authority.',
  'Later: a modular university operating platform whose shared controls let institutions adopt bounded workflows safely.',
] as const;

export const DEFINITION_OF_DONE = [
  'Clear user problem and accountable owner',
  'User journey, edge cases, and out-of-scope boundaries',
  'Data classification, authority, provenance, retention, and correction route',
  'Tenant, role, purpose, consent, and object-level authorization',
  'Source freshness and safe fallback',
  'Accessibility acceptance criteria and manual test evidence',
  'Security and threat review, secrets handling, audit events, and abuse cases',
  'Unit, integration, authorization, failure, and regression tests',
  'Monitoring, SLO, support owner, documentation, and runbook',
  'Feature entitlement, institution approval, rollout controls, and kill switch',
  'Migration, rollback, export, deletion, and retirement behavior',
  'Claims reviewed against the Product Status Map',
  'Evidence stored in the evidence vault',
  'Measurable success metric and review date',
] as const;

export type MilestoneId = `M${0|1|2|3|4|5|6|7|8|9|10}`;
export type PlanStatus = 'not-started' | 'partial' | 'blocked' | 'evidence-required';

export interface Milestone {
  id: MilestoneId;
  name: string;
  scope: string;
  proof: string;
  status: PlanStatus;
  dependsOn: readonly MilestoneId[];
  capabilityIds: readonly string[];
  nextGate: string;
}

export const MILESTONES: readonly Milestone[] = [
  { id: 'M0', name: 'Company foundation', scope: 'Incorporation, IP, banking, domain, policy library, source control, and key-person continuity.', proof: 'The company can sign a pilot and operate accounts safely.', status: 'evidence-required', dependsOn: [], capabilityIds: [], nextGate: 'Store executed company and continuity evidence; repository documents alone do not close this gate.' },
  { id: 'M1', name: 'Safe core app', scope: 'Authentication, tenant model, persistence, RLS, Action Center, source labels, accessibility baseline, and monitoring.', proof: 'A student safely uses persistent private data in a real two-account test.', status: 'partial', dependsOn: ['M0'], capabilityIds: ['CAP-010', 'CAP-011', 'CAP-014', 'CAP-015', 'CAP-016', 'CAP-017', 'CAP-019'], nextGate: 'Close production auth, tenant-isolation, persistence, accessibility, support, and monitoring evidence.' },
  { id: 'M2', name: 'Registration Readiness', scope: 'Path, term plan, conflict detection, backups, advisor agenda, and official handoff.', proof: '10-20 students complete the workflow in observed usability testing.', status: 'partial', dependsOn: ['M1'], capabilityIds: ['CAP-001', 'CAP-003', 'CAP-044', 'CAP-045', 'CAP-050'], nextGate: 'Finish the bounded workflow, then record observed usability evidence without enabling registration writes.' },
  { id: 'M3', name: 'Controlled pilot', scope: 'A 25-75 student cohort, support, feedback, metrics, and an outcome report.', proof: 'The pilot produces its predefined evidence-backed result.', status: 'evidence-required', dependsOn: ['M2'], capabilityIds: [], nextGate: 'Secure design partners, owners, consent, support coverage, measures, and a signed pilot boundary.' },
  { id: 'M4', name: 'Institution confidence', scope: 'SSO, minimal read-only data, tenant configuration, procurement pack, DPA, and incident/restore evidence.', proof: 'One institution approves and launches a scoped deployment.', status: 'blocked', dependsOn: ['M3'], capabilityIds: ['CAP-013', 'CAP-043'], nextGate: 'Institution and provider approvals plus hosted restore, incident, security, and procurement evidence.' },
  { id: 'M5', name: 'Repeatable adoption', scope: 'Templates, implementation center, support playbooks, pricing, and first paid conversion.', proof: 'A second deployment requires little custom work.', status: 'not-started', dependsOn: ['M4'], capabilityIds: [], nextGate: 'Complete one controlled institutional launch before standardizing a second.' },
  { id: 'M6', name: 'Learning and advising expansion', scope: 'Course context, cited study support, advisor workflows, and controlled Hermes.', proof: 'Students and staff use connected workflows safely.', status: 'blocked', dependsOn: ['M5'], capabilityIds: ['CAP-020', 'CAP-021', 'CAP-025', 'CAP-027', 'CAP-038'], nextGate: 'Prove the core pilot and approve connected data, AI provider, advisor permissions, and evaluation.' },
  { id: 'M7', name: 'Platform expansion', scope: 'Career, campus resources, opportunities, and student-controlled evidence.', proof: 'Additional modules reuse the same control plane.', status: 'not-started', dependsOn: ['M6'], capabilityIds: ['CAP-043', 'CAP-051', 'CAP-052', 'CAP-053', 'CAP-054', 'CAP-055'], nextGate: 'Admit modules only after shared identity, policy, evidence, and lifecycle controls are proven.' },
  { id: 'M8', name: 'Deep integrations', scope: 'LTI, OneRoster, approved SIS gateway, reconciliation, and parallel run.', proof: 'Integration health and data quality are proven across terms.', status: 'blocked', dependsOn: ['M7'], capabilityIds: ['CAP-013'], nextGate: 'Funded partner scope, approved credentials, reconciliation, failure handling, and term-length evidence.' },
  { id: 'M9', name: 'Bounded system-of-record modules', scope: 'One specific institutional workflow becomes authoritative.', proof: 'Parallel run, reconciliation, approvals, rollback, and audit evidence pass.', status: 'blocked', dependsOn: ['M8'], capabilityIds: ['CAP-050'], nextGate: 'Name one bounded authoritative workflow and obtain institution, security, legal, and operational approval.' },
  { id: 'M10', name: 'University operating platform', scope: 'Multi-campus operation, modular replacements, and mature assurance and operations.', proof: 'Multiple institutions operate modules predictably at scale.', status: 'not-started', dependsOn: ['M9'], capabilityIds: [], nextGate: 'Earn this status through repeated operating evidence; architecture and code alone cannot close it.' },
];

export type RiskTier = 'standard' | 'controlled' | 'high-risk';
const HIGH_RISK = new Set(['CAP-041', 'CAP-046', 'CAP-047', 'CAP-048', 'CAP-050']);
const CONTROLLED = new Set(['CAP-018', 'CAP-027', 'CAP-043', 'CAP-044', 'CAP-045', 'CAP-057', 'CAP-058', 'CAP-059', 'CAP-060']);

export interface CapabilityRegisterRow extends RolloutCapability {
  riskTier: RiskTier;
  activation: 'not-approved' | 'tenant-gate-required';
  evidenceClass: 'catalog-only' | 'source-registry-verified';
  reviewDate: string;
}

export function riskTier(capability: RolloutCapability): RiskTier {
  if (HIGH_RISK.has(capability.id)) return 'high-risk';
  if (CONTROLLED.has(capability.id) || capability.disposition === 'external-gate') return 'controlled';
  return 'standard';
}

export const CAPABILITY_REGISTER: readonly CapabilityRegisterRow[] = CAPABILITIES.map((capability) => ({
  ...capability,
  riskTier: riskTier(capability),
  activation: riskTier(capability) === 'standard' ? 'tenant-gate-required' : 'not-approved',
  evidenceClass: capability.currentState === 'verified' ? 'source-registry-verified' : 'catalog-only',
  reviewDate: '2026-10-30',
}));

export interface WeekPlan {
  week: 1 | 2 | 3 | 4;
  objective: string;
  deliverables: readonly string[];
  exitEvidence: string;
}

export const THIRTY_DAY_PLAN: readonly WeekPlan[] = [
  { week: 1, objective: 'Establish product truth and close critical M1 gaps.', deliverables: ['Audit repository and deployment', 'Publish the Product Status Map from executable sources', 'Close critical auth, persistence, tenant/RLS, secrets, and claims gaps', 'Stand up the evidence vault and capability register'], exitEvidence: 'Current branch, deployment target, backend, open gaps, owners, and evidence paths are reviewable in one place.' },
  { week: 2, objective: 'Finish the bounded M2 workflow.', deliverables: ['Finish Today, Path, term planning, conflicts, backups, advisor agenda, source labels, feedback, and support path', 'Test keyboard, mobile, screen-reader basics, slow network, errors, stale sources, export/deletion, and cross-tenant access'], exitEvidence: 'The M1/M2 acceptance matrix passes locally and manual accessibility/security observations are stored.' },
  { week: 3, objective: 'Validate with 10-20 student design partners.', deliverables: ['Observe the complete workflow', 'Fix the three highest-impact failures', 'Create the Registration Readiness Pilot page and packet'], exitEvidence: 'Consent-aware research notes, issue ranking, fixes, and honest limitations are stored.' },
  { week: 4, objective: 'Run a concierge pilot and recruit an institutional champion.', deliverables: ['Measure onboarding, Path Snapshot, plan saved, conflict resolved, backups, agenda creation, clarity, and advisor feedback', 'Publish a short outcome report with limitations'], exitEvidence: 'A signed-off outcome report contains denominators, limitations, incidents, accessibility findings, and next decision.' },
];

export const NOT_NOW = [
  'Full SIS replacement', 'Full native LMS replacement', 'Official registration writes', 'Gradebook passback',
  'Financial aid', 'Institutional tuition or payment processing', 'Payroll, HR, procurement, or general ledger',
  'Housing contracts or meal-plan transactions', 'Health, counseling, conduct, diagnosis, or emergency workflows',
  'Parent or guardian access', 'Student risk scoring or surveillance', 'Marketplace payouts or funds custody',
  'Broad social feed', 'Autonomous AI writes', 'Deep enterprise integrations before core pilot proof',
] as const;

export const ADMISSION_RULE = 'Does this make one student decision clearer, one institutional workflow safer, or one shared platform primitive stronger?';

export function stateCounts(rows = CAPABILITY_REGISTER): Record<CapabilityState, number> {
  const result: Record<CapabilityState, number> = { verified: 0, partial: 0, absent: 0, blocked: 0, conflict: 0 };
  for (const row of rows) result[row.currentState] += 1;
  return result;
}
