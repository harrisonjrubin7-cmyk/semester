# Semester execution specification pack

Produced 2026-10-13. Deliverables are local artifacts, not changes to GitHub, Supabase, Vercel or institutional systems.

- 13 onboarding failure/recovery paths, with fallback triggers, state mapping, compensation, owners and resume guards.
- 26 onboarding fallback/resume test specifications (not executed against SQL/UI).
- 13 role lifecycle specifications. Seeded applicant onboarding is preserved and extended, not duplicated.
- Complete proposed v2 schema for six engine document types, examples, validator and 55 passing local validation checks.
- 17 registration recovery test specifications and 22 passing local reference-model tests, including three abstract worker tests.
- 17 proposed background bindings and an execution sequence. No handler is resolved or active.
- Ten findings from inspected handoff code with proposed remediations and tests. No finding has been patched or production-verified.

## Test evidence levels

Schema tests validate document structure/relations. Reference-model tests validate an abstract in-memory model, not actual handlers. Integration tests still need real authority adapters, PostgreSQL/RLS, workers, identity providers, storage, notification/payment providers and an authorized sandbox. UI tests need keyboard/assistive-tech and recovery runs. Institution authorization and controlled production rollout are separate activation gates.

## Safe onboarding compensation

Keep confirmed private work and existing identity. Remove only proven provisional resources. Never infer that completion of a local task clears a hold, that onboarding activation establishes enrollment, or that onboarding failure authorizes an official-record reversal. External uncertainty is reconciled, not blindly retried or compensated.

## Execution sequence

1. Confirm named owners and source/deployed schema inventory.
2. Review the ten inspected handoff findings; design backward-compatible migrations.
3. Introduce schema v2 with pinned versions and compatibility adapters.
4. Bind draft registry keys to reviewed code, tests and actual policies.
5. Add accepted-vs-committed receipts, dedup/inbox, claim leases and fenced domain outcomes to the existing controlled-action pattern.
6. Execute the specified registration/onboarding/provider fault cases in an authorized sandbox.
7. Finish cross-role closure using one Action Center/search/workspace/graph and governed gateway.
8. Verify accessibility, isolation, recovery, reconciliation and institutional scope.
9. Activate the smallest approved scope with monitoring and rollback/correction owners.

## Source basis

Inspected project excerpts: docs/operations/CONTROLLED_ACTION_PATTERNS.md; docs/onboarding/ACCESSIBILITY_AND_ERROR_RECOVERY.md; docs/onboarding/HANDOFF_TRANSACTIONS.md; handoff/semester-platform/supabase/migrations/100_controlled_actions.sql.txt, 110_onboarding_growth.sql.txt, 120_handoff_preview_devices.sql.txt; handoff/semester-platform/lib/auth/return-path.ts.txt; corresponding tests/controlled-actions.test.ts.txt, onboarding.test.ts.txt, handoff.test.ts.txt. No claim that these handoff files are deployed.

## Values and identifiers

proposed: references and proposed. registry keys are not existing routes/handlers. All retry, timeout, lease and budget numbers are illustrative targets requiring environment approval. Secrets and credentials are absent from the pack.
