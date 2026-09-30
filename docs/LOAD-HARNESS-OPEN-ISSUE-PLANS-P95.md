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
| local, Postgres 16, run 1 | 28.5 ms | 37.9 ms |
| local, Postgres 16, run 2 | 30.3 ms | 41.3 ms |

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

Locally this has not failed (two runs above, more recorded below if they finished). A local pass does not
clear CI: the failures have only been seen on the shared runner, which is the reason this is filed as
open and not as fixed.

## What would close it

1. Read the `plans` p95 on every main run after c9aa36f, and count failures against passes.
2. If it recurs, log `pg_stat_bgwriter` / checkpoint activity and autovacuum during the scenario in CI
   so a stall can be attributed, rather than raising the cap.
3. Only then decide whether the cause is the runner (a budget question for whoever owns D-154) or the
   scenario (a harness fix).
