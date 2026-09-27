# Entitlement resolution

Status: **CONTRACT BUILT, NOT WIRED.** `packages/institution/src/entitlement.ts`
and its test. Nothing yet stores tenant plans, modules or allowances for it to
read, and no route calls it.

## The order

```text
kill-switch → environment → tenant-plan → module → sso-policy → lifecycle →
capability → course-scope → course-policy → data-classification →
individual-plan → usage-allowance → allow
```

The first step that refuses wins, and the verdict names it. The order is not
arbitrary:

1. **Operator switches first** (kill switch, environment), so an incident
   response never depends on reading a plan.
2. **What the institution bought** (tenant plan, module) before anything about
   the person, so a lapsed contract refuses everyone the same way.
3. **SSO policy, then lifecycle, then capability**: who the person currently is
   to the institution. A deprovisioned membership is refused as `lifecycle`
   before its missing capability is even read.
4. **Course scope, then course policy, then data class**: what this context
   permits. Course policy only ever narrows. `prohibited` refuses and nothing
   widens it.
5. **Personal plan and usage last**, because they are the only steps a student
   can fix themselves.

## Details that are easy to get wrong

- **`module` and `individual-plan` are two steps.** `module` asks whether any
  plan lists the module, tenant or personal. `individual-plan` asks whether a
  personal or sponsored grant being relied on is still current. An expired
  personal grant is refused as expired, not as "never bought". The test proves
  `individual-plan` can fire. An earlier draft made it unreachable.
- **A personal grant never stands in for lifecycle or capability.** It can
  supply a module and nothing else.
- **Capabilities are an input resolved from the database.** They are never
  derived from an IdP, SCIM or LTI claim.
- **A malformed data tier is treated as T3**, the AI Toolkit's "unclassified",
  never as T0.
- **This is an extra gate.** RLS and the AI Toolkit's `entitle()` still apply.
  A pass here only means no plan, lifecycle or policy reason refuses.

## To wire it

Tables for tenant plans and modules, personal and sponsored grants, and usage
counters (`usage_atomic` is the precedent). A server-side caller that builds the
request from those rows, the current membership and `has_capability`. And an
audit row for each refusal.
