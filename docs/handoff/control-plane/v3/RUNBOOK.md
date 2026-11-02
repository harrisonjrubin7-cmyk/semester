# Access saga runbook (v3)

From `uploads/Map NIST Zero Trust saga flows into a complete Asy.pdf`.

This specification is written with production in mind but is **not production-ready**. None of it has been compiled, validated or exercised in Semester's environment. A saga coordinates local transactions and compensations. It can't undo information that has already been disclosed.

Interactive version: `ui_kits/governance-backbone/index.html#coord`.

> TypeScript sources carry a `.txt` suffix so the design-system compiler doesn’t bundle them; strip it when copying into the repo.

## Required invariants
1. The PEP resolves identity and resource scope from trusted sources.
2. An allow decision is tied to subject, tenant, resource, action, input digest, policy and access revision, and expiry.
3. The PA can't issue a grant from an expired or superseded decision.
4. The PEP validates grants independently and enforces their obligations.
5. Every remote change is idempotent.
6. Revocation records survive retries and installation messages that arrive out of order.
7. A timeout means the outcome is unknown. Inspect before deciding what happened.
8. Sensitive saga progress, audit and outbox records are committed in one transaction.
9. Broker messages authenticate their producer. Claims in the payload alone are never trusted.
10. Compensating an access request never implies that data already viewed has been recovered.

## Operation identity
| Kind | Identity |
|---|---|
| Request | authenticated caller + tenant + endpoint + client idempotency key |
| Remote operation | saga ID + authorization generation + operation name |
| Request binding | canonical request digest |
| Event deduplication | consumer identity + event ID |

A new policy evaluation may use a new generation. Retrying the same remote change must never invent a new operation identity.

## Failure recovery tree: did the operation change remote state?
- **Definitely no**
  - Invalid or forbidden: reject, final.
  - Transient failure: retry within limits, with the same key.
- **Definitely yes**
  - Result matches the approved scope: save it and continue.
  - Result conflicts with authority: revoke and contain.
- **Unknown**
  - Look it up by operation key and grant identity.
  - Reconcile against the authoritative PA and PEP state.
  - Keep the status marked uncertain.
  - Escalate. Never invent success and never repeat the change blindly.

## Operator procedure
| Situation | Immediate action | Evidence needed to close |
|---|---|---|
| PE unavailable | Stop new protected grants; keep safe public functions running | Successful re-evaluation or a final denial |
| Installation timeout | Inspect the actual PEP state | A matching grant or verified cleanup |
| Scope mismatch | Block activation and request revocation | Verified removal of enforcement |
| Revocation pending | Mark the exposure, retry, apply approved containment | Every required PEP shows absent or expired |
| Duplicate or out-of-order result | Remove the duplicate or reject the stale generation | Receipt and audit record of the rejection |
| Lease conflict | Stop the stale worker; don't overwrite | The valid lease holder (current fencing token) resumes |
| Orphaned prepared grant | Resolve the operation receipt; revoke if no saga owns it | Grant closed; saga and accounting references reconciled |
| Evidence upload failure | Retry delivery from the durable reference | Artifact attached without exposing its content |

## Safe replay
1. Verify the operator's authority.
2. Inspect the original command identity and request digest.
3. Work out whether the original effect already exists.
4. Recheck the current policy and revocation state.
5. Replay the same logical change only where that's permitted.
6. Keep the receipts and audit records.
7. Verify the actual enforcement afterwards.

**Never replay an old installation message just because it's sitting in a failed-message queue.**

## Coordinator adapter requirements
- The participant adapter saves operation results durably.
- A successful prepare recovered after a crash returns the same grant.
- The PEP treats a PA revocation as authoritative, even if an installation message arrives later.
- Signals received while waiting are authenticated, duplicates are removed, and each restarts evaluation with a new generation.
- `scheduleRetry` applies limited backoff, jitter and escalation.
- A separate sweeper reconciles prepared or orphaned grants and active enforcement.
- After a saga closes, a new access request can take its place. It never silently reuses a revoked grant.

## Validation (only where OPA is installed)
```
opa check --strict semester_access.rego
opa test . -v
```
Use the repository's own TypeScript and contract-validation tools for the other files. Don't assume the scripts exist.

## Mandatory release evidence
- [ ] Rego compiles, and tests for missing input and cross-tenant requests deny
- [ ] Coordinator compiles and transition tests pass
- [ ] Durable store enforces fencing and writes the outbox in the same transaction
- [ ] Same key with a different payload conflicts
- [ ] A crash after a successful remote operation resumes without duplicate effects
- [ ] PA decision binding and expiry are enforced
- [ ] PEP obligations and revocation generations are enforced
- [ ] A late install can't bring back revoked access
- [ ] Unknown outcomes stay uncertain until reconciled
- [ ] Event producer, command ID, tenant and generation are checked
- [ ] Contracts validate and payload mappings are tested
- [ ] Revocation and orphaned-grant sweeps are exercised
- [ ] Broker access control and restricted evidence storage are verified
- [ ] Human reviewers approve the deployment and the remaining risks

The production standard is not "all the files exist". It's that authorization, persistence, retries, compensation, revocation and reconciliation stay correct when processes crash, messages repeat, dependencies disappear and policy changes mid-flight.
