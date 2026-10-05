/**
 * The operational readiness pack, held to the tree.
 *
 * Two documents of 28 September 2026 — the *Semester Operational Readiness
 * Pack* and the audit checklist written from it — say when a release, a
 * pilot, an integration or a module is operational: not when it is deployed,
 * but when it has a named owner, tested controls, observability, a support
 * path, a recovery plan, evidence, and a signed go/no-go decision. They are
 * kept under `docs/expansion/` as supplied.
 *
 * ## What this file is
 *
 * The pack's own structure — five workstreams, nine decision domains, the
 * seven pillars of production safety with their checklists, the dependency
 * register, the minimum runbooks, the launch gate with its three outcomes,
 * the review packet, the sign-off record, the cadences and the first twelve
 * initiatives — with each item pointed at what the repository holds for it.
 * A checklist item rests on rows of the registers that already exist (the
 * master, HECVAT, FERPA/1EdTech and maturity registers, and the twelve launch
 * gates of `launchreadiness.ts`); `readiness-pack.test.ts` reads those and
 * computes each item's level on the crosswalk's 0–4 scale. A gate's verdict
 * — GO, GO WITH CONDITIONS, NO-GO — is `verdict()`, a pure function of the
 * levels, and the page prints what it returns today. A dependency's status
 * and a runbook's tested date are what the tree can show, which is that no
 * dependency has been tested and no runbook has a tested date.
 *
 * `docs/OPERATIONAL-READINESS-PACK.md` is rendered from this file by its
 * test; edit the data, then `npm run registers` from app/.
 *
 * The pack's rule is the one this repository already keeps for launch: a row
 * is never complete because it is designed, coded or documented, only when it
 * is evidenced and signed (`launchreadiness.ts`, `masterregister.ts`). Nothing
 * here is signed; who holds each seat is read from `COUNCIL`, never written here.
 */

import type { Seat } from '../launchreadiness';
import type { Level } from '../trust/compliance-crosswalk';

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/Semester-Operational-Readiness-Pack.pdf',
    title: 'Semester Operational Readiness Pack',
    what: 'The master operating plan, the workstreams and decision owners, the seven pillars with their checklists, the dependency register, the runbook template and minimum runbooks, the launch gate, the sign-off record, the cadences and the first twelve initiatives.',
  },
  {
    path: 'docs/expansion/Operational-Readiness-Audit-Checklist.pdf',
    title: 'Build an operational readiness audit checklist: 7 pillars, unbuilt dependencies, recovery runbooks',
    what: 'The summary the pack was written from: the plan fields, the five workstreams, the pillars, the mandatory gates and the runbook structure.',
  },
];

export const RULE = 'A feature is not operational because it is deployed. It is operational only when it has a named owner, tested controls, observability, a support path, a recovery plan, evidence, and a signed go/no-go decision.';

// ── Workstreams, decision owners, the DRI rules ──────────────────────────────

export interface Workstream {
  id: string;
  workstream: string;
  mission: string;
  /** The pack's accountable lead, as a council seat. */
  seat: Seat;
  cadence: string;
  examples: string;
}

export const WORKSTREAMS: readonly Workstream[] = [
  { id: 'product', workstream: 'Product & Engineering', mission: 'Deliver a coherent, accessible, reliable platform.', seat: 'engineering', cadence: 'Weekly delivery and reliability review', examples: 'Shared object model, Today, the LMS, Study Studio, the grade ledger, integrations, performance.' },
  { id: 'trust', workstream: 'Trust & Compliance', mission: 'Prove and maintain security, privacy, accessibility, AI and interoperability controls.', seat: 'security', cadence: 'Weekly risk triage; monthly control review', examples: 'HECVAT, TrustEd Apps readiness, the data inventory, AI governance, the ACR/VPAT, the evidence register.' },
  { id: 'delivery', workstream: 'Customer Delivery', mission: 'Configure, launch, train, support, measure, renew and offboard customers.', seat: 'success', cadence: 'Weekly customer health review', examples: 'The implementation factory, the support service, success plans, pilot measurement, customer health.' },
  { id: 'commercial', workstream: 'Commercial', mission: 'Build predictable demand and revenue.', seat: 'founder', cadence: 'Weekly pipeline and forecast review', examples: 'Positioning, pricing, CRM, pilots, proposals, contracts, partnerships, renewals.' },
  { id: 'corporate', workstream: 'Corporate Operations', mission: 'Operate a durable company.', seat: 'founder', cadence: 'Monthly close and operating review', examples: 'Entity, IP, finance, insurance, people, vendors, board and advisor governance.' },
];

export interface DecisionDomain {
  domain: string;
  accountable: Seat;
  reviewers: readonly Seat[];
}

export const DECISION_DOMAINS: readonly DecisionDomain[] = [
  { domain: 'A new product feature', accountable: 'product', reviewers: ['engineering', 'accessibility', 'security', 'privacy', 'success'] },
  { domain: 'A new AI model, provider or tool action', accountable: 'product', reviewers: ['security', 'privacy', 'engineering', 'accessibility'] },
  { domain: 'A new integration or data flow', accountable: 'data', reviewers: ['security', 'privacy', 'product', 'success', 'champion'] },
  { domain: 'A high-risk grading or assessment capability', accountable: 'product', reviewers: ['accessibility', 'security', 'privacy', 'champion'] },
  { domain: 'A sensitive support or basic-needs workflow', accountable: 'trust', reviewers: ['privacy', 'security', 'accessibility', 'champion'] },
  { domain: 'A production release', accountable: 'engineering', reviewers: ['product', 'security', 'accessibility', 'success'] },
  { domain: 'A customer go-live', accountable: 'success', reviewers: ['champion', 'product', 'data', 'security', 'privacy'] },
  { domain: 'A commercial exception or discount', accountable: 'founder', reviewers: ['privacy', 'success'] },
  { domain: 'Risk acceptance', accountable: 'founder', reviewers: ['security', 'privacy', 'accessibility', 'product'] },
];

