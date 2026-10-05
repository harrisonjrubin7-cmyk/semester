/**
 * Pilots that end in a decision, and the buying committee (GTM plan §5, §6).
 *
 * A pilot is "a structured purchase decision, not an indefinite free trial":
 * `pilotReadiness` refuses a kickoff without the elements of §6.2, and
 * `pilotVerdict` refuses to call a pilot finished without a signed decision.
 */

export interface PilotPlan {
  startDate: string;
  endDate: string;
  workflow: string;
  cohort: string;
  baseline: string | null;
  executiveSponsor: string | null;
  operationalChampion: string | null;
  dataPlan: { minimumNecessary: boolean; readOnlyFirst: boolean; sourceLabelled: boolean };
  metrics: readonly { name: string; target: string; baseline: string | null }[];
  conversionDate: string | null;
  annualPriceAgreed: boolean;
  midpointReviewDate: string | null;
  productionDataApproved: boolean;
}

export type PilotProblem =
  | 'duration' | 'no_workflow' | 'no_cohort' | 'no_baseline' | 'no_sponsor' | 'no_champion' | 'data_plan'
  | 'metric_count' | 'metric_baseline' | 'no_conversion_date' | 'conversion_outside_window' | 'no_price'
  | 'no_midpoint';

const DAY = 86_400_000;

/** Every pilot runs 26 weeks: long enough for a registration cycle and an outcomes report, short enough to decide on. */
export const PILOT_WEEKS = 26;
export const PILOT_DAYS = PILOT_WEEKS * 7;

export function pilotDays(p: Pick<PilotPlan, 'startDate' | 'endDate'>): number {
  return Math.round((Date.parse(p.endDate) - Date.parse(p.startDate)) / DAY);
}

/** The §6.2 specification as a checklist. An empty array means ready to kick off. */
export function pilotReadiness(p: PilotPlan): PilotProblem[] {
  const out: PilotProblem[] = [];
  const days = pilotDays(p);
  if (days !== PILOT_DAYS) out.push('duration');
  if (!p.workflow.trim()) out.push('no_workflow');
  if (!p.cohort.trim()) out.push('no_cohort');
  if (!p.baseline) out.push('no_baseline');
  if (!p.executiveSponsor) out.push('no_sponsor');
  if (!p.operationalChampion) out.push('no_champion');
  if (!p.dataPlan.minimumNecessary || !p.dataPlan.readOnlyFirst || !p.dataPlan.sourceLabelled) out.push('data_plan');
  if (p.metrics.length < 3 || p.metrics.length > 5) out.push('metric_count');
  if (p.metrics.some((m) => !m.baseline)) out.push('metric_baseline');
  if (!p.conversionDate) out.push('no_conversion_date');
  else if (Date.parse(p.conversionDate) < Date.parse(p.endDate) - 14 * DAY || Date.parse(p.conversionDate) > Date.parse(p.endDate) + 30 * DAY) {
    out.push('conversion_outside_window');
  }
  if (!p.annualPriceAgreed) out.push('no_price');
  if (!p.midpointReviewDate) out.push('no_midpoint');
  return out;
}

/** §5.2 step 9: sandbox only until production approval exists. */
export function pilotDataMode(p: Pick<PilotPlan, 'productionDataApproved'>): 'sandbox' | 'production' {
  return p.productionDataApproved ? 'production' : 'sandbox';
}

export type PilotDecision = 'convert' | 'expand' | 'pause' | 'stop';

export interface PilotOutcome {
  decision: PilotDecision | null;
  signedBy: string | null;
  signedAt: string | null;
  unresolvedHighSeverity: number;
}

/** §6.3 "Decision": no signature, no outcome. A high-severity open issue blocks convert/expand. */
export function pilotVerdict(o: PilotOutcome): { final: boolean; reason: string } {
  if (!o.decision || !o.signedBy || !o.signedAt) return { final: false, reason: 'The sponsor has not signed a written decision.' };
  if ((o.decision === 'convert' || o.decision === 'expand') && o.unresolvedHighSeverity > 0) {
    return { final: false, reason: 'A high-severity security, privacy or policy issue is still open.' };
  }
  return { final: true, reason: `Signed ${o.decision} decision.` };
}

// ── Buying committee (§5.1) and decision log (§5.3) ──────────────────────────

export const COMMITTEE_ROLES = [
  'executive_sponsor', 'operational_owner', 'cio', 'ciso_privacy', 'accessibility', 'registrar_data_governance',
  'procurement', 'legal', 'finance', 'champion',
] as const;
export type CommitteeRole = (typeof COMMITTEE_ROLES)[number];

export type DecisionCategory = 'security' | 'privacy' | 'accessibility' | 'legal' | 'integration' | 'budget' | 'procurement' | 'implementation';
export type DecisionStatus = 'open' | 'in_review' | 'blocked' | 'approved' | 'declined';

export interface DecisionLogEntry {
  accountId: string;
  stakeholderId: string;
  committeeRole: CommitteeRole;
  question: string;
  category: DecisionCategory;
  status: DecisionStatus;
  owner: string;
  requestedDate: string;
  targetDate: string;
  resolutionDate: string | null;
  evidenceLinks: readonly string[];
  riskLevel: 'low' | 'medium' | 'high';
}

/** §5.2 step 3: every review function identified before launch timing is committed. */
export function unmappedRoles(mapped: readonly CommitteeRole[]): CommitteeRole[] {
  return COMMITTEE_ROLES.filter((r) => !mapped.includes(r));
}

/** Entries past their target date and still unresolved — the weekly "top risks/blockers" list. */
export function overdue(log: readonly DecisionLogEntry[], now: Date): DecisionLogEntry[] {
  return log
    .filter((e) => (e.status === 'open' || e.status === 'in_review' || e.status === 'blocked') && Date.parse(e.targetDate) < now.getTime())
    .sort((a, b) => (a.riskLevel === b.riskLevel ? Date.parse(a.targetDate) - Date.parse(b.targetDate) : a.riskLevel === 'high' ? -1 : b.riskLevel === 'high' ? 1 : a.riskLevel === 'medium' ? -1 : 1));
}

/** A closed entry must say when and on what evidence. */
export function entryProblems(e: DecisionLogEntry): string[] {
  const out: string[] = [];
  const closed = e.status === 'approved' || e.status === 'declined';
  if (closed && !e.resolutionDate) out.push('A resolved entry needs a resolution date.');
  if (e.status === 'approved' && e.evidenceLinks.length === 0) out.push('An approval needs its evidence linked.');
  if (!e.owner.trim()) out.push('Every entry has an owner.');
  return out;
}

// The §13.4 portfolio scorecard is app/src/lib/governance/scorecard.ts (#813).
