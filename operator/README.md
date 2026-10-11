# Semester Operator

The agent team for the Semester ecosystem and its company workflows: thirty-three bounded responsibilities sharing one runtime, five deterministic control modules that decide what any of them may do, a persistent task model, isolated workspaces, verification evidence, and an operator interface. It builds on the repository's existing implementation control plane, `packages/platform-control`, rather than beside it: the canonical scope is read from that registry, and the demonstration task registers this package in it.

No model runs here by default. The agents are contracts (prompt, task types, tools, allowed writes, limits, escalation). Eight of them have deterministic handlers that execute structured task specs; every other task type runs the **model loop** (`src/runtime/agentloop.ts`): the model replies one JSON object per turn, a tool request or the contract's report, and the loop executes each request through the same policy-gated toolbox a deterministic handler uses. The loop is tested end to end with a scripted model (`tests/agentloop.test.ts`), so the execution path of every model-backed agent has run; what has not run is a live model. The port (`src/runtime/model.ts`) is an HTTP client over Node's built-in `fetch`, no SDK dependency, and it is constructed only when `SEMESTER_OPERATOR_MODEL_KEY` is set in the operator's own environment. Without it a model-backed task is **blocked, not faked**. Supplying a key is a credential decision for an owner (`docs/AGENT-TOOLING.md`); adding the Claude Agent SDK instead goes through the supply-chain workflow.

## Run it

From the repository root, after `npm ci`:

```sh
npm run operator:typecheck        # tsc, NodeNext, erasable syntax only
npm run operator:test             # 49 tests, node:test, no live model, no network (the HTTP port is tested against a local server)
npm run operator:build            # regenerate generated/ (agents, suites, modules, coverage matrix); CI diffs it
npm run operator -- help          # the operator interface
npm run operator -- agents
npm run operator -- status
npm run operator:demo             # the end-to-end demonstration (needs the package committed at HEAD)
```

Live state defaults to `operator/.state/` (gitignored) or `$SEMESTER_OPERATOR_STATE`. The demonstration writes to `evidence/demo/state/`, which is committed as the record of that run.

To run model-backed task types, the person operating the process sets, in that process only:

| Variable | Meaning |
| --- | --- |
| `SEMESTER_OPERATOR_MODEL_KEY` | The API key. Absent means no model: the loop blocks. A developer's `ANTHROPIC_API_KEY` is deliberately not read. |
| `SEMESTER_OPERATOR_MODEL` | Model id, default `claude-sonnet-5-5`. |
| `SEMESTER_OPERATOR_MODEL_URL` | Endpoint override, default `https://api.anthropic.com`. |
| `SEMESTER_OPERATOR_MODEL_PRICE` | `input,output` in USD per million tokens. Without it cost is recorded as unmetered, never as zero, and the cost ceiling cannot bind. |

The key is sent in one request header and never written to the store, the audit or an evidence item. `run_check` subprocesses get a minimal environment without it. Everything sent to the model, the opening task description and every tool result, passes the same redaction as the audit log.

## What is implemented and tested

