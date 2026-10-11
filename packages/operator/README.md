# Semester Operator

The agent team for the Semester ecosystem and its company workflows: thirty-three bounded responsibilities sharing one runtime, five deterministic control modules that decide what any of them may do, a persistent task model, isolated workspaces, verification evidence, and an operator interface. It builds on the repository's existing implementation control plane, `packages/platform-control`, rather than beside it: the canonical scope is read from that registry, and the demonstration task registers this package in it.

Nothing here is a model. The agents are contracts (prompt, task types, tools, allowed writes, limits, escalation) and, for the first eight, deterministic handlers that execute structured task specs. The model port (`src/runtime/model.ts`) is where the Claude Agent SDK would plug in; it is not installed, no credential is present, and adding either goes through the supply-chain workflow in [`docs/AGENT-TOOLING.md`](../../docs/AGENT-TOOLING.md). Until then a model-backed task is **blocked, not faked**.

## Run it

From the repository root, after `npm ci`:

```sh
npm run operator:typecheck        # tsc, NodeNext, erasable syntax only
npm run operator:test             # 37 tests, node:test, no model, no network
npm run operator:build            # regenerate generated/ (agents, suites, modules, coverage matrix); CI diffs it
npm run operator -- help          # the operator interface
npm run operator -- agents
npm run operator -- status
npm run operator:demo             # the end-to-end demonstration (needs the package committed at HEAD)
```

Live state defaults to `packages/operator/.state/` (gitignored) or `$SEMESTER_OPERATOR_STATE`. The demonstration writes to `evidence/demo/state/`, which is committed as the record of that run.

## What is implemented and tested

| Piece | Where | Held by |
| --- | --- | --- |
| Persistent goals, tasks, dependencies, execution records, approvals, schedules, kill switch, audit journal | `src/store/store.ts` (atomic JSON documents, append-only JSONL audit) | `tests/controls.test.ts`, `tests/runtime.test.ts` (state survives a new runtime over the same directory) |
| C01 policy controller: ordered, fail-closed, frozen policy | `src/control/policy.ts`, `policy/policy.json` | `tests/controls.test.ts`: kill switch, ungranted tool, observe mode, outside workspace, protected path, disallowed write, protected read, command off the allowlist, operate mode, approval lookups. Removing the protected-path rule turns two tests red. |
| C02 approval service: exact tool, target, payload hash, artifact hash, task, approver ≠ actor, expiry, use count, revocation | `src/control/approvals.ts` | `tests/controls.test.ts`; removing the payload-hash binding turns the approval test red |
| C03 scheduler: dedupe, dependency joins, cycles, concurrency, bounded attempts, validated handoffs (routes, depth 3, count 3, enabled flag), cancel, restart recovery, schedules | `src/control/scheduler.ts` | `tests/scheduler.test.ts` |
| C04 limits: per-run turns, tool calls, elapsed, retries, cost; aggregate across runs; a worker holds only `consume` | `src/control/limits.ts` | `tests/controls.test.ts` |
| C05 audit (redacted, hash-chained, tamper-detected) and kill switch (stops new work, interrupts running work, records pending external actions, never auto-repeats them) | `src/control/audit.ts`, `src/store/redact.ts` | `tests/controls.test.ts`, `tests/runtime.test.ts` |
| Narrow tool adapters: read, list, search, write (workspace only), run_check (allowlisted argv, no shell, minimal environment, timeout), git_diff | `src/tools/adapters.ts` | `tests/runtime.test.ts` |
| Isolated workspaces: one git worktree per writing task, from an exact commit, on its own branch | `src/tools/workspace.ts` | `tests/runtime.test.ts` (the operator's checkout is untouched) |
| Ecosystem coverage registry: one row per platform-control record, status derived from evidence and operator tasks | `src/registry/coverage.ts`, `generated/coverage-matrix.{md,json}` | `tests/roster.test.ts` |
| 33 agent contracts, 12 suites with handoff routes, 17 module agents generated from the registry's pilot release scopes | `src/agents/*.ts`, `generated/agents.md` | `tests/roster.test.ts`, `tests/scheduler.test.ts` |
| Runtime: claim → limits → workspace → policy-gated tools → handler → evidence → status → audit; handoffs queued only by the scheduler | `src/runtime/operator.ts`, `src/runtime/handlers.ts` | `tests/runtime.test.ts` |
| Operator interface | `scripts/operator.ts` | smoke-run; the commands call the tested runtime |

## Agent status

| Status | Agents | Meaning |
| --- | --- | --- |
| Implemented and tested | A01 coordinator (`plan`, `close`), A02 ecosystem-registry (`coverage.refresh`), A04 architecture-review (`inspect.repository`), A07 frontend-engineer, A10 backend-engineer, A19 repair-engineer (`implement.patch`), A15 test-engineer (`run.checks`), A16 independent-verifier (`verify`), A20 release-controller (`release.prepare`, stops at the approval gate), A33 knowledge-maintainer (`docs.continuation`) | A deterministic handler executes the task type; its execution path runs in `tests/runtime.test.ts` and in the committed demonstration. |
| Configured but untested | A03, A05, A06, A08, A09, A11, A12, A13, A14, A17, A18, A21, A22, A23, A24, A25, A26, A27, A28, A29, A30, A31, A32, and the model-backed task types of the agents above | The contract exists (prompt, tools, limits, writes, escalation) and the runtime routes the task to the model port, which refuses. Blocked by: no model dependency, no credential. |
| Blocked by missing tools or authority | A20 `release.execute` (no deployment adapter), A27 `external_send` (no sending adapter), A13 sandbox verification (no provider credential), A18/A21/A25 operational signals (no approved read-only connection), A22 drills (no backup access), A29 (no authorized financial source) | The contract names the adapter or authority it needs; nothing pretends to have it. |

A model-backed agent, once a port exists, gets no wider access than its contract: the same policy controller gates every tool call.

## The demonstration

`npm run operator:demo` runs one goal end to end against this repository and leaves its record in `evidence/demo/`:

1. A04 inspects the controls registry and its validator.
2. A10 writes `packages/platform-control/registry/controls/operator.json` in an isolated worktree.
3. A15 runs `registry:validate` and `platform-control:test` there, recording argv, cwd, exit code and output hashes.
4. A16 recomputes the diff hash, evaluates every acceptance criterion, and returns a verdict; the reviewed tasks move to `verified` only on acceptance.
5. A negative control: A10 tries to write `packages/operator/policy/policy.json`; the policy denies it (`protected_path`), the task is blocked, and A16 accepts the denial as the criterion.
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

Two documents arrived with the request. The *Semester agent suite* defines a 12-role suite, the observe/develop/operate modes and the approval record shape; the *automation runner* design adds validated handoff routes between the 12 roles, bounded depth and count, dependency joins and exact-artifact verification. Both are adopted as data: the 33 agents each belong to one of the 12 suites (`src/agents/suites.ts`), handoffs follow the runner's route table, approvals carry the suite document's fields. Their Python/SQLite runtime on the Claude Agent SDK is not adopted: this is a Node workspace, the SDK is not a dependency, and no credential exists. The model port is the place it would attach.

## Expansion, in order

1. A model port (dependency and credential through the supply-chain workflow), then the configured agents become testable one task type at a time.
2. A deployment adapter behind `release_adapter`, with the approval bound to target and artifact hash.
3. Approved read-only operational connections for A18, A21, A25.
4. A sending adapter behind `external_send`, drafts first.
5. A database-backed `OperatorStore` when more than one process needs the state.
