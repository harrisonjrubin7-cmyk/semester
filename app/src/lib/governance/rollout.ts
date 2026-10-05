/**
 * The pilot-to-production tracker: where a school stands, what lets it move,
 * and what must be true before anyone calls it live.
 *
 * `tenant_rollout` in the database enforces the state machine and the exit
 * gates (supabase/migrations/20260928050000_tenant_rollout.sql); this is the
 * same machine as data, plus the parts of the tracker that are checklists
 * and registers rather than rules the database can hold: the phase plan,
 * migration acceptance criteria, LTI security requirements, the risk log,
 * RACI, KPIs and the production cutover checklist.
 *
 * `rollout.test.ts` reads the migration and holds ROLLOUT_STATES' gates
 * equal to `private.rollout_exit_gates`, and docs.test.ts holds
 * docs/operating-model/PILOT-TO-PRODUCTION.md to every list here.
 *
 * The rule over all of it: Semester does not claim an official connection,
 * a completed migration, an authoritative record or a successful writeback
 * until the gates below are met. A directory listing is not a connection; a
 * sandbox action is not an official one.
 */

export const CHAIN = [
  'directory',
  'requested',
  'claimed',
  'security_review',
  'sandbox_uat',
  'pilot_read_only',
  'pilot_write_enabled',
  'production_limited',
  'production_active',
  'expansion',
] as const;

export const HOLDS = ['paused', 'suspended'] as const;
export const EXITS = ['offboarding', 'archived'] as const;

export type ChainState = (typeof CHAIN)[number];
export type RolloutState = ChainState | (typeof HOLDS)[number] | (typeof EXITS)[number];

export type Gate =
  | 'institution_request'
  | 'sponsor_qualified'
  | 'security_kickoff'
  | 'security_privacy_approval'
  | 'dpa_executed'
  | 'uat_signoff'
  | 'rls_isolation_passed'
  | 'sso_login_verified'
  | 'source_reconciliation_passed'
  | 'accessibility_review_passed'
  | 'data_quality_adoption'
  | 'workflow_reliability'
  | 'cutover_checklist_complete'
  | 'sponsor_go_live'
  | 'expansion_decision'
  | 'module_campus_approval'
  | 'remediation'
  | 'completion_certificate';

/** What official data a state may show, and what it may write. */
export type DataAuthority = 'public' | 'none' | 'configuration' | 'test' | 'official_read' | 'official_scoped_write' | 'official' | 'retained';

export interface StateDefinition {
  state: RolloutState;
  label: string;
  /** What the student or staff member sees; empty when no label is needed. */
  uiLabel: string;
  access: string;
  authority: DataAuthority;
  allowed: string;
  /** Evidence needed to leave, forward (or, for a hold, to resume; for offboarding, to archive). */
  exitGates: readonly Gate[];
}

