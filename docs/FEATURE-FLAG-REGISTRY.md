# Feature-flag registry

The source of truth is [`app/src/lib/flags.ts`](../app/src/lib/flags.ts). This page is its human copy, and
`app/src/lib/flags.test.ts` fails if a key there is missing here. Change both in the same commit.

## Where a flag's state lives

A flag is **not** a new table. The state for a school is a row in the existing
`public.tenant_feature_policy` (`tenant_id`, `capability` = the flag key, `state` ∈ `off · preview · sandbox ·
production`, `permitted_roles`), written only by `tenant:configure` and audited by the existing trigger into
`tenant_policy_audit_event`. A kill switch is a row in `public.feature_kill_switch` (null tenant = every
school). Build-time switches (`VITE_*`, `app/src/lib/experience-flags.ts`) decide whether code ships in a
build at all; they never turn a feature on for a school by themselves.

| Environment | Tenant state that counts as on |
| --- | --- |
| development | `preview`, `sandbox`, `production` |
| preview | `preview`, `sandbox`, `production` |
| production | `production` only |

### Beside the AI Toolkit's switches

`app/src/lib/toolkit/flags.ts` (#781) holds the AI Toolkit's *build* switches (`VITE_AI_TOOLKIT`, `VITE_TOOLKIT_*`), with
`VITE_AI_TOOLKIT=off` as its kill switch. They decide what a build contains. The tenant flags and kill switches here
decide what a school has turned on at run time; a toolkit feature that reaches institutional data answers to both.

## Evaluation order

`evaluateFlag(key, context)` stops at the first gate that refuses and reports which one:

1. **Kill switch** — global, then the school's, then the connection's own (`kill.connection.<public id>`).
2. **Environment** — expired temporary flags are off everywhere; no verified school means off.
3. **Tenant entitlement** — the parent module (e.g. `module.integration_dashboard`), then the flag.
4. **Connection approval** — an approved connection in `healthy` or `degraded`.
5. **Provider scope** — every named scope approved and unexpired.
6. **Capability** — verified over the school (`private.has_capability`), never a role picker.
7. **Role policy** — the tenant row's `permitted_roles`, when set.
8. **Data classification** — `routeAllowed(class, destination)`; T3+ never to consumer AI, T4+ nowhere.
9. **Course / assignment rule**.
10. **User eligibility** — consent given, account in good standing.

An unknown key is refused. Nothing defaults on.

## Flags

Every flag: default **off**, created 2026-09-27, review 2026-12-15, runbook below.

| Key | Type | Owner | High-risk | Scope | Expires | Rollback |
| --- | --- | --- | --- | --- | --- | --- |
| `module.integration_dashboard` | module | Integrations | no | tenant, role | — | Set off; read-only screen. |
| `module.institutional_operations` | module | Institutional research | no | tenant, role | — | Set off; drafts stay on the analyst's device, nothing server-side to undo. Needs `outcomes:read`. |
| `module.source_freshness_cards` | module | Student experience | no | tenant | — | Set off; the Today section disappears. The Privacy panel is not behind this flag. |
| `release.integration_dashboard_v1` | release | Integrations | no | environment, tenant | 2027-03-01 | Set off. |
| `integration.lms_lti` | connector | Integrations | **yes** | tenant | — | Connection kill switch, flag off, disconnect. |
| `integration.sis_read` | connector | Integrations | **yes** | tenant | — | Same. |
| `integration.degree_audit_read` | connector | Integrations | **yes** | tenant | — | Same. |
| `integration.advising_crm` | connector | Integrations | **yes** | tenant | — | Same. |
| `integration.career` | connector | Integrations | **yes** | tenant | — | Same. |
| `integration.campus_services` | connector | Integrations | **yes** | tenant | — | Same. |
| `integration.erp_bursar_actions` | connector | Integrations | **yes** | tenant | — | Same. Deep link and action item only. |
| `scope.sis.enrollment_read` | scope | Integrations | **yes** | tenant, user | — | Off and withdraw the scope. |
| `scope.lms.assignment_dates_read` | scope | Integrations | **yes** | tenant, course | — | Off and withdraw the scope. |
| `scope.sis.registration_hold_summary_read` | scope | Integrations | **yes** | tenant, user | — | Off and withdraw the scope. |
| `writeback.registration_submit` | writeback | Integrations | **yes** | tenant, user | — | `kill.writeback`. Not built. |
| `writeback.lms_grade_passback` | writeback | Integrations | **yes** | tenant, course, assignment | — | `kill.writeback`. See the note below. |
| `ops.external_ai_generation` | ops | AI platform | **yes** | tenant, course | — | `kill.ai_generation`. |
| `ops.data_upload` | ops | Platform | **yes** | tenant | — | `kill.data_upload`. |
| `ops.code_sandbox_enabled` | ops | Platform | **yes** | tenant, course | — | `kill.code_execution`. |
| `safety.scoped_pseudonymity` | safety | Trust & Safety | **yes** | tenant, course | — | Set off. |
| `safety.volunteer_moderation` | safety | Trust & Safety | **yes** | tenant, course | — | Set off. |
| `safety.institution_escalation` | safety | Trust & Safety | **yes** | tenant | — | Set off. |
| `experiment.today_action_ranking_v2` | experiment | Student experience | no | tenant, user | 2027-01-31 | Set off. |

Rollout plans and success criteria for each are in `flags.ts` beside the key.

### Grade passback and this flag

`writeback.lms_grade_passback` governs the existing Brightspace score passback (`functions/lti`, `/score`) for any
LTI registration **bound to a school**, through `public.lti_passback_decision`, which the SQL suite
`lti-integration.check.sql` walks gate by gate. A registration not yet bound keeps the pre-existing behaviour
(instructor-gated), stopped only by the global `kill.writeback` / `kill.integration_sync`. See the migration
plan, D-1, for why and for the binding steps.

## Kill switches

| Key | Stops |
| --- | --- |
| `kill.integration_sync` | Every sync and replay (the replay function refuses under it). |
| `kill.ai_generation` | External AI generation. |
| `kill.data_upload` | Uploads. |
| `kill.code_execution` | Notebook / code execution. |
| `kill.sharing` | Sharing and publishing, pseudonymity and volunteer moderation. |
| `kill.writeback` | Every write-back. |
| `kill.connection.<public id>` | One connection. |

A global row (null tenant) needs `killswitch:engage` over the platform scope, held by the one-capability
global role `incident_responder`. A school row needs it over the school, held by `university_admin`.

## Kill-switch runbook

1. Engage: insert or update the `feature_kill_switch` row with `engaged = true` and a reason (the database
   refuses an engaged switch without one). Global only if more than one school is affected.
2. Confirm: `select public.kill_switch_engaged('<key>', '<school>')` answers true; the dashboard shows a banner.
3. Communicate: the reason is in `tenant_policy_audit_event` for school rows; post the incident link.
4. Release: set `engaged = false` once the cause is fixed. Connections resume to `configuring`, never straight
   to `healthy` — the next successful run earns that back.

## Review and cleanup

Every flag carries a review date. At review: a temporary flag past its purpose is removed from `flags.ts`,
this page and every `tenant_feature_policy` row in one change; a permanent one gets a new review date. The
evaluator already treats an expired temporary flag as off, so a missed review fails safe.

## Build switches

These decide what a build contains, not what a school has turned on. Values:
`off`, `preview`, `sandbox` and `production`; a misspelt value reads as `off`.

### Experience flags (`app/src/lib/experience-flags.ts`)

A preview build (`VITE_INSTITUTIONAL_PREVIEW=true`) turns each of these on as
`preview`. An explicit value overrides that.

| Flag | Env |
| --- | --- |
| semesterIntelligence | `VITE_SEMESTER_INTELLIGENCE` |
| journeyNavigation | `VITE_JOURNEY_NAVIGATION` |
| adaptiveLearning | `VITE_ADAPTIVE_LEARNING` |
| careerSkillsGraph | `VITE_CAREER_SKILLS_GRAPH` |
| multimodalCapture | `VITE_MULTIMODAL_CAPTURE` |
| universityControlPlane | `VITE_UNIVERSITY_CONTROL_PLANE` |

### Community flags (`app/src/community/flags.ts`)

High-risk flags ignore the preview default. They are off unless the variable is
set by hand, and `production` is refused for them.

| Flag | Env | High-risk | Default | Purpose |
| --- | --- | --- | --- | --- |
| communityFeed | `VITE_COMMUNITY_FEED` | no | off (preview in preview builds) | Communities, finite feeds, sessions |
| communityReporting | `VITE_COMMUNITY_REPORTING` | no | off (preview in preview builds) | Report, block, mute, leave, pre-post checks |
| moderationConsole | `VITE_MODERATION_CONSOLE` | no | off (preview in preview builds) | Professional queue, actions, appeals |
| institutionEscalation | `VITE_INSTITUTION_ESCALATION` | **yes** | off | Dual-approved, minimum-data escalation |
| volunteerModeration | `VITE_VOLUNTEER_MODERATION` | **yes** | off | Blind low-risk volunteer queues |
| scopedPseudonymity | `VITE_SCOPED_PSEUDONYMITY` | **yes** | off | Community-only aliases |
| accountSafetyState | `VITE_ACCOUNT_SAFETY_STATE` | **yes** | off | Private staff-only 0–100 state |

**Server-side switches.** A build flag hides a screen, but it cannot stop a
client that ignores it. Scoped pseudonymity and volunteer moderation are
therefore also gated in the database, and so are institution escalation and
the account safety state:

- Each has a `community_programs` row per university.
- A program is off unless its row is present and `enabled`.
- Only the service role can write a row, so switching a program on is a
  reviewed deployment step.
- Every alias, volunteer, escalation and safety-state function checks the
  row.
- Switching a program off stops alias posts, volunteer queues, escalation
  approvals and new safety entries on the next call. Safety entries already
  written stay until the yearly sweep or an appeal reverses them.
- Escalation also needs a `community_escalation_policies` row naming the
  agreement, its categories and the channel — again service role only.

**Rollback.** Unset the variable, or set it to `off`. Nothing persists
because a flag was on: the domain functions refuse at call time.
