/**
 * A feature's readiness as one weighted number, and the ladder it climbs from
 * internal to enterprise — proof before scale.
 *
 * `quality-gates.ts` asks whether a change is ready, done and approved. This
 * asks a different question at a different time: is a *feature* ready to meet
 * more people than it has met so far? Eight dimensions, scored 0–100 by the
 * reviewer who owns each, weighted into a total.
 *
 * Two rules keep the total honest, for the same reason `scorecard.ts` lets one
 * zero override a high total:
 *
 * - **A floor on every dimension.** A feature that scores 100 on user value
 *   and 40 on accessibility has not averaged its way to ready. Any dimension
 *   under `FLOOR` blocks every stage past internal, whatever the total.
 * - **One rung at a time.** `promote()` refuses to skip a stage. A module
 *   goes from internal to design partner to pilot, and the evidence that it
 *   survived each is what earns the next.
 *
 * High-stakes features — assessment and grades — need a higher total at every
 * stage, because a wrong answer there is a student's mark.
 *
 * See docs/operating-model/QUALITY-MANAGEMENT.md#release-readiness.
 */

export const DIMENSIONS = [
  { key: 'user_value', label: 'User value', weight: 20, question: 'Does it solve a demonstrated student or institution job?' },
  { key: 'usability', label: 'Usability', weight: 15, question: 'Can target users finish the job unaided?' },
  { key: 'accessibility', label: 'Accessibility', weight: 15, question: 'Does it pass critical WCAG 2.2 and assistive-technology checks?' },
  { key: 'security_privacy', label: 'Security and privacy', weight: 15, question: 'Is data minimized, authorized, auditable and revocable?' },
  { key: 'reliability', label: 'Reliability', weight: 15, question: 'Does it have SLOs, monitoring, recovery and rollback?' },
  { key: 'data_trust', label: 'Data trust', weight: 10, question: 'Are source, freshness, uncertainty and limits visible?' },
  { key: 'supportability', label: 'Supportability', weight: 5, question: 'Can support explain, diagnose and resolve it?' },
  { key: 'commercial', label: 'Commercial readiness', weight: 5, question: 'Are scope, packaging and documentation ready to sell?' },
] as const;

export type Dimension = (typeof DIMENSIONS)[number]['key'];
export type Scores = Record<Dimension, number>;

export const STAGES = [
  { key: 'internal', label: 'Internal', evidence: 'Works with synthetic or test data, staff workflows and automated tests' },
  { key: 'design_partner', label: 'Design partner', evidence: 'Used by a narrow permissioned cohort under direct observation' },
  { key: 'pilot', label: 'Pilot', evidence: 'Used by real students or institution users under a defined agreement and support' },
  { key: 'ga', label: 'General availability', evidence: 'Meets adoption, reliability, accessibility, security and support evidence thresholds' },
  { key: 'enterprise', label: 'Enterprise', evidence: 'Meets contractual SLA, integration, migration, audit and 24/7 support requirements' },
] as const;

export type Stage = (typeof STAGES)[number]['key'];

/** The weighted total a stage needs. Internal needs nothing: that is where scores are earned. */
export const THRESHOLD: Record<Stage, { standard: number; highStakes: number }> = {
  internal: { standard: 0, highStakes: 0 },
  design_partner: { standard: 70, highStakes: 75 },
  pilot: { standard: 85, highStakes: 90 },
  ga: { standard: 90, highStakes: 95 },
  enterprise: { standard: 95, highStakes: 97 },
};

/** No dimension may be under this past internal. */
export const FLOOR = 60;

export function total(scores: Scores): number {
  let sum = 0;
  for (const d of DIMENSIONS) {
    const s = scores[d.key];
    if (!Number.isFinite(s) || s < 0 || s > 100) throw new RangeError(`${d.key} must be scored 0–100, not ${s}`);
    sum += s * d.weight;
  }
  return Math.round(sum) / 100;
}

export interface Promotion {
  allowed: boolean;
  total: number;
  needed: number;
  /** Why not, in the order checked. Empty when allowed. */
  reasons: string[];
}

/**
 * Whether a feature may move from `from` to `to`. Checks the rung, then the
 * floor, then the total, and reports every reason rather than the first.
 */
export function promote(from: Stage, to: Stage, scores: Scores, opts: { highStakes?: boolean } = {}): Promotion {
  const order = STAGES.map((s) => s.key);
  const reasons: string[] = [];
  if (order.indexOf(to) !== order.indexOf(from) + 1) {
    reasons.push(`${from} → ${to} skips or reverses a stage; promotion is one rung at a time`);
  }
  const t = total(scores);
  const needed = THRESHOLD[to][opts.highStakes ? 'highStakes' : 'standard'];
  if (to !== 'internal') {
    for (const d of DIMENSIONS) if (scores[d.key] < FLOOR) reasons.push(`${d.label} is ${scores[d.key]}, under the floor of ${FLOOR}`);
  }
  if (t < needed) reasons.push(`Total ${t} is under the ${needed} this stage needs`);
  return { allowed: reasons.length === 0, total: t, needed, reasons };
}
