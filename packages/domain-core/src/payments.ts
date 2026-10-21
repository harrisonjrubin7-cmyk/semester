// Payment state model. Source: brief "Money and native finance".
// Informational balances, initiation, completion, and refunds are distinct states.
// Semester never alters an institutional account balance from this model.

export type PaymentState =
  | "created"
  | "awaiting_customer_action"
  | "authorized"
  | "settling"
  | "settled"
  | "failed"
  | "refunding"
  | "refunded"
  | "disputed"
  | "cancelled";

export function canIssueRefund(state: PaymentState): boolean {
  return state === "settled";
}
