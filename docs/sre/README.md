# Semester reliability and operations platform — SRE pack

Status: **proposed**, written 2026-10-04 and rebased onto `origin/main` `d63f9ef`.
Author role: Site Reliability Engineering lead (acting). Nothing here is accepted until its decision record is; see [09](09-SCORECARD-AND-ROADMAP.md) §4.

This pack turns "operationally supported" from a sentence in the thesis into things a machine checks. It is the operations half of the [CTO target-architecture pack](../target-architecture/README.md) (D-1144) and it **consolidates** the controlled drafts in [`docs/engineering-operations/`](../engineering-operations/) rather than restating them. Where a draft says "no data", this pack says so too.

## The answer in ten lines

1. **The catalog is the repository.** 65 components — every edge function, every `cron.schedule` job, every queue, every workflow, every external dependency — with an owner role, a criticality class, dependencies, a student-facing degraded mode, a kill switch where one exists and a runbook. A test fails if a new function, job or workflow has no row.
2. **One person holds every role, and nobody backs them up.** The scorecard counts it: 0 of 65 components have a backup. That is the largest reliability risk in the repository and no tooling in this pack removes it; [06](06-INCIDENTS-AND-ON-CALL.md) says what to do in the meantime and what each step of getting out needs.
3. **SLOs extend the eight journeys already in `error-budgets.ts`**, and add the policy that was missing: multi-window burn-rate rules that page or open a ticket, with a floor so ten users cannot page anyone on three events. Tested by story, and shown to fail when the policy is broken.
4. **Observability is mostly a plan.** The gateway logs a correlated event per request; the edge functions log nothing structured; nothing is measured on real devices. [03](03-OBSERVABILITY.md) specifies one event schema, correlation across client, gateway, functions and cron, and the dashboards — and states what does not exist.
5. **Capacity is derived, not guessed.** Six named peaks (registration, deadline night, grade release, billing, AI surge, campus emergency) become requests, connections, AI calls and notifications at four cohort sizes. Every platform ceiling is still unverified, so the model cannot certify that anything fits.
6. **Delivery has no canary and manual rollback.** [05](05-DELIVERY-AND-CHANGE-MANAGEMENT.md) adds change classes as a gate that can say no, freeze windows as input, and a ring-based canary designed to run on the burn rules.
7. **Recovery is unmeasured.** The only restore ever run was logical. RTO and RPO are proposed per class and recorded as `unmeasured` until a provider-backed drill produces them ([07](07-RESILIENCE-BACKUP-DR-AND-CHAOS.md)).
8. **Sixteen runbooks, 33 alerts, 14 experiments.** Every alert names a runbook; every runbook exists and has seven sections in order; every executed experiment cites evidence that exists. Nothing is `delivery_tested`.
9. **Cost is a reliability signal.** Ten drivers, each with the control that *stops* spend, not just reports it. No budget is invented.
10. **No claim outruns the evidence.** A test fails if these docs use "24/7", "SLA", "uptime" or "guarantee" on a line that does not also say it is absent, proposed or conditional.

## Contents

| Doc | Covers |
| --- | --- |
| [01 Service catalog and ownership](01-SERVICE-CATALOG-AND-OWNERSHIP.md) | catalog, criticality classes, ownership model, dependency rules |
| [02 SLOs, SLIs and error budgets](02-SLOS-SLIS-AND-ERROR-BUDGETS.md) | journeys, supporting SLIs, burn-rate alerting, budget policy, composite objectives |
| [03 Observability](03-OBSERVABILITY.md) | event schema, correlation, metrics, traces, dashboards, alert policy, what exists |
| [04 Capacity planning](04-CAPACITY-PLANNING.md) | the six peaks, the model, staged proof, peak playbook |
| [05 Delivery and change management](05-DELIVERY-AND-CHANGE-MANAGEMENT.md) | pipeline, canary, rollback ladder, configuration, secrets, change classes, freezes |
| [06 Incidents and on-call](06-INCIDENTS-AND-ON-CALL.md) | severity, roles, the honest on-call ladder, status, postmortems, alert tests |
| [07 Resilience, backup, DR and chaos](07-RESILIENCE-BACKUP-DR-AND-CHAOS.md) | RTO/RPO, backup inventory, dependency and regional failure, experiments |
| [08 Cost and resource governance](08-COST-AND-RESOURCE-GOVERNANCE.md) | cost drivers, guardrails, unit economics, anomaly rule |
| [09 Scorecard and roadmap](09-SCORECARD-AND-ROADMAP.md) | baseline, ordered gaps, 30/60/90, owner decisions, open questions |
| [Runbooks](runbooks/README.md) · [Postmortem template](POSTMORTEM-TEMPLATE.md) | RB-01 to RB-16 |
| [Generated pages](generated/) | catalog, alerts, experiments, capacity, scorecard — rendered from the registers |

