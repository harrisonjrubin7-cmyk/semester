# Operations roadmap

**As of** 2026-10-05 · **Base** `origin/main` `3bd382d` · **Status** a proposal, not a commitment; records no decision. This page is the program-level answer to the brief: backlog, first 25 actions, first 10 branches, three horizons, risks, and a readiness scorecard. It **reconciles with** (does not replace) [`docs/ops/OPERATIONS_CONSOLE_BACKLOG.md`](../ops/OPERATIONS_CONSOLE_BACKLOG.md) (phased console backlog P1-01…), [`docs/master/SEMESTER_MASTER_BACKLOG.md`](../master/SEMESTER_MASTER_BACKLOG.md), [`SEMESTER_EXECUTION_ROADMAP.md`](../master/SEMESTER_EXECUTION_ROADMAP.md) (ten-branch sequence) and [`SEMESTER_12_MONTH_EXECUTION_PLAN.md`](../master/SEMESTER_12_MONTH_EXECUTION_PLAN.md). Where they disagree on a fact, the source rows win.

> **Constraint that shapes everything.** One person holds every company seat; no customer, no signed pilot, 0 of 18 external evidence items closed; the paid institutional pilot is NO-GO. The roadmap is therefore ordered by *what makes a first design-partner engagement deliverable and safe*, not by what the brief lists. Time estimates are the author's rough sizing, not estimates by someone who will do the work.

## Where the brief's thirteen deliverables live

