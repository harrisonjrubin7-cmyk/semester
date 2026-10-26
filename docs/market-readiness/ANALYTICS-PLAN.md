# Analytics plan

> **Status: a plan, not sent.** This page describes what the company would like to measure. It is not what the app sends: the app's student activity marks are exactly three (`opened`, `course`, `studied`; see [`/ANALYTICS.md`](../../ANALYTICS.md) and [`../ANALYTICS-EVENTS.md`](../ANALYTICS-EVENTS.md)). Separately, the go-to-market tables (`gtm_*`) and `site_leads` record prospect and lead activity for the company site; those are governed by `docs/privacy-operations/04-PRIVACY-BY-DESIGN-REVIEW.md`, not by this plan. Do not read any funnel step below as collected today.

Semester measures meaningful workflow completion, reliability, support burden, and trust—not surveillance or raw login volume. Collection is purpose-limited, disclosed, access-controlled, retained only as approved, and aggregated for institutional reporting at the approved threshold.

## Individual funnel

Landing visit → signup started → signup completed → onboarding completed → first win → first-session value → Day 1/7/30 meaningful engagement → feature adoption/support need → upgrade or institutional-interest signal → disengagement/churn signal.

## Institutional funnel

Qualified conversation → discovery complete → security review → proposal → signed pilot → implementation → cohort activation → midpoint health → outcome review → conversion decision → annual agreement or clean offboarding.

## Governance

Every event needs a purpose, trigger, fields, prohibited fields, identity level, consent/legal basis, owner, retention, access, source of truth, validation, and deletion behavior. Never collect student content, secrets, raw tokens, or sensitive-category signals merely because telemetry can. Event names in [EVENT-TAXONOMY.md](EVENT-TAXONOMY.md) are proposed until implemented and accepted in production.

See [METRICS-AND-ANALYTICS-PLAN.md](METRICS-AND-ANALYTICS-PLAN.md) and [product analytics ethics](../PRODUCT-ANALYTICS-DATA-ETHICS.md).
