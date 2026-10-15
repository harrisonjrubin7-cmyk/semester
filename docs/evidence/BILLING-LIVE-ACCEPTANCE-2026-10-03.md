# Semester Plus live billing acceptance — October 3, 2026

**Produced:** 2026-10-03

## Scope

This record covers the individual Semester Plus lifecycle in the production
Stripe and Supabase projects. It does not approve Semester Pro, an institution
deployment, general availability, or new paid acquisition. The checkout path is
currently held by the governed acquisition control.

## Verified lifecycle

- The signed-in Account screen offered $7.99 monthly and $59 annual Plus plans
  and required explicit recurring-charge consent before redirecting to Stripe.
- A live $7.99 monthly checkout completed successfully. Stripe calculated and
  displayed tax before payment; tax for the acceptance purchase was $0.00.
- Stripe recorded the invoice as paid and exposed it through the customer
  billing portal.
- The production webhook initially rejected the events because its signing
  secret did not match the configured Stripe destination. The Supabase secret
  was corrected without rotating the destination, and the failed
  `checkout.session.completed` event was resent successfully with HTTP 200.
- The signed-in account changed from Semester Free to Semester Plus and showed
  the next renewal date.
- The customer portal showed the active $7.99 monthly subscription, payment
  method summary, billing information and paid invoice history.
- Cancellation required a separate confirmation. Stripe accepted an
  end-of-period cancellation, the app kept Plus active, displayed the end date,
  and stated that no further charge would occur.

## Result

The checkout, receipt, entitlement, portal and cancellation lifecycle passed.
The acceptance subscription remains active only through its paid period and is
scheduled to end on November 3, 2026.

## Boundaries

- The acceptance run did not exercise a $59 annual charge, a refund, a failed
  renewal, a dispute, or tax collection in a registered jurisdiction.
- Pro remains planned and is not on sale.
- Institution-sponsored access still requires an institution configuration and
  written order form; no institution sponsors Semester yet.
- This evidence does not convert the private beta into general availability or
  replace legal, accessibility, security, or institution-specific approvals.
- This evidence is historical acceptance evidence, not authorization to enable
  checkout. Current launch and public-claims registers remain controlling.
