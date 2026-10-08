<!-- Rendered from app/src/lib/migration/workbooks.ts by workbooks.test.ts. Edit the data, then run `MIGRATION_DOCS=write npx vitest run src/lib/migration/workbooks.test.ts` from app/. -->

# Workbook: Finance (student accounts)

**Done means:** Every student account balance, to the cent, is what the bursar already carries, every charge and payment still has its date and source, and nobody is charged or refunded twice.

**Institution approver:** `finance` (see [sign-off](../06-ACCEPTANCE-SIGNOFF-AND-EVIDENCE.md)).

## What to bring

| Entity | Natural key in the source | History | Sensitivity |
| --- | --- | --- | --- |
| account | person + account type | summary | restricted |
| charge and credit (tuition, fees, adjustments) | transaction id | full | restricted |
| payment and refund | transaction id + processor reference | full | restricted |
| financial-aid award and disbursement | person + award year + fund + disbursement id | full | restricted |
| payment plan | person + plan + schedule | full | restricted |
| hold arising from balance | person + hold type + effective dates | full | restricted |

Fill in per institution during inventory ([02](../02-SOURCE-INVENTORY-AND-EXTRACTION.md)): the source system and table for each entity, the extract method, the owner, and the cutoff date for history.

## Checks

A domain passes only when every evidence class has a check that examined something. Counts are listed first and are never enough.

| Check | Proves | Severity | Primitive | Compares |
| --- | --- | --- | --- | --- |
| `finance.count.transactions` | count | low | `countParity` | Transactions by type and period |
| `finance.key.transactions` | key | critical | `keyParity` | Each ledger transaction once; a re-run never doubles a charge |
| `finance.semantic.amounts` | semantic | critical | `valueParity` | Amount in integer minor units, sign (charge vs credit), currency, detail code, posting vs effective date |
| `finance.relationship.transaction_to_account` | relationship | critical | `referentialIntegrity` | Every transaction lands on the right account and term; refunds point at the payment they reverse |
| `finance.history.ledger_order` | history | critical | `historyPreserved` | Ledger order and original posting dates and actors preserved; adjustments are not collapsed into balances |
| `finance.history.plan_schedule` | history | high | `temporalContinuity` | Payment plan installments and aid disbursements keep their date structure |
| `finance.permission.account_access` | permission | critical | `permissionParity` | Who may see an account: the student, authorised payers, bursar staff; no guardian access that was not granted |
| `finance.outcome.balance_by_account` | outcome | critical | `aggregateParity` | Balance per account recomputed from the migrated ledger equals the bursar's, exactly (tolerance zero) |
| `finance.outcome.control_totals` | outcome | critical | `aggregateParity` | Control totals per fund and period tie to the general ledger; aid disbursed equals aid awarded less cancellations |

## What the engine runs

`institution-migration validate` executes these against the source, target and crosswalk files. Each is **proven on the real data** by injecting a defect of its own kind and requiring the check to notice; a check that examined nothing holds the domain. Stakes: **high** (no major defect tolerated; minor at 0.5%).

| Check | Kind | If it fails | What it asks |
| --- | --- | --- | --- |
| `finance.account.crosswalk` | crosswalk | critical | Every account maps to exactly one target account; no two collapse into one; nothing appears from nowhere. |
| `finance.account.preserved` | preserved | critical | account: currency, status mean the same thing after the move. |
| `finance.account.balance` | derived | critical | finance.account.balance: the sum of ledger_entry.amount_cents per account, recomputed from rows on both sides, agrees within 0 and with the stated stated_balance_cents. |
| `finance.ledger.crosswalk` | crosswalk | critical | Every ledger_entry maps to exactly one target ledger_entry; no two collapse into one; nothing appears from nowhere. |
| `finance.ledger.amount` | preserved | critical | ledger_entry: amount_cents mean the same thing after the move (compared as number). |
| `finance.ledger.preserved` | preserved | critical | ledger_entry: charge_code, posted_on mean the same thing after the move. |
| `finance.ledger.account` | reference | critical | Every ledger_entry.account_id points at a real account, and none that were fine in the source are orphaned. |
| `finance.ledger.reversal` | reference | critical | Every ledger_entry.reversal_of points at a real ledger_entry, and none that were fine in the source are orphaned. |
| `finance.ledger.history` | history | critical | ledger_entry: every event of each account, in order, with the same values. |
| `finance.access.crosswalk` | crosswalk | critical | Every account_access maps to exactly one target account_access; no two collapse into one; nothing appears from nowhere. |
| `finance.access.grant` | permission | critical | account_access: nobody gains access they did not have; lost access is reported. |
| `finance.plan.crosswalk` | crosswalk | high | Every payment_plan maps to exactly one target payment_plan; no two collapse into one; nothing appears from nowhere. |
| `finance.plan.preserved` | preserved | high | payment_plan: status, installment_count mean the same thing after the move. |
| `finance.plan.due` | preserved | high | payment_plan: next_due_on mean the same thing after the move (compared as date). |

**Evidence classes the engine covers on its own:** `count`, `key`, `semantic`, `relationship`, `history`, `permission`, `outcome`.
**Nothing is left to supply from outside:** the gate can pass this domain on executable evidence alone.

## What stays behind

| What | Class | What happens instead |
| --- | --- | --- |
| financial aid awards | T3 | Not migrated. Aid is never ingested; Semester shows an action item and a link to the financial aid office. |
| payment card data | T6 | Never copied. Cards stay tokenised at the processor; nothing about them is in a migration file. |
| bank account numbers | T6 | Never copied. Bank details stay with the bank and the processor; nothing about them is in a migration file. |
| collections and legal notes | T4 | Not migrated; remain with student accounts and counsel. |

## Scope approvals

Fields the platform never ingests by default need a named approval from the records owner and the privacy lead before the mapping can be approved; fields in a class the platform floor refuses cannot be approved at all.

| Field | Class | Why | Needs |
| --- | --- | --- | --- |
| `account.stated_balance_cents` | T3 | never display | `scope.migration.finance.account` |
| `ledger_entry.amount_cents` | T3 | never display | `scope.migration.finance.ledger_entry` |

Approvals to have on file: `scope.migration.finance.account`, `scope.migration.finance.ledger_entry`.

## What a count will not show

- Floating-point sums report pennies of drift that is arithmetic, and hide real ones.
- Pending authorisations migrate as settled payments.
- Refund-to-original-method rules require the processor reference, which sits outside the SIS.
- Tax and reporting forms depend on posting date, not effective date; the two are swapped.
- Payment card data is not migrated; tokens and processor accounts are handled by the processor and by counsel on PCI scope, not by this team.

## Business outcomes to recompute, not copy

- Balance per account
- Total by fund and period
- Aid disbursed vs awarded
- Balance-based holds

## Calendar events the parallel run must include

- `billing_run`
- `payment_posting_cycle`
- `aid_disbursement`
- `refund_run`
- `term_close`
