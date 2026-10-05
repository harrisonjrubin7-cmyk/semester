# Commercial core

The tables, rules and flows that let Semester sell, bill, contract, deliver and
renew. Schema: `supabase/migrations/20260929070000_commercial_core.sql`.
Proof: `supabase/commercial.check.sql` (29 checks), plus the updated allowlists
in `grants`, `capabilities` and `rls-coverage`. What runs it is below.

Individual Semester Plus billing was live-accepted on 2026-10-03
([record](evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md)); checkout stays held
by the governed acquisition control, the $59 annual charge, refunds, failed
renewals and disputes were not exercised, and nothing here charges an
institution. Each function still answers 503 until its secrets under "Off until
the owner sets these" are set. The
seed priced Plus at $3.99/month and $29.99/year; `20260929131000_plus_price.sql`
retired those rows and set Plus at $7.99/month and $59/year (D-134), the
figures the pricing page prints. `plans.test.ts` holds the two to each other.

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
tax needs an address → subscription stays active, `billing_issue = address_required`, no dunning
further failures     → same case, action 'retry'
grace (14 days)      → paid features keep working
final notice         → exact restriction date sent (worker writes 'final_notice')
restrict             → paid entitlements removed; data, export, deletion untouched
payment succeeds     → invoice paid, subscription active, case 'recovered',
                       paid entitlements restored if they had been removed
```

`apply_payment_event()` is idempotent on `(provider, provider_event_id)`: a
replayed webhook returns `duplicate` and changes nothing.

## What runs it

Schema: `supabase/migrations/20260929080000_commercial_automation.sql`.
Proof: `supabase/commercial-automation.check.sql` (79 checks) and
`app/src/lib/billing/` (51 tests). Every SQL function below is the service
role's alone; nothing is callable by a visitor or a signed-in account.

1. **Webhook** — `supabase/functions/billing-webhook`. Verifies Stripe's
   `Stripe-Signature` (`t=`/`v1=`, HMAC-SHA256 over `${t}.${rawBody}`, five
   minutes' tolerance, constant-time compare) on the raw body before parsing
   it, hashes the body, and applies the event: `checkout.session.completed` →
   `complete_checkout`; `customer.subscription.*` → `sync_provider_subscription`
   (an older event never overwrites a newer one); `invoice.paid` /
   `invoice.payment_failed` / `invoice.finalization_failed` →
   `upsert_provider_invoice_v2` (subtotal and tax separately) then
   `apply_payment_event`; a missing tax address is kept distinct from a card
   failure, leaves access active, and asks the student to update their address
   in Stripe without opening dunning. The issue is tied to that invoice, so an
   unrelated invoice cannot clear it. Failed finalization remains `draft` until
   a later provider event advances it. Refunds and disputes are applied by kind. `apply_payment_event`
   runs last and is the idempotency key, so a half-applied event is finished by
   the provider's retry. An invoice event that arrives before the checkout
   event that creates its subscription is answered 500 with nothing recorded,
   for the same reason: recorded, every retry would read as a duplicate. A
   payment recovers every open or restricted dunning case on the
   subscription; a failure reported for an invoice already paid is recorded
   and changes nothing. No CORS header on any response; a request with an
   `Origin` is refused. Nothing about an event is ever logged.
2. **Checkout** — `supabase/functions/billing-checkout`. A signed-in student
   posts `{ price_id, consent: true, consent_text_version }`; `begin_checkout`
   records the consent in `checkout_sessions` (refusing prices sold by quote
   and anyone already paying; begun again, it returns the same open row with
   the consent re-stamped, and a partial unique index allows one open checkout
   per billing account and price), then a Stripe Checkout Session is created with
   `price_data` from the catalog row and an idempotency key per checkout. The
   card goes into Stripe's page, never Semester's. The subscription is created
   by the webhook, carrying that consent. CORS fails closed on
   `ALLOWED_ORIGIN`: unset or `*` allows nobody.
3. **Dunning worker** — `public.run_dunning()`, hourly (`scheduler.sql` →
   `commercial-dunning`). A reminder after three quiet days; one
   `final_notice` naming the exact restriction date, three days before grace
   ends; at `grace_ends_at` the case is `restricted` and the subscription's paid
   `subscription_entitlements` removed. It writes only dunning rows and
   entitlements — never data, export or deletion. A later payment gives the
   entitlements back. The rows are the record of each reminder; Stripe's own
   customer emails are what reach the student.
4. **Contract to tenant** — a trigger on `contracts`. When an **order form**
   becomes `signed`, every tenant its billing account funds gets `tenant_plan`
   at the highest `tenant_tier` on the quote's lines (or on subscriptions tied
   to the contract), an `implementation_projects` row per tenant, and one
   `renewal_opportunities` row dated `ends_at - 120 days` (the day the renewal
   review opens). Idempotent: signing again writes nothing, and no
   `tenant_plan_history` row. A pilot order form cannot be signed without an
   end date. MSAs, DPAs and SLAs are terms and trigger nothing.
5. **Lead routing** — `supabase/functions/lead-intake` →
   `public.submit_site_lead`. The contract the site is built against is at
   the top of `supabase/functions/_shared/leadintake.ts`:
   `POST https://<project-ref>.supabase.co/functions/v1/lead-intake` with
   `{ route, name, email, organization?, role?, message?, fields?, page?, website? }`,
   answering `200 { ok: true, reference }`, `400 { ok: false, error }`, `429`,
   or `503`. Routes are `cta_routes` keys; this migration added
   `request_invite`, `accessibility_barrier`, `site_feedback` and
   `general_contact` (and widened the vocabularies with audience `anyone` and
   destination `invite_queue`). Every submission is kept in `site_leads`;
   institutional routes create or update `gtm_accounts` / `gtm_stakeholders`,
   and `procurement_queue` queues a `trust_room_requests` row. A filled
   honeypot gets a decoy reference and nothing is stored. Five submissions an
   hour per network, counted by an HMAC of the IP address — the address itself
   is never stored or logged, and nor is anything a visitor typed.
   `gtm_conversion_events` is deliberately **not** written: it is a school's
   own campaign funnel, keyed to a tenant and a `gtm_prospects` row, and a
   stranger on Semester's site belongs in neither. The `site_leads` row is the
   conversion record. That table has RLS on, no policy and no grant.
