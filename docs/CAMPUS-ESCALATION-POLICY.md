# Campus escalation policy

Code: `prepareEscalation` in `app/src/community/crisis.ts`. Flag:
`VITE_INSTITUTION_ESCALATION` (high-risk, off, production refused).

`prepareEscalation` refuses every escalation unless all of these hold:

- the flag is on;
- the tenant has a policy with `enabled`, an `agreementRef` for a written
  agreement, and a delivery `channel`;
- the case is P0 or P1, in a category the agreement covers;
- two **different** professionals have approved it, each with a written
  reason, and no automation or volunteer approval is attached;
- the case has not been escalated before.

## Payload (minimum necessary)

The payload is an allowlist:

- `caseId`
- `tenantId`
- `category`
- `severity`
- a summary of at most 500 characters
- `occurredAt`
- `agreementRef`

It adds `vaultRef` only when the agreement requires identity, and even then it
is a reference, never a name or an email.

There is no dashboard, no standing feed and no bulk export to institutions.