export const DRI_RULES: readonly { rule: string; path: string | null; note: string }[] = [
  { rule: 'Every production system has one accountable owner and one backup owner.', path: 'app/src/lib/ops/operatingsystem.ts', note: 'Every authoritative document has an owner seat; no backup, and every held seat is held by the same person, acting.' },
  { rule: 'Every customer implementation has one Semester owner and one customer owner.', path: 'app/src/lib/launchreadiness.ts', note: 'The champion seat is the customer’s; the success seat is Semester’s. Neither is held.' },
  { rule: 'Every integration has technical, data and operational owners.', path: 'app/src/lib/governance/data-contracts.ts', note: 'A contract is unstaffed until a named person holds the data owner, steward, integration owner and privacy owner roles.' },
  { rule: 'Every data source has a source owner and a freshness SLA.', path: 'app/src/lib/integration/freshness.ts', note: 'Freshness classes exist per connector; a source owner is a stewardship assignment nobody holds.' },
  { rule: 'Every runbook has an owner, a last-tested date, a review date and an escalation path.', path: null, note: 'No runbook carries a tested date (maturity DO-04 partial); the operating system dates the documents, not the drills.' },
  { rule: 'No critical responsibility is held only in one person’s memory.', path: null, note: 'A single-member company: every responsibility is held by one person, and the page says so rather than inventing a backup.' },
];

// ── The seven pillars ────────────────────────────────────────────────────────

export interface PillarItem {
  item: string;
  /** Rows of the four registers, or a launch gate as `gate:<id>`. Empty means nothing carries it. */
  rests: readonly string[];
}

export interface Pillar {
  id: string;
  pillar: string;
  question: string;
  evidence: string;
  items: readonly PillarItem[];
}

const p = (item: string, rests: readonly string[]): PillarItem => ({ item, rests });

