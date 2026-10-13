# Launch-day runbook: registration readiness pilot

Use only after `go-no-go.yaml` reads GO with every evidence item verified. Do
not start this runbook on a NO-GO.

## Before the flag

1. Confirm `docs/launch/go-no-go.yaml` decision and the signer named in it.
2. Run `npm run pilot:validate --workspace app` from the repository root; it must pass.
3. Confirm dashboards for source freshness, evaluation failures and dead letters are live (REL-OPS-01).
4. Confirm the on-call rota and the support owner named in `support-handoff.md`.
5. Confirm the registrar product owner has walked the staff onboarding module (`communications/staff-onboarding-registrar.md`).

## Enabling

1. Enable `registration_readiness_v1` for the pilot tenant only. Never enable it for all tenants.
2. Run the production smoke check: an own-record read for one pilot student, one registrar queue load, one denied cross-tenant request. Each must return the expected result and an audit event.
3. Watch for 60 minutes: evaluation failures, stale-source results, `readiness.access.denied` spikes.

## Rollback

- Disable the flag. Students see the unavailable state; no records are deleted.
- Receipts and audit events are retained. Do not run destructive cleanup during rollback.
- If access was wrong, follow `incident-runbooks/access-exposure.md` before anything else.

## Stop conditions

Stop and roll back if any of these happen:

- A student sees another student's record (RSK-002).
- Any surface says "enrolled" or "registered" (RSK-003).
- A stale source produces a ready result (RSK-001).
