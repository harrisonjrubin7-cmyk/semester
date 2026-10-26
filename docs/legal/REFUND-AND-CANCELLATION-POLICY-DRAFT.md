# Semester Refund and Cancellation Policy — DRAFT

> **Not in force. Not reviewed by a lawyer.** Urgent: Semester Plus can be
> bought in the app since D-128 (Stripe test keys), and the claims register
> says this policy is owed before any checkout exists. It must be reviewed and
> published before a live key is set. Written from the code
> ([`app/src/lib/membership.ts`](../../app/src/lib/membership.ts),
> [`MembershipPanel.tsx`](../../app/src/components/MembershipPanel.tsx)) and
> D-128 in [`DECISION-LOG.md`](../DECISION-LOG.md). The
> [Terms of Service draft](TERMS-OF-SERVICE-DRAFT.md) section 8 says the same
> things and points here for refunds; change them together. Every
> `[DECIDE: …]` is a question only the owner or counsel can answer.

**Effective date:** [DECIDE]

## 1. What you pay for

**Semester Plus**, bought in the app from the Membership panel on the Account
screen, at the price shown there — currently $7.99 a month or $59 a year (D-134).
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

Cancel from the same Membership panel. The cancellation is sent to Stripe
first and recorded only once Stripe accepts it (D-132), so Plus stays on until
the end of the period you have paid for, then ends, and you are not charged
again. If Stripe refuses, nothing changes and the panel tells you that you are
still subscribed. If you are ever charged after cancelling, email us and we
will refund that charge in full.

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

If a renewal payment fails, Stripe emails you and retries it, and Plus keeps
working for a 14-day grace period. If it is still unpaid after that, Plus
features pause and your account works as Free; paying later brings them back.
Nothing you created is deleted. Semester records its own reminders but does
not yet send them; the emails you receive come from Stripe.

## 6. Price changes

We will tell you in the app before a new price applies to your next renewal,
and you can cancel before it does.

## 7. Receipts and records

Stripe emails a receipt for every charge. We keep payment records for seven
years after the end of the year each was made, including after you delete
your account, then remove them (D-132); a live subscription's records are
never removed.
