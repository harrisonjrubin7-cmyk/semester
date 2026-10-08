# Implementation guide

> **Type:** runbook · **Audience:** implementers, institution-admins · **Owner:** `success` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/institution-guides.test.ts`

This runbook gives the order of operations for taking one institution from signed scope to a limited pilot, who does each step, and what you can check at each one; stop reading if you want to know whether a live institutional launch is approved, because it is not.

**Status:** designed for a bounded pilot beside existing systems, and not cleared to run one; no institution has been activated; the gateway runs against a sandbox adapter. In the truth table's words the institution gateway is `MOCK_DEMO`, tenancy and roles are `IMPLEMENTED_NOT_RELEASED`, and no production adapter exists, so every real service answers 503. Nothing here has been run with a real institution. It has not been rehearsed by a second person either.

<!-- status: Institution gateway (records/actions/AI) = MOCK_DEMO -->
<!-- status: Tenants, memberships, roles, scopes = IMPLEMENTED_NOT_RELEASED -->
<!-- verdict: council=NO-GO decision=2026-10-03 -->
<!-- capabilities: ai:configure -->
<!-- phases: Commercial and governance readiness | Tenant and identity foundation | LMS, SIS and source mapping | Course migration and LMS interoperability | Pilot configuration and readiness | Limited pilot launch | Pilot conversion decision | Production expansion -->
<!-- raci-source: app/src/lib/governance/rollout.ts -->
<!-- workstreams: Contract/DPA | Tenant configuration | SSO/identity | SIS integration | LMS/LTI integration | Course migration | AI policy | Accessibility | Student launch | Support | Outcome measurement | Production decision -->
<!-- states: directory, requested, claimed, security_review, sandbox_uat, pilot_read_only, pilot_write_enabled, production_limited, production_active, expansion, paused, suspended, offboarding, archived -->

## Where the decision stands

As written on 2026-10-03 in [`GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md): a design-partner pilot is GO / GREEN for non-activation engagement only (discovery, synthetic demos, evidence exchange, conditional scoping), and a paid institutional pilot is NO-GO / RED. [`LAUNCH-READINESS-COUNCIL.md`](../../LAUNCH-READINESS-COUNCIL.md) gives `Current verdict: NO-GO`. Until a signed GO exists, use this guide for planning and for work on synthetic data. Do not load live student data, invite users or create tenant authority.

## The ladder a school climbs

A school's rollout state is a row in `tenant_rollout`, written by the service role only. A school administrator cannot move their own school. The database refuses a forward move of more than one step, and a forward move whose exit gates have no evidence recorded since the school entered its current state. Stepping down, pausing and offboarding need no evidence.

`directory` → `requested` → `claimed` → `security_review` → `sandbox_uat` → `pilot_read_only` → `pilot_write_enabled` → `production_limited` → `production_active` → `expansion`. From any of them: `paused`, `suspended` or `offboarding`; from `offboarding` only: `archived`.

The exit gates for each step are in [`PILOT-TO-PRODUCTION.md`](../../operating-model/PILOT-TO-PRODUCTION.md). That page notes one gap: the feature-state checks do not yet read the lifecycle.

## Phases and timeline

The playbook target is 30 to 60 days from signed scope to launch, with deep integrations off the critical path ([`PILOT-IMPLEMENTATION-PLAYBOOK.md`](../../market-readiness/PILOT-IMPLEMENTATION-PLAYBOOK.md)). The weeks below are that playbook's targets, not commitments.

| Phase | Weeks (target) | Institution does | Semester does | You can verify | Not available today |
| --- | --- | --- | --- | --- | --- |
| Commercial and governance readiness | 0 to 3 | Name the sponsor, champion and technical owners; pick one workflow and one cohort of 50 to 200 students; approve metrics and baselines; write the decision date | Qualify and scope; trust review (data flow, roles, controls, evidence gaps); agreement | Signed scope and exclusions; approved data scope; open-item log; executed documents | Seats `security`, `trust`, `data`, `finance` and `champion` are vacant on the council page. A champion must be someone at the institution |
| Tenant and identity foundation | 2 to 4 | Verify domains; provide at least two institutional admins; choose SSO protocol and the SCIM model; approve group-to-role mappings | Provision the tenant; register the identity provider; prove tenant isolation | Domain routing; test users resolve to the right role and tenant; isolation checks in CI | OIDC is `PLANNED`; SAML is `IMPLEMENTED_NOT_RELEASED` and blocked on an institutional identity provider. See [SSO setup](SSO-SETUP.md) |
| LMS, SIS and source mapping | 2 to 4 | Registrar and LMS owners confirm terms, catalog, sections, assignments, calendar | Connect approved sources read-only first | Counts reconcile to the approved source; freshness labels show | No production adapter exists. Roster loading and OneRoster are not available. See [roster and data loading](ROSTER-AND-DATA-LOADING.md) |
| Course migration and LMS interoperability | 3 to 5 | Faculty and LMS owners validate representative courses | Import, convert and reconcile | Grade totals reconcile before any passback | Migration Center has never been used on a real migration. See [parallel-run evidence](PARALLEL-RUN-EVIDENCE.md) |
| Pilot configuration and readiness | 3 to 5 | Train faculty and staff; approve AI policy; approve communications; approve rollback and fallback | Set flags; configure monitoring; ready the support runbook | Only approved modules, roles and cohorts are on; the official-system fallback works | Configuration Studio settings are not read by the app yet. See [configuration and approvals](CONFIGURATION-AND-APPROVALS.md) |
| Limited pilot launch | 4 to 8 | Review support daily for ten business days; hold the weekly working group | Review source freshness daily; run UAT and go / no-go | A signed GO, no open P0 or P1 | No GO has been signed. The go / no-go checklist records that no alert reaches a named person (gate `operations-live`) |
| Pilot conversion decision | at the agreed date | The sponsor decides: convert, expand, extend, pause or stop | Report outcomes against the signed scorecard | One decision option recorded | No baseline or outcome exists for any institution |
| Production expansion | after the decision | Approve each wave; approve each writeback separately | Reconcile each writeback | Per-writeback approval and reconciliation | Not entered by any school |

