# Load and soak

> Code: `supabase/load/`, `app/scripts/soak.test.ts`, `app/src/lib/stability.test.ts` · Decision: D-156

The database load harness (`supabase/load.sh`, pgbench against the schema
`check.sh` builds) asks whether the paths a registration week leans on stay inside
a latency budget with many sessions at once, and whether their data is still right
afterwards. A **soak** asks the question a short run cannot: does anything get worse
the longer it runs.

## Running it

```bash
supabase/load.sh                                  # one pass, as it always was
LOAD_SOAK_WINDOWS=8 LOAD_SECONDS=30 supabase/load.sh   # eight windows of thirty seconds
```

Soak is **off unless `LOAD_SOAK_WINDOWS` is set**, and with it off the runner does
exactly what it did before. CI runs four windows of six seconds.

After every window it checks the invariants and the number of other sessions open in
the database (a count that keeps rising is a connection someone leaked: more than two
above the starting count fails). After the last, `drift.sh` compares each scenario's
**best** p95 in the first quarter of the windows (at least two) with its best in the
last quarter. A leak lifts the floor: the scenario is never again as fast as it was.
A noisy neighbour or one slow window lifts a ceiling and leaves the floor alone, so a
single bad window cannot fail the run and a slow first window while caches warm cannot
either. A scenario drifts when the later best is more than **2 times** the earlier **and**
more than **5 ms** higher (`SOAK_RATIO`, `SOAK_MIN_DELTA_MS`), so a 0.3 ms path that
became 0.9 ms is not a finding. With fewer than four windows it says it cannot see a
trend and passes.

## What was shown

- **A planted leak.** A scenario that appended 3000 rows to a table and then scanned it
  passed its budget in every one of four windows (p95 63.6, 96.6, 131.5 and 144.1 ms
  against a budget of 100 seconds) and was failed by the drift check (63.6 to 144.1 ms).
  The scenario was removed after.
- **A planted connection leak.** A session left open in each window failed the run at the
  third window (3 open against 0).
- **The clean schema** showed no drift across four windows on PostgreSQL 16, as a local
  run. CI runs PostgreSQL 17, the version the live project uses.
- **The drift script itself** is tested as the shell script it is, over hand-made and
  generated series, and nine defects planted in it each went red.
- **In process.** `stability.test.ts` runs the history, the flag evaluator and the
  contract decision through a simulated two years and tens of thousands of calls,
  asserting that state stays inside its cap, nothing is held past its retention, and a
  function called many times in any order on frozen input gives its first answer. It
  reads no clock and no heap, because those are what make soak tests flaky. Five planted
  accumulation defects (a cap removed, pruning removed, a call counter, a write to
  the input, a remembered answer) went red.

## What this does not show

- **It is this machine's latency.** Budgets catch a regression of an order of magnitude.
  A load test against production needs the owner's approval and a staging project and is
  not this.
- **No disk, bloat or memory reading.** It does not measure table or index growth, dead
  tuples, or the database server's memory. A leak that does not slow a scenario within
  the run is invisible to it.
- **No browser soak.** Nothing here runs the app for hours.
- **Not built:** a large-tenant scenario, a many-small-tenants scenario, concurrent
  file-processing and OCR uploads, and AI cost and quota load. The memo asks for each;
  none exists, and none is claimed. Registration-opening and the open-and-sync every
  student makes are covered by an open pull request to the same harness.
- **Two thresholds are judgement.** The ratio of 2 and the 5 ms floor were chosen to
  pass a clean run on a shared runner and fail the planted leak. If CI proves them too
  tight or too loose, they are environment variables, and changing them is a one-line,
  reviewable change.
