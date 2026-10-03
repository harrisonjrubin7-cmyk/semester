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
- [x] Branch was reconciled onto `origin/main` `a1504691`; the scoped foundation commits remain isolated from unrelated work.

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

## A3: Establish the scoped RPC and policy-test template — complete

**Description:** Add one representative read RPC pattern with explicit capability, server-derived scope validation, demo exclusion, pagination, provenance, and direct negative tests.

**Acceptance criteria:**
- [x] No caller can widen scope by changing a tenant or account identifier.
- [x] Demo records are excluded by default and production callers cannot opt into them without a distinct sandbox capability.
- [x] Function ownership, grants, and search path meet existing hardening rules.

**Verification:**
- [x] The new 14-assertion SQL check covers no grant, wrong tenant, expired grant, account narrowing, bounded keyset pagination, demo exclusion, sandbox opt-in, grants, and valid access.
- [ ] Full `supabase/check.sh`: A3 passes, but the command remains red on the unchanged `financial-retention.check.sql` and `ledger-seals.check.sql` failures. Both failures reproduce from a detached `origin/main` `a1504691` checkout under the same PostgreSQL 17 runtime.
- [x] `console-scoped-tenant-access`, `grants`, and `definer-sweep` pass together on PostgreSQL 17 (31 assertions total).
- [x] The rebased workspace, console, and register suites pass 48/48; TypeScript passes, focused lint passes, and the production build succeeds.

**Dependencies:** A2
**Files likely touched:** one new migration, one new `supabase/*.check.sql`, `supabase/check.sh`, `supabase/grants.check.sql`
**Estimated scope:** Medium

**Security verification:** HawkScan v6.5.0 scan `cb8dad8d-4919-4bbd-92d0-73c7b62b4ab8` passed against exact committed build `e48e1264` on 2026-10-03. It reported no NEW findings; the same three Medium `style-src unsafe-inline` paths remain human Risk Accepted. The scan covered the SPA surface, while the RPC's authenticated authorization boundaries are held by the direct PostgreSQL policy tests above.

**Mutation verification:** Replacing the exact-tenant `audit:read` gate with an anywhere-scope check made the wrong-tenant assertion fail. Restoring the exact gate returned the focused suite to green.

## A4: Add a five-layer readiness registry — complete

**Description:** Model repository, configuration, deployment, activation/approval, and observed-operation evidence separately so the console cannot collapse them into one ready state.

**Acceptance criteria:**
- [x] Every readiness item exposes its layer, source, owner, freshness, limitation, and blocking scope.
- [x] A repository test cannot satisfy an activation or observed-operation gate.
- [x] Stale or absent evidence fails closed.

**Verification:**
- [x] Seven model tests cover every sequential transition, skipped layers, repository substitution, failed/revoked evidence, expiry, future dates, absence, and wrong-subject evidence.
- [x] The Evidence workspace renders all five layers and labels missing and stale evidence as blocked without optimistic defaults; component and screen integration tests pass.
- [x] `docs/OPS-READINESS-EVIDENCE-REGISTER.md` is generated from the source registry and held byte-for-byte by its test.
- [x] Full app regression passes: 1,262 files, 19,679 tests passed, 48 intentionally skipped.
- [x] TypeScript, focused lint, and the production build pass. Focused lint retains the existing non-blocking `Date` purity warning in `Evidence.tsx`.

**Dependencies:** A3
**Files likely touched:** `app/src/lib/ops/readiness.ts`, its test, one console component, one generated register
**Estimated scope:** Medium

**Security verification:** HawkScan v6.5.0 scan `79cf8cab-7ab8-43ce-b388-f0a8809045ae` passed against exact integrated commit `1af04aed` on 2026-10-03. It reported no NEW findings; the same three Medium `style-src unsafe-inline` paths remain human Risk Accepted. The registry contains no external input or write path; its fail-closed transitions are held by direct unit tests.

## Checkpoint A: Foundation

- [ ] Full frontend and gateway gates pass.
- [ ] SQL policy suite passes.
- [x] HawkScan DAST passes or the missing runtime/key is recorded as a blocking unverified gate.
- [ ] Human review confirms the workspace and scope contracts before Phase B.

## B1: Tenant and pilot operations read workspace — complete

**Description:** Deliver one end-to-end read workspace over existing tenant, rollout, GTM pilot, entitlement, contract, integration, support, and readiness facts.

**Acceptance criteria:**
- [x] Operators see only tenants allowed by their grants.
- [x] Each record shows classification, provenance, owner, freshness, and why it is visible.
- [x] No arbitrary student content is queried or rendered.

**Verification:**
- [x] The 14-assertion `console-tenant-operations` SQL check covers shell-only, tenant-only, expired, exact-tenant, cross-tenant, demo, aggregate-support, grants, search-path, and content-boundary cases; the related grants and definer checks also pass.
- [x] Client adapter, workspace registry, component, screen, and accessibility tests cover loading, empty, stale, missing/invalid/future freshness, denied, generic error, scope/filter, capability gating, and failure announcements.
- [x] Manual keyboard and responsive review passes at 1,440×900 and 390×844. Tab order reaches the demo opt-in then refresh action; focus is visible; the narrow view remains single-column without horizontal clipping. The review caught and fixed the refresh-control contrast regression.
- [x] Full frontend regression passes: 1,263 files, 19,691 tests passed, 48 intentionally skipped. TypeScript, focused lint, and the production build pass.
- [ ] Full `supabase/check.sh`: B1 and related policy suites pass, but the command remains red on the unchanged `financial-retention.check.sql` and `ledger-seals.check.sql` failures that reproduce on the baseline.

