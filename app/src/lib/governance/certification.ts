import { SEATS, type Seat } from '../launchreadiness';

/**
 * The release-certification register: every Semester domain on one ladder,
 * the production-certified GO gate the whole platform must pass before any
 * external pilot, and the council that signs it.
 *
 * `docs/operating-model/RELEASE-CERTIFICATION.md` is rendered from this file
 * by `certification.test.ts`; edit the data, then `npm run registers` from
 * app/.
 *
 * ## The model
 *
 * Four documents of 29 September 2026 set it, and the founder chose the last
 * of them: **build everything, certify GO internally, then pilot.** A pilot is
 * a deployment and refinement programme — adoption, configuration, workflow
 * fit, commercial evidence — never the first time a critical feature runs.
 *
 *   Built → Internally verified → Production-certified GO
 *         → Pilot deployed → Pilot refined → Generally available
 *
 * Built does not mean enabled; GO does not mean every module is on for every
 * school. Each school's configuration decides what appears (`flags.ts`
 * evaluates it; `rollout.ts` moves the school through its own gates).
 *
 * ## What is held
 *
 * **A status cannot claim more than its evidence.** `ceiling()` computes the
 * highest rung a domain's evidence supports and the test refuses a status
 * above it: `designed` needs a spec in the tree; `built` needs code;
 * `internally_verified` needs all four checks passed, not partial;
 * `go_certified` needs the platform's GO decision; `pilot_deployed` needs a
 * pilot with a named sponsor and cohort that activates the domain;
 * `pilot_refined` needs evidence from real users, which is a file.
 *
 * **GO is computed, never declared.** `goDecision()` applies the eight
 * conditions a full GO requires — no P0, no unverified production control, no
 * domain short of internally verified, no seat unsigned — and returns every
 * reason it is not GO. The test states that list, so a gate item passing or a
 * seat signing is a line in a diff with a reviewer looking at it.
 *
 * **A gate item that claims progress cites a file, and the file exists.** A
 * supplied PDF is never evidence; a drill that has not been run is `owed`
 * however good its script is.
 *
 * Nothing here reads the network, the database or the clock.
 */

/** The ladder, lowest first. `deprecated` sits apart: it is an exit, not a rung. */
export const LADDER = [
  { key: 'designed', label: 'Designed', meaning: 'Product, data, permission and UX specification exists' },
  { key: 'built', label: 'Built', meaning: 'Code, data model, UI, tests and configuration exist' },
  { key: 'internally_verified', label: 'Internally verified', meaning: 'Automated, security, accessibility and privacy checks all pass' },
  { key: 'go_certified', label: 'Production-certified GO', meaning: 'The platform passed the GO gate and every council seat signed' },
  { key: 'pilot_deployed', label: 'Pilot deployed', meaning: 'Activated for a named institution’s cohort under a signed pilot' },
  { key: 'pilot_refined', label: 'Pilot refined', meaning: 'Real users completed the workflow; learnings folded into configuration' },
  { key: 'generally_available', label: 'Generally available', meaning: 'Supported, documented, monitored and contractually sellable' },
  { key: 'enterprise_ready', label: 'Enterprise-ready', meaning: 'Governed, integrated, audited, scalable and operationally supported' },
] as const;

export type Rung = (typeof LADDER)[number]['key'];
export type Status = Rung | 'deprecated';

export const CHECKS = [
  { key: 'automated', label: 'Automated tests' },
  { key: 'security', label: 'Security' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'privacy', label: 'Privacy' },
] as const;

export type CheckKey = (typeof CHECKS)[number]['key'];
export type State = 'passed' | 'partial' | 'owed';

export interface Check {
  state: State;
  /** A path in the tree for `passed` and `partial`; null for `owed`. */
  evidence: string | null;
  note: string;
}

/** How a pilot activates a domain: on, on once a named condition holds, or off. */
export type Activation = 'on' | 'conditional' | 'off';

