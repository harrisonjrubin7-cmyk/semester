/**
 * The campaign object (GTM plan §8.2), its audience criteria, its approval
 * path, and the release gate (§13.3) that stands between approved and active.
 *
 * Acceptance criteria answered here (§16.2):
 * - Sensitive data classifications cannot be selected as targeting criteria.
 * - A campaign cannot activate without required consent, owner, approval and
 *   instrumentation.
 * - Tenant administrators cannot touch another tenant's campaign.
 * - A campaign shows its exact audience criteria, count, owner, dates and CTA.
 *
 * Targeting is an allow-list, not a block-list. A field is usable only if it
 * is named below as T0/T2-and-declared; a new CRM field is refused until
 * someone classifies it here, which is the review the plan asks for.
 */
import { evaluateFlag, type FlagContext, type FlagStep } from '../flags';
import type { DataClass } from '../integration/classification';
import { hasStandardAttribution } from './utm';

export type FunnelStage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const FUNNEL_STAGES: Record<FunnelStage, { stage: string; question: string; conversion: string }> = {
  1: { stage: 'Reachable audience', question: 'Why should I notice this institution or program?', conversion: 'Qualified impression / profile visit' },
  2: { stage: 'Engaged visitor', question: 'Is this relevant to me?', conversion: 'Program or content engagement' },
  3: { stage: 'Known inquiry', question: 'What should I do next?', conversion: 'Form, inquiry, event registration' },
  4: { stage: 'Nurtured prospect', question: 'Can I belong and succeed here?', conversion: 'Reply, counselor action, visit or virtual event' },
  5: { stage: 'Application starter', question: 'Can I complete this process?', conversion: 'Application start' },
  6: { stage: 'Application completer', question: 'What remains?', conversion: 'Submitted application' },
  7: { stage: 'Admitted student', question: 'Why choose this institution?', conversion: 'Deposit / intent to enroll' },
  8: { stage: 'Deposited student', question: 'How do I prepare to arrive?', conversion: 'Orientation, housing, onboarding completion' },
  9: { stage: 'Enrolled student', question: 'How do I get my first wins?', conversion: 'Semester activation / first meaningful action' },
  10: { stage: 'Persisting advocate', question: 'Is Semester and campus helping me?', conversion: 'Retention, referral, ambassador or alumni engagement' },
};

/**
 * Fields an audience may be built from, and their class. Everything here is
 * either public (T0) or something the person declared to recruitment (T2 —
 * theirs, shared for this purpose). Nothing from the education record.
 */
export const TARGETABLE_FIELDS = {
  lifecycle_stage: 'T0',
  entry_term: 'T0',
  program_interest: 'T2',
  declared_interest: 'T2',
  learner_type: 'T2', // first-year, transfer, adult, graduate — as the prospect declared it
  region: 'T0',
  event_registered: 'T2',
  preferred_language: 'T2',
} as const satisfies Record<string, DataClass>;

export type TargetableField = keyof typeof TARGETABLE_FIELDS;

/**
 * Named here so the refusal can say why, not only "unknown field". These are
 * the plan's prohibited bases: education records, protected traits,
 * health/disability, aid status, conduct.
 */
export const PROHIBITED_TARGETING_FIELDS: Record<string, DataClass> = {
  gpa: 'T3', grades: 'T3', enrollment_status: 'T3', course_roster: 'T3', advising_notes: 'T3', academic_standing: 'T3',
  financial_aid_status: 'T4', efc: 'T4', pell_eligible: 'T4', disability: 'T4', health: 'T4', counseling: 'T4',
  conduct: 'T4', disciplinary: 'T4', race: 'T4', ethnicity: 'T4', religion: 'T4', sexual_orientation: 'T4',
  gender_identity: 'T4', immigration_status: 'T4', citizenship: 'T4', age: 'T4', veteran_status: 'T4',
  poll_response: 'T4', // §8.1: poll answers are never a sensitive-profile signal for targeting
};

export interface AudienceCriterion {
  field: string;
  op: 'eq' | 'in';
  value: string | readonly string[];
}

export type CriterionProblem = { field: string; problem: 'prohibited' | 'unclassified'; cls?: DataClass };

export function checkAudience(criteria: readonly AudienceCriterion[]): CriterionProblem[] {
  const out: CriterionProblem[] = [];
  for (const c of criteria) {
    const key = c.field.trim().toLowerCase();
    if (key in PROHIBITED_TARGETING_FIELDS) out.push({ field: c.field, problem: 'prohibited', cls: PROHIBITED_TARGETING_FIELDS[key] });
    else if (!(key in TARGETABLE_FIELDS)) out.push({ field: c.field, problem: 'unclassified' });
  }
  return out;
}

/** The plain-language description a campaign must show of who it reaches. */
export function describeAudience(criteria: readonly AudienceCriterion[]): string {
  if (criteria.length === 0) return 'Everyone who has consented to this channel';
  return criteria
    .map((c) => `${c.field.replace(/_/g, ' ')} ${c.op === 'in' ? 'is one of' : 'is'} ${Array.isArray(c.value) ? c.value.join(', ') : c.value}`)
    .join(' and ');
}

export type CampaignStatus = 'draft' | 'in_review' | 'approved' | 'active' | 'paused' | 'completed' | 'retired';
export type ReviewKind = 'privacy' | 'accessibility' | 'brand';

