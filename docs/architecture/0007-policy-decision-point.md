# 0007 · One policy decision point, asked in one vocabulary

**Status:** Accepted for the vocabulary and the evaluator; **adoption by route is
incremental** and tracked in
[`docs/ZERO-TRUST-EVENT-API-OBSERVABILITY-ROADMAP.md`](../ZERO-TRUST-EVENT-API-OBSERVABILITY-ROADMAP.md).

## Decision

Every sensitive action is authorized by asking one function one question in
one shape: `decide(AuthorizationRequest) → AuthorizationDecision`, in
`packages/institution/src/policy.ts`. The request names the actor, the
server-verified tenant, the action, the resource with its classification, and
the context the server resolved (memberships, scoped role grants,
capabilities, consent grants, purpose, ticket, correlation id). The decision is
`allow` with a list of obligations — audit, mask these fields, require fresh
MFA, expire at — or `deny` with a reason code for the audit row and a sentence
for the person.

The evaluator **fails closed**: an action it has no rule for, a tenant the
server did not verify, a request with no correlation id, or a person with no
active membership is denied before any rule runs. An expired role grant is
removed before any rule sees it.

## Why

Three authorization mechanisms already exist and each is right for its layer:
row-level security at the data ([0002](0002-rls-is-the-authorization-boundary.md)),
the adapter's own `status` and `review` at the institution boundary
(`server/institution/gateway.ts`), and per-function gates in the edge
functions (`supabase/functions/_shared/ltigate.ts`, `entitlement.ts`). What
they did not share was the *question*. The support-access grant
(`20260925103000_support_access.sql`), the AI policy
(`intelligence.ts`) and the LTI grade service each grew their own idea of what
a tenant is, whether an expired grant counts, and how "allowed but audited" is
expressed. The specification this repository was audited against
(NIST SP 800-207 §3; OWASP Authorization Cheat Sheet) names that drift as the
failure: "do not scatter permission checks across every feature."

Obligations are the part a plain allow/deny cannot carry. A support agent's
read is not *allowed*; it is allowed **with** masking and an audit row, and an
enforcement point that discards the obligations has not enforced the decision.
`applyObligations` does the two the enforcement point can do generically and
hands back the rest, so what is still owed is visible.

## How it is held

`policy.test.ts` is a refusal suite: every case takes a request the evaluator
allows and changes exactly one thing, so the control is inside each test and a
probe that refused everything would fail rather than pass. Revocation is
tested at the instant of expiry, not a day later.

## What it was chosen over

- **A rules engine with rules in JSON or a policy language.** Rejected for now:
  a rule in TypeScript is type-checked against the request it reads, and the
  three rules that exist read attributes a JSON rule could only name by
  string. Revisit when a tenant needs to author policy without a deploy.
- **Widening `private.has_capability()`** to carry obligations. Rejected: that
  function answers a yes/no question inside a policy, where an obligation has
  nowhere to go. The two compose — a rule here requires a capability that
  function grants.

## What this constrains

A new sensitive action is a line in `POLICY_ACTIONS`, a rule, a refusal test,
and an audit event type in `events.ts` (held equal by `events.test.ts`). A
route that adopts the evaluator writes the decision's `reasonCode` to its
audit row and applies every obligation before the response leaves. What would
reopen this: a second policy module appearing anywhere, which is the failure
the decision exists to prevent.
