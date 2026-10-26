# 01 · Master roadmap

> Part of the [program pack](README.md). Sequenced by gate, not by date: the
> repository has no start date, funding or customer (RAID-A01), so a calendar
> here would be invented. Stage order is fixed by the dependencies in
> [02](02-DEPENDENCIES-AND-CRITICAL-PATH.md); durations are the repository's own
> ranges and live there.

## Two tracks

| Track | What it is | Gated by | Status |
| --- | --- | --- | --- |
| **A. Validate and launch the current product** | The four motions of [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md), in order | the 18 external evidence items and the program's own nodes | the critical path in 02 |
| **B. Convert to the target architecture** | The CTO pack's waves C0–C7 and milestones M0–M7 ([D-1144](../decisions/D-1144.md), *proposed*) | funding, hires and a T0 that do not exist | not started; no node of Track A requires it |

The audit that prompted this program asks for a native, replace-everything
platform from the first day. The repository's controlling decision allows only
the four motions and forbids replacement claims until repeated deployments exist.
The tracks reconcile that without dropping either: Track A is what can be
shown to a student or an institution now; Track B is how the product is rebuilt
so that later claims have somewhere to stand. Track A's outputs (representative
UAT, tenant isolation results, a measured pilot) are the inputs Track B's M1–M3
say they need, so A feeds B and B does not gate A (RAID-R07, RAID-R08).

## Stages

A stage is entered when its gate is true, not when a week passes.

| Stage | Entered when | Motion it unlocks | Gate nodes |
| --- | --- | --- | --- |
| **S0 Now** | today | design-partner discovery with synthetic data, inside the non-activation boundary | none; already authorized |
| **S1 Candidate** | an immutable SHA has a finished green hosted CI run | the candidate-bound reviews can begin | PGM-01 |
| **S2 Target** | the authorized target environment exists, backups and rota are named | drills, DAST, monitoring and tenant tests can run | PGM-02, EXT-009 |
| **S3 Individual GO** | the individual gates pass and the council signs | invitation-only, unpaid individual validation | PGM-08 |
| **S4 Activation GO** | the institutional gates pass and the council signs | one design-partner cohort on live data | PGM-07 |
| **S5 Pilot** | the activation record exists | the cohort runs; hypercare; midpoint report | PGM-06 |
| **S6 Decision** | the measured closeout is accepted | reconsider a paid pilot | EXT-004, EXT-005, EXT-017 |
| **S7 Repeat** | more than one scoped deployment has closed | reconsider broad enterprise sale | PGM-09, EXT-016, EXT-018 |

## Workstreams across the stages

Each cell says what the workstream owns at that point. "Home" is the document
that already holds the detail; this page does not copy it.

