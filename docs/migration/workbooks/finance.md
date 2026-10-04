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
