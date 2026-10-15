# Institution Operating System

**As of** 2026-10-05 · **Base** `origin/main` `3bd382d` · **Status** proposal; records no decision. Per-console dossiers: [`INSTITUTION_CONSOLE_CATALOG.md`](INSTITUTION_CONSOLE_CATALOG.md). Shared foundations: [`SHARED_CONTROL_PLANE.md`](SHARED_CONTROL_PLANE.md).

> **Claim ceiling.** No institution is a customer, no pilot is signed, and the motion decision is: individual acquisition CONDITIONAL GO, design-partner pilot GO for non-activation engagement only, paid institutional pilot NO-GO ([`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md)). This document says what an institution's operators would use. It is not a statement that any of it is operated.

## 1. What it is

The Institution OS is the administrative layer *behind* the student-facing Education OS: the screens a registrar, advisor, student-accounts officer, IT administrator or privacy officer uses to run their part of a campus on the same records the student sees. Three rules from the brief decide every design question:

1. **One graph.** Each console reads the same canonical entities and policy system. A console that copies records, or carries its own authorization logic, is a defect, not a feature. (The repository's rule is "connect first, replace by domain": [`UNIVERSITY-OS-ARCHITECTURE.md`](../UNIVERSITY-OS-ARCHITECTURE.md).)
2. **Native does not mean authoritative.** Semester owns the experience, workflow, policy, audit and migration path. The SIS stays the record of authority until a domain passes its replacement gate ([`SEMESTER_DOMAIN_REPLACEMENT_GATES.md`](../master/SEMESTER_DOMAIN_REPLACEMENT_GATES.md)); bank rails move money; a campus-card vendor supplies card events; model providers remain compute.
3. **Capabilities, not an admin role.** Role + tenant scope + organisational scope + resource relationship + capability grant + policy + consent = a decision, evaluated in the database. A route never decides.

## 2. What exists today

The institution console is the **University** screen (`app/src/screens/University.tsx`), whose tabs come from `tabsFor(verified)`: capability-gated tabs appear only when the signed-in account holds the capability, and several sit behind `EXPERIENCE_FLAGS`. Components are in `app/src/components/institutional/`. An HTTP gateway exists at `app/api/institution/[...path].ts` (`/records`, `/actions/prepare|commit|reconcile`, `/status`, SCIM) over `packages/platform` primitives.

| Brief console | What exists | State | Tier |
| --- | --- | --- | --- |
| Executive | `Operations` tab (`outcomes:read`), `OperationsStudio`; `lib/institution-ops.ts` says nothing populates the verified list on the client | Skeleton; no verified metric | P1 (the dashboard of "only verified, labelled metrics" is P0 in the brief's first 90 days but needs figures that have a source) |
| Academic operations | `Academic record`, `Configuration` (Configuration Studio, two-person publish), `Workflows`, `PolicySimulator` | Partial | P1 |
| Registrar | `Registration.tsx`, `Registrar.tsx` are **student-facing**; `Records` tab and `RecordLedger`; add/drop windows | Student side built; **operator side missing** | **P0** (registration readiness) |
| Faculty/teaching | `Gradebook.tsx`, faculty course studio design | Partial; grade-release controls missing | P1 |
| Student success | `CampaignManager` (outreach), advisor meeting mode design | Partial | P0 slice (advisor intervention/outreach), full P1 |
| Student accounts | `StudentAccounts` tab and component | Partial; payment plans, holds, refunds not operated | P1 |
| Campus services | `Services` tab | Partial | P1 |
| Community/safety | `Moderation.tsx`; `CAMPUS-MODERATION-SOP.md` | Partial | P1 |
| Career/alumni/employer | docs and student-side only | Missing as an operator console | P1 (career), P2 (alumni network) |
| IT/identity | `Control`, `Connections`, `Integrations` (flag-gated); SSO policy tables | Partial | P0 slice (SSO/SCIM visibility) |
| Governance/trust | `Trust` tab, `TrustDashboard`; privacy, DSR, holds in Console/Data | Partial | P1 |
| Implementation | `Modules` (`tenant:configure`), `Migration`, `Configuration` | Partial | **P0** (shared with the company implementation tab) |
| Institutional command center | none | **Missing** | **P0** (a scoped inbox + approvals + exceptions, institution-side) |

## 3. Route model

The brief proposes `/app/institution/:tenantSlug/{overview,academic-operations,registrar,…}`. The repository cannot take that shape as written: routing is hash-based (`app/src/lib/route.ts`), and navigation roots are frozen (`docs/DO-NOT-BUILD.md` rule 1, `donotbuild.test.ts`). The same reconciliation the company console took (B-00 in [`OPERATIONS_CONSOLE_BACKLOG.md`](../ops/OPERATIONS_CONSOLE_BACKLOG.md)) is adopted:

- Institution consoles are **tabs of `University`** (`#/university/<console>`), added through `Screen`, `screens.tsx`, `nav.ts`, `screen-governance.ts`, `nav.registry.test.ts`, then the registers.
- The brief's paths are documented as **aliases**, not routes: `/app/institution/:tenantSlug/registrar` ⇒ `#/university/registrar`. A new root needs portfolio approval and is not requested here.
- **The tenant is never read from the URL.** The server derives it from membership (`app/server/institution/membership.ts`); a slug, if ever shown, is a label. A user in two tenants selects one in the context bar, and the selection is a server-validated session value.

The context bar on every institution console reuses the company console's: environment (word + shape), tenant, operator, roles in force, MFA freshness, session expiry, support access in force. No preview-as: `InstitutionalPreviewBar` personas are presentation only and stay labelled so.

## 4. Tenant isolation

Defence in depth, each layer independently enforcing tenant scope ([`packages/platform/src/isolation/layers.ts`](../../packages/platform/src/isolation/layers.ts)):

1. **Database.** RLS on every tenant table; `has_capability` with exact scope; no cross-tenant read for a platform holder without the second, domain capability.
2. **RPC.** Definer functions with `search_path = ''` and an in-body check; registered in `definerregister.ts`.
3. **Gateway.** `assertSameTenant` on every command; read-only switch.
4. **Storage and exports.** Path prefix per tenant; an export is a controlled read, audited.
5. **Client.** Presentation only; the console test asserts nothing console-related reaches browser storage.

Per-screen requirement: the five checks in the permission matrix §4 (no grant → `42501`; school A cannot read school B; platform holder with only `console:operate` gets no amounts or content; redaction deny-list; sensitive-read audit event).

## 5. Priorities

**P0 — the registration-readiness pilot.** The operating sequence must let a registrar and an advisor run the pilot and let Semester deliver it safely:

1. Tenant hierarchy, membership, roles, capabilities (shared).
2. Institution configuration: modules, modes, flags, kill switches (exists: `Modules`, `Configuration`; fix F-1 for the write path).
3. Registrar console for registration readiness: windows, holds visibility, section capacity and waitlist, readiness gaps by cohort, with each figure labelled source/authority/freshness. Student-facing counterpart is `Registration.tsx` and [`REGISTRATION-DAY-MODE.md`](../REGISTRATION-DAY-MODE.md).
4. Advisor/student-success intervention and outreach (`CampaignManager` plus consent-aware outreach rules).
5. Executive overview with only verified, labelled metrics (a metric with no source renders `unknown`).
6. Institution command center: a scoped version of the company inbox (§ [`OPERATIONS_COMMAND_CENTER.md`](OPERATIONS_COMMAND_CENTER.md#institution-command-center)).
7. Integration visibility for IT: sync status, mapping version, freshness, exceptions (read-only).
8. Basic billing and entitlement view for the institution's own plan.

**P1** — full academic operations, student success caseloads, student accounts and payment plans, campus services, community/safety, career/employer, governance/trust centre, grade-release controls. **P2** — authoritative registrar cutover tooling, global configuration, institution network, lifelong learning. P3 is everything the brief names with no customer demand evidenced.

## 6. Authority during transition

| Domain | Authority today | Native role | Gate to change |
| --- | --- | --- | --- |
| Student record, registration, grades | SIS | Observe, explain, workflow around | Domain replacement gate + dual run + counsel |
| Charges, payments | Institution bursar / bank rails | Operations view, payment-plan *workflow*, receipts | Payments and legal review (brief: "if justified") |
| Identity | Institution IdP | Membership and capability | none; IdP stays authoritative for attributes |
| Campus services events | Campus-card / booking vendor | Service experience | Per vendor |
| AI | Model provider | Policy, audit, kill switch | n/a |

Every figure and record in an institution console carries its authority label; a stale or unknown source blocks language such as "live" or "connected" ([`operational-control-plane.md`](operational-control-plane.md)).

## 7. Commercial and customer-success impact

The Institution OS is what makes a pilot deliverable by a company of one: the implementation console is the product's own onboarding tool. It lowers implementation hours, shows the buyer proof (Governance/Trust, audit), and generates the outcome figures the renewal depends on ([`docs/commercial/CUSTOMER-SUCCESS-PLAYBOOK.md`](../commercial/CUSTOMER-SUCCESS-PLAYBOOK.md)). The honest gating fact: with no customer there is nothing to measure; the first operated console is the first source of real figures.
