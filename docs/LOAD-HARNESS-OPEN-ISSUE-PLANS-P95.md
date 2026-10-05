# Open reliability issue: the `plans` load scenario misses its p95 budget intermittently in CI

**Status: open, not fixed, not masked.** Nothing in `supabase/load/*`, `supabase/load.sh` or the budgets
was changed to write this page. Raising the budget or retrying until green would hide the question this
page exists to keep asking.

## What fails

`supabase/load.sh` (CI step "Load and concurrency scenarios", `LOAD_SECONDS: '10'`) runs each scenario in
`supabase/load/*.pgbench.sql` against a throwaway Postgres and fails a scenario whose p95 exceeds its
budget. The `plans` scenario (budget **p95 60 ms**) has failed on shared CI runners and passed on the
re-run of the same commit:

| Where | plans p95 | Outcome |
| --- | --- | --- |
| PR #1015 head, CI | 69.5 ms | failed; one re-run passed |
| `main`, CI | 100.4 ms | failed (recorded in the comment on PR #1015) |

The two failing job logs are the evidence for those rows; the run identifiers are in that PR comment, not
repeated here from memory.

## What passes

| Where | plans p95 | p99 |
| --- | --- | --- |
| `main` at 3b54e2c, CI job 109913887393 | 11.2 ms | 14.0 ms |
| `main` at aa05b48, CI job 109893040844 | 10.1 ms | **162.5 ms** |
| local, Postgres 16, runs 1 to 6 | 28.5, 30.3, 21.1, 11.7, 25.3, 20.7 ms | 37.9, 41.3, 32.2, 20.1, 34.2, 32.7 ms |

(A third main job, 109903095401 at fd056fc, could not be read: its signed log URL was rejected.)

Reading it honestly: the passing CI runs sit at 10 to 11 ms, a sixth of the budget, and the failures are
6 to 10 times that. The p99 of 162.5 ms on a *passing* run shows the same stall reaching the tail without
reaching p95. The scenario is not slow; it is occasionally stalled, and only some stalls are long enough
to move p95. That points at the runner or at a Postgres background event (checkpoint, autovacuum,
`VACUUM` of the freshly loaded tables), not at the SQL. It is a hypothesis; none of these runs proves it.

## What is not known

- **Whether #996 fixed it.** D-154 / #996 (merged as c9aa36f) added `VACUUM (FREEZE, ANALYZE)` and
  `CHECKPOINT` before measuring, aimed at exactly this. Every main run listed above is *older* than
  c9aa36f, so none can say. The PR #1015 failure is on a head rebased over other work and is the only
  failure of its kind observed after the settling was discussed; one failure is not a recurrence rate.
- **The recurrence rate.** Two failures against an unknown number of green runs.
- **Postgres version.** CI installs the major named in `supabase/config.toml`; the local runs above are
  16. Whether the difference matters is not measured.

## How to reproduce

```bash
SEMESTER_CHECK_PG_ANY=1 LOAD_SECONDS=10 supabase/load.sh   # repeat; read only the scenario lines
```

Locally this has not failed (six consecutive runs above, all exit 0, spread 11.7 to 30.3 ms). A local pass does not
clear CI: the failures have only been seen on the shared runner, which is the reason this is filed as
open and not as fixed.

## What would close it

1. Read the `plans` p95 on every main run after c9aa36f, and count failures against passes.
2. If it recurs, log `pg_stat_bgwriter` / checkpoint activity and autovacuum during the scenario in CI
   so a stall can be attributed, rather than raising the cap.
3. Only then decide whether the cause is the runner (a budget question for whoever owns D-154) or the
   scenario (a harness fix).

## Update, 30 September 2026 (D-1019)

**Status: still open, cause unknown, and now measurable.** Steps 1 and 2 above were done; step 3 was not,
because it needs what step 2 produces.

**Step 1, the recurrence since c9aa36f (#996).** Fourteen `main` CI runs from c9aa36f to 598e6b1 had their
load step read from the job logs. `plans` passed in all fourteen and never missed its 60 ms budget. Its p95
ran from 6.1 ms to 48.3 ms and its p99 from 7.6 ms to 143.8 ms; four runs had a p99 over 60 ms and still a
p95 inside it. Three runs came close on p95: 48.3 (7d01431), 47.2 (c8fa684) and 39.3 ms (f917896). One more
`main` run (2dadbdf) failed before it reached the load step, in the golden-path step, and says nothing about
`plans`; two newer runs had not reached it when this was read.

So after #996, `main` showed no miss in fourteen runs. That is weak evidence that the settling helped, not
proof: the spread between a 6 ms run and a 48 ms run is wide, and the old failures were two. Against it, one
PR branch running the soak (PR #1019, head d6f77b9, four windows of six seconds) hit `plans` at 99.4 ms in
one window, with other scenarios also raised in that window (the others were 19.8, 30.3 and 50.4 ms). That run
is what the median-window rule in `docs/LOAD-AND-SOAK.md` answers; it does not explain the stall.

**Step 2, attribution.** The runner now reads, around every scenario, the checkpoints and autovacuum passes
in the throwaway database and the runner's CPU steal, prints them under the scenario when there are any
(`↳ while it ran: …`), and `drift.sh` says how many windows over a budget coincided with one. The first local
run (Postgres 16, three windows) showed 12 autovacuum or analyze passes during one `plans` window, so the
probe finds something real; that run did not stall. Nothing was changed in any budget or verdict.

**What would close it now.** Read the `↳` lines from the next CI runs that miss or nearly miss a `plans`
budget. If they show a checkpoint or autovacuum beside every bad window, the cause is Postgres's own
background work and the fix is to settle it before timing (autovacuum off on the throwaway database, or
another `vacuum` and `checkpoint` between scenarios), which is a harness change and is **not** made here,
because nothing yet shows it is the cause. If they show CPU steal, it is the runner, and the budget is a
question for whoever owns D-154. If they show neither, it is neither, and that is the finding.