export const ROLLOUT_STATES: readonly StateDefinition[] = [
  { state: 'directory', label: 'Directory', uiLabel: 'Student Access', access: 'Any Student Access user', authority: 'public', allowed: 'Public campus profile and personal workspace', exitGates: ['institution_request'] },
  { state: 'requested', label: 'Requested', uiLabel: 'Institution requested', access: 'Platform team and requester', authority: 'none', allowed: 'Claim and discovery only', exitGates: ['sponsor_qualified'] },
  { state: 'claimed', label: 'Claimed', uiLabel: 'Setup in progress', access: 'Verified institutional contact', authority: 'configuration', allowed: 'Branding, domain verification, stakeholder map, pilot planning', exitGates: ['security_kickoff'] },
  { state: 'security_review', label: 'Security review', uiLabel: 'Security review', access: 'Approved institution staff and Semester team', authority: 'test', allowed: 'Trust review, DPA, architecture review, SSO and integration testing', exitGates: ['security_privacy_approval', 'dpa_executed'] },
  { state: 'sandbox_uat', label: 'Sandbox/UAT', uiLabel: 'Test environment', access: 'Authorized testers', authority: 'test', allowed: 'Configured pilot workflows on sanitized data, no production authority', exitGates: ['uat_signoff', 'rls_isolation_passed', 'sso_login_verified'] },
  { state: 'pilot_read_only', label: 'Pilot read-only', uiLabel: 'Pilot', access: 'Pilot cohort', authority: 'official_read', allowed: 'Courses, rosters, assignments and planning from approved sources, with source labels', exitGates: ['source_reconciliation_passed', 'accessibility_review_passed', 'data_quality_adoption'] },
  { state: 'pilot_write_enabled', label: 'Pilot write-enabled', uiLabel: 'Pilot', access: 'Pilot cohort', authority: 'official_scoped_write', allowed: 'Booking, personal actions, and LMS writebacks that were separately approved', exitGates: ['workflow_reliability', 'cutover_checklist_complete', 'sponsor_go_live'] },
  { state: 'production_limited', label: 'Production limited', uiLabel: '', access: 'Authorized population', authority: 'official', allowed: 'Contracted modules for a selected cohort or campus', exitGates: ['expansion_decision'] },
  { state: 'production_active', label: 'Production active', uiLabel: '', access: 'All authorized users', authority: 'official', allowed: 'Contracted tenant-wide feature set', exitGates: ['module_campus_approval'] },
  { state: 'expansion', label: 'Expansion', uiLabel: '', access: 'New department, campus or program', authority: 'official', allowed: 'Additional modules and connectors by scope', exitGates: [] },
  { state: 'paused', label: 'Paused', uiLabel: 'Service temporarily limited', access: 'Admin and support', authority: 'retained', allowed: 'Limited read, export, remediation', exitGates: ['remediation'] },
  { state: 'suspended', label: 'Suspended', uiLabel: 'Service temporarily limited', access: 'Admin and support only', authority: 'retained', allowed: 'Support, export, remediation', exitGates: ['remediation'] },
  { state: 'offboarding', label: 'Offboarding', uiLabel: 'Export available', access: 'Admin and export users', authority: 'retained', allowed: 'Export, retention and deletion by contract', exitGates: ['completion_certificate'] },
  { state: 'archived', label: 'Archived', uiLabel: 'Archived', access: 'Limited authorized archive access', authority: 'retained', allowed: 'Historical access only', exitGates: [] },
];

const byState = new Map(ROLLOUT_STATES.map((d) => [d.state, d]));
export const definition = (s: RolloutState): StateDefinition => byState.get(s)!;

const rank = (s: RolloutState): number => (CHAIN as readonly string[]).indexOf(s);
const isHold = (s: RolloutState) => (HOLDS as readonly string[]).includes(s);

export interface RolloutRecord {
  state: RolloutState;
  /** Where a paused or suspended school returns to. */
  resumeState?: ChainState;
  enteredAt: string;
}

export interface Evidence {
  gate: Gate;
  recordedAt: string;
}

export type TransitionVerdict =
  | { ok: true }
  | { ok: false; reason: 'archived' | 'not-in-rollout' | 'archive-from-offboarding' | 'resume-to-held' | 'offboarding-archives' | 'one-step' }
  | { ok: false; reason: 'missing-evidence'; missing: Gate[] };

/**
 * The database's rule, stated for a screen that wants to say why a move is
 * unavailable before trying it. The trigger is the authority; this must never
 * allow what it refuses (rollout.test.ts walks both against the same cases).
 */
export function transition(from: RolloutRecord, to: RolloutState, evidence: readonly Evidence[]): TransitionVerdict {
  if (to === from.state) return { ok: true };
  if (from.state === 'archived') return { ok: false, reason: 'archived' };

  const [a, b] = [rank(from.state), rank(to)];
  let needsEvidence = true;

  if (isHold(to)) {
    if (!(from.state === 'paused' && to === 'suspended') && (a <= 0)) return { ok: false, reason: 'not-in-rollout' };
    needsEvidence = false;
  } else if (to === 'offboarding') {
    if (from.state === 'directory') return { ok: false, reason: 'not-in-rollout' };
    needsEvidence = false;
  } else if (to === 'archived') {
    if (from.state !== 'offboarding') return { ok: false, reason: 'archive-from-offboarding' };
  } else if (isHold(from.state)) {
    if (to !== from.resumeState) return { ok: false, reason: 'resume-to-held' };
  } else if (from.state === 'offboarding') {
    return { ok: false, reason: 'offboarding-archives' };
  } else if (b < a) {
    needsEvidence = false;
  } else if (b !== a + 1) {
    return { ok: false, reason: 'one-step' };
  }

  if (!needsEvidence) return { ok: true };
  const since = Date.parse(from.enteredAt);
  const missing = definition(from.state).exitGates.filter(
    (g) => !evidence.some((e) => e.gate === g && Date.parse(e.recordedAt) >= since),
  );
  return missing.length ? { ok: false, reason: 'missing-evidence', missing: [...missing].sort() } : { ok: true };
}

