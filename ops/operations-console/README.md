# Operations console controls

<!-- Rendered from app/src/lib/ops/console.ts by console.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

The policy the operations console reads: who may approve what, which
records carry which class, what every page shows, what happens when evidence
goes stale, and the lines a prototype in a browser could not hold. Written
as data first (D-110) so that a test holds it and a screen cannot quietly
re-decide it; the console (`app/src/screens/Console.tsx`) and the
migrations behind it now read it, and the last two sections say which file
holds each of the fourteen things the prototype faked. [`docs/OPERATIONS-CONSOLE-MAP.md`](../../docs/OPERATIONS-CONSOLE-MAP.md) is the
map of the console’s views.

Parties: **seat** — A council seat: the accountability, held by whoever accepted it in writing; **role** — A row of public.app_roles, granted through the role-grant workflow and audited; **student** — The student whose record it is; their consent is the approval.

## Segregation of duties

For each high-risk action: who asks, who approves, whether two approvers are
needed, and what is attached. A requester is never among the approvers, a
two-person action names at least two, and every party is a council seat, a
row of `public.app_roles`, or the student. The test refuses anything else.

| Action | Requester | Approver | Two-person | Evidence attached | Rows |
| --- | --- | --- | --- | --- | --- |
| **Break-glass access to a production tenant**<br>Break-glass widens who, never what: it still cannot exceed the incident’s scope. | seat `engineering` | seat `security` **and** seat `founder` | yes | An incident or change ticket, fresh MFA, an expiry no later than the incident’s close, and a post-use review booked | `IAM-006` (tested), `IAM-011` (designed) |
| **Grant or widen a privileged role**<br>The role-grant audit (supabase/role-grant-audit.check.sql) records it; a grant with no request is a finding at the quarterly access review. | role `university_admin` | seat `security` | no | The access request, naming the person, the role, the tenant and the reason | `IAM-006` (tested), `IAM-011` (designed) |
| **Read a student’s record for support**<br>No support role browses student records. The student’s grant is the approval, and it expires. | role `support_agent` | the student | no | A support ticket, the scope, a time limit, and the banner the student sees while the grant is open | `IAM-010` (tested) |
| **Suspend a production tenant** | role `platform_admin` | seat `founder` **and** seat `security` | yes | A change ticket and the customer communication that goes with it | `IAM-006` (tested), `SEC-007` (building) |
| **Change a tenant’s policy or turn a feature on for it**<br>High-risk flags — anything that reaches student data or an official system — take the two-person path of `integration-config`. | role `implementation_manager` | seat `engineering` | no | A change record naming the flag or policy, the tenant, the rollback and who at the institution asked | `PRG-007` (tested), `PRG-003` (building) |
| **Configure, rotate or disable a connector to an official system** | role `integration_admin` | seat `data` **and** seat `security` | yes | The institution’s written approval, the data scope, the fallback while it is off, and the credential’s expiry | `INT-001` (building), `INT-014` (building) |
| **Release to production, or roll it back**<br>A rollback needs no second approval, because waiting for one costs more than the rollback can. It is audited the same. | seat `engineering` | seat `product` | no | The release record: CI green on the commit, the golden path run, the rollback rehearsed | `SRE-008` (building) |
| **Replay one dead-lettered domain event**<br>Approval binds one dead-lettered event to one consumer. The replay resets delivery state; it does not bypass the projector receipt or its idempotency guard. | seat `engineering` | seat `data` **and** seat `security` | yes | The failed event, the repaired cause, the consumer and projector version, the replay scope, and the rollback plan | `SRE-008` (building) |
| **Delete an institution’s data, or a student’s on their behalf**<br>A student’s own deletion, from their own account, needs nobody’s approval; this row is for deletion done for them. | role `data_steward` | seat `privacy` | no | The verified request, the retention class of each store touched, and the deletion certificate that will be issued | `LEG-004` (building) |
| **Change an AI provider, model or policy** | seat `product` | seat `security` **and** seat `privacy` | yes | The evaluation evidence from the G0–G5 gates, and the subprocessor register updated in the same change | `AI-001` (building), `AI-002` (building) |
| **Release controlled evidence to a reviewer** | seat `success` | seat `security` or seat `privacy` | no | The signed NDA, the named reviewer, the commit the packet was generated from, and the expiring link | `SEC-013` (building) |
| **Refund or credit above the threshold**<br>Plus checkout exists (D-128) on Stripe test keys and has refunded nothing. The row is here so the matrix is complete before a live payment, not because there is anything to refund yet. | role `business_admin` | seat `founder` | no | The billing record and the reason | `LEG-003` (building) |

