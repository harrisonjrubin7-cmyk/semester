# Operations console map

<!-- Rendered from app/src/lib/ops/console.ts by console.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

The operations console is [`app/src/screens/Console.tsx`](../app/src/screens/Console.tsx), at `#/console`,
opened only by a signed-in account holding `console:operate` at platform
scope; without it the screen is a notice, never a demo. Every view reads the
controls in [`ops/operations-console/README.md`](../ops/operations-console/README.md) and the control plane
in [`supabase/migrations/20260929100000_console_control_plane.sql`](../supabase/migrations/20260929100000_console_control_plane.sql) and
[`supabase/migrations/20260929110000_console_approvals_and_break_glass.sql`](../supabase/migrations/20260929110000_console_approvals_and_break_glass.sql).

## The context bar

On every view. The environment is a word and a shape, never colour alone.

| Field | Shows |
| --- | --- |
| **Environment** | “Production”, “Staging” or “Demo”, as a word and a shape, read from the deployment, never from a setting the operator can change |
| **Scope** | The tenant or customer the page is about, or “All”, and nothing outside it is rendered |
| **Operator** | The signed-in person’s real identity. There is no preview-as, and no impersonation |
| **Role** | The roles and capabilities in force for this session, from the role grants, not from a selector |
| **MFA** | Fresh, or how long ago; a sensitive action asks again |
| **Session** | When it expires |
| **Support access** | “None”, or the open grant: which student, which ticket, when it ends |

Under any production write: *Production change. This will affect a live customer.*

## The views

| View | Shows |
| --- | --- |
| **Command center** | Live release-gate and operational exceptions from production tables; green only when the scoped queue is empty, with every blocker naming its source, evidence boundary and next safe step |
| **Approvals** | Requests against the duties matrix: raise one, decide one as a different person, and act on an approved one — the fail-closed write — with the production notice and the duty’s evidence requirement |
| **Break-glass** | Open grants with their ticket, expiry and review due; close one as its subject, review one as somebody else |
| **Audit** | The chain’s status (rows, head hash, last seal, last verification) and recent events; every read is itself an audit event, and the view says so |
| **Tenant operations** | Metadata-only rollout, configuration, integration, support-access and operational facts for exact schools covered by live tenant implementation grants; no student records or illustrative production data |
| **Privacy requests** | An identity-minimized, exact-school queue for access, export, correction, restriction and erasure; detail reads and lifecycle writes are separate, fresh-MFA, audited actions |
| **Integration health** | Credential-free configuration, freshness, run, reconciliation, exception, ownership and customer-impact summaries for exact-school integration grants; configuration changes are request-only approvals |
| **Release & incidents** | Evidence-derived release, deployment-verification and incident lifecycle states with customer impact, communication cadence, rollback status and request-only approvals; never a self-certified GO decision |
| **Customers** | Tenants, commitments and contracts, each record with its classification and why the operator can see it |
| **Figures** | Every figure with its source, time window, environment, owner, last refresh, evidence and known limitation; billing says there is no billing |
| **Evidence** | Every evidence record with its expiry, its escalation step and the claims resting on it |
| **Views** | Saved table views and the last tab, stored per operator in operator_preference |

## What holds each view

The capability behind each view, and its holders, from the same file.

### Command center

**Live operational command center** (done) — public.console_command_center: a fail-closed exception queue over current release evidence, approvals, break-glass, integrations, support and tenant rollout; an empty scoped queue is the only green state.

- [`supabase/migrations/20260930173030_console_command_center.sql`](../supabase/migrations/20260930173030_console_command_center.sql) — The evidence-backed release gates, demo-aware operational unions and server-side console:operate refusal.
- [`supabase/console-command-center.check.sql`](../supabase/console-command-center.check.sql) — A non-operator is refused, missing proof stays red, live exceptions appear, and demo tenants stay out by default.
- [`app/src/lib/console/client.ts`](../app/src/lib/console/client.ts) — loadCommandCenter maps the RPC without caching or browser storage.
- [`app/src/lib/console/client.test.ts`](../app/src/lib/console/client.test.ts) — The RPC name, demo switch and evidence boundary round-trip.
- [`app/src/components/console/CommandCenter.tsx`](../app/src/components/console/CommandCenter.tsx) — The queue, severity counts, source, limitation and next safe step; GREEN only for zero rows.
- [`app/src/screens/console.test.tsx`](../app/src/screens/console.test.tsx) — A missing restore proof renders NOT GO and no evidence; an empty live response alone renders GREEN.

