# Performance Optimization Plan

| Control | Value |
| --- | --- |
| Status | **CONTROLLED PLAN — BUNDLE BUDGETS ENFORCED; FIELD/CAPACITY PROOF OPEN** |
| Owner | Harrison Rubin — product performance owner; backup reviewer and customer approver unassigned |
| Evidence date | 2026-10-03 at repository revision `ccc254d4` |
| Canonical budgets | [`../product-design/PERFORMANCE-BUDGETS.md`](../product-design/PERFORMANCE-BUDGETS.md) and `app/perf-budgets.json` |

## Baseline and priorities

The current machine gate checks gzip first load, largest chunk, named routes and a default for new routes. The recorded 2026-10-01 first-load measurement is 445,516 bytes against a 490,496-byte ceiling; the largest recorded chunk is 446,149 bytes against 491,520. These are build measurements, not field speed or capacity claims.

Optimization order:

1. Reduce first load: retain route-level splitting, keep institutional/AI/diagram features at point of use, remove duplicated libraries and defer noncritical initialization.
2. Bound large optional chunks: inspect the bundle graph, split or replace heavy dependencies and load only after user intent; respect Save-Data/effective connection before prefetch.
3. Protect interaction and layout: size placeholders, avoid blocking work, virtualize only where needed and verify keyboard/focus behavior after performance changes.
4. Preserve local-first durability: tune serialization/sync without weakening retry, offline recovery, conflict handling or authoritative readback.
5. Optimize server/database paths from measured traces and query plans; add indexes only with write/storage cost and tenant-isolation checks.
6. Establish privacy-safe field measurement for LCP, INP, CLS, route/task time and error-free sessions by approved population/window—without IDs, content, prompts or URL parameters.

## Release and exception rule

Run build plus `npm run budgets` on the exact candidate. A regression needs attribution, before/after artifact, user impact, alternatives, owner approval, expiry and remediation date; do not raise a ceiling merely to pass. Validate cold/warm, low-end/median mobile, desktop, constrained/normal network, populated/empty, offline/reconnect and assistive-technology cases for critical journeys.

## Evidence state

**Code/config evidence.** Route splitting, bundle graph generation, performance-budget arithmetic/tests and CI budget checks exist.

**Operational evidence.** Dated bundle measurements exist. Accepted real-user vitals, complete low-end-device journey evidence, production full-stack latency/capacity and sustained trend data do not.

**Missing test/proof.** Capture repeatable throttled journey artifacts; implement privacy-approved aggregate field metrics; profile first-load/large chunks; exercise full-stack and database load with correctness checks; preserve exact candidate results and customer acceptance where promised.

## Claim ceiling

Semester may say it enforces measured gzip bundle ceilings and has defined experience targets. Exact values must retain their date and scope.

## Prohibited claims

Do not claim the app is fast on all devices, meets Core Web Vitals, scales to an institution, has no performance regressions or satisfies an SLA from bundle gates or synthetic/database-only tests alone.