Change control: any new data class, integration, user group, metric, AI use or write capability goes back through trust review and go / no-go. Urgency does not widen scope.

## Who does what

The workstream names below are the rollout registry's own (`RACI` in `app/src/lib/governance/rollout.ts`). The columns say which side acts. Where both act, the institution is accountable for its own approval and Semester for its own work.

| Workstream | Institution does | Semester does | Evidence to ask for |
| --- | --- | --- | --- |
| Contract/DPA | Sponsor and procurement or legal sign; counsel reviews | Provide drafts and the issue lists; counsel review is pending on the register | Executed documents outside this repository |
| Tenant configuration | Admin decides settings and modules | Implementation staff provision the tenant and draft configuration | Published configuration versions; `tenant_policy_audit_event` rows |
| SSO/identity | Identity owner supplies metadata and approves mappings | Registers the provider; stores the mapping; binds first login to a membership | Test users in each role; sign-in refused after deprovisioning |
| SIS integration | Registrar names the data owner and approves scopes | Builds and tests an adapter when one is approved | Reconciliation counts. None exist yet |
| LMS/LTI integration | LMS owner registers Semester and supplies platform fields | Binds the registration to the school; keeps grade passback off until approved | A launch from a real platform. None has happened |
| Course migration | Faculty lead validates content and rubrics | Imports and converts | Per-course acceptance record |
| AI policy | Academic affairs sets policy; faculty set course rules | Keeps the kill switch authoritative | Policy records; `ai:configure` audit rows |
| Accessibility | Accessibility owner reviews the pilot screens | Remediates findings | A qualified review. None is on record; see [procurement and accessibility](PROCUREMENT-AND-ACCESSIBILITY-ARTEFACTS.md) |
| Student launch | Student success owner and communications send the messages | Provide materials and the known-limitations list | Approved templates. See [change management](CHANGE-MANAGEMENT.md) |
| Support | Support owner staffs the help desk | Operates the escalation matrix | Named channels and hours. These are unassigned today |
| Outcome measurement | Institutional research owns the baseline | Reports privacy-thresholded aggregates (ten or more) | A signed baseline and scorecard |
| Production decision | Executive sponsor and steering committee decide | Semester leadership consulted | The decision record |

## Data you need to bring

| Item | From | Needed by |
| --- | --- | --- |
| Email domains | Institution | Tenant row and claiming; a school that publishes none cannot be switched to members-only rooms |
| Two or more administrator accounts | Institution | Tenant foundation |
| Group-to-role mapping matrix | Identity owner and Semester | Before any SCIM credential is used |
| Cohort definition (population, roles, count) | Sponsor | Scope |
| Terms, deadlines, building and calendar data | Registrar | Optional school data file. See [roster and data loading](ROSTER-AND-DATA-LOADING.md) |
| LMS platform fields (issuer, client ID, deployment ID, URLs) | LMS administrator | [LTI setup](LTI-SETUP.md) |
| Baseline measures and targets | Sponsor and data owner | Pilot scorecard |

## Acceptance checks

Run each on synthetic accounts before real ones:

1. A student, faculty and staff or administrator account each sign in and see only their own scope.
2. Cross-tenant and role-escalation attempts are denied.
3. A deprovisioned person keeps their account and loses institutional access on the next request.
4. A fact from an external source shows its source and freshness.
5. A paused connector stops syncing; a kill switch stops writes.
6. The official-system fallback still works.
7. Export, deletion and a mock offboarding work on synthetic data.

The detailed lists are the acceptance checklist in [`identity-scim-acceptance.md`](../../vanderbilt/identity-scim-acceptance.md) and the milestone tables in [`PILOT-TO-PRODUCTION.md`](../../operating-model/PILOT-TO-PRODUCTION.md). Those pages hold a named candidate's draft; treat them as a template, not as an approval. [`L5-NAMED-TENANT-APPROVAL-REGISTER.md`](../../vanderbilt/L5-NAMED-TENANT-APPROVAL-REGISTER.md) shows 0 approved.

## Weekly and exit

Weekly review uses privacy-thresholded metrics and a decision log. Pause when a P0 or P1 appears, tenant or data scope is uncertain, monitoring fails, support is unavailable or a required owner withdraws ([`PILOT-ADMIN-RUNBOOK.md`](../../market-readiness/PILOT-ADMIN-RUNBOOK.md)). To leave, follow the [exit plan](EXIT-PLAN.md).
