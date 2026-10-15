# Product system — the rest of Semester (from "continue detailing outlining building enhancing st.pdf")

The PDF's 30 build artifacts, written. Semester organizes, explains and routes; the institution keeps authority over official records, enrollment, grades, aid, housing assignments and other decisions unless a separately approved command path exists.

## The 30 artifacts
| # | File | Notes |
|---|---|---|
| 1 | registry/workspaces/student.yaml | 7 areas, 5 mobile destinations, non-promises |
| 2 | registry/capabilities/action-center.yaml | ranking constraints + three standard copy lines |
| 3 | contracts/openapi/actions.v1.yaml | list + dismiss; **required notices return 409 on dismiss** |
| 4 | packages/domain-core/student-action.schema.ts.txt | zod + `rank()` (required first, then urgency, then freshness) + `canDismiss` |
| 5 | Today page | **not written as code** — the repo screen is `app/src/screens/Today.tsx`; design reference `ui_kits/student/` |
| 6 | tests/e2e/student-action-center.spec.ts.txt | why-it-appears, stale copy, required notice undismissable, never "enrolled", private task |
| 7 | docs/domains/plan-roadmap.yaml | phase gate: phase N at Level 4 before phase N+1 |
| 8–9 | degree-scenarios.yaml + degree-scenario.schema.ts.txt | a student can't mark a course completed; "reviewed" must cite the official audit |
| 10–11 | study-studio-policy.yaml + course-source-packet.yaml | course AI policy overrides Studio defaults; ECON 1020 / BUS 1400 as examples |
| 12–14 | course-studio.yaml + course-grading.rego + grade-release.ts.txt + grade-release.spec.ts.txt | grade state transitions; guard + rego twin |
| 15 | help-handoff.yaml | routes; the receiving office's case system stays authoritative |
| 16–18 | report-workflow.yaml, campus-boundary.yaml, money-boundary.yaml | appeal reviewer ≠ original moderator; refunds only from settled |
| 19–21 | delegated-access.yaml + delegation.rego + delegated-access.spec.ts.txt | expiry, revocation, prohibited scopes, relationship claim grants nothing |
| 22 | privacy-center.yaml | a setting not enforced server-side isn't shown as a control |
| 23–24 | docs/ai/gateway-flow.yaml, registry/ai/AI-READINESS-001.yaml | points at the one traceability passport |
| 25–26 | institution-console.yaml, workflows/approval.yaml | approval expires when its input digest changes |
| 27–30 | external-audiences, student-lifecycle, mobile offline contract, accessibility completion plan | |

## Corrections and additions to the PDF
- **Grade release:** the registrar can release only `approved_for_release`, not a merely `reviewed` draft; the actor must be assigned to the course; a grade with no score or already synchronized can't be released.
- **Required notices** can't be dismissed (contract returns 409; the schema has `required`).
- **Source-backed actions** need `sourceReference` and `observedAt`; a stale source can't drive an "attention" item straight to "open" without a review or handoff step.
- **Degree scenarios:** "reviewed" must cite the official audit compared against.

## Run here
The grade-release guard and refund rule were run as JavaScript against the 11 test cases in `grade-release.spec`: **11/11**. `rank()` orders a required low-urgency notice above an urgent optional one, and current above stale. Nothing else was run (no Node test runner, OPA or Postgres).

## Sequencing rule
Don't build autonomous advising, full financial aid, official enrollment writes, marketplace matching from institutional records, or generalized student-risk scoring until the shared foundation proves tenant isolation, authority/freshness behaviour, consent/delegation, workflow durability, staff scopes, AI boundaries and release evidence.