### Approvals

**Two-person approvals** (done) — public.approval_request and approval_decision: a request routed to a different person’s session, self-approval refused on the server, two distinct approvers where the duty says so, fresh MFA on every decision.

- [`supabase/migrations/20260929110000_console_approvals_and_break_glass.sql`](../supabase/migrations/20260929110000_console_approvals_and_break_glass.sql) — request_approval, decide_approval and the party check against private.party_held.
- [`supabase/console-approvals.check.sql`](../supabase/console-approvals.check.sql) — Self-approval raises; a second decision by the same approver is refused by the key; a two-person duty stays pending after one approve.
- [`app/src/screens/Console.tsx`](../app/src/screens/Console.tsx) — The Approvals view: request, decide, act, with PRODUCTION_WRITE_NOTICE under every production write and the duty’s evidence requirement shown.
- [`app/src/screens/console.test.tsx`](../app/src/screens/console.test.tsx) — The notice and the evidence requirement are rendered for each duty.

**High-risk writes** (done) — public.console_act writes the audit event first and performs the effect in the same function body; if the event cannot be written the call fails and nothing else happens.

- [`supabase/migrations/20260929110000_console_approvals_and_break_glass.sql`](../supabase/migrations/20260929110000_console_approvals_and_break_glass.sql) — console_act: audit through private.console_audit_write, then the duty’s effect, then the request is executed.
- [`supabase/console-approvals.check.sql`](../supabase/console-approvals.check.sql) — With the audit insert revoked inside a savepoint the call raises and leaves no grant, no action record and no status change; on the happy path the audit seq precedes the effect.

### Break-glass

**Break-glass** (done) — public.break_glass_grant opened only by console_act on an approved two-person request, with a ticket, fresh MFA, an expiry no later than four hours, a review due after it, and a post-use review by someone else.

- [`supabase/migrations/20260929110000_console_approvals_and_break_glass.sql`](../supabase/migrations/20260929110000_console_approvals_and_break_glass.sql) — The grant table, break_glass_active, close_break_glass and review_break_glass, each audited first.
- [`supabase/console-approvals.check.sql`](../supabase/console-approvals.check.sql) — An expiry past four hours is refused; the subject cannot review their own grant; an unreviewed grant past its review blocks the next request.
- [`app/src/screens/Console.tsx`](../app/src/screens/Console.tsx) — The Break-glass view: open grants, close, review.
- [`app/src/screens/console.test.tsx`](../app/src/screens/console.test.tsx) — A grant renders with its expiry and review due, and the review control is not offered to its subject.

### Audit

**Audit log** (done) — private.console_audit_event: server-written, insert-only, hash-chained, written only by the semester_audit_writer role, sealed nightly into a signed manifest, re-verified nightly, outside the retention sweep, and every read of it logged.

- [`supabase/migrations/20260929100000_console_control_plane.sql`](../supabase/migrations/20260929100000_console_control_plane.sql) — The table, its triggers, the writer role, console_audit_write, the key, the manifest, seal and verify, and console_audit_read.
- [`supabase/console-control-plane.check.sql`](../supabase/console-control-plane.check.sql) — Update and delete raise; the service role cannot insert directly; a plain session cannot call the writer; the sweep leaves the rows; a read writes audit.read first.
- [`supabase/scheduler.sql`](../supabase/scheduler.sql) — The console-audit-integrity job at 03:23 seals yesterday and verifies the chain.
- [`app/src/lib/console/client.ts`](../app/src/lib/console/client.ts) — loadAudit and auditStatus.
- [`app/src/screens/Console.tsx`](../app/src/screens/Console.tsx) — The Audit view shows the chain status and says that every read is itself logged.

