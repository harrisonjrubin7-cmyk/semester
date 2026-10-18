---
stale-refs:
  - source: SECURITY.md
    changed_at: "2026-10-18T20:41:09"
    sections_changed: []
    summary: externally modified
---




# Registration readiness is stale, unavailable or misconfigured

> **Type:** runbook · **Audience:** registration operators · **Owner:** `Registrar pilot owner` · **Truth:** reviewed in repository, not drilled · **Reviewed:** 2026-10-12 · **Held by:** —

Use this runbook when registration-readiness facts are stale, the SIS read connection is unavailable, or the pilot tenant's gates do not match the approved read-only configuration. This runbook has not been exercised against a production tenant; a written procedure is not rehearsal evidence.

## Check first

1. Confirm the exact tenant and named human pilot owner from the approved activation record. Stop if either is absent; do not infer a tenant from a user or URL.
2. As an authorized integration viewer, capture the tenant's current `integration_connections` row for the SIS provider, the result of `feature_state(...)` for `integration.sis_read`, `scope.sis.registration_hold_summary_read`, and `writeback.registration_submit`, plus `kill_switch_engaged(...)` for `kill.integration_sync` and `kill.writeback`. Do not copy credentials or student records into the evidence packet.

## Do this, in order

1. If facts are stale or the connection is uncertain, engage the tenant-scoped `kill.integration_sync` switch. The readiness surface must fail closed and direct students to the institution's official system; their local planning work remains available.
2. Keep `writeback.registration_submit` off. This pilot is a read-only readiness and official-system handoff; it is not authorization to submit registration changes.
3. The integration operator diagnoses the provider connection without replaying or inventing student data. Restore only after the connection is approved and live, both required read flags resolve to `production`, and a fresh source observation succeeds.
4. The registrar pilot owner reviews the student-facing authority and freshness labels, then records the metric `registration_ready` only at the governed cohort grain. Do not record student-level analytics.
5. Before activation or reactivation, run the rollback rehearsal and save its dated evidence path. `evaluateRegistrationPilot` in `app/src/lib/registration-operations.ts` must return `ready: true` for the captured packet.

## Stop and escalate if

- The SIS and Semester disagree about a hold, time ticket, prerequisite, seat or enrollment. The SIS remains authoritative; route the case to the registrar and do not overwrite either record.
- A writeback flag is on, a kill switch cannot be engaged, the connection is not approved and live, or the human owner cannot be reached. Keep the pilot disabled and escalate to integration operations and security.
- Student data appears outside the authorized tenant or evidence packet. Preserve audit references, stop access, and follow the security incident process in [`SECURITY.md`](../../SECURITY.md).

## Afterwards

Record the tenant, observation time, named responder and pilot owner, flag and kill-switch states, connection status, source freshness, action taken, student-visible impact, and links to audit and rehearsal evidence. Do not include credentials or student records. Open a post-incident review for any cross-tenant exposure, false registration confirmation, unbounded write, or incident lasting through a registration window.
