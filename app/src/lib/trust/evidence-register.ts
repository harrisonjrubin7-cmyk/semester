/**
 * The security and compliance evidence register: the one place that says,
 * for every control a university reviewer will ask about, what evidence would
 * prove it operates, who owns producing it, how often, who may see it — and
 * what the tree holds today, which is the control and its test, and never yet
 * the evidence.
 *
 * ## Why this exists
 *
 * `SEMESTER-OPERATING-SYSTEM.md` has listed the "Security/compliance evidence
 * index" as missing since it was written: `docs/evidence/` did not exist then
 * (it now holds a few dated files from operating particular controls, none of
 * them indexed here by control), the
 * master register lets no row above `tested` until it does, and the trust
 * package is the set of documents a reviewer reads rather than proof any of
 * them is operated. Three documents of 28 September 2026 ask for exactly the
 * index — an evidence ID per control, a framework mapping, a frequency, an
 * owner, a customer-visibility class, and a status that separates "the
 * control exists" from "we have current proof it ran". This file is that
 * index. It closes the category by existing; it does not produce a single
 * artifact, and says so on every row.
 *
 * ## The three statuses
 *
 *   - `produced`: an artifact under `docs/evidence/` from operating the
 *     control. A row may use the word only if it cites a file there; the test
 *     refuses it otherwise.
 *   - `defined`: the control and its test exist, so the artifact can be
 *     produced by running something; the row says what. Cites code or a test.
 *   - `owed`: neither the control nor its evidence exists. Cites at most a
 *     document.
 *
 * Every owner is a council seat, never a person; every framework row named
 * is a row of the register that owns it; every path exists. The rendered page
 * is `docs/trust/EVIDENCE-REGISTER.md`; edit the data, then `npm run
 * registers` from app/.
 */

import type { Seat } from '../launchreadiness';
import type { Rubric } from './compliance-crosswalk';

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/Audit-Scorecard-Evidence-Register-and-Sprint-Plan.pdf',
    title: 'Higher-ed edtech audit scorecard: security evidence register, HECVAT mapping, sprint plan, retention policy',
    what: 'The register schema, the initial evidence rows, the feature-to-HECVAT map, the twelve sprints and the retention policy draft.',
  },
  {
    path: 'docs/expansion/Compliance-Matrix-HECVAT-Mapping-and-Dashboard-API.pdf',
    title: 'Build an edtech compliance matrix: HECVAT mapping table, dashboard API, release gate',
    what: 'The control and evidence schemas, the release-manifest gate and the conditions that block a release, and the guardrails.',
  },
  {
    path: 'docs/expansion/University-EdTech-Audit-IT-Compliance-and-Faculty-Playbook.pdf',
    title: 'University edtech audit: IT compliance approach and audit readiness',
    what: 'The compliance operating model with named leads, the control-and-evidence register fields, the procurement room and the readiness checklists.',
  },
  {
    path: 'docs/expansion/HECVAT-vs-TrustEd-Apps-Compliance-Scorecard.pdf',
    title: 'HECVAT cloud infrastructure mapping',
    what: 'The twenty cloud areas, each with a control objective, an implementation, an evidence artifact and a validation cadence.',
  },
];

export const EVIDENCE_DIR = 'docs/evidence';

// ── The operating model: seven leads, held to the council ────────────────────

export interface Lead {
  lead: string;
  seat: Seat;
  owns: string;
}

/** The documents' seven leads, each a council seat from `launchreadiness.ts`. Held or vacant as `COUNCIL` says; the page reads it from there. */
export const LEADS: readonly Lead[] = [
  { lead: 'Executive sponsor', seat: 'founder', owns: 'Risk appetite, budget, major exceptions, customer trust.' },
  { lead: 'Security lead', seat: 'security', owns: 'Security controls, the risk register, access reviews, incident readiness, vulnerability management, technical evidence.' },
  { lead: 'Privacy lead', seat: 'privacy', owns: 'Data inventory, legal and contractual data-use requirements, retention, student requests, subprocessors, FERPA and DPA alignment.' },
  { lead: 'Accessibility lead', seat: 'accessibility', owns: 'Accessibility acceptance criteria, testing, remediation, the ACR/VPAT, accessible-content processes.' },
  { lead: 'AI governance lead', seat: 'product', owns: 'AI inventory, provider approvals, evaluations, policy configuration, safety incidents, model and provider change review, transparency.' },
  { lead: 'Engineering lead', seat: 'engineering', owns: 'Secure development, architecture, environments, deployment controls, monitoring, backup and recovery, remediation.' },
  { lead: 'Customer trust owner', seat: 'trust', owns: 'The procurement room, questionnaire responses, evidence freshness, customer-facing trust communication, contractual commitment mapping.' },
];

/** The fields the documents ask every register row to carry, and which column below carries each. */
export const SCHEMA: readonly { field: string; here: string }[] = [
  { field: 'Evidence ID', here: 'ID' },
  { field: 'Control ID and name', here: 'Control' },
  { field: 'Framework mappings (HECVAT, 1EdTech, master register)', here: 'Rests on' },
  { field: 'Risk addressed', here: 'Control (the clause after the dash)' },
  { field: 'Control owner', here: 'Owner (a council seat)' },
  { field: 'System or process in scope', here: 'What the tree holds' },
  { field: 'Control frequency', here: 'Frequency' },
  { field: 'Evidence description, type and collection method', here: 'Evidence' },
  { field: 'Evidence location, date, review and expiry date, reviewer, hash', here: `Under ${EVIDENCE_DIR}/ when produced; a few dated files are there, but this register does not yet index them by control` },
  { field: 'Result or status', here: 'Status' },
  { field: 'Exception, remediation owner and target date', here: 'The risk register’s exception record, which is empty' },
  { field: 'Customer visibility and sensitivity', here: 'Visibility' },
];

// ── The register ─────────────────────────────────────────────────────────────

export type EvidenceStatus = 'produced' | 'defined' | 'owed';
export type Visibility = 'public' | 'summary' | 'nda';

export const VISIBILITY_MEANING: Record<Visibility, string> = {
  public: 'On the public site or in a public document',
  summary: 'A summary to any prospective customer; the detail under NDA',
  nda: 'Only to a named reviewer through the trust room',
};

export interface Holding {
  path: string;
  shows: string;
}