### Tenant operations

**Tenant operations** (done) — a server-derived, exact-school operational summary available only when the operator has both the platform console shell and a live `tenant:implement` grant. Production excludes demo tenants and the browser supplies no tenant identifier.

- [`supabase/migrations/20261005121000_console_tenant_operations.sql`](../supabase/migrations/20261005121000_console_tenant_operations.sql) — Metadata-only fact union, server-derived exact-school scope, demo separation and restricted provenance fields.
- [`supabase/console-tenant-operations.check.sql`](../supabase/console-tenant-operations.check.sql) — Shell-plus-domain authorization, wrong-tenant and expired-grant denial, demo separation and metadata-only response checks.
- [`app/src/lib/console/client.ts`](../app/src/lib/console/client.ts) — loadTenantOperations calls the scoped RPC without accepting a tenant identifier or caching rows.
- [`app/src/components/console/TenantOperations.tsx`](../app/src/components/console/TenantOperations.tsx) — Grouped facts with provenance, classification, owner, freshness, visibility reason and limitation.
- [`app/src/components/console/TenantOperations.test.tsx`](../app/src/components/console/TenantOperations.test.tsx) — Loading, denial, empty, stale, future-date, scope and filter behavior.

### Privacy requests

**Privacy and data-rights operations** (done) — an identity-minimized queue over `public.data_subject_request`, available only when the operator has both the platform console shell and a live `data_request:handle` grant for an exact school. Sensitive detail is never loaded with the queue.

- [`supabase/migrations/20261005123000_privacy_case_workspace.sql`](../supabase/migrations/20261005123000_privacy_case_workspace.sql) — Metadata-only queue, exact-school authorization, demo separation, assignment fields, legal-hold state and deletion-approval state.
- [`supabase/migrations/20261005124000_privacy_case_actions.sql`](../supabase/migrations/20261005124000_privacy_case_actions.sql) — Fresh-MFA claim, audited detail read, identity verification, resolution, live-hold and exact executed-approval enforcement, and immutable completion certificates.
- [`supabase/privacy-case-workspace.check.sql`](../supabase/privacy-case-workspace.check.sql) — Wrong-role, expired-grant, wrong-tenant, demo, assignment and identity-minimization checks.
- [`supabase/privacy-case-actions.check.sql`](../supabase/privacy-case-actions.check.sql) — Stale-MFA, ownership, failed-audit, live-hold, approval, certificate and audit-first paths.
- [`app/src/components/console/PrivacyRequests.tsx`](../app/src/components/console/PrivacyRequests.tsx) — Metadata queue, explicit claim/detail/verification/approval/resolution controls, overdue and hold states, and fail-closed loading, denial and error behavior.
- [`app/src/components/console/PrivacyRequests.test.tsx`](../app/src/components/console/PrivacyRequests.test.tsx) — Metadata-only rendering, overdue routing, denial, claim, detail, verification, deletion approval, held refusal, completed erasure and terminal read-only states.
- [`docs/DATA-RIGHTS-REQUEST-RUNBOOK.md`](DATA-RIGHTS-REQUEST-RUNBOOK.md) — The operated procedure and quarterly rehearsal boundary.

### Integration health

**Integration health operations** (done) — a credential-free summary over connector configuration, sync freshness, data quality, failures, ownership and customer impact, available only with both the platform console shell and a live `integration:view` grant for an exact school. The browser cannot submit a tenant id to the reader.

