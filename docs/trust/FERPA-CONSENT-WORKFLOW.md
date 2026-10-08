# FERPA consent workflow

<!-- Rendered from app/src/lib/trust/ferpa-consent.ts by ferpa-consent.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

**A product and governance blueprint, not legal advice.** Counsel validates it
per institution, jurisdiction, contract and data flow; the institution — not a
product setting — determines and documents which FERPA exception applies and on
what conditions.

[The consent-sharing design](../CONSENT-SHARING-DESIGN.md) (D-037) settled the
pattern: one consent rule, three narrow tables, every share ending within a
term, revocable, read only through a function that logs the read. This page
asks what FERPA needs on top of that, and holds each answer to the schema: every
column the data model names is read out of the migrations by the test, and every
control cites the kind of file its status claims.

| Supplied document | What it holds |
| --- | --- |
| [Show me how to structure the FERPA consent workflow](../expansion/FERPA-Consent-AI-Training-Policy-and-800-1-Checklist.pdf) | When consent is needed, the decision gate, the consent flow and screen, the data model and the fifteen workflow controls. |
| [How do these modules protect student privacy (data-sharing control screen)](../expansion/Privacy-by-Module-and-Liability-Controls.pdf) | The share preview: what is shared, with whom, for what, at what access, until when, and what is not included. |

## When consent is needed

FERPA generally requires signed and dated written consent before personally identifiable information from an education record is disclosed, unless a specific exception applies. A valid consent identifies the records, the purpose and the recipient or recipient class; oral consent is not sufficient, and a generic “I agree to share my information” checkbox is not specific enough.

Use a decision gate before any disclosure outside the student’s private workspace:

1. Is the information personally identifiable information from an education record?
2. Is Semester disclosing, transferring or permitting access to it to another person or entity?
3. Does a documented FERPA exception apply? (A properly structured school-official arrangement; transfer to an institution where the student seeks or intends to enrol; a health or safety emergency; an audit, evaluation or study exception.)
4. If no exception applies: obtain signed, dated, specific written consent before disclosure.
5. If an exception is asserted: record the legal or policy basis, recipient, purpose, data scope, authorizing institution, expiry or review date and access controls.

## The flow

1. Student selects “Share with [recipient]”
2. Semester creates a human-readable disclosure summary
3. Student reviews the exact records and the recipient
4. Student signs and dates electronically
5. Semester records the consent version and the audit evidence
6. The recipient receives only the approved scope
7. Student can view active shares and revoke future access
8. Access expires automatically at the selected date
9. Revocation stops future disclosure; it does not necessarily erase records already lawfully received or retained

## The consent screen

Before the student signs, in this order:

| Line | Says |
| --- | --- |
| Recipient | The office or named person, at the named institution |
| Purpose | One sentence: what they will do with it |
| Records you are sharing | Each record or category, by name |
| Not included | What stays private: transcript or grades, financial-aid information, basic-needs activity, accessibility or accommodation information, transfer-credit documents, private AI conversations, club memberships, private notes |
| Access | Who, within the recipient, and at what level (view-only) |
| Duration | Until a date, unless the student revokes future access earlier |
| Your choices | Edit what is included; change the expiration date; cancel; sign and share |

Today the athlete share (`app/src/components/AthleteShare.tsx`) and the advisor share
(`app/src/components/AdvisorMeeting.tsx`) show the records, the recipient, the end date and what is
never shared, and send nothing until the preview is confirmed. Neither shows a
purpose or an access level, and neither is signed.

## The consent data model, against the schema

Each field the model asks for, and the column that already carries it — read
out of `supabase/migrations/` by the test — or none.

