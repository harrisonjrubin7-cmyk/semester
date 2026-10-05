/**
 * Each AI capability as a governed product with a lifecycle, not one chat
 * feature: six gates, G0 to G5, each owned by a function of the NIST AI Risk
 * Management Framework (Govern, Map, Measure, Manage).
 *
 * The AI governance board (docs/operating-model/AI-GOVERNANCE-BOARD.md) says
 * who decides. This says what a use case must be able to show at each gate
 * before anyone decides, and in what order. `docs.test.ts` holds
 * docs/operating-model/AI-LIFECYCLE-GATES.md to every list here.
 *
 * Three rules are code rather than prose:
 *
 * - **Gates are sequential.** Evidence for G3 does not count while G1 is open;
 *   `standing()` stops at the first gate that is not complete. A pilot that
 *   skipped the risk map is not a pilot.
 * - **Some starting scopes are refused at intake.** A use case that makes an
 *   autonomous or consequential decision about a student — registering them,
 *   certifying a degree, deciding aid, discipline or health, or scoring them
 *   opaquely — does not enter the lifecycle at all. The framework is voluntary;
 *   this floor is not.
 * - **A pilot needs the whole release gate.** G3 requires every item of
 *   `AI_RELEASE_GATE`, including a working kill switch, which is the existing
 *   `kill.ai_generation` flag rather than a new mechanism.
 *
 * Nothing here reads the network, the database or the clock.
 */

export const NIST_FUNCTIONS = ['govern', 'map', 'measure', 'manage'] as const;
export type NistFunction = (typeof NIST_FUNCTIONS)[number];

export const NIST_LABEL: Record<NistFunction, string> = {
  govern: 'Govern',
  map: 'Map',
  measure: 'Measure',
  manage: 'Manage',
};

/** What each function asks for, across every use case. */
export const NIST_PRACTICES: Record<NistFunction, readonly string[]> = {
  govern: [
    'Named accountable executive',
    'Approved provider and model inventory',
    'Data-use and retention policy',
    'Course and institution policy hierarchy',
    'Human-review requirements',
    'Vendor and subprocessor review',
  ],
  map: [
    'Use-case registry entry',
    'Users, roles and context',
    'Data categories used',
    'Authorized source types',
    'High-risk outcomes and failure modes',
    'Academic-integrity, accessibility and fairness risks',
    'Fallback workflow',
  ],
  measure: [
    'Source-grounding rate',
    'Citation correctness',
    'Permission and policy-block accuracy',
    'Prompt-injection test results',
    'Hallucination and unsafe-output reports',
    'Latency and cost',
    'User usefulness feedback',
  ],
  manage: [
    'Feature flag and kill switch',
    'Model routing and rate limits',
    'Prompt and policy versioning',
    'Red-team regression suite',
    'Incident response and customer notification',
    'Corrective-action tracking',
  ],
};

export const GATE_IDS = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5'] as const;
export type GateId = (typeof GATE_IDS)[number];

export interface LifecycleGate {
  id: GateId;
  name: string;
  owner: NistFunction;
  /** The question the gate answers. */
  decision: string;
  /** What must exist before the gate is passed. */
  evidence: readonly string[];
}

export const LIFECYCLE: readonly LifecycleGate[] = [
  { id: 'G0', name: 'Intake', owner: 'govern', decision: 'Is this a permitted Semester use case?', evidence: ['User job', 'Intended outcome', 'Prohibited scope', 'Owner'] },
  { id: 'G1', name: 'Risk map', owner: 'map', decision: 'Are data, policy, authority and failure boundaries understood?', evidence: ['Data flow', 'Source inventory', 'Risk assessment', 'Policy mapping'] },
  { id: 'G2', name: 'Build', owner: 'map', decision: 'Can engineering begin?', evidence: ['Architecture', 'Threat model', 'Test plan', 'Fallback design'] },
  { id: 'G3', name: 'Pilot', owner: 'measure', decision: 'Is it safe for a named cohort?', evidence: ['Evaluation', 'Red-team', 'Accessibility test', 'Incident and support runbook'] },
  { id: 'G4', name: 'General availability', owner: 'manage', decision: 'Is it reliable and supportable across enabled tenants?', evidence: ['Pilot outcomes', 'SLOs', 'Monitoring', 'Documentation', 'Approval'] },
  { id: 'G5', name: 'Renewal or retirement', owner: 'manage', decision: 'Continue, improve, limit or remove it?', evidence: ['Quarterly risk, value, cost and incident review'] },
];

