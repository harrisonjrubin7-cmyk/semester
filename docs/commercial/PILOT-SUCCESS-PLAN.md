# Pilot Success Plan

| Control | Value |
| --- | --- |
| Status | **CONTROLLED TEMPLATE — BASELINES/TARGETS/SOURCES/APPROVALS REQUIRED BEFORE LAUNCH** |
| Owner | Harrison Rubin — company-side measurement owner; customer sponsor, privacy reviewer, analyst and backup owner unassigned |
| Evidence date | 2026-10-03 at repository revision `9b866db3` |
| Source | [`../market-readiness/PILOT-SUCCESS-PLAN.md`](../market-readiness/PILOT-SUCCESS-PLAN.md) |

## Decision contract

Before activation, the customer and Semester must approve the eligible population, baseline, target/range, numerator/denominator, source, event/query version, exclusions, owner, cadence, privacy threshold, qualitative method, guardrail, interpretation limits, decision date and conversion/offboarding rule for every measure. A blank or unvalidated source means the metric is not launch-ready.

| Measure | Required definition | Current state |
| --- | --- | --- |
| eligible cohort activation | consented participants completing approved setup / eligible invited population | **[BASELINE, TARGET, OWNER, SOURCE REQUIRED]**; invitation is not activation |
| first win | participant who completed approved minimum setup, reaches Today, understands one relevant prioritized reversible action and its source/limitations, knows the relevant help route, and intentionally completes, schedules, snoozes or defers it | proposed definition aligned to the product specification; a full first-week plan is not an extra gate; each decision outcome and coarse comprehension/help check must remain distinguishable; target event and sample QA unaccepted |
| meaningful weekly planning | participant completes an approved planning action; raw login excluded | proposed aggregate; field source unaccepted |
| approved readiness progress | approved non-authoritative checklist progress | not proof of official registration or eligibility |
| time to first value | consented start to validated first win within a fixed observation window; incomplete attempts remain censored and their count/share is reported beside the completion-time distribution | unmeasured; exclude test/support and invalid attempts only |
| reliability/recovery | successful core attempts plus user-safe recovery under approved SLI | objective only; no achieved SLA/uptime |
| support burden | volume/severity, staffed-hours response and unresolved age | channel/hours/targets/owners unapproved |
| trust/usefulness | approved survey/interview on clarity, agency, source visibility and friction | self-reported, non-causal |

## Cadence and decisions

- **Pre-launch:** approve scope/baseline, data/consent/privacy, accessibility UAT, support/recovery, stop rules and offboarding.
- **Weekly:** review denominators, data quality, first win/engagement, reliability/support, guardrails, incidents, scope changes and owner actions.
- **Midpoint:** continue, correct, pause or stop based on evidence and participant harm—not adoption alone.
- **Final:** report results with missingness/caveats, rights/incidents/support summary and sponsor decision: convert conditionally, extend only under approved change, or offboard.

Suppress reporting below the customer-approved privacy threshold; the current proposal is at least 10 people. Never expose individual risk or sensitive-domain signals. Do not infer retention, GPA, graduation, wellbeing or causal institutional impact from usage or self-report.

## Evidence state

**Repository evidence.** Proposed metric definitions, privacy controls, critical flows and pilot governance support this template.

**Operational evidence.** No named cohort baseline, accepted event/query set, customer-approved thresholds, representative results or causal evaluation exists.

**Missing test/proof.** Complete the metric dictionary and data-quality tests; obtain privacy/accessibility/customer approval; capture baseline; validate events against samples; assign owners/backups; run reporting rehearsal and approve conversion/offboarding criteria.

## Claim ceiling

Semester may describe a proposed measurement and decision framework. It may report only approved, observed results with population, window, source and caveats.

## Prohibited claims

Do not claim pilot success, adoption, time savings, retention/GPA/graduation improvement, causal impact, reliability achievement or customer validation from targets, synthetic data, raw logins or incomplete denominators.