/** Whether a school in this state may show official institutional data at all. */
export const showsOfficialData = (s: RolloutState) =>
  ['official_read', 'official_scoped_write', 'official'].includes(definition(s).authority);

/** Whether it may write to an institutional system of record. */
export const writesOfficialData = (s: RolloutState) =>
  ['official_scoped_write', 'official'].includes(definition(s).authority);

// ── The phase plan ─────────────────────────────────────────────────────────

export interface Milestone {
  name: string;
  owner: string;
  evidence: string;
  exit: string;
}

export interface Phase {
  number: number;
  name: string;
  objective: string;
  milestones: readonly Milestone[];
}

export const PHASES: readonly Phase[] = [
  {
    number: 0, name: 'Commercial and governance readiness',
    objective: 'Establish authority, scope, decision rights, policy ownership and a measurable pilot purpose before technical work begins.',
    milestones: [
      { name: 'Executive sponsor named', owner: 'Institution', evidence: 'Sponsor acceptance', exit: 'Sponsor attends kickoff' },
      { name: 'Operational champion named', owner: 'Institution', evidence: 'Project charter', exit: 'Owns day-to-day adoption' },
      { name: 'Technical owners named', owner: 'Institution', evidence: 'RACI', exit: 'LMS, SIS, identity and security contacts confirmed' },
      { name: 'DPA and security terms route confirmed', owner: 'Legal/privacy', evidence: 'Contract tracker', exit: 'Review path and dates agreed' },
      { name: 'Pilot workflow selected', owner: 'Sponsor and Semester', evidence: 'Pilot hypothesis', exit: 'One measurable workflow only' },
      { name: 'Pilot cohort selected', owner: 'Institution', evidence: 'Cohort definition', exit: 'Population, roles and count documented' },
      { name: 'Success metrics approved', owner: 'Sponsor and data owner', evidence: 'Scorecard', exit: 'Baselines and targets defined' },
      { name: 'Decision date agreed', owner: 'Sponsor', evidence: 'Pilot agreement', exit: 'Convert, expand, pause or stop date written' },
    ],
  },
  {
    number: 1, name: 'Tenant and identity foundation',
    objective: 'Provision a real tenant and validate identity, membership, roles, tenant isolation and administration.',
    milestones: [
      { name: 'Tenant provisioned', owner: 'Semester', evidence: 'Tenant ID and subdomain', exit: 'Correct branding and base policy loaded' },
      { name: 'Institution domains verified', owner: 'Institution and Semester', evidence: 'DNS evidence', exit: 'Tenant routing works' },
      { name: 'Admin accounts provisioned', owner: 'Institution', evidence: 'Admin list', exit: 'At least two institutional admins' },
      { name: 'SSO protocol selected', owner: 'IT identity owner', evidence: 'OIDC or SAML design', exit: 'Metadata and configuration approved' },
      { name: 'SSO configured in sandbox', owner: 'IT and Semester', evidence: 'Login test', exit: 'User identity and affiliation resolve' },
      { name: 'Role mapping defined', owner: 'Institution and Semester', evidence: 'Role mapping matrix', exit: 'Student, faculty, TA and admin mapping approved' },
      { name: 'SCIM decision documented', owner: 'IT identity owner', evidence: 'Provisioning design', exit: 'Manual, invite or SCIM model defined' },
      { name: 'RLS isolation tests passed', owner: 'Semester', evidence: 'CI evidence', exit: 'Cross-tenant and role attacks denied' },
      { name: 'Session and MFA policy configured', owner: 'IT and security', evidence: 'Auth policy', exit: 'Privileged-role controls verified' },
    ],
  },
  {
    number: 2, name: 'LMS, SIS and source mapping',
    objective: 'Connect approved sources read-only first and prove accuracy, freshness, ownership and fallback.',
    milestones: [
      { name: 'Terms mapped', owner: 'Registrar/SIS owner', evidence: 'SIS API or OneRoster sync', exit: 'Start and end dates match' },
      { name: 'Course catalog mapped', owner: 'Registrar/SIS owner', evidence: 'SIS API or bulk import', exit: 'Code, title and credit match' },
      { name: 'Sections and enrollments reconciled', owner: 'Registrar/SIS owner', evidence: 'OneRoster, NRPS or API sync', exit: 'Section, role and roster counts match' },
      { name: 'Course content links verified', owner: 'LMS owner', evidence: 'LTI deep link or API', exit: 'Links launch correctly' },
      { name: 'Assignments mapped', owner: 'LMS owner', evidence: 'LMS API or LTI context', exit: 'Due dates and types match' },
      { name: 'Grade line items read-only', owner: 'LMS owner', evidence: 'AGS or API', exit: 'No student grade exposed beyond approval' },
      { name: 'Calendar mapped', owner: 'Student success/IT', evidence: 'API or ICS', exit: 'Dates, time zones and duplicates checked' },
      { name: 'Services directory confirmed', owner: 'Service owner', evidence: 'API or curated directory', exit: 'Owner, eligibility and capacity confirmed' },
    ],
  },
  {
    number: 3, name: 'Course migration and LMS interoperability',
    objective: 'Import or connect representative courses and verify the complete student and faculty workflow.',
    milestones: [
      { name: 'Course shells and modules imported', owner: 'Faculty and LMS owner', evidence: 'Common Cartridge, API or manual review', exit: 'Module order and completion rules correct' },
      { name: 'Pages, files and media imported', owner: 'Faculty/accessibility owner', evidence: 'Import and accessibility review', exit: 'Captions or documented remediation' },
      { name: 'Assignments and rubrics validated', owner: 'Faculty', evidence: 'API, import or manual validation', exit: 'Dates, types and rubrics match' },
      { name: 'Question banks and assessments validated', owner: 'Assessment owner', evidence: 'QTI conversion and item review', exit: 'Items render and are reviewed' },
      { name: 'Grade ledger reconciled', owner: 'Registrar/faculty', evidence: 'Reconciliation report', exit: 'Totals reconcile before any passback' },
      { name: 'External tools catalogued', owner: 'LMS owner', evidence: 'LTI 1.3 registrations', exit: 'Each tool launches in context' },
    ],
  },
  {
    number: 4, name: 'Pilot configuration and readiness',
    objective: 'Prepare the workflow, people, support and controls a limited real-user launch needs.',
    milestones: [
      { name: 'Pilot feature flags set', owner: 'Semester and institution', evidence: 'Entitlement record', exit: 'Only approved modules, roles and cohorts enabled' },
      { name: 'AI policy configured', owner: 'Academic affairs and faculty', evidence: 'Policy records', exit: 'Course and assignment policy cards active' },
      { name: 'Accessibility review complete', owner: 'Accessibility owner', evidence: 'Test report', exit: 'P0/P1 issues resolved or mitigation approved' },
      { name: 'Faculty training complete', owner: 'Faculty lead', evidence: 'Completion record', exit: 'Course team can operate the workflow' },
      { name: 'Student onboarding prepared', owner: 'Student success and Semester', evidence: 'Launch kit', exit: 'SSO, first action and help route tested' },
      { name: 'Support runbook ready', owner: 'Support owner', evidence: 'Runbook', exit: 'Escalation and incident contacts confirmed' },
      { name: 'Communications approved', owner: 'Institution communications', evidence: 'Templates', exit: 'Student and staff messaging scheduled' },
      { name: 'Monitoring configured', owner: 'Semester', evidence: 'Dashboards and alerts', exit: 'Source, error, adoption and support monitoring active' },
      { name: 'Rollback and fallback approved', owner: 'Technical owners', evidence: 'Rollback plan', exit: 'Legacy LMS and official-system fallback tested' },
    ],
  },
  {
    number: 5, name: 'Limited pilot launch',
    objective: 'Launch safely, monitor daily and correct friction without expanding scope early.',
    milestones: [
      { name: 'Daily source freshness check', owner: 'Semester and IT', evidence: 'Integration health review', exit: 'First ten business days reviewed' },
      { name: 'Daily support triage', owner: 'Support owner', evidence: 'Prioritized issue queue', exit: 'First ten business days reviewed' },
      { name: 'Weekly working group', owner: 'Operational champion', evidence: 'Decision log and blocker list', exit: 'Held every week' },
      { name: 'Midpoint pilot health review', owner: 'All owners', evidence: 'Health review', exit: 'Continue, revise or stop decided' },
    ],
  },
  {
    number: 6, name: 'Pilot conversion decision',
    objective: 'Decide on evidence: convert, expand, extend, pause or stop.',
    milestones: [
      { name: 'Outcome review held', owner: 'Sponsor and Semester', evidence: 'KPI tracker at end of pilot', exit: 'Every decision threshold assessed' },
      { name: 'Conversion recommendation approved', owner: 'Executive sponsor', evidence: 'Steering decision', exit: 'One decision option recorded' },
    ],
  },
  {
    number: 7, name: 'Production expansion',
    objective: 'Add programs, courses and campuses in waves; move from read to scoped writes only on evidence.',
    milestones: [
      { name: 'Expansion wave planned', owner: 'Sponsor and Semester', evidence: 'Wave plan', exit: 'Scope, owners and dates agreed' },
      { name: 'Writebacks approved one by one', owner: 'Integration owner', evidence: 'Per-writeback approval', exit: 'Reconciliation passed for each' },
      { name: 'Quarterly business review held', owner: 'Customer success', evidence: 'QBR record', exit: 'Renewal and product plan reviewed' },
    ],
  },
];

