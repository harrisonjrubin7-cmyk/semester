# Switching on student accounts or dining for a real school

**Status: blocked. Nothing here has been switched on, for any school.** Written 30 September 2026 after the owner asked to "switch on for a real school". The owner's own rules say financial-aid, payroll, ledger and system-of-record functions stay blocked until specialist controls and pre-pilot evidence exist, that no real institutional data is used before then, and that no live payment operation, production deploy or new production integration happens without explicit approval naming what is approved. A choice in a menu is not that approval, and no school, finance owner or provider has been named. This page lists what would have to be true first, from what the code already encodes.

## What the modules are (D-146, `module.student_accounts`, `module.dining`)

Student accounts keep a school's record of what each student owes and has paid: an immutable ledger written only when a second person approves a request, refunds and reversals with separation of duties, a high-value threshold, reconciliation with the payment provider, and a monthly close. Dining adds plans, a ledger, idempotent mobile orders and a shared-swipe pool. **No money moves through Semester and no card is stored**; payments are made through the school's hosted provider and recorded by reference. Both sit behind per-school flags that are off by default and are declared high-risk.

## Preconditions (none is met today)

| # | Before switching on for a school | Status |
| --- | --- | --- |
| 1 | The school's contract and DPA reviewed by counsel; counsel's answers to E1–E3 in `docs/COUNSEL-BRIEF.md` (money transmission, PCI scope, merchant of record and refunds) | not started |
| 2 | A named **finance owner** at the school, and at least three different people holding the separated roles the ledger requires: requester (`student_accounts_officer` or `financial_aid_officer`), approver (`business_admin`, `finance:approve_high` for high values) and closer (`finance:close`) | none named |
| 3 | A real payment provider account in the school's name, with its settlement file format confirmed, so a month can close against reconciliation | none connected |
| 4 | The school at a roll-out state that permits it, with its gate evidence filed (`tenant_rollout`), and **members-only rooms and offboarding rehearsed** (G2, G3) | no school rolled out |
| 5 | Specialist review: a finance/accounting controls review and, for aid, an aid-compliance review; an independent test of the ledger controls | none |
| 6 | Pre-pilot evidence: a real-account path from sign-up to export and delete (G1), a timed restore of the live backup (G5), a human accessibility pass (G6) | G1 partial, G5 unmet, G6 partial |
| 7 | A rehearsal on a **preview branch** with a synthetic school and synthetic money, results filed in `docs/evidence/` | not done (no working preview branch; see PR #1021) |
| 8 | An incident owner and a support route for a billing dispute | unassigned |
| 9 | The owner's written authorization naming: the school, the finance owner, the provider, the first term of use, and who can switch it off | not given |

## How it would be switched on, and off

1. A `feature_state` row for the school's module flag moves to `production` by the operator, recorded with its reason. Student and dining pilots can be narrowed by role and cohort at the database (`20260929370000_feature_policy_narrowing.sql`).
2. Off is the same row moving back. Nothing is deleted by switching off; the ledger stays as written.

I will not make that change from this environment, and it is not a code change. Until every line above is true and the owner has authorized it by name, the answer stays: off, and not claimed ready (`docs/RELEASE-GATES.md`, do-not-claim boundaries).

## What can be done now, safely

- The synthetic-school rehearsal (row 7), once a working preview branch exists.
- Guard tests that fail if either flag defaults on, or a page says either module is ready.
- Counsel's E1–E4.
