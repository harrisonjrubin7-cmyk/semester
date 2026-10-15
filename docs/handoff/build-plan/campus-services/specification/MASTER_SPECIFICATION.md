# Semester native housing, dining and tuition specification

Execution-ready logical contracts and acceptance criteria; runtime wiring and institution approval remain required.

# Native student housing portal specification
Status: proposed implementation contract. No repository changes, migration, deployment or institutional activation. Build native; legacy is an approved transitional adapter.

## Screens and consoles
Student: overview; residence comparison; eligibility/application; opt-in roommate profile; invitations/group confirmation; selection window; eligible inventory; reservation/contract preview; acceptance/deposit; assignment; move-in/condition report; maintenance; room-change/cancellation; move-out/appeal.
Staff: inventory; applications; allocation; groups; contracts; occupancy; maintenance; accommodation fulfillment; finance/reconciliation; migration/assurance. Extend existing Institution OS and controlled-action services; no independent identity system.

## Policy inputs and precedence
Pin institution/occupancy period, inventory version, rule version, eligible cohort, approved operational accommodations, group membership version, reservation duration, lottery scheme and fairness tie-break. Mandatory safety/inventory/eligibility constraints precede soft preferences. Restricted accommodation review is separate; housing receives approved requirement, not clinical detail. Institution approval required for priority groups, reserved capacity, lottery and exception rules.

## Algorithms
Self-selection: server authenticates and derives scope; validates window and every group member's current eligibility/reciprocal consent; transaction locks requested beds in stable order; checks expected inventory/group versions and temporal conflicts; creates expiring reservation plus audit/outbox; returns idempotent receipt. Confirm rechecks contract/financial prerequisites and active reservation. Do not hold a DB transaction open during payment-provider calls.
Lottery: freeze eligible cohort and policy; controlled draw after freeze using independently reviewed randomness/seed procedure, preserve seed commitment/reveal and algorithm version where appropriate; publish selection order/appeal path without private data. A known seed chosen before eligible list freezes can be manipulated; reviewed draw controls matter.
Batch assignment: construct only feasible student-bed edges; pin objective/weights/ties; min-cost matching for individual compatible cases; group and coupled constraints require accepted constraint solver. Preserve solver status, feasibility, accepted objective, unassigned reasons and reviewer. Do not assert global optimum unless proved.
Group selection: atomically allocate complete accepted group under policy or return no allocation; partial split is allowed only by explicit consent/version. Member change invalidates locked-group assumptions. Group leader cannot forge acceptance.
Waitlist: stable approved rank, eligibility recheck, one active offer where policy requires, explicit acceptance deadline, expiration and next-offer audit.

## Invariants
At most one conflicting occupancy per bed/student over overlapping half-open periods [start,end). Active reservation participates in the same exclusion logic; expired entries explicitly retired. Database uniqueness/exclusion/transaction checks—not UI alone—enforce invariants. Closed/unavailable bed denied. Contract acceptance pins exact terms/rate/period; amendment never overwrites history. Same idempotency key with different digest rejected. Payment uncertainty cannot silently free an assigned room. Confirmed assignment is not an expiring cart.

## Roommates
Opt in; mutually disclosed comparable fields; explain score factors and missing-data coverage; no protected-attribute inference. Weighted compatibility compares disclosed preferences only; hard constraints remain separate. Missing data unknown, not low compatibility. Invitations reciprocal; group size/eligibility validated; membership versioned; blocks/reporting enforced. Do not allow unrestricted staff profile browsing.

## State
Available -> reserved -> contract_pending -> financial_prerequisite_pending (if required) -> confirmed -> occupied -> checked_out. Rejected/expired/cancelled/unknown/appeal explicit. Unknown provider outcome enters reconciliation; compensation separately authorized.

## Maintenance
Record scoped location, requester, category/severity, minimal description/attachments, access permission, ownership, due/calendar, status/version, evidence and work-order references. submitted -> triaged -> assigned -> scheduled -> in_progress -> awaiting_parts/vendor -> completed -> verified -> closed. Duplicate-linked, reopened, cancelled and emergency_handoff separate. Official staffed emergency path never represented as ordinary pending ticket. Technician/vendor gets assigned task and access procedure only; completion evidence and reopen supported.

## Acceptance
Race final bed; overlapping period denial and adjacent-period allowance; group consent/version invalidation; reservation expiry; payment-after-expiry uncertainty; no double assignment; accommodation privacy; lottery reproducibility/integrity; blocked invitation; technician scope; verified close/reopen; legacy occupancy/contract/charge/file reconciliation; restore + revoked access.


