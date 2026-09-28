# Performance and low-end device plan

Part 17 of the expansion command. Phase 7. Some of it exists.

## What exists on main

- **Route-level code splitting:** `app/src/screens.tsx` lazy-loads the screens;
  the assistant is split out and kept optional (`app/src/aioptional.test.ts`).
- One error boundary that separates chunk-load failures
  (`app/src/components/Boundary.tsx`, `app/src/lib/fault.ts`).
- First-paint timing: `app/src/lib/timing.ts`, shown on the Data screen.
- Debounced saves: `app/src/lib/draft.ts`.
- Caching: the service worker (`app/public/sw.js`) and `app/src/lib/warm.ts`.

Absent: web-vitals (LCP, INP, CLS), list virtualization, search debounce or
`useDeferredValue`, bundle budgets, `manualChunks`.

## In flight

- #777 changes `vite.config.ts` and adds pull on focus.
- #792 (one Semester grammar) adds shared components — skeletons go there.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `performance_budgets` | **File** checked by CI against the build output | A budget is a gate |
| `performance_measurements`, `web_vitals_events` | **New** aggregate table, per route per device class per day; no user id | |
| `client_error_events` | **Reuse** `failure.ts` references + `feedback` | Only when the student sends them |
| `processing_jobs`, `processing_job_runs` | **New** when server-side PDF or image processing exists | Today that runs on the device |
| `search_index_status` | **Not needed** | Search is one client ranker (`docs/architecture/0006-search-is-one-ranker.md`) |
| `cache_policies`, `prefetch_policies` | **Code** in `sw.js` and the router | |
| `media_delivery_profiles` | **Code** | |
| `load_test_runs` | **Shared** with [service reliability](SERVICE-RELIABILITY-AND-SUPPORT-OPERATIONS.md) | |

## Order of work

1. Measure first: web-vitals into the aggregate table, and a bundle report in CI.
   Budgets are set from the measurement, not guessed.
2. Search debounce with cancellation, and `useDeferredValue` for the result list.
3. Virtualize the lists measured as largest (calendar agenda, sources, catalog).
4. Skeletons sized to the final layout (CLS measured before and after).
5. Prefetch only on `effectiveType` 4g and without `Save-Data`.

## Capabilities and flags

- None for students. Reading the vitals aggregate: `service:operate` (see
  [service reliability](SERVICE-RELIABILITY-AND-SUPPORT-OPERATIONS.md)).
- Virtualized lists and prefetch each ship behind a flag, `off`, until the
  measurement before and after is in the pull request.

## Hard boundaries

- **No private data in a shared cache key.** The service worker never caches an
  authenticated API response under a URL alone; every private response is
  either not cached or keyed by user.
- Vitals are aggregated, with no user id and no URL parameters.

## Tests

- CI fails when a route's JavaScript exceeds its budget.
- The service-worker test fetches the same private URL as two users and gets
  two different answers.
- A 5,000-item list renders under a DOM node budget.
- A throttled browser smoke (4× CPU, slow 3G) loads Today within the budget.
