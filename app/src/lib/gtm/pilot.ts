/**
 * The paid pilot, as rules: what a charter must say before anyone is
 * enrolled, what each lifecycle stage needs before the next, and what each
 * higher-ed sales stage needs before it is entered.
 *
 * These are pure functions over a described pilot, not a CRM. Where a pilot's
 * records live is `docs/INSTITUTIONAL-GTM-PLAYBOOK.md`'s decision — not in
 * this repository and not in the database students use — and the reason is
 * the same one `docs/LAUNCH-READINESS-AUDIT.md` gives for company finances.
 * What *does* belong here is the discipline, because it has to be the same
 * for every pilot and reviewable in one place:
 *
 *   - a charter is refused when it asks for data the command forbids,
 *     measures an outcome at the level of an individual student, lacks a
 *     named person at the institution, or has no real "stop";
 *   - a pilot cannot outlast the deal desk's limit (`DEAL_POLICY`, #813), so
 *     the two documents cannot disagree about how long a pilot may run;
 *   - a lifecycle stage cannot be entered on a promise; it names the evidence
 *     the previous stage had to produce.
 *
 * `docs/PAID-PILOT-FRAMEWORK.md` is the prose half and says why each rule.
 */
import { DEAL_POLICY } from '../governance/deal-desk';

// ── The charter ─────────────────────────────────────────────────────────────

/**
 * Data a pilot may be scoped to use. Anything outside this list is refused,
 * rather than anything inside a deny-list being refused: a new kind of data
 * should have to be argued onto the list.
 */
export const PILOT_DATA = [
  'account-and-affiliation',   // opaque subject, email, affiliation state
  'published-catalog',         // courses, requirements, calendar the university publishes
  'student-entered',           // what the student types into Semester themselves
  'campus-directory',          // offices, hours, services
  'aggregate-usage',           // activation and completion counts at cohort level, n >= minimum
  'support-tickets',           // category and timing of help asked for, with consent
] as const;
export type PilotData = (typeof PILOT_DATA)[number];

/**
 * What the launch command forbids through generic flows, named so a charter
 * that asks for one gets told which, rather than "not on the list".
 */
export const FORBIDDEN_DATA = [
  'grades', 'gpa', 'full roster', 'enrollments', 'financial aid', 'health', 'disability',
  'counseling', 'conduct', 'immigration', 'private messages', 'student submissions',
  'accommodations', 'location history',
] as const;

/** Words that make a success metric about one student rather than a cohort. */
const INDIVIDUAL = /\b(per[- ]student|individual|each student|named students?|risk score|at[- ]risk|early alert|wellbeing|grade|gpa)\b/i;

export const COHORT_MAX = 200;           // docs/market-readiness/PILOT_PLAYBOOK.md: 50–200 students
export const MIN_REPORTING_COHORT = 10;  // matches the n >= 10 aggregates already on main (#762)

export const MODULES = ['today', 'path-and-plan', 'registration-planning', 'study', 'human-help', 'campus-directory', 'ai-toolkit'] as const;
export type PilotModule = (typeof MODULES)[number];

export interface SuccessMetric {
  name: string;
  /** Where the number comes from, e.g. "activity table, cohort aggregate". */
  source: string;
  baseline: number | null;
  target: number;
  unit: string;
}

export interface PilotCharter {
  institution: string;
  /** A person at the institution, by role. Not someone at Semester. */
  champion: { role: string; atInstitution: boolean } | null;
  cohort: { description: string; size: number };
  months: number;
  modules: PilotModule[];
  dataScope: string[];
  /** Who owns each source the pilot shows students, and how fresh it must be. */
  sources: { name: string; owner: string; freshness: string }[];
  /** Integrations in scope. A pilot may run with none. */
  integrations: string[];
  metrics: SuccessMetric[];
  responsibilities: { semester: string[]; institution: string[] };
  reviews: { security: boolean; privacy: boolean; accessibility: boolean };
  support: { hours: string; contact: string } | null;
  /** The decisions the final review may reach. "stop" must be one of them. */
  decisions: ('expand' | 'extend' | 'stop')[];
  conversion: string;
}

/** Everything wrong with a charter; empty means it may be signed. */
export function charterProblems(c: PilotCharter): string[] {
  const out: string[] = [];
  if (!c.institution.trim()) out.push('No institution named.');
  if (!c.champion) out.push('No institutional champion. A pilot without one dies quietly.');
  else if (!c.champion.atInstitution) out.push('The champion must be someone at the institution, not at Semester.');

  if (c.cohort.size < 1) out.push('The cohort is empty.');
  if (c.cohort.size > COHORT_MAX) out.push(`A first pilot is at most ${COHORT_MAX} students; this is ${c.cohort.size}.`);
  if (c.cohort.size < MIN_REPORTING_COHORT) {
    out.push(`A cohort under ${MIN_REPORTING_COHORT} cannot be reported on without identifying people.`);
  }
  if (c.months < 1 || c.months > DEAL_POLICY.maxPilotMonths) {
    out.push(`A pilot runs 1–${DEAL_POLICY.maxPilotMonths} months under the deal desk's policy, then converts or ends.`);
  }
  if (c.modules.length === 0) out.push('No modules in scope.');

  for (const item of c.dataScope) {
    const lower = item.toLowerCase();
    const forbidden = FORBIDDEN_DATA.find((f) => lower.includes(f));
    if (forbidden) out.push(`Data scope asks for ${forbidden}, which no pilot may use through a generic flow.`);
    else if (!(PILOT_DATA as readonly string[]).includes(item)) out.push(`Data scope item "${item}" is not an approved pilot data class.`);
  }
  if (c.dataScope.length === 0) out.push('No data scope. Say what the pilot uses, even if it is only what students type.');
  for (const s of c.sources) {
    if (!s.owner.trim()) out.push(`Source "${s.name}" has no owner at the institution.`);
    if (!s.freshness.trim()) out.push(`Source "${s.name}" has no freshness commitment.`);
  }

  if (c.metrics.length === 0) out.push('No success metrics. A pilot without pre-agreed criteria gets judged on vibes.');
  for (const m of c.metrics) {
    if (INDIVIDUAL.test(`${m.name} ${m.source}`)) out.push(`Metric "${m.name}" measures individual students; pilot outcomes are cohort aggregates only.`);
    if (!m.source.trim()) out.push(`Metric "${m.name}" has no source.`);
    if (!Number.isFinite(m.target)) out.push(`Metric "${m.name}" has no target.`);
  }

  if (c.responsibilities.semester.length === 0 || c.responsibilities.institution.length === 0) {
    out.push('Responsibilities must be written for both sides.');
  }
  if (!c.support) out.push('No support coverage: hours and a contact the cohort can reach.');
  if (!c.decisions.includes('stop')) out.push('"Stop" must be a real outcome, or the criteria were decoration.');
  if (!c.conversion.trim()) out.push('No conversion path to an annual agreement.');
  return out;
}

