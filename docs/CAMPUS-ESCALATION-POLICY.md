# Campus escalation policy

Code: `prepareEscalation` in `app/src/community/crisis.ts`, and the same rules
enforced in the database by `request_community_escalation` and
`decide_community_escalation` (`20260927235000_community.sql`, section 14).
Flag: `VITE_INSTITUTION_ESCALATION` (high-risk, off, production refused).
Server switch: the school's `community_programs` row for
`institution_escalation`, plus a `community_escalation_policies` row. Only the
service role writes either.

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

## In the database

- **Two people, told apart by hash.** A reviewer requests with a reason; a
  different reviewer approves or refuses with their own. The row stores
  SHA-256 hashes of both, never account ids, and the function compares them.
- **Asked again at approval.** If the switch, the agreement or the case
  changed after the request, approval is refused. Refusing is always allowed.
- **One live escalation per case,** by the function and by a unique index.
- **Built, not supplied.** `decide_community_escalation` assembles the
  payload itself from the case and the agreement. When the agreement requires
  identity it adds `subject_ref`, a hash of the escalation and the author that
  only the service role can resolve by recomputing it against the case.
- **One queued delivery.** Approval writes one row to
  `community_escalation_deliveries`. Reviewers see whether it went, not what
  it said. Only the service role takes and marks deliveries. A delivered copy
  is swept after 90 days; the escalation itself goes with its case.
- **In the case history.** Requests, approvals and refusals are case events.

`programs.test.ts` holds the SQL to the TypeScript: severities, the
500-character summary and the payload keys.

## In the console

`components/community/Escalation.tsx`, inside the moderation console. It
appears on P0 and P1 cases only where `VITE_INSTITUTION_ESCALATION` is set and
the case's school has switched escalation on. `escalationBlock` asks the same
questions as `private.escalation_allowed`, in the same order, and shows the
one reason a case can't be escalated instead of a button. Before anyone asks,
it lists what would be sent. The person who asked sees "You asked for this
one", not approval buttons. An approved escalation shows whether it has been
delivered, or that delivery failed five times.

