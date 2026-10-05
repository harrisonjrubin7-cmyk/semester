/**
 * Responsible sponsorship (GTM plan §10), as a placement decision.
 *
 * Monetisation stays off until this policy, a review workflow and tenant
 * controls exist (§18 step 12): the flag is high-risk and nothing here turns
 * it on. What this file guarantees is that when it is on, a placement can only
 * be approved, labelled, contextual, and away from academic decisions.
 */
import { evaluateFlag, type FlagContext } from '../flags';

export const SPONSOR_FLAG = 'module.sponsorship';

export const APPROVED_CATEGORIES = [
  'education_career',
  'student_services',
  'scholarships_verified',
  'wellness_nonclinical',
  'housing_transport_verified',
  'campus_community',
] as const;
export type SponsorCategory = (typeof APPROVED_CATEGORIES)[number];

export const PROHIBITED_CATEGORIES = [
  'predatory_lending', 'gambling', 'alcohol_tobacco_cannabis', 'political', 'adult', 'unverified_employment',
  'academic_cheating', 'discriminatory_offer', 'data_broker', 'surveillance', 'unapproved_financial',
] as const;

/**
 * Surfaces a sponsor may never appear on: anything that recommends, ranks,
 * advises or answers, and every urgent academic or service flow (§10.3
 * "Separation" and "Frequency").
 */
export const PROTECTED_SURFACES = new Set([
  'ai_answer', 'advising', 'course_recommendation', 'ranking', 'degree_plan', 'registration',
  'financial_aid_deadline', 'add_drop', 'crisis_support', 'accommodation', 'grades',
]);

export interface SponsorPlacement {
  tenantId: string;
  sponsorName: string;
  category: string;
  surface: string;
  /** Contextual placement or a broad, approved segment; never an individual. */
  targeting: { kind: 'contextual' } | { kind: 'segment'; segment: string };
  label: string;
  whyShown: string;
  humanApprovedBy: string | null;
  auditScheduledFor: string | null;
  complaintRoute: string;
}

export interface TenantSponsorPolicy {
  enabled: boolean;
  categories: readonly SponsorCategory[];
  surfaces: readonly string[];
  /** Broad segments the school has approved, e.g. 'all_students', 'graduate_students'. */
  segments: readonly string[];
}

export type SponsorRefusal =
  | 'flag_off' | 'tenant_disabled' | 'prohibited_category' | 'category_not_approved' | 'protected_surface'
  | 'surface_not_approved' | 'segment_not_approved' | 'unlabelled' | 'no_explanation' | 'no_human_approval'
  | 'no_audit' | 'no_complaint_route';

const SPONSOR_LABEL = /\b(sponsored|promoted|paid partnership)\b/i;

export function placementProblems(p: SponsorPlacement, policy: TenantSponsorPolicy, flagCtx: FlagContext): SponsorRefusal[] {
  const out: SponsorRefusal[] = [];
  if (!evaluateFlag(SPONSOR_FLAG, flagCtx).allowed) out.push('flag_off');
  if (!policy.enabled) out.push('tenant_disabled');
  if ((PROHIBITED_CATEGORIES as readonly string[]).includes(p.category)) out.push('prohibited_category');
  else if (!(policy.categories as readonly string[]).includes(p.category)) out.push('category_not_approved');
  if (PROTECTED_SURFACES.has(p.surface)) out.push('protected_surface');
  else if (!policy.surfaces.includes(p.surface)) out.push('surface_not_approved');
  if (p.targeting.kind === 'segment' && !policy.segments.includes(p.targeting.segment)) out.push('segment_not_approved');
  if (!SPONSOR_LABEL.test(p.label)) out.push('unlabelled');
  if (!p.whyShown.trim()) out.push('no_explanation');
  if (!p.humanApprovedBy) out.push('no_human_approval');
  if (!p.auditScheduledFor) out.push('no_audit');
  if (!p.complaintRoute.trim()) out.push('no_complaint_route');
  return out;
}

/**
 * The only report a sponsor receives: aggregate counts, suppressed below a
 * minimum cell so a small segment cannot identify anyone (§10.3 Measurement).
 */
export function sponsorReport(impressions: number, clicks: number, minCell = 20): { impressions: number | null; clicks: number | null } {
  return {
    impressions: impressions >= minCell ? impressions : null,
    clicks: clicks >= minCell ? clicks : null,
  };
}
