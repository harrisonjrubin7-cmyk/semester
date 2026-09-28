# Service reliability and support operations

Part 5 of the expansion command. Phase 3. **Waits for #779 (kill switches) and
#791 (help requests).** Nothing here is built yet.

## What exists on main

- Operations documents: [`MONITORING.md`](../MONITORING.md),
  [`ROLLBACK.md`](../ROLLBACK.md), [`RESTORE.md`](../RESTORE.md),
  `docs/market-readiness/INCIDENT_RESPONSE.md`,
  `docs/market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md`,
  `docs/market-readiness/DISASTER_RECOVERY.md`,
  `docs/market-readiness/SUPPORT_PLAYBOOK.md`.
- Synthetic monitoring already runs: `.github/workflows/production-smoke.yml`
  hourly against public production (`app/scripts/public-production-smoke.mjs`),
  plus `app/scripts/production-smoke.mjs` and `app/scripts/cold-smoke.mjs`.
- Failure handling: `app/src/components/Boundary.tsx` (one error boundary,
  separating chunk-load failures), `app/src/lib/failure.ts` (eight failure codes,
  a reference a student can quote), `app/src/lib/diagnose.ts` (rolling local
  log).
- Feedback: `app/src/lib/feedback.ts` into `public.feedback`.
- Gateway health: `private.gateway_health_probe`.
- The `support:ticket` capability exists; no ticket table does.

## In flight

- #779 adds `feature_kill_switch` (global, school, connection) and the flag
  evaluation order. Degradation modes are kill switches with a student-facing
  sentence; they are not a second mechanism.
- #791 adds `help_requests`, `help_request_events` and `help_destinations`: a
  student asks a person, staff answer from an inbox. That **is** the ticket; this
  part adds context bundles, SLAs and escalation to it.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `service_components` | **New**, platform-wide | app, auth, integrations, sync, search, AI, upload, code sandbox, notifications, media, community, support |
| `service_health_checks` | **New** | Written by the smoke scripts and the gateway probe |
| `service_incidents`, `incident_updates` | **New** | Status page and in-app banner read these |
| `incident_postmortems` | **Documents** in the repository, linked from the incident | Postmortems are reviewed prose |
| `service_degradation_modes` | **Reuse** `feature_kill_switch` (#779) + a `read_only` platform switch | One switch mechanism |
| `support_tickets` | **Reuse** `help_requests` (#791) | Same thing |
| `support_ticket_context_bundles` | **Column** on `help_requests`, filled only after the student reviews it | See boundaries |
| `support_escalations` | **Reuse** `help_request_events` with kind `escalate` | |
| `support_slas` | **Columns** on `help_destinations` | Response target per destination |
| `on_call_rotations` | **Not a table** | The pager tool owns the rotation; the incident stores who was on call |
| `war_room_events` | **Flag** `ops.war_room` + incidents | Registration-week mode is heightened monitoring and a staffed channel |
| `slo_definitions`, `error_budgets` | **Documentation** + CI thresholds: [SLOS-AND-ERROR-BUDGETS.md](operating-model/SLOS-AND-ERROR-BUDGETS.md), `error-budgets.ts` | An SLO a machine checks lives beside the check |
| `sli_measurements` | **New**, aggregate per component per hour | No per-user rows |
| `synthetic_monitor_checks` | **Reuse** the smoke workflows | They already run hourly |
| `capacity_plans`, `load_test_runs`, `backup_restore_verifications` | **Documents** with dated evidence, like `docs/institutional-rollout` | Evidence, not live data |

## Capabilities and flags

- **`service:operate`**, new, for `support_agent` and platform operators:
  post incidents, set degradation.
- `support:ticket` (exists) works help requests.

## Hard boundaries

- **A context bundle is never attached without the student seeing it first.** It
  holds route, app version, school, browser and device class, the failure
  reference and non-sensitive state — never note text, messages, grades or
  content. The student can remove any line before sending.
- Read-only mode keeps every local edit on the device and says so; it never
  discards work.
- Status detail shown to students names the component and the effect, not
  hosts, stack traces or vendors under investigation.
- An incident banner never uses alarm styling for a degraded optional feature.

## Tests

- Read-only mode: an edit made while it is on is kept locally and syncs after.
- A context bundle built from a state containing note text contains none of it.
- Each degradation mode shows its sentence and its recovery route.
- The smoke scripts write a health check row; a failed check opens nothing
  automatically but is visible to `service:operate`.