export interface EvidenceRow {
  /** `SEC-IAM-001` style, stable. */
  id: string;
  control: string;
  rubric: Rubric | null;
  /** Rows of the HECVAT, FERPA/1EdTech, master and maturity registers. Each must exist. */
  rests: readonly string[];
  /** The artifact that would prove the control operated. */
  evidence: string;
  frequency: string;
  owner: Seat;
  visibility: Visibility;
  status: EvidenceStatus;
  /** What exists today. `defined` cites code or a test; `owed` cites at most a document; `produced` cites an artifact under `docs/evidence/`. */
  holds: readonly Holding[];
  /** What would produce the artifact, or what is missing before it could be. */
  produce: string;
}

export const EVIDENCE: readonly EvidenceRow[] = [
  {
    id: 'SEC-IAM-001', control: 'Privileged-access review — a stale grant nobody revoked', rubric: 'security',
    rests: ['IAM-3', 'IAM-011', 'IAM-006'],
    evidence: 'Export of privileged roles, reviewer sign-off, removal tickets.', frequency: 'Quarterly', owner: 'security', visibility: 'nda', status: 'defined',
    holds: [
      { path: 'supabase/role-grant-audit.check.sql', shows: 'every grant, revocation and scope change is an immutable audit row' },
      { path: 'supabase/rolegrants.check.sql', shows: 'grants carry scope, expiry and revocation' },
    ],
    produce: 'Run the role-grant export against production, have the security seat re-justify or revoke each grant, file the export and the sign-off. The proof calendar schedules it quarterly.',
  },
  {
    id: 'SEC-IAM-002', control: 'MFA enforcement — account takeover of an operator', rubric: 'security',
    rests: ['IAM-005', 'GOV-1'],
    evidence: 'Identity-provider policy export or configuration screenshot; a test that a second factor is demanded.', frequency: 'Quarterly and on change', owner: 'security', visibility: 'summary', status: 'defined',
    holds: [
      { path: 'supabase/privileged-mfa.check.sql', shows: 'platform_admin and support_agent grants fail at aal1 and succeed at aal2' },
      { path: 'app/src/screens/console.test.tsx', shows: 'the operations console challenges before protected reads' },
      { path: 'docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', shows: 'the owner attests MFA is on for GitHub, Google and Supabase; an attestation, not evidence' },
    ],
    produce: 'File a dated configuration export from each production console and Supabase Auth; extend product MFA to the remaining adopted staff roles and recovery paths.',
  },
  {
    id: 'SEC-SDLC-001', control: 'Secure code review — a change reaching main unreviewed', rubric: 'security',
    rests: ['SDLC-1', 'SEC-003', 'SRE-008'],
    evidence: 'Branch-protection configuration, a PR audit sample, the CI policy.', frequency: 'Continuous; a quarterly sample', owner: 'engineering', visibility: 'summary', status: 'defined',
    holds: [
      { path: 'app/src/lib/branchprotection.test.ts', shows: 'the branch-protection rules main is held to, with the owner’s bypass recorded' },
      { path: '.github/workflows/ci.yml', shows: 'policy, type, lint and test gates on every change' },
    ],
    produce: 'Export the branch-protection settings and sample ten merged PRs for review evidence, quarterly.',
  },
  {
    id: 'SEC-SDLC-002', control: 'Dependency and secrets scanning — a leaked key or a known-vulnerable package', rubric: 'security',
    rests: ['SDLC-2', 'SEC-004'],
    evidence: 'CI scan history, critical-remediation tickets, the exception list.', frequency: 'Continuous; monthly review', owner: 'engineering', visibility: 'nda', status: 'defined',
    holds: [
      { path: '.gitleaks.toml', shows: 'secret scanning on every push' },
      { path: '.github/dependabot.yml', shows: 'dependency updates opened automatically' },
      { path: 'app/src/lib/supplychain.test.ts', shows: 'every licence and Action named; an SBOM of every deploy' },
    ],
    produce: 'A monthly export of open Dependabot alerts with age and disposition; nothing records dispositions today.',
  },
  {
    id: 'SEC-VULN-001', control: 'Vulnerability management — a finding with no owner and no deadline', rubric: 'security',
    rests: ['VULN-1', 'SEC-004'],
    evidence: 'Scan report, a severity-to-SLA table, remediation evidence.', frequency: 'Continuous; monthly', owner: 'security', visibility: 'summary', status: 'defined',
    holds: [
      { path: 'SECURITY.md', shows: 'how a report is made and handled, the four severities and the remediation target each is held to (2, 14, 60, 180 days), the clock starting at confirmation; the targets accepted unchanged on 29 September 2026 (D-124), no finding yet answered inside its clock' },
      { path: 'app/public/.well-known/security.txt', shows: 'the published disclosure contact, RFC 9116 in form, served under the app\'s base path rather than an origin root' },
      { path: 'app/src/lib/security.test.ts', shows: 'holds the contact to the privacy page and the site, and the severity table to PATCH_POLICY row for row' },
    ],
    produce: 'A monthly report of findings answered inside their clocks, which nothing records today; the targets themselves were accepted on 29 September 2026 (D-124).',
  },
  {
    id: 'SEC-PENT-001', control: 'Independent penetration test — the defect nobody inside would find', rubric: 'security',
    rests: ['VULN-2', 'SEC-005'],
    evidence: 'Scope, executive summary, remediation tracker.', frequency: 'Annual and on major change', owner: 'security', visibility: 'nda', status: 'owed',
    holds: [{ path: 'docs/trust/PENETRATION-TEST-PLAN.md', shows: 'scope, rules of engagement and success criteria for a first test; none performed' }],
    produce: 'Commission the test against the plan; file the executive summary and the tracker.',
  },
  {
    id: 'SEC-DATA-001', control: 'Data inventory and classification — a table nobody can explain to a reviewer', rubric: 'privacy',
    rests: ['PRIV-1', 'SEC-008', 'RM-01'],
    evidence: 'The data map with owner, purpose, classification, storage and retention per class.', frequency: 'Quarterly and on change', owner: 'privacy', visibility: 'summary', status: 'defined',
    holds: [
      { path: 'app/src/lib/retention.test.ts', shows: 'every table in the schema has a retention answer, and every answer names a table' },
      { path: 'RETENTION.md', shows: 'the inventory, per table and per device store' },
    ],
    produce: 'Re-read RETENTION.md against production’s schema each quarter and file the diff; classify by data class rather than by table (RM-01).',
  },
  {
    id: 'SEC-DATA-002', control: 'Deletion and retention enforcement — data kept after the promise said it was gone', rubric: 'privacy',
    rests: ['PRIV-2', 'FERPA-6', 'RM-04'],
    evidence: 'Deletion job logs, a sample deletion traced end to end, backup-expiry validation.', frequency: 'Quarterly', owner: 'privacy', visibility: 'summary', status: 'defined',
    holds: [
      { path: 'supabase/deletion.check.sql', shows: 'account deletion empties every table it claims' },
      { path: 'app/src/lib/deleteaccount.test.ts', shows: 'the delete-account function, live in production' },
      { path: 'supabase/scheduler.sql', shows: 'the sweeps that run the clocks' },
    ],
    produce: 'Run one test-account deletion in production, trace it through every table and the backups’ expiry, file the trace. A legal hold cannot yet be placed, so the hold half is owed (RM-02).',
  },
  {
    id: 'SEC-BCP-001', control: 'Backup restoration — a backup that has never been restored', rubric: 'security',
    rests: ['BCP-1', 'SRE-004', 'SRE-005'],
    evidence: 'Restore-exercise results, measured RTO and RPO, exceptions.', frequency: 'Quarterly', owner: 'engineering', visibility: 'nda', status: 'defined',
    holds: [
      { path: 'supabase/restore-drill.sh', shows: 'the drill, against a disposable project' },
      { path: 'RESTORE.md', shows: 'the procedure and what to record' },
      { path: 'app/src/lib/ops/proofcalendar.test.ts', shows: 'the drill is a scheduled proof, held to the rows it moves and the 90-day item it closes' },
    ],
    produce: 'Run the drill, time it, record row counts before and after; file it as the proof calendar’s month-one restore drill. Nothing has restored production data yet.',
  },
  {
    id: 'SEC-IR-001', control: 'Incident response — a plan nobody has walked through', rubric: 'security',
    rests: ['IR-1', 'SEC-007', 'FERPA-10'],
    evidence: 'Runbook, tabletop attendance, after-action corrective plan.', frequency: 'Annual and on major change', owner: 'security', visibility: 'summary', status: 'defined',
    holds: [
      { path: 'app/src/lib/governance/incident-comms.test.ts', shows: 'every audience gets a notice with the sections its policy requires' },
      { path: 'docs/market-readiness/INCIDENT_RESPONSE.md', shows: 'severity, flow and university-facing templates; never exercised' },
    ],
    produce: 'One P1 walked from first report to customer notice, with who did what and the gaps found; the proof calendar’s month-one tabletop.',
  },
  {
    id: 'SEC-LOG-001', control: 'Audit logging — an administrative action with no record', rubric: 'security',
    rests: ['LOG-1', 'SEC-006', 'FERPA-4'],
    evidence: 'Log architecture, sample audit events, retention configuration.', frequency: 'Quarterly', owner: 'engineering', visibility: 'nda', status: 'defined',
    holds: [
      { path: 'supabase/moderation-audit.check.sql', shows: 'moderation decisions are immutable audit rows' },
      { path: 'supabase/support-access.check.sql', shows: 'every support window and read is recorded and visible to the student' },
      { path: 'supabase/migrations/20260928320000_audit_correlation_and_outbox.sql', shows: 'gateway audit rows carry a correlation id' },
    ],
    produce: 'A quarterly sample of audit events per class with the retention line each is under; no central security alerting exists to sample.',
  },
  {
    id: 'SEC-VEND-001', control: 'Subprocessor review — a vendor that changed terms while nobody looked', rubric: 'privacy',
    rests: ['PRIV-5', 'SEC-010', 'FERPA-11'],
    evidence: 'Vendor inventory, DPA, security review, renewal and change review.', frequency: 'Before use and annually', owner: 'privacy', visibility: 'public', status: 'defined',
    holds: [
      { path: 'app/src/lib/trust/subprocessors.test.ts', shows: 'the register is held to the CSP and the Edge Functions' },
      { path: 'app/src/lib/trust/vendorrisk.test.ts', shows: 'one risk row per subprocessor; no row may claim a review that was not done' },
    ],
    produce: 'The first vendor assessment: obtain and read each vendor’s attestation, record the DPA on file, date the row. None has been done.',
  },
  {
    id: 'SEC-AI-001', control: 'AI provider and data-use review — a provider training on student prompts', rubric: 'genai',
    rests: ['AI-1', 'AI-002', 'FERPA-9'],
    evidence: 'Model inventory, provider terms, retention and training review, approval record.', frequency: 'Before enablement and annually', owner: 'product', visibility: 'summary', status: 'defined',
    holds: [
      { path: 'supabase/intelligence-policy.check.sql', shows: 'a provider is usable only once the institution approves it and a budget' },
      { path: 'app/src/lib/trust/ai-training-policy.test.ts', shows: 'the no-training policy held to the privacy page’s promise' },
    ],
    produce: 'Put each provider’s terms on file with the retention and training position read and dated; the DPA checklist’s no-training clause stays unchecked until then.',
  },
  {
    id: 'SEC-AI-002', control: 'AI evaluation and misuse testing — an answer that cites nothing and nobody noticed', rubric: 'genai',
    rests: ['AI-2', 'AI-010', 'AI-011'],
    evidence: 'Evaluation plan, red-team report, sign-off, issue tracker.', frequency: 'Per model or change', owner: 'product', visibility: 'summary', status: 'owed',
    holds: [
      { path: 'docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md', shows: 'the harness design; no evaluation set from approved course sources and no recorded run' },
      { path: 'docs/evidence/ai/injection-redteam-2026-09-29T22-58-56-465Z-claude-opus-5.json', shows: 'the misuse half, once: the injection red-team on claude-opus-5, 21 cases, none followed (29 September 2026)' },
    ],
    produce: 'Build the evaluation set, run it, record the run with the model version; the proof calendar’s quarterly AI evaluation. The red-team transcript is one run on one model, not the evaluation this row asks for.',
  },
  {
    id: 'ACC-001', control: 'Accessibility release gate — a regression shipped to a screen-reader user', rubric: 'accessibility',
    rests: ['A11Y-1', 'A11Y-001', 'A11Y-002', 'A11Y-003', 'A11Y-004'],
    evidence: 'Automated and manual test results, known issues, the remediation decision.', frequency: 'Per release', owner: 'accessibility', visibility: 'summary', status: 'defined',
    holds: [
      { path: 'app/src/a11y/axe.test.tsx', shows: 'axe-core over the rendered app' },
      { path: 'app/scripts/accessibility-smoke.mjs', shows: 'critical journeys in a real browser at desktop and 320px' },
      { path: 'docs/WCAG-UI-AUDIT-SCORECARD.md', shows: 'a per-component WCAG 2.2 scorecard, every score citing its test' },
    ],
    produce: 'The manual assistive-technology pass per docs/accessibility/AT-PASS-PROTOCOL.md, by a person, filed; then an ACR (A11Y-2). The automated pass is regression evidence, not conformance.',
  },
  {
    id: 'INT-001', control: 'LTI integration validation — a launch that works in the sandbox and not for the school', rubric: 'interoperability',
    rests: ['EDT-1', 'EDT-2', 'EDT-3', 'INT-002'],
    evidence: 'Launch, AGS and NRPS test logs, the data map, customer sign-off.', frequency: 'Per tenant and on change', owner: 'data', visibility: 'summary', status: 'defined',
    holds: [
      { path: 'app/src/lib/ltikey.test.ts', shows: 'signed-token verification, a single-use nonce, no roster requested' },
      { path: 'app/src/lib/ltiags.test.ts', shows: 'grade services gated per registration' },
      { path: 'docs/LTI-1.3-LAUNCH-RUNBOOK.md', shows: 'the per-tenant launch procedure' },
    ],
    produce: 'One launch from a real institution’s platform, logged end to end and signed by its champion; the proof calendar’s month-three SSO/integration test.',
  },
  {
    id: 'PRIV-001', control: 'FERPA disclosure and consent audit — a share nobody can trace to a consent', rubric: 'privacy',
    rests: ['FERPA-5', 'PRIV-6', 'UOS-007'],
    evidence: 'Consent record, disclosure log with recipient, purpose and scope, a revocation test.', frequency: 'Continuous; quarterly review', owner: 'privacy', visibility: 'nda', status: 'defined',
    holds: [
      { path: 'supabase/supportshares.check.sql', shows: 'every read of a share is one event the student sees' },
      { path: 'supabase/advisor.check.sql', shows: 'only the student creates or revokes; a revoked share is not listed' },
      { path: 'app/src/lib/trust/ferpa-consent.test.ts', shows: 'the consent data model held field by field to the share tables' },
    ],
    produce: 'A quarterly sample of shares traced to their events; a purpose per share and a legal basis are not recorded, and the page that holds the model says so.',
  },
  {
    id: 'GOV-001', control: 'Governance and risk review — a risk register nobody reads on a schedule', rubric: 'security',
    rests: ['GOV-1', 'GOV-2', 'PRG-001'],
    evidence: 'Approved policy set, RACI, risk-review minutes, an exception record.', frequency: 'Quarterly; policies annually', owner: 'founder', visibility: 'summary', status: 'defined',
    holds: [
      { path: 'app/src/lib/governance/risk.test.ts', shows: 'every risk has an owner, a tolerance and a control; exceptions expire and a P0 needs three approvers' },
      { path: 'app/src/lib/ops/operatingsystem.test.ts', shows: 'every authoritative document has an owner seat and a next review date' },
    ],
    produce: 'The first quarterly review, minuted: each risk re-read, each seat still vacant named as vacant, each acting holder named as acting.',
  },
  {
    id: 'RET-001', control: 'Legal hold — a deletion that ran while a hold should have stopped it', rubric: 'privacy',
    rests: ['RM-02', 'RM-04', 'RM-05', 'RM-08'],
    evidence: 'A hold placed, deletion refused, the hold released, deletion resumed — logged.', frequency: 'On each hold; the mechanism tested quarterly', owner: 'privacy', visibility: 'nda', status: 'owed',
    holds: [{ path: 'docs/operating-model/OPERATIONAL-MATURITY.md', shows: 'the records-management area: no hold object, no placing role, no runbook' }],
    produce: 'A hold table, a placing role, the check in the deletion path, a runbook; then the test that proves the sequence.',
  },
  {
    id: 'SEC-STATUS-001', control: 'Availability and status — an outage the customer learns of first', rubric: 'security',
    rests: ['MON-1', 'SRE-010', 'SRE-001'],
    evidence: 'Retained availability history, an alert that reached a person, the status-page record.', frequency: 'Continuous; monthly report', owner: 'engineering', visibility: 'public', status: 'defined',
    holds: [
      { path: '.github/workflows/production-smoke.yml', shows: 'synthetic checks of production on a schedule' },
      { path: 'app/src/lib/sla.test.ts', shows: 'the SLA figures held to code' },
      { path: 'app/public/status.html', shows: 'a status page that checks from the reader’s browser' },
    ],
    produce: 'Retain the smoke history and route a failure to an accountable person; report availability monthly. No alert reaches a person today.',
  },
];

