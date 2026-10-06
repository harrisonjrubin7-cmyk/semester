# "Native Education OS" PDF: delta against main

**As of** 2026-10-05 · **Base** `origin/main` `3bd382d` · **Status** Phase 0. Extends [`SEMESTER_PDF_RECONCILIATION.md`](SEMESTER_PDF_RECONCILIATION.md), which listed five PDFs and did not list this one (`now_break_down_entire_semester…`, 22 pp, read in full).

> **Claim ceiling.** "Not found" means a grep of `docs/master` and `docs/finish-line` found nothing, not that nothing exists elsewhere.

## What this PDF is

A lettered platform map (A–T): experience, learning, registrar/SIS, student success, productivity, AI, campus, finance, career, community, family, control plane, integration, trust, company OS, Operations Command Center, developer platform, education graph, stack, market strategy, and a "master native-first command". Its thesis (build native, integrate as a transition bridge, replace by domain with proof) is already the operating doctrine of `docs/master/SEMESTER_DOMAIN_REPLACEMENT_GATES.md` and the 40-domain catalog. **No new domain was found**; every lettered section maps to existing domains:

| PDF section | Existing domain(s) |
| --- | --- |
| A Experience, E Productivity | D01, D02, D08, D09, D20 |
| B Learning, C Registrar/SIS | D04, D05, D10, D11, D12 |
| D Student success | D09 |
| F AI | D06, D07 |
| G Campus, J Community, K Family | D15–D19, D21, D22, D24 |
| H Finance | D13, D14 |
| I Career | D23 |
| L Control plane, M Integration, N Trust | D25–D30 |
| O Company OS, P Command Center | D31–D33, D38, D39 |
| Q Developer/marketplace | D34, D35 |
| R Data/graph | D36 and `SEMESTER_DATA_AUTHORITY_MATRIX.md` |
| S Stack, T Market | `SEMESTER_COMPLETE_OPERATING_SYSTEM.md`, `docs/finish-line/*` |

## What main does not cover (the real delta)

| # | Item in the PDF | Finding | Class |
| --- | --- | --- | --- |
| 1 | §R: every graph node carries 16 attributes (canonical ID, tenant ID, owner, authority, source system, freshness, classification, consent scope, capability requirement, policy, version, audit history, retention, export behavior, deletion behavior, migration source, verification status) | No page states this as a per-entity contract; "Deletion behavior" and "Verification status" appear in no master or finish-line doc | Designed/documented only; gap |
| 2 | §G "Campus Operations Analytics", §E "Spreadsheet/Sheets workspace", "Presentation/Deck workspace" | Not named in any master or finish-line doc | Not started; confirm intent before cataloguing |
| 3 | Registration engine order (term, window, holds, prereq, coreq, credit limit, capacity, override) | The order is real and documented in `lib/enrollment/service.ts`: key, replay, kill switch, flag, section, term, student, window, hold, duplicate, prerequisite, clash, credit load, approval, seats. A 14-rung test in `enrollment.test.ts` now pins it (N-3). **No co-requisite check exists in the engine**; the PDF lists one. Capacity and override are not a check but a placement and a waiver. | Order pinned; coreq not started |
| 4 | §S "CQRS read models, projection workers" | Same finding as gap #1 in the gap register; not re-listed | Duplicate |
| 5 | Requested `docs/native-platform/NATIVE_*.md` (16 names) | Content exists under other names; see [`docs/native-platform/README.md`](../native-platform/README.md) | Mapping, not rebuild |

Everything else in the PDF is already catalogued; this page adds no row to the backlog beyond items 1 and 2.

## Proposed backlog additions

