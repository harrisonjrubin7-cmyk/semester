# Support handoff: registration readiness pilot

Status: draft. Named owners are pending (see `pilot-scope.md`).

## Queues

| Queue | Receives | First response owner |
| --- | --- | --- |
| Readiness questions (student) | "Why is my status not ready?" | support_owner |
| Discrepancy reports | Student or staff says a source value is wrong | integration_lead |
| Source freshness | Stale or failed source alerts | integration_lead |
| Access concerns | Anything that looks like seeing another person's record | security_owner, immediately |

## Support can

- Explain the readiness state and the source label shown.
- Explain freshness and tell the student when the source last updated.
- Log a discrepancy with the record reference, never with the content of restricted fields.

## Support cannot

- Confirm enrollment or registration.
- Change a SIS value, hold or time ticket.
- Approve an override, or grant access.

## Escalation

1. Source stale or failed: integration_lead. Expected acknowledgement within one business day.
2. Access concern: security_owner. Treat as immediate. Follow `incident-runbooks/access-exposure.md`.
3. Staff misreading readiness as enrollment: registrar_product_owner. Follow `incident-runbooks/staff-misreads-readiness.md`.
