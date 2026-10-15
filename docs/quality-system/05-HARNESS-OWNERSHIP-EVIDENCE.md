# 05 · Harnesses, flaky-test management, ownership, coverage, release evidence

> Part of the [quality-system pack](README.md). Status: **proposed**.
> Controlling documents: [`TEST-STRATEGY.md`](../engineering-operations/TEST-STRATEGY.md),
> [`TEST-COVERAGE-MATRIX.md`](../engineering-operations/TEST-COVERAGE-MATRIX.md),
> and `CLAUDE.md` ("proving a change"). Where this page is stricter than them, it
> says so.

## 1. Harnesses

### What exists

| Harness | What it provides | Lives in |
| --- | --- | --- |
| vitest in two projects (shared workers; a short list isolated for `vi.mock`) | fast unit/component run; order, shuffle, time-zone matrix | `app/vite.config.ts`; `src/isolation.test.ts` greps that the list stays true |
| `supabase/check.sh [suite…]` | one throwaway PG 17 cluster, every migration applied, every `.check.sql` run; an unknown suite name is an error | `supabase/` |
| `supabase/load.sh`, `restore.sh`, `rehearse.sh`, `restore-drill.sh`, `drift.sh` | pgbench scenarios with p95 budgets and invariants; logical restore compare; migration rehearsal on production's shape; soak drift | `supabase/` |
| Playwright smokes (`SMOKE_PLAYWRIGHT`, `SMOKE_CHROME`) | cold, a11y, golden, sync, pilot, institutional, gateway, performance, production, public-production | `app/scripts/` |
| `fakeidb.ts`, mock SIS/campus adapters, `mock-adapter.ts` | in-memory IndexedDB; recorded-shape provider doubles | `app/src/lib/` |
| structural guards | `rootunmount`, `screens`, `donotbuild`, `widthgate`, `designcontracts`, `decisionlog`, `supplychain`, `terms` | `app/src/**` |
| evidence directory | filed runs: AI red-team and kill switch, restore rehearsal, security scans | `docs/evidence/` |

### The common contract (new)