export interface Domain {
  key: string;
  name: string;
  status: Status;
  owner: Seat;
  /** The specification a `designed` status rests on. */
  spec: string | null;
  /** The code a `built` status rests on; empty when nothing is built. */
  code: readonly string[];
  checks: Record<CheckKey, Check>;
  /** Keys from `flags.ts` that gate the domain; the test holds each to FLAGS. */
  flags: readonly string[];
  /** Moves money, a grade, an official record or an assignment. */
  highRisk: boolean;
  /** How the first pilot activates it, and — when conditional — on what. */
  activation: Activation;
  activationCondition: string;
  /** Evidence from real users; null until a pilot produces it. */
  pilotEvidence: string | null;
  /** What building it out still needs before it can be internally verified. */
  toComplete: string;
}

// The checks most domains share today, stated once so a change is one line.
const SECURITY_PARTIAL: Check = {
  state: 'partial',
  evidence: 'docs/DEFINER-RLS-REGISTER.md',
  note: 'Production matches the approved advisor baseline one for one (T-3); no penetration test, and the negative checks have run on a copy of the schema, not against production.',
};
const A11Y_PARTIAL: Check = {
  state: 'partial',
  evidence: 'app/src/a11y/axe.test.tsx',
  note: 'Automated axe checks run in the suite; manual keyboard, screen-reader, zoom and mobile QA is owed.',
};
const PRIVACY_PARTIAL: Check = {
  state: 'partial',
  evidence: 'docs/MODULE-PRIVACY-MODEL.md',
  note: 'Defaults and roles are modelled; export, deletion and revocation have not been exercised against production.',
};
const tested = (evidence: string, note: string): Check => ({ state: 'passed', evidence, note });
const shared = (automated: Check): Record<CheckKey, Check> => ({ automated, security: SECURITY_PARTIAL, accessibility: A11Y_PARTIAL, privacy: PRIVACY_PARTIAL });
const VERIFY = 'Pass the security, manual accessibility and privacy checks.';