## Data classification

| Class | Means | Search | Export | AI retrieval | Support access |
| --- | --- | --- | --- | --- | --- |
| **public** | Published on purpose; anyone may read it | indexed | self-service | allowed | open |
| **internal** | Company operations; staff with a reason | staff | approved | tenant-approved | open |
| **student-private** | What a student entered or built; theirs, shown to staff only under a grant | never | self-service | tenant-approved | grant |
| **education-record** | What an institution holds about a student; FERPA applies, and the institution decides | never | approved | tenant-approved | grant |
| **restricted** | Accommodations, safety, audit and anything whose disclosure harms a person; named grant, logged read | never | approved | never | named-grant |
| **credential** | Keys, secrets and tokens; never displayed, only rotated | never | never | never | never |

- **search**: Whether a console or site search may index it: for anyone, for staff with the capability, or not at all.
- **export**: Who may export it: the owner themselves, an approved request, or nobody.
- **ai**: Whether an AI feature may retrieve it: freely, only where the tenant approved that use, or never.
- **support**: What a support reader needs: nothing, the student’s grant, a named restricted grant, or no path exists.

### The records the platform holds

| Record | Class | Defined or governed by | Note |
| --- | --- | --- | --- |
| Public site pages and the status page | `public` | [`app/src/site/render.tsx`](../../app/src/site/render.tsx) | — |
| Customer commitment | `internal` | [`app/src/lib/ops/commitments.ts`](../../app/src/lib/ops/commitments.ts) | — |
| Support ticket | `internal` | [`supabase/support-tickets.check.sql`](../../supabase/support-tickets.check.sql) | An attachment from a student takes its own class, student-private at least; the ticket does not launder it. |
| Support access grant | `internal` | [`supabase/support-access.check.sql`](../../supabase/support-access.check.sql) | — |
| Role grant and its audit row | `internal` | [`supabase/role-grant-audit.check.sql`](../../supabase/role-grant-audit.check.sql) | — |
| A student’s plan, deadlines, notes and study material | `student-private` | [`RETENTION.md`](../../RETENTION.md) | — |
| Enrolment, grades and requirements an institution verified | `education-record` | [`docs/FERPA-COPPA-1EDTECH-READINESS.md`](../../docs/FERPA-COPPA-1EDTECH-READINESS.md) | — |
| Accommodation and anything shared for support | `restricted` | [`supabase/supportshares.check.sql`](../../supabase/supportshares.check.sql) | — |
| Audit event | `restricted` | [`RETENTION.md`](../../RETENTION.md) | Its own retention class: three years for role-grant, moderation and support reads (SEC-006). Reading the audit is itself audited. |
| Connector credentials, the LTI private key, function secrets | `credential` | [`SECURITY.md`](../../SECURITY.md) | — |

## What every page shows

The context bar, on every console page. The environment is a word and a
shape, never colour alone.

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

### Why can I see this?

Every sensitive record answers, beside the data:

| Field | Shows |
| --- | --- |
| **Basis** | The capability, from which role |
| **Tenant** | Whose data this is |
| **Scope** | The connector, cohort, ticket or object the grant covers |
| **Purpose** | The ticket, incident or change the read is for |
| **Expires** | When the basis ends |

### Customer impact first

Every incident, stale feed, failed sync, flag change and data-quality issue
answers these before its technical diagnosis:

- Who is affected, and at which tenant?
- Which workflow, and how many students or staff?
- What will they see, and does the official system still answer?
- Does the customer need telling, and has the status page said it?
- Is there a support article, and who owns the update?

### Every figure carries its provenance

A health or status figure shows: **Source**, **Time window**, **Environment**, **Owner**, **Last refresh**, **Evidence**, **Known limitation**. A figure typed into a file is a claim, not a measurement; the master register and the claims register are where claims live, with the file that shows each.

## Evidence freshness

The proof calendar says when each artifact is produced. This is what happens
as one approaches its expiry:

