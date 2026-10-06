# Controlled commands and events

Sensitive institutional changes follow the sequence in `TARGET_ARCHITECTURE.md`: authenticate, resolve membership and tenant, check capability and relationship, evaluate policy and consent and entitlement and workflow state, read the authoritative record, preview when the action is material, approve or step up when required, run an idempotent command, commit the change with an audit record and an outbox event, update projections, notify people who may know, return a receipt and a remediation path.

The device registration plan is not that command.

| Step | Device plan | Official registration |
| --- | --- | --- |
| Authenticate | Not required | Required when the gate is on |
| Authorize | The person at the keyboard | Membership, tenant, capability |
| Authoritative read | None | School records, when connected |
| Preview | The codes about to be stored | The operations roadmap’s impact preview is still open (OP-09) |
| Approval | None | Holds and overrides as the ledger defines; not executed here |
| Write | `addCourse` on the device | Enrollment command, gated off in the UI copy |
| Audit | `source: Added by hand` | Ledger design; production rows unverified |
| Outbox | None | Domain outbox described in the roadmap; relay not confirmed |
| Receipt | On-screen sentence: not the school’s registration record | Would be the school’s confirmation. Not returned by this batch |
| Undo | Delete the device course | Compensating drop or an external correction. Deleting the device course does not drop a class |

Exactly-once delivery is not promised for any future event consumer. Consumers must be idempotent.

An approval, when one is added, must be bound to the action and the inputs. If the record version or the impact changes, the approval is reviewed again.

Audit rows are not ordinary editable fields. Retention, redaction, restricted read, and correction are specified in `docs/operations/OPERATIONS_AUDIT_AND_EVIDENCE.md` and are not re-decided here.