| ID | Item | Owner seat | Closed when |
| --- | --- | --- | --- |
| N-1 | A per-entity matrix of the 16 graph attributes over the tables in `SEMESTER_DATA_AUTHORITY_MATRIX.md`, with each blank marked blank | `data` | Matrix merged and a test fails when a catalogued entity has no row |
| N-2 | Decide whether Spreadsheet/Deck workspaces and Campus Operations Analytics are in scope; if not, add them to `docs/DO-NOT-BUILD.md` | `product` | Decision recorded as `docs/decisions/D-<pull request number>.md` |
| N-3 | A test pinning the registration check order | `engineering` | **Done.** `the order of the checks` in `app/src/lib/enrollment/enrollment.test.ts`: from a request every check refuses, repair one cause per rung. Four swaps of adjacent checks (window/hold, prerequisite/clash, gate/section lookup, approval/seats) each turned only the rung between them red; all pre-existing tests stayed green under each. |
| N-4 | Decide whether a co-requisite check belongs in the registrar engine, and where it sits in the order | `product` | Decision recorded as `docs/decisions/D-<pull request number>.md`; if yes, a rung is added to the ladder first |

## Second PDF: "connected ecosystem" expansion (2026-10-06)

An illustrative expansion of the mainframe PDF: three operating environments over one platform, a record-ownership map, ten proposed events, a connection-completeness checklist and ten journey-level readiness checks. **No new domain**; it restates the master doctrine. Two things are new to the backlog.