export const DECISION_OPTIONS = [
  'Convert to annual production',
  'Expand pilot scope',
  'Extend pilot with defined remediation',
  'Pause',
  'Terminate and export/offboard',
] as const;

// ── Acceptance and security checklists ────────────────────────────────────

export const MIGRATION_ACCEPTANCE = [
  'Course, section and roster IDs reconcile to the approved source',
  'Module order and completion rules are correct',
  'Content links work in student, faculty, keyboard and mobile views',
  'Imported media has captions or transcripts, or documented remediation',
  'Assignment dates, time zones, availability, submission types and rubrics match',
  'Assessment items render correctly and are reviewed by the academic owner',
  'Grade calculations reconcile before any official passback',
  'Student and faculty roles are correct',
  'Source and freshness labels appear wherever external data is shown',
  'No protected data crosses a tenant boundary',
  'The legacy LMS fallback remains available during the parallel run',
] as const;

export const LTI_SECURITY = [
  'Register issuer, client ID, deployment ID, redirect URIs, JWKS and required scopes',
  'Validate OIDC state and nonce',
  'Validate ID token signature, issuer, audience, deployment ID, expiry and nonce',
  'Trust no role or context claim until JWT validation succeeds',
  'Keep platform credentials and secrets server-side',
  'Scope NRPS and AGS calls to the verified course and deployment',
  'Use idempotency keys for AGS writeback',
  'Log launch, roster sync, deep-link and grade-write audit events',
  'Enable no grade passback until faculty, registrar, privacy and integration owners approve',
] as const;