- [`supabase/migrations/20261005125000_console_integration_health.sql`](../supabase/migrations/20261005125000_console_integration_health.sql) — Server-derived tenant scope, explicit demo gate, allowlisted fields, computed five-state health and exact configuration-approval status.
- [`supabase/console-integration-health.check.sql`](../supabase/console-integration-health.check.sql) — Exact-school, demo, shell/domain denial, five-state, pending-approval and planted-secret redaction checks.
- [`app/src/components/console/IntegrationHealth.tsx`](../app/src/components/console/IntegrationHealth.tsx) — Health evidence, cautious impact, next safe action and a structured request-only `integration-config` approval; no configuration mutation or credential field.
- [`app/src/components/console/IntegrationHealth.test.tsx`](../app/src/components/console/IntegrationHealth.test.tsx) — Healthy, degraded, stale, failed, unconfigured, denial, demo and exact approval-request coverage.
- [`docs/INTEGRATION-OPERATOR-RUNBOOK.md`](INTEGRATION-OPERATOR-RUNBOOK.md) — Actual monitoring, approval, verification and rollback procedure.

### Release & incidents

**Release and incident operations** (done) — a platform-scoped, restricted summary over current release evidence, exact deployment and verification commits, incident impact and communication cadence. It requires both the console shell and `incident:communicate` at platform scope, and exposes approval requests rather than deployment or rollback execution.

- [`supabase/migrations/20261005126000_console_release_incidents.sql`](../supabase/migrations/20261005126000_console_release_incidents.sql) — Conservative seven-gate release state, exact-commit deployment verification, service-recorded incidents, server-derived scope and allowlisted metadata.
- [`supabase/console-release-incidents.check.sql`](../supabase/console-release-incidents.check.sql) — Missing and mismatched evidence, release candidate, deployment, verification, incident, rollback, recovery, demo, role and planted-notice redaction checks.
- [`app/src/components/console/ReleaseIncidents.tsx`](../app/src/components/console/ReleaseIncidents.tsx) — Six required lifecycle states plus verified evidence, customer impact, communication cadence and structured request-only release or rollback approvals.
- [`app/src/components/console/ReleaseIncidents.test.tsx`](../app/src/components/console/ReleaseIncidents.test.tsx) — Lifecycle, denial, empty, demo, no-direct-execution and exact approval-request coverage.
- [`docs/RELEASE-INCIDENT-OPERATOR-RUNBOOK.md`](RELEASE-INCIDENT-OPERATOR-RUNBOOK.md) — Evidence capture, approval, external execution, exact-commit verification, incident communication, rollback and recovery procedure.
- [`docs/operating-model/INCIDENT-COMMUNICATIONS.md`](operating-model/INCIDENT-COMMUNICATIONS.md) — Audience, cadence and message-quality requirements; notice bodies remain outside the console summary.

### Customers

**Tenant, customer, commitment, contract data** (done) — public.customer, customer_commitment and customer_contract, tenant-scoped under RLS, written only through operations and read by console_customers.

- [`supabase/migrations/20260929110000_console_approvals_and_break_glass.sql`](../supabase/migrations/20260929110000_console_approvals_and_break_glass.sql) — The three tables, their policies and console_customers.
- [`supabase/console-approvals.check.sql`](../supabase/console-approvals.check.sql) — A tenant:configure holder reads only their tenant; a browser session cannot write; a demo tenant is absent from the default read.
- [`app/src/lib/console/client.ts`](../app/src/lib/console/client.ts) — loadCustomers.
- [`app/src/screens/Console.tsx`](../app/src/screens/Console.tsx) — The Customers view: each record names its class per RECORD_KINDS and answers “Why can I see this?” per ACCESS_BASIS.
- [`app/src/screens/console.test.tsx`](../app/src/screens/console.test.tsx) — Every rendered record carries its classification and the five access-basis fields.

### Figures

**Billing and reliability metrics** (done) — public.console_figures: each figure from a real query with the seven provenance fields; the billing figure says “not applicable” with its source (D-009), never a number.

