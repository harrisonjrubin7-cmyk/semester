# Performance Optimization Plan

| Control | Value |
| --- | --- |
| Status | **CONTROLLED PLAN — BUNDLE BUDGET ACTIVE; EXPERIENCE/CAPACITY PROOF PARTIAL** |
| Owner | Harrison Rubin — frontend performance, product and operations primary; backup performance reviewer unassigned |
| Evidence date | 2026-10-03 at repository revision `ccc254d4` |
| Budget source | [`../product-design/PERFORMANCE-BUDGETS.md`](../product-design/PERFORMANCE-BUDGETS.md) and `app/perf-budgets.json` |

## Priorities

1. Reduce first-load JavaScript and unused initialization before raising any budget.
2. Keep heavy editors, media, diagrams and institutional consoles dynamically loaded at point of use.
3. Measure cold/warm first win, Today, planning, study, support and data-rights journeys on low-end/median mobile and desktop under slow/fast/offline conditions.
4. Optimize critical rendering, fonts/assets, long tasks, repeated computation, queries and cache policy while preserving accessibility and source/authority behavior.
5. Add privacy-safe aggregate Web Vitals only after event, retention and access review.
6. Run full-stack preview load/concurrency, database invariants and recovery profiles before institutional activation.

Every change records before/after artifact, device/network/data profile, transfer/request/main-thread metrics, LCP/INP/CLS, route/task time, memory where relevant and functional/accessibility regression result. A budget exception needs owner, user impact, rationale, expiry and remediation; never raise it only to make CI pass.

## Evidence state

**Code/config evidence.** Route splitting and gzip budgets are enforced; current recorded measurements have headroom under their ceilings. Database load scenarios have latency/invariant gates.

**Operational evidence.** Real-user vitals, representative throttled journey baselines, full-stack capacity and production field trends are absent. Current first-load size remains an explicit optimization target.

**Missing test/proof.** Produce route-level profiles, reduce first load, validate cache/offline/Save-Data behavior, add privacy-approved field measurement and run full-stack capacity tests with retained artifacts.

## Claim ceiling

Semester may say it enforces measured bundle ceilings and maintains proposed experience targets.

## Prohibited claims

Do not claim the app is fast, Core Web Vitals-compliant, optimized for all devices or scaled for institutional production from bundle/database gates alone.
