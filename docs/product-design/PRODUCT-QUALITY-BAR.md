# Product Quality Bar

| Control | Value |
| --- | --- |
| Status | **CONTROLLED RELEASE STANDARD — OPERATING ACCEPTANCE REQUIRED PER SCOPE** |
| Owner | Harrison Rubin — company-side Product, Design, Engineering, Accessibility, Security/Privacy and Support coordination; backup and customer approver unassigned |
| Evidence date | 2026-10-03 at repository revision `8fc5fd56` |

## Release rule

A feature is ready only when a target user can complete the intended job safely, understandably and recoverably in the actual release scope. Visual polish or passing unit tests cannot compensate for a critical accessibility, authorization, privacy, reliability, support or truth gap. Averages do not erase blockers.

## Quality dimensions

| Dimension | Required outcome | Minimum evidence |
| --- | --- | --- |
| User value | defined user/job, expected outcome and non-goal; no unnecessary feature duplication | approved brief plus observed task evidence appropriate to stage |
| Coherence | fits canonical navigation, object, action, state and language patterns | design review and shared-component mapping |
| Usability | purpose and next action are clear; task completes without avoidable confusion | representative moderated/unmoderated task evidence |
| Accessibility | keyboard, focus, names/roles/states, contrast, touch, screen reader, zoom/reflow, reduced motion and alternatives work | automated checks plus manual scoped review |
| Trust and data | source, freshness, uncertainty, authority, privacy and AI status are accurate at decision points | source/data map and route-level inspection |
| State resilience | empty, loading, saving, success, stale, offline/degraded, restricted, error and recovery are intentional | journey/state matrix with exercised results |
| Responsive quality | task and reading order work across required widths and long/translated content | viewport/device/browser evidence |
| Performance | response, loading and bundle behavior meet approved budgets without deceptive feedback | repeatable lab results and, when available, privacy-safe field evidence |
| Safety and security | authorization, validation, fail-safe behavior and high-impact boundaries are tested | relevant trust/engineering gate evidence |
| Supportability | help, diagnosis, rollback, known limitations and accountable owner exist | support script/runbook and exercised escalation |
| Operability | monitoring, release, rollback, incident and recovery controls match the scope | target-environment records and owner acceptance |
| Commercial/institutional truth | packaging, claims and customer authority match what is actually available | approved scope and claims review |

## Stage gates

| Stage | Quality evidence |
| --- | --- |
| Internal | synthetic/test data, focused automated checks, design review, known gaps and safe rollback |
| Design partner | narrow permissioned cohort, direct observation, accessible feedback and incident/support coverage |
| Pilot | executed scope, real target users, approved success measures, target configuration, UAT and staffed operations |
| General availability | repeated outcomes, reliability/accessibility/security evidence, support capacity and approved public claims |
| Enterprise | contractual, migration, integration, audit, recovery and support commitments are demonstrated and accepted |

Promotion is sequential. Evidence from code or an internal demonstration does not skip design-partner or pilot proof.

## Required release record

Feature/version; user and job; owner/back-up; routes/components/data; stage and cohort; success and guardrail measures; design/accessibility review; state/responsive matrix; test/build/performance results; security/privacy/AI review; documentation/support; flags/rollback; known limitations; target acceptance; decision, approvers, date and evidence links.

## Stop-ship conditions

Unclear accountable owner; inaccessible primary journey; unauthorized or misleading data; unsupported official/high-impact claim; destructive action without recovery; missing critical state; no safe rollback for material risk; unresolved P0/P1 defect; failed critical evaluation; target configuration unknown; or support/incident path unavailable.

## Evidence state

**Code/config evidence.** [`QUALITY-MANAGEMENT.md`](../operating-model/QUALITY-MANAGEMENT.md), [`DEFINITION-OF-DONE.md`](../DEFINITION-OF-DONE.md), automated app tests and release controls define substantial technical gates.

**Operational evidence.** No complete release record, observed student quality study, approved performance budget set or named-customer acceptance covers the entire product. Existing evidence remains feature- and date-specific.

**Missing test/proof.** Approve measurable thresholds; execute the first-win, core-journey, accessibility, responsive, performance and recovery plans; record defects and owner decisions; obtain customer acceptance where required.

## Claim ceiling

Semester may say it has a documented cross-functional product quality bar and extensive repository checks. A feature may be called tested only with the exact tests and scope stated.

## Prohibited claims

Do not claim launch readiness, market-leading quality, WCAG conformance, user success, enterprise readiness or institutional acceptance from this standard alone.
