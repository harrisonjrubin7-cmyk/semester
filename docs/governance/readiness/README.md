# Registration readiness: governance registries

Source: the pilot governance brief (2026-10-13), "Next implementation tranche" items 1–3.

| File | What it holds | Guard |
| --- | --- | --- |
| `evidence-registry.json` | Every evidence artifact a release claim depends on, with owner, status, expiry, and content hash. Invalidation rules. | `app/src/lib/governance/readiness-governance.test.ts` |
| `control-register.json` | Controls with objective, owner, test frequency, failure response, and linked evidence. | same |
| `acceptance-scenarios.json` | AT-RDY acceptance scenarios, each tied to the controls it exercises. | same |

The test runs in the normal `npm test` suite, so CI enforces it on every pull request.

## Status rules

- **Evidence** is `accepted` only with a reviewer, a review date, an expiry, and a `sha256:` content hash of an artifact that exists in the repository. Anything not yet produced is `draft`. Nothing is accepted in this tranche.
- **Scenarios** are `specified` until a test implements them, `implemented` when the test exists, and `verified` only when it passes in CI with the result linked to evidence. All six are `specified`.
- **Controls** are claimed only when their evidence is accepted. None is claimed yet.

## Not done (remaining tranche)

- Controls for audit, privacy, accessibility, and incident response (tranche item 2).
- Implementing AT-RDY-001 to 006 as tests against the readiness service (item 3).
- Student and registrar journey checklists, JNY-RDY-001 (item 4).
- Support intake form, routing, and safe macros (item 5).
- Pilot metric instrumentation with correlation IDs (item 6).
- Stale-source, revocation, duplicate-delivery, and rollback drills (item 7).
- Go/no-go record and the tenant-scoped feature flag (item 8). Not to be enabled until every evidence entry it depends on is accepted.

## Choices made

- JSON, not YAML. `app/` has no YAML parser, and this adds no dependency.
- `evidence_types` was extended with five types the brief's invalidation rules use but its type list omits: `source_freshness_drill`, `provider_sandbox_verification`, `controlled_action_approval_test`, `source_status_copy_review`, `student_training_material`.
- `EVD-RDY-SRC-001` and `EVD-RDY-WF-001` are placeholder drafts created for CTRL-SOURCE-002 and CTRL-WORKFLOW-003, which the brief left without named evidence. They describe what must be produced; they do not claim it exists.
- The readiness-is-not-enrollment decision is recorded as a `D-<pull request number>.md` decision (D-1542), per `docs/decisions/README.md`. The pilot brief's ADR proposal is not given a number here, because `ADR-0014` already names a different decision.
