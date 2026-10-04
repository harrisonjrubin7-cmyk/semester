# 08 · Repository structure, fixtures and the first pull requests

> Part of the [quality-system pack](README.md). Status: **proposed**, with two
> parts already real: the journey catalog and the fixture world (§3), both in
> `app/src/lib/` and both held by tests.
> Layout follows the CTO pack's [monorepo structure](../target-architecture/02-MONOREPO-STRUCTURE.md);
> until that workspace exists, §1 says where each thing lives **now**.

## 1. Where quality code lives

There is no root `package.json` and `app/` is the only application manifest
(CTO 02 §1), so the target tree cannot be created first. The rule is the CTO
pack's: **introduce around the existing code, move one slice at a time, change no
counts in the move.** Interim homes are chosen so a later move is a rename.

| Concern | Today | Interim (this pack, before the workspace) | Target (after CTO wave C0) |
| --- | --- | --- | --- |
| Unit, component, structural guards | `app/src/**/*.test.ts(x)` | unchanged | per-package `src/` beside the code |
| Database suites | `supabase/*.check.sql`, `check.sh` | unchanged | `db/checks/` |
| Journey scripts (Playwright) | `app/scripts/{golden-path,account-sync,accessibility-smoke,cold-smoke,…}.mjs` | unchanged; new browsers via `SMOKE_BROWSER` | `tests/journeys/` |
| Journey catalog | — | `app/src/lib/governance/journey-catalog.ts` **(exists)** | `packages/quality/` |
| Fixtures | per-suite, inline | `app/src/lib/fixtures/world.ts` **(exists)**; SQL in `supabase/fixtures/` | `packages/test-fixtures/` |
| Harness contract + floors | — | `app/scripts/manifest.mjs`, `quality/floors.json` | `tools/manifest/` |
| Isolation fuzz | — | `app/scripts/isolation-fuzz.mjs` | `tools/isolation-fuzz/` |
| Migration lint, boundaries | — | `app/scripts/migration-lint.mjs`, `boundaries.mjs` | `tools/migration-lint/`, `tools/boundaries/` |
| Offline simulator | `lib/sync/outbox`, `fakeidb.ts` | `app/src/lib/sync/sim/` | `packages/offline-sync/sim/` |
| AI evaluation sets | `app/src/ai/*.live.test.ts` | `ai-evals/<set>/` beside the prompt | `tests/ai-evals/` |
| Load profiles | `supabase/load/*.pgbench.sql` | `tests/load/profiles/*.js` (k6) | same |
| Chaos experiments | — | `tests/chaos/<C1…C9>.md` + scripts | same |
| Manual accessibility scripts | — | `docs/quality-system/a11y/` | `tests/a11y/manual/` |
| Evidence | `docs/evidence/` | + `releases/`, `escapes/`, `quality/`, `a11y/` | same |
| Workflows | `.github/workflows/{ci,contrast,functions,hawkscan,pages,production-smoke}.yml` | + `quality-nightly.yml` (04 §5) | CTO 06 §1 |

### The tree this adds

```text
quality/
  floors.json                  # per-suite minimum case counts (05 §1)
  waivers.json                 # dated, reasoned, expiring; never for P0/P1
ai-evals/<set>/{cases.jsonl,rubric.md,thresholds.json}
tests/
  load/profiles/               # L1…L7 (03 §8)
  chaos/                       # C1…C9 (03 §9)
supabase/fixtures/             # world.sql: fx.persona(role, tenant) → uuid; fx.become(uuid)
app/src/lib/
  governance/journey-catalog.ts (+ .test.ts)      # exists
  fixtures/world.ts (+ .test.ts)                  # exists
  sync/sim/                    # deterministic scheduler + properties (03 §5)
app/scripts/
  journeys.mjs                 # prints / rewrites the generated doc regions   # exists
  manifest.mjs                 # the evidence record for a SHA (05 §4)
  isolation-fuzz.mjs           # 03 §1
docs/evidence/{releases,escapes,quality,a11y}/
```

