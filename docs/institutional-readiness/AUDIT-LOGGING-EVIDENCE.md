# Audit Logging Evidence

| Control | Value |
| --- | --- |
| Status | **DISTRIBUTED REPOSITORY CONTROLS PRESENT — COMPLETE TARGET COVERAGE AND OPERATED REVIEW ABSENT** |
| Owner | Harrison Rubin — company-side security/operations owner; backup reviewer, customer auditor and retention approver unassigned |
| Evidence date | 2026-10-03 at repository revision `d246a348` |
| Source | [`../trust/LOGGING-MONITORING-AND-ALERTING-STANDARD.md`](../trust/LOGGING-MONITORING-AND-ALERTING-STANDARD.md), [`../trust/EVIDENCE-REGISTER.md`](../trust/EVIDENCE-REGISTER.md), and [`../architecture/0010-correlation-ids-and-error-envelope.md`](../architecture/0010-correlation-ids-and-error-envelope.md) |

## Evidence inventory

| Event family | Repository evidence | Intended boundary | Missing operational proof |
| --- | --- | --- | --- |
| common security/privacy/rights events | controlled-writer/RLS/immutability tests and correlation fields | authorized tenant auditors; no client forgery | target event matrix, export/query, sink/access and review evidence |
| role grants | pseudonymous append-only audit and immutability checks | grant/change/revocation without raw subject identifier | sampled target lifecycle and recurring review |
| provisioning | immutable tenant-bound provisioning outcomes | accepted/refused SCIM actions | real IdP events, alerting and review |
| moderation | append-only action/status evidence | authorized reviewers; content minimization | complete action coverage and operated sampling |
| support access | grant/read/expiry evidence design/tests | scoped access visible/auditable | staffed target exercise and revocation review |
| gateway/institution actions | journal/audit records with correlation IDs and selected fail-closed controls | approved action and reconciliation trace | live sink, key/configuration, export, restore and customer acceptance |
| integration | connection/scope/run/error/replay/reconciliation records | tenant-scoped operational evidence | real adapter events, thresholds and operator review |
| console/high-risk actions | action-first audit, approval/break-glass and integrity-chain controls | privileged action trace | deployed key/readback, daily seal verification and independent review |
| LTI/application/auth | structured function/provider logs and refusal codes | diagnostic/security context | durable accepted launch/auth audit and complete route coverage |

## Minimum event contract

Record event type/version, timestamp, environment/service, outcome/reason, correlation/request ID, authorized actor or pseudonymous reference, tenant/scope/resource reference only when necessary, action, approval/change reference, source/configuration version and integrity/retention class. Never log secrets, tokens, passwords, signing material, full assertions, unnecessary request bodies, student content, sensitive attributes or raw identifiers when a protected reference suffices.

## Coverage and acceptance procedure

1. Inventory high-risk actions and required success/refusal/failure events across identity, access, admin, integration, AI, privacy, security, deletion/export/hold, release and recovery.
2. Trace each route to its event producer, sink, schema, access policy, retention/legal hold and correlation path.
3. Generate representative allowed and denied events; prove a client cannot forge, edit or improperly read them.
4. Test clock/order, correlation, pseudonymization/redaction, loss/backpressure, duplicate delivery, unavailable sink and fail-closed requirements.
5. Export a bounded tenant/audit sample; reconcile expected versus recorded events; verify integrity and access logging.
6. Exercise alert/escalation/runbook for selected security events and document acknowledgement/closure.
7. Verify retention sweep, legal hold, backup/restore and disposal for each event class.
8. Obtain security/privacy, records and customer acceptance for exact target coverage and limitations.

## Evidence state

**Repository evidence.** Multiple append-only/immutable event families, controlled writers, RLS, pseudonymization, correlation, retention and integrity controls have targeted repository checks.

**Operational evidence.** There is no proved complete event inventory, consolidated production sink, universal event coverage, operated review cadence, staffed alert rota, accepted export, target retention/restore, or customer sign-off.

**Missing test/proof.** Build the exact-candidate coverage matrix; run positive/negative/loss/access/export/retention/restore exercises; reconcile event counts; assign primary/backups; complete recurring sample review and target acceptance.

## Claim ceiling

Semester may describe specific event families and dated repository tests. It may not claim a complete or institution-accepted audit trail.

## Prohibited claims

Do not claim complete audit logging, tamper-proof production logs, real-time detection, 24/7 monitoring, nonrepudiation, regulatory compliance, customer-accessible audit export, guaranteed retention or institution-accepted operations without matching target evidence.