export const CUTOVER_CHECKLIST = [
  'Contract, DPA, security terms and implementation scope are executed',
  'Tenant is provisioned with correct branding, domains and admin ownership',
  'SSO authentication, membership mapping, role mapping and MFA rules pass UAT',
  'RLS and cross-tenant tests pass against a production-equivalent environment',
  'Source data contracts, field mappings, classification and freshness SLAs are approved',
  'SIS and LMS source reconciliation passes',
  'Source, freshness and fallback UI is visible and accurate',
  'No synthetic preview, demo persona selector or test fixture appears in production',
  'Accessibility review passes with no unresolved launch-blocking issue',
  'Support, incident, status-page and escalation contacts are live',
  'Monitoring, alerts, logs, backup and restore evidence are current',
  'Feature flags and rollback plans are documented',
  'Student, faculty and staff onboarding is complete',
  'Pilot KPIs and baseline are documented',
  'Launch avoids registration and finals windows unless readiness is explicit',
  'Executive sponsor approves go-live',
] as const;

/** What is still open, in the order written, so a go-live review reads down one list. */
export function cutoverOpen(done: ReadonlySet<string>): string[] {
  return CUTOVER_CHECKLIST.filter((i) => !done.has(i));
}

// ── Registers ─────────────────────────────────────────────────────────────

