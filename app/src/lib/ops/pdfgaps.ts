/**
 * The readiness synthesis of 30 September 2026, matched against the tree.
 *
 * The owner extracted six readiness PDFs and supplied a source-grounded
 * synthesis: fourteen common P0s, lettered (a)–(n), and five operating
 * artifacts. The PDFs themselves are not in the repository or the session, so
 * a row cites the synthesis, not a page. That synthesis is **requirements
 * evidence, never authority**: a row here says what the tree already does about
 * a need, and what is left, and nothing in it turns a need into a claim.
 *
 * A row's `where` lists files that must exist; `pdfgaps.test.ts` reads them.
 * A row that says `covered` or `built-here` must cite at least one, and one
 * that says `open-design`, `blocked` or `security-workstream` must name what
 * stops it and whose it is. `docs/PDF-EVIDENCE-GAP-MATRIX.md` is rendered from
 * this file; edit the data, then `npm run registers` from app/.
 */

export const VERDICTS = ['covered', 'partial', 'built-here', 'open-design', 'security-workstream', 'blocked', 'not-to-build'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const VERDICT_MEANING: Record<Verdict, string> = {
  covered: 'The tree already does this, with a test; nothing added',
  partial: 'Part is done and cited; the rest is stated',
  'built-here': 'Added on this branch (#1021)',
  'open-design': 'A real gap, but the design needs a decision first; not built',
  'security-workstream': 'Implementation belongs to the security workstream; this page records the requirement and what exists',
  blocked: 'Needs an owner, counsel, a specialist or a manual test that only a person can do',
  'not-to-build': 'Deliberately not built or claimed yet',
};

export const BLOCKERS = ['none', 'owner', 'counsel', 'manual-test', 'security', 'specialist'] as const;
export type Blocker = (typeof BLOCKERS)[number];

export interface GapRow {
  /** `a`–`n` for the common P0s, `OA1`–`OA5` for the operating artifacts, `X1` for the refusal. */
  id: string;
  need: string;
  verdict: Verdict;
  /** Files that exist and show it. */
  where: readonly string[];
  /** What is true today, in a sentence a reader can check. */
  today: string;
  /** What is left. */
  remaining: string;
  blocker: Blocker;
  /** Open pull requests to coordinate with rather than duplicate. */
  coordinate?: string;
}

export const ROWS: readonly GapRow[] = [
  {
    id: 'a',
    need: 'Compliance ledger with the six states Not started / In progress / Implemented / Tested / Evidenced / Approved and an accountable owner',
    verdict: 'covered',
    where: ['app/src/lib/masterregister.ts', 'docs/MASTER-LAUNCH-READINESS-REGISTER.md', 'app/src/lib/launchreadiness.ts', 'docs/RELEASE-GATES.md'],
    today: 'The Master Launch Readiness Register has nine states that contain the six (not-started = Not started, building = In progress, implemented, tested, evidenced, launch-approved = Approved), a test per claim a state makes, and seat-level sign-off. RELEASE-GATES.md adds the ten readiness gates.',
    remaining: 'Owners are seats, and most seats are one person, acting; none has signed. Nothing is above tested until artifacts are filed under docs/evidence/.',
    blocker: 'owner',
  },
  {
    id: 'b',
    need: 'FERPA legitimate-interest authorization = tenant + role + active relationship/scope + purpose code + data class, with permit and deny audit records',
    verdict: 'open-design',
    where: ['docs/FERPA-IDENTITY-GUARDRAILS.md', 'app/src/lib/trust/ferpa-consent.ts', 'supabase/migrations/20260930000000_audit_and_subject_requests.sql', 'docs/ROLE-PERMISSION-MATRIX.md'],
    today: 'Tenant + role + scope is enforced (role_grants, has_capability, RLS); support access is student-approved, purpose-limited, time-limited and audited; the audit envelope records outcomes. There is no purpose code and no data-class dimension on a decision, and denied attempts are not yet on the audit record.',
    remaining: 'Which purposes exist, which data classes each may reach, and what counts as a legitimate educational interest are counsel\'s to define. Then: a deny-by-default purpose policy per school, a decision function that writes permit and deny events, and negative tests. Building the mechanism before the policy would ship an empty shell.',
    blocker: 'counsel',
  },
  {
    id: 'c',
    need: 'Canonical person / identity / source-authority model',
    verdict: 'open-design',
    where: ['docs/ACCOUNT-LINKING-AND-IDENTITY-PRIVACY.md', 'docs/DOMAIN-REPLACEMENT-REGISTER.md', 'docs/DATA-INVENTORY-AND-LINEAGE.md', 'app/src/lib/source.test.ts'],
    today: 'Five source labels are DB-checked on four tables; integration connections declare which domains they are source of truth for; account linking and identity privacy are designed. There is no person table above auth.users, no cross-system identifier crosswalk, and no per-domain statement of which system wins a conflict.',
    remaining: 'A crosswalk and a conflict rule per data domain, decided with a real institution\'s systems in view. Designing it against no real SIS invents the answer; it starts with the first pilot school\'s identifiers.',
    blocker: 'owner',
    coordinate: '#1011 Configuration Studio, #1018 Workflow Builder',
  },
  {
    id: 'd',
    need: 'Strict LTI trust tuple and JWT validation plus replay defense',
    verdict: 'security-workstream',
    where: ['supabase/functions/_shared/lti.ts', 'supabase/lti.check.sql', 'app/src/lib/lti.test.ts', 'docs/LTI-1.3-LAUNCH-RUNBOOK.md'],
    today: 'Launch validation checks issuer, audience (string or array), authorized party, expiry, issued-at with skew, a single-use nonce (lti_nonce), LTI version 1.3.0 and the deployment id, each with a named refusal and tests; the JWKS publishes RS256 with a stable kid.',
    remaining: 'The security workstream to confirm against the checklist: the inbound signature algorithm is pinned and the platform key is chosen by kid from the registered JWKS; the issuer + client id + deployment id tuple is enforced per tenant end to end; and the FERPA/LTI audit runbook is walked against a real platform. Not re-implemented here.',
    blocker: 'security',
  },
  {
    id: 'e',
    need: 'Tenant-scoped, reversible OneRoster staging and reconciliation',
    verdict: 'security-workstream',
    where: ['app/src/lib/interop.ts', 'docs/LMS-INTEROPERABILITY-MATRIX.md', 'supabase/migrations/20260927170000_integration_control_plane.sql', 'docs/INTEGRATION-OPERATOR-RUNBOOK.md'],
    today: 'Drift, reconcile, freshness and retry logic exist as library code; the connection control plane, dead-letter and reconciliation tables exist, per tenant. Adapter registries are empty on purpose, so nothing has reconciled against a real OneRoster source.',
    remaining: 'A OneRoster adapter that lands into a staging table per tenant, a reconciliation report a person approves, and a revert. This is identity and IAM-adjacent, so it is left to the security workstream to avoid two implementations.',
    blocker: 'security',
  },
  {
    id: 'f',
    need: 'Policy engine: human-readable and executable rule, version, explanation, override, audit and rollback',
    verdict: 'open-design',
    where: ['supabase/migrations/20260928050000_tenant_rollout.sql', 'supabase/migrations/20260929370000_feature_policy_narrowing.sql', 'docs/SCHOOL-OFFBOARDING.md'],
    today: 'Deterministic rules exist in code for schedule, credit, degree and entitlement; roll-out state, feature flags and their narrowing are versioned by history rows; the rollout table refuses moves without evidence; overrides are recorded (registration overrides). There is no single versioned rule object with both a plain-language and an executable form, an explanation on every decision, or one-step rollback across rules.',
    remaining: 'Open PRs #1011 (Configuration Studio: a school\'s settings drafted by one person and published by another) and #1018 (Workflow Builder) cover part of this; a shared human-override log landed in #1012. The gap that remains is decided after they land, not before.',
    blocker: 'owner',
    coordinate: '#1011, #1018; human overrides and legal holds landed in #1012',
  },
  {
    id: 'g',
    need: 'Migration studio: profiling, dry run, parallel run, cutover, rollback and legacy archive',
    verdict: 'covered',
    where: ['supabase/migrations/20260929200000_migration_center.sql', 'supabase/migration-center.check.sql', 'app/src/components/institutional/MigrationCenter.tsx', 'docs/DATA-MIGRATION-PLAN.md'],
    today: 'The Migration Center (D-144) walks source inventory, classification, mapping, preview, sample import, validation, reconciliation, parallel runs, cutover (dated, with a rollback plan and two approval areas), archive and monitoring; a stage needs its evidence, runs are append-only and their pass is computed from counts.',
    remaining: 'It has never been used on a real migration. Profiling is by counts recorded from a file the recorder holds, not by Semester reading it.',
    blocker: 'owner',
  },
  {
    id: 'h',
    need: 'SPOF and degraded-mode map, critical-period priorities, restore evidence, incident roles and status communications',
    verdict: 'built-here',
    where: ['docs/DEGRADED-MODE-MAP.md', 'docs/evidence/restore/2026-09-30-logical-rehearsal.md', 'docs/market-readiness/INCIDENT_RESPONSE.md', 'docs/operating-model/INCIDENT-COMMUNICATIONS.md'],
    today: 'A map of eleven dependencies with what still works, what does not and the evidence for each; critical-period priorities proposed; a logical restore rehearsal filed. Incident roles and communications templates already existed.',
    remaining: 'A timed restore of the live project\'s backup by a second operator (G5), a second trained operator, a backup for the gateway journal, a freeze calendar and on-call names, incident owners.',
    blocker: 'owner',
  },
  {
    id: 'i',
    need: 'Governance charter and decision rights, including two-person approval for high-impact policy, data and security exceptions',
    verdict: 'built-here',
    where: ['docs/DECISION-RIGHTS.md', 'docs/LAUNCH-READINESS-COUNCIL.md', 'supabase/console-approvals.check.sql', 'supabase/school-offboarding.check.sql'],
    today: 'Seven two-person rules that hold in the database are tabulated with their tests. This is a description of enforcement, not a charter.',
    remaining: 'The charter itself (adopted by the owner, with counsel, naming people) and two-person rules for policy, security and data exceptions, which exist nowhere yet.',
    blocker: 'owner',
  },
  {
    id: 'j',
    need: 'Procurement artifacts: architecture and data flow, privacy/terms/AI policy, DPA and subprocessors, SLA/support/implementation, BCDR and incident summaries, accessibility statement and VPAT status, pen-test plan, insurance and company documents',
    verdict: 'partial',
    where: ['docs/market-readiness/PROCUREMENT_CHECKLIST.md', 'docs/trust/DPA-CHECKLIST.md', 'docs/SUBPROCESSORS.md', 'docs/trust/SLA.md', 'docs/trust/PENETRATION-TEST-PLAN.md', 'docs/trust/HECVAT-VPAT-PLAN.md', 'docs/trust/SECURITY-WHITEPAPER.md', 'docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', 'docs/legal/PRIVACY-POLICY-DRAFT.md'],
    today: 'A drafted artifact exists for each named item except insurance and company documents. HECVAT is a draft, not sent; the VPAT is a plan; no pen test has been done.',
    remaining: 'Counsel on the drafts; a real DPA and subprocessor list confirmed; insurance and company documents (not in the repository); a pen test; a VPAT. Until then none is offered as a completed procurement pack.',
    blocker: 'counsel',
  },
  {
    id: 'k',
    need: 'Accessibility proof: keyboard, screen reader, focus and errors, 200/400% reflow, mobile and touch targets, accessible authentication',
    verdict: 'partial',
    where: ['docs/accessibility/AT-PASS-PROTOCOL.md', 'docs/RESPONSIVE-ACCESSIBILITY-TEST-PLAN.md', 'docs/WCAG-UI-AUDIT-SCORECARD.md', 'app/src/components/authaccess.test.ts'],
    today: 'Automated axe, focus, dialog, field-error and contrast tests run in CI; a test protocol for a screen-reader pass exists. Accessible authentication is now held by a guard on the sign-in and account forms: the standard autocomplete tokens are present and nothing blocks paste.',
    remaining: 'No human assistive-technology pass, no 200% and 400% reflow record, no touch-target audit on a device, no ACR/VPAT. No conformance claim is made.',
    blocker: 'manual-test',
  },
  {
    id: 'l',
    need: 'Student support, data-correction, accessibility and privacy routes',
    verdict: 'partial',
    where: ['docs/market-readiness/HUMAN_HELP.md', 'docs/market-readiness/SUPPORT_PLAYBOOK.md', 'docs/DATA-RETENTION-EXPORT-DELETION.md', 'docs/pilot/KNOWN-LIMITATIONS.md'],
    today: 'Self-serve export and erasure, a report route, a human-help route and a support playbook exist. Account-level correction is the student\'s own edit.',
    remaining: 'The data-subject-request queue has no screen and no named answerer; the support address is a personal mailbox; a route for correcting an institution-sourced record is not defined.',
    blocker: 'owner',
  },
  {
    id: 'm',
    need: 'Narrow pilot scorecard and evidence, with targets clearly not claims',
    verdict: 'built-here',
    where: ['docs/pilot/DISCOVERY-EVIDENCE-LOG.md', 'docs/PAID-PILOT-FRAMEWORK.md', 'docs/GO-NO-GO-CHECKLIST.md'],
    today: 'A blank evidence log and scorecard with the TARGET / MEASURED rule; the paid-pilot framework and go/no-go checklist already existed.',
    remaining: 'The targets and the pilot sponsor are the owner\'s; counsel decides whether interviews need consent or review first.',
    blocker: 'owner',
  },
  {
    id: 'n',
    need: 'AI use-case and provider registry, retrieval authorization, evaluations, prompt-injection and exfiltration tests, human review, no autonomous high-impact decisions',
    verdict: 'partial',
    where: ['app/src/lib/trust/provider-terms.ts', 'docs/market-readiness/AI_GOVERNANCE.md', 'docs/evidence/ai', 'app/src/ai/modelquality.live.test.ts', 'docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md'],
    today: 'The providers\' published terms are on file; a kill switch and a 21-case injection red-team are filed with results (29 Sep 2026); a model-quality set exists; AI only explains or drafts and never decides schedule, credit, degree or entitlement.',
    remaining: 'A use-case register (each AI feature, its data, its human review), a retrieval-authorization test (the model cannot be handed another tenant\'s or student\'s rows), an exfiltration test beyond canaries, and a filed model-quality run. The shared key must work first.',
    blocker: 'owner',
  },
  {
    id: 'OA1',
    need: 'Operating artifact: compliance checklist',
    verdict: 'covered',
    where: ['docs/RELEASE-GATES.md', 'docs/GO-NO-GO-CHECKLIST.md', 'docs/trust/COMPLIANCE-CROSSWALK.md'],
    today: 'Row (a). The go/no-go checklist (12 gates), the ten release gates and the compliance crosswalk exist.',
    remaining: 'See (a).',
    blocker: 'owner',
  },
  {
    id: 'OA2',
    need: 'Operating artifact: governance charter',
    verdict: 'partial',
    where: ['docs/DECISION-RIGHTS.md', 'docs/LAUNCH-READINESS-COUNCIL.md'],
    today: 'As row (i): decision rights are tabulated from what the database enforces; no charter has been adopted.',
    remaining: 'Adoption by the owner with counsel; naming people.',
    blocker: 'owner',
  },
  {
    id: 'OA3',
    need: 'Operating artifact: customer-discovery and pilot evidence engine',
    verdict: 'built-here',
    where: ['docs/pilot/DISCOVERY-EVIDENCE-LOG.md'],
    today: 'As row (m): the evidence-log template exists; it holds no findings.',
    remaining: 'Real entries, gathered by the owner.',
    blocker: 'owner',
  },
  {
    id: 'OA4',
    need: 'Operating artifact: incident playbook',
    verdict: 'covered',
    where: ['docs/market-readiness/INCIDENT_RESPONSE.md', 'docs/operating-model/INCIDENT-COMMUNICATIONS.md', 'docs/vanderbilt/incident-routing.md', 'docs/CRISIS-RESPONSE-RUNBOOK.md'],
    today: 'Roles, communications by audience, routing and a crisis runbook exist.',
    remaining: 'Incident owners are unassigned; nothing has been drilled with a person other than the author.',
    blocker: 'owner',
  },
  {
    id: 'OA5',
    need: 'Operating artifact: institutional launch go/no-go review',
    verdict: 'partial',
    where: ['docs/GO-NO-GO-CHECKLIST.md', 'docs/LAUNCH-WAR-ROOM.md', 'app/src/lib/launchreadiness.ts', 'docs/RELEASE-GATES.md'],
    today: 'A twelve-gate go/no-go with a computed verdict (NO-GO), a war-room board, and now ten release gates.',
    remaining: 'The ten release gates are not yet inputs to the computed go/no-go verdict; whether they should be is a decision for the owner.',
    blocker: 'owner',
  },
  {
    id: 'X1',
    need: 'Financial aid, payroll, general ledger and broad system-of-record replacement',
    verdict: 'not-to-build',
    where: ['docs/DOMAIN-REPLACEMENT-REGISTER.md', 'docs/DECISION-LOG.md', 'docs/RELEASE-GATES.md'],
    today: 'Interoperability comes before replacement. Nothing is added here. NOTE: main already contains a student-accounts module (ledger, aid, holds, plans, refunds, provider payments; D-146) and dining/campus-card behind flags, off until a finance owner is named. They are built and off, not ready, and no page may say otherwise.',
    remaining: 'Specialist controls (finance, aid compliance, audit) and pre-pilot evidence before any of it is switched on for a school or claimed. Real institutional data stays out.',
    blocker: 'specialist',
  },
];