export const PILLARS: readonly Pillar[] = [
  {
    id: 'reliability', pillar: 'Reliability and failure behaviour',
    question: 'Does the service remain understandable, safe and recoverable when a dependency fails?',
    evidence: 'Critical-journey map, dependency inventory, SLO document, error-state tests, status-page test, runbooks.',
    items: [
      p('Critical user journeys are documented.', ['gate:golden-path', 'SRE-001']),
      p('Service tiers and SLOs are defined.', ['SRE-001']),
      p('Dependencies are inventoried and classified by criticality.', ['EX-01', 'SEC-010']),
      p('Timeouts, retries, circuit breakers and graceful degradation are defined.', ['INT-014', 'SRE-008']),
      p('Error messages give the user a next action and a support route.', ['STU-012', 'gate:known-limitations']),
      p('Maintenance windows and change freezes are defined for critical academic dates.', ['SRE-009']),
      p('The status page and customer-communication process are operational.', ['SRE-010', 'SEC-007']),
      p('No unsupported claim of 24/7 or emergency response is made.', ['SUP-002', 'PRG-002']),
      p('Failure modes have user-visible source, scope and status states.', ['TRUST-002', 'TRUST-004']),
    ],
  },
  {
    id: 'data', pillar: 'Data integrity and recovery',
    question: 'Can Semester prevent, detect, correct and recover from data loss, corruption, duplication or stale integration data?',
    evidence: 'Backup configuration, restore record, migration logs, reconciliation report, deletion and hold test, ledger tests.',
    items: [
      p('Data classification and the authoritative-source map are current.', ['PRIV-1', 'TRUST-001']),
      p('Every important object has source, freshness, version, owner and audit metadata.', ['TRUST-001', 'TRUST-002', 'SEC-006']),
      p('Database backups are encrypted, monitored and restore-tested.', ['SRE-004', 'BCP-1', 'gate:backup-restore']),
      p('RTO and RPO are defined for each service tier.', ['SRE-006', 'BCP-1']),
      p('The restore runbook is tested with recorded results.', ['SRE-005', 'BCP-1']),
      p('Migrations are versioned, reviewed, tested and have rollback or repair plans.', ['MIG-006', 'SRE-008']),
      p('Critical writes are idempotent or protected by a write ledger.', ['AI-009', 'INT-005']),
      p('Grade, payment, consent, share and integration writes are auditable and reconcilable.', ['LMS-013', 'UOS-007', 'INT-014']),
      p('Deletion, retention, legal hold, export and backup-expiry behaviour is tested.', ['PRIV-2', 'RM-02', 'RM-08']),
      p('A reconciliation dashboard exists for material integrations.', ['INT-014']),
      p('Dead-letter queues and manual repair workflows exist for failed syncs.', ['INT-013', 'INT-014']),
    ],
  },
  {
    id: 'observability', pillar: 'Observability and incident response',
    question: 'Can the team detect, understand, communicate and resolve failures before they become prolonged customer harm?',
    evidence: 'Dashboard configuration, alert test, incident plan, tabletop report, corrective-action tracker.',
    items: [
      p('Centralized logs, metrics, traces and audit events exist for production systems.', ['SEC-006', 'SRE-002', 'SRE-003']),
      p('Monitoring covers availability, latency, errors, saturation and queue depth.', ['SRE-002', 'MON-1']),
      p('Alerts have thresholds, an owner, a severity, a runbook and an escalation path.', ['MON-1', 'gate:escalation-owners']),
      p('Incident severity levels, an incident commander and a communications owner are defined.', ['SEC-007', 'IR-1']),
      p('The status page can be updated quickly by authorized staff.', ['SRE-010']),
      p('Incident runbooks exist for outages, data incidents, identity failure and integration failure.', ['SEC-007', 'AI-014', 'SRE-006']),
      p('Tabletop exercises occur at least annually and after major operational changes.', ['IR-1']),
      p('Post-incident reviews produce assigned, tracked corrective actions.', ['SEC-007', 'gate:operations-live']),
    ],
  },
  {
    id: 'security', pillar: 'Security, privacy and access control',
    question: 'Are users, tenants, data, keys, staff access and production systems protected by enforceable controls?',
    evidence: 'Access review, IAM settings, authorization test suite, secrets scan, data map, vendor review, scan and remediation log.',
    items: [
      p('Production and non-production environments are separate.', ['PRG-006', 'gate:staging-parity']),
      p('Secrets are in managed storage and never bundled to clients or source.', ['SDLC-2', 'PRG-008']),
      p('MFA protects privileged accounts.', ['IAM-005', 'IAM-1']),
      p('SSO, session controls, account recovery, access review and offboarding are operational.', ['IAM-003', 'IAM-011', 'IAM-3']),
      p('Tenant isolation and role authorization have automated positive and negative tests.', ['IAM-007', 'IAM-008', 'TEN-1']),
      p('Private storage, signed URLs, upload validation and content access rules are enforced.', ['IAM-009']),
      p('Encryption in transit and at rest is verified.', ['CRYPTO-1']),
      p('Vulnerability, dependency, secrets and infrastructure scanning are enabled and triaged.', ['SEC-004', 'VULN-1', 'SDLC-2']),
      p('Production-access grants are least privilege, time-bound, reason-coded and logged.', ['IAM-010', 'IAM-2']),
      p('The data map, retention schedule, deletion and export workflow and legal hold are current.', ['PRIV-1', 'PRIV-2', 'RM-02']),
      p('Subprocessors and AI providers are inventoried and approved.', ['PRIV-5', 'AI-002', 'SEC-010']),
    ],
  },
  {
    id: 'capacity', pillar: 'Performance, capacity and cost resilience',
    question: 'Can Semester meet user needs at academic peak times without unacceptable cost, latency or failure?',
    evidence: 'Load-test report, performance dashboard, cost report, device and network test, capacity plan, budget alerts.',
    items: [
      p('Performance budgets exist by critical page, API, device class and network condition.', ['UX-003', 'SRE-007']),
      p('Load tests cover start-of-term sign-in, deadlines, assessment autosave and grade release.', ['SRE-007', 'SRE-009']),
      p('Indexes, rate limits, queues, caching and storage lifecycle are in place.', ['SRE-008', 'IAM-009']),
      p('Large lists and tables are virtualized or paginated.', ['UX-003']),
      p('Search is indexed, debounced, permission-aware and monitored.', ['STU-009']),
      p('Media and file processing is queued with progress, failure and retry states.', ['INT-012']),
      p('Low-bandwidth and lower-end-device testing is completed.', ['UX-003', 'A11Y-004']),
      p('Cost is allocated by tenant, module, environment, AI use, storage and integration.', ['FO-01', 'FO-02']),
      p('Budget alerts and cost-anomaly detection exist.', ['FO-03', 'AI-003']),
      p('Capacity and cost assumptions are reviewed before a major customer launch.', ['SRE-007', 'FO-04']),
    ],
  },
  {
    id: 'release', pillar: 'Release, change and dependency management',
    question: 'Can Semester release safely, recover quickly and prevent changes from breaking customers or compliance commitments?',
    evidence: 'CI configuration, release manifest, feature-flag register, dependency register, change approvals, rollback exercise.',
    items: [
      p('Protected branches, peer review, CI checks and deployment approval exist.', ['SDLC-1', 'SEC-003']),
      p('CI includes type, unit, integration and authorization tests and secrets and dependency scanning.', ['SDLC-1', 'SDLC-2']),
      p('Staging mirrors production behaviour without ordinary production student data.', ['PRG-006', 'PRG-008', 'gate:staging-parity']),
      p('Preview environments and synthetic test tenants exist.', ['PRG-006', 'PRG-008']),
      p('Every release has change scope, risk level, owner, rollback plan and customer impact.', ['SRE-008', 'gate:flags-rollback']),
      p('Feature flags have owner, scope, expiry, rollout and rollback details.', ['PRG-007']),
      p('Database migrations have validation and repair or rollback plans.', ['MIG-006', 'SRE-008']),
      p('Material changes trigger privacy, security, accessibility, AI, documentation and support review.', ['PRG-003', 'AI-001']),
      p('The dependency inventory includes health, contract, data, support and exit terms.', ['SEC-010', 'EX-01', 'EX-10']),
      p('Certificate, domain, token, key and licence expiry are monitored.', ['DR-04', 'SRE-002']),
    ],
  },
  {
    id: 'support', pillar: 'User support, accessibility and operational ownership',
    question: 'Can a student, staff member, institution or operator use the service, get help and understand what happens next?',
    evidence: 'Accessibility reports, support workflow, knowledge-base inventory, ticket SLA dashboard, training plan, ownership registry.',
    items: [
      p('Critical workflows pass keyboard, screen-reader, zoom, mobile and contrast testing.', ['A11Y-001', 'A11Y-002', 'A11Y-004', 'A11Y-3']),
      p('An accessibility feedback route with triage, remediation, workaround and communication exists.', ['A11Y-4', 'A11Y-006']),
      p('A help center, knowledge base, in-product support and customer-admin support exist.', ['SUP-001', 'STU-012']),
      p('Support cases have category, severity, owner, target response, escalation and closure.', ['SUP-1', 'SUP-001']),
      p('Student support is distinct from institutional technical support and security or privacy contact.', ['SUP-1', 'VULN-1']),
      p('Every user-facing domain displays source, scope, status and authority where material.', ['TRUST-001', 'TRUST-003']),
      p('Empty, loading, permission-denied, error, offline, stale-data and recovery states exist.', ['UX-001', 'TRUST-002']),
      p('Implementation, training, hypercare, adoption review and renewal handoff are defined.', ['IMP-001', 'SUP-003', 'gate:onboarding-support']),
      p('Every module has product, operational, support, data, accessibility and privacy owners.', ['PRG-001', 'PRG-003']),
    ],
  },
];

