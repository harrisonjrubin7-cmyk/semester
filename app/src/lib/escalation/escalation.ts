// Escalation state machine for access requests (staff workspace blueprint §8).
// This validates transition shape only. The server must separately check actor
// authority, reviewer independence, scope, expiry, and evidence.

export type EscalationState =
  | "draft"
  | "submitted"
  | "manager_review"
  | "owner_review"
  | "needs_information"
  | "approved"
  | "active"
  | "denied"
  | "withdrawn"
  | "expired"
  | "revoked";

export type EscalationEvent =
  | "SUBMIT"
  | "ROUTE"
  | "MANAGER_APPROVE"
  | "OWNER_APPROVE"
  | "REQUEST_INFORMATION"
  | "DENY"
  | "WITHDRAW"
  | "ACTIVATE"
  | "EXPIRE"
  | "REVOKE";

const transitions: Partial<
  Record<EscalationState, Partial<Record<EscalationEvent, EscalationState>>>
> = {
  draft: { SUBMIT: "submitted", WITHDRAW: "withdrawn" },
  submitted: { ROUTE: "manager_review", WITHDRAW: "withdrawn" },
  manager_review: {
    MANAGER_APPROVE: "owner_review",
    REQUEST_INFORMATION: "needs_information",
    DENY: "denied",
    WITHDRAW: "withdrawn",
  },
  owner_review: {
    OWNER_APPROVE: "approved",
    REQUEST_INFORMATION: "needs_information",
    DENY: "denied",
    WITHDRAW: "withdrawn",
  },
  needs_information: { SUBMIT: "submitted", WITHDRAW: "withdrawn" },
  approved: { ACTIVATE: "active", WITHDRAW: "withdrawn" },
  active: { EXPIRE: "expired", REVOKE: "revoked" },
};

export function nextState(current: EscalationState, event: EscalationEvent): EscalationState {
  const next = transitions[current]?.[event];
  if (!next) {
    throw new Error(`Invalid transition: ${current} / ${event}`);
  }
  return next;
}
