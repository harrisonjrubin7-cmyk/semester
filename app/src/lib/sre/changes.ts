/**
 * Change management as a gate that can say no.
 *
 * Four classes of change, what each must carry before it ships, and whether a
 * freeze window stops it. The point of writing the gate as a function is the
 * same as for the error budget: a rule that is only prose gets argued at
 * 11 p.m. before a deadline; a rule that returns `allowed: false` with reasons
 * gets argued with once, in a pull request.
 *
 * Freeze windows are **inputs**, not data in this file. DEGRADED-MODE-MAP.md
 * lists "the freeze calendar and an on-call name" as owner decisions not yet
 * made. The gate takes whatever calendar the owner approves; with none, it
 * refuses to call a high-risk change safe (`no_calendar`), because "no freeze
 * is defined" is not the same as "no freeze applies".
 */

export type ChangeClassId = 'standard' | 'normal' | 'high_risk' | 'emergency';

export interface ChangeClass {
  id: ChangeClassId;
  label: string;
  /** Examples that place a change in this class. */
  examples: string;
  /** What must exist before it ships. */
  requires: readonly string[];
  /** Whether a freeze window blocks it. */
  blockedByFreeze: boolean;
  /** Approvals beyond passing CI. */
  approvals: number;
}

export const CHANGE_CLASSES: readonly ChangeClass[] = [
  {
    id: 'standard', label: 'Standard', examples: 'Copy, style, a flagged-off feature, a dependency patch with green CI',
    requires: ['green CI'], blockedByFreeze: false, approvals: 1,
  },
  {
    id: 'normal', label: 'Normal', examples: 'A behaviour change to a live journey, a new edge function, a new job',
    requires: ['green CI', 'rollback plan', 'named owner for the affected component', 'catalog row and runbook for anything new'],
    blockedByFreeze: true, approvals: 1,
  },
  {
    id: 'high_risk', label: 'High risk', examples: 'A schema migration, a secret rotation, a change to auth, policy, billing or retention, a configuration tier-3 setting',
    requires: ['green CI', 'rollback plan rehearsed on staging', 'fresh backup reference', 'expand/contract shape for schema', 'second person approves', 'announce window'],
    blockedByFreeze: true, approvals: 2,
  },
  {
    id: 'emergency', label: 'Emergency', examples: 'A fix for an open P0 or P1 incident',
    requires: ['open incident id', 'incident commander approves', 'post-incident review scheduled within five business days'],
    blockedByFreeze: false, approvals: 1,
  },
];

export interface FreezeWindow {
  id: string;
  label: string;
  /** Inclusive ISO dates, UTC. */
  from: string;
  to: string;
}

export interface Change {
  class: ChangeClassId;
  /** Evidence items the author attached, matching `requires` by text. */
  attached: readonly string[];
  approvals: number;
  /** Open incident id; required for an emergency. */
  incident?: string;
  /** The date the change would ship. */
  on: string;
}

export interface GateResult {
  allowed: boolean;
  reasons: string[];
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function frozenBy(on: string, windows: readonly FreezeWindow[]): FreezeWindow | undefined {
  if (!ISO.test(on)) throw new RangeError(`A change date is YYYY-MM-DD, not ${on}`);
  return windows.find((w) => {
    if (!ISO.test(w.from) || !ISO.test(w.to) || w.to < w.from) throw new RangeError(`Freeze window ${w.id} is malformed`);
    return on >= w.from && on <= w.to;
  });
}

/**
 * Whether a change may ship. `windows` is the owner-approved calendar, or
 * `null` when none exists, which blocks high-risk changes rather than waving
 * them through.
 */
export function gate(change: Change, windows: readonly FreezeWindow[] | null): GateResult {
  const cls = CHANGE_CLASSES.find((c) => c.id === change.class);
  if (!cls) throw new Error(`No change class ${change.class}`);
  const reasons: string[] = [];

  for (const need of cls.requires) {
    if (need === 'open incident id' ? !change.incident : !change.attached.includes(need)) reasons.push(`missing: ${need}`);
  }
  if (change.approvals < cls.approvals) reasons.push(`needs ${cls.approvals} approval${cls.approvals === 1 ? '' : 's'}, has ${change.approvals}`);

  if (cls.blockedByFreeze) {
    if (windows === null) {
      if (cls.id === 'high_risk') reasons.push('no_calendar: no freeze calendar has been approved, so a high-risk change cannot be called safe');
    } else {
      const w = frozenBy(change.on, windows);
      if (w) reasons.push(`frozen: ${w.label} (${w.from} to ${w.to})`);
    }
  }
  return { allowed: reasons.length === 0, reasons };
}

/**
 * The periods that earn a freeze, in priority order — the owner's proposal in
 * DEGRADED-MODE-MAP.md "Critical periods", kept here so a calendar can be
 * generated from the academic calendar and checked against it.
 */
export const CRITICAL_PERIODS: readonly { id: string; label: string; stops: string }[] = [
  { id: 'registration', label: 'Registration windows and add/drop deadlines', stops: 'Deploys, migrations, secret rotation' },
  { id: 'first-week', label: 'First week of term', stops: 'Deploys and migrations' },
  { id: 'finals', label: 'Finals and grade release', stops: 'Anything touching records or deadlines' },
  { id: 'billing', label: 'Billing run and due date', stops: 'Billing, auth and migration changes' },
  { id: 'partner-launch', label: 'A partner school\'s launch week', stops: 'Connector and SSO changes' },
];