// ── The dependency register ──────────────────────────────────────────────────

export type Criticality = 'critical' | 'high' | 'moderate' | 'low';
export type DependencyStatus = 'healthy' | 'at-risk' | 'failed' | 'unknown';

export interface Dependency {
  id: string;
  name: string;
  type: string;
  criticality: Criticality;
  owner: Seat;
  usedBy: string;
  failure: string;
  /** What would detect it, or null. */
  detection: string | null;
  fallback: string;
  exit: string;
  /** Repository-relative; what the row rests on. Required unless `unknown`. */
  path: string | null;
  status: DependencyStatus;
  note: string;
}

export const DEPENDENCIES: readonly Dependency[] = [
  { id: 'DEP-01', name: 'Cloud hosting and database (Supabase)', type: 'External vendor', criticality: 'critical', owner: 'engineering', usedBy: 'Every signed-in feature', failure: 'Nothing syncs; the local-first app keeps working on the device.', detection: 'app/scripts/production-smoke.mjs', fallback: 'Local-first: the device holds the data (ADR 0001).', exit: 'Migrations and functions are in the tree; the exit playbook is partial (EX-07).', path: 'docs/SUBPROCESSORS.md', status: 'unknown', note: 'Never tested against a failure; the provider’s status is not polled.' },
  { id: 'DEP-02', name: 'Identity: Supabase Auth and the institution’s identity provider', type: 'External vendor and customer dependency', criticality: 'critical', owner: 'security', usedBy: 'Sign-in, SSO, SCIM', failure: 'Nobody can sign in; signed-in devices keep working until the session ends.', detection: null, fallback: 'Invite-only setup without SSO (the ninety-day programme’s identity step).', exit: 'Accounts are Supabase’s; SAML metadata is the school’s.', path: 'docs/INSTITUTIONAL-SSO-ARCHITECTURE.md', status: 'unknown', note: 'No real identity provider has been exchanged with.' },
  { id: 'DEP-03', name: 'Push delivery (web push through the push function)', type: 'Internal service on external browsers', criticality: 'moderate', owner: 'engineering', usedBy: 'Reminders', failure: 'Reminders arrive late or not at all; the in-app list still shows them.', detection: 'supabase/functions/push/index.ts', fallback: 'The device’s own notifications when the app is open.', exit: 'None needed; standard web push.', path: 'supabase/functions/push/index.ts', status: 'unknown', note: 'A gone endpoint is retired only on the second failed run; delivery is not measured.' },
  { id: 'DEP-04', name: 'Payments processor', type: 'External vendor', criticality: 'low', owner: 'founder', usedBy: 'Nothing', failure: 'Nothing: billing stays out (D-009).', detection: null, fallback: 'Not applicable.', exit: 'Not applicable.', path: 'docs/DECISION-LOG.md', status: 'healthy', note: 'Held out by decision; listed so the category is not silently missing.' },
  { id: 'DEP-05', name: 'AI providers (Anthropic through the metered function; an institution-approved provider through the gateway)', type: 'External vendor', criticality: 'high', owner: 'product', usedBy: 'Study Studio, Ask Semester, course generation', failure: 'Generation fails or is slow; nothing else does.', detection: 'supabase/functions/_shared/killswitch.ts', fallback: 'Ask Semester answers without a gateway and says why when it cannot help; the kill switch stops generation cleanly.', exit: 'Provider registry per institution; no retrieval index to migrate.', path: 'app/src/lib/aikillswitch.test.ts', status: 'unknown', note: 'Provider terms are recorded as published (docs/trust/PROVIDER-TERMS.md), none signed; no outage has been simulated.' },
  { id: 'DEP-06', name: 'File storage and malware scanning', type: 'External vendor (storage); nothing (scanning)', criticality: 'high', owner: 'engineering', usedBy: 'Community media, the trust room, attachments', failure: 'Uploads fail; attachments stay on the device they were added on.', detection: null, fallback: 'Attachments do not sync by design (known limitation).', exit: 'Buckets exportable; no migration plan (EX-08).', path: 'supabase/community.check.sql', status: 'at-risk', note: 'No malware scan on any upload.' },
  { id: 'DEP-07', name: 'CDN, DNS, domain and certificates (GitHub Pages, Vercel)', type: 'External vendor', criticality: 'critical', owner: 'engineering', usedBy: 'Loading the app; the institutional gateway', failure: 'The app does not load for new sessions; installed copies keep working offline.', detection: 'app/scripts/production-smoke.mjs', fallback: 'The installed app works offline.', exit: 'No custom domain yet; no DNS or CDN transition plan (EX-09).', path: 'app/vercel.json', status: 'unknown', note: 'Certificates are the hosts’; no expiry is monitored.' },
  { id: 'DEP-08', name: 'Monitoring, logging and error tracking', type: 'Internal service', criticality: 'high', owner: 'engineering', usedBy: 'Everything, invisibly', failure: 'Failures are not noticed until a person reports them.', detection: 'MONITORING.md', fallback: 'The weekly look.', exit: 'Not applicable.', path: 'MONITORING.md', status: 'at-risk', note: 'Scheduled smoke tests and a status page; no error tracking and no alert that reaches a person (SRE-002, SRE-003).' },
  { id: 'DEP-09', name: 'Support, ticketing and the status page', type: 'Internal service', criticality: 'high', owner: 'success', usedBy: 'Every user who needs help', failure: 'A request goes unanswered.', detection: 'app/public/status.html', fallback: 'The support screen’s directory routes to the school’s own offices.', exit: 'Not applicable.', path: 'docs/market-readiness/SUPPORT_PLAYBOOK.md', status: 'at-risk', note: 'No ticket system, no support address a university can be given, no hours (SUP-1).' },
  { id: 'DEP-10', name: 'Analytics, CRM, billing and accounting', type: 'Internal (analytics); nothing (the rest)', criticality: 'moderate', owner: 'founder', usedBy: 'The three marks of ANALYTICS.md; no commercial system', failure: 'Nothing is measured; nothing is invoiced because nothing is sold.', detection: 'supabase/analytics.sql', fallback: 'Not applicable.', exit: 'Not applicable.', path: 'ANALYTICS.md', status: 'unknown', note: 'No CRM, billing or accounting system exists (COM-001).' },
  { id: 'DEP-11', name: 'LMS, SIS, OneRoster, LTI and SCIM integrations', type: 'Customer dependency through the gateway', criticality: 'high', owner: 'data', usedBy: 'Synced courses, grades and rosters, once connected', failure: 'Records go stale; the freshness class says so on the record.', detection: 'app/src/lib/integration/freshness.ts', fallback: 'Student-entered records with their own label.', exit: 'Disconnect revokes credentials; sync state is the tree’s (RETENTION.md).', path: 'app/src/lib/integration/catalog.ts', status: 'unknown', note: 'The adapter registry is empty; no connector has synced a real institution.' },
  { id: 'DEP-12', name: 'Customer source-content owners and freshness commitments', type: 'Customer dependency', criticality: 'high', owner: 'champion', usedBy: 'Every institution_verified fact', failure: 'Verified facts go stale with no owner to ask.', detection: 'docs/launch/CONTENT-READINESS-REGISTER.md', fallback: 'The source label says imported or needs_review.', exit: 'Not applicable.', path: 'docs/launch/CONTENT-READINESS-REGISTER.md', status: 'unknown', note: 'No institution has committed to a freshness SLA (PL-07 on the leadership page).' },
  { id: 'DEP-13', name: 'Security scanning and secrets management', type: 'External vendor (GitHub)', criticality: 'high', owner: 'security', usedBy: 'Every push and every deploy', failure: 'A secret or a vulnerable dependency reaches main unnoticed.', detection: '.gitleaks.toml', fallback: 'Review.', exit: 'Not applicable.', path: '.github/dependabot.yml', status: 'healthy', note: 'Runs on every push; dispositions are not recorded.' },
  { id: 'DEP-14', name: 'Legal: DPA, subprocessor terms and insurance', type: 'Legal', criticality: 'critical', owner: 'privacy', usedBy: 'Any contract', failure: 'No institution can sign.', detection: null, fallback: 'None.', exit: 'Not applicable.', path: 'docs/trust/README.md', status: 'failed', note: 'No DPA, no insurance, no counsel-reviewed terms (PRIV-4, LEGAL-2). The trust index lists what blocks a signature.' },
  { id: 'DEP-15', name: 'Key person and staffing', type: 'People', criticality: 'critical', owner: 'founder', usedBy: 'Everything', failure: 'The one person who operates the platform is unavailable.', detection: null, fallback: 'None.', exit: 'Not applicable.', path: 'docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', status: 'at-risk', note: 'A single-member LLC by the owner’s attestation; the seats that are held are all held by the founder; no backup owner exists for anything.' },
];