export const DOMAINS: readonly Domain[] = [
  {
    key: 'identity', name: 'Identity and accounts', status: 'built', owner: 'engineering',
    spec: 'docs/SSO-SECURITY-AND-SESSION-MANAGEMENT.md',
    code: ['app/src/lib/cloud.ts', 'app/src/screens/Recovery.tsx'],
    checks: shared(tested('app/src/lib/cloud.test.ts', 'Sign-in, sign-up and recovery paths are held by the suite.')),
    flags: [], highRisk: false, activation: 'on', activationCondition: '', pilotEvidence: null,
    toComplete: `Institutional SSO and MFA. ${VERIFY}`,
  },
  {
    key: 'path', name: 'Path and planning', status: 'built', owner: 'product',
    spec: 'docs/GRADUATION-AND-COST-SIMULATOR.md',
    code: ['app/src/lib/pathway.ts', 'app/src/screens/Pathway.tsx', 'app/src/lib/plans.ts', 'app/src/lib/conflicts.ts'],
    checks: shared(tested('app/src/lib/conflicts.test.ts', 'Plans, the path grid and conflict detection are held by the suite.')),
    flags: ['experiment.today_action_ranking_v2'], highRisk: false, activation: 'on', activationCondition: '', pilotEvidence: null,
    toComplete: VERIFY,
  },
  {
    key: 'registration_prep', name: 'Registration readiness and advising', status: 'built', owner: 'product',
    spec: 'docs/ADVISOR-MEETING-MODE.md',
    code: ['app/src/lib/registration-plan.ts', 'app/src/lib/registration-day.ts', 'app/src/lib/advisor-meeting.ts'],
    checks: shared(tested('app/src/lib/advisor-meeting.test.ts', 'The advisor agenda and registration-day plan are held by the suite.')),
    flags: ['scope.sis.registration_hold_summary_read'], highRisk: false, activation: 'on', activationCondition: '', pilotEvidence: null,
    toComplete: VERIFY,
  },
  {
    key: 'source_labels', name: 'Source and freshness labels', status: 'built', owner: 'data',
    spec: 'docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md',
    code: ['app/src/lib/source.ts'],
    checks: shared(tested('app/src/lib/source.test.ts', 'The five source labels are held to the database’s check constraint.')),
    flags: ['module.source_freshness_cards'], highRisk: false, activation: 'on', activationCondition: '', pilotEvidence: null,
    toComplete: `Per-object lineage, not only per source. ${VERIFY}`,
  },
  {
    key: 'support', name: 'Feedback and support', status: 'built', owner: 'success',
    spec: 'docs/GO-NO-GO-CHECKLIST.md',
    code: ['app/src/lib/support.ts', 'app/src/lib/supporttickets.ts', 'app/src/screens/Support.tsx'],
    checks: shared(tested('app/src/lib/supporttickets.test.ts', 'Ticket creation and routing are held by the suite.')),
    flags: [], highRisk: false, activation: 'on', activationCondition: '', pilotEvidence: null,
    toComplete: `A staffed queue with an escalation rota. ${VERIFY}`,
  },
  {
    key: 'ai', name: 'AI assistance and actions', status: 'built', owner: 'trust',
    spec: 'docs/operating-model/AI-LIFECYCLE-GATES.md',
    code: ['app/src/lib/assistant.ts', 'app/src/lib/aiflags.ts'],
    checks: shared(tested('app/src/lib/aikillswitch.test.ts', 'The kill switch and injection fencing are held by the suite.')),
    flags: ['ops.external_ai_generation'], highRisk: false,
    activation: 'conditional', activationCondition: 'Per course, institution and policy scope.', pilotEvidence: null,
    toComplete: `Run and record the live red-team and kill-switch drills. ${VERIFY}`,
  },
  {
    key: 'institution_console', name: 'Institution console', status: 'built', owner: 'operations',
    spec: 'docs/operating-model/PILOT-TO-PRODUCTION.md',
    code: ['app/src/screens/Console.tsx', 'app/src/lib/ops/console.ts'],
    checks: shared(tested('app/src/screens/console.test.tsx', 'The console’s views are held by the suite.')),
    flags: ['module.integration_dashboard', 'module.institutional_operations'], highRisk: false,
    activation: 'conditional', activationCondition: 'For the sponsor’s named administrators only.', pilotEvidence: null,
    toComplete: `A release-certification view of this register. ${VERIFY}`,
  },
  {
    key: 'native_lms', name: 'Native LMS and Course Studio', status: 'built', owner: 'product',
    spec: 'docs/FACULTY-COURSE-STUDIO-DESIGN.md',
    code: ['app/src/lib/coursestudio.ts', 'supabase/migrations/20260928309000_course_studio.sql'],
    checks: shared(tested('app/src/lib/coursestudio.test.ts', 'Course shells and studio drafts are held by the suite.')),
    flags: ['integration.lms_lti', 'scope.lms.assignment_dates_read'], highRisk: false,
    activation: 'conditional', activationCondition: 'For one department or course group.', pilotEvidence: null,
    toComplete: `Submissions, rubrics and assessments end to end. ${VERIFY}`,
  },
  {
    key: 'career_community', name: 'Career and community', status: 'built', owner: 'trust',
    spec: 'docs/COMMUNITY-PRIVACY-MODEL.md',
    code: ['app/src/lib/career.ts', 'app/src/screens/Community.tsx', 'supabase/migrations/20260928032000_community.sql'],
    checks: shared(tested('app/src/screens/Community.test.tsx', 'Community screens and moderation paths are held by the suite.')),
    flags: ['safety.scoped_pseudonymity', 'safety.volunteer_moderation', 'safety.institution_escalation'], highRisk: false,
    activation: 'conditional', activationCondition: 'After student opt-in, employer review, and staffed moderation.', pilotEvidence: null,
    toComplete: `Employer review and a staffed moderation rota. ${VERIFY}`,
  },
  {
    key: 'housing', name: 'Housing', status: 'built', owner: 'product',
    spec: 'docs/BASIC-NEEDS-NAVIGATOR.md',
    code: ['app/src/lib/housing.ts', 'app/src/screens/Housing.tsx'],
    checks: shared(tested('app/src/lib/housing.test.ts', 'The student-side housing sums are held by the suite.')),
    flags: [], highRisk: true,
    activation: 'conditional', activationCondition: 'Only for an institution with housing configuration.', pilotEvidence: null,
    toComplete: `Room selection, contracts and maintenance: today it is a student-side calculator. ${VERIFY}`,
  },
  {
    key: 'registration_transaction', name: 'Official registration transaction', status: 'built', owner: 'data',
    spec: 'docs/FEATURE-FLAG-REGISTRY.md',
    code: ['app/src/lib/enrollment/service.ts', 'supabase/migrations/20260929300000_registration_transaction.sql'],
    checks: shared(tested('supabase/registration_transaction.check.sql', 'Enroll, waitlist, drop, withdraw, holds and overrides, allowed and denied; the last seat cannot be taken twice.')),
    flags: ['writeback.registration_submit', 'integration.sis_read'], highRisk: true,
    activation: 'conditional', activationCondition: 'For selected students and the registrar role, after registrar approval.', pilotEvidence: null,
    toComplete: `An SIS adapter to send committed changes; holds and completions synced from the SIS; per-student time tickets; ${VERIFY}`,
  },
  {
    key: 'gradebook', name: 'Official gradebook and grade passback', status: 'built', owner: 'data',
    spec: 'docs/FEATURE-FLAG-REGISTRY.md',
    code: ['app/src/lib/gradebook/ledger.ts', 'app/src/lib/gradebook/passback.ts', 'supabase/migrations/20260929310000_gradebook.sql'],
    checks: shared(tested('supabase/gradebook.check.sql', 'Drafts visible only to the course’s authors, released grades to their student, append-only history, passback of released versions only.')),
    flags: ['writeback.lms_grade_passback'], highRisk: true,
    activation: 'conditional', activationCondition: 'Only after faculty and registrar approval.', pilotEvidence: null,
    toComplete: `A live LTI grade-passback sender. \`Grades.tsx\` stays the student’s own arithmetic. ${VERIFY}`,
  },
  {
    key: 'student_accounts', name: 'Student accounts and payment plans', status: 'built', owner: 'finance',
    spec: 'docs/FINANCIAL-READINESS-WORKSPACE.md',
    code: [
      'supabase/migrations/20260929220000_student_accounts.sql', 'supabase/migrations/20260929230000_student_payment_plans.sql',
      'app/src/components/MyStudentAccount.tsx', 'app/src/components/MyStudentAccount.test.tsx',
      'app/src/components/institutional/StudentAccounts.tsx', 'app/src/components/institutional/StudentAccounts.test.tsx',
      'supabase/student-payment-plans.check.sql',
    ],
    checks: shared(tested('supabase/student-accounts.check.sql', 'The ledger written only by a second person’s approval, high-value approval over the threshold, no card stored, reconciliation and close, and a linked student reading only their own account, allowed and denied; student-payment-plans.check.sql holds the plans the same way.')),
    // Gated by the build's `studentAccounts` experience flag (D-146) and the
    // finance:* capabilities, not by a key in flags.ts.
    flags: [], highRisk: true,
    activation: 'conditional', activationCondition: 'Only where the build sets studentAccounts, for a school’s offices holding finance:* capabilities and the students an approver has linked; payments stay on the school’s hosted provider.', pilotEvidence: null,
    toComplete: `No money moves in Semester: no payment is taken, no refund paid out, no aid awarded or disbursed and no registration hold placed — each is an entry a second person approves. Charges and aid credits still arrive by a person’s request rather than from the school’s SIS or aid system, and the finance seat is vacant; ${VERIFY}`,
  },
  {
    key: 'dining', name: 'Dining and campus card', status: 'built', owner: 'product',
    spec: 'docs/BASIC-NEEDS-NAVIGATOR.md',
    code: ['app/src/lib/dining/service.ts', 'app/src/lib/dining/orders.ts', 'supabase/migrations/20260929330000_dining.sql'],
    checks: shared(tested('supabase/dining.check.sql', 'Plans, ledger, orders held to capacity and the shared-swipe pool, allowed and denied; staff cannot tell a shared swipe.')),
    flags: ['module.dining'], highRisk: true,
    activation: 'conditional', activationCondition: 'When a campus-card or dining partner configuration is ready.', pilotEvidence: null,
    toComplete: `A real card-office vendor adapter and a sync schedule; ${VERIFY}`,
  },
];

