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
