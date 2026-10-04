# Actions are declared and denied by default; the institution's three are delegated

**Status:** Accepted for the platform package; **adoption by route is incremental**
(MIGRATION phase 4), as ADR 0007's own status says.

## Decision

`PolicyEngine` answers `evaluate(ctx, action, resource)`. An action in
`packages/institution`'s `POLICY_ACTIONS` is sent to `decide()` **unchanged**, and
the engine throws at construction if anyone tries to redeclare one. Every other
action must be declared as an `ActionRule` (capability, classification ceiling,
owner-may, consent, fresh-MFA, approval, purposes, obligations) or it is denied
(`action_not_declared`). The resource's tenant is compared with the context's
before any role is read. Opening order is owner → capability → consent. A denial a
consent could have cured says `consent_required`.

## Why

ADR 0007 made one decision point for *the question*; it knows three actions. The
rest of the product needs the same answer in the same vocabulary without growing a
second copy. Declaring actions makes the failure mode of a typo "denied", not
"allowed". Delegation, not reimplementation, is what stops two engines drifting;
the redeclaration guard makes that a constructor error instead of a review comment.

## What it was chosen over

- **A rules DSL in JSON:** rejected in ADR 0007 for the same reason — a rule in
  TypeScript is type-checked against the request it reads.
- **Extending `POLICY_ACTIONS` for every action:** each addition there is a decision
  that needs a rule, a test and an audit event type; right for sensitive actions,
  too heavy for "may a student complete their own task".
- **Allow-by-default with deny rules:** rejected; it is what makes a new action
  public until somebody remembers.

## How it is held

`packages/platform/src/policy/policy.test.ts` — undeclared denied, foreign tenant
refused first, capability by scope (node, beside, tenant-wide), owner, consent
(exact resource, withdrawn), ceiling, fresh MFA, purpose, obligations, delegation,
redeclaration and duplicate refused. Mutation: removing the tenant check turns it red.

## What this constrains

A new action ships with its `ActionRule` and a denying test. The engine reads
capabilities and consent through `PolicyInformation`; a production binding must be
compared with `private.has_capability()` side by side before any caller switches
(MIGRATION phase 2). A rule that needs more than the declared fields is a reason to
add a field here, not an `if` in a handler.