export interface CampaignApproval {
  kind: ReviewKind;
  reviewer: string;
  decision: 'approved' | 'changes_requested';
  at: string;
}

export interface Campaign {
  campaignId: string;
  tenantId: string;
  name: string;
  objective: string;
  funnelStage: FunnelStage;
  audienceCriteria: readonly AudienceCriterion[];
  audienceCount: number | null;
  startDate: string;
  endDate: string;
  primaryCta: string;
  channels: readonly ('email' | 'sms' | 'push' | 'tiktok' | 'instagram' | 'webinar' | 'alumni' | 'other')[];
  owner: string;
  approver: string;
  privacyBasis: string;
  consentRequirements: readonly string[];
  frequencyCap: { max: number; windowDays: number } | null;
  landingPage: string | null;
  campaignLinks: readonly string[];
  successMetric: string;
  baseline: string | null;
  claimsSubstantiated: boolean;
  optOutTested: boolean;
  conversionInstrumentationTested: boolean;
  escalationPath: string;
  reviewDate: string | null;
  approvals: readonly CampaignApproval[];
  status: CampaignStatus;
}

/** Allowed status moves. Activation is not here: it goes through `activationGate`. */
const MOVES: Record<CampaignStatus, readonly CampaignStatus[]> = {
  draft: ['in_review', 'retired'],
  in_review: ['draft', 'approved'],
  approved: ['draft', 'retired'],
  active: ['paused', 'completed'],
  paused: ['active', 'completed', 'retired'],
  completed: ['retired'],
  retired: [],
};

export function canMove(from: CampaignStatus, to: CampaignStatus): boolean {
  return MOVES[from].includes(to);
}

/** The reviews that must each be approved, by someone other than the owner, after the last change request. */
export function reviewsOutstanding(c: Pick<Campaign, 'approvals' | 'owner'>): ReviewKind[] {
  const need: ReviewKind[] = ['privacy', 'accessibility', 'brand'];
  return need.filter((kind) => {
    const latest = [...c.approvals].filter((a) => a.kind === kind).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    return !latest || latest.decision !== 'approved' || latest.reviewer === c.owner;
  });
}

export type GateFailure =
  | { check: 'flag'; step: FlagStep }
  | { check: 'tenant' }
  | { check: 'status'; status: CampaignStatus }
  | { check: 'audience'; problems: CriterionProblem[] }
  | { check: 'field'; field: keyof Campaign }
  | { check: 'review'; outstanding: ReviewKind[] }
  | { check: 'attribution'; link: string }
  | { check: 'dates' };

export const CAMPAIGN_FLAG = 'module.campaign_manager';

/**
 * §13.3 campaign release gate plus the tenant and flag checks. Returns every
 * failure, not the first, so the review screen can list what remains.
 */
export function activationGate(c: Campaign, actorTenantId: string, flagCtx: FlagContext): GateFailure[] {
  const fails: GateFailure[] = [];

  const flag = evaluateFlag(CAMPAIGN_FLAG, flagCtx);
  if (!flag.allowed) fails.push({ check: 'flag', step: flag.step });
  if (c.tenantId !== actorTenantId || flagCtx.tenantId !== c.tenantId) fails.push({ check: 'tenant' });
  if (c.status !== 'approved' && c.status !== 'paused') fails.push({ check: 'status', status: c.status });

  const problems = checkAudience(c.audienceCriteria);
  if (problems.length) fails.push({ check: 'audience', problems });

  const required: (keyof Campaign)[] = ['owner', 'approver', 'privacyBasis', 'primaryCta', 'successMetric', 'escalationPath'];
  for (const f of required) if (!String(c[f] ?? '').trim()) fails.push({ check: 'field', field: f });
  if (c.audienceCount === null) fails.push({ check: 'field', field: 'audienceCount' });
  if (c.consentRequirements.length === 0) fails.push({ check: 'field', field: 'consentRequirements' });
  if (!c.frequencyCap || c.frequencyCap.max < 1) fails.push({ check: 'field', field: 'frequencyCap' });
  if (!c.landingPage) fails.push({ check: 'field', field: 'landingPage' });
  if (!c.reviewDate) fails.push({ check: 'field', field: 'reviewDate' });
  if (!c.claimsSubstantiated) fails.push({ check: 'field', field: 'claimsSubstantiated' });
  if (!c.optOutTested) fails.push({ check: 'field', field: 'optOutTested' });
  if (!c.conversionInstrumentationTested) fails.push({ check: 'field', field: 'conversionInstrumentationTested' });
  if (c.approver === c.owner) fails.push({ check: 'field', field: 'approver' });

  const outstanding = reviewsOutstanding(c);
  if (outstanding.length) fails.push({ check: 'review', outstanding });

  const links = [...(c.landingPage ? [c.landingPage] : []), ...c.campaignLinks];
  for (const link of links) if (!hasStandardAttribution(link)) fails.push({ check: 'attribution', link });

  const start = Date.parse(c.startDate);
  const end = Date.parse(c.endDate);
  const review = c.reviewDate ? Date.parse(c.reviewDate) : NaN;
  if (!(start < end) || (c.reviewDate && !(review >= end))) fails.push({ check: 'dates' });

  return fails;
}

/** A campaign as a staff member of another school sees it: not at all. */
export function visibleTo<T extends { tenantId: string }>(rows: readonly T[], actorTenantId: string): T[] {
  return rows.filter((r) => r.tenantId === actorTenantId);
}
