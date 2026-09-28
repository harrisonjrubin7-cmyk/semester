/**
 * The launch command's sixteen higher-ed sales stages, and the gate before each.
 *
 * Pilot rules — readiness, the signed verdict, the buying committee and the
 * decision log — belong to `lib/gtm/pilot.ts` and the pipeline tables in
 * harrisonjrubin7-cmyk/semester#817, which came first. This file does not
 * restate them. It adds the finer stage vocabulary the launch command asks
 * for, and maps each stage onto #817's coarser account status so the two can
 * never describe the same account differently: `stages.test.ts` holds the
 * mapping to that migration's check constraint once it is on main.
 */

export const SALES_STAGES = [
  'target_account', 'discovery', 'qualified', 'multi_stakeholder_demo', 'outcome_workshop',
  'technical_review', 'security_privacy_accessibility_review', 'proposal',
  'pilot_or_implementation_SOW', 'procurement_legal', 'contracted', 'implementation',
  'live', 'renewal', 'expansion', 'closed_lost',
] as const;
export type SalesStage = (typeof SALES_STAGES)[number];

/** `gtm_accounts.status` in #817's migration. */
export const ACCOUNT_STATUSES = ['target', 'engaged', 'pilot', 'customer', 'paused', 'closed_lost'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/**
 * Where each stage sits in the account's status. A pilot SOW is signed before
 * the pilot runs, so it is still `engaged`; `implementation` of a pilot is the
 * pilot; `live` onwards is a customer. `paused` has no stage of its own: it is
 * a state an account enters from any stage and leaves back to the one it was in.
 */
export const ACCOUNT_STATUS_OF: Record<SalesStage, AccountStatus> = {
  target_account: 'target',
  discovery: 'engaged',
  qualified: 'engaged',
  multi_stakeholder_demo: 'engaged',
  outcome_workshop: 'engaged',
  technical_review: 'engaged',
  security_privacy_accessibility_review: 'engaged',
  proposal: 'engaged',
  pilot_or_implementation_SOW: 'engaged',
  procurement_legal: 'engaged',
  contracted: 'pilot',
  implementation: 'pilot',
  live: 'customer',
  renewal: 'customer',
  expansion: 'customer',
  closed_lost: 'closed_lost',
};

/** What an opportunity must have before a stage is entered. */
export const SALES_EXIT: Partial<Record<SalesStage, string>> = {
  qualified: 'A named champion, a stated problem in their words, a budget cycle and a decision process.',
  outcome_workshop: 'The buying committee is mapped, including IT, privacy, accessibility and the academic sponsor.',
  proposal: 'Security, privacy and accessibility review has started, answered from the RFP library, never from memory.',
  pilot_or_implementation_SOW: 'A pilot plan with no readiness problems (pilotReadiness in #817).',
  contracted: 'Procurement and legal have signed; the deal desk review has no refusals.',
  live: 'The launch council returned go for the first cohort.',
  renewal: 'The pilot has a signed, final verdict (pilotVerdict in #817) with outcomes measured.',
};

/**
 * Whether an opportunity may move to `to`. Forward moves skip nothing that
 * carries a gate, and the stage being entered has its own gate met: `met` is
 * the stages whose requirement the opportunity has already shown.
 * `closed_lost` is reachable from anywhere; a closed deal reopens only as a
 * new target account.
 */
export function salesMoveProblems(from: SalesStage, to: SalesStage, met: ReadonlySet<SalesStage> = new Set()): string[] {
  if (from === 'closed_lost') return ['A lost deal reopens as a new target account, with fresh discovery.'];
  if (to === 'closed_lost') return [];
  const a = SALES_STAGES.indexOf(from);
  const b = SALES_STAGES.indexOf(to);
  if (b <= a) return [`${to} comes before ${from}; move forward, or close the opportunity.`];
  const skipped = SALES_STAGES.slice(a + 1, b).filter((s) => SALES_EXIT[s]);
  const out = skipped.map((s) => `Skips ${s}: ${SALES_EXIT[s]}`);
  if (SALES_EXIT[to] && !met.has(to)) out.push(`Enters ${to} without: ${SALES_EXIT[to]}`);
  return out;
}
