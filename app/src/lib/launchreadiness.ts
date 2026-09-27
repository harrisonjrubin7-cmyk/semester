/**
 * The launch go/no-go, written as data so a test can hold it to its evidence.
 *
 * `docs/LAUNCH-READINESS-COUNCIL.md` is the prose half and says why this is a
 * function rather than a checklist. In short: every readiness document in this
 * repository has been wrong at least once, and a checkbox is ticked by whoever
 * is holding the pen. `decide()` can only answer `go` when the evidence it
 * cites exists, the named people have signed, and nothing it cannot waive is
 * open. There is deliberately no argument that forces the answer.
 *
 * Nothing here reads the network, the database or the clock. The state is
 * passed in, so the same inputs always give the same verdict, and a verdict can
 * be attached to a decision record and re-derived later from what it cites.
 */

/** A council seat. The ten from the launch command, in its order. */
export const SEATS = [
  'founder',
  'product',
  'engineering',
  'security',
  'privacy',
  'accessibility',
  'success',
  'trust',
  'data',
  'champion',
] as const;

export type Seat = (typeof SEATS)[number];

export interface SeatDefinition {
  seat: Seat;
  title: string;
  decides: string;
  /**
   * A role label once somebody has accepted the seat in writing — never a
   * personal address, and never a repository username standing in for an
   * accountability nobody accepted. `null` is vacant.
   */
  holder: string | null;
  /** The seat must be held by someone at the institution, not at Semester. */
  institutional?: true;
}

export const COUNCIL: readonly SeatDefinition[] = [
  { seat: 'founder', title: 'Founder / CEO', decides: 'Risk acceptance, customer commitment, commercial launch', holder: null },
  { seat: 'product', title: 'Product lead', decides: 'Golden path and its acceptance criteria', holder: null },
  { seat: 'engineering', title: 'Engineering lead', decides: 'Reliability, release, rollback', holder: null },
  { seat: 'security', title: 'Security / vCISO', decides: 'Threat model, pen-test findings, access controls', holder: null },
  { seat: 'privacy', title: 'Privacy / legal', decides: 'Terms, privacy, DPA/FERPA/COPPA posture, consent', holder: null },
  { seat: 'accessibility', title: 'Accessibility lead', decides: 'WCAG/VPAT status, blockers, remediation', holder: null },
  { seat: 'success', title: 'Customer success', decides: 'Onboarding, training, support, communication', holder: null },
  { seat: 'trust', title: 'Trust & Safety', decides: 'Reporting, escalation, moderation scope', holder: null },
  { seat: 'data', title: 'Data / integration owner', decides: 'Source quality, freshness, connector health', holder: null },
  { seat: 'champion', title: 'Pilot institution champion', decides: 'Institutional workflow and communications', holder: null, institutional: true },
];

export type GateStatus = 'met' | 'partial' | 'unmet';

/** A repository file that shows something, and what it shows. */
export interface Evidence {
  /** Repository-relative. A test fails if it does not exist. */
  path: string;
  shows: string;
}

export interface Gate {
  id: string;
  /** The requirement exactly as the launch command words it. */
  requirement: string;
  owner: Seat;
  status: GateStatus;
  /** What exists. Required for `met` and `partial`, and must exist on disk. */
  evidence: Evidence[];
  /** What is still missing. Required unless `met`. */
  gap?: string;
  /**
   * Lines of `docs/market-readiness/GO_LIVE_CHECKLIST.md` this gate depends
   * on. While any of them is unticked the gate cannot be `met` — the two
   * documents are not allowed to disagree.
   */
  goLive?: RegExp[];
}

const GO_LIVE = 'docs/market-readiness/GO_LIVE_CHECKLIST.md';

/**
 * The twelve go/no-go requirements, audited against `origin/main` at
 * `1dd79cd` on 2026-09-27. `docs/LAUNCH-READINESS-AUDIT.md` has the long form.
 *
 * Nothing is `met`. That is the finding, not a placeholder: the repository has
 * a great deal of the machinery, and none of these twelve is a statement about
 * machinery alone — each needs something to have been run, reviewed, agreed or
 * published.
 */