Every harness — existing wrappers and the new ones in [03](03-SUITES.md) — obeys
one contract so the manifest ([§4](#4-release-evidence-the-manifest)) can read
them all and so none can pass by running nothing.

1. **Exit non-zero on any failure**, and on *any* unexpected condition (missing
   input, unknown suite name, zero cases).
2. **Print and emit** `artifacts/quality/<suite>.json`:

```json
{
  "suite": "isolation-fuzz",
  "revision": "dac31c9…",
  "environment": "ci | local | staging",
  "startedAt": "2026-10-04T11:02:41Z",
  "durationMs": 412903,
  "seed": 90417,
  "cases": { "run": 18240, "passed": 18240, "failed": 0, "skipped": 0 },
  "controls": { "run": 3, "sawFailure": 3 },
  "surfaces": { "postgrest": 6120, "rpc": 2410, "gateway": 3002 },
  "artifacts": ["artifacts/quality/isolation-fuzz.log"]
}
```

3. **A floor, not just a result.** `quality/floors.json` holds, per suite, the
   minimum `cases.run`. Falling below it fails — "a dropped test counts as a
   regression, not as a cleanup" is the checklist's rule, and a floor is how a
   rule becomes a check. Raising a floor needs no ceremony; lowering one needs a
   reviewer and a reason in the diff.
4. **A control.** `controls.sawFailure == controls.run`: the harness first feeds
   itself a case that must fail and confirms it is reported. A suite that has
   never been seen to fail is not known to be a suite.
5. **Seeded and replayable.** The seed and revision are printed on failure with
   the exact command to reproduce.
6. **No network unless it says so.** Live suites declare `requires:
   [network, key]` and are classed *environmental* in [04 §3](04-GATES-AND-CI.md).

## 2. Flaky-test management

### Definition

A test is **flaky** if the same revision, command and seed gives different
results. A test whose result depends on *order* is not flaky, it is **coupled**
— a different fault, almost always fixed in the *earlier* file, the one the
failure does not name (`CLAUDE.md`). A test whose result depends on a race at
teardown is **timing**, and it does not reproduce from a seed.

| Class | Signature | Reproduce | Typical cause | Structural guard |
| --- | --- | --- | --- | --- |
| **coupled** | red only under `test:shuffle` | `npm run test:shuffle -- --sequence.seed=N` | shared module state; a test relying on another's leftover | the shuffled run is required |
| **timing** | `ReferenceError: window is not defined` out of `react-dom`; red once in fifty | **not reproducible from a seed** | a React root still mounted when a file ended | `src/rootunmount.test.ts` — structural, cannot be fooled by a race that did not fire |
| **environmental** | red on one runner, one time zone, one browser | `test:zones`; run the browser named | clock, locale, font, port clash | time-zone matrix; fixtures own the clock |
| **data** | depends on a row another run left | rerun against a fresh cluster | fixture not rolled back | D1 personas live inside a rolled-back transaction |
| **resource** | a runner under load | rerun on an idle runner | a budget set at a lucky median | budgets judged on the median window (the soak's rule), not one sample |

### Policy

This is the point where this pack is **deliberately stricter than
`TEST-STRATEGY.md`**, and the difference is stated so nobody has to discover it.
`TEST-STRATEGY.md` says: *"fix flaky tests or quarantine them with owner, issue,
scope and expiry; repeated reruns are not evidence."* That remains the rule for
the **non-required** classes. For the **required** ones the rule is:

| | Required, change-attributable suites (types, unit, SQL, contract, journeys in `build`) | Environmental and live suites |
| --- | --- | --- |
| Retry to get green | **never**. A retry that hides a flake is how it lives | no |
| Quarantine / skip | **never**. A quarantined required test is a guard that stopped guarding | allowed: owner, issue, scope, **expiry ≤ 14 days**; it **still runs and reports** |
| When it flakes | a defect against the suite, **P2** (P1 if it has blocked merges for a working day) | a defect, P3 |
| Resolution | root-cause **or revert the change that introduced the instability** — not the test | fix, or re-scope the claim it supports |
| The one permitted re-run | a job that died **before any test body ran** (checkout, install, runner loss), once, and the re-run is logged | same |
| Counts as evidence | green consecutive shuffle runs are **weak** evidence about the timing class and are not reported as proof (`CLAUDE.md`) | not for any claim while quarantined |

**Detection.**

- Every *new or changed* test file runs 20 times, shuffled, in the pull-request
  job before it is trusted; one failure blocks it.
- Nightly: the whole suite under three fresh random seeds. The seeds and results
  go into the manifest.
- A "flake ledger" is derived from CI history, not typed: any job that failed and
  then passed on the same SHA with no code change is a flake event.

**Metrics** (06): flake events per 1,000 job-runs; time to root cause; open
quarantines and their age; skips and their reasons.

### Skips are a claim, so they are listed

A skipped test says nothing, and a run that skips the model suites says nothing
about the model. Measured on `dac31c9`: **48 tests skipped, all from key-gated
live suites** (`injection.live`, `voice.live`, `modelquality.live`, each
`describe.skipIf(!LIVE)`); the checklist counted 10 on 21 September. That is not
a defect — those suites need a key and a budget — but it means **a green CI run
today carries no AI-quality evidence**. The manifest therefore lists every skip
with its reason, and the AI row in the coverage matrix reads *partial* until a
filed run exists (03 §7). A skip with no reason, or a new skip in a required
suite, fails the manifest.

## 3. Ownership

### Today, stated rather than hidden

`CODEOWNERS` has one owner and says so. Every existing test plan names the same
person as owner and the same blank as backup ("backup test lead unassigned").
That is one answer to one question — [README Q1](README.md) — and until it is
answered, **no acceptance in this system can be signed by anyone other than its
author**, which the controlling documents already refuse ("company self-test
cannot substitute").

### Roles

| Role | Accountable for | Today |
| --- | --- | --- |
| **Quality Lead** | the system: strategy, floors, the manifest, the dashboards, the defect process | acting: the owner |
| **Suite owner** | one suite in [03](03-SUITES.md): its floor, its flake list, its fixtures | the module's owner (CTO 04); the owner today |
| **Journey owner** | the journey's behaviour and its `owed` list shrinking | the domain's product owner |
| **Release test owner** | the release candidate's manifest and the sign-off sheet | rotates per release; the owner today |
| **Independent witness** | a signature that the author cannot give: a restore, a UAT, an assistive-technology pass | **unassigned** |

### Rules

- Every suite and every journey has an owner and a **backup**. A P0 suite with no
  backup is a standing P1 against the quality system, listed on the dashboard,
  not buried in a document.
- Test files are owned by the module that owns the code they test (CODEOWNERS per
  path once a second reviewer exists). Fixtures in `packages/test-fixtures` are
  owned by the Quality Lead; a module may *add* a persona, never change one.
- **Author never approves their own acceptance.** The sign-off sheet in 06 has a
  line per role and refuses the same name twice on a high-stakes release.

## 4. Release evidence: the manifest

`TEST-COVERAGE-MATRIX.md` ends on the gap this section closes: *"the matrix lacks
one current exact-SHA aggregate manifest and the external/target artifacts."*

### Two records, one link

| Record | Made by | Holds | Kept |
| --- | --- | --- | --- |
| **Manifest** (`manifest.json`) | CI, automatically, for **every** SHA | what ran, what it counted, what it skipped, what was red | CI artifact, 400 days |
| **Release record** (`docs/operations/releases/<date>-<version>.md`, CTO 06 §2) | the release test owner | who approved, evidence links, flags changed, migrations applied, rollback plan, **the manifest's hash**, defects open by priority, waivers, signatures | in the repository, forever |

The manifest cannot make a red run green: it runs `if: always()` and records red
as red.

### Schema (proposed)

```jsonc
{
  "schema": 1,
  "revision": "dac31c9…",           // full SHA the artifact was built from
  "artifact": { "web": "sha256:…", "migrations": "sha256:…" },
  "builtAt": "2026-10-04T11:40:02Z",
  "environment": { "node": "22.22.0", "postgres": "17.x", "chromium": "…", "os": "ubuntu-24.04" },
  "gates": {
    "pull-request": { "result": "green", "checks": { "build": "green", "account-sync": "green", "secrets": "green" } },
    "integration":  { "result": "green" }
  },
  "suites": {
    "unit":        { "files": 1267, "tests": 19829, "passed": 19781, "skipped": 48, "failed": 0, "order": ["natural", "shuffled:90417", "TZ:America/Chicago", "TZ:Pacific/Kiritimati"] },
    "sql":         { "suites": 106, "checks": 0, "failed": 0 },
    "journeys":    { "catalog": { "automated": 0, "partial": 44, "owed": 0 }, "smokes": { "golden": "green", "sync": "green" } }
  },
  "skips": [ { "files": ["src/ai/injection.live.test.ts", "src/ai/voice.live.test.ts", "src/ai/modelquality.live.test.ts"], "tests": 48, "reason": "key-gated live suites (describe.skipIf(!LIVE))", "class": "environmental" } ],
  "floors": { "met": true, "below": [] },
  "controls": { "run": 12, "sawFailure": 12 },
  "defects": { "P0": 0, "P1": 0, "P2": 3, "P3": 9 },
  "waivers": [],
  "evidenceLinks": [ "docs/evidence/ai/…", "docs/evidence/restore/…" ]
}
```

(`checks` and the non-unit numbers are illustrative; the generator fills them from
the real run. The `unit` and `skips` figures are from a real ordered run of this
branch on 2026-10-04: 1,267 files, 19,781 passed, 48 skipped, 0 failed.)

### Acceptance criteria for the manifest

1. **Exists for the SHA before the merge queue passes**; a missing or partial
   manifest fails the `manifest` check.
2. **Reconciles**: unit files and tests, SQL suites and per-suite check counts,
   smokes, and skips all appear; any figure below its floor fails.
3. **Immutable**: written once per SHA; a re-run writes `manifest.<n>.json`, it
   never overwrites.
4. **Honest about absence**: a suite that did not run is listed as `not-run` with
   a reason, never omitted. "Green" is claimed only per listed suite.
5. **Cited correctly**: any external statement ("N tests passed") quotes the
   manifest's revision and date — the controlling documents' claim ceilings
   forbid a historical green result being converted into present readiness.

### Evidence hygiene

Filed evidence in `docs/evidence/` names the revision, command, runtime,
configuration, seed, totals, duration and artifacts (`TEST-STRATEGY.md`), has no
real person's data, and is **not edited after filing** — a correction is a new
file that supersedes the old one by name. Screenshots and logs are redacted
before commit.

## 5. Coverage standard

**The claim ceiling already says it:** *"Test coverage is described by behaviour
and boundary, not by an unsupported quality percentage."* This page keeps that and
defines what it means in checks.

| Measure | Definition | Held by | May be quoted externally? |
| --- | --- | --- | --- |
| **Capability coverage** | every registered screen, edge function, table and command has at least one test that names it | the parity completeness tests (CTO 09 §5; `screens.test.ts`, `audit:screens`, `census:exports` exist today) | yes, as "N of M capabilities have a named test", with the manifest |
| **Journey status** | the catalog's `automated / partial / owed` | `journey-catalog.test.ts` | yes, with the owed list |
| **Policy coverage** | actions with a refusing test and an RLS conformance case | the route-table test (03 §2) | yes |
| **Boundary coverage** | tables with a negative case; surfaces with isolation cases | 03 §1, §3 | yes, per report |
| **Guard proof** | share of new guards whose PR body names a planted fault seen red | PR template, review | no — internal |
| **Line / branch coverage** | from `@vitest/coverage-v8` (a **new dev dependency**, through `docs/SUPPLY-CHAIN.md`) | a ratchet per package, floors only ever rise | **never.** It measures what ran, not what is protected |

**Proposed internal floors (ratchets, not goals):** pure domain packages ≥ 90 %
lines and ≥ 80 % branches once extracted (CTO 04); policy and merge code are held
by property tests (03 §5), not by a percentage; screens carry no line floor —
they are covered by structural tests, the axe sweep and the journeys.

**Test-quality rule that no number replaces:** a test counts only if it was seen
to fail against the thing it guards. Two tests in this repository passed against
a faithful revert of the bug they were written for, and were found only because
someone tried.
