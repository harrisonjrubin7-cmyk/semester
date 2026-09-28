# 0009 · Consequential workflows are state machines, not button handlers

**Status:** Accepted. Four machines are defined; the two that already existed
are indexed rather than moved.

## Decision

A workflow whose wrong transition costs somebody something — a submission, a
grade on its way to the gradebook, a deletion request, a support grant — is
written down as a `WorkflowDefinition` in `packages/institution/src/
workflow.ts`: every state, every legal move, which states are final, and which
moves are exception paths. A caller asks `transition(def, from, to)` before it
writes and writes the state it was handed back. The definition has no
storage and takes no action.

Two machines already lived beside their storage and stay there: the two-phase
university action in `server/institution/journal.ts` (`ready → processing →
completed | pending | refused | uncertain`) and a tenant's go-live in
`app/src/lib/governance/rollout.ts`, whose states are the database's own
(`tenant_rollout.state`).

## Why

The specification names the failures a machine prevents: a student changing a
submitted assessment after the deadline, a grade marked passed back before the
gradebook acknowledged it, a deletion completing with the legal hold
unchecked. Each is an illegal transition, and the reliable way to make one
impossible is to enumerate the legal ones and refuse the rest. The journal's
`uncertain` state is this repository's own proof: nothing transitions out of
it on a timer or a retry, and that one rule is why a student is never charged
twice. The grade-passback machine's `ambiguous → reconciliation_required` is
the same rule, for the same reason.

## How it is held

`workflow.test.ts` is exhaustive: for each machine it checks every pair of
states, asserting each is allowed exactly when the table says so, with the
two controls that a table allowing nothing or refusing nothing would fail. It
also proves every state is reachable from the start and every state can reach
an end, so a machine cannot strand a workflow.

## What it was chosen over

- **A workflow engine or an orchestration library.** Rejected: the machines
  are small, the storage differs per workflow (a journal row, a Postgres row,
  a device store), and a pure definition can be tested exhaustively where an
  engine's cannot.
- **Moving the journal's and the rollout's machines here.** Rejected: each is
  enforced where its rows are, and a copy would be the drift this record
  exists to prevent.

## What this constrains

A screen that moves one of these workflows shows the exception paths as
exceptions (`exceptional: true`), and never offers a button for a move the
table refuses. Adding a state means adding it to both the state list and the
table; the test holds them equal. What would reopen this: a fifth workflow
whose transitions depend on data the definition cannot see, which is the case
for a guard-based machine.