// ── Runbooks ─────────────────────────────────────────────────────────────────

export const RUNBOOK_STEPS: readonly { step: string; means: string }[] = [
  { step: 'Detect', means: 'An alert, a dashboard, a customer report or a health check.' },
  { step: 'Triage', means: 'Scope, tenants affected, start time, user impact, data and security impact.' },
  { step: 'Contain', means: 'A feature flag, a disabled integration, a rate limit, an isolated tenant, a revoked credential, a write freeze or read-only mode.' },
  { step: 'Communicate', means: 'The internal channel, the incident commander, the executive and customer owner, the status page and customer templates.' },
  { step: 'Recover', means: 'Exact technical steps, validation checks, reconciliation, rollback or restore.' },
  { step: 'Validate', means: 'A user-journey test, an audit and reconciliation review, alert recovery, a data-integrity check, customer confirmation where needed.' },
  { step: 'Close', means: 'The incident record, root cause, corrective actions with owner and date, customer follow-up, evidence retention.' },
];

export interface Runbook {
  runbook: string;
  /** The document that is the runbook today, or null. */
  path: string | null;
  note: string;
}

export const RUNBOOKS: readonly Runbook[] = [
  { runbook: 'Authentication or SSO failure', path: 'docs/SSO-SECURITY-AND-SESSION-MANAGEMENT.md', note: 'Session and security design; no failure procedure.' },
  { runbook: 'Database outage or corruption', path: 'RESTORE.md', note: 'The restore procedure; never run against production data.' },
  { runbook: 'Backup restore', path: 'supabase/restore-drill.sh', note: 'Scripted; the proof calendar’s month-one drill.' },
  { runbook: 'Critical deployment rollback', path: 'ROLLBACK.md', note: 'Who puts the code back and how long it takes.' },
  { runbook: 'Tenant-isolation or authorization concern', path: 'SECURITY.md', note: 'Report handling; no containment procedure for a suspected isolation failure.' },
  { runbook: 'Data deletion or export failure', path: null, note: 'Deletion is tested; nothing says what to do when it fails.' },
  { runbook: 'LMS, SIS, LTI or OneRoster sync failure', path: 'docs/INTEGRATION-OPERATOR-RUNBOOK.md', note: 'Onboarding, health and stopping a connector.' },
  { runbook: 'Grade or write reconciliation failure', path: 'docs/INTEGRATION-QUALITY-AND-RECONCILIATION.md', note: 'The design; the reconciliation itself is building (INT-014).' },
  { runbook: 'Assessment autosave or submission failure', path: null, note: 'The practice paper is kept and resumed; no procedure for a failed submission.' },
  { runbook: 'AI provider outage or unsafe-output escalation', path: 'docs/market-readiness/AI_GOVERNANCE.md', note: 'The kill switch exists; the AI incident playbook is not started (AI-3).' },
  { runbook: 'Payment failure, refund or duplicate charge', path: null, note: 'No payments (D-009).' },
  { runbook: 'Email, SMS or push delivery outage', path: null, note: 'Push retires a gone endpoint on the second failed run; no outage procedure.' },
  { runbook: 'File upload or malware-scan failure', path: null, note: 'No malware scan exists to fail.' },
  { runbook: 'Security incident and suspected breach', path: 'docs/market-readiness/INCIDENT_RESPONSE.md', note: 'Severity, flow and templates; never exercised.' },
  { runbook: 'DDoS, abuse or rate-limit event', path: 'docs/SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md', note: 'What exists and what is owed.' },
  { runbook: 'Cloud region or provider outage', path: 'docs/market-readiness/DISASTER_RECOVERY.md', note: 'Not started, and says so.' },
  { runbook: 'Critical vendor failure', path: 'docs/trust/VENDOR-RISK-REGISTER.md', note: 'The review procedure; no failure procedure.' },
  { runbook: 'Customer-admin misconfiguration', path: 'docs/TENANT-MAPPING-CONFIGURATION.md', note: 'The configuration; no repair procedure.' },
];

