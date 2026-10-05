# Admin guide

> **Type:** how-to · **Audience:** institution-admins · **Owner:** `success` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/institution-guides.test.ts`

This guide tells an institution administrator which role does what, where each tool is on the University screen, and which changes need a second person; stop reading if you are a student or you operate Semester itself.

**Status:** `IMPLEMENTED_NOT_RELEASED`. The tenant tooling is built and tested; most tabs are off in a normal build and show only when the build enables them and your account holds the capability. No institution has been activated, and the gateway behind the Records tab runs against a sandbox adapter.

<!-- status: Tenant admin console = IMPLEMENTED_NOT_RELEASED -->
<!-- status: Tenants, memberships, roles, scopes = IMPLEMENTED_NOT_RELEASED -->
<!-- capabilities: tenant:configure, tenant:implement, audit:read, integration:approve, integration:view, integration:configure, integration:sync, integration:replay, killswitch:engage, breakglass:request, ai:configure, migration:approve, migration:manage, config:manage, config:publish, config:view, workflow:manage, workflow:publish, record:approve, data_request:handle, console:operate, approval:decide, platform:configure, outcomes:read -->
<!-- roles: university_admin, implementation_manager, integration_admin, registrar, data_steward, incident_responder, platform_admin -->
<!-- labels: app/src/screens/University.tsx :: Services, Drafts, Records, Connections, Institutional package, Control, Trust, Modules, Get help, Integrations, Operations, Demand, Campaigns, Migration, Configuration, Workflows, Academic record, Student accounts -->
<!-- labels: app/src/lib/console/workspaces.ts :: Command center, Support, Approvals, Break-glass, Audit, Customers, Figures, Finance model, Evidence, Views -->
<!-- labels: app/src/components/SchoolClaim.tsx :: For this university's staff -->

## Before you start

- You need an account that the database says holds a grant over your school. The app reads your grants from the database to decide which tabs to offer. It does not authorize anything: a hidden tab only hides a dead end, and every read and write is still decided by row-level security.
- The client role you pick in the app (`Administration` and the others in `app/src/lib/role.ts`) changes language and tools. It is not a permission.
- Roles are bundles of capabilities. A capability is checked at a scope: platform, school, course and so on. Your school-scoped grants are what matter here.

## Roles you will meet

| Role | Capabilities it holds that matter here | Who holds it |
| --- | --- | --- |
| `university_admin` | `tenant:configure`, `audit:read`, `integration:approve`, `integration:view`, `killswitch:engage`, `ai:configure`, `migration:approve`, `config:manage`, `config:publish`, `workflow:publish` | Your institution |
| `implementation_manager` | `tenant:implement`, `config:manage`, `workflow:manage`, `migration:manage` | Not stated in the repository; agree it in your implementation plan |
| `integration_admin` | `integration:configure`, `integration:sync`, `integration:replay`, `config:manage`, `migration:manage` | Called a school role in the integration runbook |
| `registrar` | `config:publish`, `workflow:publish`, `migration:approve`, `record:approve` | Your registrar's office |
| `data_steward` | `data_request:handle`, `console:operate` | Semester (platform scope) |
| `incident_responder` | `killswitch:engage`, `breakglass:request` | Semester (platform scope) |
| `platform_admin` | `approval:decide`, `platform:configure`, `console:operate` | Semester (platform scope) |

The full list, rendered from the migrations, is [`ROLE-PERMISSION-MATRIX.md`](../../ROLE-PERMISSION-MATRIX.md). Where it and a migration disagree the migration wins. See "Known disagreements" at the end.

## Two consoles, not one

Semester has two places an administrator might look. They are easy to confuse.

| Place | Who can open it | What it is |
| --- | --- | --- |
| **University** (navigation label `University`) | A signed-in person; the tabs depend on your grants over your school | Your school's tools: services, drafts, connections, configuration, migration |
| **Console** (`app/src/screens/Console.tsx`) | Only an account holding `console:operate` at platform scope | Semester's own operations console. There is no demo, no preview role and no view-as |

You will not see the Console as an institutional administrator. The truth table calls it the tenant admin console; the code gates it at platform scope, so treat it as Semester-operated. It is described below so that you know what Semester staff see and can ask about it.

## Tour of the University screen

A tab appears only when its condition holds. A flag is a build-time setting with four values (`off`, `preview`, `sandbox`, `production`); a build marked as an institutional preview defaults the flags marked "preview" to `preview`, and any other build defaults them to `off`.

| Tab | Shows when | What you do there |
| --- | --- | --- |
| `Services` | Always | See the service areas and what the app can honestly do for each |
| `Drafts` | Always | Prepare local drafts of requests. A draft is kept on your device; nothing is sent |
| `Records` | Always | Search records the school's gateway returns. With no gateway you see a status, not data |
| `Connections` | Always | See each connection and its readiness |
| `Institutional package` | Always | Read the package of institutional material |
| `Control`, `Trust` | `VITE_UNIVERSITY_CONTROL_PLANE` is not `off` | Read policy, access and evidence. Staging a policy change is local and publishes nothing; the apply button needs same-tenant authorization, production feature state and a production-verified gateway |
| `Modules` | You hold `tenant:configure` | Switch modules for your school |
| `Get help` | `VITE_HUMAN_HELP` is not `off` | Staff help inbox |
| `Integrations` | `VITE_INTEGRATION_DASHBOARD` is not `off` | Read connection health; the Export health summary button downloads counts and states only |
| `Operations` | `VITE_INSTITUTIONAL_OPERATIONS` is not `off` and you hold `outcomes:read` | Aggregate measures. Cells under ten are suppressed, and there is no per-student grain |
| `Demand` | `VITE_DEMAND_FORECASTING` is not `off` | Course-demand counts of ten or more |
| `Campaigns` | `VITE_CAMPAIGN_MANAGER` is not `off` and you hold a campaign capability | Recruitment and adoption campaigns |
| `Migration` | `VITE_MIGRATION_CENTER` is not `off` and you hold a migration capability | Migration Center. See [parallel-run evidence](PARALLEL-RUN-EVIDENCE.md) |
| `Configuration` | `VITE_CONFIGURATION_STUDIO` is not `off` and you hold `config:manage`, `config:publish` or `config:view` | See [configuration and approvals](CONFIGURATION-AND-APPROVALS.md) |
| `Workflows` | `VITE_WORKFLOW_BUILDER` is not `off` and you hold a workflow capability | Same page |
| `Academic record` | `VITE_RECORD_LEDGER` is not `off` and you hold a record capability | The approval-gated academic-record ledger |
| `Student accounts` | `VITE_STUDENT_ACCOUNTS` is not `off` and you hold a `finance:` capability | The approval-gated student-account ledger |

Production changes made through the control plane are real only when a production-verified gateway returns a receipt. The screen says "Nothing is shown as applied" when it does not.

## Tour of the Console (Semester staff)

The Console's tabs, in order: `Command center`, `Support` (only when support tickets are on and you may answer them), `Approvals`, `Break-glass`, `Audit`, `Tenant operations`, `Privacy requests`, `Integration health`, `Release & incidents`, `Customers`, `Figures`, `Finance model`, `Evidence`, `Views`. A tab appears only when the signed-in operator holds its capability. A privileged action asks for a second factor that is no more than fifteen minutes old.

- `Approvals` and `Break-glass` run on a duty matrix (`DUTIES` in `app/src/lib/ops/console.ts`): the requester and the approvers are different parties. A break-glass grant to a production tenant is requested by the `engineering` seat and approved by the `security` and `founder` seats.
- `Audit` shows the audit-chain status and events, newest first.
- `Finance model` is Semester's own internal planning tool, for its staff and not a customer feature. It runs on local sample data, reads nothing from a ledger or bank, saves nothing, and labels every figure a forecast on planning assumptions.
- Saved views and the last-open tab live on the server, not in browser storage.

## Duties that start with your administrators

Some changes are requested by an institutional role and approved by a Semester seat. They run through the Console's `Approvals` view, so you ask Semester; you do not click the approval yourself.

| Duty id | Requested by | Approved by | Two-person |
| --- | --- | --- | --- |
| `role-grant` | `university_admin` | `security` seat | No |
| `tenant-policy` | `implementation_manager` | `engineering` seat | No; high-risk flags take the `integration-config` path |
| `integration-config` | `integration_admin` | `data` and `security` seats | Yes |
| `data-deletion` | `data_steward` | `privacy` seat | No |

A grant with no request behind it is a finding at the quarterly access review. See [`ACCESS-REVIEW-PROCEDURE.md`](../../institutional-readiness/ACCESS-REVIEW-PROCEDURE.md).

## What needs a second person

| Change | Rule | Where it is enforced |
| --- | --- | --- |
| Publishing a configuration | The drafter cannot publish it | `private.school_config_guard`, `supabase/configuration-studio.check.sql` |
| Publishing a workflow | The drafter cannot publish it | `private.workflow_guard`, `supabase/workflow-builder.check.sql` |
| Approving an integration connection or scope | A `university_admin`, not the connection's owner, approves | `docs/INTEGRATION-OPERATOR-RUNBOOK.md` section 1 |
| Starting and approving a school offboarding | The other side, and a different person, approves | [exit plan](EXIT-PLAN.md) |
| Break-glass access | Two distinct approvers, neither the requester | Console duty matrix |
| Moving a school up the rollout ladder | Service role only; each step needs evidence recorded since entering the current state | `supabase/tenant-rollout.check.sql` |

## Everyday tasks

1. **See who can do what at your school.** Ask Semester for the grants over your school; there is no screen that lists them for you.
2. **Switch a module.** Open `Modules` (needs `tenant:configure`).
3. **Check integration health.** Open `Integrations`, then Export health summary for a counts-only file.
4. **Read audit evidence.** See [audit and data requests](AUDIT-AND-DATA-REQUESTS.md).
5. **Review who has joined your school.** A person who holds `tenant:configure` sees requests to join under `For this university's staff` on the Account screen and can approve, decline or remove a member of your school.
6. **Ask a student's question about their data.** Direct it to [audit and data requests](AUDIT-AND-DATA-REQUESTS.md).
7. **Leave.** See the [exit plan](EXIT-PLAN.md). There is no offboarding screen by design.

## Known disagreements

- [`FEATURE-TRUTH-TABLE.md`](../../FEATURE-TRUTH-TABLE.md) lists `Console.tsx` as the tenant admin console. The code requires `console:operate` at platform scope, so it is Semester-operated. The code wins.
- [`ROLE-PERMISSION-MATRIX.md`](../../ROLE-PERMISSION-MATRIX.md) does not list the `config:` or `workflow:` capabilities on `university_admin`; the migrations `20260930230000_configuration_studio.sql` and `20260930231000_workflow_builder.sql` grant them. The migrations win.