| Field | Column | Note |
| --- | --- | --- |
| `consent_id` | `advisor_shares.id` | Each share row is the consent record for that disclosure. |
| `tenant_id` | `advisor_shares.tenant_id` | Every share is bound to one school. |
| `student_id` | `advisor_shares.student_id` | The student who consented; RLS lets only them create or revoke. |
| `consent_version` | `consent_record.policy_version` | Recorded for capability consents (support access); a share row does not yet carry one. |
| `signed_at` | `advisor_shares.created_at` | The moment the student confirmed the preview. A confirmation, not a signature. |
| `signature_method` | **none** | Nothing records how the student signed. |
| `records_categories` | `family_grants.category` | Ten supporter categories; support_shares limits payload keys to six athlete items. |
| `field_level_scope` | `family_shared_items.item_id` | One row per named item per share; a category alone grants nothing. |
| `purpose` | `support_access_grant.reason` | Required for a support window; a student share carries a title, not a purpose. |
| `recipient_type` | `advisor_shares.advisor_id` | The recipient must hold a live academic_advisor grant at the school; the class is implied by the table, not stored. |
| `recipient_id` | `advisor_shares.advisor_id` | One named person per share. |
| `legal_basis` | **none** | Consent is the only basis the tables know; no exception can be recorded. |
| `effective_at` | `advisor_shares.created_at` | A share is live on creation. |
| `expires_at` | `advisor_shares.expires_at` | Not null, and at most 120 days (advisor), 200 (athlete support), 7 (support access). |
| `revoked_at` | `advisor_shares.revoked_at` | The only column a student may update, and never back to null. |
| `revocation_reason` | **none** | Optional in the model; nothing stores one. |
| `disclosure_log_ids` | `advisor_share_events.share_id` | One event per read, visible to the student. |
| `policy_document_version` | `consent_record.policy_version` | Per capability consent; the terms of service are a draft (docs/legal/). |
| `terms_snapshot_hash` | `advisor_shares.payload` | The previewed payload is stored whole, which is a snapshot but not a hash of the terms. |
| `audit_correlation_id` | **none** | Gateway audit rows carry a correlation id (20260928320000); share events do not. |

16 of 20 fields have a column somewhere; the rest are named so the gap is visible.

## The fifteen workflow controls

Statuses were read at main commit 92952f0 on 28 September 2026.

| not-started | designed | building | tested |
| ---: | ---: | ---: | ---: |
| 1 | 0 | 5 | 9 |