## The code

`app/src/lib/sre/` is the machine half. Each file is a register or a pure function; none reads a clock, a network or a database.

| File | What it is |
| --- | --- |
| `catalog.ts` | components, role holders, class targets, dependency closure, inversion check |
| `burn-alerts.ts` | multi-window burn rules, small-denominator floor, `decide()` |
| `alerts.ts` | the alert register and its four-step state ladder |
| `runbooks.ts` | the runbook index and required sections |
| `capacity.ts` | scenarios, cohorts, Little's-law demand, unverified limits, AI cap order |
| `chaos.ts` | failure experiments and their evidence |
| `changes.ts` | change classes, freeze windows, `gate()` |
| `cost.ts` | cost drivers, guardrails, anomaly ratio, unit cost |
| `scorecard.ts` | per-class coverage computed from the others |
| `*.test.ts` | repository-bound checks, alert stories, controls |

`npm run registers` rewrites the generated pages; an ordinary `npm test` only compares them.

## How this relates to what exists

Controlling documents stay controlling: [`MONITORING.md`](../../MONITORING.md), [`ROLLBACK.md`](../../ROLLBACK.md), [`RESTORE.md`](../../RESTORE.md), [`SECRETS.md`](../../SECRETS.md), [`SECURITY.md`](../../SECURITY.md), [`DEGRADED-MODE-MAP.md`](../DEGRADED-MODE-MAP.md), [`docs/engineering-operations/`](../engineering-operations/), [`docs/operating-model/SLOS-AND-ERROR-BUDGETS.md`](../operating-model/SLOS-AND-ERROR-BUDGETS.md), and `app/src/lib/governance/error-budgets.ts`. This pack **extends** the last of those (`burn-alerts.ts` imports `burnRate` from it) and does not fork it.

Two deliberate tensions, stated rather than hidden:

- **`MONITORING.md` declines automated alerting** ("a robot nobody has checked is alive") and was right for a pilot of ten. This pack designs the alerting for the point where that stops being true, and its first rule is that *an alert is not done until it has been delivery-tested*, which is the answer to that objection.
- **The CTO pack proposes a `core` container and three workers.** Every catalog row here is about what runs *today*. When a component is extracted, it gets a catalog row, a runbook and an alert before it takes traffic; the tests make that a build failure.

## What was and was not verified

- **Verified (read from the repository):** the 16 edge functions, the 21 `cron.schedule` jobs, the six workflows, the queue tables, the eight journey objectives, the existing recovery and incident code, the kill switches, the scripts and evidence files cited. The generated pages are held to these by tests that read the directories.
- **Verified by test, not by incident:** the burn-rate policy against 19 tests (most of them stories), with two deliberate breakages that turned the right tests red; the capacity arithmetic against hand-worked values; the gate and freeze logic.
- **Not verified:** any production metric (none exists in the repository); any vendor limit, price or plan feature; whether provider backups or PITR are enabled; whether the AI provider spend cap is set; whether the Supabase dashboard's branch record is currently healthy; how a schema deploy is triggered (no workflow file; the docs describe it); the real request rates behind every capacity assumption.
- **Not decided here:** the cloud and region posture (CTO pack P-12); funding and the second operator; the freeze calendar; any legal conclusion, including notification duties after an incident, which stay with qualified counsel via `LEGAL-REVIEW-QUEUE.md`.

## A note on the brief

The request asked to "use the shared preamble". No file by that name exists in the repository, in the prompt's attachments or in CLAUDE.md, so none was applied. The audit PDF's design laws (native first, operationally supported, user agency, AI bounded by trust) and CLAUDE.md's rules were applied instead. If a preamble exists elsewhere, it should be attached and this pack re-checked against it.