// ── The launch gate ──────────────────────────────────────────────────────────

export type Required = 'yes' | 'if-ai' | 'if-integration';

export interface GateArea {
  area: string;
  gate: string;
  required: Required;
  rests: readonly string[];
}

export const GATE: readonly GateArea[] = [
  { area: 'Scope', gate: 'Enabled and excluded features are explicit.', required: 'yes', rests: ['PRG-003', 'PRG-007', 'gate:known-limitations'] },
  { area: 'Ownership', gate: 'Product, technical, operational, support, security, privacy and accessibility owners are assigned.', required: 'yes', rests: ['PRG-001', 'gate:escalation-owners'] },
  { area: 'Data', gate: 'Data map, permissions, retention, source and freshness, and export and deletion behaviour are documented.', required: 'yes', rests: ['PRIV-1', 'PRIV-2', 'TRUST-001', 'gate:data-scope'] },
  { area: 'Security', gate: 'Authentication, tenant isolation, secrets, logging, vulnerability gates and the incident route are tested.', required: 'yes', rests: ['IAM-008', 'SDLC-2', 'SEC-006', 'VULN-1', 'IR-1'] },
  { area: 'Accessibility', gate: 'Critical workflows are tested; no unresolved critical barrier; alternatives documented.', required: 'yes', rests: ['A11Y-001', 'A11Y-3', 'gate:no-blockers'] },
  { area: 'Reliability', gate: 'SLOs, monitoring, alerting, status communications, dependency health and runbooks are ready.', required: 'yes', rests: ['SRE-001', 'SRE-002', 'SRE-010', 'gate:operations-live'] },
  { area: 'Recovery', gate: 'Backup restore, rollback, reconciliation and failure behaviour are tested.', required: 'yes', rests: ['SRE-005', 'BCP-1', 'gate:backup-restore', 'gate:flags-rollback'] },
  { area: 'Performance', gate: 'Peak-load and capacity evidence meets the defined thresholds.', required: 'yes', rests: ['SRE-007', 'SRE-009'] },
  { area: 'AI', gate: 'Provider, policy, data use, evaluation, monitoring and disable controls are approved.', required: 'if-ai', rests: ['AI-1', 'AI-2', 'AI-006', 'AI-012'] },
  { area: 'Integration', gate: 'Sandbox validation, scopes, reconciliation, failure fallback and a customer owner are approved.', required: 'if-integration', rests: ['INT-001', 'INT-014', 'INT-1'] },
  { area: 'Support', gate: 'Help, escalation, incident communication and the implementation and hypercare plan are ready.', required: 'yes', rests: ['SUP-001', 'SUP-1', 'IMP-001', 'gate:onboarding-support'] },
  { area: 'Commercial', gate: 'Entitlement, price, invoicing, contract, support tier and renewal and exit terms are ready.', required: 'yes', rests: ['COM-001', 'COM-002', 'LEG-002', 'gate:terms-reviewed'] },
  { area: 'Evidence', gate: 'All test results and sign-offs are stored; open exceptions are approved and time-bound.', required: 'yes', rests: ['SEC-011', 'GOV-2', 'gate:pilot-outcome'] },
];