export type Level = 'Low' | 'Medium' | 'High' | 'Critical';

export interface Risk {
  id: `R-${string}`;
  risk: string;
  likelihood: Exclude<Level, 'Critical'>;
  impact: Level;
  signal: string;
  mitigation: string;
  owner: string;
}

export const RISKS: readonly Risk[] = [
  { id: 'R-01', risk: 'SSO attribute mapping fails', likelihood: 'Medium', impact: 'High', signal: 'Test users resolve to the wrong role or tenant', mitigation: 'Sandbox claims matrix; invitation-login fallback', owner: 'Identity owner' },
  { id: 'R-02', risk: 'Roster mismatch', likelihood: 'Medium', impact: 'High', signal: 'Enrollment counts differ', mitigation: 'Reconciliation report; source-of-truth policy; read-only first', owner: 'SIS/LMS owner' },
  { id: 'R-03', risk: 'LMS source freshness delay', likelihood: 'Medium', impact: 'Medium', signal: 'Assignments older than SLA', mitigation: 'Freshness badge; retry queue; official LMS fallback', owner: 'Integration owner' },
  { id: 'R-04', risk: 'Faculty workload resistance', likelihood: 'High', impact: 'High', signal: 'Low training attendance or course activation', mitigation: 'Course templates; migration concierge; faculty champions', owner: 'Faculty lead' },
  { id: 'R-05', risk: 'Accessibility defect blocks launch', likelihood: 'Medium', impact: 'High', signal: 'Keyboard or screen-reader failure', mitigation: 'Early audit; remediation SLA; assistive-tech testing', owner: 'Accessibility owner' },
  { id: 'R-06', risk: 'AI policy disagreement', likelihood: 'Medium', impact: 'High', signal: 'Course policies absent or conflicting', mitigation: 'Hierarchical policy model; faculty governance; default-safe modes', owner: 'Academic affairs' },
  { id: 'R-07', risk: 'Student adoption low', likelihood: 'Medium', impact: 'High', signal: 'Activation or first action below target', mitigation: 'Orientation; LMS links; staff referrals; ambassadors', owner: 'Student success' },
  { id: 'R-08', risk: 'Support capacity insufficient', likelihood: 'Medium', impact: 'High', signal: 'Long queue or slow resolution', mitigation: 'Office hours; escalation owner; pilot cohort limits', owner: 'Support owner' },
  { id: 'R-09', risk: 'Grade passback discrepancy', likelihood: 'Low', impact: 'Critical', signal: 'Grade total mismatch', mitigation: 'No writeback in first pilot; reconciliation; rollback', owner: 'Registrar/LMS owner' },
  { id: 'R-10', risk: 'Sensitive data overshared', likelihood: 'Low', impact: 'Critical', signal: 'Unexpected fields in mapping or logs', mitigation: 'Data minimization; DPA; classification gate; audit', owner: 'Privacy owner' },
  { id: 'R-11', risk: 'Assessment outage', likelihood: 'Low', impact: 'Critical', signal: 'Load or performance alerts', mitigation: 'Autosave; receipts; fallback; exam-window on-call', owner: 'Engineering lead' },
  { id: 'R-12', risk: 'Vendor or provider outage', likelihood: 'Medium', impact: 'Medium', signal: 'API error or 429 surge', mitigation: 'Circuit breaker; cached data; provider fallback; status messaging', owner: 'Integration owner' },
];

export interface RaciRow {
  workstream: string;
  accountable: string;
  responsible: string;
  consulted: string;
  informed: string;
}

