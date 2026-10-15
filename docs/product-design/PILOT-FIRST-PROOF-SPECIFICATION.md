# Institutional Pilot First-Proof Specification

| Control | Value |
| --- | --- |
| Status | **CONTROLLED PILOT SPECIFICATION — NO NAMED-CUSTOMER PROOF FILED** |
| Owner | Harrison Rubin — company-side Product and Customer Success; backup and named customer sponsor unassigned |
| Evidence date | 2026-10-03 at repository revision `d246a348` |
| Scope | One bounded institution, cohort, workflow and decision period |

## Definition

The pilot first proof occurs when a named institution and Semester jointly demonstrate that an approved cohort can complete one bounded workflow in the target environment, obtain the agreed useful outcome, understand source and authority limits, recover safely, and produce interpretable privacy-safe evidence for a continue/correct/stop decision.

A signed conversation, configured tenant, passing repository test, sandbox demonstration, account creation, login count or positive anecdote is not first proof. First proof does not establish general availability, institution-wide adoption, replacement of an official system or causal academic outcomes.

## Required pilot record before launch

| Decision | Required value/evidence |
| --- | --- |
| institution, sponsor and champion | named people with decision authority and backups |
| cohort and term | bounded eligible population, inclusion/exclusion and consent/notice posture |
| workflow and outcome | one primary job, baseline, approved target and interpretation caveat |
| authority boundary | what Semester may read, suggest, write or never decide; official system remains identified |
| data and integrations | data classes, source systems, tenant/configuration, provider/region and authoritative readback |
| accessibility and alternatives | scoped test, accommodations, non-AI/manual route and support path |
| operations | support hours/contacts, monitoring, incident, kill switch, rollback, recovery and offboarding |
| commercial/legal | executed pilot scope and applicable privacy/security/accessibility/AI terms |
| measurement | event/survey/interview definitions, privacy threshold, owners, cadence and decision date |

Unknown or bracketed values block activation.

## Repository validation — 2026-10-03

The P03 focused Vitest run passed **20 files and 176 tests** covering account/isolation helpers, role specifications and launch behavior, verified institutional access, institutional navigation and package surfaces, privacy-safe operations reporting, audit behavior, trust scorecards and named-tenant approval logic. In particular, the client-selected presentation role did not become authorization; access remained derived from live verified grants, malformed or expired grants failed closed, and reporting tests preserved cohort suppression, lineage and independent review rules.

The corresponding PostgreSQL 17 suites for tenancy, capabilities, grants, institutional foundations, membership, reports, rollout and school offboarding were selected, but the checker exited 2 before initializing a cluster because this host has no PostgreSQL 17 server. They were therefore **not rerun** in this pass. The 2026-09-30 hosted-preview offboarding rehearsal remains historical synthetic evidence only: it was partial, author-run and rolled back, and it is not customer, production or second-person acceptance.

This validation supports repository behavior for the cited paths only. It does not establish a complete target route/data inventory, deployed two-tenant isolation, authoritative institutional readback, a generated tenant-wide export, real offboarding, staffed operation, customer UAT/acceptance, activation or observed first proof.

## First-proof journey

1. Provision the isolated scope and two or more test identities representing the applicable roles; verify another tenant/role cannot access it.
2. Load only approved source/configuration data and reconcile it with the authoritative system.
3. Have a representative user complete the bounded workflow without operator shortcuts.
4. Show source, freshness, limitations and whether the outcome is local guidance, a proposal or an authoritative readback.
5. Exercise an error/degraded path, support escalation and rollback/disablement path without losing user work.
6. Export the agreed privacy-safe evidence and reconcile it against source counts and support records.
7. Review with the sponsor at the approved checkpoint and record continue, correct, pause, stop or offboard.

## Suggested evidence categories

Use the customer-approved scorecard, not universal defaults: eligible cohort activated; student first-win rate; meaningful workflow completion; time to value; source/authority comprehension; error and recovery outcomes; accessibility findings; support burden; reliability; qualitative trust/usefulness; incidents/rights requests; and offboarding readiness. Raw logins and screen views do not count as value.

Baselines, targets, privacy cell threshold, sample and decision rules remain `[TO BE APPROVED]` for each customer. Do not select thresholds after observing results. Do not expose individual risk, health, disability, counseling, conduct, aid, immigration or discipline signals.

## Acceptance gate

First proof requires signed customer interpretation of the evidence, zero unresolved P0/P1 issues, no uncontained rights/security/accessibility incident, confirmed support and recovery, completed UAT for the scoped roles, traceable source/authority behavior and a documented next decision. Expansion requires a new scope and gate.

## Evidence state

**Code/config evidence.** Tenant policy, role/authorization controls, core workflow tests, audit structures, feature controls and pilot templates support preparation.

**Operational evidence.** [`PILOT-SUCCESS-PLAN.md`](../market-readiness/PILOT-SUCCESS-PLAN.md) and [`PILOT-SUCCESS-SCORECARD.md`](../market-readiness/PILOT-SUCCESS-SCORECARD.md) define a process, but no named institution, executed scope, target credentials/configuration, signed UAT, staffed operations or accepted result is evidenced here.

**Missing test/proof.** Obtain the executed pilot record, target isolation/integration evidence, two-role UAT, accessibility review, support/incident/rollback exercise, baseline and target, privacy-reviewed measurement, sponsor interpretation and offboarding test.

## Claim ceiling

Semester may say it has a documented institutional pilot first-proof method and repository controls that can support a scoped pilot. It may describe a future pilot as proposed until activation evidence exists.

## Prohibited claims

Do not claim a live pilot, customer approval, institutional readiness, successful outcome, official-system replacement, FERPA compliance, causal retention/GPA/graduation impact or repeatable market proof without current named-customer evidence.