// ── Features, mapped to HECVAT ───────────────────────────────────────────────

export interface FeatureMap {
  feature: string;
  risk: string;
  themes: string;
  controls: string;
  evidence: string;
  /** Master rows that carry the feature and its controls. */
  rows: readonly string[];
}

export const FEATURES: readonly FeatureMap[] = [
  { feature: 'Student account and SSO', risk: 'Identity, authentication, account takeover', themes: 'IAM, authentication, access control', controls: 'SSO/OIDC/SAML, MFA for privileged roles, session controls, account recovery', evidence: 'IAM diagram, MFA configuration, access-review evidence', rows: ['IAM-001', 'IAM-002', 'IAM-003', 'IAM-005'] },
  { feature: 'Personal Academic OS', risk: 'Plans, actions, calendar, personal notes', themes: 'Privacy, data classification, application security', controls: 'Private by default, tenant isolation, export and delete, audit, backup', evidence: 'Data map, privacy UX tests, authorization tests', rows: ['STU-001', 'STU-010', 'STU-011', 'IAM-008'] },
  { feature: 'Native LMS and course workspace', risk: 'Course content, enrollment, submissions', themes: 'Application security, privacy, integrations, accessibility', controls: 'Role-based course access, rights controls, LTI validation, secure file handling', evidence: 'Threat model, integration tests, content-access logs', rows: ['LMS-002', 'LMS-003', 'LMS-005', 'LMS-016'] },
  { feature: 'Study Studio and AI', risk: 'Prompts, course sources, generated content', themes: 'AI, vendor management, privacy, security', controls: 'Tenant-scoped retrieval, no general-model training by default, safety filters, provider review', evidence: 'AI inventory, evaluation report, provider DPA', rows: ['AI-002', 'AI-004', 'AI-005', 'AI-011'] },
  { feature: 'Assessment and gradebook', risk: 'Grades, assessment responses, feedback', themes: 'Privacy, integrity, audit, availability', controls: 'Grade ledger, authorized graders, release controls, backup and recovery, no AI-only final grade', evidence: 'Grade change logs, calculation test suite, restore test', rows: ['LMS-008', 'LMS-011', 'LMS-013', 'AI-009'] },
  { feature: 'Clubs and community', risk: 'Social data, harassment, moderation evidence', themes: 'Privacy, social interactions, access, incident response', controls: 'Role scope, block and report, moderation workflow, retention, appeal', evidence: 'Policy, case-audit sample, role matrix', rows: ['UOS-003', 'UOS-002'] },
  { feature: 'Peer mentorship', risk: 'Private communications, sensitive context', themes: 'Privacy, access control, safety', controls: 'Opt-in, boundaries, limited coordinator view, escalation, data minimization', evidence: 'Consent flow, training record, access test', rows: ['UOS-003', 'UOS-007'] },
  { feature: 'Basic-needs navigator', risk: 'Highly sensitive help-seeking', themes: 'Privacy, data minimization, incident response', controls: 'Private browsing, named referral, consented sharing, restricted case access', evidence: 'Resource policy, consent logs, authorization tests', rows: ['STU-012', 'UOS-007'] },
  { feature: 'Career and opportunity network', risk: 'Portfolio, employer visibility, opportunity data', themes: 'Privacy, third parties, access control', controls: 'Student opt-in, artifact-level sharing, no academic-data sale, expiry and revoke', evidence: 'Sharing logs, employer terms, access audit', rows: ['UOS-004', 'UOS-005', 'UOS-007'] },
  { feature: 'Operations Console', risk: 'Production data, privileged actions', themes: 'IAM, logging, change management, security', controls: 'Least privilege, time-bound support access, approval, audit, break-glass review', evidence: 'Console access logs, approvals, access reviews', rows: ['IAM-010', 'IAM-011', 'SEC-006'] },
  { feature: 'Integrations gateway', risk: 'External credentials, roster and grade data', themes: 'Third-party risk, encryption, APIs, monitoring', controls: 'Secret vault, scoped OAuth, rate-limit handling, retry and reconciliation, tenant segregation', evidence: 'Data-flow map, secret policy, sync logs', rows: ['INT-001', 'INT-009', 'INT-013', 'INT-014'] },
  { feature: 'Payments', risk: 'Financial and transaction data', themes: 'Payment security, vendor risk, logging', controls: 'A compliant processor, tokenization, no card data, reconciliation', evidence: 'Processor attestation, architecture diagram, access controls', rows: ['COM-001'] },
];

