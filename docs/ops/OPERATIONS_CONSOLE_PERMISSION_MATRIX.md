# Operations console: permission matrix

Capabilities are the ones that exist in `public.app_capabilities` today (live,
2026-10-05). **No new capability is proposed here without a stated reason**; two
candidates are listed at the end and need an approved migration.

Authorization is always the database: `private.has_capability(cap, scope_kind,
scope_id)` inside the RPC. The client shows or hides things as a courtesy only.

## 1. Screens and the single capability that opens them

| Screen (console view) | Read capability | Scope | Mutations it can start |
|---|---|---|---|
| Overview | `console:operate` | platform | none |
| Inbox | `console:operate` platform; each item class also needs its own capability (below) | platform | acknowledge, assign, note (low risk) |
| Approvals | `console:operate` to read; `approval:decide` to decide | platform | `request_approval`, `decide_approval`, `console_act` |
| Tenants / tenant detail | `console:operate`, or `tenant:configure` over that school | platform or that school | lifecycle transition request |
| Support | `support:ticket` | platform | none in Phase 1 (existing `support_reply` stays in the support tab) |
| Releases | `console:operate`; `killswitch:engage` to act | platform | kill-switch via duty `release` |
| Trust | `trust:publish` or `account:manage` | platform | none in Phase 1 |
| Compliance | `compliance:manage` | platform | none in Phase 1 |
| Audit | `audit:read` | the school; platform needs `console:operate` | none; export is a controlled read |
| Projections | `console:operate` | platform | dead-letter replay (approval) |
| Customers / Revenue / Billing / Renewals | `account:manage`, `billing:read`, `success:manage` | platform | refund via duty `refund` |
| Pilots / Implementation / Health | `account:manage`, `success:manage`, `tenant:implement` | platform | none in Phase 2 |
| Integrations | `integration:view` | school or platform | pause/replay via existing RPCs |
| Privacy | `audit:read`, `hold:read` | school or platform | none; holds and DSR stay in existing flows |
| Security | `console:operate` plus security seat | platform | none |
| Incidents / SLOs / Access reviews | **new**, Phase 4 | platform | see candidates below |

## 2. Role to capability, from the migrations

`console:operate` is carried by `platform_admin`, `support_agent`,
`implementation_manager`, `data_steward`, `incident_responder`, `trust_officer`.
It is a **platform-wide read key**, which is why the new read models must apply
a second, narrower capability per domain: holding `console:operate` must not by
itself return billing amounts or support content.

Resulting rule for Phase 1: `ops_*` read RPCs require `console:operate` **and**
the domain capability in the table above, and return the minimum for the
second. Fields the caller's domain capability does not cover are omitted and
listed in `warnings`.

## 3. High-risk actions and their gate

All use the existing duties in `public.console_duty`. The requester and
approvers below are as seeded; confirm against the table before changing.

| Action | Duty | Requires | Today's real path | Gap |
|---|---|---|---|---|
| Break-glass access | `break-glass` | `breakglass:request`, evidence, ticket, two approvers, fresh MFA | `request_approval` → `decide_approval` → `console_act` | none known; unproven in production (audit has 0 rows) |
| Role grant | `role-grant` | duty seats | `console_act` effect | none known |
| Support access | `support-access` | student consent + `support:read` | `support_access_grant` | none known |
| Tenant suspension | `tenant-suspension` | duty seats | `console_act` effect | none known |
| Tenant policy | `tenant-policy` | duty seats | **tenant admin writes `tenant_feature_policy` directly** | F-1 |
| Integration config | `integration-config` | duty seats | `integration_*` RPCs and direct table DML | F-1 |
| Release / kill switch | `release` | duty seats | **direct `feature_kill_switch` insert/update** | F-1 |
| Data deletion | `data-deletion` | duty seats | offboarding RPCs gated by legacy `is_app_admin()` | F-5 |
| AI provider | `ai-provider` | duty seats | **direct `provider_registry` write** | F-1 |
| Evidence release | `evidence-release` | duty seats | trust-room RPCs | none known |
| Refund / credit | `refund` | duty seats | commercial tables append-only; write path is service role | verify before building |

The console in Phase 1 **only reads** and **only starts approval requests**. It
never calls a table write for any row above.

## 4. Tenant and customer scope tests required per screen

Each new read RPC ships with a SQL check that: (a) an account with no grant gets
`42501`; (b) an account with the capability at school A cannot read school B;
(c) a platform holder with only `console:operate` gets no amount or content
fields; (d) the response contains no key from the redaction deny-list; (e) the
sensitive-read audit event is written when the data class requires it.

## 5. Optimistic-update allow-list (client)

Allowed: acknowledge inbox item, assign internal work item, save personal view,
add internal note, mark seen, draft a non-sensitive item. Everything else waits
for the authoritative response. These all write `operator_preference` or a new
low-risk inbox table; none touches a domain table.

## 6. Capability candidates (not created)

| Candidate | Why the existing set cannot do it | Needed by |
|---|---|---|
| `incident:command` | `incident:communicate` covers notices only, not declaring, escalating or closing | Phase 4 incident center |
| `access:review` | no capability covers attesting other people's grants | Phase 4 access review |

Adding either is a migration with a threat model and an approval. Until then,
Phase 4 can use `incident:communicate` and `console:operate` plus security seat.

## 7. Known authorization defects to fix before relying on this matrix

1. `my_capabilities()` ignores break-glass grants, so the UI can under-offer.
2. The three INVOKER readers return all tenants to any `console:operate` holder.
3. `private.is_app_admin()` still gates school offboarding and `schools_write`.
