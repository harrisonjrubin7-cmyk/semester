/**
 * The roadmap audit: every proposal in eight strategy documents, and where the
 * repository stands on it.
 *
 * Eight roadmap documents were read against this tree on 30 September 2026 — the
 * education-operating-system layers, the learner and academic edge cases, the
 * hardening and resilience programmes, the service-boundary and SLO programme,
 * the software-engineering pipeline, the assurance and compliance programme, the
 * business-continuity programme and the exception and governance programme.
 * About 150 proposals came out of them. This is the record of that reading, made
 * something a test can hold, so it is a register and not a memory.
 *
 * ## What a status means
 *
 *   * `landed`      code **and** a test, check or workflow that holds it. A row
 *                   cannot be `landed` without citing one; the test refuses it.
 *   * `partial`     something real exists and something the proposal asks for
 *                   does not. `gap` says what.
 *   * `absent`      nothing in the tree implements it, and it could be built as
 *                   code. It cites nothing.
 *   * `operational` nothing in the tree can implement it, because it needs a
 *                   person, a vendor, a contract, an account setting or access to
 *                   production: a second administrator, a pen test, a region, a
 *                   restore drill on the live project. Writing a document would
 *                   be claiming it. `gap` says what it waits on.
 *
 * `builtHere` marks the rows a change on the branch that added this file moved.
 *
 * ## What this is not
 *
 * The statuses come from a read of headers, registers and migration text, not a
 * line-by-line audit, and two independent readings disagreed on some rows (the
 * more conservative was taken). The test proves a cited path exists and that a
 * `landed` row cites something that can fail; it does not prove the status. A
 * row's status is a claim until its evidence is a test, and the doc says so.
 */

export const AUDIT_STATUSES = ['landed', 'partial', 'absent', 'operational'] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];

/** The eight documents, by the short key a row's id starts with. */
export const AUDIT_SOURCES = {
  A1: 'Institutional-grade intelligence: handoffs, records, retention, notification, quality, SLOs',
  A2: 'Edge conditions: every learner, calendar, policy, content, identity and governance path',
  B1: 'Deepening and hardening: resilience, idempotency, events, security, capacity, recovery',
  B2: 'Service boundaries, contracts, concurrency, SLOs, delivery, privacy and drills',
  B3: 'Software-engineering and operational pipeline: gates, supply chain, delivery, access',
  C1: 'Assurance: threat models, enforcement points, integrity, isolation, compliance, game days',
  C2: 'Continuity: risk, succession, residency, holds, audit, regulation, insider risk, exit',
  C3: 'Exceptions and governance: appeals, review queues, lifecycles, benchmarks, readiness gates',
} as const;
export type AuditSource = keyof typeof AUDIT_SOURCES;

export interface Proposal {
  /** `A1-03`: the document's key and the proposal's number, or a name for a control in B3. */
  id: string;
  source: AuditSource;
  title: string;
  status: AuditStatus;
  /** Repository paths that show it. Empty for `absent` and `operational`. */
  evidence: readonly string[];
  /** What is missing, or what an operational row waits on. */
  gap: string;
  builtHere?: true;
}

const p = (
  id: string,
  title: string,
  status: AuditStatus,
  evidence: readonly string[],
  gap: string,
  builtHere?: true,
): Proposal => ({ id, source: id.slice(0, 2) as AuditSource, title, status, evidence, gap, ...(builtHere ? { builtHere } : {}) });

