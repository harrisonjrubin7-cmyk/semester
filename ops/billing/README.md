# Live billing activation

Checkout, invoicing, renewal events, entitlement updates, dunning and cancellation
already have deployed endpoints. Production checked on 2026-10-01 answered
`Checkout is not available yet.`: the merchant credentials remain unconfigured.

The owner confirmed legal and independent reviews complete on 2026-10-01.
That confirmation does not supply payment credentials or verify a payment.

Load `STRIPE_SECRET_KEY` (live mode), `STRIPE_PRODUCT_TAX_CODE` (the
owner/accountant-approved `txcd_…` software classification),
`SUPABASE_ACCESS_TOKEN`, and `ALLOWED_ORIGIN`
from a secure local environment or a CI secret store. Do not paste keys into chat,
commit them, or put them in any `VITE_` variable. `ALLOWED_ORIGIN` is the full
comma-separated list of existing allowed app origins; preserve other origins when
setting it. The production app origin is `https://harrisonjrubin7-cmyk.github.io`.
Optional: `SUPABASE_PROJECT_REF`, `CHECKOUT_RETURN_URL` (the activation tool
defaults it to the production Account route), and the existing live
`STRIPE_WEBHOOK_SECRET` if this project already has a Stripe webhook endpoint.

Run from the repository root:

```bash
node ops/billing/activate-live.mjs
node ops/billing/activate-live.mjs --apply
```

The first command checks the merchant account, default tax behavior, every page
of active tax registrations, portal configuration, and webhook without changing them.
The second first closes checkout with the `BILLING_LIVE_ENABLED` operations
gate, creates or updates exactly this project's live webhook, enables the
default Stripe billing portal's invoice history and payment-method controls,
explicitly disables portal-side subscription changes and cancellation,
stores the credentials and the exact portal configuration id in Supabase,
rescans legacy sessions while checkout is quiesced, and only then marks the
operations setting ready after checking the deployed signature, invoice-event database path,
authentication and CORS boundaries. The current code-level market hold still
keeps new checkout closed; lifting it requires a separately reviewed code change
after the individual-sale decision gates are satisfied. The invoice probe uses a nonexistent
subscription and therefore writes no invoice or payment record. It refuses to activate until Stripe Tax
reports an active setup, and reports the number of active tax registrations so
the owner and counsel can reconcile it with the approved nexus decision. It
does not create a checkout, register the business for tax, charge a card or
manufacture a successful payment. Other secrets, portal features and webhook
endpoints are preserved.
If secret configuration fails after webhook creation, retrieve the new endpoint's
signing secret in the Stripe dashboard and rerun with `STRIPE_WEBHOOK_SECRET`.

Before changing billing to Available, record an owner-approved live checkout,
paid receipt/invoice, correct Plus entitlements, webhook replay, cancellation
confirmed in Stripe, and continued export/deletion access after cancellation.
The existing catalog prices are $7.99/month and $59/year. Institution pricing
remains a quote and signed order form; it is not assigned an invented online price.

Sources: [Stripe webhook API](https://docs.stripe.com/api/webhook_endpoints/create),
[Supabase secrets](https://supabase.com/docs/guides/functions/secrets).

Validation:

```bash
node --test ops/billing/activate-live.test.mjs
cd app
npm test -- src/lib/billing
```
