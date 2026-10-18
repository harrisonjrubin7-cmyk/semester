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

- **Bundle budgets, as a CI gate** (29 September 2026, D-138):
  `app/perf-budgets.json`, checked by `npm run budgets` after every CI build.
  The first load, each lazily loaded screen's cost to open and the largest
  single file, in gzip bytes, each set from a measurement plus ten per cent
  (and never less than the measurement plus 8 KB); a new screen with no budget
  of its own may cost 48 KB. The arithmetic is `app/src/lib/perfbudget.ts`;
  the chunk graph comes from the `bundle-graph` plugin in `vite.config.ts`,
  written outside `dist/` so no source path is published.
- **What the first measurement said:** the first load is 395 KB gzip, well
  above the 150–200 KB common mobile guidance, and the largest file is the
  diagram layout engine (`elk`, 436 KB gzip), loaded only when a diagram is
  drawn. The budgets hold the line; bringing the first load down is its own
  piece of work, measured against them.

- **Load and concurrency, as a CI gate** (30 September 2026, D-154):
  `supabase/load.sh`. See [Load and capacity](#load-and-capacity) below.

Absent: web-vitals (LCP, INP, CLS), list virtualization, search debounce or
`useDeferredValue`, `manualChunks`.

## Load and capacity

`supabase/load.sh` runs pgbench scenarios against the database `check.sh`
builds: every migration, synthetic students, and each request made as the
student it belongs to, with the claims and role PostgREST sets. It runs in CI
as "Load and concurrency scenarios". A scenario fails over its latency
budget, which is set about ten times a quiet machine's reading to catch a
path that became an order of magnitude slower. The invariants afterwards fail
it at any speed.

| Scenario | What it is | p95 on a quiet machine | Budget |
| --- | --- | ---: | ---: |
| `flags` | cohort and flag reads on every screen | 9 ms | 25 ms |
| `plans` | registration week: term plan saves | 22 ms | 60 ms |
| `plans-same-student` | one student saving from several devices | 18 ms | 200 ms |
| `demand` | the demand read those plans feed | 20 ms | 40 ms |
| `sync-open` | every visit: the pull, the activity mark, the classmates and Plus cards (nine requests) | 36 ms | 400 ms |
| `sync-push` | after every edit: the state row and the one course edited, by compare-and-swap | 57 ms | 1,000 ms |
| `sync-same-student` | two devices of one student pushing at once | 46 ms | 200 ms |

Readings: 16 clients flat out, 2,000 students, and production-sized rows for
the sync scenarios (27 KB of state and four 42 KB courses a student, the size
of production's largest on 29 September).

**What else it checks:**

- **Pushes actually wrote.** A compare-and-swap that matches nothing still
  succeeds, so `run.sh` counts the rows each table wrote: about one state row
  and one course a push (four before D-1027). With a course compare-and-swap planted to match
  nothing, 3,145 pushes wrote 0 courses and the run failed. The push p95 fell
  to 44 ms in that run: the fault looked like an improvement.
- **Two devices lose no update.** Every push that wins its race must build on
  the one before. The control, the same race without the compare-and-swap,
  lost 1,165 of 1,526 writes, so the check can see a lost update.
- **No plan is counted twice, and cohorts are what was written.** These are
  #974's invariants. Its first run found `contribute_course_plan`
  deadlocking.
- **The database is settled first.** `VACUUM` and `CHECKPOINT` run before
  anything is timed. Without them, CI once read a median of 8 ms under a
  p95 of 457 ms.

**Capacity** is a one-off reading, not re-run by the harness. It was taken on
30 September with the rate-limited runner of #996, which was folded into this
harness. The runner used production's own settings: 60 connections, 256 MB
shared buffers, 3.5 MB work_mem, and two CPUs.

It replayed the first morning of term at ten times the largest pilot:
- 5,000 students, all opening within ten minutes and pushing three times
  each, which is 34 journeys a second;
- open p95 16 ms and push p95 28 ms, with nothing failed;
- doubling the rate held at 68 journeys a second and broke at 136.

That is two to four times the target. The push gave first, because every
push rewrote every course, changed or not.

**Only the changed courses are sent** (30 September 2026, D-1027). `push` in
`lib/cloud.ts` skips a course the database already holds unchanged, at the
stamp the push names, and carries that stamp forward. A student edits one
course at a time, so a push is the state row and one course, not four. On
one machine, same run, Postgres 16, 16 clients flat out:

| Push | Pushes a second | p50 | p95 | p99 |
| --- | ---: | ---: | ---: | ---: |
| every course (before) | 217 | 61 ms | 167 ms | 261 ms |
| the course edited (now) | 530 | 24 ms | 57 ms | 163 ms |

That is 2.4 times the pushes for the same database. The capacity figures
above were read before it and have not been re-read; the push is no longer
the first thing to give, and what is has not been measured. The first push
after a reload still sends everything, because what the database last
confirmed is kept in memory, and the pull on open refills it.

**What this does not measure:** PostgREST, Supavisor, GoTrue, the edge
functions and the network. Whether they hold is the scripted run against a
Supabase preview branch that LAUNCH-HARDENING-REPORT asks for, which needs an
owner and a budget. The script exists (D-1027): `supabase/load/edge/` seeds
students with passwords, then measures sign-in, the pull, the push (state and
one course, by compare-and-swap, rows counted) and the calendar feed through
the real stack, and refuses production's URL. It has not been run: no branch
could be made for it on 30 September. From one machine, sign-in reads GoTrue's
per-IP limit rather than its capacity; a campus behind one NAT address shares
that limit, which is its own question for the owner. Nor does it load journeys that do not exist yet
(assessment, gradebook).

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
   Budgets are set from the measurement, not guessed. *The bundle half is done
   (D-138); web-vitals is not.*
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

- CI fails when a route's JavaScript exceeds its budget. *Done: `npm run budgets`, shown red on a screen given a static import of KaTeX (1 KB to 75.6 KB) and on the entry given the same (395 KB to 470 KB).*
- The service-worker test fetches the same private URL as two users and gets
  two different answers.
- A 5,000-item list renders under a DOM node budget.
- A throttled browser smoke (4× CPU, slow 3G) loads Today within the budget.

On 3 October 2026, the operations-console route measured 33,377 gzip bytes
after the capability-gated support, privacy, integration, readiness, release
and incident workspaces were added. Its prior 24 KiB ceiling predated those
workspaces. The recorded measurement now derives a 41 KiB ceiling through the
same `budgetFrom` rule as every other route (measurement plus bounded headroom,
including the repository's 8 KiB floor); future console growth still fails CI.