Two rules the existing registers already teach, applied here: **no second
ledger** (personas derive from `ROLES`; journeys cite the CF plan; gates are
`QUALITY_GATES`; the tenant ledger is the CTO's ownership ledger), and **every
register is held by a test** (the catalog by `journey-catalog.test.ts`, the world
by `world.test.ts`).

## 2. What is real in this change

| Artifact | Where | What holds it |
| --- | --- | --- |
| 44 journeys over 69 roles and 15 domains | `app/src/lib/governance/journey-catalog.ts` | `journey-catalog.test.ts`: complete, real, honest, documented |
| The generated doc regions | `02-JOURNEYS.md` between `<!-- journeys:*:start -->` markers | the same test fails if they differ from what the catalog renders; `npm run journeys -- --write` repairs |
| A deterministic synthetic world: 6 tenants, a persona per role, 12 edge people, 3 held clock points | `app/src/lib/fixtures/world.ts` | `world.test.ts`: unique ids, reserved identities only, every role present, internal roles only in the internal tenant, edge people name real journeys, clock points verified in `America/Chicago` |
| Everything else in this pack | `docs/quality-system/` | the journey and gate names are checked against it; the rest is a proposal |

Nothing else is claimed. The harnesses, the manifest, the isolation fuzzer and the
workflows are **templates and specifications**; they are the first pull requests
in §6.

## 3. Fixtures

### The world

`buildWorld()` returns a persona for every role in `rolelaunch.ts` in every tenant
where that role can exist.

| Tenant | Kind | Models | Used for |
| --- | --- | --- | --- |
| `zz-test-a` | pooled · ring 1 | a school | the school whose data a test tries to protect |
| `zz-test-b` | pooled · ring 1 | another school | the one that must never see A |
| `zz-test-silo` | silo · ring 4 | a dedicated-database, dedicated-key customer | per-tenant restore and key tests |
| `zz-test-k12` | k12 · ring 1 | minors, guardians, counsellors | age-dependent policy |
| `zz-test-individual` | individual plane | a student with no institution | the consumer plane, offline, export |
| `zz-test-semester` | internal · ring 0 | the company | support, trust and safety, commercial, break-glass |

Production gets one more, `zz-test-prod`, defined in [07 §4](07-PRODUCTION-VERIFICATION.md)
and never created by this module.

### Identity rules (all tested)

- **Deterministic ids.** `fixtureId(...parts)` is
  `md5('semester-fixture:v1:' || parts joined by ':')` formatted as a UUID — the
  same value PostgreSQL computes with `md5(…)::uuid`, so a SQL fixture and a
  TypeScript test agree with no lookup table.
- **Reserved addresses.** `<role>.<tenant>@fixture.invalid` (RFC 2606: it never
  resolves). `isFixtureIdentity()` is the probe that finds anything else.
- **Reserved names.** Tenant slugs `zz-test-*`; display names `ZZ <role> (<tenant>)`.
- **Roles derive from the register.** A role added to `rolelaunch.ts` has a
  persona on the next run; the test fails if it does not.

### Edge people

First-class and in the world by default, because most defects in this domain are
found on them. Each names the journeys it is the hard case for, and the test fails
if it names one that does not exist.

| Key | Tenant | Exercises | Journeys |
| --- | --- | --- | --- |
| `transfer-pending` | A | credit unevaluated; never self-verified | `J-ACA-03` |
| `minor-with-guardian` | K-12 | age-dependent sharing and revocation | `J-FAM-01` |
| `accommodation-holder` | A | a passport issued and revoked; no diagnosis anywhere | `J-LRN-04` |
| `legal-hold-subject` | A | a hold that stops deletion and survives a restore | `J-SUP-02`, `J-OPS-02` |
| `deprovisioned` | A | removed by the school while a token is unexpired | `J-ID-02` |
| `two-tenant-person` | A and B | one human in two schools: the hardest isolation case | `J-ID-03`, `J-COM-02` |
| `alumnus-after-offboarding` | A | a former student after their school left | `J-ADM-03`, `J-CAR-02` |
| `revoked-mid-session` | A | a share revoked while the other person has it open | `J-ACA-04` |
| `faculty-also-student` | A | a teaching assistant enrolled in the course | `J-LRN-01` |
| `break-glass-operator` | Semester | a time-boxed, dual-controlled, audited elevation | `J-ID-03`, `J-ADM-01` |
| `heavy-account` | individual | ten thousand actions and long text | `J-PRD-01`, `J-PRD-02` |
| `offline-for-a-week` | individual | a device returning with old-shape data | `J-PRD-01` |

### Time

Three held instants (`CLOCK_POINTS`), all in `America/Chicago` because the suite
already runs a second time zone (`Pacific/Kiritimati`) to catch the rest:
**mid-term** (a Wednesday morning), **registration opens** (a Monday at 07:00),
and **spring-forward** (01:00 on the day clocks go forward). The test checks the
zone arithmetic rather than trusting the comment — and caught the author placing
the third on the wrong calendar day.

### Data per persona

Beyond identity, a persona's world is built from the **domain's own fixtures**, so
this module does not become a second schema: a course and enrollment, a grade
(including one withheld), a bill with a payment plan, a share and its revocation,
a message thread, an AI thread with a cited source, a connector with a stale
freshness label, a file. The D2 seed that loads them is generated from the
ownership ledger so a table with no seed fails the completeness test (03 §1).

### The second-account harness

SQL already has the idiom, in every suite: a `pg_temp.become(uuid)` function that
sets `request.jwt.claims` and `set local role authenticated`
(`supabase/tenancy.check.sql`). `supabase/fixtures/world.sql` makes the personas
available to it:

```sql
-- supabase/fixtures/world.sql  (proposed)
create schema if not exists fx;
-- same formula as fixtureId() in app/src/lib/fixtures/world.ts
create function fx.persona(role text, tenant text) returns uuid
  language sql immutable as
  $$ select md5('semester-fixture:v1:persona:' || tenant || ':' || role)::uuid $$;
```

```sql
-- in a suite:
select pg_temp.become(fx.persona('student', 'zz-test-a'));
-- … assert A sees A's row …
select pg_temp.become(fx.persona('student', 'zz-test-b'));
-- … assert B sees none of it, and that the refusal is a refusal, not an error …
```

A `check.sh` test asserts `fx.persona(...)` equals the TypeScript `fixtureId`
for ten sampled pairs, so the two halves cannot drift. The browser analogue is
`world.as(role, tenant)` returning a Playwright context signed in as that persona
through the test-only session issuer (never the public sign-in path).

## 4. Acceptance criteria for the repository changes

1. **No count moves in a move.** A file relocation keeps the unit test count, the
   SQL check counts and the shuffled order identical, shown in the manifest.
2. **No second ledger.** A new register must name the existing one it derives
   from, or it is refused in review.
3. **Every new register has a test** with a control, shown red against a planted
   fault (§5).
4. **Fixtures hold no real data**, and the nightly scan finds none.
5. **`npm run journeys -- --write` is idempotent**: a second run changes nothing.

## 5. Proof that the two real guards guard

Per `CLAUDE.md`: a guard that has never failed is not known to be a guard. Each
fault below was planted, the suite run, and the fault removed. Results are in the
pull request that lands this pack; they are listed here so the claim is checkable.

| Planted fault | Expected red |
| --- | --- |
| delete a role from every journey | "has a journey for every role in the role register" names it |
| a journey cites a file that does not exist | "cites only files that exist" |
| a journey runs `npm run smoke:nonexistent` | "runs only scripts, suites and tests that exist" |
| a P0 journey with no evidence | "never lets a P0 journey stand on nothing" |
| change a status-affecting word in the doc table by hand | "carries the generated regions exactly" |
| a persona address on a real domain | "holds only reserved identities" |
| a role added with no persona | "has a persona for every role" |
| an edge person naming a journey that does not exist | "edge people … journeys that exist" |

## 6. The first pull requests

Each is small, independently green, and its own decision where one is needed
(`D-<its PR number>`). Order is by value per effort: the manifest and the
provider-degraded run first, because the manifest closes the one gap the
controlling documents name, and the degraded run is the only way the "native
first" law becomes a build failure.

| # | Pull request | Closes | Done when |
| --- | --- | --- | --- |
| Q1 | `feat(quality)`: **manifest** — `manifest.mjs`, `floors.json`, CI `manifest` job | "no single current manifest" | a manifest exists for every `main` SHA and lists the 48 skips with reasons |
| Q2 | `chore(ci)`: **apply and read back the ruleset**; add `db` as its own job | rulesets defined, never applied | `BRANCH-PROTECTION.md`'s "Applied" table has a row |
| Q3 | `feat(quality)`: **provider-degraded run** for the five most-used domains | principle P4 | journeys green with every adapter failing; the degraded UX asserted |
| Q4 | `feat(db)`: **per-table negative-case completeness** + suite template | RLS gap (03 §3) | a table with no negative case fails the build |
| Q5 | `feat(tools)`: **migration lint** with red-then-green fixtures | CTO PR 6 | `USING (true)`, missing RLS/`FORCE`, un-wrapped `auth.uid()` rejected |
| Q6 | `feat(ci)`: **cross-browser nightly** (WebKit, Firefox) | Chromium-only gap | `SMOKE_BROWSER` honoured; nightly green or a defect filed |
| Q7 | `feat(sync)`: **deterministic simulator** + 1,000-schedule properties (`fast-check` through the supply-chain policy) | 03 §5 | I1–I5 hold; a failing seed replays |
| Q8 | `feat(ai)`: **eval sets S1, S3, S4, S7** versioned beside the prompts; a filed run | G7 | a scored run on file, naming the model; a regression blocks |
| Q9 | `feat(synthetic)`: **S1, S2, S7** against `zz-test-prod`; `build.json`; V1, V2, V5 | 07 | 30 days of results or explicit `no data` |
| Q10 | `feat(tools)`: **isolation fuzz** over PostgREST and RPC for tenant tables | 03 §1 | zero cross-tenant; the planted-RLS-drop control goes red |
| Q11 | `feat(a11y)`: **the manual script and the first filed pass** by a qualified person | G6 | `docs/evidence/a11y/` has a dated file; limitations published |
| Q12 | `feat(dr)`: **isolated provider restore** with `dr-verify` and the resurrection test | DR plan | RTO and RPO measured, or the reason they were not |

After Q1–Q4 the middle of the pyramid exists and every later suite is a slice
through it. Q2, Q11 and Q12 need a person the repository does not have (a second
operator, a qualified assessor); nothing in Q1, Q3–Q10 does.
