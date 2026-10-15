> **Superseded by `../baseline/`** (see `../VERSIONS.md`). Kept for history.

# Control plane v4: the runbook with a compensation lifecycle (recommended baseline)

Source: `uploads/Build a state machine runbook for NIST Zero Trust.pdf`.

This is a reference implementation, not a verified production release. Nothing has been compiled, validated or run. **v4 replaces v3 as the baseline.** In v4, undoing access has its own durable lifecycle:
- a failed installation is reconciled
- access in an uncertain state is revoked
- late messages can't bring back a revoked request

Interactive version: `ui_kits/governance-backbone/index.html#v4`.

## Files
- `access-runbook.ts.txt`: 11 states. `nextInstruction()` works out the next step (wait, execute or persist). `applyResult()` and `applyFailure()` apply outcomes with no side effects. Cleanup runs `revoke_pa`, then `remove_pep`, then `verify_cleanup`. Remove the `.txt` suffix when you copy it into the repo.
- `policy_engine.rego` (`semester.pe`) and `policy-data.json`: the decision policy. No generic trust score is needed for this pilot.
- `policy_enforcement.rego` (`semester.pep`): the check run on every request. It covers the grant, fresh revocation state, the revoked generation, current policy, and whether audit and obligations are available.
- `policy_test.rego`: 16 unit tests I wrote to cover the PDF's required policy tests, plus self-approval and stale revocation state. They haven't been run.
- `pe.asyncapi.yaml` and `pep.asyncapi.yaml`: separate event contracts for the PE and the PEP, each from that participant's point of view.

## v4.1 additions (from `uploads/State machine runbook_ NIST Zero Trust saga flows,.pdf`)
- `access-worker.ts.txt`: the durable worker. It handles four separate outcomes: remote failure, unknown outcome, policy rejection, and persistence conflict. It times out each operation using AbortSignal, checks every reply is verified before trusting it, and runs every candidate transition past the transition policy before committing.
  - **Corrections to the PDF:** `ParticipantReply` gains `tenantId` and `generation`, and `execute()` gains `operation`. The PDF's code reads both but never declared them.
- `policies/saga.rego`: the transition guard, with legal edges, stable identity, generation rules, one-way cancellation, verified progress, safe activation and closure that needs evidence.
  - **Corrections to the PDF:** it adds `import rego.v1` and `default allow := false`, and uses the `reactivation_blocked` helper the PDF itself asks for.
- `policies/saga_test.rego`: 13 tests. Eight come from the PDF; I added five for a missing context flag, a generation jump, a signal wake, clearing a cancellation, and an illegal edge.
- `scripts/verify-access-policies.sh`: runs `opa check --strict` and `opa test --fail-on-empty` on both policy sets.

### Separate time limits
| Limit | Purpose | When it runs out |
|---|---|---|
| Operation timeout | Limits how long a worker waits | Classify the outcome and reconcile |
| Provisioning deadline | Limits the access-setup journey | Start compensation |
| Grant expiry | Limits how long access lasts | PEP enforces expiry; the saga cleans up |
| Lease expiry | Limits worker ownership | Reject stale commits |
| Retry budget | Limits unattended recovery attempts | Escalate to operator-controlled recovery |
| Revocation freshness bound | Limits how stale enforcement knowledge can be | Deny protected operations, or apply approved containment |

Running out of ordinary retries never stops a required revocation. Escalation changes who owns the problem; it doesn't turn uncertain cleanup into success.

**Escalation path:**
1. Transient failure: retry with the same key and limited backoff.
2. Reconcile.
3. If the recovery threshold is exceeded, create a restricted operator task and an exposure status.
4. Apply approved containment.
5. Continue verified cleanup.
6. Close with evidence.

**Operators must never set CLOSED by hand to clear an alert.**

### What a timeout means for each operation
- **Evaluate:** retry with a fresh trusted evaluation.
- **Prepare:** recover using the original operation identity.
- **Install:** inspect the actual enforcement state.
  - valid: verify, then continue
  - absent or conflict: compensate
  - unknown: reconcile, within limits