| Piece | Where | Held by |
| --- | --- | --- |
| Persistent goals, tasks, dependencies, execution records, approvals, schedules, kill switch, audit journal | `src/store/store.ts` (atomic JSON documents, append-only JSONL audit) | `tests/controls.test.ts`, `tests/runtime.test.ts` (state survives a new runtime over the same directory) |
| C01 policy controller: ordered, fail-closed, frozen policy | `src/control/policy.ts`, `policy/policy.json` | `tests/controls.test.ts`: kill switch, ungranted tool, observe mode, outside workspace, protected path, disallowed write, protected read, command off the allowlist, operate mode, approval lookups. Removing the protected-path rule turns two tests red. |
| C02 approval service: exact tool, target, payload hash, artifact hash, task, approver ≠ actor, expiry, use count, revocation; the policy gate forwards the action's artifact hash so an artifact-bound approval is consumed only by that artifact | `src/control/approvals.ts`, `src/control/policy.ts` | `tests/controls.test.ts`; removing the payload-hash binding or the artifact-hash forwarding turns the approval test red |
| C03 scheduler: dedupe, dependency joins (unverified writes flow only into checks and verification; an observe-mode report flows once it is in), cycles, concurrency, bounded attempts, validated handoffs (routes, depth 3, count 3, enabled flag), cancel, restart recovery, schedules | `src/control/scheduler.ts` | `tests/scheduler.test.ts` |
| C04 limits: per-run turns, tool calls, elapsed, retries, cost; aggregate across runs; a worker holds only `consume` | `src/control/limits.ts` | `tests/controls.test.ts` |
| C05 audit (redacted, hash-chained, tamper-detected) and kill switch (stops new work, interrupts running work, records pending external actions, never auto-repeats them) | `src/control/audit.ts`, `src/store/redact.ts` | `tests/controls.test.ts`, `tests/runtime.test.ts` |
| Narrow tool adapters: read, list, search (literal text, never a model- or spec-supplied regular expression; both walkers skip protected reads per file), write (workspace only), run_check (allowlisted argv, no shell, minimal environment, timeout), git_diff | `src/tools/adapters.ts` | `tests/runtime.test.ts`, `tests/agentloop.test.ts` |
| Isolated workspaces: one git worktree per writing task, from an exact commit, on its own branch | `src/tools/workspace.ts` | `tests/runtime.test.ts` (the operator's checkout is untouched) |
| Ecosystem coverage registry: one row per platform-control record, status derived from evidence and operator tasks | `src/registry/coverage.ts`, `generated/coverage-matrix.{md,json}` | `tests/roster.test.ts` |
| 33 agent contracts, 12 suites with handoff routes, 17 module agents generated from the registry's pilot release scopes | `src/agents/*.ts`, `generated/agents.md` | `tests/roster.test.ts`, `tests/scheduler.test.ts` |
| Runtime: claim → limits → workspace → policy-gated tools → handler → evidence → status → audit; handoffs queued only by the scheduler | `src/runtime/operator.ts`, `src/runtime/handlers.ts` | `tests/runtime.test.ts` |
| Model loop: one JSON action per turn, tool requests executed through the gated toolbox, denials fed back (three block the task), turn and cost budgets spent on every call (`maxTurns` is exactly the number of model calls), malformed output corrected once then failed, a worker's verdict refused, every message to the model redacted | `src/runtime/agentloop.ts` | `tests/agentloop.test.ts`: 12 tests with a scripted model. Removing the outcome check, the message-boundary redaction, the turn spend, the limit tightening or the denial counter turns one test red each. |
| Model port: Messages API over built-in `fetch`, off unless the operator's own key variable is set, fails closed on an error status | `src/runtime/model.ts` | `tests/agentloop.test.ts` against a local HTTP server; `modelFromEnvironment({})` is `noModel` |
| Planner-tightened limits: a task may carry lower limits than its contract, never higher | `src/control/scheduler.ts` `tighten` | `tests/agentloop.test.ts` |
| Operator interface | `scripts/operator.ts` | smoke-run; the commands call the tested runtime |
| The committed demonstration as evidence: audit chain intact, continuation record agrees with the task store | `evidence/demo/` | `tests/evidence.test.ts` |

## Agent status

| Status | Agents | Meaning |
| --- | --- | --- |
| Implemented and tested, deterministic | A01 coordinator (`plan`, `close`), A02 ecosystem-registry (`coverage.refresh`), A04 architecture-review (`inspect.repository`), A07 frontend-engineer, A10 backend-engineer, A19 repair-engineer (`implement.patch`), A15 test-engineer (`run.checks`), A16 independent-verifier (`verify`), A20 release-controller (`release.prepare`, stops at the approval gate), A33 knowledge-maintainer (`docs.continuation`) | A deterministic handler executes the task type; its execution path runs in `tests/runtime.test.ts` and in the committed demonstration. |
| Execution path tested, live model unverified | A03, A05, A06, A08, A09, A11, A12, A13, A14, A17, A18, A21, A22, A23, A24, A25, A26, A27, A28, A29, A30, A31, A32, and `implement.task` on A07, A10, A19 | The task runs the model loop; its path (prompt assembly, tool gating, denial feedback, limits, report validation, redaction, handoffs) runs in `tests/agentloop.test.ts` with a scripted model. No live model has answered: no key is configured, and none is committed. A17 (read-only) and A10 (`implement.task`, worktree) are the two contracts the scripted tests drive. |
| Blocked by missing tools or authority | A20 `release.execute` (no deployment adapter), A27 `external_send` (no sending adapter), A13 sandbox verification (no provider credential), A18/A21/A25 operational signals (no approved read-only connection), A22 drills (no backup access), A29 (no authorized financial source), `registry_read` and `store_read` inside the model loop (not yet exposed; the deterministic handlers read the registry and the store directly) | The contract names the adapter or authority it needs; nothing pretends to have it. |

A model-backed agent gets no wider access than its contract: the same policy controller gates every tool call, the model never holds a tool, and a denial is reported to it as a result rather than hidden.

## The demonstration

`npm run operator:demo` runs one goal end to end against this repository and leaves its record in `evidence/demo/`:

1. A04 inspects the controls registry and its validator.
2. A10 writes `packages/platform-control/registry/controls/operator.json` in an isolated worktree.
3. A15 runs `registry:validate` and `platform-control:test` there, recording argv, cwd, exit code and output hashes.
4. A16 recomputes the diff hash, evaluates every acceptance criterion, and returns a verdict; the reviewed tasks move to `verified` only on acceptance.
5. A negative control: A10 tries to write `operator/policy/policy.json`; the policy denies it (`protected_path`), the task is blocked, and A16 accepts the denial as the criterion.
6. A20 prepares a staging release and stops at `awaiting_approval`; nobody granted one, and no adapter exists.
7. A02 confirms the coverage matrix is in step; A33 writes the continuation record.

The worker's diff is exported as `evidence/demo/implement.patch`. Applying it to the branch is the operator's action, taken by a person, not something a worker does.

## Operating modes and environments

Every agent starts in **observe**. A task carries the mode the coordinator granted from the agent's contract (`develop` for agents with write or check tools, `observe` otherwise); a worker cannot change it. **Operate** is required for release and sending adapters and is granted to no task today. The environment (`development`, `staging`, `production`) is separate: writes and external actions in staging or production need an approval even at low risk, and production credentials never reach a workspace.

## What this package deliberately does not do

- Call a model, or claim an agent is operational whose execution path has not run.
- Push, merge, deploy, send, purchase, or touch production. The adapters do not exist; the policy denies the tool until they do and are tested.
- Give a worker a shell. `run_check` runs one allowlisted argv with a minimal environment.
- Let a worker change the policy, the approvals, the control modules, workflows, lockfiles or secrets, even inside its own workspace.
- Re-run an interrupted external action after a restart. Recovery marks it interrupted and leaves the decision to a person.

## The supplied documents, reconciled

Two documents arrived with the request. The *Semester agent suite* defines a 12-role suite, the observe/develop/operate modes and the approval record shape; the *automation runner* design adds validated handoff routes between the 12 roles, bounded depth and count, dependency joins and exact-artifact verification. Both are adopted as data: the 33 agents each belong to one of the 12 suites (`src/agents/suites.ts`), handoffs follow the runner's route table, approvals carry the suite document's fields. Their Python/SQLite runtime on the Claude Agent SDK is not adopted: this is a Node workspace, the SDK is not a dependency, and no credential exists. The model port speaks the Messages API directly; the SDK could replace it behind the same interface.

## Expansion, in order

1. A live model run: an owner sets `SEMESTER_OPERATOR_MODEL_KEY` for one operator process and runs one read-only task (A17 `security.review`) under the default $1 ceiling with `SEMESTER_OPERATOR_MODEL_PRICE` set, then records the run under `evidence/`. Until then the model loop is tested, not proven live.
2. A deployment adapter behind `release_adapter`, with the approval bound to target and artifact hash.
3. Approved read-only operational connections for A18, A21, A25.
4. A sending adapter behind `external_send`, drafts first.
5. A database-backed `OperatorStore` when more than one process needs the state.