// ── The lifecycle ───────────────────────────────────────────────────────────

export const LIFECYCLE = ['discovery', 'configure', 'train', 'launch', 'hypercare', 'learn', 'decide'] as const;
export type LifecycleStage = (typeof LIFECYCLE)[number];

/** What must be true of a pilot before a stage is entered. */
export interface PilotState {
  charterSigned: boolean;
  charter: PilotCharter;
  /** Phase 0's council verdict for this cohort. */
  goNoGo: 'go' | 'no-go' | null;
  tenantConfigured: boolean;
  trainingDone: boolean;
  supportRoutingLive: boolean;
  baselineMeasured: boolean;
  weeksLive: number;
  outcomesMeasured: boolean;
}

const ENTRY: Record<LifecycleStage, (s: PilotState) => string[]> = {
  discovery: () => [],
  configure: (s) => [
    ...(s.charterSigned ? [] : ['The charter is not signed.']),
    ...charterProblems(s.charter).map((p) => `Charter: ${p}`),
  ],
  train: (s) => (s.tenantConfigured ? [] : ['The tenant is not configured.']),
  launch: (s) => [
    ...(s.trainingDone ? [] : ['Training is not done.']),
    ...(s.supportRoutingLive ? [] : ['Support routing is not live.']),
    ...(s.baselineMeasured ? [] : ['No baseline measured; the outcome would have nothing to be compared with.']),
    ...(s.goNoGo === 'go' ? [] : ['The launch council has not returned go for this cohort.']),
  ],
  hypercare: () => [],
  learn: (s) => (s.weeksLive >= 2 ? [] : ['Hypercare runs at least two weeks.']),
  decide: (s) => (s.outcomesMeasured ? [] : ['Outcomes are not measured against the baseline.']),
};

/** Why `to` cannot be entered from `from`; empty means it can. Stages are taken in order. */
export function advanceProblems(from: LifecycleStage, to: LifecycleStage, state: PilotState): string[] {
  const i = LIFECYCLE.indexOf(from);
  if (LIFECYCLE.indexOf(to) !== i + 1) return [`A pilot moves one stage at a time: ${from} is followed by ${LIFECYCLE[i + 1] ?? 'nothing'}.`];
  return ENTRY[to](state);
}

// ── Sales stages ────────────────────────────────────────────────────────────

export const SALES_STAGES = [
  'target_account', 'discovery', 'qualified', 'multi_stakeholder_demo', 'outcome_workshop',
  'technical_review', 'security_privacy_accessibility_review', 'proposal',
  'pilot_or_implementation_SOW', 'procurement_legal', 'contracted', 'implementation',
  'live', 'renewal', 'expansion', 'closed_lost',
] as const;
export type SalesStage = (typeof SALES_STAGES)[number];

/** What an opportunity must have before a stage is entered. */
export const SALES_EXIT: Partial<Record<SalesStage, string>> = {
  qualified: 'A named champion, a stated problem in their words, a budget cycle and a decision process.',
  outcome_workshop: 'The buying committee is mapped, including IT, privacy, accessibility and the academic sponsor.',
  proposal: 'Security, privacy and accessibility review has started, answered from the RFP library, never from memory.',
  pilot_or_implementation_SOW: 'A draft pilot charter with no charterProblems().',
  contracted: 'Procurement and legal have signed; the deal desk review has no refusals.',
  live: 'The launch council returned go for the first cohort.',
  renewal: 'The pilot reached its decide stage with outcomes measured.',
};

/**
 * Whether an opportunity may move to `to`. Forward moves skip nothing that
 * carries a gate; `closed_lost` is reachable from anywhere; a closed deal
 * reopens only as a new target account.
 */
export function salesMoveProblems(from: SalesStage, to: SalesStage): string[] {
  if (from === 'closed_lost') return ['A lost deal reopens as a new target account, with fresh discovery.'];
  if (to === 'closed_lost') return [];
  const a = SALES_STAGES.indexOf(from);
  const b = SALES_STAGES.indexOf(to);
  if (b <= a) return [`${to} comes before ${from}; move forward, or close the opportunity.`];
  const skipped = SALES_STAGES.slice(a + 1, b).filter((s) => SALES_EXIT[s]);
  return skipped.map((s) => `Skips ${s}: ${SALES_EXIT[s]}`);
}