6. **Account health job** — `public.compute_account_health()`, nightly
   (`scheduler.sql` → `account-health`). One snapshot per institutional billing
   account per day from account-level signals only (implementation stage,
   overdue invoices, days to the end of a term under renewal, a QBR in the last
   120 days), each naming a reason and a next action. Anything not `healthy` is
   written `review_state = 'pending_review'`: a person marks it reviewed or
   dismissed before it drives any outreach.

## Secrets: what is off until they are set, and what is not

Nothing charges anyone until the Stripe secrets are set as Edge Function
secrets (Dashboard → Edge Functions → Secrets). Until then `billing-checkout`
and `billing-webhook` answer 503 with a plain sentence.

`lead-intake` is different: it is **on** as soon as it is deployed. The site's
own origins are built in (`SITE_PRODUCTION_ORIGINS`) and the IP salt defaults
to the service key, so a form sent from www.semester.website is stored with no
secret set at all. What stays off is the email: without `RESEND_API_KEY` and
`LEAD_NOTIFY_EMAIL`, leads accumulate in `site_leads` (and the institutional
and procurement tables) and nobody is told. Set those two, or read the tables,
or leads go unanswered.

| Secret | Function | What it does |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` (preferred), `STRIPE_API_KEY` (legacy deployed name) | billing-checkout, billing-cancel, billing-portal | Stripe secret key. The functions prefer the canonical name and fall back to the legacy name; if neither is set, checkout, cancel and billing history answer 503 |
| `STRIPE_WEBHOOK_SECRET` | billing-webhook | The webhook endpoint's signing secret. Unset: webhook answers 503 |
| `ALLOWED_ORIGIN` | billing-checkout, billing-cancel, billing-portal | The app's origin(s), comma-separated, read strictly (unset or `*` allows nobody) |
| `SITE_ORIGINS` | lead-intake | Origins to add, comma-separated. The site's own are built in (`SITE_PRODUCTION_ORIGINS`), so unset adds nothing and still serves the site |
| `RESEND_API_KEY` | lead-intake | Resend key; with `LEAD_NOTIFY_EMAIL`, every lead is emailed |
| `LEAD_NOTIFY_EMAIL` | lead-intake | The owner's inbox: set it to `harrisonjrubin7@gmail.com`. Configuration, never code |
| `LEAD_NOTIFY_FROM` | lead-intake | Optional: a verified Resend sender (default Resend's onboarding sender, which only delivers to the Resend account's own address) |
| `CHECKOUT_RETURN_URL` | billing-checkout, billing-portal | App route where Stripe returns the student. Activation supplies the production Account route; the portal refuses to fall back to an origin root |
| `STRIPE_PORTAL_CONFIGURATION_ID` | billing-portal | Active `bpc_…` configuration created or selected by the activation tool; sessions always name it explicitly |
| `STRIPE_PRODUCT_TAX_CODE` | billing-checkout | Owner/accountant-approved `txcd_…` classification for Semester Plus software; sent on every inline Stripe Product and required before checkout opens |
| `BILLING_LIVE_ENABLED` | billing-checkout | Explicit operations setting. `false` closes checkout; `true` is necessary but cannot override the current code-level paid-acquisition hold. The activation tool keeps it false while credentials, tax code, and provider inventory are changing |
| `LEAD_IP_SALT` | lead-intake | Optional: the key the IP address is hashed with (default: the service key) |

The Stripe webhook to register (Developers → Webhooks) is
`https://<project-ref>.supabase.co/functions/v1/billing-webhook` with
`checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.finalization_failed`,
`charge.refunded` and `charge.dispute.created`. The two jobs are in
`supabase/scheduler.sql`, applied by hand like the rest of that file.

