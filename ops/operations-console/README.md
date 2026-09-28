# Operations console controls

<!-- Rendered from app/src/lib/ops/console.ts by console.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

There is no operations console yet. This is the policy the one that gets
built will read: who may approve what, which records carry which class,
what every page shows, what happens when evidence goes stale, and the lines
a prototype in a browser could not hold. Written as data first so that a
test holds it and a screen cannot quietly re-decide it.

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
| **Delete an institution’s data, or a student’s on their behalf**<br>A student’s own deletion, from their own account, needs nobody’s approval; this row is for deletion done for them. | role `data_steward` | seat `privacy` | no | The verified request, the retention class of each store touched, and the deletion certificate that will be issued | `LEG-004` (building) |
| **Change an AI provider, model or policy** | seat `product` | seat `security` **and** seat `privacy` | yes | The evaluation evidence from the G0–G5 gates, and the subprocessor register updated in the same change | `AI-001` (building), `AI-002` (building) |
| **Release controlled evidence to a reviewer** | seat `success` | seat `security` or seat `privacy` | no | The signed NDA, the named reviewer, the commit the packet was generated from, and the expiring link | `SEC-013` (building) |
| **Refund or credit above the threshold**<br>No billing exists (D-009). The row is here so the matrix is complete before it does, not because there is anything to refund. | role `business_admin` | seat `founder` | no | The billing record and the reason | `LEG-003` (building) |

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

It applies to every artifact under `docs/evidence/`: HECVAT, VPAT/ACR,
penetration test, SOC report, access review, restore drill, AI evaluation,
vendor review, insurance certificate, subprocessor review, policy review.
The last step is the claim-to-evidence control: an expired artifact takes
the public claims resting on it with it, per [`ops/claims/README.md`](../claims/README.md).

## Production rules

What the prototype could not hold, and what holds each now. `held` means a
test or check fails the build; `stated` means only this page does, yet.

### Audit events are written by the server, insert-only, by a writer separate from the application’s; nothing in a browser can add, edit or delete one.

*held.*

- [`supabase/role-grant-audit.check.sql`](../../supabase/role-grant-audit.check.sql) — The role-grant audit refuses update and delete to every role.
- [`app/src/lib/ops/boundaries.test.ts`](../../app/src/lib/ops/boundaries.test.ts) — No service-role credential reaches anything a browser loads.

### A high-risk action fails closed when its audit event cannot be written.

*stated.*

- [`docs/operating-model/CHANGE-MANAGEMENT.md`](../../docs/operating-model/CHANGE-MANAGEMENT.md) — The change policy the console will implement; no code holds this yet.

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

*stated.*

- [`app/src/lib/integration/classification.ts`](../../app/src/lib/integration/classification.ts) — Field-level classes for integrated data; the console’s record classes are this page.

## The conversion

From prototype to control plane, in five steps, each against the rows it
would move. The register status is the one at the last re-read.

| Step | Today | Rows |
| --- | --- | --- |
| **1. Replace demo and browser-local state with authenticated backend data** | Supabase Auth and the invite-only beta exist; staff surfaces are tabs of the University screen behind build-time flags | `IAM-001` (tested), `PRG-006` (building), `PRG-008` (tested) |
| **2. Server-side RBAC, RLS, support grants and real tenant context** | Role grants, RLS on every table and support grants are tested; no console reads them | `IAM-006` (tested), `IAM-007` (tested), `IAM-008` (tested), `IAM-010` (tested) |
| **3. Append-only server-side audit with integrity controls** | Grants, moderation, support reads and gateway actions are audited; there is no unified event schema or tamper-evident export | `SEC-006` (building) |
| **4. Every dashboard value from evidence, monitoring, contracts, tickets and integrations** | Registers are rendered from data and held to the tree; monitoring and connector health are behind flags | `SRE-002` (building), `INT-014` (building), `PRG-002` (tested) |
| **5. Approval, segregation of duties and environment safeguards on every high-risk write** | This page, and the change-management policy; nothing enforces the matrix yet | `IAM-011` (designed), `SRE-008` (building) |