/** Every item must hold before G3. The last line of defence before a real cohort. */
export const AI_RELEASE_GATE = [
  'Intended purpose documented',
  'Data flow approved',
  'Authorized sources enforced',
  'Course and institution policy enforced',
  'Citations tested',
  'High-risk requests safely redirected',
  'Prompt-injection tests pass',
  'User can inspect and delete applicable history and output',
  'Output labelled as a generated draft where appropriate',
  'No consequential write without exact review and confirmation',
  'Monitoring, feedback and kill switch exist',
] as const;

/** The flag the release gate's kill switch means. `ai-lifecycle.test.ts` holds it to flags.ts. */
export const KILL_SWITCH = 'kill.ai_generation';

export const PROHIBITED_STARTING_SCOPE = [
  'Autonomous registration',
  'Official degree certification',
  'Financial-aid decisions',
  'Disciplinary judgments',
  'Health decisions',
  'Opaque risk scoring',
  'Automated hiring decisions',
  'Ranking students for employers',
  'Auto-publishing institutional policy',
  'Unapproved production changes',
] as const;
export type ProhibitedScope = (typeof PROHIBITED_STARTING_SCOPE)[number];

/** Bounded, source-aware use cases to start with, in order. */
export const STARTING_USE_CASES = [
  'Explain an approved course concept from selected source material',
  'Create a reviewable study plan from confirmed deadlines',
  'Generate practice questions with citations and feedback',
  'Draft an advisor agenda from student-selected planning details',
  'Explain requirement and course-option implications, stating estimates and linking to official paths',
] as const;

export interface UseCase {
  name: string;
  /** Anything on the prohibited list this use case would do. Empty to pass intake. */
  touches: readonly ProhibitedScope[];
  /** Evidence and release-gate items that exist, by their exact names. */
  evidence: ReadonlySet<string>;
}

export interface Standing {
  /** The last gate fully passed, or null if not even G0. */
  passed: GateId | null;
  /** The next gate, or null once G5 is passed. */
  next: GateId | null;
  /** What the next gate still lacks, in the order written. */
  missing: string[];
  /** Set when the use case is refused at intake. */
  refused?: string;
}

function requirements(g: LifecycleGate): readonly string[] {
  return g.id === 'G3' ? [...g.evidence, ...AI_RELEASE_GATE] : g.evidence;
}

/** Where a use case stands. Stops at the first incomplete gate. */
export function standing(u: UseCase): Standing {
  if (u.touches.length > 0) {
    return { passed: null, next: 'G0', missing: [], refused: `Outside Semester's permitted scope: ${u.touches.join(', ')}` };
  }
  let passed: GateId | null = null;
  for (const g of LIFECYCLE) {
    const missing = requirements(g).filter((e) => !u.evidence.has(e));
    if (missing.length > 0) return { passed, next: g.id, missing };
    passed = g.id;
  }
  return { passed, next: null, missing: [] };
}

/** A quarter, in days. A G5 review older than this means the use case is due again. */
export const RENEWAL_DAYS = 92;

/** Whether a use case is due its G5 review. Dates are ISO days, passed in. */
export function renewalDue(lastReview: string, today: string): boolean {
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastReview}T00:00:00Z`)) / 86_400_000;
  if (Number.isNaN(days)) throw new RangeError(`Not an ISO date: ${lastReview} or ${today}`);
  return days > RENEWAL_DAYS;
}
