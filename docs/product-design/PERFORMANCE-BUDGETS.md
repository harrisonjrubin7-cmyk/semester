# Product Performance Budgets

| Control | Value |
| --- | --- |
| Status | **CONTROLLED BASELINE — BUNDLE GATE ACTIVE; USER-EXPERIENCE/FIELD PROOF INCOMPLETE** |
| Owner | Harrison Rubin — Frontend Engineering, Product and Operations; backup performance reviewer unassigned |
| Evidence date | 2026-10-03; current budget file measured 2026-10-01 |
| Canonical machine source | `app/perf-budgets.json`, checked by `npm run budgets` after build |

## Current enforced bundle ceilings

All values are gzip bytes. The JSON source, not this summary, controls CI.

| Budget | Current ceiling | Current recorded measurement | Meaning |
| --- | ---: | ---: | --- |
| First load | 490,496 bytes (479 KiB) | 445,516 bytes (~435 KiB) | entry and static imports before the app appears |
| Largest chunk | 491,520 bytes (480 KiB) | 446,149 bytes (~436 KiB), an optional diagram-layout chunk | longest individual chunk wait anywhere |
| New unlisted route default | 49,152 bytes (48 KiB) | n/a | default ceiling until a measured route-specific budget is approved |

Route-specific ceilings are enumerated in `app/perf-budgets.json`; several deliberately exceed the default based on measured dependencies. The budgets include headroom and prevent unexplained regression. They are not claims that the baseline is fast or suitable for low-end/mobile conditions. The first-load baseline remains above common mobile guidance and requires reduction work.

## Experience targets

| Metric | Target | Current evidence |
| --- | --- | --- |
| Largest Contentful Paint, p75 | ≤ 2.5 s | target defined; no privacy-safe field measurement |
| Interaction to Next Paint, p75 | ≤ 200 ms | target defined; unmeasured |
| Cumulative Layout Shift, p75 | ≤ 0.10 | target defined; unmeasured |
| Route transition | ≤ 500 ms or immediate correctly sized skeleton | structural loading patterns; no complete measured journey set |
| JS error-free sessions | ≥ 99.5% | target defined; no field session dataset |
| Layout overflow on critical routes | 0% | partial structural/manual guards; no complete automated sweep |
| Focus obscured on critical routes | 0% | focus styling guard; route-wide observation absent |
| Critical draft recovery offline/interruption | 100% for named critical drafts | selected persistence tests; route inventory and operational proof incomplete |

These are release targets, not observed SLOs. Publishing a value requires a defined population, window, device/network segmentation and trustworthy telemetry.

## Test profiles

Measure cold and warm first win/Today, plan/registration, course/study, support and data-rights journeys on representative low-end and median mobile hardware, desktop, slow/fast network, Save-Data where applicable, empty/populated data and offline recovery. Record HTML/CSS/JS/font/media transfer, request count, main-thread/long tasks, memory where practical, LCP/INP/CLS, route transition and task time. Keep telemetry aggregate and free of user IDs, content and URL parameters.

## Change and exception policy

A budget change requires measured before/after artifacts, dependency attribution, user impact, alternatives considered, owner approval and an expiration/remediation plan. Do not raise a budget merely to make CI green. New heavy capabilities must remain dynamically loaded at the point of use; prefetch must respect Save-Data/effective connection and never expose private data through a shared cache key.

## Evidence state

**Code/config evidence.** Route splitting, the bundle graph, `perfbudget.ts`, its tests and `npm run budgets` enforce the current bundle ceilings. Database-only load scenarios have separate latency budgets.

**Operational evidence.** Recorded build measurements exist, but current real-user Web Vitals, low-end device journeys, full-stack preview load and production capacity/field trends do not.

**Missing test/proof.** Run throttled journey measurements, establish privacy-safe aggregate vitals, reduce first load, validate caching/offline behavior, run the preview full-stack load profile and preserve repeatable artifacts per release.

## Claim ceiling

Semester may say its build enforces measured gzip bundle ceilings and that it has defined user-experience performance targets. Exact recorded measurements may be cited with date/revision.

## Prohibited claims

Do not call the app fast, optimized for all low-end devices, within Core Web Vitals, production-scaled or capacity-proven from bundle gates or database-only load tests alone.