| Days before expiry | Action |
| --- | --- |
| 30 | The owning seat is notified, with the artifact and the claims that rest on it |
| 7 | A compliance alert to the security and privacy seats; the item is on the weekly operations review |
| Expiry | The artifact is marked superseded, leaves the procurement pack, and every public claim resting on it is flagged for the founder, product and privacy seats to reword or remove |

It applies to every record of [`docs/EVIDENCE-REGISTER.md`](../../docs/EVIDENCE-REGISTER.md) today,
and to every artifact under `docs/evidence/` once one is filed: HECVAT,
VPAT/ACR, penetration test, SOC report, access review, restore drill, AI
evaluation, vendor review, insurance certificate, subprocessor review,
policy review. The last step is the claim-to-evidence control: an expired
artifact takes the public claims resting on it with it, per [`ops/claims/README.md`](../claims/README.md),
and `claims.test.ts` refuses an “available” that rests on an expired record.

## Production rules

What the prototype could not hold, and what holds each now. `held` means a
test or check fails the build; `stated` means only this page does, yet.

### Audit events are written by the server, insert-only, by a writer separate from the application’s; nothing in a browser can add, edit or delete one.

*held.*

- [`supabase/role-grant-audit.check.sql`](../../supabase/role-grant-audit.check.sql) — The role-grant audit refuses update and delete to every role.
- [`app/src/lib/ops/boundaries.test.ts`](../../app/src/lib/ops/boundaries.test.ts) — No service-role credential reaches anything a browser loads.

### A high-risk action fails closed when its audit event cannot be written.

*held.*

- [`supabase/console-approvals.check.sql`](../../supabase/console-approvals.check.sql) — With the audit insert revoked inside a savepoint, console_act raises and leaves no grant, no action record and no status change; on the happy path the audit row’s seq precedes the effect.
- [`docs/operating-model/CHANGE-MANAGEMENT.md`](../../docs/operating-model/CHANGE-MANAGEMENT.md) — The change policy the function implements.

### Production access uses the operator’s own identity and grants. Role preview exists only in a sandbox with synthetic data. There is no “view as student”.

*held.*

- [`app/src/lib/ops/boundaries.ts`](../../app/src/lib/ops/boundaries.ts) — No fake production data, and no browser service-role credential — the two things impersonation would need.
- [`supabase/support-access.check.sql`](../../supabase/support-access.check.sql) — A support read needs a grant with a scope and an expiry, not a role.

### Illustrative institutions live in a demo tenant. A production console shows real customers to authorised staff, or “No production customers yet”.

*held.*

- [`app/src/lib/pagesdemo.test.ts`](../../app/src/lib/pagesdemo.test.ts) — The deployed site is the product; the demo is beside it and cannot be it again (TRUST-005).

### Every health and status figure is read from a control, a CI result, the database or a deployment, with its source, window, environment, owner, refresh, evidence and known limitation shown. A figure typed into a file is a claim, not a measurement.

*held.*

- [`app/src/lib/masterregister.test.ts`](../../app/src/lib/masterregister.test.ts) — Every register status cites the file that shows it, and the test refuses a status above what that kind of file can show.
- [`app/src/lib/ops/claims.test.ts`](../../app/src/lib/ops/claims.test.ts) — Every public claim names the rows and tests behind it, and the test refuses a word above theirs.

### Every record view names its classification, and search, export, AI retrieval and support access obey it.

*held.*

- [`app/src/screens/console.test.tsx`](../../app/src/screens/console.test.tsx) — Every customer record the console renders names its class from RECORD_KINDS and answers “Why can I see this?” with the ACCESS_BASIS fields.
- [`app/src/lib/integration/classification.ts`](../../app/src/lib/integration/classification.ts) — Field-level classes for integrated data; the console’s record classes are this page.

## The conversion

From prototype to control plane, in five steps, each against the rows it
would move. The register status is the one at the last re-read.

