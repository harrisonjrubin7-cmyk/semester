# Commercial core

The tables, rules and flows that let Semester sell, bill, contract, deliver and
renew. Schema: `supabase/migrations/20260929000000_commercial_core.sql`.
Proof: `supabase/commercial.check.sql` (29 checks), plus the updated allowlists
in `grants`, `capabilities` and `rls-coverage`.

Nothing here charges anyone yet. No payment provider is connected; the prices
seeded for Plus ($3.99/month, $29.99/year) are the financial model's planning
figures.

## Four ideas kept apart

| Idea | Table | Decides |
| --- | --- | --- |
| Plan | `commercial_plans`, `commercial_prices` | What is sold, at what price |
| Subscription | `subscriptions` | Who is paying for which plan, for which period |
| Entitlement | `plan_entitlements`, `subscription_entitlements` | Which paid features and service tiers apply |
| Authorization | RLS + `private.has_capability` (unchanged) | Who may read or change which record |

A subscription grants entitlements and never authorization. No policy on
student data reads a commercial table.

## Who reads what

| Person | Reads | Never reads |
| --- | --- | --- |
| Anyone, signed out | Active catalog (products, plans, current prices, entitlements) | Anything else |
| Student | Own billing account, subscriptions, invoices, cancellations; `my_entitlements()` | Anyone else's |
| Institution `billing_contact` | Its account's contracts, invoices, subscriptions, renewals | Implementation, configuration, student data |
| Institution `university_admin` / auditor | Its implementation projects, milestones, success plan, QBRs | Invoices and contracts (unless also a billing contact) |
| `finance_operator` | Every billing record | Account health |
| `customer_success`, `account_executive` | Delivery records, account health | — |
| `compliance_owner` | Controls, evidence, claims register | — |
| `content_owner` | Content register, CTA routes | — |
| Anyone through the API | — | `payment_events` |

Every write is the service role's, except `request_cancellation`.

## Individual subscription flow

```
signup → Free (no subscription row needed)
      → plan selected → checkout shows recurring price, interval, renewal and cancel route
      → explicit consent recorded (consent_at + consent_text_version, enforced by a check)
      → provider confirms → webhook → subscription 'active' + subscription_entitlements
      → renewal succeeds, or fails → dunning
      → cancel: request_cancellation() → cancel_at_period_end, ends at period end
      → export and deletion stay available on every plan and in every state
```

## Dunning

```
payment fails        → subscription past_due, one open dunning_case, action 'notice'
further failures     → same case, action 'retry'
grace (14 days)      → paid features keep working
final notice         → exact restriction date sent (worker writes 'final_notice')
restrict             → paid entitlements removed; data, export, deletion untouched
payment succeeds     → invoice paid, subscription active, case 'recovered'
```

`apply_payment_event()` is idempotent on `(provider, provider_event_id)`: a
replayed webhook returns `duplicate` and changes nothing.

## What still has to be built

1. **Webhook Edge Function** `supabase/functions/billing-webhook`: verify the
   provider's signature on the raw body, hash it, call
   `apply_payment_event()` with the service role. It must fail closed on CORS
   (see audit finding 7) and never log the payload.
2. **Checkout** through the provider's hosted page (no card data touches
   Semester), writing the consent fields before the first charge.
3. **Dunning worker** on `pg_cron`: send reminders, write `final_notice`,
   and at `grace_ends_at` set the case to `restricted` and clear paid
   `subscription_entitlements`.
4. **Contract to tenant**: when an order form is `signed`, write
   `tenant_plan` (as the service already does), create the
   `implementation_projects` row and a `renewal_opportunities` row at
   `ends_at - 120 days`.
5. **Lead routing**: the site's forms post to one Edge Function that reads
   `cta_routes` for destination and SLA, creates or updates `gtm_accounts` /
   `gtm_stakeholders` for institutional routes, queues
   `trust_room_requests` for `procurement_queue`, and records the conversion
   in `gtm_conversion_events`.
6. **Account health job**: nightly, compute `account_health_snapshots` from the
   allowed account-level signals only; every snapshot names a reason and a
   next action, and a person reviews it before it drives any outreach.

## Financial retention

Invoices, payment events and contracts are financial records with their own
retention (typically seven years). They are deliberately **not** in
`OWNED_TABLES`: deleting a student account removes their product data but not
the invoice that records what they paid. `billing_accounts.user_id` is
`on delete set null`, so the invoice survives without pointing at a person.

When the app first reads or writes one of these tables with `.from(...)`,
`app/src/lib/privacy.test.ts` will demand it in `OWNED_TABLES` or
`KEPT_TABLES`. The answer for billing tables is `KEPT_TABLES`, with the
financial-retention reason above.
