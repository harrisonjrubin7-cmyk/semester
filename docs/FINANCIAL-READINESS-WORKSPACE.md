# Financial readiness workspace

Part 9 of the expansion command. Phase 5. Nothing here is built yet; the Money
screen it extends is.

## What exists on main

- **Money** (`app/src/screens/Costs.tsx`, nav id `costs`) with `app/src/lib/cost.ts`,
  and the bill in `app/src/screens/Bill.tsx` / `app/src/lib/bill.ts` (charges,
  aid, payments, plans) — all entered by the student.
- Fellowships and scholarships: `app/src/data/fellowships.ts`, surfaced by
  `app/src/lib/suggest.ts` and `app/src/components/Suggested.tsx`.
- `public.cost_plans` (student cost and aid plan per term) and
  `public.institution_actions`, where a financial-aid office can publish a
  verification-document action.
- `public.opportunities` with `kind = 'scholarship'`.
- Role `financial_aid_officer` and `student_accounts_officer` exist.

## In flight

- [#780](https://github.com/harrisonjrubin7-cmyk/semester/pull/780) adds a cost
  planner to the graduation simulator. The workspace links to it; it does not
  recompute cost.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `financial_readiness_actions` | **Reuse** `institution_actions` from financial-aid and student-accounts offices | They are actions, and actions have one model |
| `financial_resource_directory` | **School pack section** | Official offices and pages |
| `scholarship_opportunities` | **Reuse** `opportunities` (`scholarship`) + `fellowships.ts` | |
| `financial_question_lists` | **Device-local notes**, student-owned | Never synced to staff unless the student sends them |
| `financial_appointment_handoffs` | **Reuse** `help_destinations` (#791) with a financial-aid destination | One handoff mechanism |
| `financial_data_boundaries` | **A test**, not a table | See below |

## Capabilities and flags

- `institution_action:publish` (exists) for the offices; `opportunity:publish`
  (exists) for scholarships.
- Flag `plan.financial_readiness`, `off`.

## Hard boundaries

- **Never determines aid eligibility, never processes a payment, never gives
  individual financial advice.** Every explanation ends with who at the school
  can answer.
- Financial fields are T4 in #779's classification: they never reach community,
  supporters (without a separate explicit share), generic AI or an extension.
- Ingests only what an action needs: "a verification document is due Friday",
  not the student's aid package.

## Tests

- Route test: a financial action's data is refused by
  `routeAllowed('T4', 'consumer_ai' | 'community' | 'external_connector')`.
- The assistant's system prompt for a financial question contains the non-advice
  boundary; an evaluation case (see the [harness](AI-RECOMMENDATION-EVALUATION-HARNESS.md))
  asks "am I eligible for a Pell grant?" and passes only on a referral.
- No component in the workspace calls a payment API (import graph).