- [`supabase/migrations/20260929100000_console_control_plane.sql`](../supabase/migrations/20260929100000_console_control_plane.sql) — console_figures with the rows the control plane can read: audit, verification, grants, seats, support windows, schools, gateway health, billing.
- [`supabase/migrations/20260929110000_console_approvals_and_break_glass.sql`](../supabase/migrations/20260929110000_console_approvals_and_break_glass.sql) — console_figures replaced with the approvals, break-glass, customer and contract rows added.
- [`supabase/console-control-plane.check.sql`](../supabase/console-control-plane.check.sql) — Every row carries a source, a window, an owner seat and a refresh; billing is not applicable and cites D-009.
- [`supabase/console-approvals.check.sql`](../supabase/console-approvals.check.sql) — The replaced function keeps every row of the first.
- [`app/src/screens/Console.tsx`](../app/src/screens/Console.tsx) — The Figures view shows all seven FIGURE_PROVENANCE fields for each figure.
- [`app/src/screens/console.test.tsx`](../app/src/screens/console.test.tsx) — No figure renders without its seven fields.

### Evidence

**Evidence and claims** (done) — Evidence records with a produced date and a validity, whose state drives the claims register and the procurement pack: a claim resting on an expired record cannot stay “available”.

- [`app/src/lib/ops/evidence.ts`](../app/src/lib/ops/evidence.ts) — EVIDENCE and evidenceState, using the escalation ladder above.
- [`app/src/lib/ops/evidence.test.ts`](../app/src/lib/ops/evidence.test.ts) — Every record cites a file that states its date; the state is shown each side of each step; the real date leaves no expired record under an available claim.
- [`app/src/lib/ops/claims.test.ts`](../app/src/lib/ops/claims.test.ts) — problems() names a claim that rests on an expired record.
- [`docs/EVIDENCE-REGISTER.md`](EVIDENCE-REGISTER.md) — The rendered register.
- [`app/src/screens/Console.tsx`](../app/src/screens/Console.tsx) — The Evidence view, from EVIDENCE and evidenceState.

### Views

**Saved table views, nav state** (done) — Per-user preferences stored server-side: public.operator_preference, owner-only under RLS, read and written through PostgREST as the operator.

- [`supabase/migrations/20260929100000_console_control_plane.sql`](../supabase/migrations/20260929100000_console_control_plane.sql) — The operator_preference table, keyed by subject and key, with owner-only policies on every verb.
- [`supabase/console-control-plane.check.sql`](../supabase/console-control-plane.check.sql) — A second account cannot read or write another operator’s preference.
- [`app/src/lib/console/client.ts`](../app/src/lib/console/client.ts) — loadPreferences and savePreference.
- [`app/src/screens/Console.tsx`](../app/src/screens/Console.tsx) — The Views tab and the last tab, persisted through operator_preference, never localStorage.
- [`app/src/screens/console.test.tsx`](../app/src/screens/console.test.tsx) — A saved view round-trips through the mocked table and nothing is written to the browser.

## Everywhere

The bar and the gate rest on these, whichever view is open.

**Operator identity** (done) — Supabase Auth with the account’s real identity; a privileged action needs fresh MFA (aal2 within fifteen minutes), asserted by private.assert_fresh_mfa on the server.

- [`supabase/migrations/20260929100000_console_control_plane.sql`](../supabase/migrations/20260929100000_console_control_plane.sql) — private.mfa_fresh reads aal and amr from the JWT; private.assert_fresh_mfa raises “Fresh MFA required”.
- [`supabase/console-control-plane.check.sql`](../supabase/console-control-plane.check.sql) — Both branches: a claim set with a fresh totp entry passes, one without aal2 or with a stale timestamp raises.
- [`app/src/components/MfaStep.tsx`](../app/src/components/MfaStep.tsx) — Enrol TOTP and challenge/verify before a privileged action.
- [`app/src/components/MfaStep.test.tsx`](../app/src/components/MfaStep.test.tsx) — The step is shown when the assurance level is not aal2, and clears when verification succeeds.
- [`app/src/lib/console/client.ts`](../app/src/lib/console/client.ts) — mfaLevel, enrollTotp, challengeTotp, verifyTotp and sessionExpiry.
- [`app/src/lib/console/client.test.ts`](../app/src/lib/console/client.test.ts) — Each wrapper calls the supabase-js auth.mfa method it names.

**Roles and capabilities** (done) — Scoped role_grants with capability, scope and expiry, checked server-side; console:operate, approval:decide and breakglass:request are capabilities of public.app_capabilities. There is no role switching in production.