| # | Deliverable | Home |
| --- | --- | --- |
| 1 | Existing-state audit | [`SHARED_CONTROL_PLANE.md` §1](SHARED_CONTROL_PLANE.md#1-existing-state-audit-what-the-control-plane-already-is); per-OS state tables in the two OS pages; this page §0 |
| 2 | Canonical data and authority map | [`SHARED_CONTROL_PLANE.md` §2](SHARED_CONTROL_PLANE.md#2-canonical-data-and-authority-map) (links the generated master matrices) |
| 3 | Console and route map | [`OPERATIONS_COMMAND_CENTER.md` §2](OPERATIONS_COMMAND_CENTER.md#2-route-and-view-map); [`INSTITUTION_OPERATING_SYSTEM.md` §3](INSTITUTION_OPERATING_SYSTEM.md#3-route-model) |
| 4 | Role/capability matrix | [`ROLE_CAPABILITY_MATRIX.md`](ROLE_CAPABILITY_MATRIX.md) |
| 5 | Backlog | §2 below |
| 6 | First 25 actions | §3 |
| 7 | First 10 branches | §4 |
| 8 | Database/RLS/RPC plan | [`SHARED_CONTROL_PLANE.md` §5](SHARED_CONTROL_PLANE.md#5-database-rls-and-rpc-plan) |
| 9 | Screen/component plan | the two console catalogs (shared screen pattern, reuse list) |
| 10 | Test/security/accessibility plan | [`OPERATIONS_RELEASE_GATES.md` §4–6](OPERATIONS_RELEASE_GATES.md#4-test-plan) |
| 11 | SLO/observability | [`OPERATIONS_RELEASE_GATES.md` §7](OPERATIONS_RELEASE_GATES.md#7-slos-and-observability) |
| 12 | Risk register | §6 |
| 13 | 90-day / 12-month / 36-month | §5 |
| 14 | Readiness scorecard | §7 |

## 0. The state in one paragraph

A company console exists at `#/console` with the views in the console map: command center, approvals (request, decide, act), break-glass, audit, tenant operations, privacy requests, integration health, release & incidents, customers, figures, finance model, releases and flags (read-only), launch, readiness evidence, evidence, support (flag off), views. *(Corrected 2026-10-06 against `f48baf6e`: the first version of this page was written against `3bd382d` and omitted the tenant-operations, privacy, integration-health and release-incident views that landed in the meantime.)* The approval and audit database machinery is tested. **But:** the audit chain has never recorded a production row; `console_act` executes three of eleven duties; operator writes bypass approval on several (F-1); the domain outbox has no relay; there is no work-item, SLO, access-review or tenant-health table, no tenant directory or per-tenant 360 page, and no operator incident write path (`platform_incident` and its read exist); and the institution side is the `University` screen's tabs with no registrar or command-center operator view. Nearly every operational table has 0 rows. The brief's `/app/ops/*` and `/app/institution/:slug/*` routes cannot be built as written (hash routing, frozen navigation roots), so they are aliases.

## 1. Open decisions

None of these is made here. Each has a recommendation; each blocks something named.

| ID | Decision | Recommendation | Blocks |
| --- | --- | --- | --- |
| OD-1 | Adopt the console backlog's B-00…B-05 recommendations (Console views as routes, `/ops` aliases; `private.projection_*`; extend `domain_outbox_events`; poll then Broadcast; outbox retention 90 days) | Adopt | all of Phase 1 |
| OD-2 | Confirm freshness and availability SLOs (B-04; [`OPERATIONS_RELEASE_GATES.md` §7](OPERATIONS_RELEASE_GATES.md#7-slos-and-observability)) | Confirm as targets, offer no SLA | alert thresholds |
| OD-3 | Org-unit hierarchy table and inheritance rule for `has_capability` | Add `private.org_unit`; **no implicit inheritance**, explicit grants per unit | department-scoped roles |
| OD-4 | Discount floor and refund/credit two-person thresholds | Founder sets numbers; default every refund 2P | W-25, W-28 |
| OD-5 | A second approver while seats are `UNASSIGNED` (advisor or outside counsel as a named, scoped, audited approver) | Appoint before the first pilot | any 2P duty completing |
| OD-6 | Break-glass local-account fallback for SSO lockout | Document and rehearse | SSO go-live |
| OD-7 | Tenant-assignment table binding implementation and support staff to tenants | Add; capability alone is too broad | tenant-bound staff roles |
| OD-8 | Audit seal-key custodian and external write-once export of chain heads | Export heads to an external store before the first pilot | audit credibility |
| OD-9 | Fix F-1/F-5 in this program or separately (B-06) | Separately, first, approved branch | any "cannot bypass approval" claim |

## 2. Backlog

Tiers per the brief. Each row either is new work or points at the existing backlog row that already holds it, so nothing is listed twice. IDs: **OP-** new here; **P1-nn/T-nn** from the console backlog.

### P0 — the registration-readiness pilot and safe delivery

| ID | Item | Existing row |
| --- | --- | --- |
| OP-01 | Close direct-write bypass for release, tenant-policy, integration-config, ai-provider; executors in `console_act`; revoke grants (F-1) | B-06, T-02 |
| OP-02 | Retire `is_app_admin()` from offboarding and `schools_write` (F-5) | F-5 |
| OP-03 | **`my_capabilities()` break-glass fixed** (#1341). **INVOKER readers: approvals and break-glass log scoped** (#1348); **customers open**, needs the owner's decision on how `account_executive` / `customer_success` reach the console | P1-10 |
| OP-04 | Projection foundation: watermark, invalidation, rebuild, registry, `emit_domain_event`, claim/fail/replay, projector function, retention sweep | P1-01…P1-06, P1-09 |
| OP-05 | `private.work_item` + inbox/My Work read models | P1-07 |
| OP-06 | `ops_*` read RPCs with envelope (inbox, tenant overview, projections, executive) | P1-08, T-01 |
| OP-07 | Console views: Overview, Inbox, My Work, Tenants + 360, Projections, Audit explorer | Phase 2 |
| OP-08 | Customer 360, Pilot and Implementation tabs over existing tables | Phase 3 / master #8 |
| OP-09 | Impact-preview component and preview-hash binding in `console_act` | new |
| OP-10 | Scheduled `console_audit_verify`, alert on failure, external chain-head export | OD-8 |
| OP-11 | **Table and read landed** (`platform_incident`, `console_release_incidents`). Open: operator declare/update/resolve path behind ⊕`incident:command`, with threat model | Phase 4 |
| OP-12 | Release/rollout write path through approval; Rollout center | Phase 2 |
| OP-13 | **Integration health landed** (`console_integration_health`). Open: Migrations view | master #8 |
| OP-14 | Registrar registration-readiness console + institution command center | new |
| OP-15 | Advisor intervention/outreach with per-recipient consent and suppression check | new |
| OP-16 | Basic billing and entitlement operations (quote record, invoice record, entitlement set/lookup, renewal date); wire entitlement resolution out of shadow only with a decision | new |
| OP-17 | SSO/SCIM visibility for institution IT; HTTP SCIM endpoint | master gap #8 |
| OP-18 | Support tab staffing statement and enablement decision | `EXPERIENCE_FLAGS.supportTickets` |

### P1 — months 4–12

Academic operations (W-33, 35); student-success caseloads; student accounts (read-first) and payment-plan workflow; security/privacy/accessibility control centre with access reviews (⊕`access:review`); campus services; community/safety; career/employer; faculty grade release (⊕`grade-release`); governance/trust centre; customer health with explainable inputs; renewals; Finance forecast on a database; board reporting; vendor/subprocessor operations; risk register view over the five source registers; people access-lifecycle; AI evaluation/policy/incident console; Reliability/SLO center.

### P2 — months 12–36

Authoritative native registrar cutover tooling (dual run, cutover gate, legacy retirement); global configuration; developer-marketplace and partner operations ([`coo/08`](coo/08-marketplace-partner-trust-fulfillment.md)); advanced native finance and embedded finance *if* legal and payments review justify; multi-institution network, credential portability, lifelong-learner operations; predictive operations features with governance and human review; people operations beyond access lifecycle.

### P3 — not scheduled

Everything the brief names with no evidenced demand: alumni network at scale, employer revenue, partner channels beyond a pilot, a second native finance rail. Reviewed at each quarter's gate; promoted only on evidence.

## 3. First 25 implementation actions (dependency-ordered)

`←` names the actions that must be done first. Each action is one reviewable change that passes the standing gates; none starts without the main-check for the thing itself.

| # | Action | ← |
| --- | --- | --- |
| 1 | Owner decisions OD-1, OD-9 (and OD-5 scheduled) | — |
| 2 | Run the gates not run in Phase 0 and record the result in the release-evidence register. **Run 2026-10-06 on `3f70295`:** `npm run build` exit 0; `npm run test:shuffle` (seed `1791246656762`) 1445 files passed, 1 skipped, 23,247 tests passed, 69 skipped, 214 s. One green shuffle run is weak evidence for the timing class of failure (`CLAUDE.md`); `src/rootunmount.test.ts` is the guard. **Still not run:** secret scan, `supabase/check.sh` (needs Postgres 17), advisor re-read | — |
| 3 | **Partly landed** ([`SEMESTER_RPC_EXPOSURE_CLASSIFICATION.md`](../master/SEMESTER_RPC_EXPOSURE_CLASSIFICATION.md), #1319 era): 279 definer functions, 0 anon-executable, 7 sensitive RPCs and 4 with no visible gate read by hand, one low lead (`kill_switch_engaged`, R-2). **Open:** R-3 (268 bodies unread, 207 authenticated-executable), R-4 (33 public no-policy tables), and the R-2 fix (migration test on a dev branch first) | 2 |
| 4 | **Done for `my_capabilities()` (#1341) and for approvals/break-glass reads (#1348).** Open: the customers readers (owner decision), and T-04 (break-glass expiry removes access; overdue review surfaced) | 3 |
| 5 | Executors for the eight duties without one (`tenant-policy`, `release`, `integration-config`, `ai-provider`, `evidence-release`, `data-deletion`, `refund`, `support-access`), one duty at a time, audit-first | 1, 4 |
| 6 | Revoke the direct write grants those duties bypassed; T-02 green per duty | 5 |
| 7 | Replace `is_app_admin()` in offboarding/`schools_write` with capability checks (F-5) | 4 |
| 8 | Projection migration: watermark, invalidation, rebuild run, registry; additive columns on `domain_outbox_events` | 1 |
| 9 | `private.emit_domain_event` with payload deny-list and hash | 8 |
| 10 | Claim/complete/fail/dead-letter/replay functions with the SQL checks | 9 |
| 11 | `ops-projector` Edge Function and scheduler entry (follow `support-reply-notify`) | 10 |
| 12 | Producers in the same transaction: approvals, rollout, support severity, kill switch | 6, 11 |
| 13 | `private.work_item` + producers; inbox and tenant-health projections | 12 |
| 14 | `ops_operations_inbox`, `ops_tenant_overview`, `ops_projection_dashboard` with T-01 checks | 13 |
| 15 | Console views: Overview, Inbox, My Work, Projections (registered in `VIEWS`, nav registry, screen governance; `npm run registers`) | 14 |
| 16 | Tenant directory and Tenant 360 (read-only); first action "request lifecycle transition" as an approval | 15 |
| 17 | Customer 360, Pilot and Implementation tabs over `customer`, `tenant_rollout`, `success_plans` | 16 |
| 18 | Impact-preview component and server-side preview-hash binding | 5 |
| 19 | Audit explorer with scoped search, export as controlled read; scheduled chain verification and alert; external chain-head export (OD-8) | 15 |
| 20 | ⊕`incident:command` migration with threat model; operator declare/update/resolve path (the `platform_incident` table and read already landed) | 15 |
| 21 | Release and Rollout center: write path through approval, kill-switch drill recorded as evidence | 6, 15 |
| 22 | Migrations tab in Console (Integration health landed); institution IT integration visibility | 15 |
| 23 | Institution command center (University tab) on the shared work item; registrar registration-readiness view; load profile run | 14, 22 |
| 24 | Advisor outreach with per-recipient consent/suppression preview | 18, 23 |
| 25 | Basic billing and entitlement operations: quote record, invoice record, entitlement set/lookup, renewal date, with W-25..27 and F-gate | 17, 18 |

Actions 1–2 can start today; 3–7 are the security closure that makes every later claim true; 8–15 are the foundation; 16–25 are the consoles.

## 4. First 10 branches

Names follow the existing sequence where one exists (`SEMESTER_EXECUTION_ROADMAP.md` branches 2, 6–9) so no one renames a branch someone else is planning; the two competing sequences (that file and `docs/handoff/execute/08-ops-command-center.md`) are reconciled here by *using the master one*.

| # | Branch | Scope | Actions | Depends on |
| --- | --- | --- | --- | --- |
| 1 | `audit/rpc-exposure` | **Read pass landed**; remaining: R-3 bodies, R-4 tables, R-2 fix with migration test | 2–3 | — |
| 2 | `fix/ops-capability-defects` | **Landed in two PRs** (#1341, #1348): `my_capabilities()` break-glass; approvals and break-glass reads. Remaining: customers readers, T-04 | 4 | 1 |
| 3 | `fix/ops-approval-bypass` | duty executors, grant revocation, `is_app_admin()` retirement, T-02 | 5–7 | 2, OD-9 |
| 4 | `feat/ops-projection-foundation` (= master `feat/cqrs-projection-foundation`) | projection tables, emit helper, claim/replay, projector, producers | 8–12 | 3 |
| 5 | `feat/ops-read-models-and-inbox` | `work_item`, `ops_*` inbox/tenant/projection RPCs | 13–14 | 4 |
| 6 | `feat/ops-command-center-p0` | Console views: Overview, Inbox, My Work, Projections, Audit explorer | 15, 19 | 5 |
| 7 | `feat/ops-tenant-customer-360` (= master `design/ops-console-p1`) | Tenant/Customer 360, Pilots, Implementation, Integrations/Migrations tabs | 16–17, 22 | 6 |
| 8 | `feat/ops-incident-release` (= master `feat/ops-incident-slo-access-review`, split) | incident table/capability, Release and Rollout center, impact preview | 18, 20–21 | 6 |
| 9 | `feat/institution-registration-readiness` | institution command center, registrar readiness, advisor outreach | 23–24 | 5, 7 |
| 10 | `feat/ops-billing-entitlements-p0` | quote/invoice record, entitlement ops, renewal date | 25 | 7, 8 |

Each branch: base SHA declared, owned files and migrations listed, overlap check against open PRs (open PRs such as the design-doc draft #1304 overlap the design half of the program), evidence, rollback, claim and activation impact; migrations on a dev branch first; production changes need explicit owner confirmation per step; a decision record `D-<pull request number>.md` after the PR is opened.

## 5. Roadmaps

Gate-led, not date-led; the dates are the earliest the sequence allows if one person works it, and **slip when a gate fails**.

### 90 days (to the end of 2026)
- Decisions OD-1…OD-9 made or scheduled. Security closure (branches 1–3) merged and the T-02 claim earned or explicitly withheld.
- Projection foundation (branch 4) and inbox (5) merged; first real audit row produced, sealed, verified, and recorded as evidence.
- Command center views (6) and Tenant/Customer 360 (7) over the *founder's own test tenant* — the only honest data until a customer exists.
- Registrar readiness console and institution command center (9) behind a flag, load profile run against the registration-day target.
- A named second approver (OD-5) and a staffing statement for support, so a two-person duty can complete and the support tab can be enabled.
- Exit test: a design partner could be shown the console, the audit trail and the approval flow **with real rows from a real, if internal, tenant**, and every figure shown is labelled with its source and freshness.

### 12 months
- Branches 8 and 10: incident, release, billing and entitlement basics. Full academic operations (W-33, 35), student success caseloads, student accounts read-first, security/privacy/accessibility control centre with access reviews, community and campus operations, career operations, company revenue, customer-success, finance forecast, board reporting, vendor operations, people access lifecycle, AI evaluation console.
- First external evidence items closed (independent security assessment, accessibility conformance review, counsel engagement) — these, not documents, move readiness.
- First design-partner pilot operated end to end on the consoles; outcome figures, from verified sources only, feed the renewal conversation.

### 36 months
- Authoritative native registrar cutover tooling, per-domain, gate by gate, with a retained dual-run option and legacy retirement only on evidence.
- Global configuration, marketplace/partner operations and certification, institution network, credential portability and lifelong-learner operations, native predictive operations features with governance and human review.
- Advanced native finance and embedded finance only if legal and payments review justify it; otherwise stay on bank rails with operations visibility.
- Operating-system ownership transfers from founder to a team ([`coo/11`](coo/11-founder-to-team-transition.md)): every seat staffed, independent review routine, SLAs offered because alerting reaches people.

## 6. Risk register

Additive rows for the operations program. They are **proposals to add upstream** to [`SEMESTER_RISK_REGISTER.md`](../master/SEMESTER_RISK_REGISTER.md) (MR-01…MR-32), not a sixth register. L = likelihood, I = impact (H/M/L), the owner is a seat.

| ID | Risk | L | I | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- |
| OR-01 | Operators bypass approval through direct writes while screens claim they cannot | H | H | OP-01, T-02; withhold the claim until green | security |
| OR-02 | Audit chain has never run in production; first real use reveals a gap | H | H | OP-10; first audited action as a gate; verification on a schedule | operations |
| OR-03 | One person holds every seat; two-person duties cannot complete or are bypassed | H | H | OD-5; the product blocks rather than bends; self-review labelled | founder |
| OR-04 | `console:operate` as a platform-wide read key leaks amounts or content | M | H | second domain capability; T-01(c); fix INVOKER readers | security |
| OR-05 | A second inbox/queue is built for the institution side, forking truth | M | M | single `work_item`; review rule in the catalogs | product |
| OR-06 | Route sprawl: `/app/ops` and `/app/institution` added as new roots | M | M | aliases only; `donotbuild.test.ts` | engineering |
| OR-07 | Stale or unknown data presented as live in an executive or registrar view | M | H | gate E; `unknown` rule; freshness classes | product |
| OR-08 | Registration-day load exceeds the read path | M | H | gate D; flag; cache policy | engineering |
| OR-09 | Outbox with no relay: events accumulate; projections silently stale | H | M | OP-04; dead-letter depth SLO; watermark lag alert | engineering |
| OR-10 | Alert that reaches no one gives false assurance | H | H | label "no alerting" until a named human acknowledges a test page | operations |
| OR-11 | Entitlement resolution stays in shadow; features sold are not enforced (or the reverse) | M | H | explicit decision before enforcing; entitlement ≠ flag | product |
| OR-12 | Institutional billing built before legal and payments review | L | H | gate F, G; read-first, bank rails own funds | finance |
| OR-13 | Student content reachable by a company role through a new console | L | H | `company-roles-student-data.check.sql` stays exact; gate P | privacy |
| OR-14 | Counsel not engaged: retention, DSR and contract surfaces ship on unreviewed policy | H | H | gate G blocks; engage counsel before P1 data-rights console | privacy |
| OR-15 | Two role vocabularies diverge (69 DB roles vs 10 gateway roles) | M | M | new consoles use DB roles; resolve ADR-0002 | engineering |
| OR-16 | Counts disagree across docs (capabilities 84 vs 96, tables 230–353, definers 151–269) so a claim cites the wrong one | H | M | regenerate from the catalog and cite the render; do not hand-copy figures | operations |
| OR-17 | Duplicate work across concurrent sessions (the repository's own recurring failure) | H | M | main-check first; branch declares overlap; open PRs reviewed | engineering |
| OR-18 | Scope: thirty-three consoles with no customer; building breadth before a pilot | H | H | the P0 line; no P1 work without a signed design partner or an owner decision | founder |
| OR-19 | Public claim exceeds evidence ("native OS", "audit-ready") | M | H | claims register; this program's claim ceilings | trust |
| OR-20 | Seal-key custody is one person | M | M | OD-8 external chain-head export | security |

## 7. Readiness scorecard by domain

Scale (evidence, not effort): **0** none · **1** documented only · **2** built and tested, not operated · **3** operated with real records · **4** independently verified. Scores are the author's reading of the repository on the base SHA; each is a claim a reviewer can contest by pointing at the evidence column. **No domain scores above 2**, because nothing has been operated and nothing independently verified; that is the finding, and a scorecard that said otherwise would be the failure mode this program exists to prevent.

| Domain | Score | Evidence for the score | Largest gap |
| --- | --- | --- | --- |
| Tenant hierarchy | 1 | `schools`, columns, matrix; no hierarchy table | org unit, assignment |
| Identity/SSO/SCIM | 2 | policy tables, SCIM tables, gateway, runbooks | HTTP SCIM, a named tenant |
| Roles/capabilities/delegation | 2 | `has_capability`, grants, checks, break-glass | defects §5 of the matrix; delegation checks |
| Policy/workflow engine | 2 | config versions, workflow versions, primitives | engines on in-memory stores |
| Flags/cohorts/kill switches | 2 | tables, rollout, kill switch | approval bypass (F-1), read-only tab |
| Consent/retention/legal holds | 2 | sweeps, holds, DSR RPCs, checks | counsel, live proof |
| Integration/migration factory | 2 | registry, mappings, reconciliation, dead letter | live adapters, authoritative switch |
| AI governance | 2 | policy, content-free audit, kill switch | approved evaluation |
| Audit/evidence/risk | 2 | immutable chains, console view | 0 production rows; five registers |
| Reliability/incident/rollback | 1–2 | TS playbooks, notices, `platform_incident` + evidence-derived read | SLO tables, operator write path; alerts reach no one |
| Portability/offboarding | 2 | offboarding + undo, export | legacy admin gate; exercise |
| Operations Command Center | 2 | console views incl. tenant operations, privacy, integration health, release & incidents; approvals, break-glass, audit | inbox, per-tenant 360, projections |
| Executive (inst.) | 1 | `Operations` tab skeleton | verified metrics |
| Academic ops | 1–2 | Configuration Studio, workflows | operator surfaces |
| Registrar | 1 | student side built, operator side missing | readiness console |
| Faculty/teaching | 1 | gradebook, design docs | grade release |
| Student success | 1–2 | campaign manager, design | caseload, consent-aware outreach proof |
| Student accounts | 1–2 | component, tables | operated ledger, payment review |
| Campus services | 1 | Services tab | operator view |
| Community/safety | 2 | moderation screen, SOPs, audit | staffed escalation |
| Career/alumni/employer | 1 | docs | operator console |
| IT/identity (inst.) | 2 | control/connections tabs | SCIM, access review |
| Governance/trust | 2 | trust room, DSR, holds | counsel, independent review |
| Implementation | 2 | modules, migration, playbooks | a real tenant |
| Corporate governance | 1 | templates | entity facts unconfirmed |
| Product/engineering | 2 | release evidence, flags | rollout write path |
| Trust/security/privacy/accessibility | 1–2 | trust docs, registers | independent assessment, conformance report |
| Revenue operations | 1 | tables, playbooks | 360, quotes, a customer |
| Customer implementation/success | 1–2 | rollout, plans, playbooks | operated pilot |
| Finance operations | 1–2 | Stripe path, ledger tables, draft model | institutional billing, real numbers |
| Legal/vendor operations | 1 | register docs | no DPAs, no vendor reviews |
| People operations | 0–1 | hiring schedule | access lifecycle |

**What would move a score:** 2→3 needs a real record (the founder's internal tenant counts as a rehearsal, not as a customer); 3→4 needs an external reviewer. The 90-day exit test is the first 2→3 for four domains (audit, approvals, command center, tenant 360).

## Contradictions to resolve

These disagree across existing documents and were found while writing this program. They are listed, not resolved, because the resolution is a regeneration or an owner choice. Capabilities: 84 (migration render) vs 96 (live). Roles: 69 DB vs 51 in the design PDFs vs 10 gateway roles. Tables: about 230, 321+31, 348, 353. Definer functions callable by authenticated: 151, 180, 205, 207, 269. No-policy tables: 45 vs 63. Screens: 589 vs 673. The decision log "closed at D-160" while `docs/decisions/` holds D-1011…D-1303. The Command Center is "Built" in one master page and "Native but incomplete / Not ready" in another. Open-PR and branch counts differ by page. Four decision-rights vocabularies. Two PDFs the Phase 0 reconciliation names are not attached to the repository.