// ── The GO gate ─────────────────────────────────────────────────────────────

export const GATE_SECTIONS = {
  product: 'Full product completion',
  technical: 'Full technical verification',
  trust: 'Full trust verification',
  accessibility: 'Full accessibility verification',
  operations: 'Full operations verification',
  company: 'Full company verification',
} as const;

export type GateSection = keyof typeof GATE_SECTIONS;

export interface GateItem {
  id: string;
  section: GateSection;
  item: string;
  state: State;
  evidence: string | null;
  note: string;
  /** Items the documents name as conditions of a full GO: open means NOT GO whatever else passes. */
  p0: boolean;
}

const g = (id: string, section: GateSection, item: string, state: State, evidence: string | null, note: string, p0 = false): GateItem => ({ id, section, item, state, evidence, note, p0 });

export const GO_GATE: readonly GateItem[] = [
  g('P-1', 'product', 'Every planned module has UI, service layer, schema, API and permissions.', 'partial', 'app/src/lib/governance/certification.ts', 'Every domain has a service layer, schema, permissions and a screen (registration, gradebook and dining screens arrived last, each saying in one sentence when its school has it off; student accounts has the student’s view on Bill and the staff ledger on University); none has a live vendor or SIS adapter behind it, and none takes a payment.', true),
  g('P-2', 'product', 'Every module has loading, empty, error, stale and degraded states.', 'partial', 'docs/EMPTY-LOADING-ERROR-SUCCESS-STATES.md', 'Specified; not audited module by module.'),
  g('P-3', 'product', 'Every module has tenant, role, cohort and feature configuration.', 'partial', 'app/src/lib/flags.ts', 'Tenant, cohort, role and feature scopes exist in the evaluator and the database; not every module is yet behind a flag.'),
  g('T-1', 'technical', 'Unit tests for all domain logic.', 'partial', 'REGRESSION-CHECKLIST.md', 'A large suite runs in order and shuffled; unbuilt domains have none.'),
  g('T-2', 'technical', 'Tenant-isolation, RLS and SECURITY DEFINER tests.', 'partial', 'docs/drills/security-suites-preview-2026-10-01.md', 'The last full no-data preview run passed 67 of 95 suites. The next approved caller grants and duplicate-history repair are applied; strict catalog/ACL verification passes. The full fixture rerun is blocked by expired connector approval requests, so the historical count is not recertified. Production was not touched.', true),
  g('T-3', 'technical', 'Production RLS, grants and function remediation applied and verified.', 'passed', 'docs/DEFINER-RLS-REGISTER.md', 'Read on production at 21:38 UTC on 29 September: the remediation migrations are applied, and the security advisor lists exactly the 151 callable definer functions and 45 policy-less tables the register gives a disposition, one for one, with nothing at error level.', true),
  g('T-4', 'technical', 'Webhook replay, idempotency, ordering and signature tests.', 'passed', 'app/src/lib/billing/webhook.test.ts', 'The Stripe webhook’s signature and replay are held.'),
  g('T-5', 'technical', 'Load tests for registration, learning, search, gradebook and notifications.', 'partial', 'supabase/load.sh', 'Concurrency scenarios for flag reads, plan saves and demand reads run against the full schema, and found and fixed a plan-save deadlock; since D-1019 the same run is four windows, and fails a scenario that gets slower or leaks a connection. Registration, gradebook and notification scenarios are owed, as are large-tenant, file-processing and AI-cost scenarios, and no run is against production-like infrastructure.'),
  g('T-6', 'technical', 'Visual regression and cross-device testing for core surfaces.', 'partial', 'docs/DESIGN-REGRESSION-TEST-PLAN.md', 'Planned; the contrast workflow runs, cross-browser does not.'),
  g('T-7', 'technical', 'Penetration test or equivalent assessment.', 'partial', 'docs/trust/PENETRATION-TEST-PLAN.md', 'A plan, not a report.', true),
  g('R-1', 'trust', 'Student data export and deletion work.', 'partial', 'docs/drills/erasure-drill-2026-09-30.md', 'Export and erasure proven on production in a rolled-back drill (every mapped column empty after); the delete-account Edge Function with a real session is still owed.', true),
  g('R-2', 'trust', 'Backup restore drill succeeds in an isolated environment.', 'partial', 'supabase/restore-drill.sh', 'The rehearsal runs in CI against a fresh database; a production restore has not been performed.', true),
  g('R-3', 'trust', 'Incident-response drill completed.', 'partial', 'docs/operating-model/INCIDENT-COMMUNICATIONS.md', 'Runbooks exist; no tabletop is recorded.', true),
  g('R-4', 'trust', 'AI prompt-injection and kill-switch drills completed.', 'partial', 'app/src/lib/aikillswitch.test.ts', 'Attempted against production on 29 September: it stopped at a 501 before reaching the switch, because ANTHROPIC_API_KEY is not set on the project.', true),
  g('R-5', 'trust', 'Vendor and subprocessor register complete.', 'partial', 'docs/SUBPROCESSORS.md', 'Listed; the vendor-risk reviews are not all done.'),
  g('R-6', 'trust', 'Consent and sharing flows expire, revoke and audit correctly.', 'partial', 'docs/CONSENT-SHARING-DESIGN.md', 'Designed and held in tests; not verified in production.'),
  g('A-1', 'accessibility', 'Automated accessibility testing.', 'passed', 'app/src/a11y/axe.test.tsx', 'axe runs over rendered screens in the suite.'),
  g('A-2', 'accessibility', 'Manual keyboard, screen-reader, zoom and reflow testing of every critical flow.', 'owed', null, 'Not performed.', true),
  g('A-3', 'accessibility', 'VPAT or a professional VPAT plan.', 'partial', 'docs/trust/HECVAT-VPAT-PLAN.md', 'A plan.'),
  g('O-1', 'operations', 'Feature flags and kill switches work at every scope.', 'partial', 'supabase/feature_cohorts.check.sql', 'Every scope, cohort included, is enforced and checked; no kill switch has been engaged against production and no rollback drill is recorded.'),
  g('O-2', 'operations', 'Monitoring, alerting, audit logs and status page work.', 'partial', 'docs/trust/APM-RUNBOOK.md', 'Status page and smoke tests exist; on-call routing does not.'),
  g('O-3', 'operations', 'Every production service has a named operator.', 'owed', null, 'The operations seat is vacant.', true),
  g('O-4', 'operations', 'Support staffing and response model ready.', 'owed', null, 'No staffed queue.', true),
  g('O-5', 'operations', 'Billing, cancellation, refunds, invoices and dunning tested end to end.', 'partial', 'app/src/lib/billing/checkout.test.ts', 'Checkout and dunning are held; cancellation has not reached Stripe.'),
  g('C-1', 'company', 'Privacy Policy, Terms, DPA, MSA, pilot SOW, SLA and AI Policy reviewed by counsel.', 'partial', 'docs/trust/DPA-CHECKLIST.md', 'Drafts exist; no counsel review.', true),
  g('C-2', 'company', 'Legal entity, banking, insurance and IP agreements complete.', 'partial', 'docs/SAAS-LAUNCH-KIT.md', 'Outlined, not executed.', true),
  g('C-3', 'company', 'HECVAT and TrustEd evidence package complete.', 'partial', 'docs/market-readiness/HECVAT_READINESS.md', 'In progress.'),
  g('C-4', 'company', 'Public claims audited against evidence.', 'passed', 'app/src/lib/ops/claims.ts', 'The claims register holds every public claim to its word.'),
];

