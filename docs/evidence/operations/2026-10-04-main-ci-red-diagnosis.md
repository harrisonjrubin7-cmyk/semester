# Why `main` CI was red, read from the run history — 2026-10-04

- **Status:** `DIAGNOSIS — TWO CAUSES READ FROM LOGS; NO CHANGE MADE`
- **Owner/operator:** Phase 1 step 0b ([`docs/program/PHASE_1_EXECUTION_BACKLOG.md`](../../program/PHASE_1_EXECUTION_BACKLOG.md)); risk R-015 in [`docs/program/RISK_REGISTER.md`](../../program/RISK_REGISTER.md)
- **Method:** read-only GitHub Actions API for `ci.yml` push runs on `main`; job lists for runs 37235112657 and 37222297036; the failing step's log for each; the repository's own commit message for the fix (`git show 046706a`)
- **Not represented as:** a diagnosis of every failing run (two of the 26 were read), a measurement of runner capacity, proof that any later run passed for a stated reason, or a fix

## What the history shows

The latest 30 `ci.yml` push runs on `main` (run numbers 4153 to 4215, 2026-10-04) are 26 failures and 4 successes. The 4 successes are the newest: 4204, 4206, 4207 and 4215, with one failure (4205) between 4204 and 4206. The earlier 48-of-100 figure in `docs/program/RISK_REGISTER.md` R-015 is the same burst plus older days; it is not a steady failure rate. The newest merged commit's run (4215, `c170dcd`) is green.

## Cause 1 — a burst of red `Test` runs: generated counts stale against the merged tree

- **Run 4176** (`0912dca`, merge of #1240): created 17:54:27Z, job started 18:05:11Z (11 minutes queued, during 21 pushes to `main` between 17:46 and 17:54); step `Test` failed at 18:09:59Z; every later step skipped.
- **The log** shows `src/lib/docs/platform-reference.test.ts` failing on a generated page (`CONTROL-FACTS.md`): it says 178 migration files and 110 check suites, the merged tree had 174 and 107, and a row for `supabase/ai-spend.check.sql` was absent. A second error in the same file: `Deno.env.get(n) is read through a name this scan cannot resolve`.
- **The fix, in the repository's own words** (`git show 046706a`): "Main was red: after #1228 (gateway on @semester/platform), #1231 (shared-key dollar meter), the modularization and AI-governance work, eight tests in five files failed. Each is fixed at its cause, not skipped." Runs after it are green except one (cause 2).

**Reading.** Each of those pull requests passed its own checks. Merged together, count-bearing generated documents and scans no longer matched, and nothing stopped the second merge: `main` has no ruleset and no required status (`gh api` readback in [`docs/governance/FITNESS_FUNCTIONS.md`](../../governance/FITNESS_FUNCTIONS.md); R-014). The failure was then carried by every commit until a fix-forward landed. That is why the red runs are one continuous block.

**Not shown.** Which of the 26 runs failed on exactly which assertion; only 4176 was read. The commit message names five files and eight tests for the whole burst.

## Cause 2 — one run red on a timing gate, not on a test

- **Run 4205** (`d090a54`, #1233): `Test` passed; step `Load and concurrency scenarios` failed at 21:28:21Z with `✗ sync-push: p95 drifted from 23.6 ms to 57.6 ms over 4 windows (limit x2 and +5 ms)`. The three other scenarios passed, and the compare-and-swap control passed (5010 of 6675 writes lost without it).
- **How the gate works** (`supabase/load/drift.sh`): it compares the best window in the first quarter of a run with the best in the last quarter, and fails when the later one is more than ×2 and more than 5 ms higher. `ci.yml` runs 4 windows of 6 seconds (`LOAD_SECONDS: '6'`, `LOAD_SOAK_WINDOWS: '4'`).
- **Hypothesis, not a finding:** with 4 windows a quarter is one to two windows, so sustained contention on a shared runner across the final 12 seconds lifts the later floor the same way a leak would. Run 4205 started at 21:11:58Z, 43 seconds after run 4204 of `3ab8653` on the same shared pool. Nothing here shows the contention; a rerun was not made. The script's own comment says a noisy neighbour lifts one window's ceiling and leaves the floor, so two lifted windows is the case it is least able to tell from a leak.

## What this does not change, and what is asked

- No file in `.github/`, `supabase/` or the guards was changed. The gate's thresholds were argued for in `supabase/load/drift.sh` and are not retuned here.
- **Decision for the owner (R-014, Phase 1 step 0a):** apply `.github/rulesets/main.json` so `build` is required and a branch must be up to date, or use a merge queue. That is the control that would have stopped cause 1; it is a repository setting and is not applied from this session.
- **Decision for the owner (cause 2):** keep the drift gate blocking on `main`, or run it as a reported-but-non-blocking step until its false-positive rate is measured over a stated number of runs.
- **Closing evidence:** ten consecutive green `main` runs with this document's causes absent, read from the same API. Today there are 4, one of them after a red.
