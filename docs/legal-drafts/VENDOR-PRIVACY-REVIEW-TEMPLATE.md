> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Vendor and subprocessor privacy review — template

- **Owner/backup:** `[TBD role]` / `[TBD role]`
- **Version/effective date:** 0.1, not in effect
- **Approval authority:** qualified counsel for terms and roles; security owner for technical controls
- **Builds on:** `docs/SUBPROCESSORS.md` (generated from `app/src/lib/trust/subprocessors.ts`; 19 parties in three kinds), `docs/trust/SUBPROCESSOR-GOVERNANCE-PROGRAM.md`, `VENDOR-SECURITY-REVIEW-PROGRAM.md`, `PROVIDER-TERMS.md`, `DPA-CHECKLIST.md`. State today: no per-vendor review records, no DPAs signed, regions unverified. The three-way split in the generated list is an engineering classification, not a legal role finding.

## Plain-language summary

No vendor receives personal data until it has a completed review record. The record answers: what data, why, where, on what terms, how it is deleted, how we find out about changes. Deleting a user's data is not finished until vendors holding it have been told and have confirmed or are tracked as outstanding.

## 1. Lifecycle

| Stage | Gate | Output |
| --- | --- | --- |
| Request | Privacy review intake (core + relevant add-on) | Business case, data list |
| Review | This template §2; security review per the vendor security program | Completed record |
| Contract | DPA/terms checked against `DPA-CHECKLIST.md`. **COUNSEL-REQUIRED** | Signed terms or recorded exception |
| Activate | Add to `subprocessors.ts`; run `npm run registers` from `app/`; privacy policy draft names it (a test enforces this); regions and CSP updated | Generated list shows the vendor |
| Monitor | §3 | Monthly note |
| Change | §3 triggers re-review | Updated record |
| Offboard | §4 | Deletion confirmation |

## 2. Review record (one per vendor; keep in the restricted privacy records store, not the repo)

| Field | Value |
| --- | --- |
| Vendor, product, contract entity, contact | |
| Kind (subprocessor / institution-directed / student-directed) and **legal role (counsel)** | |
| Purpose; the product feature that depends on it; fallback if removed | |
| Data categories and tiers; minors included? institution data? | |
| Data minimization: fields actually sent; what is deliberately withheld | |
| Regions of storage and support access; cross-border transfers and mechanism `[COUNSEL-REQUIRED]` | |
| Vendor's own sub-vendors; notice mechanism | |
| Use limits: no sale, no ad profiling, **no model training on our data**; evidence (terms version/date) | |
| Retention at vendor; backups; log retention | |
| Deletion: API, ticket, automatic expiry? time to delete; confirmation form | |
| Security evidence reviewed (report, questionnaire) and date; **do not claim certification** unless the report itself says so | |
| Breach notice commitment to Semester (hours) | |
| Audit/assessment rights | |
| DPA / terms status and version; deviations | |
| Authentication, key/secret handling (`SECRETS.md`) | |
| Student-visible disclosure (privacy policy row, in-product label) | |
| Residual risk and acceptance (who, date) | |
| Next review date | |

Risk tier for review depth: **High** (student records, minors, AI prompts, payments) annual full review; **Medium** (account/contact data) annual light; **Low** (no personal data) on change.

## 3. Ongoing monitoring and change notification

| Trigger | Action |
| --- | --- |
| Vendor announces new sub-processor, region change, or terms change | Log within 5 business days; privacy re-review; counsel if roles/terms change; update the generated list and policy draft; decide on customer notice (contract/DPA terms, `[DECIDE]` notice period) |
| Vendor incident | Start the breach worksheet (Step 0) |
| New data field sent to a vendor | Core review required before merge |
| Vendor acquired or discontinued | Treat as change; plan §4 |
| Monthly | Check each vendor's public change feed/status; record in the privacy records store |
| Institution objection to a vendor | Counsel; consider tenant-level disable |

Customer notification of subprocessor changes: **COUNSEL-REQUIRED** (contract-driven; no promised period exists today).

## 4. Deletion propagation (closes the gap in the DSR kit)

For every deletion (user-initiated, institution offboarding, retention expiry):

1. Look up vendors holding that user's data from the review records (data categories column).
2. For each: automatic (API call or expiry) / manual (ticket) / none available.
3. Record per vendor: instruction sent, date, vendor reference, confirmation received (Y/N), expected expiry of backups.
4. Outstanding items are listed on the request log and reviewed weekly until confirmed or the vendor's documented expiry passes.
5. The response to the user says what Semester controls, what vendors were told, and that provider copies expire on their schedule. Do not say "everything is deleted" while any row is open. **COUNSEL-REQUIRED:** exact wording.

| Vendor class | Example | Typical path | Gap to close |
| --- | --- | --- | --- |
| Database/auth hosting | Supabase | `erase_account()` plus provider backup expiry in `RETENTION.md` | Backup-tail wording |
| AI providers | Gateway providers | Check whether any prompt retention exists; terms say what | Verify retention per provider |
| Email/notification | Transactional email, push | Delete recipient records/tokens | Per-vendor procedure |
| Billing/payments | Payment processor | Financial records are kept under finance retention; personal data minimized | Counsel on required retention |
| Calendar/LMS connectors | Google, Microsoft, LMS | Revoke token; stop sync; imported copies governed by our retention | Disconnect-and-purge behavior |
| Support tooling | Ticket/email | Redact or delete tickets | Procedure |
| Analytics | `[none today?]` | n/a | Confirm none holds personal data |

## 5. Register health checks (monthly)

- Every party in `subprocessors.ts` has a review record, DPA status, region and next-review date.
- Every vendor in the CSP, edge functions and gateway is in the generated list (a test enforces part of this).
- Vendors with records older than their next-review date are listed in the counsel queue if terms matter.
- Count of vendors with signed DPAs, with unverified regions, with open deletion confirmations (metrics only; no claims).

## Activation blockers

No review record exists for any vendor; no DPAs signed; regions unverified; counsel has not decided roles or notice periods; no deletion-propagation exercise recorded.