| Workstream | S0 to S1 | S2 to S3 | S4 to S5 | Home |
| --- | --- | --- | --- | --- |
| **Product** | pick the first cohort (`icp-cohort`); keep the golden path scripted; keep known limitations current | representative student UAT (PGM-04); agree outcomes and stop criteria | UAT with the customer (EXT-014); baseline (EXT-015); midpoint report | [`GOLDEN-PATH-TEST-SCRIPT.md`](../GOLDEN-PATH-TEST-SCRIPT.md), [`KNOWN-LIMITATIONS.md`](../launch/KNOWN-LIMITATIONS.md), [`PRIVATE-BETA-PROGRAM.md`](../PRIVATE-BETA-PROGRAM.md) |
| **Engineering** | freeze a candidate (PGM-01); decide how it is cut (PDR-01); PostgreSQL 17 suites | stand up the target (PGM-02); drills (EXT-011); account lifecycle (PGM-05) | tenant configuration and isolation (EXT-013); hypercare fixes | [`REGRESSION-CHECKLIST.md`](../../REGRESSION-CHECKLIST.md), [`RESTORE.md`](../../RESTORE.md), [`ROLLBACK.md`](../../ROLLBACK.md) |
| **Security** | triage the HawkScan runs already on `main` (RAID-I01); pin scope for the independent review | independent review and penetration test (EXT-006); candidate-bound DAST (EXT-007) | target tenant isolation and audit export | [`SECURITY.md`](../../SECURITY.md), [`SECRETS.md`](../../SECRETS.md) |
| **Privacy** | data inventory against the code; retention and legal-hold decisions | rights, deletion and offboarding drills (EXT-011); provider terms (EXT-017) | customer data map and role determination (EXT-012) | [`DATA-RIGHTS-REQUEST-RUNBOOK.md`](../DATA-RIGHTS-REQUEST-RUNBOOK.md), [`SCHOOL-OFFBOARDING.md`](../SCHOOL-OFFBOARDING.md), [`SUBPROCESSORS.md`](../SUBPROCESSORS.md) |
| **Accessibility** | freeze the critical journeys; brief the evaluator | qualified evaluation, remediation, retest, and the approved status language (EXT-008) | customer accessibility review | [`ACCESSIBILITY-CONFORMANCE-PLAN.md`](../market-readiness/ACCESSIBILITY-CONFORMANCE-PLAN.md) |
| **AI** | keep the kill-switch drill and injection run current (valid to 2026-12-29); record that the institution gateway is not deployed | re-run both against the candidate; human-confirmation policy proved on the target | tenant AI policy configured per cohort; incident path rehearsed | [`AI-RECOMMENDATION-EVALUATION-HARNESS.md`](../AI-RECOMMENDATION-EVALUATION-HARNESS.md), [`AI-GOVERNANCE-BOARD.md`](../operating-model/AI-GOVERNANCE-BOARD.md) |
| **Integrations** | none: the manual-data profile needs no connector | provider approvals (EXT-017) | identity setup (SSO or invite-only) and any connector, one at a time (EXT-018) | [`INTEGRATION-OPERATOR-RUNBOOK.md`](../INTEGRATION-OPERATOR-RUNBOOK.md), [`INSTITUTIONAL-SSO-LAUNCH-READINESS.md`](../INSTITUTIONAL-SSO-LAUNCH-READINESS.md) |
| **Go-to-market** | discovery on synthetic data; every claim through the claims register; recruit the beta (`recruit-beta`) | the invitation-only validation cohort | the pilot charter and, after closeout, the annual proposal | [`INSTITUTIONAL-GTM-PLAYBOOK.md`](../INSTITUTIONAL-GTM-PLAYBOOK.md), [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) |
| **Operations and support** | name backups and the rota (EXT-009); support hours | alert tests and incident exercise (EXT-010) | hypercare; weekly operations review | [`LAUNCH-WAR-ROOM.md`](../LAUNCH-WAR-ROOM.md), [`MONITORING.md`](../../MONITORING.md) |
| **Legal, finance** | entity facts (EXT-001); counsel engaged (PDR-04) | public policies (EXT-002); institutional paper (EXT-003) | executed pilot paper; later tax, insurance and price (EXT-004, EXT-005) | [`EXTERNAL-EVIDENCE-QUEUE.md`](../finalization/EXTERNAL-EVIDENCE-QUEUE.md), [`COUNSEL-BRIEF.md`](../COUNSEL-BRIEF.md) |

## Track B milestones, as the CTO pack states them

For reference only; they are proposals, relative to a T0 that does not exist,
and the pack records them in
[08 · Organization and milestones](../target-architecture/08-ORGANIZATION-AND-MILESTONES.md).

| Milestone | Outcome | Exit gate (pack's wording, abridged) |
| --- | --- | --- |
| M0 Foundation | workspace, boundaries, forced RLS, policy decision point on ten actions, second operator | same suite green; restore drill passed |
| M1 Student OS on the spine | productivity and assistant on the new core; ring 0 live | offline conflict simulator green; AI policy and injection gates |
| M2 Mobile and offline | Capacitor apps; encrypted local store | WebView go/no-go spike passed |
| M3 Academic core | catalog, enrollment, gradebook native; first real SIS/IdP integration | grade-change dual-control test; reconciliation on a real extract |
| M4–M7 | campus and family, commerce and career, replacement readiness, scale | per the pack |

Critical path inside Track B, as the pack states it:
`M0 → (M1 ∥ M2) → M3 → M5/M6`. Its riskiest unknowns are early on purpose; the
first real SIS/IdP integration (M3) cannot be scoped until a design partner
exists, which is PGM-03 in Track A.