// ── The council ─────────────────────────────────────────────────────────────

export type Signoff = 'approved' | 'approved_with_condition' | 'not_approved';

/**
 * The seats the Production Readiness Council needs, and each one's signature.
 * Null is unsigned. A signature is recorded only when the seat's holder gives
 * it in writing — never filled in to make the decision below come out GO.
 */
export const COUNCIL: Readonly<Record<Seat, Signoff | null>> = Object.fromEntries(SEATS.map((s) => [s, null])) as Record<Seat, null>;

// ── Decisions ───────────────────────────────────────────────────────────────

const RUNGS = LADDER.map((r) => r.key);
export const rank = (s: Rung): number => RUNGS.indexOf(s);

export interface Decision {
  go: boolean;
  /** Every reason it is not GO, in the order checked. Empty when it is. */
  blockers: string[];
}

/**
 * The eight conditions a full GO requires, applied to the register. A
 * condition the tree cannot yet see — an unresolved critical vulnerability, an
 * unsupported claim — is carried by the gate item that would show it.
 */
export function goDecision(
  domains: readonly Domain[] = DOMAINS,
  gate: readonly GateItem[] = GO_GATE,
  council: Readonly<Record<Seat, Signoff | null>> = COUNCIL,
): Decision {
  const blockers: string[] = [];
  for (const x of gate) if (x.p0 && x.state !== 'passed') blockers.push(`${x.id} is ${x.state}: ${x.item}`);
  for (const d of domains) {
    if (d.status === 'deprecated') continue;
    const c = ceiling(d, { go: true, pilot: null });
    if (c === null || rank(c) < rank('internally_verified')) blockers.push(`${d.name} is not internally verified.`);
  }
  for (const s of SEATS) {
    const v = council[s];
    if (v === null) blockers.push(`The ${s} seat has not signed.`);
    else if (v === 'not_approved') blockers.push(`The ${s} seat did not approve.`);
  }
  return { go: blockers.length === 0, blockers };
}

