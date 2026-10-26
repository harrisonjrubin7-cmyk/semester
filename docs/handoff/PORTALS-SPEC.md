# Portals and operating modes

From `uploads/outline every function feature cappabltie and requ (1).pdf` (6 Oct). Prototype: `ui_kits/semester-app/`.

## Operating mode: declare one per capability and show it on screen
| Mode | What Semester does | Example |
|---|---|---|
| Native | Creates and owns the authoritative record | Personal task, marketplace listing, onboarding checklist |
| Connected read | Displays an external authoritative record | Tuition balance, enrollment |
| Connected transaction | Submits an authorized command and waits for confirmation | Registration request via the approved YES integration |
| Import | Makes a user-owned copy | Schedule pasted from YES |
| Handoff | Opens the official service; never claims completion | Housing agreement signing |

Every screen shows the mode, source, last sync time and limitations.
- An imported schedule isn't enrollment.
- A payment you start isn't settled.
- Clicking a link isn't completing the requirement.

Per-institution authority lives in `sx.domain_authority` (010_campus_portals.sql). Prototype: `#/institution/authority`.

## Module contract (every module)
- **Screens:** home, list, detail, create or action flow, and history.
- **Rules:** a role and record-access matrix, a state machine, and server-side validation and authorization.
- **States:** loading, empty, error, disconnected, stale and denied.
- **Usability:** search, filters, accessibility and mobile.
- **Reliability:** audit events, integration failure and recovery, and tests for both allowed and forbidden actions.

## Portals
| Portal | Prototype | States | Done when |
|---|---|---|---|
| Marketplace | `#/student/market` | Listing: draft → pending review → active → reserved → sold / expired / removed.<br>Order: pending payment → paid → fulfillment → completed, plus cancel, dispute and refund branches. | A purchase traces from listing to payment, fulfillment, receipt, payout and any refund. Retried provider notifications can't duplicate orders or payouts. Refunds are reversing entries. Define the payment-provider and legal model before any money moves; no stored-value custody by accident. |
| Registration | `#/student/register` | Attempt: draft → validated → submitted → confirmed / rejected / unknown | The student can tell a cart, a submitted request, a waitlist position and confirmed enrollment apart. Writes are acknowledged by the SIS. "Unknown" is reconciled before any retry. Seats are allocated by the authoritative system, never by checks in the browser. |
| Dining | `#/student/dining`, `#/campus/dining` | Plan enrollment, entitlements, wallets, transactions | Swipes, Meal Money and Commodore Cash stay separate, with configurable rollover, expiry and refund rules for each wallet. Forecasts are labelled as estimates. |
| Housing | `#/student/housingportal`, `#/student/housing`, `#/campus/*` | Application: draft → submitted → reviewed → eligible / ineligible → offered / waitlisted.<br>Assignment: offered → accepted → contracted → occupied → checkout → closed. | Beds are allocated transactionally. Accommodation reasons never appear in housing views. Move-out is an institution-configured rule, e.g. min(last exam + allowed interval, closing deadline), used only where policy says so; Semester never invents an interval. |
| Applicant | `#/applicant/application` | Applicant, application, requirement, document, recommender invitation, review, decision, offer | Applications to different schools never mix. Recommendation links are scoped, expiring and confidential. Reviewer notes and decision letters have separate access. Identity carries over when an applicant becomes a student. |
| Admitted onboarding | `#/applicant/onboarding` | Task: not started → in progress → submitted → verified / rejected / waived | The checklist is a dependency graph. "I completed this" is distinct from "the university verified this". Student access is provisioned only when the conditions are met. |
| Money | `#/student/bill`, `#/finops/queue` | Charge, credit, aid item (offered / accepted / anticipated / posted), installment, payment reference, refund | Tuition, marketplace payments and Semester subscriptions are separate financial domains. Amounts use integer minor units. Initiation is never treated as settlement. Corrections are explicit entries. Official status is shown apart from estimates. Adjustments and refunds need separation of duties. |

## Corrections applied to the prototype
- **Housing:** the "48 h after last exam" move-out rule was invented. Housing now shows the published date and the configurable rule.
- **Dining:** it now separates Meal Money from Commodore Cash, and labels run-out as an estimate.

## Staff counterparts (prototype)
- `#/marketplace/queue`: moderation of listings, reports and disputes; appeals go to a different moderator.
- `#/institution/regops`: reconcile "unknown" registration outcomes against YES, and handle override requests.
- `#/institution/onbverify`: each office verifies its own onboarding steps; a payment that has only started isn't verified.
- `#/campus/rules`: per-wallet rollover, expiry and refund rules.