- **Revoke or remove:** stay in RECOVERY_REQUIRED.
  - retry, then contain
  - verify both the PA and PEP
  - close only once confirmed

## Worker persistence contract
1. Claim a leased saga with a fencing token.
2. Work out the next instruction.
3. Execute it with a stable operation key.
4. Save the operation receipt.
5. Compare-and-swap the saga revision.
6. Append audit and outbox records in the same transaction.
7. Release the lease.

Storage failures must never be reclassified as remote operation failures.

Before applying an asynchronous result, check its producer, saga ID, tenant, generation, command ID and expected operation. If a cancellation wins a race, a late success is reconciled or compensated. It's never applied in a way that brings access back.

## Required compensation behavior
- `revoke_pa` revokes by saga and generation even when the grant ID is unknown, so a grant that was prepared but never attached can't survive a crash.
- Revocation barrier: if an installation's generation is at or below the revoked generation, the installation is rejected. Barriers must be kept for as long as messages can live, plus retries, the grant's lifetime and replay procedures.
- "Absence verified" means both sides: the PA will no longer authorize installation, and the PEP no longer enforces the grant. Seeing no grant at the PEP alone doesn't rule out an installation still in progress.

## Operator runbook
| Condition | Required response |
|---|---|
| Evaluation unavailable | Create no new protected grants; retry within limits |
| Approval completed | Rebuild context and evaluate again; never trust a bare completion event |
| Installation timed out | Inspect the actual state before retrying or compensating |
| Policy or access revision changed | Evaluate again, or compensate, depending on the request state |
| Cancellation during install | Record the revocation barrier before cleanup |
| PA revoked but PEP unreachable | Keep recovery open; enforce approved containment and expiry |
| Prepared grant orphaned | Find it by saga and generation; revoke it even without a stored grant ID |
| Old install message replayed | Reject the revoked or expired generation |
| Cleanup verification uncertain | Don't mark it closed |
| Audit persistence unavailable | Don't acknowledge a new sensitive grant |

## Recovery tree: an operation failed. Is its effect known?
- **No effect**
  - Transient: retry with the same key.
  - Permanent: compensate, or close.
- **The correct effect exists:** save the recovered receipt and continue.
- **An incorrect effect exists:** revoke at the PA, then remove at the PEP, then verify the cleanup.
- **Unknown:** inspect and reconcile.
  - If resolved, follow the matching branch above.
  - If unresolved, contain and escalate.

## Validation (only where OPA is installed)
```
opa check --strict policy_engine.rego policy_enforcement.rego policy_test.rego
opa test . -v
```

## Final release checks (v4.1)
- [ ] Compile the TypeScript against the existing runbook
- [ ] Validate the policy input and output schemas
- [ ] Run the Rego tests, including missing-field and wrong-type tests
- [ ] Test lease expiry and concurrent cancellation
- [ ] Test a worker crash after a remote success but before commit
- [ ] Test recovering a prepared grant with no local grantId
- [ ] Test a revocation racing a late installation
- [ ] Test repeated and out-of-order results
- [ ] Test the PEP being unavailable for a long time
- [ ] Confirm a policy-service failure doesn't grant access
- [ ] Confirm recovery alarms and evidence are restricted and actionable

> A saga may retry work, but it must never retry its way around authority, revocation, or uncertainty.

## Required saga tests
- [ ] A duplicate operation returns the same result
- [ ] Same key with different input conflicts
- [ ] A worker crash after a successful prepare recovers the grant
- [ ] An install timeout enters reconciliation
- [ ] A cancellation racing an installation can't restore access
- [ ] A late result from an old generation is rejected
- [ ] PA revocation and PEP removal are verified independently
- [ ] Uncertain cleanup stays RECOVERY_REQUIRED

Before deployment:
- compile the TypeScript
- validate both AsyncAPI documents
- build the durable adapters
- test the mapping from code to messages
- rehearse revocation while dependencies are down

**Done means verified access state, not a message that reported success.** The right person gets the right limited access, and compensation reliably prevents future access once authority ends.