Before the first live charge, what was open is closed:

- **Cancelling reaches Stripe** (D-132). The app's Cancel Plus calls
  `billing-cancel`, which sets `cancel_at_period_end` on the Stripe
  subscription first and records it with `request_cancellation()` second. If
  Stripe does not agree, nothing is recorded and the person is told they are
  still subscribed; if the record lags, the webhook's
  `customer.subscription.updated` brings it into line.
- **The app's upgrade and cancel screens** exist (D-128): the Membership panel
  on the Account screen.
- **The financial-retention period is seven years** after the end of the year
  a record was made (D-132), enforced by `purge_financial_records()` — below.
  The consent wording the app sends is versioned `plus-v2`; it names applicable
  sales tax shown before purchase as well as the recurring catalog price.

## Financial retention

Invoices, payment events and contracts are financial records with their own
retention: **seven years after the end of the calendar year they were made**
(D-132). `public.purge_financial_records()`
(`migrations/20260929130000_financial_retention.sql`,
`financial-retention.check.sql`) removes an *individual* subscriber's finished
records past that line, monthly (`commercial-financial-retention` in
`scheduler.sql`). A live subscription is never removed, and an institution's
contract records are governed by the contract, not this job. Nothing is
eligible before 1 January 2034. They are deliberately **not** in
`OWNED_TABLES`: deleting a student account removes their product data but not
the invoice that records what they paid. `billing_accounts.user_id` is
`on delete set null`, so the invoice survives without pointing at a person.

When the app first reads or writes one of these tables with `.from(...)`,
`app/src/lib/privacy.test.ts` will demand it in `OWNED_TABLES` or
`KEPT_TABLES`. The answer for billing tables is `KEPT_TABLES`, with the
financial-retention reason above.
