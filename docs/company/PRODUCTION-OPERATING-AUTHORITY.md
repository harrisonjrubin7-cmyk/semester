# Production operating authority

| Control | Value |
| --- | --- |
| Status | **APPROVED — FOUNDER OPERATING AUTHORITY; EXTERNAL EVIDENCE GATES REMAIN** |
| Decision date | 12 October 2026 |
| Decision owner | Harrison Rubin, Founder |
| Review trigger | Any owner change, material policy change, production incident, or paid-acquisition activation |

## Accountable owner assignments

Harrison Rubin accepts accountability as the current primary owner for:

- production monitoring and alert response;
- customer support operations and escalation;
- incident command, incident communications, and recovery coordination; and
- the compliance evidence program and its review calendar.

These assignments fill the company-side primary-owner role. They do not create a
backup operator, independent reviewer, institutional contact, qualified security
assessor, licensed counsel, or qualified tax/accounting adviser. Documents that
require one of those roles remain blocked until that person accepts the role and
the required evidence is filed.

## Founder policy approvals

Harrison Rubin approves the existing Semester policy direction for tax,
customer-facing legal terms, refunds and cancellation, privacy, and individual
paid acquisition, subject to the controls below.

This is founder authorization to complete controlled implementation and provider
configuration. It is not a finding that every release gate is met, not legal or
tax advice, and not authorization to invent unresolved facts. In particular:

- open `[DECIDE]` fields still require an exact value before the affected text can
  be published or treated as in force;
- tax activation still requires an accountant-approved Stripe product tax code
  and the applicable registrations/nexus determination;
- live payments still require the Stripe live key, webhook signing secret,
  verified merchant account, tax configuration, cancellation/refund acceptance,
  and a reviewed change that lifts both paid-acquisition holds;
- privacy and legal gates that explicitly require qualified or independent review
  remain open until that review is recorded; and
- institutional activation still requires a named institution, approved data
  scope, customer contacts, and tenant-specific acceptance.

## Production-change authorization

The founder approves preparing the production plan and the change record that
describes it. Approval to execute applies only after the saved plan exists and is
reviewed against the record's exact scope, rollback, protected-resource policy,
and credential requirements. No existing draft change record is converted into a
general authorization for unrelated production drift.

## Secret handling decision

Production credentials must be created by their provider and stored only in the
provider or CI secret store. They must not be pasted into chat, committed, placed
in a `VITE_` variable, printed by a workflow, or copied into an evidence file.

Required billing inputs are `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRODUCT_TAX_CODE`, `SUPABASE_ACCESS_TOKEN`, and the explicit allowed
origins. `BILLING_LIVE_ENABLED` remains false until the activation preflight and
post-activation probes pass. A failed activation must leave or return checkout to
the disabled state.

## Evidence on the decision date

- The production Supabase project `lzrqvlugnawcgywkhqlz` was reachable and
  reported `ACTIVE_HEALTHY` on PostgreSQL 17.
- The deployed billing, support, integration, trust, and account Edge Functions
  were visible through the authenticated Supabase control plane.
- No Stripe credential, webhook secret, tax code, or Supabase access token was
  available to the execution environment, so no provider secret was changed and
  no live billing activation was attempted.
- The repository release controller still failed closed on
  `registration.readiness`, and the institutional production probe remained
  unconfigured. This decision does not override either condition.

## Related controls

- [`OBSERVABILITY-PLAN.md`](../engineering-operations/OBSERVABILITY-PLAN.md)
- [`PRODUCTION-SUPPORT-RUNBOOK.md`](../engineering-operations/PRODUCTION-SUPPORT-RUNBOOK.md)
- [`INCIDENT_RESPONSE_PLAN.md`](../business/compliance/INCIDENT_RESPONSE_PLAN.md)
- [`COMPLIANCE_EVIDENCE_REGISTER.md`](../business/compliance/COMPLIANCE_EVIDENCE_REGISTER.md)
- [`FINANCE_RELEASE_GATES.md`](../finance/FINANCE_RELEASE_GATES.md)
- [`ops/billing/README.md`](../../ops/billing/README.md)

