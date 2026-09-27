# Entitlement resolution

Status: **BUILT; RUNS IN SHADOW ON LTI LAUNCHES; ENFORCES NOTHING.** Four
steps are sourced on a launch: kill-switch, tenant-plan, module and lifecycle. The order
is `supabase/functions/_shared/entitlement.ts`: one copy, kept where a Deno
edge function can deploy it. Its tests are `app/src/lib/entitlement.test.ts`,
beside the other `_shared` rules' tests. It is not re-exported from
`packages/institution`: the gateway's NodeNext compile (`check:university`)
reads anything under `supabase/functions/` as CommonJS, and nothing in the
gateway uses it.

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

## Where a plan comes from

`public.tenant_plan` holds one current plan per school
(`20260928004730_tenant_plan.sql`):

- **Tier** uses the deal desk's names (`pilot`, `department`, `campus`,
  `system`). **Status** uses the order's (`trial`, `active`, `suspended`,
  `ended`), so a row reads straight into the step.
- **Only the service role writes it.** A plan is what the school signed. There
  is no write policy, so a school administrator cannot grant or extend their
  own school's plan. Tenant administrators and auditors can read their own.
- **A pilot must have an end date**, and no plan may end before it starts.
- **Every insert and update is copied to `tenant_plan_history`**, which cannot
  be edited or deleted.

`supabase/tenant-plan.check.sql` proves each of those. With an administrator
write policy added, its "cannot extend their own plan" check fails.

## To wire it

Tables for personal and sponsored grants and usage counters (tenant plans now
exist, in `tenant_plan`; modules are `tenant_feature_policy`) (`usage_atomic` is the precedent). A server-side caller that builds the
request from those rows, the current membership and `has_capability`. And an
audit row for each refusal.

## On an LTI launch, in shadow

Every LTI launch evaluates the order and logs what it would decide. It refuses
nothing new (`_shared/ltientitlement.ts`):

```text
lti entitlement (shadow): would refuse at module; unsourced=environment,sso-policy,…
```

Shadow, because the LTI module flag `integration.lms_lti` defaults to `off`.
Enforcing the `module` step would refuse launches at every school that has not
switched it on. The log is how anyone sees what enforcement would do before
turning it on.

| Step | Source on a launch |
| --- | --- |
| kill-switch | `kill.integration_sync`, platform-wide or the school's (`lti_launch_entitlement_facts`) |
| tenant-plan | `tenant_plan`: refuses when `suspended` or `ended`, or when `ends_at` has passed; `trial` and `active` pass. **A school with no plan row** passes and is named in `unsourced=` for that launch, because no plan recorded is not a plan ended |
| module | `feature_state('integration.lms_lti', school)`: anything but `off` is on |
| lifecycle | the membership join: `joined` is active, `membership-<status>` is that status, anything else is no membership |
| every other step | **unsourced**: given a passing value and named in the log's `unsourced=` list |

The `unsourced=` list is the point of the log line. A pass through a step
with no source means "not checked", and a shadow log that hid that would
teach whoever reads it to trust a gate that isn't there.

Not evaluated, with the reason logged: a launch with no school (`unbound`,
`no-registration`) or with school facts that could not be read.

**To enforce:** give the unsourced steps sources, make sure each school's
`integration.lms_lti` flag is set, and record a `tenant_plan` row for every
school. Enforcement must then **refuse a school with no plan row**, which shadow
deliberately does not. Then refuse on the verdict. The session and
placement gates (`sessionDecision`, `placementDecision`) already enforce the
membership independently and stay as they are.
