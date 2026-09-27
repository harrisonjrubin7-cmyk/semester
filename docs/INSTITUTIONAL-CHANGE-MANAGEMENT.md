# Institutional change management

Part 14 of the expansion command. Phase 6. Nothing here is built yet.

## What exists on main

- Rollout records: [`PILOT.md`](../PILOT.md), [`CHANGELOG.md`](../CHANGELOG.md),
  `docs/institutional-rollout/`, `docs/market-readiness/PILOT_PLAYBOOK.md` and
  `docs/market-readiness/UNIVERSITY_ONBOARDING.md`.
- Readiness tooling: `app/src/lib/rollout-capabilities.ts`,
  `app/src/lib/rollout-traceability.ts`, `app/src/lib/readiness.ts`, and the
  control plane `app/src/components/institutional/ControlPlane.tsx` behind
  `universityControlPlane`.
- Policy versioning with audit: `tenant_feature_policy` + `ai_policy` →
  `tenant_policy_audit_event`.
- Aggregates with a floor: `course_demand_snapshots` and `outcome_aggregates`
  enforce `n >= 10` by check constraint.
- `public.feedback` for feedback; the `cohort` scope kind on `role_grants`.

## In flight

Nothing directly.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `stakeholders` | **New** | Name, office, role in the rollout, contact |
| `governance_committees`, `governance_memberships` | **New** | |
| `policy_approval_workflows`, `policy_approval_steps` | **New**, referencing the `tenant_policy_audit_event` each step produces | Approval precedes the change the audit already records |
| `change_impact_assessments` | **New** | |
| `training_assignments`, `training_completions` | **New**, staff only | |
| `communication_templates`, `communication_campaigns` | **New** | Tenant-editable, checked for accessibility before sending |
| `adoption_aggregate_metrics` | **New**, with the same `n >= 10` check constraint | |
| `feedback_items`, `feedback_responses` | **Reuse** `feedback` + a response table | |
| `pilot_cohorts`, `pilot_memberships` | **New** `pilot_cohorts`; membership is a `role_grants` row at `cohort` scope | Reuses scoping that exists |
| `staff_feature_requests`, `staff_feature_votes` | **New**, staff roles only | |
| `institutional_roadmap_items` | **New** | |
| `release_note_targeting` | **Column** on a release-notes table | |

## Capabilities and flags

- **`governance:manage`** and **`training:assign`**, new, at `school` scope.
- Reading adoption metrics: `outcomes:read` (exists).
- Flag `university.change_management`, `off`.

## Hard boundaries

- **Adoption heatmaps are aggregates with a floor of ten,** enforced by the
  database, not the chart. There is no drill-down to a student.
- Training is for staff. Nothing in this part tracks a student.
- Feature voting is by staff roles; students are not ranked, polled for
  popularity, or shown vote counts.
- A policy approval is versioned and reversible: reversing it is a new approved
  step, not an edit.

## Tests

- An aggregate below ten is refused by the check constraint (`.check.sql`).
- A campaign template missing alt text or a plain-text part fails its
  accessibility check.
- Reversing an approved policy produces a new audit row and restores the prior
  state.
