/**
 * The architecture governance scorecard: does a request become product?
 *
 * Every proposed capability, and every tenant request that would change what
 * Semester does, is scored 0–3 on eleven criteria before anybody builds it.
 * The total out of 33 picks the route; a single 0 picks it on its own.
 *
 *   0 = unacceptable — reject or redesign
 *   1 = possible only with substantial governance
 *   2 = supported through standard configuration
 *   3 = reusable platform capability
 *
 * Why one zero overrides a high total: the criteria are not fungible. A
 * request that would fork the codebase, or cannot be rolled back, does not
 * become acceptable because it is also very reusable and very cheap. Summing
 * would let eleven points of enthusiasm buy one point of irreversibility, and
 * that trade is the failure this scorecard exists to stop.
 *
 * The rule the whole portfolio process answers to, written once:
 *
 *   If a university request cannot be configured, audited, tested, supported,
 *   rolled back, and reused, it should not become permanent core product code.
 *
 * See docs/operating-model/PORTFOLIO-GOVERNANCE.md.
 */

export type Criterion =
  | 'reusability'
  | 'security'
  | 'privacy'
  | 'accessibility'
  | 'integration'
  | 'operations'
  | 'cost'
  | 'configuration'
  | 'auditability'
  | 'rollback'
  | 'adoption';

export type Score = 0 | 1 | 2 | 3;

/** What each score means, criterion by criterion — the table reviewers score against. */
export const RUBRIC: Record<Criterion, readonly [string, string, string, string]> = {
  reusability: ['Only one customer needs it', 'Likely limited reuse', 'Could serve a segment', 'Broad reusable capability'],
  security: ['Weakens controls', 'New risk needs major review', 'Fits existing controls', 'Strengthens platform control'],
  privacy: ['Uses unnecessary or sensitive data', 'Needs a special data agreement', 'Fits classification rules', 'Improves minimization or transparency'],
  accessibility: ['Breaks established patterns', 'Needs substantial remediation', 'Meets component standards', 'Improves shared accessibility'],
  integration: ['One-off brittle connector', 'Custom transform required', 'Uses the adapter and mapping framework', 'Reusable provider connector'],
  operations: ['No owner or support plan', 'High manual burden', 'Standard runbook', 'Fully observable and self-service'],
  cost: ['Unbounded AI, compute or support cost', 'Requires special pricing', 'Known bounded cost', 'Efficient, shared economics'],
  configuration: ['Requires a code fork', 'Needs a scoped extension', 'Tenant configuration or flag', 'Standard product setting'],
  auditability: ['No trace', 'Partial logs', 'Versioned and audited', 'Full policy and evidence trail'],
  rollback: ['Irreversible', 'Manual rollback', 'Flag or configuration rollback', 'Instant kill switch or revert'],
  adoption: ['Unclear', 'One sponsor request', 'Validated workflow', 'Repeatable measurable outcome'],
};

export const CRITERIA = Object.keys(RUBRIC) as Criterion[];

export const MAX_SCORE = CRITERIA.length * 3;

export type Route =
  /** 27–33: build as a core, reusable platform capability. */
  | 'core'
  /** 21–26: build as a configurable module or approved extension. */
  | 'module'
  /** 15–20: pilot behind a tenant flag, with an explicit SOW and a sunset date. */
  | 'pilot'
  /** Under 15: partner, integrate, defer or decline. */
  | 'partner_or_decline'
  /** Any criterion scored 0: not buildable as asked, whatever the total. */
  | 'reject_or_redesign';

export const ROUTE_LABEL: Record<Route, string> = {
  core: 'Build as core reusable platform capability',
  module: 'Build as configurable module or approved extension',
  pilot: 'Pilot behind tenant flag with explicit SOW and sunset/review date',
  partner_or_decline: 'Partner, integrate, defer, or decline',
  reject_or_redesign: 'Reject, or redesign until nothing scores 0',
};

export interface Assessment {
  total: number;
  route: Route;
  /** The criteria that scored 0, which are what a redesign has to fix. */
  blockers: Criterion[];
  /** Criteria that scored 1: buildable, but each needs its named governance. */
  needsGovernance: Criterion[];
  /** Criteria nobody scored. An incomplete card is not assessed. */
  missing: Criterion[];
}

/**
 * Score a request. A card with any criterion unscored is reported as
 * incomplete (route `reject_or_redesign`, the unscored criteria in `missing`),
 * because a blank is not a 2 — it is somebody not having asked.
 */
export function assess(scores: Partial<Record<Criterion, Score>>): Assessment {
  const missing = CRITERIA.filter((c) => scores[c] === undefined);
  const blockers = CRITERIA.filter((c) => scores[c] === 0);
  const needsGovernance = CRITERIA.filter((c) => scores[c] === 1);
  const total = CRITERIA.reduce((sum, c) => sum + (scores[c] ?? 0), 0);
  let route: Route;
  if (missing.length > 0 || blockers.length > 0) route = 'reject_or_redesign';
  else if (total >= 27) route = 'core';
  else if (total >= 21) route = 'module';
  else if (total >= 15) route = 'pilot';
  else route = 'partner_or_decline';
  return { total, route, blockers, needsGovernance, missing };
}