// ── The cloud, area by area ──────────────────────────────────────────────────

export type Where = 'tree' | 'provider' | 'owed';

export const WHERE_MEANING: Record<Where, string> = {
  tree: 'Held in this repository, and the cited file shows it',
  provider: 'Supabase, Vercel or GitHub operates it under their own attestations; the cited file says which and what Semester configures',
  owed: 'Nobody holds it yet',
};

export interface CloudArea {
  area: string;
  objective: string;
  implementation: string;
  where: Where;
  /** Required for `tree` and `provider`; null for `owed`. */
  path: string | null;
  cadence: string;
}

export const CLOUD: readonly CloudArea[] = [
  { area: 'Account hierarchy', objective: 'Separate production, staging, development and shared services', implementation: 'One production Supabase project and a second for restore drills; preview deploys per pull request; no staging project', where: 'tree', path: 'STAGING.md', cadence: 'Quarterly and on change' },
  { area: 'Network segmentation', objective: 'Limit service-to-service and public exposure', implementation: 'The database is reachable only through PostgREST and Edge Functions under RLS; no direct database connection from any browser or gateway', where: 'provider', path: 'docs/architecture/0002-rls-is-the-authorization-boundary.md', cadence: 'Continuous' },
  { area: 'Edge protection', objective: 'Protect web and API endpoints from abuse', implementation: 'TLS and headers from the hosts; per-account rate limits at the gateway and on direct writes', where: 'tree', path: 'supabase/migrations/20260928230000_direct_rate_limits.sql', cadence: 'Continuous' },
  { area: 'Identity', objective: 'Prevent unauthorized cloud and admin access', implementation: 'Owner MFA on GitHub, Google and Supabase by attestation; no just-in-time privilege, no break-glass workflow', where: 'owed', path: null, cadence: 'Quarterly' },
  { area: 'Secrets', objective: 'Protect credentials, keys and integration tokens', implementation: 'Secrets in the hosts’ managed stores; gitleaks on every push; the service role never in a browser', where: 'tree', path: 'SECRETS.md', cadence: 'Continuous; monthly' },
  { area: 'Encryption', objective: 'Protect data in transit and at rest', implementation: 'TLS everywhere; provider encryption at rest; gateway action bodies encrypted before storage', where: 'provider', path: 'app/server/institution/journal-crypto.ts', cadence: 'Quarterly' },
  { area: 'Key management', objective: 'Control key ownership and use', implementation: 'Provider-managed keys; the journal key is an environment secret; no rotation record and no key-location statement', where: 'owed', path: null, cadence: 'Quarterly' },
  { area: 'Compute hardening', objective: 'Minimize the exploitable surface', implementation: 'Static build on GitHub Pages; Edge Functions and Vercel functions with pinned runtimes; nothing long-running', where: 'provider', path: 'supabase/config.toml', cadence: 'Per build' },
  { area: 'CI/CD security', objective: 'Prevent insecure or unauthorized deployment', implementation: 'Protected main, CI gates, deploy workflows from main only; the owner may bypass review, recorded', where: 'tree', path: 'docs/BRANCH-PROTECTION.md', cadence: 'Every release' },
  { area: 'Infrastructure as code', objective: 'Make configuration reviewable and reproducible', implementation: 'Migrations, Edge Function config, host headers and workflows are in the tree; the hosts’ dashboards are not', where: 'tree', path: 'supabase/DEPLOY.md', cadence: 'Every change' },
  { area: 'Database security', objective: 'Restrict and monitor access to student data', implementation: 'RLS on every table by event trigger; policy checks in CI; access log on reads around RLS', where: 'tree', path: 'supabase/tenancy.check.sql', cadence: 'Quarterly' },
  { area: 'Object and file storage', objective: 'Secure submissions, content and exports', implementation: 'Private buckets under storage RLS; signed time-limited URLs; no malware scanning', where: 'tree', path: 'supabase/community.check.sql', cadence: 'Quarterly' },
  { area: 'Backups', objective: 'Recover from deletion, corruption or outage', implementation: 'Provider daily backups; a scripted restore drill; never yet run against production data', where: 'tree', path: 'supabase/restore-drill.sh', cadence: 'Quarterly' },
  { area: 'Monitoring', objective: 'Detect infrastructure and application threats', implementation: 'Scheduled production smoke tests and a status page; no alert reaches a person, no detection rules', where: 'tree', path: 'MONITORING.md', cadence: 'Continuous' },
  { area: 'Vulnerability management', objective: 'Find and remediate weaknesses', implementation: 'Dependabot and gitleaks; no image, container or external scan; no severity SLA', where: 'tree', path: '.github/dependabot.yml', cadence: 'Continuous; monthly' },
  { area: 'Audit trails', objective: 'Support investigations and accountability', implementation: 'Immutable audit rows for grants, moderation, provisioning and support access; gateway audit with correlation ids', where: 'tree', path: 'supabase/role-grant-audit.check.sql', cadence: 'Quarterly' },
  { area: 'Availability', objective: 'Maintain service through component failure', implementation: 'Static app that works offline; the SLA formula and the journeys’ SLOs are defined; no failover exercise', where: 'tree', path: 'docs/trust/SLA.md', cadence: 'Quarterly' },
  { area: 'Regional and residency', objective: 'Meet location obligations', implementation: 'One region, chosen by the provider’s default; subprocessor locations partly named; no customer selection', where: 'owed', path: null, cadence: 'Onboarding and change' },
  { area: 'Secure disposal', objective: 'Remove data and infrastructure securely', implementation: 'Account deletion empties the tables it claims; backups expire on the provider’s schedule; no key destruction record', where: 'tree', path: 'supabase/deletion.check.sql', cadence: 'Quarterly' },
  { area: 'Third-party cloud risk', objective: 'Control provider dependencies', implementation: 'Provider inventory and exit posture written; no assessment read, no contract on file', where: 'tree', path: 'docs/trust/VENDOR-RISK-REGISTER.md', cadence: 'Annual and on change' },
];

