# Launch-day runbook — registration_readiness_v1

## T-24 h
- Go/no-go is `go` with every evidence link; signoffs complete.
- Freshness of holds and time tickets is `current` for the pilot cohort.
- Support primary and backup on rota; Vanderbilt escalation contacts confirmed by phone.
- Student and staff messages approved and scheduled.

## T-0 (activation)
1. Set `live_tenant_capabilities` for Vanderbilt: `sis.read` and `registration_readiness_v1` enabled, with approval reference and approver.
2. Smoke test as a pilot test student: open /app/registration, run a check, confirm the receipt says it isn't enrollment.
3. Smoke test as registrar: open the queue, route one test case.
4. Confirm the audit log shows both, and operations sees no student content.
5. Send the student message to the cohort.

## First 4 hours (command center staffed)
Watch: evaluation success rate, stale disclosures, support contacts, dead letters, unauthorized-access attempts (should be 0).

## Stop immediately if
Any cross-scope read or write · a readiness result shown as enrollment · stale data shown as current · a sensitive command without an audit event.
**Stop** = set `kill_switch = true` for the capability (takes effect next request), post the status message, open SEV-2, follow `runbooks/readiness_source_stale.md` or the security incident runbook.

## End of day
Record metrics, issues and decisions in `governance/decision-log.md`.
