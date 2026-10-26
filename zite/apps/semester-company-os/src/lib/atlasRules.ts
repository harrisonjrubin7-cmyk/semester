// Semester Atlas (S-71, S-73): evidence-aware status, gap register and claims registry. Pure; mirrors lib/atlMigration.ts and
// is unit-tested in apps/semester/tests/atlas.test.ts.
// Rules: status is eight independent dimensions, each satisfied only by recorded evidence for that stage (never inferred from a
// screen, prompt or sample); synthetic environments never satisfy deployment, production or acceptance stages; coverage is a
// ratio with an explicit denominator and reads "unknown" when the scope is undefined; a public claim needs evidence, an
// approver who is not its owner, and an unexpired review date; a critical gap can never be accepted as a risk.
export const DIMENSIONS = ['Designed', 'Implemented', 'Tested', 'Deployed', 'Institution-authorized', 'Production-enabled', 'Operationally accepted', 'Incumbent decommissioned'] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export type Evidence = { stage: string; environment: string };
const REAL_ONLY: Dimension[] = ['Deployed', 'Production-enabled', 'Operationally accepted', 'Incumbent decommissioned'];

/** Which dimensions have qualifying evidence. Order does not imply the next one: each stands alone. */
export function satisfied(evidence: Evidence[]): Record<Dimension, boolean> {
  const out = Object.fromEntries(DIMENSIONS.map((d) => [d, false])) as Record<Dimension, boolean>;
  for (const e of evidence) {
    const d = e.stage as Dimension;
    if (!DIMENSIONS.includes(d)) continue;
    if (REAL_ONLY.includes(d) && e.environment === 'Synthetic') continue;
    out[d] = true;
  }
  return out;
}

/** A ratio with its denominator; null denominator = scope not defined = "unknown", never zero. */
export function coverage(numerator: number, denominator: number | null) {
  if (denominator === null) return { label: 'unknown (scope not defined)', ratio: null as number | null };
  if (denominator === 0) return { label: 'nothing in scope', ratio: null as number | null };
  return { label: `${numerator} of ${denominator}`, ratio: numerator / denominator };
}

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'informational'] as const;
export type Severity = (typeof SEVERITIES)[number];
export type GapState = 'open' | 'in_progress' | 'resolved' | 'risk_accepted' | 'reopened';
export function gapNext(state: GapState, step: 'start' | 'resolve' | 'accept_risk' | 'reopen', p: { severity: Severity; isOwner: boolean; isPrivacyOfficer: boolean }): GapState | null {
  if (step === 'start') return p.isOwner && ['open', 'reopened'].includes(state) ? 'in_progress' : null;
  if (step === 'resolve') return p.isOwner && ['open', 'in_progress', 'reopened'].includes(state) ? 'resolved' : null;
  if (step === 'accept_risk') {
    if (p.severity === 'critical' || p.isOwner) return null;
    if (p.severity === 'high' && !p.isPrivacyOfficer) return null;
    return ['open', 'in_progress', 'reopened'].includes(state) ? 'risk_accepted' : null;
  }
  if (step === 'reopen') return !p.isOwner && ['resolved', 'risk_accepted'].includes(state) ? 'reopened' : null;
  return null;
}

export const CLAIM_KINDS = ['partnership', 'security', 'accessibility', 'feature_availability', 'production_usage', 'performance', 'replacement', 'ai_capability', 'customer_outcome', 'price'] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];
/** Security, accessibility and AI claims need the privacy officer; the rest need the marketing approver. */
export const approverRole = (k: ClaimKind) => (['security', 'accessibility', 'ai_capability'].includes(k) ? 'privacy_officer' : 'marketing_approver');

export function publishable(c: { state: string; reviewBy: string }, today: string) {
  if (c.state !== 'approved') return 'This claim is not approved.';
  if (c.reviewBy < today) return 'This claim is past its review date; re-verify it before publishing.';
  return null;
}
/** Claim ids a post cites in its sources, as CLM-<n>. */
export const citedClaims = (sources: string) => [...new Set([...sources.matchAll(/\bCLM-(\d+)\b/g)].map((m) => Number(m[1])))];
