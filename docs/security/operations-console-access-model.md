# Operations Console access model

## Security objective

An operator sees the minimum data and actions required for a named purpose, for a bounded time, inside a visible tenant/environment context. Frontend hiding is usability only; server authorization and RLS decide access.

## Context required on every request

- authenticated actor and session;
- tenant or explicit company-global scope;
- active membership/role and capability grants;
- purpose code and related ticket/incident/change where required;
- data classification and requested action;
- MFA level/freshness;
- support/JIT grant and expiry if applicable;
- correlation ID and idempotency key for writes.

The backend derives and validates tenant context. Client input may narrow scope but cannot establish it.

## Roles and capabilities

Use small role bundles and explicit capabilities. Representative roles include platform operator, security responder, privacy operator, support agent, implementation manager, integration admin, release manager, business admin, finance operator, marketing operator, legal/procurement operator, and auditor. A role is not a universal staff credential.

## Classification controls

| Class | Search | Export | AI | Support access |
|---|---|---|---|---|
| Public | indexed | normal | allowed by policy | open |
| Internal | staff-scoped | approved | approved use only | role/purpose |
| Student-private | not globally indexed | owner/approved | tenant/purpose approved | student grant |
| Education record | not globally indexed | institution/approved | tenant/purpose approved | student/institution grant |
| Restricted | never broad search | named approval | prohibited by default | named time-bound grant |
| Credential | never | never | never | never displayed; rotate only |

## JIT/support access

Support access requires a case, student/authorized approval where applicable, exact scope, purpose, expiry, visible banner, audited reads, and post-expiry enforcement. Break-glass requires incident/change evidence, fresh MFA, short expiry, two distinct approvers, narrowed scope, and scheduled review. Break-glass widens who may act, not which data/action is permissible.

## Segregation of duties

Requester cannot approve their own high-risk action. Two-person actions include connector credentials/scope, production tenant suspension, high-risk AI provider/policy change, and break-glass. Emergency rollback may proceed under the release policy but remains audited and reviewed.

## Sensitive-action flow

1. Read-only view explains access basis.
2. Server prepares action and impact.
3. UI shows environment, tenant, target, dependencies, approvals, and rollback.
4. Fresh MFA and typed confirmation where appropriate.
5. Server reauthorizes and commits idempotently.
6. Destination acknowledgment and audit ID returned.
7. Unknown outcomes enter reconciliation; UI never displays success optimistically.

## Audit

Audit records actor, effective grants, tenant/scope, purpose, target, action, decision, approvals, before/after references, outcome, correlation, and time. Audit data is append-only under the existing retention model; reading/exporting sensitive audit data is itself audited.

## Failure behavior

- Missing/expired context: deny.
- Unknown tenant or ambiguous scope: deny.
- Stale role/policy/approval: re-evaluate and deny until refreshed.
- Telemetry unavailable: disable risky actions; keep safe read-only views with an unavailable state.
- Credential status unknown: show unknown; never reveal value.
- Destination timeout after commit request: show unknown outcome and reconcile before retry.

## Evidence still required

Repository checks do not prove production role assignment, MFA enforcement, access review, log immutability outside the database, alert delivery, staffed response, or independent assessment. Those remain activation gates with named security/privacy owners.