// ── What blocks a release ────────────────────────────────────────────────────

export interface Blocker {
  condition: string;
  /** What holds it today, or null. */
  path: string | null;
  how: string;
}

/** The documents' automated release gate: the dashboard blocks a release when any of these is true. */
export const BLOCKERS: readonly Blocker[] = [
  { condition: 'A P0 or P1 release-blocking finding is open.', path: 'app/src/lib/governance/release-readiness.ts', how: 'A promotion needs the readiness total above the stage threshold and no dimension under the floor; a finding is not yet an object the score reads.' },
  { condition: 'A required control has no current evidence.', path: null, how: 'Nothing reads evidence freshness: the few dated files under docs/evidence/ carry no expiry that anything checks; the operations-console controls define the freshness ladder a console would apply.' },
  { condition: 'A data-flow change lacks privacy approval.', path: 'app/src/lib/governance/config-tiers.ts', how: 'A configuration request is classified by tier and the privacy reviewer is required at the tiers that touch data; a code change to a data flow is reviewed by the pull-request template’s questions, not a gate.' },
  { condition: 'An AI, provider, model or tool change lacks evaluation approval.', path: 'app/src/lib/governance/ai-lifecycle.ts', how: 'G3 requires every AI_RELEASE_GATE item; the gate is data a reviewer reads, not a check CI runs.' },
  { condition: 'A critical accessibility regression is unresolved.', path: 'app/src/a11y/axe.test.tsx', how: 'axe-core and the accessibility smoke fail the build on a regression they can see; a manual finding has no register to block from.' },
  { condition: 'A high-risk exception is expired or unapproved.', path: 'app/src/lib/governance/risk.ts', how: 'reviewException() refuses an expired exception and a P0 without executive, security and legal approval; EXCEPTIONS is empty.' },
  { condition: 'A grade or integration write workflow lacks reconciliation evidence.', path: 'packages/institution/src/workflow.ts', how: 'The grade-passback machine cannot leave ambiguous except through reconciliation_required; the journal never retries an uncertain action.' },
];

