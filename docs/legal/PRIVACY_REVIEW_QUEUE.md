# Privacy review queue: Phase 0 view

> **Not legal advice. Questions for qualified privacy and education counsel; nothing here decides applicability or compliance.**

| Field | Value |
| --- | --- |
| Purpose | Point to the existing privacy queue and list privacy questions found in the commercial and site audit that it does not carry |
| Authoritative queue (linked, not copied) | [`../privacy-operations/07-COUNSEL-REVIEW-QUEUE.md`](../privacy-operations/07-COUNSEL-REVIEW-QUEUE.md) (P-01 to P-21, all open); [`../COUNSEL-BRIEF.md`](../COUNSEL-BRIEF.md) sections A-C and H; [`../../LEGAL-REVIEW-QUEUE.md`](../../LEGAL-REVIEW-QUEUE.md) |
| Operating material | [`../privacy-operations/`](../privacy-operations/README.md); [`../legal-drafts/PRIVACY-REVIEW-INTAKE-TEMPLATE.md`](../legal-drafts/PRIVACY-REVIEW-INTAKE-TEMPLATE.md); [`../legal-drafts/VENDOR-PRIVACY-REVIEW-TEMPLATE.md`](../legal-drafts/VENDOR-PRIVACY-REVIEW-TEMPLATE.md); [`../legal-drafts/DSR-OPERATING-KIT-TEMPLATE.md`](../legal-drafts/DSR-OPERATING-KIT-TEMPLATE.md); [`../SUBPROCESSORS.md`](../SUBPROCESSORS.md) |
| Date | 2026-10-04 |
| Status | **Phase 0 baseline — evidence-cited, not a readiness claim** |
| Method | Read `docs/privacy-operations/07-COUNSEL-REVIEW-QUEUE.md` (21 P-rows by `grep -c '^| P-'`), COUNSEL-BRIEF, the commercial migrations and the site; compared |

## Existing rows already cover

P-01 FERPA/COPPA roles; P-02 breach clocks; P-03 rights-request clock; P-04 notice, age and minors; P-06 guardians; P-07 to P-09 erasure and holds; P-10 site and lead capture; P-11 marketing; P-12 AI; P-13 student-data DPA; P-18 international; P-20 company mailbox. Do not re-open these here.

## Additions found in this audit

| ID | Question for counsel | Evidence | Relation to existing rows |
| --- | --- | --- | --- |
| PV-N1 | Billing data: what privacy notice and retention apply to invoices, payment events and Stripe customer data for individuals, retained seven years after the calendar year, while the account-deletion promise says deletion removes product data | `docs/COMMERCIAL-CORE.md` "Financial retention"; `supabase/migrations/20260929130000_financial_retention.sql`; `app/src/lib/privacy.ts:231` | Extends P-07; payments tax rows are accountant questions |
| PV-N2 | Lead capture stores name, email, organization, role and free text in `site_leads` and `gtm_*`; the IP is HMAC-hashed with a salt that defaults to the service key; leads are unnotified until two secrets are set | `docs/COMMERCIAL-CORE.md` item 5 and secrets table | Extends P-10: retention period and hashing adequacy |
| PV-N3 | AI allowance metering stores per-account monthly dollar spend in `usage.cost_micros`; confirm notice and retention | `supabase/migrations/20261004170000_ai_spend_meter.sql`; `docs/decisions/D-1231.md` | New (behavioural metadata) |
| PV-N4 | Public site loads third-party resources (video, fonts) and embeds a personal mailbox in structured data | `company-site/index.html:19,3223`; `docs/legal/COOKIE-AND-STORAGE-NOTICE-DRAFT.md` | Extends P-10, P-20 |
| PV-N5 | Account-health snapshots and success plans for institutional accounts: personal data of institution staff; review-gated before outreach | `docs/COMMERCIAL-CORE.md` item 6 | New (staff data in B2B records) |
| PV-N6 | Public wording "FERPA-aligned", "Private by design", and "no archive kept / nothing trains anything" | `company-site/site.js:651`; `company-site/index.html:247`; `app/src/lib/privacy.ts:231` | Wording extends P-01 and COUNSEL-BRIEF H8 (see `PUBLIC_CLAIMS_APPROVAL_REGISTER.md` C-04, C-09, C-13) |
| PV-N7 | Terms draft lets 13-17 year olds hold accounts on a recited guardian agreement; no under-13 or guardian-verification path | `docs/legal/TERMS-OF-SERVICE-DRAFT.md:24-27` | Extends P-04, P-06 |

## Open questions / not verified

- Production data flows and regions were not inspected (Phase 0 rule); region and cross-border facts rest on `docs/SUBPROCESSORS.md`.
- No jurisdiction analysis is attempted.
