# Partner and developer program

**Status: specified, not implemented.** This document sets the conditions under which an external developer or partner may reach Semester data. Nothing here grants access. No program is open, and no partner application exists yet.

It sits on top of the integration rules in [`INTEGRATION-CONTROL-PLANE.md`](./INTEGRATION-CONTROL-PLANE.md) and the API conventions in [`API-PLATFORM.md`](./API-PLATFORM.md). The program opens only after the platform can constrain app scope, disclose data use, validate contracts, revoke access, and monitor failures.

## Entry requirements

An application is accepted only when all of these are in place:

- An approved partner or developer agreement.
- A named business owner and a named technical owner.
- A scoped application registration with an approved purpose.
- A published privacy and data-use statement.
- Approved redirect URIs.
- A least-privilege permission request.
- Passing sandbox contract tests.
- A support and incident contact.
- Acceptance of the versioned API contract.

## Prohibited

These are never allowed, whatever the agreement says:

- Bulk export of restricted student records.
- Use of data for a purpose not approved in the application.
- Credential sharing.
- Unbounded background access, meaning access with no owner, schedule, or expiry.
- Presenting partner output as institution-verified.
- Unreviewed AI access to restricted records.

## Production approval

Moving from sandbox to production requires all of these, each recorded with evidence:

1. Security review.
2. Privacy review.
3. Tenant authorization by the institution that owns the data.
4. A consent model, if the data class requires one.
5. API conformance tests passing.
6. A revocation test showing access stops when revoked.
7. Observability and rate limits in place.

## Application manifest

Every application is described by a manifest. A new application starts from this template. Fields left `pending` block production approval.

```yaml
# registry/partners/partner-app-template.yaml
application:
  id: pending
  name: pending
  owner_organization: pending
  environment: sandbox           # sandbox | production
  declared_purpose: pending

  requested_scopes:
    - student.profile.read
    - readiness.summary.read

  prohibited_scopes:             # may never be granted to a partner
    - student.record.export
    - student.grade.write
    - enrollment.write

  data_handling:
    retention_period: pending
    subprocessors: pending
    AI_use: prohibited_unless_separately_approved
    training_use: prohibited

  controls:
    token_expiry: required
    token_rotation: required
    revocation_webhook: required
    audit_events: required
    rate_limits: required
    incident_contact: required
```

Requested scopes must be the minimum the declared purpose needs. A scope listed under `prohibited_scopes` is refused at registration and cannot be added later without a new review.

## Marketplace boundary

Community and marketplace features are separate from institutional records. The rules are in [`COMMUNITY-PRIVACY-MODEL.md`](./COMMUNITY-PRIVACY-MODEL.md) and [`SUPPORT-AND-TRUST-SAFETY-OPERATING-MODEL.md`](./SUPPORT-AND-TRUST-SAFETY-OPERATING-MODEL.md). A marketplace application may not read grades, registration status, financial-aid data, advising notes, academic holds, readiness cases, or other nonpublic institutional records.

## Open items

- No partner agreement template exists in the repo yet.
- No scope catalogue is published. The scope names above are proposals and must be reconciled with the authorization model in `API-PLATFORM.md` §1.3 before any application uses them.
- No revocation webhook or sandbox contract-test suite for partners exists yet.
