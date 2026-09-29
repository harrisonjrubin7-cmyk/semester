# Semester Refund and Cancellation Policy — DRAFT

> **Not in force. Not reviewed by a lawyer.** Urgent: Semester Plus can be
> bought in the app since D-128 (Stripe test keys), and the claims register
> says this policy is owed before any checkout exists. It must be reviewed and
> published before a live key is set. Written from the code
> ([`app/src/lib/membership.ts`](../../app/src/lib/membership.ts),
> [`MembershipPanel.tsx`](../../app/src/components/MembershipPanel.tsx)) and
> D-128 in [`DECISION-LOG.md`](../DECISION-LOG.md). The
> [Terms of Service draft](TERMS-OF-SERVICE-DRAFT.md) section 8 still says no
> billing exists and must be updated with it. Every `[DECIDE: …]` is a
> question only the owner or counsel can answer.

**Effective date:** [DECIDE]

## 1. What you pay for

**Semester Plus**, bought in the app from the Membership panel on the Account
screen, at the price shown there — currently $3.99 a month or $29.99 a year.
Before anything is charged you tick a box that names the amount, how often it
renews, and where to cancel. Payment is taken by Stripe; Semester never sees
your card. Semester Free stays free, and nothing you created is locked behind
Plus: export, deletion and access to your own work are never paid features.

If your school provides Semester, you pay nothing and this policy does not
apply to you.

## 2. Renewal

Plus renews automatically at the end of each month or year until you cancel.
[DECIDE with counsel: advance reminder before an annual renewal, as some U.S.
states require.]

## 3. Cancelling

Cancel from the same Membership panel. Plus stays on until the end of the
period you have paid for, then ends; you are not charged again. **Until the
cancellation reaches Stripe automatically, we cancel it in Stripe for you by
hand** — if you are charged after cancelling, email us and we will refund
that charge in full. [DECIDE: build the Stripe cancellation before a live key.]

## 4. Refunds

[DECIDE — a suggested starting point for counsel:]
- A charge made after you cancelled, or a duplicate or mistaken charge: refunded
  in full.
- A new annual plan, cancelled within 14 days of purchase: refunded in full.
- Otherwise, no partial refunds for the unused part of a period; Plus runs to
  the end of it.
- Where the law where you live gives you more, that applies.

Ask by email to harrisonjrubin7@gmail.com [DECIDE: dedicated billing address],
from the email on your account. Refunds go back to the original payment
method through Stripe.

## 5. Failed payments

If a renewal payment fails, Stripe retries it; if it keeps failing, Plus ends
and your account returns to Free. Nothing you created is deleted.

## 6. Price changes

We will tell you in the app before a new price applies to your next renewal,
and you can cancel before it does.

## 7. Receipts and records

Stripe emails a receipt for every charge. We keep payment records for [DECIDE
with counsel: typically seven years], including after you delete your
account.