| ID | Control | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| FC-01 | Digital signature is attributable to the eligible student | tested | `supabase/advisor.check.sql` — only the student, as auth.uid(), creates or revokes their share | An authenticated action, not a signature: no signature method is recorded. |
| FC-02 | Consent is signed and dated | building | `supabase/migrations/20260928301000_advisor_shares.sql` — created_at on every share | Dated by the row; nothing is signed, and the confirmation is not linked to a consent version. |
| FC-03 | Records are listed in understandable categories and, where possible, fields | tested | `app/src/components/AthleteShare.test.tsx` — offers only what the app holds, and says what is never shared<br>`app/src/lib/sharing.test.ts` — a supporter sees named items only | Categories and items are named; no share names a field of a record. |
| FC-04 | Purpose is specific and understandable | building | `supabase/migrations/20260925103000_support_access.sql` — a support window needs a reason of 1–500 characters | A student share carries a title and no purpose line. |
| FC-05 | Recipient is named or a sufficiently specific recipient class is identified | tested | `supabase/advisor.check.sql` — the advisor is found only among live academic_advisor holders at the student’s school<br>`supabase/supportshares.check.sql` — one named athletic academic support staff member | A class (“career center staff assigned to your request”) cannot be a recipient; only a person can. |
| FC-06 | Scope defaults to the minimum necessary data | tested | `app/src/lib/help-routes.test.ts` — starts with nothing ticked; a typed field is sent only when ticked<br>`app/src/components/AdvisorMeeting.test.tsx` — follow-ups only when ticked | Minimum by default; no rule stops a student ticking everything. |
| FC-07 | Consent is separate from general product terms | building | `supabase/migrations/20260923210000_intelligence_policy.sql` — consent_record per capability and policy version, apart from any terms<br>`supabase/migrations/20260928090000_gtm_foundation.sql` — gtm_consent append-only, with version and source | A share confirmation writes no consent_record, so its separateness from the terms is by construction, not by record. |
| FC-08 | Expiry is required; no indefinite sharing by default | tested | `app/src/lib/sharing.test.ts` — refuses no end date, a past one, and one past the cap<br>`app/src/lib/advisor-shares.test.ts` — always sets an expiry, never past 120 days<br>`supabase/migrations/20260928308000_support_shares.sql` — expires_at not null, at most 200 days | Nothing missing here beyond the employer opt-in, which renews at 180 days rather than ending. |
| FC-09 | Student can inspect active, expired and revoked consents | tested | `app/src/components/TrustCenter.test.tsx` — active and past shares; a live one revoked only after saying what happens<br>`app/src/components/AdvisorMeeting.test.tsx` — lists shares by state and reads | Each relationship has its own list; one Sharing list across all three is designed (D-037) and not yet built. |
| FC-10 | Revocation prevents new disclosures going forward | tested | `supabase/advisor.check.sql` — a revoked share is not listed and cannot be un-revoked<br>`supabase/supportshares.check.sql` — revoked or expired returns nothing; losing the role ends it too | The student may also delete the row, so a revoked record is not always kept for audit. |
| FC-11 | Every disclosure is logged with actor, recipient, fields, purpose, time and legal basis | tested | `supabase/supportshares.check.sql` — every read is one event the student sees and staff cannot insert<br>`supabase/migrations/20260921143653_access_log.sql` — every read around RLS, per user, day and path | Reader and time only: no fields, purpose or legal basis per event. |
| FC-12 | Recipient access is role-bound, time-limited and auditable | tested | `supabase/supportshares.check.sql` — losing the role stops the share without anyone revoking it<br>`supabase/rolegrants.check.sql` — role grants carry scope, expiry and revocation | Supporters are not roles; a supporter’s access is bound to the invite, not to a grant that can lapse. |
| FC-13 | If a FERPA exception is used, the system records the exception rationale and institutional authorization | not-started | `docs/FERPA-COPPA-1EDTECH-READINESS.md` — FERPA-1, school-official terms, is not started | No table or code records an exception; every disclosure the tables allow is by the student’s consent. |
| FC-14 | Export, correction, deletion, retention and legal-hold behaviour are defined | building | `supabase/migrations/20260926150000_expansion_roles_and_features.sql` — data_requests: export, delete, correct, restrict<br>`supabase/migrations/20260930100000_legal_holds.sql` — a legal hold on an account, a school or the platform<br>`app/src/lib/retention.test.ts` — every table has a retention answer | A legal-hold object exists (`legal_holds`, maturity RM-02 partial) but no screen or runbook places one, and a hold is placed on an account, a school or the platform, not on a share. |
| FC-15 | Accessibility review confirms keyboard, screen-reader, plain-language and mobile use | building | `app/src/a11y/axe.test.tsx` — axe-core over the rendered app<br>`docs/accessibility/AT-PASS-PROTOCOL.md` — the manual assistive-technology pass, not yet done | No manual assistive-technology pass of a share screen, and no plain-language review of the consent copy. |

## What would close the gaps

- A `purpose` and an `access` column on each share table, shown on the preview
  and stored with the row.
- A consent version and a signature method on the share, written at
  confirmation, so a share is a signed and dated consent and not only an
  authenticated action.
- Fields and purpose on every read event, not only reader and time.
- A revoked share that cannot be deleted while any read event references it.
- An exception record, for the day an institution asserts a school-official or
  emergency basis instead of consent (FERPA-1 in
  [the FERPA, COPPA and 1EdTech readiness register](../FERPA-COPPA-1EDTECH-READINESS.md)).
- A way to place a legal hold on a share, and a screen or runbook that places one (operational maturity RM-02; the `legal_holds` object exists).
