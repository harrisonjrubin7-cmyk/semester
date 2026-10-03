# Semester Operations Console Tasks

This checklist implements `tasks/plan.md`. Tasks are intentionally sized as focused vertical slices. Do not start implementation until the plan and target baseline are reviewed.

## A1: Reconcile current main with Command Center fail-closed fixes — complete

**Description:** Move the existing read-error and filtered-status hardening onto a baseline containing current `origin/main`, without carrying unrelated stale-branch history.

**Acceptance criteria:**
- [x] Command Center never displays GREEN while its live read failed.
- [x] Display filters do not change the unfiltered operational verdict.
- [x] The focused tests fail against a faithful revert of each fix.

**Verification:**
- [x] Focused console suite: 34/34 passed.
- [x] `npx tsc -b` passed using the bundled Node runtime.
- [x] Branch starts at `origin/main` `944a2878` and contains only the two scoped hardening commits before planning artifacts.

**Dependencies:** None
**Files likely touched:** `app/src/components/console/CommandCenter.tsx`, `app/src/screens/console.test.tsx`
**Estimated scope:** Small

**Security verification:** HawkScan v6.5.0 scan `dc811e2c-042f-4096-a115-c7fb90d8371c` completed on 2026-10-03 against the built SPA. It reported no NEW findings. Three Medium CSP paths retained their existing human Risk Accepted state. The quality gate observed 45 served URIs, Ajax Spider coverage, 1,505 requests, zero timeouts, one transient connection failure, and no auth-wall or all-4xx condition. The authenticated console is stateful rather than a distinct URL, so this scan does not establish coverage of a live privileged operator session.

## A2: Add a capability-aware console workspace registry — complete

**Description:** Replace the fixed tab list with a typed registry that declares each workspace's capability, scope kind, classification, and component while preserving the current UI.

**Acceptance criteria:**
- [x] Shell access alone does not expose domain workspaces.
- [x] Hidden workspace navigation is backed by an exact capability and scope contract; server authorization remains independently required.
- [x] Existing eight views retain behavior and saved-view compatibility.

**Verification:**
- [x] Focused registry and console rendering suite passes: 38/38.
- [x] A grant matrix test covers allowed and denied workspaces and fails when exact capability/scope matching is removed.
- [x] Existing shared `TabList` keyboard and responsive behavior is preserved; no navigation markup or styling changed.

**Dependencies:** A1
**Files likely touched:** `app/src/screens/Console.tsx`, `app/src/lib/console/workspaces.ts`, `app/src/lib/console/workspaces.test.ts`, `app/src/screens/console.test.tsx`
**Estimated scope:** Medium

**Security verification:** HawkScan v6.5.0 scan `dce00a3c-595c-4150-89d2-54fb115b7fab` passed against the exact committed build on 2026-10-03. It reported no NEW findings; the same three Medium CSP paths remain human Risk Accepted. The quality gate observed 45 served URIs, Ajax Spider coverage, 1,504 requests, zero timeouts, one transient connection failure, and no auth-wall or all-4xx condition. As with A1, the stateful authenticated console is not a distinct URL and a live privileged session was not scanned.

**Known baseline gate:** Focused lint passes for all A2 files. The repository-wide lint command remains red because current main exceeds its existing 25-warning budget in unrelated files; A2 introduces no lint warning.

## A3: Establish the scoped RPC and policy-test template

**Description:** Add one representative read RPC pattern with explicit capability, server-derived scope validation, demo exclusion, pagination, provenance, and direct negative tests.

**Acceptance criteria:**
- [ ] No caller can widen scope by changing a tenant or account identifier.
- [ ] Demo records are excluded by default and production callers cannot opt into them without a distinct sandbox capability.
- [ ] Function ownership, grants, and search path meet existing hardening rules.

**Verification:**
- [ ] New SQL check covers no grant, wrong tenant, expired grant, demo exclusion, and valid access.
- [ ] `supabase/check.sh` passes.
- [ ] `supabase/grants.check.sql` and definer sweeps remain green.

**Dependencies:** A2
**Files likely touched:** one new migration, one new `supabase/*.check.sql`, `supabase/check.sh`, `supabase/grants.check.sql`
**Estimated scope:** Medium

## A4: Add a five-layer readiness registry

**Description:** Model repository, configuration, deployment, activation/approval, and observed-operation evidence separately so the console cannot collapse them into one ready state.

**Acceptance criteria:**
- [ ] Every readiness item exposes its layer, source, owner, freshness, limitation, and blocking scope.
- [ ] A repository test cannot satisfy an activation or observed-operation gate.
- [ ] Stale or absent evidence fails closed.

**Verification:**
- [ ] Unit tests cover every transition and prohibited promotion.
- [ ] Console renders missing and stale evidence without optimistic defaults.
- [ ] Generated readiness documentation matches the source registry.

**Dependencies:** A3
**Files likely touched:** `app/src/lib/ops/readiness.ts`, its test, one console component, one generated register
**Estimated scope:** Medium

## Checkpoint A: Foundation

- [ ] Full frontend and gateway gates pass.
- [ ] SQL policy suite passes.
- [ ] HawkScan DAST passes or the missing runtime/key is recorded as a blocking unverified gate.
- [ ] Human review confirms the workspace and scope contracts before Phase B.

## B1: Tenant and pilot operations read workspace

**Description:** Deliver one end-to-end read workspace over existing tenant, rollout, GTM pilot, entitlement, contract, integration, support, and readiness facts.

