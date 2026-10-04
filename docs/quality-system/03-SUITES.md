# 03 · The ten suites

> Part of the [quality-system pack](README.md). Status: **proposed**.
> Each section says what exists (and where), what is owed, the harness, the
> fixtures, the cases, and the **acceptance criteria** — the measurable line
> that makes the suite pass or fail. Thresholds marked *proposed* are for the
> owner to accept; they are not claims about today.
>
> Per-area plans stay where they are and are linked, not copied:
> [`INTEGRATION-TEST-PLAN.md`](../INTEGRATION-TEST-PLAN.md),
> [`LOAD-AND-SOAK.md`](../LOAD-AND-SOAK.md),
> [`RESILIENCE-INCLUSION-ECOSYSTEM-TEST-PLAN.md`](../RESILIENCE-INCLUSION-ECOSYSTEM-TEST-PLAN.md),
> [`DISASTER-RECOVERY-TEST-PLAN.md`](../engineering-operations/DISASTER-RECOVERY-TEST-PLAN.md),
> [`TENANT-ISOLATION-EVIDENCE.md`](../institutional-readiness/TENANT-ISOLATION-EVIDENCE.md).

**Every suite obeys the proof standard** (`CLAUDE.md`): a new guard is shown red
against a planted fault and then restored; it carries a control; where the
thing is visual, someone looks at the screenshot.

---

## 1 · Tenant isolation

**Claim it protects:** one school's data is never reachable by another school's
people, by any path. **That is not yet true of course rooms:** members-only rooms
are built and switched off for every school (`RELEASE-GATES.md` G2, PARTIAL), and
the tenancy suite's header says so in terms — *"There is no cross-tenant isolation
in this project today"* for a confirmed address of any domain entering any room.
This suite is how that sentence gets deleted, and until it is, no report may say
more than that.

| | |
| --- | --- |
| **Exists** | RLS on every public table (`rls-coverage.check.sql`); tenancy and ~70 feature suites with a second school; `integration-rls-matrix.check.sql`; `school-offboarding` (cross-school and recovery cases); `app/src/isolation.test.ts` is **not** tenant isolation — it keeps the list of test files that need a worker to themselves; the word is shared, so nobody should cite it here; [`TENANT-ISOLATION-EVIDENCE.md`](../institutional-readiness/TENANT-ISOLATION-EVIDENCE.md) states the target matrix and its limits |
| **Owed** | a *generated* matrix instead of hand-written suites; the ownership ledger (CTO 09 PR 5); isolation checks on non-database paths (export, search, logs, files, AI retrieval, workers); a filed report |
| **Harness** | `tools/isolation-fuzz` (target). Reads the ownership ledger (every table → `scope: tenant \| user \| public \| service`, with its tenant column). For each *(surface × operation × persona-pair)* it issues the request as persona A against persona B's object and asserts the **deny-by-default** outcome — zero rows or a refusal, never an error that echoes B's data |
| **Surfaces** | PostgREST with a user JWT; RPC / `SECURITY DEFINER` functions (`DEFINER-RLS-REGISTER.md`, `definer-sweep.check.sql`); the 16 edge functions; the institution gateway; background workers and replays; exports; storage objects; search index; AI retrieval; support and break-glass tooling; logs and error bodies |
| **Operations** | read, list, count, search, update, delete, insert-as-other-tenant, bulk and paginated reads, filter/sort injection, guessed identifiers (IDOR), manipulated tenant header/claim/body, stale or revoked grant, cached and error-path leakage, retry/replay of another tenant's job |
| **Fixtures** | D2 tenant world: tenants `zz-test-a`, `zz-test-b`, `zz-test-silo`; in each, an owner, a same-tenant peer, an admin, a deprovisioned user, and a service identity; plus one person who belongs to two tenants (the hard case) |
| **Acceptance** | (1) **Zero** cross-tenant reads or writes across every surface above. (2) **Completeness:** every table has exactly one ledger entry; a table with none fails the build. (3) **Sensitivity:** with RLS dropped on a planted table, the fuzzer goes red on it and only on it (a control that the probe sees anything). (4) The case count per surface is recorded in the manifest, so "passed" cannot mean "ran nothing". (5) For tables scoped by *user*, not tenant, the suite proves user isolation and the report **says so** — it does not call them tenant-isolated (the limit the evidence document already states) |
| **Gate** | `pull-request` for touched tables; full run at `integration`; a signed report is required at `canary` for ring 1 and at `tenant-launch` |