| Step | Today | Rows |
| --- | --- | --- |
| **1. Replace demo and browser-local state with authenticated backend data** | The console is a screen (app/src/screens/Console.tsx) opened only with console:operate on a real account; saved views and the last tab live in operator_preference, owner-only under RLS, never in the browser | `IAM-001` (tested), `PRG-006` (building), `PRG-008` (tested) |
| **2. Server-side RBAC, RLS, support grants and real tenant context** | Role grants, RLS on every table and support grants are tested, and the console reads them: the context bar shows the live grants, the open support windows, MFA freshness and the session’s expiry, from the server | `IAM-006` (tested), `IAM-007` (tested), `IAM-008` (tested), `IAM-010` (tested) |
| **3. Append-only server-side audit with integrity controls** | private.console_audit_event is hash-chained and insert-only, written by a separate writer role, sealed nightly into a signed manifest and re-verified; every read of it is itself an audit event | `SEC-006` (building) |
| **4. Every dashboard value from evidence, monitoring, contracts, tickets and integrations** | Registers are rendered from data and held to the tree; console_figures returns each figure with its source, window, owner, refresh, evidence and known limitation, and the billing figure says there is no billing (D-009) | `SRE-002` (building), `INT-014` (building), `PRG-002` (tested) |
| **5. Approval, segregation of duties and environment safeguards on every high-risk write** | approval_request and approval_decision enforce this matrix in the database: self-approval refused, two people where the row says so, fresh MFA, and console_act fails closed when its audit event cannot be written | `IAM-011` (designed), `SRE-008` (building) |

## From prototype to control plane

The fourteen things the prototype faked, what production needed instead, and
the files that hold each. `done` needs a test or a check among the holders
and every holder in the tree; the test refuses a row that is done by
assertion.