// ── Retention, by data class ─────────────────────────────────────────────────

export interface RetentionClass {
  cls: string;
  examples: string;
  /** The documents' default approach. */
  approach: string;
  /** What RETENTION.md says today. */
  today: string;
  /** Tables or stores RETENTION.md must name for the row to stand. */
  names: readonly string[];
  configurable: boolean;
}

export const RETENTION_CLASSES: readonly RetentionClass[] = [
  { cls: 'Account and identity', examples: 'Name, email, SSO identifiers, authentication records', approach: 'Active account plus a defined post-termination period; delete or anonymize unless retention is required', today: 'Until the student deletes the account; abandoned sign-ups swept after 30 days', names: ['sweep_abandoned_signups'], configurable: false },
  { cls: 'Student private workspace', examples: 'Plans, actions, notes, preferences, eligible AI history', approach: 'While the account or feature is active; honour deletion; preserve only under a hold', today: 'Until the student deletes it — the promise on the privacy screen; tombstones swept after 90 days', names: ['notes', 'tasks', 'sweep_tombstones'], configurable: false },
  { cls: 'Course content', examples: 'Instructor materials, source documents, syllabus data', approach: 'Customer-controlled course lifecycle plus a configured archive period', today: 'Until the student deletes it; no institutional archive period exists', names: ['courses'], configurable: false },
  { cls: 'Assessment, submission and grade records', examples: 'Submissions, feedback, grade ledger, audit history', approach: 'The institution’s records schedule; never deleted contrary to academic-record requirements', today: 'Until the student deletes it; no records schedule can be configured', names: ['sittings'], configurable: false },
  { cls: 'Community and club content', examples: 'Profiles, posts, memberships, event activity', approach: 'Active lifecycle plus a configured archive period; moderation evidence only as needed', today: 'Until deleted; moderation audit events kept three years', names: ['moderation_audit_event'], configurable: false },
  { cls: 'Support data', examples: 'Tickets, diagnostic logs, support-access records', approach: 'A defined support and security period; minimal attachments', today: 'The identity-free ticket queue is built and capability-gated; support access is time-limited and every read is logged. Per-ticket email notices are off by default, contain no reply text, and use a durable delivery outbox only after student opt-in.', names: ['support_access', 'support_tickets', 'support_ticket_messages', 'support_notification_outbox'], configurable: false },
  { cls: 'Basic-needs and referral metadata', examples: 'Consent, recipient, status, limited referral record', approach: 'Minimum necessary; sensitive intake stays with the official service', today: 'Nothing is taken in: the navigator is a directory and stores no referral', names: ['help_request'], configurable: false },
  { cls: 'AI data', examples: 'Prompts, outputs, policy decisions, evaluation samples', approach: 'Minimum period for operation, safety and support; production usage apart from de-identified evaluation', today: 'Gateway intelligence audit metadata 180 days, never prompts or prose; unconfirmed actions one day after expiry', names: ['gateway_intelligence_audit', 'gateway_intelligence_action'], configurable: false },
  { cls: 'Security and audit logs', examples: 'Authentication, access, administrative actions, security events', approach: 'Per security and contractual requirements; access restricted', today: 'Access log 90 days; activity 400 days; grant, moderation and provisioning audit 3 years', names: ['access_log', 'activity', 'role_grant_audit_event'], configurable: false },
  { cls: 'Integration data', examples: 'Sync state, external ids, error records, reconciliation logs', approach: 'Active connection plus a troubleshooting period; credentials removed on disconnect', today: 'Gateway audit 180 days; rate-limit counters one day; LTI nonces an hour past expiry', names: ['gateway_audit', 'lti_nonce'], configurable: false },
  { cls: 'Billing and contract records', examples: 'Invoices, contracts, tax and payment records', approach: 'As law, accounting and contract require', today: 'None exist; billing stays out (D-009), and RETENTION.md names no such class', names: [], configurable: false },
  { cls: 'Backups', examples: 'Encrypted point-in-time copies', approach: 'A short documented lifecycle; rolling expiry; never the primary store', today: 'The provider’s daily backups, each expiring 7 days after it is taken per the plan tier’s documentation — not yet read off the dashboard on a date; PITR unconfirmed; no process reads one, and a deleted row outlives its deletion by at most that period except after a restore, which must re-apply the deletions (RETENTION.md, *Backups*; RESTORE.md)', names: [], configurable: false },
];