export const GATES: readonly Gate[] = [
  {
    id: 'golden-path',
    requirement: 'Golden student path passes end-to-end.',
    owner: 'product',
    status: 'partial',
    evidence: [
      { path: 'app/scripts/accessibility-smoke.mjs', shows: 'critical journeys driven in a real browser for accessibility' },
      { path: 'app/scripts/cold-smoke.mjs', shows: 'the built app boots cold in a browser' },
    ],
    gap: 'No scripted journey walks sign-in → Today → next action → Path/Plan → workspace → help → completion → resume on a second device, asserting each step. Phase 1.',
  },
  {
    id: 'no-blockers',
    requirement: 'No P0/P1 security, privacy, accessibility, reliability, or safety blocker.',
    owner: 'security',
    status: 'unmet',
    evidence: [{ path: GO_LIVE, shows: 'the blocking list, most of it unticked' }],
    gap: 'The go-live checklist still has unticked Blocking lines. Each is a release blocker by that document\'s own definition.',
    goLive: [/^- \[.\] /],
  },
  {
    id: 'staging-parity',
    requirement: 'Staging configuration mirrors intended production configuration.',
    owner: 'engineering',
    status: 'partial',
    evidence: [{ path: 'STAGING.md', shows: 'preview branches build per pull request; Edge Function parity settled' }],
    gap: 'STAGING.md itself says nobody has established that a preview branch matches production.',
  },
  {
    id: 'backup-restore',
    requirement: 'Backup/restore tested.',
    owner: 'engineering',
    status: 'partial',
    evidence: [
      { path: 'supabase/restore.sh', shows: 'a logical-dump restore rehearsal, run on 2026-09-21 and passing' },
      { path: 'RESTORE.md', shows: 'the production procedure, with every measurement still blank' },
    ],
    gap: 'The production project has never been restored: recovery point, recovery time and post-restore policy checks are all unmeasured, and the rehearsal is not in CI.',
    goLive: [/Restore tested from backup/, /Gateway journal backed up/],
  },
  {
    id: 'operations-live',
    requirement: 'Monitoring, alerting, incident process, status page, and support routing live.',
    owner: 'engineering',
    status: 'partial',
    evidence: [
      { path: '.github/workflows/production-smoke.yml', shows: 'hourly synthetic check of the public app, its assets and PostgREST' },
      { path: 'docs/market-readiness/INCIDENT_RESPONSE.md', shows: 'the incident process, written and never exercised' },
    ],
    gap: 'No alert reaches a named person and no support address exists that a university could be given. MONITORING.md declines a status page in writing; the command asks for one, so the council must uphold or overturn that refusal.',
    goLive: [/Error monitoring live and alerting/, /Incident process with named owner/],
  },
  {
    id: 'escalation-owners',
    requirement: 'Named escalation owners and response windows.',
    owner: 'success',
    status: 'partial',
    evidence: [{ path: 'docs/vanderbilt/incident-routing.md', shows: 'response windows per signal, every owner marked unassigned' }],
    gap: 'The response windows exist. Every owner is unassigned.',
  },
  {
    id: 'terms-reviewed',
    requirement: 'Terms, privacy, consent, and acceptable-use content reviewed.',
    owner: 'privacy',
    status: 'partial',
    evidence: [{ path: 'app/src/lib/privacy.ts', shows: 'the privacy disclosure written as data and tested against the code' }],
    gap: 'No qualified legal or privacy review of terms, privacy notice, consent or acceptable use has been recorded.',
  },
  {
    id: 'data-scope',
    requirement: 'Pilot data scope/source ownership approved.',
    owner: 'data',
    status: 'unmet',
    evidence: [],
    gap: 'No pilot data scope exists to approve, and no source owner has been named for any institutional content.',
  },
  {
    id: 'onboarding-support',
    requirement: 'Student/staff onboarding and accessibility support ready.',
    owner: 'success',
    status: 'unmet',
    evidence: [],
    gap: 'No quick-start, first-day checklist or accessibility support route for pilot users, and no accessibility audit of the piloted workflows.',
    goLive: [/Accessibility audit of the piloted workflows/],
  },
  {
    id: 'flags-rollback',
    requirement: 'Feature flags, kill switches, rollback runbooks tested.',
    owner: 'engineering',
    status: 'partial',
    evidence: [
      { path: 'ROLLBACK.md', shows: 'the rollback runbook, with measured timings' },
      { path: 'app/src/lib/flags.ts', shows: 'the flag registry, its evaluator, and six database-backed kill switches' },
      { path: 'docs/FEATURE-FLAG-REGISTRY.md', shows: 'each flag\'s owner and rollback, and the kill-switch runbook' },
    ],
    gap: 'No kill switch has been engaged against production, there is no app-wide read-only mode, and rollback has not been tested on the production deployment path.',
    goLive: [/Rollback tested on the production deployment path/],
  },
  {
    id: 'pilot-outcome',
    requirement: 'Pilot outcome baseline and decision criteria agreed.',
    owner: 'champion',
    status: 'partial',
    evidence: [{ path: 'docs/market-readiness/PILOT_PLAYBOOK.md', shows: 'which criteria to agree, and that stop must be a real option' }],
    gap: 'The criteria to agree are listed. Nothing has been agreed with any institution, and no baseline has been measured.',
  },
  {
    id: 'known-limitations',
    requirement: 'Known limitations published internally and appropriately to pilot users.',
    owner: 'product',
    status: 'partial',
    evidence: [{ path: 'SEMESTER_MARKET_READINESS.md', shows: 'the internal scorecard, including how it has been wrong' }],
    gap: 'Published internally. Nothing is written for pilot users.',
  },
];

