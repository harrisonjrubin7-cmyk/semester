# End-to-end integration suite and coverage contract

## Executable composition
run_integration.py invokes existing app npm scripts instead of inventing routes/selectors.
- smoke:cold: built-app cold navigation.
- smoke:a11y: critical assembled accessibility regressions (not certification).
- smoke:golden: local student workflow, model stub, persistence and file-carried resume.
- smoke:sync: ephemeral local real auth/database, two devices, export/deletion/session/state proof.
The runner requires loopback app URLs. The existing sync harness additionally verifies the account service is loopback before credentials are submitted. A local URL alone does not prove every underlying dependency is local: inspect test build configuration.

## Test dependencies
Built previews, Playwright/browser, local Supabase plus applied migrations and function dependencies, ephemeral credentials. Existing CI performs substantial setup; do not invoke auth tests against a production-configured build. Missing setup exits nonzero. Tests may create/delete synthetic local accounts.

## Full production matrix — remaining domain suites
Course: owner/delegation, roster denial, assignment version, concurrent edits, publish/projection, duplicate submissions, accommodations, feedback and passback reconciliation.
Registration: stale eligibility, policy change between prepare/execute, duplicate command, unknown result, reconciliation, rollback.
Consent: scoped sharing, expiry/revocation, cached/search/AI denial, actual session invalidation, retained records.
Company: audience isolation, reconciled financial/KPI snapshots, immutable publication/correction, restricted data-room links.
Institution: tenant isolation, SSO mapping, offboarding, role-specific home/actions, override authority.
Operations: durable jobs, duplicate events, outbox recovery, worker crash, restore, migration compatibility.
No endpoints/selectors are fabricated for these uninspected domains. These cases remain acceptance requirements until mapped to existing code and fixtures.

## Evidence semantics
The 12 runner unit tests use fake subprocess results; they test orchestration and safety, not application journeys. Browser/auth suites were not executed during artifact generation. Scope success must never be labeled universal readiness. Record release hash, build configuration hash, test backend, actual suite output and excluded gates in CI evidence.