export const RETENTION_PRINCIPLES: readonly string[] = [
  'Purpose limitation', 'Data minimization', 'Tenant-specific configuration', 'Student and customer data agency', 'Secure deletion', 'Backup lifecycle management',
  'Preservation for valid legal holds', 'Access restriction during retention', 'Documented exceptions', 'Transparent communication',
];

export const DELETION_STEPS: readonly string[] = [
  'Verify authority and scope.',
  'Identify active shares, dependencies and legal holds.',
  'Delete or de-identify eligible primary data.',
  'Revoke applicable access and integration tokens.',
  'Queue deletion of derived indexes, caches and eligible AI retrieval representations.',
  'Allow encrypted backups to expire through their documented lifecycle.',
  'Record completion and exceptions in an audit log.',
  'Confirm to the authorized requester where appropriate.',
];

// ── The twelve sprints and the backlog ───────────────────────────────────────

export interface Sprint {
  n: number;
  objective: string;
  output: string;
  value: string;
  rows: readonly string[];
}

export const SPRINTS: readonly Sprint[] = [
  { n: 1, objective: 'Tenant isolation and shared identity foundation', output: 'Authorization test suite, tenant-bound audit events', value: 'A safe multi-institution foundation', rows: ['IAM-007', 'IAM-008', 'UOS-009', 'TEN-1'] },
  { n: 2, objective: 'Data inventory and classification service', output: 'Data map and field-classification registry', value: 'Clear privacy and procurement answers', rows: ['PRIV-1', 'SEC-008', 'RM-01'] },
  { n: 3, objective: 'Consent, share and revoke engine', output: 'Consent and disclosure logs, revocation tests', value: 'Student data agency', rows: ['UOS-007', 'FERPA-5', 'PRIV-6'] },
  { n: 4, objective: 'Central audit log and evidence service', output: 'Immutable audit-event schema and access logs', value: 'Traceable operations', rows: ['SEC-006', 'LOG-1', 'FERPA-4'] },
  { n: 5, objective: 'Secrets, CI security and SDLC gates', output: 'Scan reports, branch protection, deployment evidence', value: 'A security baseline', rows: ['SEC-003', 'SDLC-1', 'SDLC-2'] },
  { n: 6, objective: 'Backup, restore and incident readiness', output: 'Restore test, RTO/RPO record, incident tabletop', value: 'Reliability confidence', rows: ['SRE-005', 'BCP-1', 'IR-1', 'SEC-007'] },
  { n: 7, objective: 'Accessibility design system and release gate', output: 'Component test suite, accessibility backlog', value: 'An inclusive experience and the ACR foundation', rows: ['A11Y-001', 'A11Y-1', 'A11Y-2', 'PRG-004'] },
  { n: 8, objective: 'AI policy and provider control plane', output: 'AI inventory, policy decisions, provider review', value: 'A governed AI posture', rows: ['AI-001', 'AI-002', 'AI-006', 'AI-1'] },
  { n: 9, objective: 'Source, scope and status metadata service', output: 'Trust-payload API and the user-facing component', value: 'An honest, understandable product', rows: ['TRUST-001', 'TRUST-002', 'TRUST-003', 'TRUST-004'] },
  { n: 10, objective: 'LTI and OneRoster integration gateway and sandbox', output: 'Conformance test logs, integration data maps', value: 'Interoperability readiness', rows: ['INT-002', 'INT-005', 'INT-006', 'INT-1'] },
  { n: 11, objective: 'Gradebook ledger and assessment audit controls', output: 'Grade calculation tests, release and change audit', value: 'Trustworthy grading', rows: ['LMS-011', 'LMS-012', 'LMS-013'] },
  { n: 12, objective: 'Procurement room and evidence export', output: 'HECVAT response library, customer trust dashboard', value: 'Faster enterprise evaluation', rows: ['COM-003', 'SEC-011', 'SEC-013'] },
];