/** The eight parts of the launch condition, each resolved to gates. */
export const CONDITION: readonly { part: string; gates: string[] }[] = [
  { part: 'One excellent golden journey', gates: ['golden-path'] },
  { part: 'one controlled beta', gates: ['flags-rollback', 'known-limitations'] },
  { part: 'one named institutional champion', gates: ['pilot-outcome'] },
  { part: 'one approved data scope', gates: ['data-scope'] },
  { part: 'one support and incident process', gates: ['operations-live', 'escalation-owners'] },
  { part: 'one real trust/accessibility/privacy evidence package', gates: ['no-blockers', 'terms-reviewed', 'onboarding-support'] },
  { part: 'one measurable pilot outcome', gates: ['pilot-outcome'] },
  { part: 'one repeatable implementation path', gates: ['staging-parity', 'backup-restore'] },
];

export type Severity = 'P0' | 'P1' | 'P2' | 'P3';

export interface Blocker {
  id: string;
  severity: Severity;
  summary: string;
  /** The gate it holds shut, if any. */
  gate?: string;
}

export interface RiskAcceptance {
  blocker: string;
  by: Seat;
  reason: string;
  /** ISO date. Required; an acceptance nobody has to revisit is not one. */
  expires: string;
}

export interface LaunchState {
  gates: readonly Gate[];
  council: readonly SeatDefinition[];
  signoffs: readonly Seat[];
  blockers: readonly Blocker[];
  acceptances: readonly RiskAcceptance[];
  /** ISO date the decision is taken on, so expiry is judged without a clock. */
  on: string;
}

export interface Verdict {
  verdict: 'go' | 'no-go';
  reasons: string[];
}

/** Only these may be waived, and only by this seat. */
const WAIVABLE: readonly Severity[] = ['P2', 'P3'];
const ACCEPTS_RISK: Seat = 'founder';

/**
 * Why each acceptance does not count, or nothing if it does. Split out because
 * an invalid acceptance is itself a reason for `no-go`: a waiver that is
 * silently ignored reads, to whoever wrote it, as a waiver that worked.
 */
export function invalidAcceptances(state: LaunchState): string[] {
  const reasons: string[] = [];
  for (const a of state.acceptances) {
    const blocker = state.blockers.find((b) => b.id === a.blocker);
    if (!blocker) reasons.push(`Risk acceptance names ${a.blocker}, which is not an open blocker.`);
    else if (!WAIVABLE.includes(blocker.severity)) {
      reasons.push(`${blocker.id} is ${blocker.severity}; a ${blocker.severity} cannot be accepted, only fixed.`);
    }
    if (a.by !== ACCEPTS_RISK) reasons.push(`Risk acceptance for ${a.blocker} is by ${a.by}; only ${ACCEPTS_RISK} accepts risk.`);
    if (!a.reason.trim()) reasons.push(`Risk acceptance for ${a.blocker} gives no reason.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.expires)) reasons.push(`Risk acceptance for ${a.blocker} has no valid expiry.`);
    else if (a.expires <= state.on) reasons.push(`Risk acceptance for ${a.blocker} expired on ${a.expires}.`);
  }
  return reasons;
}

/**
 * The go/no-go. Every reason is collected rather than stopping at the first,
 * because the list is the agenda for the next council meeting and a verdict
 * that names one problem hides the other eleven.
 */
export function decide(state: LaunchState): Verdict {
  const reasons: string[] = [];

  for (const gate of state.gates) {
    if (gate.status !== 'met') reasons.push(`${gate.id}: ${gate.status} — ${gate.gap ?? 'no gap recorded'}`);
    else if (gate.evidence.length === 0) reasons.push(`${gate.id}: marked met with no evidence.`);
  }

  for (const part of CONDITION) {
    const open = part.gates.filter((id) => state.gates.find((g) => g.id === id)?.status !== 'met');
    if (open.length > 0) reasons.push(`Launch condition “${part.part}” is not satisfied (${open.join(', ')}).`);
  }

  for (const seat of state.council) {
    if (seat.holder === null) reasons.push(`Seat ${seat.seat} is vacant.`);
    else if (!state.signoffs.includes(seat.seat)) reasons.push(`Seat ${seat.seat} has not signed.`);
  }

  const invalid = invalidAcceptances(state);
  reasons.push(...invalid);
  const accepted = new Set(
    state.acceptances
      .filter((a) => invalidAcceptances({ ...state, acceptances: [a] }).length === 0)
      .map((a) => a.blocker),
  );
  for (const blocker of state.blockers) {
    if (!accepted.has(blocker.id)) reasons.push(`Open ${blocker.severity} ${blocker.id}: ${blocker.summary}`);
  }

  return { verdict: reasons.length === 0 ? 'go' : 'no-go', reasons };
}

/** Where things stand. What the council would be handed today. */
export const CURRENT: LaunchState = {
  gates: GATES,
  council: COUNCIL,
  signoffs: [],
  blockers: [],
  acceptances: [],
  on: '2026-09-27',
};