/** A pilot, once there is one: who sponsors it, which cohort, and what it produced. */
export interface Pilot {
  sponsor: string;
  cohort: string;
}

/**
 * The highest rung a domain's evidence supports. Each rung needs the one
 * below: nothing is GO that was never verified, and nothing is deployed to a
 * pilot before GO.
 */
export function ceiling(d: Domain, ctx: { go: boolean; pilot: Pilot | null } = { go: goDecision().go, pilot: null }): Rung | null {
  if (!d.spec && d.code.length === 0) return null;
  if (d.code.length === 0) return 'designed';
  if (!CHECKS.every((c) => d.checks[c.key].state === 'passed')) return 'built';
  if (!ctx.go) return 'internally_verified';
  if (!ctx.pilot || d.activation === 'off') return 'go_certified';
  if (!d.pilotEvidence) return 'pilot_deployed';
  // General availability and above need evidence across cohorts and a
  // contract; no register field can hold that yet, so the ceiling stops here.
  return 'pilot_refined';
}

/** How many domains sit at each status. */
export function counts(domains: readonly Domain[] = DOMAINS): Record<Status, number> {
  const out = Object.fromEntries([...RUNGS, 'deprecated'].map((k) => [k, 0])) as Record<Status, number>;
  for (const d of domains) out[d.status]++;
  return out;
}