export type Priority = 'P0' | 'P1' | 'P2';

export const PRIORITY_MEANING: Record<Priority, string> = {
  P0: 'Before enterprise pilots: security, privacy, data-loss, critical accessibility, grade integrity, or misleading AI or official-information risk',
  P1: 'Before broad institutional rollout: blocks procurement, integration, adoption, support or core student value',
  P2: 'Benchmark differentiation',
};

export interface BacklogItem {
  priority: Priority;
  capability: string;
  rows: readonly string[];
}

export const BACKLOG: readonly BacklogItem[] = [
  { priority: 'P0', capability: 'Tenant isolation and authorization test suite', rows: ['IAM-007', 'IAM-008', 'TEN-1'] },
  { priority: 'P0', capability: 'SSO, MFA and privileged-access review', rows: ['IAM-003', 'IAM-005', 'IAM-011', 'IAM-3'] },
  { priority: 'P0', capability: 'Encryption, secrets vault, secure logging, backups and a restore test', rows: ['CRYPTO-1', 'SEC-006', 'SRE-005', 'BCP-1'] },
  { priority: 'P0', capability: 'Data inventory, DPA, subprocessor inventory, retention, legal hold and deletion controls', rows: ['PRIV-1', 'PRIV-4', 'PRIV-5', 'RM-02'] },
  { priority: 'P0', capability: 'Accessibility design system and critical-path manual testing', rows: ['PRG-004', 'A11Y-3'] },
  { priority: 'P0', capability: 'AI provider inventory, no-training default, policy engine, evaluation baseline', rows: ['AI-002', 'AI-006', 'AI-011', 'AI-2'] },
  { priority: 'P0', capability: 'Incident response and customer-notification runbooks', rows: ['SEC-007', 'IR-1'] },
  { priority: 'P0', capability: 'LTI 1.3 integration test harness and scoped token and key controls', rows: ['INT-002', 'EDT-1'] },
  { priority: 'P0', capability: 'HECVAT evidence library and a secure procurement room', rows: ['SEC-011', 'COM-003'] },
  { priority: 'P0', capability: 'A current ACR/VPAT and an accessibility remediation process', rows: ['A11Y-007', 'A11Y-2', 'A11Y-4'] },
  { priority: 'P1', capability: 'Automated CI/CD security and accessibility release gates', rows: ['SEC-003', 'SRE-008', 'A11Y-1'] },
  { priority: 'P1', capability: 'Customer trust evidence dashboard', rows: ['SEC-013'] },
  { priority: 'P1', capability: 'Integration health, reconciliation and offboarding and export tools', rows: ['INT-014', 'LEG-004', 'FERPA-7'] },
  { priority: 'P1', capability: 'A formal vulnerability disclosure and annual penetration-test programme', rows: ['VULN-1', 'VULN-2', 'SEC-005'] },
  { priority: 'P1', capability: 'Faculty and admin change-management and training evidence', rows: ['SUP-003', 'IMP-001', 'AD-03'] },
  { priority: 'P1', capability: 'Continuous compliance-control monitoring', rows: ['GOV-2', 'SEC-001'] },
  { priority: 'P1', capability: 'Automated evidence freshness and expiry alerts', rows: ['DO-03', 'SEC-013'] },
  { priority: 'P1', capability: 'A tenant-specific policy and data-map dashboard', rows: ['SEC-013', 'IMP-001'] },
  { priority: 'P2', capability: 'Public transparency and accessibility and AI change logs', rows: ['PRG-002', 'LW-06'] },
  { priority: 'P2', capability: 'The 1EdTech interoperability conformance and certification path', rows: ['EDT-5', 'EDT-7'] },
  { priority: 'P2', capability: 'The Semester Standard annual evidence report', rows: ['PRG-002', 'SEC-012', 'LEGAL-1'] },
  { priority: 'P2', capability: 'Cross-region and data-residency controls', rows: ['DR-02', 'DR-07'] },
  { priority: 'P2', capability: 'An independent assurance programme, such as SOC 2, if commercially appropriate', rows: ['SEC-012', 'LEGAL-1'] },
];

/** The documents' audit-to-sprint workflow, as the rule this register is worked by. */
export const AUDIT_TO_SPRINT: readonly string[] = [
  'An audit finding is mapped to a risk and to the framework controls it touches.',
  'A product or control owner is identified — a seat, until the seat is held.',
  'Measurable acceptance criteria are defined.',
  'An engineering story and its evidence artifact are created together.',
  'It is implemented and tested.',
  'Security, privacy and accessibility review it.',
  'The evidence is stored under docs/evidence/ with its date and reviewer.',
  'The control’s status is updated in the register that owns it.',
  'It is validated in staging and production.',
  'The customer-facing claim changes only after the evidence exists.',
];

export const GUARDRAILS: readonly string[] = [
  'Never store a sensitive audit artifact in a broadly readable place: store the reference, hash, classification, owner, expiry and access policy, and keep the original in the trust room.',
  'Never mark a control effective because a policy exists; require evidence of implementation and of operation.',
  'Never hardcode a HECVAT question number as universal; question ids and applicability differ by version and by customer.',
  'Keep six things apart: implementation status, evidence freshness, test effectiveness, risk acceptance, customer-specific applicability, and public-claim eligibility.',
];

/** Every register id the page names, once. */
export function allRests(): string[] {
  const ids = new Set<string>();
  for (const e of EVIDENCE) for (const id of e.rests) ids.add(id);
  for (const f of FEATURES) for (const id of f.rows) ids.add(id);
  for (const s of SPRINTS) for (const id of s.rows) ids.add(id);
  for (const b of BACKLOG) for (const id of b.rows) ids.add(id);
  return [...ids];
}
