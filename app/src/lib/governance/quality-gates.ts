/**
 * The three quality gates a feature passes through: Ready, Done, Release.
 *
 * "We test features" answers one question. A quality-management system asks
 * three, at three different times, and each gate lists what must be true
 * rather than what somebody should remember. `gate` returns what is still
 * open, in the order written, so a release review reads down one list.
 *
 * Ready and Done are checked items; Release is signatures, because a release
 * decision is a person accepting a risk, not a box being ticked.
 *
 * See docs/operating-model/QUALITY-MANAGEMENT.md.
 */

export const DEFINITION_OF_READY = [
  'User problem defined',
  'Owner identified',
  'Data source known',
  'Policy and classification known',
  'Accessibility acceptance criteria written',
  'Design complete',
  'Test strategy defined',
  'Cost model understood',
  'Support and rollback plan ready',
] as const;

export const DEFINITION_OF_DONE = [
  'Code complete',
  'RLS and authorization tested',
  'Unit, integration and regression tests pass',
  'Accessibility tested',
  'Source and freshness visible',
  'Analytics privacy reviewed',
  'Monitoring added',
  'Docs and runbook updated',
  'Feature flag and kill switch available',
  'Support notes and release notes ready',
  'Rollback tested',
] as const;

export const RELEASE_APPROVALS = [
  'Product',
  'Engineering',
  'Security and privacy',
  'Accessibility',
  'Support and customer success',
  'Operational monitoring',
] as const;

export type Gate = 'ready' | 'done' | 'release';

export const GATE_ITEMS: Record<Gate, readonly string[]> = {
  ready: DEFINITION_OF_READY,
  done: DEFINITION_OF_DONE,
  release: RELEASE_APPROVALS,
};

export interface GateResult {
  passed: boolean;
  open: string[];
}

/**
 * What is still open at a gate. Release also needs the tenant or pilot
 * approval where the change reaches a tenant that asked to approve releases.
 */
export function gate(which: Gate, satisfied: ReadonlySet<string>, opts: { tenantApprovalRequired?: boolean } = {}): GateResult {
  const items = [...GATE_ITEMS[which]];
  if (which === 'release' && opts.tenantApprovalRequired) items.push('Tenant or pilot');
  const open = items.filter((i) => !satisfied.has(i));
  return { passed: open.length === 0, open };
}

/** The quality measures tracked each month, with the direction that is better. */
export const QUALITY_METRICS: readonly { name: string; better: 'lower' | 'higher' }[] = [
  { name: 'Defect escape rate', better: 'lower' },
  { name: 'Regression rate', better: 'lower' },
  { name: 'Mean time to detect', better: 'lower' },
  { name: 'Mean time to resolve', better: 'lower' },
  { name: 'Accessibility defect aging', better: 'lower' },
  { name: 'Source-freshness failures', better: 'lower' },
  { name: 'Connector failure recovery time', better: 'lower' },
  { name: 'AI evaluation failures', better: 'lower' },
  { name: 'Support contacts per feature', better: 'lower' },
  { name: 'Adoption against intended outcome', better: 'higher' },
];
