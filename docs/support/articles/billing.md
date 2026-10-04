# Billing: upgrade, cancel, receipts

> **Type:** help · **Audience:** students, support · **Owner:** `founder` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/support.test.ts`

Use this page when you ask how to buy Plus, how to cancel it, or where a receipt is; stop reading if you have never paid for Semester and are not being asked to, because during the pilot every feature a student can use is free.

**Status:** IMPLEMENTED_NOT_RELEASED for new purchases. New individual checkout is held in this build (`INDIVIDUAL_PAID_ACQUISITION_ENABLED` is `false` in `app/src/lib/plans.ts`). A live Plus charge, receipt, portal and end-of-period cancellation passed once, on an owner account, on 2026-10-03 ([evidence](../../evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md)). Pro is not on sale. Institution-sponsored access needs a configured institution and a written order form.

## Symptom

You say one of these:

- "How do I upgrade to Plus?"
- "I want to cancel."
- "Where is my receipt?"
- "I was charged and I don't recognise it."
- "My payment failed."

## Check

1. Open **Account** and find **Membership**. It says "You are on" your plan.
2. If you have never paid, the line reads "Plus and Pro are not on sale in this build. During the pilot, every feature a student can use is free." The button **View planned Plus** explains: "Nothing has been charged, and nothing will be without a checkout you see and confirm."
3. If you are a subscriber, the line reads "Renews on" a date, or "Cancelled. Plus stays on until" a date.
4. Buy only from the Account screen. If another page asks you to pay for Semester, it is not Semester. Card details are typed into Stripe's page and never reach Semester.

## Fix

1. Cancel: press **Cancel membership**, then **Cancel Plus**. Plus stops at the end of the period you have paid for, and nothing you made is taken away. If you are on Free, it says "You are on Semester Free, so there is nothing to cancel."
2. Receipts and invoices: press **Receipts, invoices and payment method**. It opens Stripe's billing page. The panel says: "Stripe takes your payments and emails a receipt for each one. Semester holds no card or bank details." This button shows only if you have a subscription or have paid before.
3. A failed payment: the Membership line says "Your last payment did not go through. Stripe will try again; update your card from the link in Stripe’s email." If it says Stripe needs your billing address, open the billing history button and update the address; the card has not failed.
4. A returned checkout: "Payment sent to Stripe. Your plan changes to Plus as soon as Stripe confirms it, usually within a minute." or "Checkout was closed before paying. Nothing was charged."
5. A charge you do not recognise: see Contact. This page documents no support tool that shows your card or payments.
6. Export your data and delete your data are on every plan, always: see [delete my account](delete-account-export-data.md).

## Not your fault

- **Stripe is slow.** The plan changes when Stripe confirms. The panel says "Semester could not check your membership just now." when it cannot read your plan, and "Nothing has changed and nothing will be charged. Try again in a moment."
- **Checkout is held.** If there is no buy button, that is the hold above, not a fault.
- **Tax needs an address.** Stripe may ask for a billing address to calculate tax. Update it in billing history.
- **What has not been exercised.** The 2026-10-03 run did not cover an annual charge, a refund, a failed renewal, a dispute, or tax in a registered jurisdiction.

## Contact

Refund and cancellation terms are in the [refund and cancellation policy](../../legal/REFUND-AND-CANCELLATION-POLICY-DRAFT.md). Read the policy itself; this page does not restate its terms.

### What to send

- The Membership line, word for word.
- The date of the charge and the receipt number from Stripe's email.
- Whether you cancelled, and what date the app says Plus ends.

### What not to send

- A full card number, a CVC, a bank login or a photo of your card.
- A screenshot of Stripe's page that shows your full address and card.

### Status and known limits

- [Status page source](../../../app/public/status.html) and [known limits](../../pilot/KNOWN-LIMITATIONS.md).
- No response time is committed. See [how support is staffed](../README.md#staffing-today).

<!-- labels: ["Membership", "View planned Plus", "Cancel membership", "Cancel Plus", "Receipts, invoices and payment method", "Plus and Pro are not on sale in this build. During the pilot, every feature a student can use is free.", "Nothing has been charged, and nothing will be without a checkout you see and confirm.", "You are on Semester Free, so there is nothing to cancel.", "Plus stops at the end of the period you have paid for", "Your last payment did not go through. Stripe will try again; update your card from the link in Stripe’s email.", "Payment sent to Stripe. Your plan changes to Plus as soon as Stripe confirms it, usually within a minute.", "Checkout was closed before paying. Nothing was charged.", "Semester could not check your membership just now.", "Nothing has changed and nothing will be charged. Try again in a moment.", "Stripe takes your payments and emails a receipt for each one. Semester holds no card or bank details."] -->