export const RACI: readonly RaciRow[] = [
  { workstream: 'Contract/DPA', accountable: 'Institutional sponsor', responsible: 'Procurement/legal', consulted: 'Security/privacy', informed: 'Project team' },
  { workstream: 'Tenant configuration', accountable: 'Institution admin', responsible: 'Semester implementation', consulted: 'IT/security', informed: 'Sponsor' },
  { workstream: 'SSO/identity', accountable: 'CIO/identity owner', responsible: 'Identity engineer', consulted: 'Semester engineering', informed: 'Project team' },
  { workstream: 'SIS integration', accountable: 'Registrar/data owner', responsible: 'SIS integration owner', consulted: 'Privacy/security', informed: 'Project team' },
  { workstream: 'LMS/LTI integration', accountable: 'LMS owner', responsible: 'LMS integration owner', consulted: 'Faculty, Semester engineering', informed: 'Students' },
  { workstream: 'Course migration', accountable: 'Faculty lead', responsible: 'Faculty/course designer', consulted: 'Accessibility, instructional design', informed: 'Students' },
  { workstream: 'AI policy', accountable: 'Academic affairs', responsible: 'Faculty/course owner', consulted: 'Privacy, library, accessibility', informed: 'Students' },
  { workstream: 'Accessibility', accountable: 'Accessibility owner', responsible: 'Design, engineering and content authors', consulted: 'Student test panel', informed: 'Sponsor' },
  { workstream: 'Student launch', accountable: 'Student success owner', responsible: 'Communications/ambassadors', consulted: 'Faculty/advising', informed: 'Sponsor' },
  { workstream: 'Support', accountable: 'Support owner', responsible: 'Help desk/CS', consulted: 'IT/service owners', informed: 'Users' },
  { workstream: 'Outcome measurement', accountable: 'Institutional research owner', responsible: 'Analytics lead', consulted: 'Sponsor, Semester CS', informed: 'Governance group' },
  { workstream: 'Production decision', accountable: 'Executive sponsor', responsible: 'Steering committee', consulted: 'Semester leadership', informed: 'All stakeholders' },
];

export interface Kpi {
  metric: string;
  source: string;
  owner: string;
  cadence: string;
}

export const KPIS: readonly Kpi[] = [
  { metric: 'Eligible users', source: 'SIS/roster', owner: 'Data owner', cadence: 'Weekly' },
  { metric: 'Activation rate', source: 'Semester events', owner: 'CS lead', cadence: 'Weekly' },
  { metric: 'First meaningful action', source: 'Semester events', owner: 'Product/CS', cadence: 'Weekly' },
  { metric: 'Course workspace return', source: 'Semester events', owner: 'Product', cadence: 'Weekly' },
  { metric: 'Study/practice completion', source: 'Semester events', owner: 'Product', cadence: 'Weekly' },
  { metric: 'Service handoff completion', source: 'Referral system', owner: 'Service owner', cadence: 'Biweekly' },
  { metric: 'Source freshness SLA met', source: 'Integration health', owner: 'IT owner', cadence: 'Daily/weekly' },
  { metric: 'Accessibility defects open', source: 'A11y tracker', owner: 'Accessibility owner', cadence: 'Weekly' },
  { metric: 'Support contacts per active user', source: 'Support desk', owner: 'Support owner', cadence: 'Weekly' },
  { metric: 'Median support resolution', source: 'Support desk', owner: 'Support owner', cadence: 'Weekly' },
  { metric: 'Student usefulness/trust', source: 'Survey/interviews', owner: 'Research lead', cadence: 'Midpoint/end' },
  { metric: 'Faculty readiness', source: 'Training and survey', owner: 'Faculty lead', cadence: 'Weekly' },
  { metric: 'Pilot-to-production recommendation', source: 'Steering review', owner: 'Sponsor', cadence: 'End' },
];

export const STEERING_AGENDA = [
  'Decisions needed this week',
  'Milestone status: green, amber, red',
  'Integration health and data reconciliation',
  'Security, privacy and accessibility issues',
  'Faculty, student and support feedback',
  'Adoption and workflow metrics',
  'Risk-log updates',
  'Change requests and feature-flag decisions',
  'Next week’s owners and due dates',
] as const;