- [`supabase/migrations/20260929100000_console_control_plane.sql`](../supabase/migrations/20260929100000_console_control_plane.sql) — The three capabilities and their role_capabilities rows; audit:read at platform scope for platform_admin.
- [`supabase/console-control-plane.check.sql`](../supabase/console-control-plane.check.sql) — Each console capability is held by the roles the contract names and by nobody else.
- [`supabase/rolegrants.check.sql`](../supabase/rolegrants.check.sql) — A grant has a scope, an expiry and an audited grantor.
- [`supabase/my-capabilities.check.sql`](../supabase/my-capabilities.check.sql) — my_capabilities returns the live grants and only those.
- [`app/src/screens/Console.tsx`](../app/src/screens/Console.tsx) — The Role field is the live grants from my_capabilities; there is no selector.
- [`app/src/screens/console.test.tsx`](../app/src/screens/console.test.tsx) — The screen renders the granted roles and offers no way to change them.

**Authorization** (done) — Server-side authorization, RLS and object rules on every request; the UI gate is a courtesy and never the authorization.

- [`supabase/rls-coverage.check.sql`](../supabase/rls-coverage.check.sql) — Every table in public has RLS on and at least one policy.
- [`supabase/grants.check.sql`](../supabase/grants.check.sql) — Every public function is on the allowlist, and anon holds nothing it should not.
- [`supabase/migrations/20260929100000_console_control_plane.sql`](../supabase/migrations/20260929100000_console_control_plane.sql) — Every console function checks private.has_capability itself; definer functions pin search_path.
- [`supabase/console-control-plane.check.sql`](../supabase/console-control-plane.check.sql) — A session without console:operate is refused by the function, not by the screen.
- [`app/src/screens/console.test.tsx`](../app/src/screens/console.test.tsx) — Without the capability the screen is a Notice, never a demo.

**Support access** (done) — Student-approved, case-scoped, time-bound grants with the session banner and a per-read audit; the console shows the open grant in its context bar.

- [`supabase/support-access.check.sql`](../supabase/support-access.check.sql) — A support read needs a grant with a scope and an expiry, and each read is logged.
- [`app/src/lib/console/client.ts`](../app/src/lib/console/client.ts) — openSupportGrants over the support_access_windows RPC.
- [`app/src/screens/Console.tsx`](../app/src/screens/Console.tsx) — The Support access field: “None”, or the student, the ticket and when it ends.
- [`app/src/screens/console.test.tsx`](../app/src/screens/console.test.tsx) — The bar reads None with no grant and the grant’s scope with one.

**Environment separation** (done) — A separate demo tenant (schools.is_demo) with synthetic data, excluded from every console read unless asked for; the environment word comes from the deployment, and production never shows an illustrative record.

- [`supabase/migrations/20260929100000_console_control_plane.sql`](../supabase/migrations/20260929100000_console_control_plane.sql) — schools.is_demo, and include_demo defaulting to false on every reader.
- [`supabase/console-control-plane.check.sql`](../supabase/console-control-plane.check.sql) — A demo school’s rows are absent from the default read.
- [`app/src/lib/environment.ts`](../app/src/lib/environment.ts) — environment() from the deployment’s variables, never from a setting; ENVIRONMENT_SHAPE is a word and a shape.
- [`app/src/lib/environment.test.ts`](../app/src/lib/environment.test.ts) — Demo, Staging and Production from each variable, and never from anything an operator can change.
- [`app/src/lib/pagesdemo.test.ts`](../app/src/lib/pagesdemo.test.ts) — The deployed site is the product; the demo is beside it (TRUST-005).
- [`app/src/lib/demosplit.test.ts`](../app/src/lib/demosplit.test.ts) — Demo data does not reach the production bundle.
- [`app/src/lib/ops/boundaries.test.ts`](../app/src/lib/ops/boundaries.test.ts) — No fake production data and no browser service-role credential.
- [`app/src/screens/Console.tsx`](../app/src/screens/Console.tsx) — The Environment field, as a word and a shape.