| # | Item | Finding | Class |
| --- | --- | --- | --- |
| E-1 | Ten proposed event names. Grep of `app`, `supabase`, `docs`, `packages` finds `membership.activated`, `onboarding.first_value_achieved`, `enrollment.confirmed`, `assignment.published`, `referral.accepted`, `payment.settlement_confirmed` and `tenant.rollout_paused` nowhere; `grade.released`, `consent.revoked` and `membership.ended` appear in a few files, not verified to be emitted. `domain_outbox_events.event_type` accepts all ten by its `^[a-z_]+\.[a-z_]+$` check, and the outbox has no relay (gap register #1, #4). | Contracts undefined; depends on the projection foundation (roadmap branch 6) | Not started |
| E-2 | Readiness reported per connected journey (marketing to activation, registration to roster to schedule, checkout to settlement, and seven more), not per screen | Not a register today; the registration journey is the only one with an engine and a test of its refusal order (N-3) | Proposed |

Both wait on roadmap branch 6. Neither is started here.

## Third PDF: "continue illustrating the ecosystem" (2026-10-06)

Same narrative a third time (12 pp, read in full). **No new domain, no new requirement.** Three items overlap or extend rows above, so they are folded in rather than added as new backlog.

| Item in the PDF | Where it already lives |
| --- | --- |
| An 11-field "record envelope" (identity, owning domain, scope, authority, source and effective date, version and freshness, classification, permitted relationships, policy or sharing basis, retention and export, audit references) | A subset of the 16 attributes in N-1; N-1 stays the contract and should be checked against these 11 so none is lost |
| A command path and an event path, joined by audit plus outbox | The shared command model in `docs/operations/CONTROLLED_ACTION_PATTERNS.md`; the event half is E-1 |
| Ten "complete connected behaviour" rows (onboarding, registration, Course Studio, advising, finance, campus, family, career, company operations, developer platform) | E-2; same journey-level readiness idea |

One rule in its connection table is testable today and is worth a test when someone next touches the engine: "payment does not silently override unrelated holds". In `lib/enrollment/service.ts` a hold is a fact on the student and the only thing that clears it is the owning office; nothing in the engine reads a payment. That is the intended behaviour, but no test states it.

## Fourth to fifteenth PDFs: the connection and control backbone (2026-10-06)

Twelve PDFs, read in full, none a new product domain. Together they specify the machinery that connects the domains: a component registry, a policy enforcement layer, a workflow orchestrator, a reconciliation loop, an evidence registry, and an access saga with its contracts. The ninth (`NIST_Zero_Trust_saga_state_machine…`, 22 pp) is a later, refined version of the eighth's saga and supersedes it wherever they differ; the tenth (`Map_NIST_Zero_Trust_saga_flows…`, 20 pp) is a third phrasing of the same saga; the eleventh (`Build_a_state_machine_runbook_for_NIST_Zero_Trust…`, 17 pp) is a fourth; the twelfth (`State_machine_runbook__NIST_Zero_Trust_saga_flows…`, 17 pp) is a fifth that adds a durable worker around the fourth's runbook, and the thirteenth (`NIST_Zero_Trust_Saga_Runbook__Build_a_state_machin…`, 14 pp) is a sixth that adds a PostgreSQL job worker; the fourteenth (`Build_a_NIST_Zero_Trust_Open_Policy_Agent_suite…`, 15 pp) is a seventh that consolidates the Rego into one suite, the fifteenth (`Build_a_NIST_Zero_Trust_Open_Policy_Agent_suite___copy.pdf`, 7 pp, a different file despite the name) is an eighth, a Python reference package, and the last one read. (A further upload was byte-identical to the twelfth, same SHA-256, and was not re-read.)

| PDF | Content | Disposition |
| --- | --- | --- |
| `continue_illsutration_and_depicting_semester_eycos…` (12 pp) | The same ecosystem narrative as the third PDF above | Already recorded; the same file, not re-folded |
| `continue_further_stregthing_the_eycosystem…` (9 pp) | Nine-registry "backbone", a 12-field component passport, a fact-to-owning-domain table, seven connection states, a failure-cascade table, ten acceptance tests, P0–P2 priorities | Passport is the registry definition below; ten tests and priorities become **C-3, C-4** |
| `Show_me_the_component_registry_structure…` (14 pp) | Five connected systems with about forty proposed tables | Registry built (below); the other tables are **C-1, C-2** |
| `Design_a_policy_enforcement_layer_and_workflow_orc…` (13 pp) | Distributed control plane, registration-readiness pilot (states `ready_as_of`, `blocked`, `review_required`, `unknown`, `stale`, `handoff_pending`, `action_completed`), a ten-step first implementation | Pilot ordering is **C-5**; PEP/PDP split already exists as `packages/institution/src/policy.ts` (ADR 0007) |
| `Build_an_end-to-end_saga_orchestrator_state_machin…` (25 pp, 20 read) | First access saga (`GRANT_PREPARED`, `PEP_INSTALLING`, …), `component.schema.json`, OpenAPI 3.1 and AsyncAPI 3.0 drafts, Rego | Registry schema **built**; saga superseded by the next row; contracts and Rego not adopted |
| `NIST_Zero_Trust_saga_state_machine…` (22 pp) | Refined saga (`VALIDATING`, `EVALUATING`, `PREPARING`, `INSTALLING`), a `Store`/`Services` interface pair and `AccessSagaRunner`, `access-request.schema.json`, a compensation policy, a production release gate | **Built** as `access-saga.ts` |
| `Map_NIST_Zero_Trust_saga_flows_into_a_complete_Asy…` (20 pp) | The saga a third time with ten states (`WAITING`, `INSPECTING`, `RECOVERY`, `CLOSED`), a pure `applyResult` reducer apart from the runner, a `revokeRequested` flag, a Command/Result message pair, one `/internal/operations` endpoint, Rego, a failure-recovery tree, a seven-row operator procedure, a safe-replay list, a 14-item release-evidence list | Same machine; the one new invariant is tested (below); the rest not adopted |
| `Build_a_state_machine_runbook_for_NIST_Zero_Trust…` (17 pp) | The saga a fourth time as a pure `nextInstruction` / `applyResult` runbook, compensation as its own lifecycle with `revoke_pa`, `remove_pep` and `verify_cleanup`, separate PE and PEP Rego packages, one AsyncAPI document each for PE and PEP, a ten-row operator runbook, nine policy tests and eight saga tests | Two real gaps closed in `access-saga.ts` (below); Rego and AsyncAPI not adopted |
| `State_machine_runbook__NIST_Zero_Trust_saga_flows…` (17 pp) | An `AccessWorker` around the runbook that tells four failures apart (remote failure, unknown outcome, policy rejection, persistence failure), per-operation timeouts with an `AbortSignal`, `TransitionEvidence` and an OPA transition policy (`saga.rego`) with tests and a verify script, a retry budget with escalation, a five-limit time table, final release checks | Three gaps closed in `access-saga.ts` (below); Rego and the reply-evidence model not adopted |
| `NIST_Zero_Trust_Saga_Runbook__Build_a_state_machin…` (14 pp) | A recovery diagram, a corrected `saga.rego` with ten tests, and a PostgreSQL worker: `access_jobs`, `access_operation_receipts` and `access_outbox` tables, a `FOR UPDATE SKIP LOCKED` claim with a 30 s lease, receipt and outbox written in one transaction, a separate result-to-state consumer, and a ten-row fault-injection table | Nothing new for the runner; the persistence design is **C-6**'s and the tables are **C-2**'s. Mapping of its fault-injection table below |
| `Build_a_NIST_Zero_Trust_Open_Policy_Agent_suite…` (15 pp) | One `zta.rego` for PE, PA and PEP decisions with twelve unit tests, an updated TypeScript worker, a token-revocation table, six test layers, eleven worker scenarios and five transition tests | Nothing new for the runner; two points recorded below. Rego not adopted |
| `Build_a_NIST_Zero_Trust_Open_Policy_Agent_suite___copy.pdf` (7 pp) | A description of a downloadable Python package (`saga.py`, 12 Python tests reported passing, Rego with 14 OPA tests reported not run, `verify.sh`, `VALIDATION.json`) with its own idempotency guard and a step-up rule | The package files were not attached, only the PDF describing them; nothing to build from, and a second state machine in another language is not adopted. One rule noted below |

> **Claim ceiling.** A grep of `supabase`, `database`, `app/src`, `packages` and `docs` for the proposed table names found none of `registry_components`, `platform_components`, `component_versions`, `workflow_definitions`, `workflow_instances`, `reconciliation_definitions`, `evidence_artifacts` or `authority_assignments`. `reconciliation_runs` appears only in the LMS matrix and the data inventory; `domain_outbox_events` exists and has no relay (gap register #1, #4). Nothing here is a database table. The seven `access_*` tables the ninth PDF lists were not searched for individually and are not created.

### What was built

| Item | File | Held by |
| --- | --- | --- |
| Access saga: 15 states, the runner (one move per tick, lease, compare-and-swap through the store, an event with every move, deadline and grant expiry), `operationKey`, jittered backoff, idempotency identity and digest, the access-request validator, `grantAllows`, the compensation policy as data | `packages/institution/src/access-saga.ts` | `access-saga.test.ts`, 68 tests against an in-memory `Store` and `Services`. Thirty-one deliberate breakages each turned red the test written for it: a wait that reaches `PREPARING`, an install that skips verification, an absent install that retries instead of re-evaluating, one that keeps its generation or its old decision, an install error read as failure, an unconfirmed revoke read as `REVOKED`, a stale decision that still grants, a deadline ignored, a grant that expires into `EXPIRED` instead of `REVOKING`, a deadline that stops a revocation, a grant that ignores expiry, an idempotency that ignores the payload, a request that accepts identity claims, a schema enum drifted, a lease never released, an orphaned grant that expires instead of being revoked, a cleanup verified on one side only, a cleanup that skips the enforcement point, a recovery that forgets which side failed, a storage failure treated as a participant's, a conflict not stood down on, no timeout, a timeout not read as unknown, no escalation, escalation too early, and three arms of the transition guard, and a terminal saga moved after its deadline (that last one survived the first run, which is why the test now includes it) |
| `access-request.schema.json`, as proposed | `docs/control-plane/access-request.schema.json` | `access-saga.test.ts` reads it and fails when it and the validator differ |
| Component definition: validator, `checkRegistry` (unknown dependency, duplicate, two providers, unprovided contract, self-dependency), `authorityOverlaps` | `packages/institution/src/registry.ts` | `registry.test.ts`; `component.schema.json` is held to the validator the same way |
| `component.schema.json`, as proposed | `docs/control-plane/component.schema.json` | `registry.test.ts` |

What the tests do not show: persistence. The fakes prove the runner honours its contract, not that a database can. Of the ninth PDF's release gate, the runner's side of these is exercised: timeout after install, an expired deadline during provisioning, a stale decision, a failed save, revocation unconfirmed. Not exercised, because they belong to the store: a worker crash before persistence, a duplicate or out-of-order signal, orphaned prepared-grant recovery, atomic saga + audit + outbox writes, and `wake`.

Three readings of the PDFs are decisions, not transcriptions. The ninth PDF's graph is used as written, and its prose "installed, at the right scope" is the adapter's duty (`inspect` compares scope), not the runner's. An install found `absent` goes back to `EVALUATING` at generation + 1, as the ninth PDF has it; the eighth's "retry the same install" is dropped because a decision made before an ambiguous failure may no longer hold. And the idempotency and operation keys are JSON arrays, not the PDF's `join(":")`, because an id containing a colon would collide.

One thing to settle before this has a caller: `ACCESS_REQUEST_ACTIONS` names `registration.readiness.view`, `registration.override.request` and `registration.override.approve`, and none is in `POLICY_ACTIONS`. Under ADR 0007 `decide` denies an action it has no rule for, so the saga could never get an `allow` until each is added with a rule, a refusing test and an audit event type.

The tenth PDF's one invariant that the ninth did not state is that a late install must not resurrect revoked access. In the runner it holds because a save is a compare-and-swap: a revocation that lands during an install makes the install's own move fail, and `a revocation that arrives while an install is in flight` checks that the saga never becomes `ACTIVE`. Its other differences are not adopted: renaming nine states back and forth between PDFs would change the wire enum for nothing; a `revokeRequested` flag duplicates what `REVOKING` already says and a flag can be forgotten where a state cannot; and a pure reducer split from the runner is a refactor the runner's tests already make safe, to do when a store exists. Its operator procedure, safe-replay steps and 14-item release evidence are documentation for **C-6**, not code.

The eleventh PDF's improvement is that compensation has a lifecycle of its own, and two of its points were gaps in the runner as first built, now closed:

- **An orphaned grant.** `prepare` can succeed and the worker die before the saga row records the grant id. The runner used to expire such a saga with nothing to revoke. A saga that leaves `PREPARING`, `INSTALLING`, `VERIFYING`, `RECONCILING` or `ACTIVE` now goes to `REVOKING` whether or not it holds a grant id, and cleanup revokes by saga and generation.
- **One-sided cleanup.** A single `revoke` that returned `absent` trusted one adapter to have done both halves. Cleanup is now `revokePa`, `removePep`, then `verifyCleanup`, one per tick, each recorded in `compensation`. `REVOKED` needs the verification to find both sides clean; when it disagrees, only the side that failed is reopened. The PDF's reason is kept in the `Services` contract: no grant at the PEP alone does not exclude an installation still in flight.

One piece depends on the adapter and is not tested here: the PDF's barrier, that an installation whose generation is at or below the revoked one is rejected however late it arrives. The runner states it as a duty of `revokePa`; only a real administrator and enforcement point can show it. It is on **C-6**'s list. The PDF's pure `nextInstruction`/`applyResult` split, its `COMPENSATING` state (here `REVOKING`) and its two AsyncAPI documents are not adopted for the reasons given for the tenth.

The twelfth PDF's rule is that a saga must tell remote failure, unknown outcome, policy rejection and persistence failure apart, because treating all four as "retry" duplicates effects or loses control of access. Three of its points were gaps in the runner as built, now closed:

- **Persistence is not a participant.** A failed save used to land in the same handler as a failed install and be retried, denied or revoked on. A `PersistenceConflict` from the store (stale fencing token, moved revision) now makes the runner stand down without overwriting whoever moved the saga; any other store error is raised as itself. Only calls to the `Services` are classified as participant failures.
- **A hung participant held the lease forever.** Every call now has a per-operation timeout (`DEFAULT_TIMEOUT_MS`, illustrative, not measured) and an `AbortSignal`. A timeout is `OPERATION_TIMEOUT`, retryable, outcome unknown; for an install that already meant reconciliation, and now a hung call reaches it. Aborting stops the wait, not the remote work.
- **Retry without telling anyone.** After `escalateAfter` failed attempts the runner calls `Store.flagRecovery`, which records an operator task and does not mark cleanup complete. It keeps retrying: the PDF's rule that exhausted retries must never stop required revocation.

A review of the pull request found one more real gap, now closed: an install found `absent` restarts evaluation at the next generation and used to forget the grant it left behind, so a later denial or deadline ended the saga as `DENIED` or `EXPIRED` and nothing revoked it. The saga now carries `staleGrantPossible`, and every way out of it afterwards (denial, deadline, a non-retryable fault, a stale decision) goes to `REVOKING`; `VALIDATING` and `EVALUATING` gained that edge for this one reason.

Also added: `checkTransition`, the TypeScript counterpart of the PDF's `saga.rego` guard, run on every move (same identity, one revision on, a legal edge, generation changes only when reconciliation restarts evaluation, no `REVOKED` without both cleanup sides confirmed). It is unit-tested arm by arm, but no path in the runner can reach a refusal today, so removing the call from the runner turns nothing red; that one mutation survives and is left as a known limit rather than contrived. It matters when a second runner or a hand-written adapter produces a move.

Where this machine differs from the PDF's `saga.rego` edges on purpose: its `RECONCILING → ACTIVE` skips verification and its `WAITING → EVALUATING` skips re-validation; here both go through `VERIFYING` and `VALIDATING` respectively, which is the property the earlier PDFs asked for. Its `TransitionEvidence` (producer verified, command matched, tenant, generation, expected operation) belongs to an asynchronous reply transport this runner does not have: `Services` are direct calls returning typed values, and reply verification is an obligation on that transport when one is chosen (C-6). Its five-limit table (operation timeout, provisioning deadline, grant expiry, lease expiry, retry budget) is now represented: `timeouts`, `deadlineAt`, `grantExpiresAt`, `leaseMs`, `escalateAfter`; the sixth, revocation freshness at the PEP, is the enforcement point's.

The thirteenth PDF separates *executing* an operation (a job queue and worker that record a receipt) from *advancing the saga* (a consumer that reads the result event, checks it and applies it through the policy guard). That is a different shape from the in-process runner built here, which calls the `Services` and commits the move itself. Neither is wrong; the PDF's version is the one that survives a database commit failure being mistaken for a participant's, which the runner now also does by keeping storage errors apart. It adds no rule the runner lacks. Its fault-injection table, against what is and is not shown:

| Fault | Where it stands |
| --- | --- |
| Worker crashes after the administrator prepares a grant | Shown at the runner: a saga left in `PREPARING` revokes by saga and generation, not by grant id. Recovering the *same* grant by operation key is the adapter's |
| Worker crashes before the receipt commit | The adapter's: participants must be idempotent by key. Not shown |
| Lease expires during the remote call | Shown: the late save is a `PersistenceConflict`, the runner stands down, nothing is overwritten |
| Two workers claim concurrently | Shown in part: the compare-and-swap lets one save win. Exclusive claim is the store's (**C-6**) |
| Installation times out after success | Shown: an install that throws or times out is reconciled by inspection, never assumed failed |
| Cancellation races installation | Shown: a revocation landing during an install makes the install's own move fail; the saga never becomes `ACTIVE` |
| Outbox publishes twice | Not shown: consumer deduplication is the store's (**C-6**) |
| Policy engine unavailable | Not applicable here: the guard is local TypeScript and `decide` fails closed (ADR 0007); no OPA is called |
| PEP unreachable during cleanup | Shown: `RECOVERY_REQUIRED`, retried, escalated to an operator after the budget, never closed |
| Database commit fails | Shown: a storage error is raised as itself, never retried, denied or revoked on |

The fourteenth PDF's two points that bear on this machine. Cleanup is allowed to run after the person loses authority: its PA-revocation rule is evaluated apart from active membership, and here `REVOKING` consults no policy at all, so a membership that ends cannot stop a revocation. And its token-revocation table is a reminder of what "revoked" has to mean at the enforcement point: removing a refresh token while a self-contained access token stays usable is not revocation, so `verifyCleanup` must be answered by an enforcement point that checks current revocation or a bounded expiry, and content already disclosed or cached offline can only be restricted from now on. Both are duties of the adapters (**C-6**), not things the runner can show.

The fifteenth PDF describes a Python package whose files were not supplied, so only its stated rules can be compared. Its step-up rule is the one worth keeping in view: a request for the wrong institution with a low authentication level is *denied*, not asked to step up, because step-up must never be offered to someone who would be refused after it. In this repository that ordering belongs to `decide` (tenant verification is checked before any rule runs, ADR 0007), not to the saga, which only acts on the outcome it is handed; whether `decide` has a step-up outcome at all is part of C-5, since today it returns allow-with-obligations or deny.

Its SQL is not adopted: the tables are scaffolding by its own account (no foreign keys, grants, RLS or retention), a migration is the owner's to apply (D-1324 is the pattern: inert, service-only, proved alone), and `pg` is not a dependency of this repository. Psql exists in the build environment, so when C-2 starts the check can be run the way `supabase/payment-inbox.check.sql` was.

### Not adopted, and why

| Proposed | Decision |
| --- | --- |
| OPA Rego policies (three forms: one package, separate PE and PEP packages, and a transition policy with tests and `opa` verify script) | ADR 0007 keeps rules in TypeScript until a tenant must author policy without a deploy; a second policy language would split the decision point. Not run here either: no OPA in this environment |
| OpenAPI 3.1 and AsyncAPI 3.0 drafts (all four versions, including separate PE and PEP documents) | Not committed: nothing in this repository validates either, and an unvalidated contract file reads as a contract. The ninth PDF's own gate asks for validation, reference resolution and a code-to-event mapping test first. Adopt when the transport and credential scopes are chosen |
| A trust score (0–100) in the decision | Both PDFs say NIST defines no formula; no signal source exists. Not started |
| The seven `access_*` tables | Wait on C-1 and C-2 |
| Populating the registry from the 40-domain catalogue | Refused: repository reference and revision must come from verified implementation evidence |

### Proposed backlog additions

| ID | Item | Owner seat | Closed when |
| --- | --- | --- | --- |
| C-1 | Decide where the registry lives: tables behind the owner's apply (as the payment-rail registry did, D-1324) or definitions as files checked by `checkRegistry` in CI | `engineering` | Decision recorded as `docs/decisions/D-<pull request number>.md` |
| C-2 | Workflow, reconciliation, assurance and `access_*` tables reconciled against `domain_outbox_events`, the release evidence register and the existing workflow machines first | `data` | Reconciliation written; no table added that an existing one covers |
| C-3 | The PDF's ten connection acceptance tests (authorized path, unauthorized role, other tenant, revoked membership, stale input, duplicate, timeout, partial completion, accessibility, lifecycle end) as a shape every cross-domain connection's test file must meet | `engineering` | A test fails when a catalogued connection lacks a rung |
| C-4 | Seven connection states (`confirmed`, `pending_authoritative_confirmation`, `projection_updating`, `source_stale`, `action_blocked`, `connection_degraded`, `reconciliation_required`) as one shared vocabulary beside `lib/status.ts` | `design` | Decided against the existing status vocabulary before any screen uses one |
| C-5 | The registration-readiness pilot's outcome states and its ten-step order, reconciled with the registration engine's check order (N-3), the pilot roles, and the three `registration.*` policy actions above | `product` | Decision recorded; first step is the PEP for one readiness read |
| C-6 | A `Store` implementation for the access saga satisfying the ninth PDF's persistence gate, with the store-side failure rehearsals listed above and the revocation barrier (a late installation at a revoked generation is rejected) | `engineering` | Each unexercised item has a test against the real store |

The access saga has no caller yet: nothing persists a saga row and no route asks for one.

## Sixteenth PDF: "unified enterprise architecture blueprint" (2026-10-06)

A 13 pp Perplexity write-up (read in full): one authorization chain (identity → tenant membership → scoped role → permitted action → validated state transition), a PostgreSQL/Supabase RLS reference (`app.tenants`, `app.memberships`, `private.roles`/`role_assignments`/`has_permission`), a document state machine with nine tables, a transition command with an idempotency key, student and faculty route tables, a company-module map and twelve mandatory access tests. It calls itself "a proposed implementation baseline, not an executed migration". **No new domain.** Its SQL is not adopted, for the reason the fifteenth PDF's was not: main already has the primitive under other names, and a second one would split the decision point.

| Blueprint | On main | Finding |
| --- | --- | --- |
| `app.tenants` (`institution`/`company`, `active`/`suspended`/`closed`) | `public.schools` (`20260921170000_schools.sql`); the company is not a tenant row | Different shape; no `kind`, and `schools` has no status column (grep of the migration finds none) |
| `private.permissions`, `roles`, `role_permissions` | `public.role_capabilities` (`20260922012000_capabilities.sql`) | Same idea, global rather than per-tenant roles |
| `private.role_assignments` (tenant-wide or section-scoped, `expires_at`) | `public.role_grants` with `scope_kind`/`scope_id`, `revoked_at`, `expires_at` | Equivalent and richer (revocation is a column) |
| `private.has_permission(tenant, permission, section)` | `private.has_capability(capability, scope_kind, scope_id)`, `security definer`, `search_path = ''`, executable by `anon, authenticated` | **Differs:** the blueprint's helper also requires an *active membership* and an *active tenant*; `has_capability` reads `role_grants` alone, so a suspended membership or school does not stop a live grant. Its access test "membership suspended after login → subsequent protected action denied" is therefore not held by this helper |
| Student/faculty row access (`enrollments`, `assignments`, `submissions`, `grade_entries`) | `registration_enrollments`, `gradebook_items`, `grade_entries`, `regrade_requests` (`20260929300000`, `20260929310000`) | Registrar and gradebook exist; no `submissions` or `assignments` table was found by grep of `supabase/migrations`. **Assignment submission is not started** |
| `submit_assignment` as the only student write path | not found | Follows from the line above |
| Document tables and nine-state version machine (`draft`…`archived`) with `review_tasks`, `approval_decisions`, `signature_*`, `transition_events` | Narrower per-record machines only: contracts (`draft`, `legal_review`, `out_for_signature`, `signed`, `superseded`, `terminated`) and a review state (`draft`, `review`, `published`, `superseded`, `archived`) in `20260929070000_commercial_core.sql` | **No generic document-version workflow.** Not catalogued as a gap before this page |
| Transition command with `Idempotency-Key`, `expectedState`, nine-step transaction, outbox insert | Idempotency keys exist in gradebook, productivity and dining; `domain_outbox_events` exists with no relay (gap register #1, #4) | Pattern present per domain; no document transition endpoint |
| `GET /api/v1/me/context` capability projection | `public.my_capabilities` | Exists as an RPC; the blueprint's per-section shape and "no global `isFaculty` flag" rule are not asserted by a test; a grep of `app/src` finds no global `isFaculty` or `isStudent` flag, so nothing currently violates the rule |
| Twelve mandatory access tests | Spread across `*.check.sql` and `registration`/`gradebook` tests | Not one list; no test file maps all twelve. Cross-tenant, self-assigned role, duplicate transition and suspended-membership rungs would each need confirming |

Everything else (route tables, company module map) restates existing domains and the operations console.

### Proposed backlog additions

| ID | Item | Owner seat | Closed when |
| --- | --- | --- | --- |
| B-1 | Decide whether `has_capability` must also require an active school membership and an active school, as the blueprint's helper does | `engineering` | Decision recorded as `docs/decisions/D-<pull request number>.md`; if yes, a `*.check.sql` rung first that fails with a suspended membership holding a live grant |
| B-2 | A generic versioned-document workflow (immutable versions, review, signature evidence, transitions), or a decision that per-record machines suffice | `product` | Decision recorded; if built, reconciled against `domain_outbox_events` and the contract machine first (C-2) |
| B-3 | Assignment and submission tables with same-section foreign keys, and one `submit_assignment` command | `engineering` | Tables and command merged with ownership, attempt, deadline and idempotency rungs |
| B-4 | The twelve access tests as one named list, each pointing at the test that holds it or marked unheld | `engineering` | A test fails when a rung has neither |

Not adopted: the SQL as written (it would add a second grant model beside `role_grants`), and the Mermaid diagrams (nothing here renders or validates them).
