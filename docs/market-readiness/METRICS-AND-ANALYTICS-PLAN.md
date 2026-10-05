# Metrics and analytics plan

## North star

**Weekly Prepared Action Rate:** percentage of eligible activated students who complete a weekly plan and at least one self-selected academically relevant next action, reported only for privacy-safe cohorts. It measures value delivered, not time spent.

## Funnels

- **Institutional:** target → qualified meeting → discovery → trust review → proposal → signed pilot → time to launch → cohort activation → weekly use → outcome review → conversion/expansion/reference.
- **Student:** visit → sign-up/local start → setup → activation → week-1 → week-4 → weekly planning/action → referral; track support, opt-out/deletion and churn reason.
- **Operations/trust:** uptime, incidents, MTTD/MTTR, support response/resolution, findings by severity/age, access reviews, restore results, integration errors/freshness, accessibility backlog, privacy-request time, cost per activated user, AI cost/safety rate.

## Event rules

Events contain pseudonymous actor, approved tenant/cohort, event/version, coarse object type, timestamp, outcome, correlation ID and consent/authority basis. Exclude free text, task/course names, grades, health/disability, communications content, exact location and sensitive support detail. Minimum report cell: 10; suppress or combine smaller segments.

## Leading indicators and guardrails

Leading: onboarding completion, activation, first plan, first action, week-1 return. Guardrails: privacy complaints/requests, opt-out, support burden, accessibility blockers, P0/P1 incidents, notification disablement, adverse subgroup differences, cost and AI safety.

## Experiment protocol

Pre-register hypothesis, population, owner, data fields, primary/guardrail metrics, duration, minimum practical effect, stop rules and analysis. Avoid experiments on high-impact decisions, privacy defaults, consent comprehension or accessibility access. Stop on a P0/P1, statistically/operationally credible guardrail harm, data-integrity failure, or inability to honor withdrawal. Small pilots emphasize confidence intervals and qualitative evidence rather than false significance.
