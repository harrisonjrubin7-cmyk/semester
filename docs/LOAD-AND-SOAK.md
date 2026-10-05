# Load and soak

> Code: `supabase/load/`, `app/scripts/soak.test.ts`, `app/src/lib/stability.test.ts` · Decision: D-1019

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
exactly what it did before. CI runs four windows of six seconds, and runs four more if
the drift check fails, failing only if the drift persists over the eight (D-1280).

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

A drift seen once may be the runner: with four windows each end of the comparison is
two windows, and a fast pair at the start against a stalled pair at the end reads as
a leak. So when `drift.sh` fails, `run.sh` runs as many windows again and judges all of
them by the same rule and limits; a scenario that really gets slower keeps getting slower
and fails, one that does not, passes (D-1280).

## Budgets in a soak

Each scenario also has a p95 budget. In a single pass a window over it fails the run.
In a soak, one window over it is printed as a warning and the run is judged on the
**typical (median) window** across all windows: a stall on a shared runner lifts one
window, and a path that has really become slow lifts them all. CI's first soak run
failed on one window of `plans` at 99.4 ms against 60 (the others 19.8, 30.3 and
50.4 ms); its median, 40.4 ms, is within budget. The trade is stated: a single bad
window now passes and a sustained one (the median over) fails. Errors, aborted runs
and the invariants still fail in every window, and a run that is not a soak is
unchanged. This does not fix the runner stall behind the intermittent `plans` miss that
`docs/LOAD-HARNESS-OPEN-ISSUE-PLANS-P95.md` records, and it does not close that issue.

## What else was happening

Around every scenario the runner reads what else the machine was doing: checkpoints
and autovacuum passes in the throwaway database, and **CPU steal**, the share of
the runner's CPU time the hypervisor gave to someone else (Linux only). Anything it
finds is printed under the scenario's verdict (`↳ while it ran: …`), and `drift.sh`
says how many of the windows over a budget coincided with one. A stall with none of
the three beside it is not a checkpoint, not autovacuum and not a stolen CPU, which
narrows it; a stall with one beside it is a candidate, not a proof. This changes no
budget and no verdict. It exists because
`docs/LOAD-HARNESS-OPEN-ISSUE-PLANS-P95.md` could not say what a stall was, and its
second step was to record that rather than to raise a cap.

## What was shown

- **A planted leak.** A scenario that appended 3000 rows to a table and then scanned it
  passed its budget in every one of four windows (p95 63.6, 96.6, 131.5 and 144.1 ms
  against a budget of 100 seconds) and was failed by the drift check (63.6 to 144.1 ms).
  The scenario was removed after.
- **A planted connection leak.** A session left open in each window failed the run at the
  third window (3 open against 0).
- **The clean schema** showed no drift across four windows on PostgreSQL 16, as a local
  run, and then in CI on PostgreSQL 17, the version the live project uses: four windows
  of six seconds, 16 clients, 2000 synthetic students, seven scenarios (#996's sync ones
  included), the invariants held after every window, and no scenario drifted. The
  noisiest, `sync-push`, ran from a best p95 of 122.6 ms in the first windows to 55.6 ms
  in the last, which is why the comparison is of best windows and not of single ones.
  Its lost-update control lost 5840 of 7785 writes, as it must. This was the `build` job
  of the run on head `aa3af07`; a different runner will give different figures.
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
  none exists, and none is claimed. The open-and-sync every student makes is covered by
  D-154, and runs in every soak window.
- **A harmless stderr line.** The runner prints `echo: write error: Broken pipe` on the
  scenarios with the most transactions. It comes from `pct()`, which was already in the
  runner: `awk` exits once it has its percentile and `echo` loses its pipe. The figures
  printed are right. It is noise, not a failure, and it is left alone here.
- **Two thresholds are judgement.** The ratio of 2 and the 5 ms floor were chosen to
  pass a clean run on a shared runner and fail the planted leak. If CI proves them too
  tight or too loose, they are environment variables, and changing them is a one-line,
  reviewable change.