| Capability | In the prototype | Production replacement | Status | Held by |
| --- | --- | --- | --- | --- |
| **Saved table views, nav state** | Table views and the active tab kept in browser memory, lost on reload and belonging to nobody | Per-user preferences stored server-side: public.operator_preference, owner-only under RLS, read and written through PostgREST as the operator | done | [`supabase/migrations/20260929100000_console_control_plane.sql`](../../supabase/migrations/20260929100000_console_control_plane.sql) — The operator_preference table, keyed by subject and key, with owner-only policies on every verb<br>[`supabase/console-control-plane.check.sql`](../../supabase/console-control-plane.check.sql) — A second account cannot read or write another operator’s preference<br>[`app/src/lib/console/client.ts`](../../app/src/lib/console/client.ts) — loadPreferences and savePreference<br>[`app/src/screens/Console.tsx`](../../app/src/screens/Console.tsx) — The Views tab and the last tab, persisted through operator_preference, never localStorage<br>[`app/src/screens/console.test.tsx`](../../app/src/screens/console.test.tsx) — A saved view round-trips through the mocked table and nothing is written to the browser |
| **Operator identity**<br>SSO for operators is the institution SSO row (IAM-003); the console does not add a second sign-in. | A name typed into a header and a role picked from a menu | Supabase Auth with the account’s real identity; a privileged action needs fresh MFA (aal2 within fifteen minutes), asserted by private.assert_fresh_mfa on the server | done | [`supabase/migrations/20260929100000_console_control_plane.sql`](../../supabase/migrations/20260929100000_console_control_plane.sql) — private.mfa_fresh reads aal and amr from the JWT; private.assert_fresh_mfa raises “Fresh MFA required”<br>[`supabase/console-control-plane.check.sql`](../../supabase/console-control-plane.check.sql) — Both branches: a claim set with a fresh totp entry passes, one without aal2 or with a stale timestamp raises<br>[`app/src/components/MfaStep.tsx`](../../app/src/components/MfaStep.tsx) — Enrol TOTP and challenge/verify before a privileged action<br>[`app/src/components/MfaStep.test.tsx`](../../app/src/components/MfaStep.test.tsx) — The step is shown when the assurance level is not aal2, and clears when verification succeeds<br>[`app/src/lib/console/client.ts`](../../app/src/lib/console/client.ts) — mfaLevel, enrollTotp, challengeTotp, verifyTotp and sessionExpiry<br>[`app/src/lib/console/client.test.ts`](../../app/src/lib/console/client.test.ts) — Each wrapper calls the supabase-js auth.mfa method it names |
| **Roles and capabilities** | A role switcher in the header that changed what the page showed | Scoped role_grants with capability, scope and expiry, checked server-side; console:operate, approval:decide and breakglass:request are capabilities of public.app_capabilities. There is no role switching in production | done | [`supabase/migrations/20260929100000_console_control_plane.sql`](../../supabase/migrations/20260929100000_console_control_plane.sql) — The three capabilities and their role_capabilities rows; audit:read at platform scope for platform_admin<br>[`supabase/console-control-plane.check.sql`](../../supabase/console-control-plane.check.sql) — Each console capability is held by the roles the contract names and by nobody else<br>[`supabase/rolegrants.check.sql`](../../supabase/rolegrants.check.sql) — A grant has a scope, an expiry and an audited grantor<br>[`supabase/my-capabilities.check.sql`](../../supabase/my-capabilities.check.sql) — my_capabilities returns the live grants and only those<br>[`app/src/screens/Console.tsx`](../../app/src/screens/Console.tsx) — The Role field is the live grants from my_capabilities; there is no selector<br>[`app/src/screens/console.test.tsx`](../../app/src/screens/console.test.tsx) — The screen renders the granted roles and offers no way to change them |
| **Authorization** | The page hid buttons the chosen role should not see; the data was already in the browser | Server-side authorization, RLS and object rules on every request; the UI gate is a courtesy and never the authorization | done | [`supabase/rls-coverage.check.sql`](../../supabase/rls-coverage.check.sql) — Every table in public has RLS on and at least one policy<br>[`supabase/grants.check.sql`](../../supabase/grants.check.sql) — Every public function is on the allowlist, and anon holds nothing it should not<br>[`supabase/migrations/20260929100000_console_control_plane.sql`](../../supabase/migrations/20260929100000_console_control_plane.sql) — Every console function checks private.has_capability itself; definer functions pin search_path<br>[`supabase/console-control-plane.check.sql`](../../supabase/console-control-plane.check.sql) — A session without console:operate is refused by the function, not by the screen<br>[`app/src/screens/console.test.tsx`](../../app/src/screens/console.test.tsx) — Without the capability the screen is a Notice, never a demo |
| **Audit log** | An array in browser memory called an append-only chain | private.console_audit_event: server-written, insert-only, hash-chained, written only by the semester_audit_writer role, sealed nightly into a signed manifest, re-verified nightly, outside the retention sweep, and every read of it logged | done | [`supabase/migrations/20260929100000_console_control_plane.sql`](../../supabase/migrations/20260929100000_console_control_plane.sql) — The table, its triggers, the writer role, console_audit_write, the key, the manifest, seal and verify, and console_audit_read<br>[`supabase/console-control-plane.check.sql`](../../supabase/console-control-plane.check.sql) — Update and delete raise; the service role cannot insert directly; a plain session cannot call the writer; the sweep leaves the rows; a read writes audit.read first<br>[`supabase/scheduler.sql`](../../supabase/scheduler.sql) — The console-audit-integrity job at 03:23 seals yesterday and verifies the chain<br>[`app/src/lib/console/client.ts`](../../app/src/lib/console/client.ts) — loadAudit and auditStatus<br>[`app/src/screens/Console.tsx`](../../app/src/screens/Console.tsx) — The Audit view shows the chain status and says that every read is itself logged |
| **High-risk writes** | A confirmation dialog, then the write; the audit entry came after, if at all | public.console_act writes the audit event first and performs the effect in the same function body; if the event cannot be written the call fails and nothing else happens | done | [`supabase/migrations/20260929110000_console_approvals_and_break_glass.sql`](../../supabase/migrations/20260929110000_console_approvals_and_break_glass.sql) — console_act: audit through private.console_audit_write, then the duty’s effect, then the request is executed<br>[`supabase/console-approvals.check.sql`](../../supabase/console-approvals.check.sql) — With the audit insert revoked inside a savepoint the call raises and leaves no grant, no action record and no status change; on the happy path the audit seq precedes the effect |
| **Two-person approvals** | A second click by the same person | public.approval_request and approval_decision: a request routed to a different person’s session, self-approval refused on the server, two distinct approvers where the duty says so, fresh MFA on every decision | done | [`supabase/migrations/20260929110000_console_approvals_and_break_glass.sql`](../../supabase/migrations/20260929110000_console_approvals_and_break_glass.sql) — request_approval, decide_approval and the party check against private.party_held<br>[`supabase/console-approvals.check.sql`](../../supabase/console-approvals.check.sql) — Self-approval raises; a second decision by the same approver is refused by the key; a two-person duty stays pending after one approve<br>[`app/src/screens/Console.tsx`](../../app/src/screens/Console.tsx) — The Approvals view: request, decide, act, with PRODUCTION_WRITE_NOTICE under every production write and the duty’s evidence requirement shown<br>[`app/src/screens/console.test.tsx`](../../app/src/screens/console.test.tsx) — The notice and the evidence requirement are rendered for each duty |
| **Tenant, customer, commitment, contract data** | Illustrative customers in a JavaScript array | public.customer, customer_commitment and customer_contract, tenant-scoped under RLS, written only through operations and read by console_customers | done | [`supabase/migrations/20260929110000_console_approvals_and_break_glass.sql`](../../supabase/migrations/20260929110000_console_approvals_and_break_glass.sql) — The three tables, their policies and console_customers<br>[`supabase/console-approvals.check.sql`](../../supabase/console-approvals.check.sql) — A tenant:configure holder reads only their tenant; a browser session cannot write; a demo tenant is absent from the default read<br>[`app/src/lib/console/client.ts`](../../app/src/lib/console/client.ts) — loadCustomers<br>[`app/src/screens/Console.tsx`](../../app/src/screens/Console.tsx) — The Customers view: each record names its class per RECORD_KINDS and answers “Why can I see this?” per ACCESS_BASIS<br>[`app/src/screens/console.test.tsx`](../../app/src/screens/console.test.tsx) — Every rendered record carries its classification and the five access-basis fields |
| **Billing and reliability metrics** | Numbers typed into a file and styled as a dashboard | public.console_figures: each figure from a real query with the seven provenance fields; the billing figure says “not applicable” with its source (D-009), never a number | done | [`supabase/migrations/20260929100000_console_control_plane.sql`](../../supabase/migrations/20260929100000_console_control_plane.sql) — console_figures with the rows the control plane can read: audit, verification, grants, seats, support windows, schools, gateway health, billing<br>[`supabase/migrations/20260929110000_console_approvals_and_break_glass.sql`](../../supabase/migrations/20260929110000_console_approvals_and_break_glass.sql) — console_figures replaced with the approvals, break-glass, customer and contract rows added<br>[`supabase/console-control-plane.check.sql`](../../supabase/console-control-plane.check.sql) — Every row carries a source, a window, an owner seat and a refresh; billing is not applicable and cites D-009<br>[`supabase/console-approvals.check.sql`](../../supabase/console-approvals.check.sql) — The replaced function keeps every row of the first<br>[`app/src/screens/Console.tsx`](../../app/src/screens/Console.tsx) — The Figures view shows all seven FIGURE_PROVENANCE fields for each figure<br>[`app/src/screens/console.test.tsx`](../../app/src/screens/console.test.tsx) — No figure renders without its seven fields |
| **Support access** | A support role that could open any student’s record | Student-approved, case-scoped, time-bound grants with the session banner and a per-read audit; the console shows the open grant in its context bar | done | [`supabase/support-access.check.sql`](../../supabase/support-access.check.sql) — A support read needs a grant with a scope and an expiry, and each read is logged<br>[`app/src/lib/console/client.ts`](../../app/src/lib/console/client.ts) — openSupportGrants over the support_access_windows RPC<br>[`app/src/screens/Console.tsx`](../../app/src/screens/Console.tsx) — The Support access field: “None”, or the student, the ticket and when it ends<br>[`app/src/screens/console.test.tsx`](../../app/src/screens/console.test.tsx) — The bar reads None with no grant and the grant’s scope with one |
| **Break-glass** | A checkbox that widened the role for the session | public.break_glass_grant opened only by console_act on an approved two-person request, with a ticket, fresh MFA, an expiry no later than four hours, a review due after it, and a post-use review by someone else | done | [`supabase/migrations/20260929110000_console_approvals_and_break_glass.sql`](../../supabase/migrations/20260929110000_console_approvals_and_break_glass.sql) — The grant table, break_glass_active, close_break_glass and review_break_glass, each audited first<br>[`supabase/console-approvals.check.sql`](../../supabase/console-approvals.check.sql) — An expiry past four hours is refused; the subject cannot review their own grant; an unreviewed grant past its review blocks the next request<br>[`app/src/screens/Console.tsx`](../../app/src/screens/Console.tsx) — The Break-glass view: open grants, close, review<br>[`app/src/screens/console.test.tsx`](../../app/src/screens/console.test.tsx) — A grant renders with its expiry and review due, and the review control is not offered to its subject |
| **Evidence and claims** | A list of documents marked “current” | Evidence records with a produced date and a validity, whose state drives the claims register and the procurement pack: a claim resting on an expired record cannot stay “available” | done | [`app/src/lib/ops/evidence.ts`](../../app/src/lib/ops/evidence.ts) — EVIDENCE and evidenceState, using the escalation ladder above<br>[`app/src/lib/ops/evidence.test.ts`](../../app/src/lib/ops/evidence.test.ts) — Every record cites a file that states its date; the state is shown each side of each step; the real date leaves no expired record under an available claim<br>[`app/src/lib/ops/claims.test.ts`](../../app/src/lib/ops/claims.test.ts) — problems() names a claim that rests on an expired record<br>[`docs/EVIDENCE-REGISTER.md`](../../docs/EVIDENCE-REGISTER.md) — The rendered register<br>[`app/src/screens/Console.tsx`](../../app/src/screens/Console.tsx) — The Evidence view, from EVIDENCE and evidenceState |
| **Live operational command center** | A synthetic action queue whose fictional tenants, integrations, launch verdict and health cards could look production-ready | public.console_command_center: a fail-closed exception queue over current release evidence, approvals, break-glass, integrations, support and tenant rollout; an empty scoped queue is the only green state | done | [`supabase/migrations/20260930173030_console_command_center.sql`](../../supabase/migrations/20260930173030_console_command_center.sql) — The evidence-backed release gates, demo-aware operational unions and server-side console:operate refusal<br>[`supabase/console-command-center.check.sql`](../../supabase/console-command-center.check.sql) — A non-operator is refused, missing proof stays red, live exceptions appear, and demo tenants stay out by default<br>[`app/src/lib/console/client.ts`](../../app/src/lib/console/client.ts) — loadCommandCenter maps the RPC without caching or browser storage<br>[`app/src/lib/console/client.test.ts`](../../app/src/lib/console/client.test.ts) — The RPC name, demo switch and evidence boundary round-trip<br>[`app/src/components/console/CommandCenter.tsx`](../../app/src/components/console/CommandCenter.tsx) — The queue, severity counts, source, limitation and next safe step; GREEN only for zero rows<br>[`app/src/screens/console.test.tsx`](../../app/src/screens/console.test.tsx) — A missing restore proof renders NOT GO and no evidence; an empty live response alone renders GREEN |
| **Environment separation** | The word “Production” in the header of a page full of invented records | A separate demo tenant (schools.is_demo) with synthetic data, excluded from every console read unless asked for; the environment word comes from the deployment, and production never shows an illustrative record | done | [`supabase/migrations/20260929100000_console_control_plane.sql`](../../supabase/migrations/20260929100000_console_control_plane.sql) — schools.is_demo, and include_demo defaulting to false on every reader<br>[`supabase/console-control-plane.check.sql`](../../supabase/console-control-plane.check.sql) — A demo school’s rows are absent from the default read<br>[`app/src/lib/environment.ts`](../../app/src/lib/environment.ts) — environment() from the deployment’s variables, never from a setting; ENVIRONMENT_SHAPE is a word and a shape<br>[`app/src/lib/environment.test.ts`](../../app/src/lib/environment.test.ts) — Demo, Staging and Production from each variable, and never from anything an operator can change<br>[`app/src/lib/pagesdemo.test.ts`](../../app/src/lib/pagesdemo.test.ts) — The deployed site is the product; the demo is beside it (TRUST-005)<br>[`app/src/lib/demosplit.test.ts`](../../app/src/lib/demosplit.test.ts) — Demo data does not reach the production bundle<br>[`app/src/lib/ops/boundaries.test.ts`](../../app/src/lib/ops/boundaries.test.ts) — No fake production data and no browser service-role credential<br>[`app/src/screens/Console.tsx`](../../app/src/screens/Console.tsx) — The Environment field, as a word and a shape |

## Console views

What the console shows, one line each; [`docs/OPERATIONS-CONSOLE-MAP.md`](../../docs/OPERATIONS-CONSOLE-MAP.md) is the map.

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