/** The gate's items by state. */
export function gateCounts(gate: readonly GateItem[] = GO_GATE): Record<State, number> {
  return {
    passed: gate.filter((x) => x.state === 'passed').length,
    partial: gate.filter((x) => x.state === 'partial').length,
    owed: gate.filter((x) => x.state === 'owed').length,
  };
}

/** What a pilot is for once GO is reached: the documents' nine objectives. */
export const PILOT_OBJECTIVES: readonly { objective: string; learns: string }[] = [
  { objective: 'Adoption', learns: 'Which modules students, faculty and staff use first' },
  { objective: 'Onboarding', learns: 'Where real people misunderstand language, permissions or value' },
  { objective: 'Configuration', learns: 'Which institutional policies, branding, workflows and sources need adjusting' },
  { objective: 'Implementation', learns: 'How long setup, data mapping, training and support actually take' },
  { objective: 'Support', learns: 'Which documentation, prompts and escalation paths need improvement' },
  { objective: 'Outcome evidence', learns: 'Whether Semester creates clarity, planning progress, prepared advising and support discovery' },
  { objective: 'Commercial fit', learns: 'Which packaging, pricing, contract scope and implementation model institutions accept' },
  { objective: 'Change management', learns: 'How staff, faculty, advisors and students adopt a connected platform' },
  { objective: 'Expansion', learns: 'Which modules create the strongest next institutional need' },
];