## 2 · Authorization

**Claim it protects:** every action is decided by one policy, for the right
reasons, and the client's idea of a role is never trusted.

| | |
| --- | --- |
| **Exists** | the three `POLICY_ACTIONS` and `decide()` (`packages/institution`); `capabilities`, `grants`, `rolegrants`, `console-approvals` suites; `rolelaunch.test.ts`; client role is UX-only (`lib/role.ts` says so) |
| **Owed** | PDP coverage beyond 3 actions; a **purpose-coded** decision (none exists, and no purposes are defined by counsel — `RELEASE-GATES.md` says so); the PDP↔RLS conformance runner; a route-table test that every route is bound to a `POLICY_ACTION` |
| **Harness** | a decision-table generator: for each action, enumerate *(role × relationship × purpose × classification × tenant-state)* from the rules and emit the expected decision; the runner asserts `decide()` returns it **and** that the same request through RLS-protected SQL agrees. A disagreement is a defect of class `policy-divergence` |
| **Fixtures** | the persona for every role in `rolelaunch.ts` (69), plus relationships: advisor-of, guardian-of, instructor-of, shared-with, delegated-by, break-glass-granted, expired grant |
| **Cases** | the governance matrix from the audit (view personal item, view grade, …) as the seed table; each action's rule *refusing*; classification ceiling; audit event written before the effect; fail-closed when identity, policy or audit is unavailable; a grep test that no *new* code path decides authorization from client role state |
| **Acceptance** | (1) Every action has a rule, a refusing test, an audit event and an RLS conformance case — a handler without a bound action fails the route-table test. (2) PDP↔RLS **disagreements = 0** on the generated table. (3) Self-approval, approval by the requester's delegate, and an expired approver each refused. (4) Revocation takes effect on the *next* request, asserted with a timer, not a sleep |
| **Gate** | `pull-request` (touched actions); `integration` (full table) |

## 3 · Row-level security

**Claim it protects:** the database is the authorization boundary even if every
layer above it is wrong (ADR 0002).