export type Verdict = 'go' | 'go-with-conditions' | 'no-go';

export const VERDICT_MEANING: Record<Verdict, string> = {
  go: 'All mandatory controls pass. Known limitations are low risk, documented, owned and accurately communicated.',
  'go-with-conditions': 'No P0 risk remains. Time-bound P1 and P2 conditions have owners, target dates, mitigation, customer communication and executive acceptance.',
  'no-go': 'A P0 or unresolved mandatory gate exists: security or privacy breach risk, a critical accessibility failure, data-loss or grade-integrity risk, an unsupported claim, an untested recovery path, or no accountable owner.',
};

/**
 * A gate area's level is its **lowest** row, never a median: the pack says an
 * unresolved mandatory gate is NO-GO, so one unmet control fails the area
 * however many others pass. (Checklist items on the pillars keep the
 * crosswalk's median, because an item is a reading, not a gate.) Pure.
 */
export function areaLevel(levels: readonly Level[], ceiling: Level = 4): Level {
  if (levels.length === 0) return 0;
  return Math.min(ceiling, ...levels) as Level;
}

/**
 * The pack's decision, from the gate areas' levels. Both AI and integrations
 * are enabled in this repository, so every area is applied. A required area
 * at 0 is a failed mandatory gate; at 1 it is a condition; at 2 or above it
 * passes. Pure.
 */
export function verdict(areas: readonly { required: Required; level: Level }[], enabled: { ai: boolean; integrations: boolean } = { ai: true, integrations: true }): Verdict {
  const applied = areas.filter((a) => a.required === 'yes' || (a.required === 'if-ai' && enabled.ai) || (a.required === 'if-integration' && enabled.integrations));
  if (applied.some((a) => a.level === 0)) return 'no-go';
  if (applied.some((a) => a.level === 1)) return 'go-with-conditions';
  return 'go';
}

export const PACKET: readonly { item: string; path: string | null }[] = [
  { item: 'Release, pilot or module scope and exclusions', path: 'docs/launch/KNOWN-LIMITATIONS.md' },
  { item: 'Customer, tenant or cohort and contractual entitlement', path: 'app/src/lib/gtm/pilot.ts' },
  { item: 'Critical journeys and success metrics', path: 'app/scripts/golden-path.mjs' },
  { item: 'Data flow, classification, source owner, retention and integration map', path: 'RETENTION.md' },
  { item: 'Security, privacy, accessibility and AI risk assessments', path: 'docs/operating-model/RISK-GOVERNANCE.md' },
  { item: 'Service tier, SLOs, RTO/RPO, monitoring, alerts and on-call owners', path: 'docs/operating-model/SLOS-AND-ERROR-BUDGETS.md' },
  { item: 'Performance, capacity and load-test results', path: 'docs/PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md' },
  { item: 'Backup restore, rollback, reconciliation and failure-test evidence', path: null },
  { item: 'Support, escalation, training, documentation and hypercare plan', path: 'docs/launch/FIRST-DAY-CHECKLISTS.md' },
  { item: 'Known limitations, customer communications and workaround plan', path: 'docs/launch/KNOWN-LIMITATIONS.md' },
  { item: 'Open findings and exceptions with approval and expiry', path: 'app/src/lib/governance/risk.ts' },
  { item: 'Final approver names, date and the GO / GO WITH CONDITIONS / NO-GO record', path: null },
];

/** The pack's sign-off record, each line a council seat. All unsigned: holding a seat is not signing, and `CURRENT.signoffs` in launchreadiness.ts is empty. */
export const SIGNOFFS: readonly { signoff: string; seat: Seat }[] = [
  { signoff: 'Decision chair', seat: 'founder' },
  { signoff: 'Product', seat: 'product' },
  { signoff: 'Engineering', seat: 'engineering' },
  { signoff: 'Security', seat: 'security' },
  { signoff: 'Privacy and legal', seat: 'privacy' },
  { signoff: 'Accessibility', seat: 'accessibility' },
  { signoff: 'AI governance', seat: 'product' },
  { signoff: 'Operations and support', seat: 'success' },
  { signoff: 'Customer implementation', seat: 'champion' },
  { signoff: 'Commercial and contract', seat: 'founder' },
];

// ── Cadences and the first initiatives ───────────────────────────────────────

export const CADENCES: readonly { cadence: string; reviews: string }[] = [
  { cadence: 'Daily', reviews: 'Uptime, the error and alert queue, security events, the support queue, integration health, critical customer issues.' },
  { cadence: 'Weekly', reviews: 'Delivery and release review, risk triage, pipeline, customer health, support themes, vulnerability triage, cost anomalies.' },
  { cadence: 'Monthly', reviews: 'Financial close, access review, evidence freshness, data-retention jobs, SLO and performance review, vendor review, plan review.' },
  { cadence: 'Quarterly', reviews: 'Backup restore, incident tabletop, AI evaluation, accessibility review, risk-register review, customer value review, board or advisor update.' },
  { cadence: 'Annually', reviews: 'Penetration test or independent security review, policy review, insurance renewal, full DR exercise, subprocessor review, accessibility documentation refresh.' },
];

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export interface Initiative {
  id: string;
  initiative: string;
  workstream: string;
  priority: Priority;
  evidence: string;
  rests: readonly string[];
}