# Native dining, meal-plan billing and rollover specification
Status: proposed contract; all institutional quantities/prices/deadlines/rollover policy unresolved until acceptance.

## Domain model
Meal plan is versioned bundle, not one monetary balance. Separate meal units, guest passes, dining currency, promo and basic-needs allocations. Each lot carries unit/currency, grant/remaining/reserved, scope, source contract, valid_from/expiry, eligibility/location/redemption policy, rollover cap/rules and adjustment history. No dollar conversion of meal units unless specifically accepted.

## Billing
Plan enrollment validates eligibility and accepted price/terms, posts one charge reference and grants entitlements through atomic native state/outbox. Housing-linked requirement references canonical housing assignment; does not copy it. Upgrade/downgrade charges use approved proration/consumed-benefit/refund rule version. Plan cancellation does not silently refund consumed meals or create cash entitlement from rollover.

## Rollover
Policy is per entitlement type/source and destination period: next-period enrollment/plan requirement, cap, expiry, restrictions, refundability, consumption order, cancellation and reserved-order treatment. Freeze close inputs; determine eligible available quantities; calculate transfer/expiration; post linked transfer entries; reconcile source decrease with destination increase; original lot preserved. Unique rollover business key (institution,source_lot,destination_period,policy_version) prevents replay. Uncertain reserved orders held for approved resolution; never roll same quantity while reserved and consumable. New policy versions cannot double-roll the original balance; detect prior transferred quantity semantically.

## Consumption
Filter currently eligible lots -> reserve atomically -> provider acceptance -> committed redemption/fulfillment per accepted operating policy. Earliest-expiry-first only an accepted configurable default. Unit balances use integer units; currency uses minor units/exponent. Lost card revokes credential, not legitimate entitlement. Offline signed-device redemptions limited to approved exposure; dedupe/reconcile later.

## Ordering
Draft -> eligibility/inventory_checked -> entitlement/payment_reserved -> submitted -> accepted -> preparing -> ready -> collected. Reject/cancel/expire/unknown/refund_pending/refunded explicit. Provider timeout queries authoritative order before retry; one order/key; release reservation once on confirmed rejection. Partial fulfillment has explicit compensation.

## Menu safety
Reviewed ingredient/allergen source/version/freshness, cross-contact warnings and authorized staff contact. Filters not allergy safety certification; unknown/stale information explicit. Pin operational menu version. No AI-generated safety assurance. Recipe change publication and incident escalation controlled.

## Consoles
Locations/hours; menus/ingredients; meal plans; entitlement ledger; fulfillment/capacity; campus card; exceptions/refunds; basic needs/donation; POS/provider reconciliation; assurance. Donor/recipient identities protected, company analysts receive approved aggregates only.

## Acceptance
Concurrency at remaining balance; rollover replay/cap/eligibility/cancellation; reserved near-expiry orders; upgrade after consumption; no duplicate redemption; provider success timeout; offline replay; lost card; allergen source change; refund pending/failed; donation privacy; complete entitlement restore.


# Native tuition, payment and credit-balance specification
Status: proposed implementation contract; qualified bursar/aid/accounting/legal approval needed. Statutory books/payment rails separate from native operational ledger.

## Rates and charges
Version rate schedule by institution/program/campus/term/payment period, residency where authorized, credit band/flat/per-credit basis, course/lab fees, housing/dining, deposits, waivers, sponsor terms and approved late/installment fees. Decimal/rational calculation with accepted rounding/exponent; no float monetary math. Pin inputs/rule/effective time/source/explanation. Reassessment posts delta, never overwrites historical charge.

## Account and allocation
Posted charges/credits distinct from anticipated aid, processing payments, disputed amounts, payable-now/installments and credit obligations. Payment allocations retain payer/source restrictions, charge refs, unallocated remainder and reallocation history. Negative total account balance alone does not establish Title IV credit balance.

## Plans and payer access
Accepted plan terms/version, eligible principal, schedule/fees/grace/auto-debit authorization, modification/default/aid-allocation and hold effects. Payer can pay narrowly authorized amount without grades/other student records. Expiring revocable statement/plan access independently granted and logged. AI explains accepted terms, cannot create eligibility, financial exception or aid decision.

