# Access Review Procedure

| Control | Value |
| --- | --- |
| Status | **CONTROLLED PROCEDURE — NO COMPLETED RECURRING CUSTOMER REVIEW** |
| Owner | Harrison Rubin — company-side IAM coordinator; customer IAM/system/data approvers and independent reviewer unassigned |
| Evidence date | 2026-10-03 at repository revision `d246a348` |
| Source | [`../trust/ACCESS-CONTROL-POLICY.md`](../trust/ACCESS-CONTROL-POLICY.md), [`ROLE-AND-PERMISSION-MATRIX.md`](ROLE-AND-PERMISSION-MATRIX.md), and [`AUDIT-LOGGING-EVIDENCE.md`](AUDIT-LOGGING-EVIDENCE.md) |

## Purpose and cadence

Review access before activation, at least quarterly once operated, and on hire/transfer/termination, role or group change, contract/scope change, incident, extended inactivity, failed control, privileged access, break-glass use or material system/data change. The customer sets the accepted cadence and owners. A query or export is review input, not proof that a qualified person assessed and remediated it.

## Scope

Include human, service, provider and integration identities; SSO/SCIM membership and group mappings; roles/capabilities/scopes; privileged/global accounts; tenant/customer admins; support/time-bound grants; database/provider/hosting/source-control access; API keys/secrets; LTI/SIS/LMS connections; audit/trust-room access; emergency access; dormant/orphan/shared accounts; pending approvals; exceptions and compensating controls.

## Procedure

1. **Authorize the review.** Name period, tenant/environments, systems/data classes, reviewer, independent approvers, due date and evidence channel.
2. **Freeze inventories.** Export timestamped account, membership, group, role, capability, scope, service credential, privileged access, temporary grant and exception inventories from authoritative sources.
3. **Reconcile identities.** Match employment/enrollment/vendor/contract state; identify orphan, duplicate, dormant, shared, unknown, suspended and deprovisioned identities without copying unnecessary personal data into the review record.
4. **Test necessity and scope.** For each access path confirm purpose, owner, minimum capability/resource, data class, environment, start/expiry and authentication strength.
5. **Review conflicts.** Identify requester/approver, configure/approve, propose/approve, operate/reconcile, administer/audit and other prohibited combinations; document approved exceptions and expiry.
6. **Review privileged and machine access.** Confirm named custody, MFA/step-up, secret rotation, network/environment limits, recent use and emergency controls.
7. **Sample effective access.** Run representative positive and negative tests, including wrong tenant/resource, revoked membership and expired temporary access; reconcile effective access to the approved matrix.
8. **Decide and remediate.** Retain, narrow, suspend, revoke or investigate. High-risk unknown or unauthorized access is contained under incident/change authority rather than left pending.
9. **Verify closure.** Re-export/retest affected access, confirm audit evidence and exceptions, record unresolved risk/owner/deadline and escalate overdue high-risk items.
10. **Approve and retain.** System/data owners and customer authority sign the results; store a minimized immutable summary under the approved retention/hold rule and schedule the next review.

## Review record

| Item | Required evidence |
| --- | --- |
| review identity | ID, tenant, period, environment, systems, owner/reviewer/approvers, dates |
| inventory | source, query/export time, version/hash, counts by identity/access class |
| decision | protected identity reference, access/scope, purpose, owner, retain/narrow/suspend/revoke/investigate, reason |
| exception | risk, compensating controls, approver, start/expiry and review trigger |
| remediation | ticket/change reference, operator, completion, effective-access verification |
| result | counts reviewed/changed/open, material findings, incidents, residual risk, sign-off, next review |

## Evidence state

**Repository evidence.** Scoped roles/capabilities, selected lifecycle/audit/expiry/approval controls and access-policy guidance support a review process.

**Operational evidence.** No complete target identity/access inventory, customer-approved matrix, recurring review, remediation record, privileged/service-account reconciliation, staffed backups or customer sign-off is evidenced.

**Missing test/proof.** Run this procedure against the exact target with authoritative inventories; resolve discrepancies; sample effective access and joiner/mover/leaver cases; exercise privileged/emergency access; obtain owner/customer sign-off and repeat on cadence.

## Claim ceiling

Semester may say it has a controlled access-review procedure and supporting repository controls. It may not claim that access is currently or continuously reviewed.

## Prohibited claims

Do not claim completed quarterly reviews, certified least privilege, complete identity inventory, no orphan access, continuous access certification, fully governed service accounts, customer approval or institution-ready access governance without completed dated evidence.