export const INITIATIVES: readonly Initiative[] = [
  { id: 'INIT-OPS-001', initiative: 'Shared identity, tenant context, RBAC, audit events', workstream: 'product', priority: 'P0', evidence: 'Authorization test suite, access review, audit samples', rests: ['IAM-006', 'IAM-008', 'IAM-011', 'SEC-006'] },
  { id: 'INIT-OPS-002', initiative: 'Data inventory, retention, deletion, legal-hold engine', workstream: 'trust', priority: 'P0', evidence: 'Data map, deletion, hold and export tests', rests: ['PRIV-1', 'PRIV-2', 'RM-02'] },
  { id: 'INIT-OPS-003', initiative: 'Observability, alerts, incident response, status communications', workstream: 'product', priority: 'P0', evidence: 'Dashboards, alert test, incident tabletop', rests: ['SRE-002', 'SEC-007', 'SRE-010', 'IR-1'] },
  { id: 'INIT-OPS-004', initiative: 'Backup and restore, DR, rollback, migration repair', workstream: 'product', priority: 'P0', evidence: 'Restore exercise, rollback record, RTO/RPO', rests: ['SRE-005', 'SRE-006', 'SRE-008', 'BCP-1'] },
  { id: 'INIT-OPS-005', initiative: 'Accessibility design system and release gate', workstream: 'trust', priority: 'P0', evidence: 'Manual and automated evidence, issue register', rests: ['PRG-004', 'A11Y-001', 'A11Y-3', 'A11Y-4'] },
  { id: 'INIT-OPS-006', initiative: 'AI gateway, provider inventory, policy and evaluation controls', workstream: 'trust', priority: 'P0', evidence: 'AI inventory, provider review, evaluations', rests: ['AI-002', 'AI-006', 'AI-011', 'AI-2'] },
  { id: 'INIT-OPS-007', initiative: 'Integration gateway, reconciliation, schema drift, contract tests', workstream: 'product', priority: 'P0', evidence: 'Sandbox results, reconciliation dashboard, fallback tests', rests: ['INT-001', 'INT-014', 'INT-1'] },
  { id: 'INIT-OPS-008', initiative: 'Support and implementation service and knowledge base', workstream: 'delivery', priority: 'P1', evidence: 'SLA and workflow, training plan, support dashboard', rests: ['SUP-001', 'SUP-003', 'SUP-1'] },
  { id: 'INIT-OPS-009', initiative: 'Procurement room, contracts, evidence vault, HECVAT and TrustEd crosswalk', workstream: 'trust', priority: 'P1', evidence: 'Current artifacts, a completed assessment, the evidence register', rests: ['COM-003', 'SEC-011', 'LEG-002', 'EDT-7'] },
  { id: 'INIT-OPS-010', initiative: 'Pricing, CRM, billing, collections, forecasting', workstream: 'commercial', priority: 'P1', evidence: 'Price book, quote and order process, monthly forecast', rests: ['COM-001', 'COM-002', 'COM-004'] },
  { id: 'INIT-OPS-011', initiative: 'Corporate entity, IP, bank, accounting, insurance, hiring controls', workstream: 'corporate', priority: 'P0', evidence: 'Formation records, policies, insurance certificates', rests: ['LEG-001', 'LEGAL-2', 'GOV-1'] },
  { id: 'INIT-OPS-012', initiative: 'Pilot-to-platform implementation factory', workstream: 'delivery', priority: 'P1', evidence: 'Readiness workbook, SOW, launch checklist, value review', rests: ['IMP-001', 'SUP-003', 'COM-002'] },
];

/** The master operating plan's fields, and which column of the master register carries each. */
export const PLAN_FIELDS: readonly { field: string; carried: string | null }[] = [
  { field: 'Initiative ID', carried: 'id' },
  { field: 'Initiative', carried: 'capability' },
  { field: 'Workstream', carried: 'domain (seventeen, not five)' },
  { field: 'Strategic outcome', carried: 'requirement' },
  { field: 'Scope', carried: null },
  { field: 'Customer, module or tenant impact', carried: null },
  { field: 'Accountable owner (DRI)', carried: 'a gate’s owner seat; a row has none' },
  { field: 'Backup owner', carried: null },
  { field: 'Contributors', carried: null },
  { field: 'Priority', carried: 'severity (P0–P2)' },
  { field: 'Risk tier', carried: null },
  { field: 'Dependencies', carried: null },
  { field: 'Budget', carried: null },
  { field: 'Target date', carried: 'the proof calendar’s month, for a proof' },
  { field: 'Launch gate', carried: 'the eight gates, by row' },
  { field: 'Evidence required', carried: 'validation' },
  { field: 'Success metric', carried: 'a first-year measure, where one exists' },
  { field: 'Status', carried: 'status (nine states)' },
  { field: 'Risks and exceptions', carried: 'the risk register, by id' },
  { field: 'Next review', carried: 'the operating system, per document' },
];

export const FINAL_STANDARD: readonly string[] = ['Build it.', 'Test it.', 'Secure it.', 'Observe it.', 'Recover it.', 'Support it.', 'Document it.', 'Sell it honestly.', 'Implement it repeatedly.', 'Measure the outcome.'];

/** Every register or gate id the page names, once. */
export function allRests(): string[] {
  const ids = new Set<string>();
  for (const pl of PILLARS) for (const i of pl.items) for (const id of i.rests) ids.add(id);
  for (const g of GATE) for (const id of g.rests) ids.add(id);
  for (const i of INITIATIVES) for (const id of i.rests) ids.add(id);
  return [...ids];
}

/** Every path the page cites, once. */
export function allPaths(): string[] {
  const paths = new Set<string>();
  for (const x of [...DRI_RULES, ...RUNBOOKS, ...PACKET]) if (x.path) paths.add(x.path);
  for (const d of DEPENDENCIES) {
    if (d.path) paths.add(d.path);
    if (d.detection) paths.add(d.detection);
  }
  return [...paths];
}