## Payments
Adapter create/getAttempt, capture/confirm, cancel, create/getRefund, settlements and verified normalized event. Tokenized approved provider capture; no PAN/CVC in Semester stores/logs/prompts. Server amount/currency; provider-account scoped idempotency. Signature verification on raw bytes, durable event+semantic dedupe. created -> action_required -> processing -> confirmed/failed/cancelled/unknown; settlement and journal states separate.
Provider success + ledger failure retries posting only, not charge. Payment posted + hold update failure keeps funds posted and queues fresh authorized hold evaluation. Browser redirect does not establish payment. Uncertain external outcome reconciled before retry. Pending refund is outstanding obligation, not completed return.

## Credit obligations
Separate ordinary overpayment; tuition-policy refund; housing/dining credit; Title IV credit balance; withdrawal/R2T4; sponsor credit; dispute reversal. Classification pins approved calculation/recipient/timing, qualifying source funds/charges and applicable authorization. Current reviewed rules—not one generic refund formula.
For ordinary applicable Title IV credit-balance timing, absent valid hold authorization: no later than 14 calendar days after creation when created after classes begin; or 14 days after first day of class when created beforehand. Authorization cancellation triggers separate deadline from receipt of cancellation. Case-specific recipients, program/period constraints, holding authorizations and R2T4 restrictions require qualified review. Reference helper only computes simplified standard dates, not eligibility or full statutory decision.
Record obligation amount, qualifying calculation/version, creation/classes dates, recipient, authorization/revocation, deadline/basis, disbursement attempt/status, reconciliation and responsible officer. classify -> deadline -> review/approve -> dispatch -> reconcile delivery -> close. Rejected transfer stays open; no close on provider request acceptance alone.

## Consoles
Account command center; rate/assessment; charge/credit; payment/settlement; plans; credit/refund obligations; office-owned holds; sponsor billing; disputes/collections; aid reconciliation; period close/accounting; audit/regulatory evidence.

## Acceptance
Rate rounding/bands; reassessment; aid pending vs posted; source-constrained allocations; duplicate/out-of-order events; success timeout; concurrent refunds; payment-posting failure; hold denial; payer revocation; Title IV classification/deadline/recipient/hold/revocation; separate withdrawal policy; failed refund delivery; multi-book/tenant isolation; close/correction and restore.


# Integration, migration and failure-recovery runbook
No endpoints or legacy vendor contracts assumed. Discover actual documented APIs, SSO, rate limits, account boundaries, schemas and permitted read/write scopes. Use service identity/secrets vault and least privilege. Every mapping pins source IDs, canonical IDs, version, authority direction, watermark and reconciliation. Device/card/payment data remain separately governed.

Field-authority matrix: shadow reads accepted source; assist handles drafts/requests with legacy writes; controlled writes specific approved transactions; native-authoritative only after exact signed cutover. Never allow two authoritative writers for one field/domain. Offline/replicated record copies not extra authority.
Migration: counts and temporal IDs; occupancy/reservations/contracts; entitlement lots and consumption; charges/payments/allocations/obligations; open tickets/files; permissions/retention/holds. Dry run -> reconciliation -> parallel observation -> customer UAT -> freeze/checkpoint -> cutover -> enhanced monitoring -> accepted retirement. Explain every discrepancy. No fabricated 100% result.

Recovery: hold affected operation -> checkpoint queued/in-flight work -> reconcile external outcomes -> idempotent replay only of known-safe commands -> forward repair or isolated DB+object restore -> reconcile post-backup changes and revocations -> accepted smoke/negative tests -> fresh scoped resume. Do not delete receipts, wipe drafts, reissue unknown payments or switch to stale legacy authority. Database backup alone not file bytes.

Stop triggers: tenant leak/identity disclosure, unauthorized assignment/money/hold, corrupt reconciliation, expired authority, missing operator/alert, accepted threshold breach. Refund/cancellation remediation may require separately authorized route rather than blanket blocked repair. Quantitative SLA/RTO/RPO and offline exposure unresolved; blank values block activation.


## Delivery dependencies
1. Pin actual schemas/source adapters; name institution owners.
2. Accept rules/rates/rollover/selection/credit policy versions.
3. Implement shared scope/identity/audit/outbox/idempotency.
4. Build native domain transactions and portals/consoles.
5. Bind acceptance cases to real UI/API/DB/provider fixtures.
6. Run qualified review and candidate/actual-target verification.
7. Dual run and reconcile; approve cutover/rollback boundaries.
8. Activate exact scope with staff/alerts/recovery.

## Verification
Fifteen local pure-function tests passed. Thirty-two application acceptance cases are proposed and NOT RUN. Reference algorithms do not implement housing transactions, full rollover posting or legal aid eligibility.
