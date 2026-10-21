# Access-control baseline (use this one)

The PDFs say to use one implementation baseline in place of the overlapping earlier examples, rather than adding another parallel authorization system. This folder is that baseline:
- PE access decisions, PA grant administration and PEP enforcement, all in one policy file
- a saga transition guard
- a saga worker, and a PostgreSQL job worker
- unit tests

Sources:
- `uploads/Build a NIST Zero Trust Open Policy Agent suite -.pdf`
- `uploads/NIST Zero Trust Saga Runbook_ Build a state machin.pdf`

Two limits:
- These are Semester's own policies based on NIST's architectural roles. They are not "NIST-certified".
- `opa test` checks policy logic only. It doesn't test PostgreSQL transactions, worker recovery or actual token revocation.

None of this has been compiled or run.

Interactive version: `ui_kits/governance-backbone/index.html#baseline`.

## Files
| Path | What it is |
|---|---|
| `policies/zta.rego` | `pe_allow`, `pa_prepare`, `pa_revoke` and `pep_allow` over one trusted input contract |
| `policies/data.json` | Policy revision and action rules |
| `policies/zta_test.rego` | 21 tests. The PDF's fixture is corrected so its passing-case tests can pass; I added the tests the PDF asks for |
| `policies/saga.rego` | Transition guard for this worker's 11 states, with snake_case input |
| `policies/saga_test.rego` | 15 tests, including the six the PDF lists |
| `worker/saga-worker.ts.txt` | Saga worker: one durable operation per tick, with explicit cleanup states |
| `worker/durable-access-worker.ts.txt` | PostgreSQL job worker: claims with `FOR UPDATE SKIP LOCKED` and a lease, quarantines replies that don't match, and writes receipt + outbox in one transaction |
| `db/001_access_jobs.sql` | Starting schema for `access_jobs`, `access_operation_receipts` and `access_outbox` |
| `scripts/verify.sh` | `opa check --strict` and `opa test --fail-on-empty` |

Remove the `.txt` suffix from the TypeScript files when you copy them; it stops the design system's build from bundling them.

## Lifecycle
1. An access request comes in and the PE evaluates it. A denial goes to DENIED. Step-up or approval rebuilds the context and evaluates again.
2. On allow: PREPARE, then INSTALL, then INSPECT the actual PEP state.
3. INSPECT results:
   - **valid:** ACTIVE
   - **unknown:** inspect again
   - **absent or conflict:** REVOKE_PA
4. Expiry, cancellation or loss of authority sends any state to REVOKE_PA.
5. Cleanup runs REVOKE_PA, then REMOVE_PEP, then VERIFY_CLEANUP, then CLOSED.
6. If cleanup can't be confirmed, it stays open with retry, containment and escalation. It never closes falsely.

## Compensation rules
- Register who is responsible for cleanup **before** preparing or installing a grant.
- Revoke by saga and generation even if the returned grant ID was lost.
- Record a PA revocation barrier before removing PEP access, and reject later installation messages for revoked generations.
- Close only after PA revocation and PEP absence are both confirmed.
- Treat network timeouts as uncertain outcomes, not failures.
- Compensations must themselves be idempotent, and must cope with the forward operation never having happened.

## Token revocation: removing a database grant isn't enough
| Mechanism | What Semester must verify |
|---|---|
| Server-side session | The session record is revoked and enforcement checks it |
| Refresh token | The issuer has invalidated its refresh capability |
| Self-contained access token | The PEP uses current revocation or introspection, or a short expiry. Removing a database grant alone may not invalidate it |
| Installed resource grant | Every relevant PEP rejects that grant and generation |
| Offline cached content | Future access can be restricted; content already shown can't be recalled |

**Never label access "revoked" just because a refresh token was removed while an access token is still usable.**

## The result-to-state consumer
1. Receive the outbox result event.
2. Authenticate the producer and check its channel permissions.
3. Deduplicate the event.
4. Load the protected operation receipt.
5. Load the current saga and the command it expects.
6. Check tenant, generation and operation identity.
7. Build the candidate transition.
8. Evaluate it with OPA.
9. In one transaction:
   - save the saga revision
   - record the event receipt
   - append audit and outbox records
   - schedule the next operation
10. Acknowledge the event.

A stale result is never applied blindly. If it suggests access might exist after cancellation, it goes to compensation and reconciliation.

## Work still to do (from the PDF)
- Validate result bodies against schemas for each operation.
- Add local audit capture to the receipt transaction.
- Replace the sample fixed delay with exponential backoff, jitter, deadlines and escalation.
- Add a limited participant timeout, and lease renewal where needed.
- Keep participant idempotency durable. Worker lease ownership alone can't prevent duplicate remote execution.
- Deduplicate result events on arrival (an inbox).
- Make outbox delivery retryable; consumers must tolerate duplicates.
- Reconcile quarantined, expired and orphaned operations.
- Make the PA and PEP reject late installations after cancellation.
- REVOKE_PA must work by saga and generation without a known grant ID.
- INSPECT must be a fresh read, not a cached "unknown" receipt replayed forever.

## Test layers
| Layer | Tool | What it proves |
|---|---|---|
| PE/PA/PEP policies | opa test | Given inputs produce the expected decisions |
| Transition rules | opa test | Illegal state transitions are rejected |
| Worker logic | The repo's TypeScript test runner | Replies and failures pick the right next states |
| Durable storage | PostgreSQL integration tests | Leases, revisions, receipts and audit/outbox transactions work |
| Participant behavior | Adapter integration tests | Idempotency and revocation actually work |
| End-to-end recovery | Fault injection | Crashes and timeouts don't create unauthorized access |

## Failure scenarios
| Test | Expected result |
|---|---|
| Worker crashes after the PA prepares a grant | The same operation identity recovers that grant |
| Worker crashes before the receipt commit | The expired lease allows a retry with no duplicate effect |
| Lease expires during a remote call | The old worker can't commit |
| Two workers claim at once | A job has one current valid owner |
| Installation times out after succeeding | Inspection finds the actual access |
| Cancellation races installation | The revocation barrier blocks reactivation |
| The outbox publishes twice | The state consumer advances once |
| OPA is unavailable | No sensitive forward transition |
| The PEP is unreachable during cleanup | Recovery stays open and escalates |
| A database commit fails | The saga isn't wrongly labeled as a remote failure |
| The refresh token is revoked but the access token is still valid | Revocation is detected as incomplete |

> Durable execution remembers what happened. Policy validation governs what may happen next. Reconciliation proves that access actually matches the intended state.