export const PROPOSALS: readonly Proposal[] = [
  // ── A1 ──────────────────────────────────────────────────────────────────
  p('A1-01', 'A universal handoff protocol', 'partial', ['app/src/lib/handoff-status.ts', 'app/src/lib/nowrongdoor.ts'], 'One seven-word status vocabulary exists and only the registration handoff uses it, as the student’s own report. Help requests keep their own statuses (mapped by fromHelpRequest); aid and accessibility are directory-only by design.', true),
  p('A1-02', 'A transcript and records trust layer', 'partial', ['app/src/lib/record-kinds.ts', 'app/src/lib/record/ledger.ts'], 'The seven-row record label is on the degree-audit screen only; the plan, evidence, transcript and portfolio screens do not carry it.', true),
  p('A1-03', 'An institutional archive and records-retention service', 'partial', ['RETENTION.md', 'supabase/legal-holds.check.sql'], 'Retention schedules, sweeps and legal holds exist. There is no Records & Retention console, no destruction certificates, no retention-policy version history and no residency control.', true),
  p('A1-04', 'A trusted notification-delivery system', 'partial', ['app/src/lib/notify.ts', 'supabase/functions/push/index.ts'], 'Web push, quiet hours and caps exist. No SMS or email provider, channel failover, delivery or bounce tracking, or official-notice override policy.'),
  p('A1-05', 'A data-quality operations center', 'partial', ['app/src/lib/integration/reconcile.ts', 'app/src/lib/integration/drift.ts'], 'Reconcile and drift exist for integration feeds. No console-level centre, impact analysis or student-safe display.'),
  p('A1-06', 'A reliability SLO system', 'partial', ['docs/operating-model/SLOS-AND-ERROR-BUDGETS.md', 'app/src/lib/governance/error-budgets.test.ts'], 'Targets and the budget arithmetic are held; there are no measurements and no availability history.'),
  p('A1-07', 'A student-owned personal knowledge system', 'partial', ['app/src/lib/source-locker.ts', 'app/src/lib/cite.ts'], 'A source locker, citations and per-course notes. No backlinks, knowledge graph, highlights, glossary or Knowledge Library screen.'),
  p('A1-08', 'A universal workload and time model', 'partial', ['app/src/lib/life-balance.ts', 'app/src/lib/clash.ts'], 'Weekly hours, collision forecast and recovery exist behind flags. No caregiving or sleep input and no what-if tool.'),
  p('A1-09', 'An institution-wide accessibility content score', 'absent', [], 'Nothing scans course materials for captions, alt text, headings or tables.'),
  p('A1-10', 'An operational AI assistant for staff', 'partial', ['app/server/institution/intelligence.ts', 'packages/institution/src/intelligence.ts'], 'A tenant-governed AI gateway exists. No role-specific assistants and no human-review-before-send flow.'),
  p('A1-11', 'A capability maturity score for Semester itself', 'partial', ['app/src/lib/governance/maturity.test.ts', 'app/src/lib/governance/release-readiness.ts'], 'Control counts and a per-feature ladder exist. No platform-wide 0–6 level across the domains.'),
  p('A1-12', 'A formal replaceability test', 'landed', ['app/src/lib/replaceregister.ts', 'app/src/lib/replaceregister.test.ts'], 'Several requirement rows still carry gaps and every domain stays "building".'),
  p('A1-13', 'A human-override architecture', 'partial', ['supabase/human-overrides.check.sql', 'supabase/migrations/20260930120000_human_overrides.sql'], 'One shared log and a recurring-pattern view; two producers wired (the academic record and break-glass access). No screen shows the log, and the other domains have no row that is an override today.', true),
  p('A1-14', 'A public plan with accountable evidence', 'partial', ['docs/PRODUCT-ROADMAP.md', 'app/src/lib/ops/proofcalendar.ts'], 'Built and next columns exist. Items lack requester, scope, release evidence and owner, and there are no beta, pilot, deferred or retired states.'),

  // ── A2 ──────────────────────────────────────────────────────────────────
  p('A2-01', 'Support every learner pathway', 'partial', ['app/src/lib/learner-pathways.ts'], 'Nine pathways exist. Missing: first-year orientation, dual enrollment, returning-student re-entry, a disabled-student adaptive pack, alumni.'),
  p('A2-02', 'Academic-calendar intelligence', 'partial', ['app/src/lib/term.ts', 'app/src/lib/registration-window.ts'], 'Semester terms and windows only. No quarter, trimester, block, rolling or cohort models and no time zones.'),
  p('A2-03', 'A complete academic-policy engine', 'partial', ['packages/institution/src/policy.ts', 'app/src/lib/governance/policysim.ts'], 'An authorization decision point and a simulator exist. No academic-policy registry with owner, version, effective date and exception route.'),
  p('A2-04', 'A true learning-objective graph', 'partial', ['app/src/lib/skills-graph.ts'], 'Concepts, skill claims and evidence. Not the outcome to assessment chain.'),
  p('A2-05', 'A digital content supply chain', 'partial', ['app/src/lib/coursestudio.ts'], 'Versioned, retirable study packs. No review or accessibility gate, no licence metadata, expiry or broken-link monitoring.'),
  p('A2-06', 'An education-grade file and media service', 'partial', ['app/src/lib/files.ts', 'supabase/functions/_shared/mediascan.ts'], 'Device-local files; the media scanner covers Community images and is not deployed. No server-side malware scan for documents.'),
  p('A2-07', 'Assessment-accommodation architecture', 'partial', ['supabase/expansion.check.sql'], 'The database has passports and student-controlled shares; no app code touches them and there is no UI.'),
  p('A2-08', 'Attendance, engagement and participation, carefully', 'partial', ['app/src/lib/attend.ts', 'app/src/lib/attend.test.ts'], 'A student’s own absence log. No official source, instructor workflow or appeal route.'),
  p('A2-09', 'Academic document and transcript generation', 'partial', ['app/src/lib/record/ledger.ts', 'app/src/lib/export.ts'], 'No shared document envelope with authority and verification.'),
  p('A2-10', 'A search-indexing and retrieval pipeline', 'partial', ['app/src/lib/find.ts', 'app/server/institution/intelligence.ts'], 'On-device ranker and a tenant-scoped source gateway. No server-side permission-aware index.'),
  p('A2-11', 'An identity and lifecycle system', 'partial', ['app/server/institution/scim.ts', 'packages/institution/src/identity.ts'], 'SCIM and SSO binding exist. Account linking and merge are not built and there is no lifecycle state model.'),
  p('A2-12', 'Finance, procurement and donation boundaries', 'partial', ['supabase/student-accounts.check.sql', 'supabase/migrations/20260929220000_student_accounts.sql'], 'Subscriptions, a student-accounts ledger and a deal desk. No institutional invoicing, scholarship workflow or donor boundary.'),
  p('A2-13', 'An audit and forensic readiness layer', 'partial', ['supabase/console-control-plane.check.sql', 'supabase/ledger-seals.check.sql'], 'A hash-chained console log with signed manifests, and now chained and signed academic-record and student-account ledgers. No single audit schema, investigation workspace or export controls.', true),
  p('A2-14', 'A privacy-safe experimentation framework', 'partial', ['app/src/lib/flags.ts'], 'Experiment-typed flags with an owner and expiry. No hypothesis review, cohort assignment or analysis.'),
  p('A2-15', 'Curriculum and academic governance', 'absent', [], 'No proposal, committee approval or accreditation mapping.'),

  // ── B1 ──────────────────────────────────────────────────────────────────
  p('B1-01', 'A resilience-first architecture', 'partial', ['app/src/lib/readonly.ts', 'app/src/lib/aikillswitch.test.ts'], 'Read-only mode, offline mode and an AI kill switch. No circuit breakers, bulkheads or timeout budgets.'),
  p('B1-02', 'Idempotent, reversible writes', 'partial', ['app/server/institution/adapter.ts', 'supabase/functions/_shared/billingcheckout.ts'], 'Idempotency keys on gateway actions, SCIM and billing only; no general undo.'),
  p('B1-03', 'A fully event-driven platform core', 'partial', ['packages/institution/src/events.ts', 'supabase/tenant-feature-policy-events.check.sql', 'supabase/ops-projector-worker.check.sql'], 'Envelope, catalog, one SQL-native producer and one bounded projector endpoint exist; the endpoint is dormant without its dedicated secret and has no scheduler.'),
  p('B1-04', 'Strong domain boundaries', 'partial', ['docs/architecture/README.md'], 'Modules by convention; no per-domain contract and no enforcement.'),
  p('B1-05', 'Schema evolution and migration discipline', 'partial', ['supabase/rehearse.sh', 'supabase/check.sh'], 'Forward-only migrations are rehearsed and the second pass is a CI gate. No expand/contract discipline.'),
  p('B1-06', 'A performance budget', 'partial', ['app/perf-budgets.json', 'app/scripts/budgets.ts'], 'Bundle-size budgets are gated. No latency or web-vitals telemetry.'),
  p('B1-07', 'A real offline-first strategy', 'partial', ['app/src/lib/offline-mode.ts', 'app/src/lib/merge.ts'], 'Local-first with per-field merge. No conflict-review UI and no resumable upload.'),
  p('B1-08', 'Hardened file processing and ingestion', 'partial', ['supabase/functions/_shared/mediascan.ts', 'app/src/ai/untrusted.ts'], 'Community images only; no quarantine state or sandboxed conversion for documents.'),
  p('B1-09', 'A secured AI retrieval pipeline', 'partial', ['app/src/ai/injection.test.ts', 'app/server/institution/intelligence.ts'], 'Fencing, a red-team run and tenant-scoped retrieval. No scored evaluation set or output filter.'),
  p('B1-10', 'Defense-in-depth authorization', 'partial', ['packages/institution/src/policy.ts', 'supabase/rls-coverage.check.sql'], 'A decision point and RLS suites; not every route calls the decision point.'),
  p('B1-11', 'Secrets, key and cryptographic lifecycle', 'partial', ['SECRETS.md', 'supabase/ledger-seals.check.sql'], 'Inventory, a rotation log, gitleaks, and a signing key for the ledger seals. No vault, no automatic rotation, no key-revocation lifecycle.', true),
  p('B1-12', 'Continuous application security', 'partial', ['.github/workflows/ci.yml', 'app/src/lib/supplychain.test.ts'], 'Secrets scan, dependency audit, SBOM, SHA-pinned Actions. No SAST, IaC scan or signed provenance.', true),
  p('B1-13', 'Observability as a product capability', 'partial', ['MONITORING.md', 'docs/architecture/0010-correlation-ids-and-error-envelope.md'], 'A correlation id reaches the gateway only. No browser or database telemetry and no dashboards.'),
  p('B1-14', 'Capacity engineering for academic peaks', 'absent', [], 'No load test, peak-readiness playbook or change freeze.'),
  p('B1-15', 'Anti-abuse and platform safety', 'partial', ['app/server/institution/rate-limit.ts', 'docs/CAMPUS-MODERATION-SOP.md'], 'Rate limits and a moderation workflow. No bot detection or suspicious-login alerts.'),
  p('B1-16', 'A data backup and recovery program', 'operational', ['supabase/restore.sh', 'RESTORE.md'], 'CI rehearses a logical restore; no production restore has been run or timed, so there is no measured RPO or RTO. Needs the live project.'),
  p('B1-17', 'A controlled release-management system', 'partial', ['app/src/lib/governance/rollout.ts', 'supabase/tenant-rollout.check.sql'], 'Tenant rollout state machine and kill switches. No canary or percentage rollout and no change freeze.'),
  p('B1-18', 'A data ethics and model-governance board', 'operational', ['docs/operating-model/AI-GOVERNANCE-BOARD.md'], 'The charter and gates are written; no board is convened. Needs people.'),
  p('B1-19', 'Hardening against single-founder risk', 'operational', ['docs/STRATEGIC-EXPANSION-REGISTER.md'], 'Named as a gap. Needs a second administrator and a succession plan.'),
  p('B1-20', 'A hardening scorecard', 'partial', ['app/src/lib/governance/maturity.test.ts'], 'Control registers exist; no per-release scorecard.'),

  // ── B2 ──────────────────────────────────────────────────────────────────
  p('B2-01', 'Explicit service boundaries', 'partial', ['app/src/lib/ops/boundaries.ts'], 'Charters list owner and source; no per-domain schema, event and fallback record.'),
  p('B2-02', 'A modular monolith first', 'partial', ['docs/architecture/0003-no-application-server.md'], 'Decided and documented; enforced by convention only, and split criteria are not written.'),
  p('B2-03', 'A canonical API contract program', 'partial', ['packages/contract/src', 'app/server/institution/vercel-transport.test.ts'], 'A versioned gateway. No OpenAPI or schema publication and no consumer-driven contract tests.'),
  p('B2-04', 'A domain event backbone', 'partial', ['packages/institution/src/events.ts', 'supabase/tenant-feature-policy-events.check.sql', 'supabase/ops-projector-worker.check.sql'], 'One SQL-native feature-policy producer and one dormant bounded projector endpoint exist; the other domain producers, publisher and scheduled projector do not.'),
  p('B2-05', 'Serious concurrency control', 'partial', ['app/server/institution/gateway.ts', 'app/src/lib/merge.ts'], 'Gateway 409 only; no version column or If-Match on plans.'),
  p('B2-06', 'Data-quality contracts', 'partial', ['app/src/lib/governance/data-contracts.ts', 'app/src/lib/integration/quality.test.ts'], 'Owner, steward and freshness; no enforced completeness or validity rules per dataset.'),
  p('B2-07', 'Raw, normalized and product data zones', 'absent', [], 'The pipeline redacts and normalizes on ingest; there is no immutable raw-payload zone to reprocess from.'),
  p('B2-08', 'Routine reconciliation', 'partial', ['app/src/lib/integration/reconcile.ts', 'supabase/integration-quality.check.sql'], 'Reconcile logic exists; no mismatch queue with owner assignment.'),
  p('B2-09', 'Secure-by-design engineering gates', 'partial', ['.github/workflows/ci.yml', 'supabase/check.sh'], 'Type, lint, tests, RLS, accessibility, gitleaks. No SAST, IaC scan or provenance.'),
  p('B2-10', 'Supply-chain security', 'partial', ['app/src/lib/supplychain.test.ts', 'docs/SUPPLY-CHAIN.md'], 'Lockfiles, licences, approved Actions, SBOM and SHA-pinned Actions. No signed provenance and no supplier-compromise runbook.', true),
  p('B2-11', 'A security-chaos program', 'partial', ['app/scripts/killswitch-drill.mjs'], 'One kill-switch drill; no cadence and no duplicate-event or key-expiry drill.'),
  p('B2-12', 'Service-level objectives by workflow', 'partial', ['docs/operating-model/SLOS-AND-ERROR-BUDGETS.md'], 'Targets only; no measurement pipeline.'),
  p('B2-13', 'Workflow-level synthetic monitoring', 'partial', ['.github/workflows/production-smoke.yml', 'app/scripts/golden-path.mjs'], 'Hourly public and institutional probes; no authenticated journey on a schedule.'),
  p('B2-14', 'Progressive delivery', 'partial', ['app/src/lib/governance/rollout.ts'], 'Tenant flags and staging; no canary or error-budget gate.'),
  p('B2-15', 'Operational runbooks for every failure class', 'partial', ['docs/RUNBOOKS.md'], 'About eight runbooks; none for search, file processing or Stripe.'),
  p('B2-16', 'Purpose-bound data access', 'partial', ['packages/institution/src/policy.ts', 'supabase/support-access.check.sql'], 'A free-text purpose on the support read only; no purpose-code vocabulary.'),
  p('B2-17', 'Privacy-preserving computation patterns', 'partial', ['docs/PSEUDONYMITY-POLICY.md'], 'Policy and n≥10 aggregate reads; no projection pipeline or watermarking.'),
  p('B2-18', 'Deletion propagation', 'partial', ['supabase/deletion.check.sql', 'supabase/legal-holds.check.sql'], 'Database erasure is tested and now refuses a held account first. No propagation to storage, search, caches or backups.', true),
  p('B2-19', 'Evaluation before intelligence expansion', 'partial', ['docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md', 'app/src/ai/injection.test.ts'], 'Injection and quality tests; no per-capability scored suite as a release gate.'),
  p('B2-20', 'A learning-science quality gate', 'partial', ['app/src/lib/governance/quality-gates.ts'], 'Generic gates; no required objective and evidence fields per feature.'),
  p('B2-21', 'A formal change-advisory process', 'partial', ['.github/pull_request_template.md', 'app/src/lib/governance/config-tiers.ts'], 'Tiers and reviewers, and now design, privacy, accessibility, data-owner and rollback fields in the PR template; not enforced by a check.', true),
  p('B2-22', 'Eliminating single points of failure', 'operational', ['docs/trust/VENDOR-RISK-REGISTER.md'], 'Registers exist; one person owns everything. Needs vendors’ exit plans and a second owner.'),
  p('B2-23', 'Operational drills', 'operational', ['docs/PROOF-CALENDAR.md'], 'A calendar exists; only the kill-switch drill has run. Needs restore, tabletop and outage drills on the live project.'),

  // ── B3 ──────────────────────────────────────────────────────────────────
  p('B3-01', 'Protected main with required reviews', 'partial', ['.github/rulesets/main.json', '.github/CODEOWNERS'], 'Committed, but one owner means a second person’s review cannot be required, and signed commits are not required.'),
  p('B3-02', 'An organization-owned repository', 'operational', [], 'The repository is on a personal account. Needs an organization.'),
  p('B3-03', 'Secret scanning in CI', 'landed', ['.gitleaks.toml', '.github/workflows/ci.yml'], 'Push protection is not recorded as enabled.'),
  p('B3-04', 'Dependabot', 'landed', ['.github/dependabot.yml', 'app/src/lib/supplychain.test.ts'], 'It also keeps the SHA pins current.'),
  p('B3-05', 'Lockfiles and deterministic install', 'landed', ['app/src/lib/supplychain.test.ts', '.github/workflows/ci.yml'], 'None.'),
  p('B3-06', 'Actions pinned to commit SHAs', 'landed', ['app/src/lib/supplychain.test.ts', '.github/workflows/ci.yml'], 'The test refuses a tag and a pin with no release comment.', true),
  p('B3-07', 'Least-privilege CI tokens', 'landed', ['app/src/lib/supplychain.test.ts', '.github/workflows/pages.yml'], 'None.'),
  p('B3-08', 'An SBOM per release', 'landed', ['.github/workflows/pages.yml', 'app/src/lib/supplychain.test.ts'], 'Not signed and not published.'),
  p('B3-09', 'Build provenance and signed artifacts', 'absent', [], 'No attestation; below SLSA build level 2.'),
  p('B3-10', 'Static application security testing', 'absent', [], 'No CodeQL or Semgrep workflow.'),
  p('B3-11', 'A dependency vulnerability scan', 'partial', ['.github/workflows/ci.yml', '.github/dependabot.yml'], 'npm audit runs and is non-blocking by design.'),
  p('B3-12', 'A licence scan', 'landed', ['app/src/lib/supplychain.test.ts', 'app/src/lib/supplychain.ts'], 'None.'),
  p('B3-13', 'Infrastructure and container scanning', 'absent', [], 'Nothing scans IaC or containers.'),
  p('B3-14', 'Typecheck, lint and unit tests in CI', 'landed', ['.github/workflows/ci.yml', 'app/src/lib/supplychain.test.ts'], 'None.'),
  p('B3-15', 'Database migration validation and RLS negative tests', 'landed', ['supabase/check.sh', 'supabase/rehearse.sh'], 'None.'),
  p('B3-16', 'API contract tests', 'partial', ['app/server/institution/vercel-transport.test.ts'], 'No consumer-driven contract test per registered contract.'),
  p('B3-17', 'End-to-end critical flow and accessibility scans', 'landed', ['app/scripts/golden-path.mjs', 'app/scripts/accessibility-smoke.mjs'], 'None.'),
  p('B3-18', 'A staging deploy before production', 'partial', ['STAGING.md'], 'Staging is described; no staging smoke gate.'),
  p('B3-19', 'Manual production approval', 'operational', ['.github/workflows/pages.yml'], 'The github-pages environment has no recorded approval rule. Needs a repository setting.'),
  p('B3-20', 'Canary and staged release', 'absent', [], 'Whole-bundle deploy only.'),
  p('B3-21', 'Instant rollback', 'partial', ['ROLLBACK.md', 'app/src/lib/rollback.test.ts'], 'Rollback rebuilds a ref in about five minutes and the schema does not roll back.'),
  p('B3-22', 'Post-deploy smoke and alerting', 'partial', ['.github/workflows/production-smoke.yml', 'MONITORING.md'], 'Hourly smoke; no latency or error alerting.'),
  p('B3-23', 'A vendor and subprocessor register', 'partial', ['docs/trust/VENDOR-RISK-REGISTER.md', 'docs/SUBPROCESSORS.md'], 'Vendors are named; no risk ratings or review dates.'),
  p('B3-24', 'Vulnerability SLAs and disclosure', 'landed', ['app/src/lib/supplychain.test.ts', 'SECURITY.md'], 'Patch windows are targets, not measured.'),
  p('B3-25', 'Quarterly access reviews, tabletops and a pen test', 'operational', ['docs/trust/PENETRATION-TEST-PLAN.md'], 'Planned only. Needs people and a vendor.'),
  p('B3-26', 'A zero-trust access decision model', 'partial', ['packages/institution/src/policy.ts', 'packages/institution/src/policy.test.ts'], 'A decision point with obligations; route adoption is incomplete.'),
  p('B3-27', 'MFA and fresh authentication for sensitive actions', 'partial', ['app/src/lib/console/client.ts', 'supabase/console-approvals.check.sql'], 'Enforced for console actions only.'),
  p('B3-28', 'Scoped, expiring role grants', 'landed', ['supabase/rolegrants.check.sql', 'supabase/migrations/20260921223000_role_grants.sql'], 'None.'),
  p('B3-29', 'Just-in-time support access', 'landed', ['supabase/support-access.check.sql', 'supabase/migrations/20260925103000_support_access.sql'], 'The support read path does not call the decision point yet.'),
  p('B3-30', 'Break-glass with dual control', 'landed', ['supabase/console-approvals.check.sql', 'supabase/migrations/20260929110000_console_approvals_and_break_glass.sql'], 'A grant now also lands in the shared override log.', true),
  p('B3-31', 'A transactional outbox with an event catalog', 'partial', ['supabase/outbox.check.sql', 'supabase/tenant-feature-policy-events.check.sql', 'supabase/ops-projector-worker.check.sql'], 'The first SQL-native producer, approved replay and bounded projector endpoint are tested; no publisher or scheduled projector runs.'),
  p('B3-32', 'A consistency matrix', 'absent', [], 'Not written down as a policy.'),
  p('B3-33', 'A saga framework', 'absent', [], 'The two-phase action with an uncertain state is the nearest thing; no compensation framework.'),
  p('B3-34', 'Optimistic concurrency', 'partial', ['app/server/institution/gateway.ts'], 'Gateway 409 only.'),
  p('B3-35', 'Append-only audit logs', 'partial', ['supabase/console-control-plane.check.sql', 'supabase/ledger-chains.check.sql'], 'Several audit tables, two chained ledgers and a chained console log; no audit-access auditing across all of them.', true),

  // ── C1 ──────────────────────────────────────────────────────────────────
  p('C1-01', 'Formal assurance cases', 'partial', ['app/src/lib/ops/claims.test.ts', 'app/src/lib/ops/claims.ts'], 'A claims register refuses overstatement; no claim, risk, control and limitation case per capability.'),
  p('C1-02', 'Formal threat modeling', 'partial', ['docs/INTEGRATION-THREAT-MODEL.md'], 'Only the integration surface has one; no template.'),
  p('C1-03', 'A policy enforcement point architecture', 'partial', ['packages/institution/src/policy.test.ts'], 'A decision point exists; no enforcement point calls it from every route.'),
  p('C1-04', 'Immutable configuration and policy history', 'partial', ['app/src/lib/integration/mapping-versions.ts'], 'Versioned mappings and AI policy; no uniform effective-time history for flags, retention and rules.'),
  p('C1-05', 'Data integrity signatures and tamper evidence', 'partial', ['supabase/ledger-seals.check.sql', 'supabase/ledger-chains.check.sql'], 'The academic-record and student-account ledgers are chained and signed and verified nightly. An owner who can read the key can still re-sign; an external anchor is not built. Other audit tables are not chained.', true),
  p('C1-06', 'Data-loss prevention controls', 'absent', [], 'No export watermarking, bulk-download limits or AI-prompt filtering.'),
  p('C1-07', 'A privacy and security control dashboard', 'partial', ['docs/TRUST-CENTER.md', 'supabase/trust-room.check.sql'], 'A trust room exists; not fed by live control status.'),
  p('C1-08', 'A multi-region and failure-domain strategy', 'operational', ['docs/operating-model/OPERATIONAL-MATURITY.md'], 'Single region. Needs a hosting decision and money.'),
  p('C1-09', 'Infrastructure-level tenant isolation', 'partial', ['supabase/tenancy.check.sql', 'supabase/rls-coverage.check.sql'], 'RLS and per-tenant limits; no tenant-scoped keys, storage prefixes or queues.'),
  p('C1-10', 'High-assurance administrator controls', 'partial', ['supabase/console-approvals.check.sql'], 'Two-person approval, fresh MFA and expiring break-glass; no time-delayed destructive actions.'),
  p('C1-11', 'Human factors and error-proofing', 'partial', ['app/src/lib/governance/policysim.ts', 'app/src/lib/integration/simulate.ts'], 'A simulator and dry-run rehearsal; not applied to imports and outward communications.'),
  p('C1-12', 'Continuous compliance automation', 'partial', ['app/src/lib/ops/evidence.ts', 'app/src/lib/ops/evidence.test.ts'], 'A dated evidence register; evidence is filed by hand.'),
  p('C1-13', 'Disaster-recovery game days', 'operational', ['app/src/lib/governance/risk.ts'], 'Game days are defined as data; only the kill-switch drill has run. Needs the live project.'),
  p('C1-14', 'System capacity quotas and tenant protection', 'partial', ['supabase/migrations/20260928230000_direct_rate_limits.sql'], 'Per-user and per-tenant integration limits; no storage, queue or index quotas.'),
  p('C1-15', 'An engineering scorecard and technical-debt economy', 'absent', [], 'No tracking of flaky tests, dependency age, build time or rollback rate.'),

  // ── C2 ──────────────────────────────────────────────────────────────────
  p('C2-01', 'A formal risk-management program', 'landed', ['app/src/lib/governance/risk.ts', 'app/src/lib/governance/risk.test.ts'], 'Some domains, such as finance and vendors, are thin.'),
  p('C2-02', 'A business continuity and succession plan', 'operational', ['docs/STRATEGIC-EXPANSION-REGISTER.md'], 'Key-person, succession and domain-recovery rows are not started. Needs people and decisions.'),
  p('C2-03', 'Data residency and sovereignty controls', 'operational', ['docs/SUBPROCESSORS.md'], 'One region and no tenant region selection. Needs a hosting decision.'),
  p('C2-04', 'Legal-hold and investigation support', 'partial', ['supabase/legal-holds.check.sql', 'supabase/hold-aware-sweeps.check.sql'], 'A hold table with two-person release, obeyed by the sweeps and by erasure. No screen or runbook places one, and on-device deletion is not hold-aware.', true),
  p('C2-05', 'External audit readiness', 'partial', ['app/src/lib/ops/evidence.ts', 'docs/trust/SOC2-READINESS.md'], 'An evidence register with expiry; few filed artifacts and no access-review, pen-test or tabletop evidence.'),
  p('C2-06', 'Regulatory-change monitoring', 'operational', ['docs/operating-model/OPERATING-RHYTHM.md'], 'A quarterly legal review only. Needs counsel and a watch process.'),
  p('C2-07', 'Insider-risk safeguards', 'partial', ['supabase/rolegrants.check.sql', 'supabase/console-approvals.check.sql'], 'Expiring grants, two-person approval and break-glass review; no unusual-access alerting or access-review cadence.'),
  p('C2-08', 'Chaos engineering and fault-injection discipline', 'partial', ['app/scripts/killswitch-drill.mjs', 'app/src/lib/integration/simulate.ts'], 'A drill and a simulator; no harness for dropped, duplicate or out-of-order events.'),
  p('C2-09', 'Long-term credential and cryptographic durability', 'partial', ['app/src/components/CredentialWallet.tsx', 'app/src/lib/credential-wallet.test.ts'], 'A learner-controlled, non-official wallet export exists. Nothing issues, signs, corrects or revokes institution credentials.'),
  p('C2-10', 'An institutional exit and portability guarantee', 'partial', ['docs/DATA-PORTABILITY-AND-OFFBOARDING.md', 'app/src/lib/erasure.test.ts'], 'Student self-export and erase are tested; no institution-level export bundle or exit text.'),
  p('C2-11', 'A product safety review for high-impact features', 'partial', ['app/src/lib/governance/edgecases.ts', 'app/src/lib/governance/quality-gates.ts'], 'Gates and an edge-case catalog; no cross-functional review for trigger features.'),
  p('C2-12', 'A truth-in-product audit', 'landed', ['app/src/lib/ops/claims.ts', 'app/src/lib/ops/claims.test.ts'], 'Pricing and integration claims are not cross-checked against production.'),

  // ── C3 ──────────────────────────────────────────────────────────────────
  p('C3-01', 'An exception-management framework', 'landed', ['app/src/lib/governance/risk.ts', 'app/src/lib/governance/risk.test.ts'], 'The exception list is empty, so it is untested in real use.'),
  p('C3-02', 'A student appeals and correction pathway', 'partial', ['app/src/lib/actions.ts', 'app/src/lib/source.ts'], 'Flag a wrong fact and a needs-review label; no needs-official-review state, notification or audit view.'),
  p('C3-03', 'A trust-calibration engine', 'partial', ['app/src/lib/integration/freshness.ts', 'app/src/lib/source.ts'], 'Freshness states gate the word "official"; no confidence scoring.'),
  p('C3-04', 'A human-review queue framework', 'partial', ['app/src/lib/governance/grading-ai.ts', 'app/src/lib/governance/ai-assurance.ts'], 'A moderation queue and grading-review rules; no general reviewer framework with SLA and escalation.'),
  p('C3-05', 'A course lifecycle system', 'partial', ['app/src/lib/coursestudio.ts'], 'Course Studio exists; no draft, review, publish, archive lifecycle with retirement rules.'),
  p('C3-06', 'A library and academic-resource layer', 'absent', [], 'Only a student’s own source locker.'),
  p('C3-07', 'A research ethics and compliance layer', 'operational', ['docs/operating-model/RESEARCH-AND-SERVICE-DESIGN.md'], 'Most research rows are not started. Needs an IRB relationship and policy.'),
  p('C3-08', 'A robust integration test lab', 'landed', ['app/src/lib/integration/mock-campus.ts', 'app/src/lib/integration/quality.test.ts'], 'A real school sandbox is out of scope.'),
  p('C3-09', 'Financial controls and auditability', 'partial', ['supabase/student-accounts.check.sql', 'supabase/financial-retention.check.sql'], 'Ledgers, plans and retention with checks; payment webhooks are largely undeployed and there is no financial reconciliation report.'),
  p('C3-10', 'A domain-specific AI evaluation benchmark', 'partial', ['docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md', 'app/src/lib/governance/model-quality.test.ts'], 'Live quality and injection tests; no evaluation set or release gate.'),
  p('C3-11', 'A "minimum safe dataset" system', 'absent', [], 'Per-module privacy classes exist; no minimum-data-to-operate definition per feature.'),
  p('C3-12', 'Feature degradation and fallback matrices', 'partial', ['docs/RESILIENT-STUDENT-MODE.md', 'app/src/lib/readonly.ts'], 'Behaviours are described; no per-feature matrix of provider outage to student-safe fallback.'),
  p('C3-13', 'A public and internal reliability history', 'partial', ['app/public/status.html', '.github/workflows/production-smoke.yml'], 'A status page and an hourly probe; no measured history.'),
  p('C3-14', 'A continuous curriculum and content improvement loop', 'absent', [], 'Nothing feeds outcomes and feedback back into course content.'),
  p('C3-15', 'A formal system-readiness gate before each replacement', 'landed', ['app/src/lib/replaceregister.ts', 'app/src/lib/replaceregister.test.ts'], 'No domain has completed the gate.'),
];

/** How many rows carry each status. */
export function counts(rows: readonly Proposal[] = PROPOSALS): Record<AuditStatus, number> {
  const out: Record<AuditStatus, number> = { landed: 0, partial: 0, absent: 0, operational: 0 };
  for (const r of rows) out[r.status]++;
  return out;
}

/** A path that can fail: a test, a database check, a script or a workflow. */
export const CAN_FAIL = /(\.test\.tsx?|\.check\.sql|\.mjs|\.sh|\/workflows\/[\w-]+\.yml|dependabot\.yml|rulesets\/[\w.-]+\.json)$/;

/** The rows a change on this branch moved. */
export const builtHere = (rows: readonly Proposal[] = PROPOSALS): Proposal[] => rows.filter((r) => r.builtHere);