**Acceptance criteria:**
- [ ] Operators see only tenants allowed by their grants.
- [ ] Each record shows classification, provenance, owner, freshness, and why it is visible.
- [ ] No arbitrary student content is queried or rendered.

**Verification:**
- [ ] Cross-tenant and demo-boundary SQL tests pass.
- [ ] Client adapter and UI tests cover loading, empty, stale, denied, and error states.
- [ ] Manual keyboard and responsive review passes.

**Dependencies:** A4
**Files likely touched:** one migration, one SQL check, one client module/test, one workspace component/test
**Estimated scope:** Medium; split backend and UI if more than five files

## B2: Support case workspace

**Description:** Provide metadata-first case operations while keeping student-content access behind the existing explicit support-access workflow.

**Acceptance criteria:**
- [ ] Case readers cannot browse student content from the case screen.
- [ ] Escalation to support access requires ticket, scope, expiry, consent state, and reason.
- [ ] Every sensitive read is audited and the active grant is visible.

**Verification:**
- [ ] Consent absent/expired/wrong-scope tests fail closed.
- [ ] Support-agent and non-support role tests pass.
- [ ] UI clearly distinguishes metadata from private content access.

**Dependencies:** B1
**Files likely touched:** support RPC migration/check, client adapter/test, support workspace/test
**Estimated scope:** Medium; split as needed

## B3: Privacy and data-rights workspace

**Description:** Operate access, export, correction, and deletion requests with identity verification, legal-hold awareness, approvals, evidence, and completion certificates.

**Acceptance criteria:**
- [ ] Legal holds block destructive completion.
- [ ] Request identity, deadlines, stores, owners, and evidence are explicit.
- [ ] High-risk actions use the existing approval and audit-first path.

**Verification:**
- [ ] SQL tests cover wrong role, wrong tenant, active hold, failed audit, and successful completion.
- [ ] UI tests cover each lifecycle state and overdue routing.
- [ ] Data-rights runbook matches the implemented flow.

**Dependencies:** B1
**Files likely touched:** data-rights RPC migration/check, client adapter/test, workspace/test
**Estimated scope:** Medium; split as needed

## B4: Integration health workspace

**Description:** Surface connector configuration state, sync freshness, data quality, failures, owner, customer impact, and the next safe action without exposing credentials.

**Acceptance criteria:**
- [ ] Credentials and raw tokens are never returned.
- [ ] Tenant and environment boundaries are enforced server-side.
- [ ] Configuration changes require the applicable approval duty.

**Verification:**
- [ ] SQL tests cover redaction, wrong scope, demo exclusion, and approval enforcement.
- [ ] UI tests cover healthy, degraded, stale, failed, and unconfigured states.
- [ ] Integration runbook references actual actions and rollback paths.

**Dependencies:** B1
**Files likely touched:** integration RPC migration/check, client adapter/test, workspace/test
**Estimated scope:** Medium; split as needed

## B5: Release and incident workspace

**Description:** Connect release evidence, deployments, incidents, customer impact, communications, rollback state, and ownership.

**Acceptance criteria:**
- [ ] A missing deployment source or stale evidence cannot produce GO/GREEN.
- [ ] Incidents state affected tenants/workflows and communication status.
- [ ] Release and rollback actions require their declared evidence and approvals.

**Verification:**
- [ ] Fail-closed evidence and authorization tests pass.
- [ ] UI tests cover release candidate, blocked, deployed-unverified, incident, rollback, and recovered states.
- [ ] Production claims remain explicitly unverified without external evidence.

**Dependencies:** A4, B4
**Files likely touched:** release/incident RPC migration/check, client adapter/test, workspace/test
**Estimated scope:** Medium; split as needed

## B6: Implementation and customer-success workspace

**Description:** Expose implementation projects, milestones, success plans, pilot metrics, QBRs, owners, risks, and next actions from existing commercial records.

**Acceptance criteria:**
- [ ] Access is limited to success staff and authorized tenant operators.
- [ ] Pilot metrics distinguish target, source, actual, status, and evidence.
- [ ] Health states cannot be entered without source and time window.

**Verification:**
- [ ] Capability and tenant-boundary policy tests pass.
- [ ] UI tests cover no-plan, onboarding, at-risk, review-due, and completed states.
- [ ] Existing customer-success playbooks map to the workflow.

**Dependencies:** B1
**Files likely touched:** success RPC migration/check, client adapter/test, workspace/test
**Estimated scope:** Medium; split as needed

## Checkpoint B: Pilot operations

- [ ] Demo-tenant end-to-end pilot exercise succeeds.
- [ ] Cross-tenant and consent-boundary adversarial tests pass.
- [ ] Full application, SQL, accessibility, responsive, and DAST gates pass.
- [ ] Readiness report states whether limited internal or pilot operations are justified.

## Phase C and D backlog

The following tasks are sequenced after Checkpoint B and must be expanded into the same acceptance/verification format immediately before implementation:

- [ ] C1 GTM account and pilot pipeline workspace
- [ ] C2 Quote and contract workspace
- [ ] C3 Billing, invoice, collections, and dunning workspace
- [ ] C4 Credit, refund, and cancellation approvals
- [ ] C5 Renewal, expansion, QBR, and account-health workspace
- [ ] C6 Vendor, subprocessor, procurement, and policy-review workspace
- [ ] D1 Company workstream, risk, decision, and operating-review workspace
- [ ] D2 Operational and revenue analytics
- [ ] D3 Feature flag and entitlement change controls
- [ ] D4 Deployment/release adapter and rollback evidence
- [ ] D5 Human-in-the-loop automation framework
- [ ] D6 Runbook library, changelog, and final readiness report
