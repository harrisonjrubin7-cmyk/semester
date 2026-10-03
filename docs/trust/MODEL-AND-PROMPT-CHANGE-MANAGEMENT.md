# Model and Prompt Change Management

| Control | Value |
| --- | --- |
| Status | **CONTROLLED DRAFT — PARTIAL REPOSITORY CONTROLS / OPERATING ADOPTION UNPROVEN** |
| Owner | Harrison Rubin, AI platform/Governance/Product/Security/Privacy/Accessibility primary; backup `UNASSIGNED` |
| Evidence date | 2026-10-03 at repository revision `8fc5fd56` |
| Scope | providers, model identifiers/versions, routing, system/developer prompts, templates, tools, retrieval, safety/policy rules, output schemas and evaluation thresholds |

## Standard

Every material AI change is a governed release, not a settings edit. The change record must preserve the prior and proposed configuration, reason, owner, affected features/tenants/populations, data/authority impact, risk class, provider-term change, evaluation results, reviews, rollout, monitoring, rollback and final decision. A provider alias or silent behavior change is handled as a model change even when source code did not change.

Production/customer activation requires a pinned or otherwise exactly reconcilable provider/model identity, prompt/config version, approved provider account and region, and a recoverable prior state. Unknown deployed state, missing evaluation, failed critical case, unexplained regression, unapproved terms/data change or unavailable kill switch blocks promotion.

## Change classes and gates

| Class | Examples | Required gate |
| --- | --- | --- |
| editorial/low | copy that cannot affect instructions, data, tools or decisions | owner review, deterministic tests and rendered notice check |
| normal | prompt wording, retrieval template, output schema, non-capability model update | impact review, full deterministic suite, representative live evaluation, comparison with baseline, staged rollout and rollback |
| high | provider/model family, tool permission, data class/source, safety/refusal, high-value workflow, material threshold | cross-functional risk review, red-team, accessibility/privacy/security test, customer authority where applicable, canary and signed release decision |
| emergency | active exploit, severe harmful output, provider outage/withdrawal | incident authority, contain first, minimum safe change, focused validation, retrospective and full gate before permanence |

## Required evaluation

Use synthetic or expressly approved evaluation material. Record provider, exact model/version, route, prompt/tool/source versions, parameters, date, runner, dataset version, per-case outcomes, critical failures, cost/latency and artifact hash. Evaluate grounding/citations, unsupported claims, high-risk refusal and escalation, prompt injection/exfiltration, privacy leakage, tool/action permission, bias/equity, accessibility/usability and resilience appropriate to the feature.

No model grades itself as the sole release authority. Deterministic checks, human review and production-safe monitoring serve different purposes and none substitutes for the others. A new model must meet approved absolute thresholds and must not materially regress against the current baseline without documented risk acceptance; critical safety/integrity failure always blocks.

## Release, monitor and rollback

Use a non-production or isolated evaluation account and budget; review generated artifacts for sensitive data before retention. Promote by explicit model/prompt/config version through a feature flag or tenant policy, starting with the smallest approved cohort. Watch quality, refusal, correction, complaint, cost, latency, safety and incident signals during the defined observation window. Roll back or disable on threshold breach, unapproved drift, material complaint/incident, provider-term conflict or inability to observe controls.

Retain the approved change record, code/config diff, evaluation artifact, reviewers, rollout timestamps, monitoring decision and rollback/release outcome. Re-run the gate after prompt, provider, model, policy, retrieval, tool, integration or material source change.

## Evidence and control mapping

| Control | Code/config evidence | Operational evidence | Owner | Missing test/proof |
| --- | --- | --- | --- | --- |
| model allowlists/settings | model lists and shared-key clamp tests constrain selected routes | deployed versions/accounts across routes are not reconciled | AI platform lead | target configuration export and pinned-version/alias policy |
| deterministic quality set | `app/src/lib/governance/model-quality.ts` contains synthetic cases with checks and negative controls | live runs are conditional; no complete approved baseline for every provider/feature | AI Governance | approved thresholds, representative runs and reviewer sign-off |
| prompt-injection regression | structural injection suite plus an optional live-model suite | limited dated red-team artifact exists, not universal/current | Security | repeat per changed route/model and expand tool/exfiltration cases |
| staged release/rollback | AI policy, feature controls and `kill.ai_generation` provide partial rollout/stop mechanisms | no named-customer model/prompt rollout and rollback acceptance | Product + Operations | canary, monitoring window, rollback drill and customer acceptance |
| provider/terms change | provider terms and vendor registers record published facts and gaps | executed terms/change-notice operation absent | Legal + Privacy | signed scope and recurring provider review |

## Claim ceiling

Semester may say it has defined model/prompt change gates and maintains model allowlists, deterministic evaluation infrastructure, injection tests and AI disablement controls for selected routes. Dated artifacts may be described with their exact model and scope.

## Prohibited claims

Do not claim every model is pinned, evaluated, approved, drift-monitored or rollback-tested; that provider updates cannot change behavior; or that passing synthetic/structural tests proves accuracy, safety, fairness, accessibility or institutional readiness. Do not promote an undocumented provider alias as an exact version.

## Related controls

- [`CHANGE-MANAGEMENT-POLICY.md`](CHANGE-MANAGEMENT-POLICY.md)
- [`AI-GOVERNANCE-PROGRAM.md`](AI-GOVERNANCE-PROGRAM.md)
- [`AI-RISK-ASSESSMENT.md`](AI-RISK-ASSESSMENT.md)
- [`AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md`](AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md)
