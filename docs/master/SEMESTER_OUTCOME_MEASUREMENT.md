# Semester outcome measurement and moat

**As of** 2026-10-05 · **Base** origin/main 790ebbf · **Part of** [`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md)

> **Claim ceiling.** **No outcome baseline exists** (EXT-015 is blocked on a named customer) and no outcome has been measured. Public outcome claims (GPA, retention, ROI, savings) are prohibited (CLM-014, CLM-015). Every target below is a *hypothesis to be tested in a pilot*, marked **H**. Nothing here is evidence of an effect.

Outcomes are what justify replacement. A domain is not replaced because it is built; it is replaced when an institution can see that the replacement does at least as well for the people it serves, and can show it. This page fixes **what is measured, how, with what limits, and what would make Semester stop**.

## Measurement ethics, applied to every metric

From `docs/PRODUCT-ANALYTICS-DATA-ETHICS.md` and the brief's analytics rules.

1. **Aggregates by default;** minimum cohort size 10 before any sensitive group statistic is shown, with complementary suppression (`lib/institution-ops.ts`; `docs/platform/PRIMITIVES.md` reporting rule).
2. **Every metric has a visible definition,** its source, freshness and coverage.
3. **No opaque risk scores.** Anything ranked carries its reason, inputs and limits (`docs/DO-NOT-BUILD.md` rule 3).
4. **Separate correlation from causation.** A pilot comparison is stated as such.
5. **No automated punitive decisions.** Metrics inform humans.
6. **Students see what signals exist,** why, and how they affect recommendations.
7. **No engagement surveillance.** Learning signals are purposeful: submitted work, objective completion, practice, plan progress, optional self-checks, feedback cycles, resource usefulness, support requests, self-reported confidence. Unrelated behavioural data is not scored.

## The measurement stack

| Layer | Question | Examples | Who sees it |
| --- | --- | --- | --- |
| Product health | Does it work and do people come back? | Weekly active share; time to first action; error rate | Semester |
| Student outcome | Did the student do better? | Deadline-miss rate; plan adherence; self-reported confidence; GPA movement (cohort, aggregated, with comparison) | Student (own); institution (aggregate) |
| Operational outcome | Did a process improve? | Advising wait; registration errors; support resolution time; handoff completion | Institution |
| Institutional outcome | Did the institution gain? | Retention proxy; staff hours saved; systems retired | Institution leadership |
| Commercial outcome | Is it a business? | Pilot-to-annual conversion; net revenue retention; cost per active student | Semester |
| Platform outcome | Does the ecosystem grow? | Certified integrations; time to first API call | Semester, partners |

## Metric dictionary

Each metric has an id, definition, source, population, window, limits and a baseline state. Baselines are all **none** today.

| ID | Metric | Definition | Source | Limits | Baseline | Target (H) |
| --- | --- | --- | --- | --- | --- | --- |
| M-01 | Weekly active share | Students with at least one Today action in the week ÷ invited cohort | Product events (`docs/ANALYTICS-EVENTS.md`) | Measures use, not value | none | Set after first cohort |
| M-02 | Time to first win | Minutes from first open to first completed action | Events | Onboarding-sensitive | none | `docs/product-design/FIRST-WIN-SPECIFICATION.md` sets the win |
| M-03 | Deadline-miss rate | Missed ÷ tracked deadlines, self-reported or matched to LMS | Student plus feed | Self-report bias | none | Reduction vs the same students' prior term (**H**) |
| M-04 | Plan adherence | Planned work done ÷ planned | Plan data | Student-defined | none | |
| M-05 | Source-labelled facts | Share of institutional facts shown with a source and freshness | Registry | Internal quality | measurable now | 100% |
| M-06 | Support resolution time | Median hours from request to owner-confirmed resolution | Tickets | Needs staffed offices | none | Set with the office |
| M-07 | Repeat-issue rate | Requests re-opened or repeated within 30 days | Tickets | | none | |
| M-08 | Registration errors | Duplicate or over-capacity registrations | Registration ledger | Needs live registration | none | **0** (hard) |
| M-09 | Advising wait | Median days to appointment | Scheduler | Needs integration | none | |
| M-10 | Grade discrepancy | Differences between native and LMS gradebook during dual-run | Reconciliation | | none | **0 unexplained** (hard) |
| M-11 | Audit agreement | Degree-audit agreement rate by program during parallel run | Reconciliation | | none | Per program (**H**) |
| M-12 | Systems retired | Institutional systems switched off with sign-off | Change records | | none | The point of replacement |
| M-13 | Pilot-to-annual conversion | Pilots converting ÷ pilots ended | CRM | Needs pilots | none | 50% (finance model hypothesis) |
| M-14 | Net revenue retention | | Billing | Needs customers | none | |
| M-15 | AI refusal correctness | Correct policy refusals ÷ cases on the evaluation set | Eval harness | Eval coverage | one red-team run | Set per role |
| M-16 | Cited-answer rate | AI answers with a resolvable citation | Eval | | none | |
| M-17 | Cost per attaching student | AI cost ÷ students using AI | Usage meters | Vendor prices are illustrative | model only | Within the finance model's assumption |
| M-18 | Restore time | Measured minutes to restore the live project | Drill | | **none: never run** | RTO class target |
| M-19 | Alert-to-human time | Minutes from alert to a person acknowledging | Alert test | | **none: no alerts** | |
| M-20 | Accessibility conformance | Screens passing an independent evaluation ÷ screens in scope | Evaluation | Needs EXT-008 | none | |
| M-21 | Open High findings | Count | Findings register | | 2 | 0 |
| M-22 | Main-green rate | Green ÷ runs on `main` over 30 days | CI | | 4 of 30 | ≥ 95% |

## Evaluation design for a pilot

A pilot is an experiment with an agreed protocol, written before it starts.

| Element | Requirement |
| --- | --- |
| Question | One or two outcomes the institution chose, from the metric dictionary |
| Unit | A course section, a cohort, an office, or a registration window |
| Comparison | Prior-term same-population baseline, and where possible a concurrent comparison group; stated as such |
| Duration | At least one term for academic outcomes; one window for registration |
| Pre-registration | Metric definitions and success thresholds recorded before data collection (`docs/commercial/PILOT-SCORECARD.md`, `PILOT-SUCCESS-PLAN.md`) |
| Data | Aggregates; cohort size ≥ 10; consent for individual-level use |
| Reporting | The scorecard, including negative results; an independent reader reviews it |
| Stop | Pre-agreed kill criteria (below) |

## Kill criteria

A pilot or domain stops, and the claim is withdrawn, if any holds. These are the repository's practice (`docs/strategy/MOAT-PLAN.md` carries kill criteria per dimension).

- A tenant-isolation breach, or a High finding open past its date.
- A unexplained grade, registration or ledger discrepancy that is not resolved within the agreed time.
- An outcome measured worse than baseline with confidence the protocol set.
- A support or safety handoff that fails to reach a human.
- Student reports of surveillance or loss of control that the institution upholds.

## Moat

`docs/strategy/MOAT-PLAN.md` sorts candidates into **table stakes**, **differentiator** and **candidate moat**, and states plainly that **today nothing is an evidenced moat**; it is a plan to build ones that can be shown. This page adds the measurement that would prove each one. The hypotheses are the repository's, restated; none is a claim.

| Candidate moat | Why it could compound | What proves it | Kill criterion |
| --- | --- | --- | --- |
| The connected, governed spine (identity → consent → audit → outcome) shared by every domain | Competitors have point products with separate permission and audit models; converging them is slow | An institution runs two or more domains through one policy and one audit, and an auditor accepts it | A second domain needs bespoke policy code |
| Reconciled history (dual-run evidence) | Each reconciled term is evidence that cannot be copied, only accumulated | Count of clean reconciled units per domain per tenant (M-10, M-11) | A reconciliation cannot be made clean |
| Student-owned portable record and consent | Students bring it with them; institutions that integrate gain adoption | Students who keep using Semester across a transfer; exports used elsewhere | No transfer use after two terms |
| Trust evidence | Counsel-reviewed paper, assessments, certifications take years and cannot be bought | The evidence queue closed (EXT-001..018) | A certification fails |
| Operating data on what works for support and planning | Needs scale and consent | Outcomes at ≥ 3 tenants with the same protocol | No effect after three tenants |
| Integrations certified and in use | A partner ecosystem is slow to build and sticky once built | Certified integration count; time-to-connect | Partners build around it rather than on it |

**What is not a moat:** feature count; access to a frontier AI model; the volume of student data (education records are institution-owned and consent-bound).

## Reporting cadence

| Report | Audience | Cadence | Gate |
| --- | --- | --- | --- |
| Product health | Founder | Weekly | None |
| Pilot scorecard | Institution and Semester | Monthly during a pilot | Protocol |
| Outcome review | Institution leadership | End of term | Independent reader |
| Evidence-queue report | Founder, counsel | Monthly | |
| Board package | Board | Quarterly | Finance real numbers first |

## First measurements to take (this quarter, no customer needed)

1. M-18 restore time, M-19 alert-to-human time, M-21 findings, M-22 main-green rate: these are Semester's own and are measurable now.
2. M-05 source-labelled facts coverage: a repository measurement.
3. M-15 and M-16: expand the AI evaluation set to every role and run it on every model change.
4. The pilot protocol template, filled for a hypothetical design partner, so that discovery interviews can recruit against it.
