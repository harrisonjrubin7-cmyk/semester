# Build coverage: continuation brief, next 30 artifacts

Source: the Semester continuation brief ("detailing, outlining, building, enhancing the rest of Semester"). Status vocabulary: **specified** (written as a spec, no code), **implemented** (code and tests in the repo, verified by the commands listed), **blocked** (waiting on a named decision), **not started**.

Status is per artifact. Nothing here is deployed. Deployment status is tracked separately, in the release notes for each change.

## Layout decision pending

The brief places registry files under `registry/`, `contracts/`, and `packages/policy/`. The repo already has a registry at `packages/platform-control/registry/` (validated by `npm run registry:validate`). Until the layout is decided, every artifact that would become a second registry is **blocked** rather than created in a new top-level directory.

## The 30 artifacts

| # | Artifact (brief path) | Status | Where it is, or what blocks it |
|---|---|---|---|
| 1 | `registry/workspaces/student.yaml` | blocked | Layout decision. Content is in the brief's student-workspace section. |
| 2 | `registry/capabilities/action-center.yaml` | blocked | Layout decision. |
| 3 | `contracts/openapi/actions.v1.yaml` | not started | No API design yet. |
| 4 | `packages/domain-core/student-action.schema.ts` | implemented (named `actions.ts`) | `packages/domain-core/src/actions.ts`. Plain TypeScript, not a zod schema. |
| 5 | `apps/student-web/app/today/page.tsx` | not started | Out of "foundations first" scope. The Today action center already exists in `app/src/components/TodayActionCenter.tsx`. |
| 6 | `tests/e2e/student-action-center.spec.ts` | not started | Depends on item 5. |
| 7 | `docs/domains/plan-roadmap.yaml` | specified | Has one truncated sentence, marked in the file. |
| 8 | `registry/capabilities/degree-scenarios.yaml` | blocked | Layout decision. |
| 9 | `packages/domain-core/degree-scenario.schema.ts` | implemented (named `degree.ts`) | `packages/domain-core/src/degree.ts`. The disclaimer text is cut off in the source PDF, so only "required and non-empty" is enforced. |
| 10 | `docs/domains/study-studio-policy.yaml` | specified | Includes the course source packet rules. |
| 11 | `registry/learning/course-source-packet.yaml` | blocked | Layout decision. Rules are in item 10. |
| 12 | `registry/capabilities/course-studio.yaml` | blocked | Layout decision. |
| 13 | `packages/policy/course-grading.rego` | not started | OPA is not installed here, so Rego cannot be tested. The release rule is implemented in TypeScript instead (item 14). |
| 14 | `tests/workflows/grade-release.spec.ts` | implemented as unit tests | `canReleaseGrade` is in `packages/domain-core/src/grades.ts`, covered by `packages/domain-core/src/domain-core.test.ts`. No browser workflow test yet. |
| 15 | `registry/capabilities/help-handoff.yaml` | blocked | Layout decision. |
| 16 | `docs/community/report-workflow.yaml` | specified | |
| 17 | `docs/domains/campus-boundary.yaml` | specified | |
| 18 | `docs/domains/money-boundary.yaml` | specified | Two boundary sentences are cut off in the source PDF, marked in the file. Payment states are in `packages/domain-core/src/payments.ts`. |
| 19 | `registry/capabilities/delegated-access.yaml` | blocked | Layout decision. |
| 20 | `packages/policy/delegation.rego` | not started | Same OPA limitation as item 13. |
| 21 | `tests/rls/delegated-access.spec.ts` | not started | The repo already has RLS suites as `supabase/*.check.sql`. The delegation suite should be added there, not as a new `tests/rls/` tree. |
| 22 | `registry/capabilities/privacy-center.yaml` | blocked | Layout decision. |
| 23 | `docs/ai/gateway-flow.yaml` | specified | Runtime contract is `AIAnswerFrame` in `packages/domain-core/src/ai.ts`. |
| 24 | `registry/ai/AI-READINESS-001.yaml` | not started | The brief names this file but gives no content for it. |
| 25 | `registry/workspaces/institution-console.yaml` | blocked | Layout decision. |
| 26 | `registry/workflows/approval.yaml` | blocked | Layout decision. |
| 27 | `docs/external-audiences/boundaries.yaml` | specified | |
| 28 | `docs/lifecycle/student-lifecycle.yaml` | specified | |
| 29 | `docs/mobile/offline-contract.yaml` | specified | |
| 30 | `docs/accessibility/completion-plan.yaml` | specified | |

Also in the brief, not in the numbered 30: `docs/product/product-system.yaml` (specified), `docs/design/shipping-rules.yaml`, `docs/domains/services-roadmap.yaml`, and `docs/domains/career-roadmap.yaml` (all not started, though their content is in the brief).

## Counts

Of the 30 numbered artifacts:

- Implemented: 3 (items 4, 9, and 14 as unit tests).
- Specified: 10 (items 7, 10, 16, 17, 18, 23, 27, 28, 29, 30).
- Blocked on layout: 10 (items 1, 2, 8, 11, 12, 15, 19, 22, 25, 26).
- Not started: 7 (items 3, 5, 6, 13, 20, 21, 24).

Extras from the brief's text: `product-system.yaml` is specified. `shipping-rules.yaml`, `services-roadmap.yaml`, and `career-roadmap.yaml` are not started.

## Known gaps in the source material

- Truncated sentences in the PDF extract: `plan-roadmap.yaml` (hard boundary 3), `money-boundary.yaml` (two boundaries), and the degree scenario disclaimer text. Each is marked in its file. Wording must be confirmed before any of it reaches a student.
- The brief sets a sequencing rule: broad experiences (autonomous advising, full aid, official enrollment writes, generalized risk scoring) wait until the shared foundations are proven. Nothing in this change touches those areas.