| | |
| --- | --- |
| **Exists** | **106** `*.check.sql` suites run by `supabase/check.sh` against Postgres 17 (the version `config.toml` names); each makes synthetic users, walks them through what a real pair would do, asserts what each may see, rolls back; `rls-coverage`, `definer-sweep`, `indexes` (foreign-key indexes), `retention` coverage test |
| **Owed** | `FORCE ROW LEVEL SECURITY` (not present; CTO C0 PR 7); a **policy linter**; per-table negative-case completeness; every suite header listing its planted faults |
| **Harness** | unchanged: `supabase/check.sh [suite…]` — an unknown suite name is an error, never a quiet no-op. Add `tools/migration-lint` (CTO 02 §4): fails a migration that adds a table without tenant/owner column, RLS and `FORCE`; uses `USING (true)`; calls `auth.uid()` un-wrapped (the `initplan` rewrite of `20260907141019` is the pattern); grants to `anon` without a reason entry; renames/drops without expand-contract |
| **Suite template** | every new suite has blocks for: **owner**, **same-tenant peer**, **wrong role**, **other tenant**, **anon**, **service**; each block asserts rows, not just "no error"; a comment lists *the faults planted and seen red* (the integration plan's "Proving the guard" paragraph is the model) |
| **Fixtures** | D1 personas inside the transaction |
| **Acceptance** | (1) Every table appears in at least one suite *with a negative case* — enforced by a test that reads `create table` statements from migrations and searches the suites. (2) Zero policies matching `USING (true)` on user-data tables. (3) `FORCE` on every application table once landed, with a service-path rehearsal on production-sized staging. (4) Suites run in a fixed and a shuffled order. (5) **Per-suite check counts are recorded** in the manifest and a drop is a failure, not a cleanup (the checklist's "a dropped test counts as a regression") |
| **Gate** | `pull-request` for suites whose tables a migration touches; **all** at `integration` |

## 4 · Integration and contract

**Claim it protects:** "connected when available" never means "broken when
unavailable", and our own contracts do not change by accident.

| | |
| --- | --- |
| **Exists** | the connector pipeline (`lib/integration/pipeline.test.ts`, `quality.test.ts`, `classification.test.ts`, mock SIS/campus adapters); `integration-control-plane` (71 checks), `integration-quality`, `integration-hardening`, `lti*` suites; gateway tests; Stripe webhook is signature-verified and idempotent; adapter registries are **empty on purpose**, with a test that says so |
| **Owed** | **an OpenAPI document and `oasdiff` gate** (none exists); event-schema compatibility check; recorded-fixture adapters for the first real provider; the **provider-degraded run** (below); a generic idempotency test over every registered command; a route-table test for the two correlation headers |
| **Harness** | (a) *Contract:* OpenAPI 3.1 fragments merged before handlers, clients generated, `oasdiff` as a required check. (b) *Connector:* each adapter ships a recorded-fixture suite (request/response pairs, rate-limit, expired-credential, partial-page, duplicate, deletion, clock regression) and a reconciliation run against a partner extract. (c) *Provider-degraded:* a `FailingAdapters` registry where every adapter throws, times out, or returns malformed data in turn; the journeys marked in the catalog run and **must complete natively** or show the declared degraded state |
| **Fixtures** | recorded provider fixtures under `packages/test-fixtures/providers/<name>/`; vendor sandboxes only in the `integration` environment |
| **Cases** | idempotent webhook (same key + same body → one effect; same key + different body → `422 idempotency_key_reused`); signature mismatch; replay outside the 5-minute tolerance; dead-letter and replay; cursor not advanced on scope failure; kill switch reaches an in-flight job; disconnect revokes and purges; every error is the `ErrorEnvelope` and **never contains a stack trace or SQL** (a fuzz over every route) |
| **Acceptance** | (1) Zero breaking OpenAPI changes inside a major version. (2) Provider-degraded run **green for every domain**, and the *degraded UX itself* asserted. (3) Reconciliation on the partner extract: zero unexplained discrepancies; explained ones listed. (4) Idempotency: **one effect, one audit row, identical responses** for every registered command. (5) Every response carries `X-Request-Id`; every consumer propagates `correlationId` |
| **Gate** | `pull-request` (contract diff, touched adapter); `integration` (connector + degraded); `staging` (sandbox of the real provider) |

## 5 · Offline and sync

**Claim it protects:** priority student flows work without a connection and
converge afterwards without losing an acknowledged write; institutional
actions never claim a success they did not get.

| | |
| --- | --- |
| **Exists** | `lib/offline.test.ts`, `offline-mode.test.ts`, `merge.test.ts`, `cloud*.test.ts`, `lib/sync/outbox.test.ts` with an in-memory IndexedDB (`fakeidb.ts`); `sync.check.sql`; `smoke:sync` (two devices through a real local Supabase); [`OFFLINE-MODE.md`](../OFFLINE-MODE.md): `requireOnline` refuses sharing, sending, publishing and account deletion offline and says nothing was queued |
| **Owed** | a **deterministic simulator** (CTO 06 §7 names it); property-based convergence tests; throttled/partitioned browser runs; revoke-while-offline; old-client replay against a new server (the 90-day compatibility window) |
| **Harness** | `packages/offline-sync/sim` (target): N virtual devices, one server, a seeded scheduler that injects *partition, heal, reorder, duplicate, delay, clock skew, crash mid-write, remote wipe, permission revoked*. Property tests (`fast-check`, **new dependency** — through `docs/SUPPLY-CHAIN.md`, with a named owner) assert invariants over thousands of seeded schedules; a failing seed is printed and replayable |
| **Browser** | Playwright `context.setOffline`, CDP network throttling and CPU slowdown, in `smoke:sync` and `smoke:performance` |
| **Fixtures** | D2 world; a corpus of **old-shape snapshots from every shipped version** (the versioned `semester.*.vN` keys) for migration tests |
| **Invariants** | (I1) all replicas converge once connected; (I2) no acknowledged write is lost; (I3) re-delivery is idempotent; (I4) per-field merge is deterministic for the same inputs in any order; (I5) every true conflict is *shown* with both versions; (I6) a transactional command is never displayed as done before the server confirms (`pending → confirmed \| failed`); (I7) a revoked device receives no data after revocation and wipes DB, WAL and SHM; (I8) sensitive cache expires per tenant policy |
| **Acceptance** | **proposed:** ≥ 10,000 seeded schedules per run for I1–I5 with zero violations; I6–I8 asserted as scripted scenarios; every screen that can be offline shows the indicator, the queued count, the last-sync time and per-item state (a component test over the screen registry); old-client replay passes for the full compatibility window |
| **Gate** | `pull-request` (properties, 1,000 schedules); `integration` (10,000); `staging` (browser partition); nightly extended |

## 6 · Accessibility

**Claim it protects:** every pilot journey is usable by people using assistive
technology — and Semester claims nothing beyond the evidence.

| | |
| --- | --- |
| **Exists** | `src/a11y/` (axe over the rendered app, focus, modal, field-error, landmarks, labels, motion, skip link, title); `smoke:a11y` (critical journeys at 1280 px and 320 px reflow, skip focus, landmarks, titles, names and ARIA references); `sweep:contrast`, `sweep:targets`, `contrast.yml` (the 13 grounds × both faded rungs × every surface, `lib/contrast.test.ts`); `keyboard-pass.mjs`; new forms use the shared field-error and dialog helpers |
| **Owed** | a **human assistive-technology pass** and filed results (release gate G6); a screen-reader script per journey; an ACR/VPAT is **not** produced and **not** claimed |
| **Harness** | automated: axe in component and browser tests; keyboard-only traversal with focus-order assertions; `prefers-reduced-motion`, `forced-colors`, 200 % and 400 % zoom, large-text scale. **Manual:** `docs/evidence/a11y/<revision>-<AT>.md`, one file per assistive technology, produced from the checklist below by a **qualified** person |
| **Manual checklist (per journey in the catalog)** | landmarks and headings read in order; every control named and its state announced; errors announced and associated; dialogs trap and return focus; live regions announce async results once; no keyboard trap; drag has a keyboard equivalent (the calendar's direct manipulation); timeouts warn; reading level and the dyslexia-aware mode; captions on the audio and video content |
| **Acceptance** | (1) **Zero** axe serious/critical on every catalogued journey. (2) The manual pass is filed per release candidate that touches UI, with defects, owners and retest. (3) Known limitations are *published*, and the compatibility page states no conformance level it has not earned. (4) Accessibility defects use the severity and SLA in `ACCESSIBILITY-GOVERNANCE.md` (critical 5 business days, serious 30, moderate 90, minor next major release) |
| **Gate** | `pull-request` (automated); `staging` (T2/T3); `tenant-launch` (T4/T5 filed — G6) |

## 7 · AI quality and safety

**Claim it protects:** AI actions are policy-bound, source-aware, attributable,
logged and interruptible — and a model or prompt change cannot ship worse.

| | |
| --- | --- |
| **Exists** | deterministic guards (`ai/injection.test.ts`, `ai/prompt.test.ts`, `ai/clearance.test.ts`, `intelligence/assemble.test.ts`); live suites (`ai/injection.live.test.ts`, `ai/modelquality.live.test.ts`, `ai/live.test.ts`); `drill:killswitch`; filed evidence in `docs/evidence/ai/` (a kill-switch drill, and a red-team of 21 cases against `claude-opus-5` on 29 Sep 2026: none followed the injected instruction); per-school `ai_policy` |
| **Owed** | a **filed model-quality run**; a score **wired to a release gate**; sets versioned *with* the prompts; coverage beyond one model, one date, 21 cases; reconciling [`AI-RECOMMENDATION-EVALUATION-HARNESS.md`](../AI-RECOMMENDATION-EVALUATION-HARNESS.md), whose "no evaluation set, no scored run, no release gate" predates `modelquality.live.test.ts` |
| **Harness** | `ai-evals/<set>/{cases.jsonl,rubric.md,thresholds.json}` committed beside the prompt it tests. `npm run eval:model-quality` runs a set against the model *named in the run*, writes `docs/evidence/ai/<date>-<model>-<set>.json` with prompt hash, model, seed, scores and cost; CI compares to `thresholds.json` and to the last green run. Evaluation runs use **their own budget key** — never the students' (PR #764's lesson) |
| **Sets** | S1 *prompt injection* (direct, indirect via a pasted syllabus / web page / file, tool-call hijack; ≥ 100 cases per class). S2 *grounding and citation* (every cited source exists and supports the claim). S3 *policy* (course AI policy, tenant data zone, never-list fields). S4 *tenancy* (retrieval for tenant B never returns tenant A text). S5 *academic integrity* (no completed graded work where the course forbids it). S6 *safety and escalation* (crisis language routes to a person, never impersonates one). S7 *consequential action* (always asks a human; the override is recorded). S8 *quality* (task success on a held-out set per surface). S9 *cost* (cost per successful outcome) |
| **Acceptance (proposed)** | S1: **0** followed injections across all classes. S2: 100 % of citations resolvable; ≥ 95 % supported on the rubric. S3/S4/S7: **100 %** pass — these are authorization, not quality. S5/S6: 0 critical misses. S8: no regression > 2 pp from the last accepted baseline per surface, any larger drop blocks. S9: reported, with a budget alert. Every run names the model; **a model, prompt, or tool-schema change re-runs all sets** and a failing score blocks release |
| **Gate** | `pull-request` (deterministic guards; sets run *only* if a prompt/model/tool file changed); nightly (live sets, filed); `staging` (S1, S3, S4, S7 on the exact build); `canary` (kill switch exercised in the ring) |

## 8 · Load, soak and capacity

**Claim it protects:** the paths a registration week and a start of term lean on
stay inside their objective with many people at once — and nothing gets worse
the longer it runs.

| | |
| --- | --- |
| **Exists** | `supabase/load.sh` (pgbench scenarios `plans`, `sync-open`, `sync-push`, `demand`, `flags`, same-student contention; p95 budgets; invariants after each window); soak (`LOAD_SOAK_WINDOWS`; connection-leak check; drift = best p95 first-quarter vs last-quarter, > 2× and > 5 ms); `smoke:performance`; `perf-budgets.json` and `complexity-budgets.json` |
| **Owed** | load against **PostgREST, GoTrue and the edge functions** (the launch plan says nothing loads them); an AI-burst profile; objectives from `SLO-SLI-DRAFT.md` as the thresholds (its achieved values are **unmeasured**) |
| **Harness** | k6 (target; a build-time-free, single-binary dependency, reviewed under the supply-chain policy) with profiles under `tests/load/profiles/`: **L1** start-of-term login storm; **L2** registration-week plan + enroll; **L3** everyday sync (open + push); **L4** grade release (read fan-out); **L5** syllabus-import burst (file + model); **L6** AI burst with provider rate limits; **L7** webhook flood. Each profile states arrival rate, think time, data size and the SLO it tests |
| **Fixtures** | the load seed (`supabase/load/seed.sql`, extended to the D2 world at scale: 10 k students, 500 courses) |
| **Acceptance (proposed)** | at 1× expected load: p95 within the journey SLO and error rate within budget. At 2×: no data-integrity invariant fails; errors degrade to *stated* states, not hangs; no connection leaked (> 2 above start fails — the existing rule). Soak ≥ 4 h weekly: no drift by the existing definition. **Results are reported as measurements with the environment's size, never as a capacity guarantee** (`SLO-SLI-DRAFT.md` prohibited claims) |
| **Gate** | `integration` (database, as today); `staging` (full profiles at 1×); ring 3 entry requires 2× and a DR drill within 90 days (CTO 05 §3) |

## 9 · Chaos and resilience

**Claim it protects:** a failure we could have predicted does not turn into an
outage, a data loss or a silent wrong answer.

| | |
| --- | --- |
| **Exists** | `drill:killswitch`; kill switches (global, school, connection); read-only and rollback preconditions (`rollback.test.ts`); retry/back-off/dead-letter logic with tests; [`RESILIENCE-INCLUSION-ECOSYSTEM-TEST-PLAN.md`](../RESILIENCE-INCLUSION-ECOSYSTEM-TEST-PLAN.md) boundary tests |
| **Owed** | everything below the first row: no fault injection exists. **No degraded banner or read-only mode exists** (launch plan) — chaos cannot assert a state the product cannot show |
| **Method** | each experiment states a **steady-state hypothesis** (an SLI), a **blast radius**, an **abort condition** and the **runbook** it exercises. Run in `staging` automatically; in `production` only as a scheduled game day against the synthetic tenant ([07](07-PRODUCTION-VERIFICATION.md)) with on-call present |
| **Harness** | Toxiproxy (or equivalent) between gateway ↔ database, gateway ↔ providers, client ↔ API; a process killer for workers; a clock-skew injector; credential-expiry switch; object-store 5xx |
| **Experiments** | **C1** kill a worker mid-job → job completes once, outbox relays, no duplicate effect. **C2** drop the database connection for 30 s → read-only state shown, writes queue or refuse with a stated message, recovery without manual action. **C3** expire a connector credential → health turns amber with an owner and an action; native workflow unaffected. **C4** AI provider 5xx/slow → safe fallback or manual path (the SLI is "policy-compliant answer or safe fallback"). **C5** auth provider outage → signed-in sessions continue within the stated window; new sign-ins show a stated error. **C6** clock skew ±10 min on a device → hybrid logical clocks keep merge deterministic. **C7** queue backlog 10× → age alert fires; priority flows keep their SLO. **C8** a deploy aborted halfway → traffic returns to the previous revision in seconds. **C9** object-store partial outage → uploads queue with a visible state |
| **Acceptance** | for each experiment: hypothesis holds; **zero data loss and zero duplicate effect**; the alert fires within its stated window **and reaches a named human**; the runbook step list matches what was done (drift is a defect); findings enter the defect process ([06](06-DEFECTS-AND-DASHBOARDS.md)). A subset (C1, C3, C8) is required to pass at `staging → ring 0` (CTO 05 §8) |
| **Gate** | `staging`; `canary` for C8; monthly game day |

## 10 · Disaster recovery

**Claim it protects:** the company can bring a tenant's data back, correctly,
and in a stated time — a number it has *measured*, not hoped.

| | |
| --- | --- |
| **Exists** | `restore.sh` / `rehearse.sh` in CI (logical dump → empty database → six-way comparison); `restore-drill.sh`; `verify_ledger_chain`; one filed logical rehearsal (`docs/evidence/restore/2026-09-30-logical-rehearsal.md`); [`DISASTER-RECOVERY-TEST-PLAN.md`](../engineering-operations/DISASTER-RECOVERY-TEST-PLAN.md) is the **controlling procedure**; `RESTORE.md` records that a production restore **has never been done** |
| **Owed** | provider-backed restore into an isolated target; a second operator; gateway-journal recovery; measured RTO and RPO. The plan keeps RTO/RPO **UNKNOWN** until measured, and this page does not soften that |
| **Hypotheses to test (from CTO 06 §6; *proposed*, not claims)** | Postgres RPO ≤ 5 min and RTO ≤ 1 h to a new instance; object storage RPO ≤ 15 min, RTO ≤ 2 h; audit ledger with anchor ≤ 1 h; IaC rebuilt in ≤ 1 h |
| **Harness** | the existing drill scripts, plus `tools/dr/verify` which, after a restore, runs: schema fingerprint compare (`fingerprint.sql`); row counts per table; **RLS enabled and policy count equal**; grants equal; functions and scheduled jobs present; `verify_ledger_chain`; the `check.sh` suites against the restored instance; the golden path against it; and **no outbound integration or notification fired from the isolated target** |
| **Restore-must-not-resurrect test** | create a person, erase them, restore a backup **taken before** the erasure, replay tombstones and re-apply legal holds, then assert the person is absent and the hold is present. A restore that brings back erased data is a privacy incident, not a recovery |
| **Scenarios** | accidental row loss; failed migration; database unavailable; credential compromise; lost journal / uncertain external action; region loss; broken static deploy; missing secret; offboarding interrupted; restore under legal hold — exactly the plan's list, run twice a year |
| **Acceptance** | recovery is accepted only when data **and authorization** invariants pass, the target's application flows work, monitoring and alerts operate, gaps are written down, and the authorized owner **plus an independent witness** sign. Time is measured from declaration to *usable, verified* service; the data-loss interval is recorded separately. Until a drill passes, the only permitted statement is the plan's claim ceiling: *a tested logical rehearsal and a controlled recovery plan, with exact scope and date* |
| **Gate** | monthly isolated restore (target); `canary → ring 3` requires one within 90 days; `tenant-launch` requires a per-tenant drill at onboarding for silo tenants |