**Dependencies:** A4
**Files likely touched:** one migration, one SQL check, one client module/test, one workspace component/test
**Estimated scope:** Medium; split backend and UI if more than five files

**Security verification:** HawkScan v6.5.0 scan `1cf46015-fbfc-4ade-93a8-fb140157c181` passed against exact UI commit `91e8f6ec` on 2026-10-03. It reported no NEW findings; the same three Medium `style-src unsafe-inline` paths remain human Risk Accepted. The quality gate observed 45 served URIs, Ajax Spider coverage, 1,505 requests, zero timeouts, one isolated connection failure, and no auth-wall or all-4xx condition. The scan covers the built SPA surface, not an authenticated privileged session; direct PostgreSQL policy tests hold the RPC authorization and content boundaries.

**Dependency audit note:** no dependency changed. A fresh package audit could not be executed with the bundled runtime because the app has `package-lock.json` rather than a pnpm lockfile and that runtime does not include the npm CLI; no audit pass is claimed.

## B2: Support case workspace

**Description:** Provide metadata-first case operations while keeping student-content access behind the existing explicit support-access workflow.

**Acceptance criteria:**
- [x] Case readers cannot browse student content from the case screen.
- [x] Escalation to support access requires ticket, scope, expiry, consent state, and reason.
- [x] Every sensitive read is audited and the active grant is visible.

**Verification:**
- [x] The focused database gate passes 115 assertions across support-case access, foreign-key indexes, grants, definer sweep, legacy support access, and support tickets. It covers absent, expired, revoked, wrong-scope, wrong-supporter, wrong-tenant, closed-ticket, stale-MFA, and audit failure paths.
- [x] Focused client and component coverage passes 69 tests. It verifies metadata-only case opening, separate sensitive-read intent, capability/MFA routing, server-authoritative consent state, failure announcements, and no automatic private read.
- [x] TypeScript, university TypeScript, focused zero-warning lint, production build, generated role/definer registers, style, accessible-label, and terminology gates pass. The repository-wide lint remains red on 49 pre-existing React-compiler warnings outside the B2 files.
- [x] The full SQL sweep reaches every check; B2 and its index gate pass. The sweep remains red only on the branch's existing `financial-retention.check.sql` and `ledger-seals.check.sql` baselines.
- [x] The signed-out browser state fails closed. Authenticated visual exercise was unavailable without a synthetic Supabase operator session; the component/DOM tests hold loading, empty, denied, metadata, consent, and sensitive-read behavior.

**Security verification:** HawkScan v6.5.0 scan `33d78f76-bdca-4ee1-aaf4-fe5501339d1f` passed against exact code commit `aad55c99` on 2026-10-03. It reported no NEW findings; the same three Medium `style-src unsafe-inline` paths remain human Risk Accepted. The scanner discovered 45 URLs with Ajax Spider coverage. This scan covers the built SPA surface, not authenticated Supabase RPCs; the 115 direct PostgreSQL assertions are the authorization boundary evidence.

**Regression note:** the full frontend run was attempted after the focused gates. The original five failures were resolved or passed in isolation; the rerun became resource-starved while the full PostgreSQL sweep ran and exposed an unrelated existing `DemandContribution.test.tsx` failure that also reproduces alone (8 failures, 2 passes). No B2 source is in that test path, so no full-suite pass is claimed.

**Dependencies:** B1
**Files likely touched:** support RPC migration/check, client adapter/test, support workspace/test
**Estimated scope:** Medium; split as needed

## B3: Privacy and data-rights workspace

**Description:** Operate access, export, correction, and deletion requests with identity verification, legal-hold awareness, approvals, evidence, and completion certificates.

**Acceptance criteria:**
- [x] Legal holds block destructive completion.
- [x] Request identity state, deadlines, stores, owners, approval state, evidence references, and certificate state are explicit without exposing subject identity in the queue.
- [x] High-risk actions use fresh MFA, the existing exact-request deletion approval, and audit-first server functions.

**Verification:**
- [x] Focused PostgreSQL 17 tests cover wrong role, expired grant, wrong tenant, stale MFA, ownership, active hold, failed-audit rollback, exact executed approval, immutable certificates, and successful completion.
- [x] Focused UI tests cover received, verifying, in-progress, completed and refused states; overdue routing; denial; explicit detail access; verification; approval; hold refusal; and certified completion.
- [x] The data-rights runbook matches the implemented claim, audited detail, verification, approval, hold, resolution, and certificate flow.

**Evidence boundary:** the signed-out browser route fails closed and the focused component tests exercise the authenticated workspace. No synthetic operator session or live Supabase deployment was used, so authenticated browser behavior and deployment remain unclaimed.

**Dependencies:** B1
**Files likely touched:** data-rights RPC migration/check, client adapter/test, workspace/test
**Estimated scope:** Medium; split as needed

## B4: Integration health workspace

**Description:** Surface connector configuration state, sync freshness, data quality, failures, owner, customer impact, and the next safe action without exposing credentials.

**Acceptance criteria:**
- [x] Credentials and raw tokens are never returned.
- [x] Tenant and environment boundaries are enforced server-side.
- [x] Configuration changes require the applicable approval duty.

**Verification:**
- [x] SQL tests cover redaction, wrong scope, demo exclusion, and approval visibility.
- [x] UI tests cover healthy, degraded, stale, failed, and unconfigured states.
- [x] Integration runbook references actual actions and rollback paths.

**Evidence boundary:** the database tests prove exact-school authorization and redaction against PostgreSQL 17, and
focused UI tests prove the five-state and request-only workspace. Configuration execution is intentionally separate;
no connector was changed, no authenticated production session was used, and deployment remains unclaimed.

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
