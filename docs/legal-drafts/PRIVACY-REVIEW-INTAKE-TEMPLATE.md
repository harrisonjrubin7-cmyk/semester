> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Privacy-by-design review intake — template (product, analytics, AI, marketplace, integrations, marketing)

- **Owner/backup:** `[TBD role]` / `[TBD role]`
- **Version/effective date:** 0.1, not in effect
- **Approval authority:** qualified counsel for items marked COUNSEL-REQUIRED; otherwise the privacy reviewer role named in the intake
- **Relationship to existing gates:** question 10 of `.github/pull_request_template.md` asks for a row in `app/src/lib/governance/pia.ts`. That row is the *register entry*. This template is the *thinking* that precedes it, and the place the add-ons below live. A finished review ends in a `pia.ts` row (then `npm run registers` from `app/`), never a hand-edited markdown file.

## Plain-language summary

Before any new use of personal data is built, switched on, or advertised, answer these questions in writing. If a question cannot be answered, the feature is not ready. Reviews are proportional: a copy change needs none; a new data flow needs the core; AI, marketplace, integrations and marketing also need their add-on.

## When a review is required (any "yes")

- New or changed personal data collected, derived, inferred, shared or retained
- New recipient, vendor, SDK, script, pixel, webhook or integration scope
- New analytics event or change to an identifier
- Any AI use of user or institution data
- New audience (new age band, role, institution type, geography)
- Change to retention, deletion, export, consent, notification or permissions
- New marketing channel, list, tracking or testimonial use
- Anything touching minors, guardians, accommodations, grades, billing, safety or health-adjacent data

## Core review (every trigger)

| # | Question | Answer | Evidence |
| --- | --- | --- | --- |
| 1 | What user problem does this solve, and is the data necessary for it? (necessity, not convenience) | | |
| 2 | List every data element, source, tier (T0–T6 in `docs/trust/DATA-CLASSIFICATION-STANDARD.md`), and whether it is new | | |
| 3 | Whose data (ages, roles, institution-controlled or student-private)? | | |
| 4 | Purpose limitation: the only uses; what is expressly **not** a use | | |
| 5 | Could it work with less (coarser, aggregated, on-device, shorter-lived, pseudonymous)? | | |
| 6 | Who can see it (roles, staff, institution, guardian, vendor)? Default visibility must be private | | |
| 7 | Where does it live (tables, device, logs, backups, analytics, search, cache, vendor, region)? | | |
| 8 | Retention: period per store; row in `RETENTION.md`; sweep; hold behavior | | |
| 9 | Deletion: does `erase_account()` reach it? vendors? device? backups? | | |
| 10 | Export: is it in `export_my_data()` / the archive? | | |
| 11 | Consent or notice: what does the user see, when, and can they say no and still use the product? | | |
| 12 | Dark patterns check: is any choice pre-selected, hidden, guilt-framed or harder to undo than to give? | | |
| 13 | Minors: does it work for under-18 and under-13 accounts; is it off for them by default? | | |
| 14 | Security: access control, encryption, tenant isolation tests, abuse cases | | |
| 15 | Failure: what happens to data if it breaks, is breached, or is switched off? | | |
| 16 | Can it be removed cleanly if it does not work? | | |
| 17 | What public statements (notice, store listing, marketing) change? Do they stay true? | | |
| 18 | Which counsel questions does it raise? (add to the queue) | | |
| 19 | Decision: approve / approve with conditions / reject / defer. Conditions and owners | | |

Outputs: completed intake kept in the privacy records store (the PR links its id, not its content); `pia.ts` row; `RETENTION.md` edit if tables added (the tripwire test fails otherwise); `docs/SUBPROCESSORS.md` regeneration if a vendor is added; queue rows for open legal questions.

## Add-on A — Analytics and telemetry

| # | Question |
| --- | --- |
| A1 | Event name, definition and decision it informs (`docs/ANALYTICS-EVENTS.md`). No decision, no event |
| A2 | Identifier used: none, session, pseudonymous id, account id? Justify any account id |
| A3 | Properties: confirm no content, free text, grades, names, emails or precise location |
| A4 | Minors and institution tenants: excluded, aggregated or separately consented? **COUNSEL-REQUIRED** |
| A5 | Sampling, retention, and who can query raw events |
| A6 | Any third-party analytics script? If yes: vendor review and `COOKIE-CONSENT-IMPLEMENTATION-SPEC.md` |
| A7 | Can a user opt out without losing function; is the opt-out honored server-side? |
| A8 | Re-identification risk from small cohorts; minimum cell size |

## Add-on B — AI features

Builds on `docs/trust/AI-RISK-ASSESSMENT.md`, `AI-SYSTEM-INVENTORY.md`, `AI-DATA-USE-STANDARD.md`, `AI-FEATURES-DISCLOSURE-DRAFT.md`.

| # | Question |
| --- | --- |
| B1 | Named user purpose and allowed data classes; risk tier (assistive … prohibited) |
| B2 | Exactly which data enters the prompt; minimization and redaction; who authorized it (user, institution) |
| B3 | Provider, model, region, retention at the provider, training use. Terms on file? (`docs/trust/PROVIDER-TERMS.md`; none signed) **COUNSEL-REQUIRED** |
| B4 | Is the in-app promise "nothing is used to train anything" still true for this flow? If not, stop |
| B5 | Storage of prompts/outputs: where, how long, deletable, exportable, visible to staff/institution/guardian? |
| B6 | Human confirmation for any consequential or external action; no autonomous grade, enrollment, financial or disciplinary effect |
| B7 | Source provenance and uncertainty shown to the user; user-visible "why" |
| B8 | Prompt-injection and cross-user leakage tests; tenant retrieval filter before context assembly |
| B9 | Inference about sensitive traits, wellbeing or risk: default **no**; any exception is **COUNSEL-REQUIRED** |
| B10 | Kill switch and incident link (`AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md`) |
| B11 | Evaluation evidence (accuracy, bias, leakage) before release and recurring |
| B12 | Minors: off by default unless counsel approves |

## Add-on C — Marketplace and extensions

State today: `docs/EXTENSION-ECOSYSTEM-GOVERNANCE.md` records nothing built and external connectors hard-coded off. Review before any switch-on.

| # | Question |
| --- | --- |
| C1 | Third-party provider role: does it receive personal data? Is it Semester's vendor, the user's, or the institution's? **COUNSEL-REQUIRED** |
| C2 | Data scopes requested, per scope justification; default deny; user-visible consent screen per provider |
| C3 | Provider terms: no resale, no ad profiling, deletion on uninstall, breach notice to Semester |
| C4 | Provider review before listing (vendor template) and re-review on change |
| C5 | Payment and tax data stay with the processor; confirm what Semester stores |
| C6 | Listings, reviews and messages: moderation, minors' safety, personal data in public content |
| C7 | Revocation: one tap removes access, tokens revoked, provider told to delete |
| C8 | Institution control: allow-list, disable by role, audit |
| C9 | Provider data flows back into the record? provenance and correction path |
| C10 | Disputes, refunds and who is merchant of record (counsel items E1–E3) |

## Add-on D — Integrations and connectors (SIS, LMS, SSO, calendar, email, payments)

Builds on `docs/INTEGRATION-PERMISSION-MATRIX.md`, `INTEGRATION-THREAT-MODEL.md`, `SSO-CLAIM-MAPPING-AND-DATA-MINIMIZATION.md`.

| # | Question |
| --- | --- |
| D1 | Direction (read/write), objects, fields; smallest scope that works; field-level justification |
| D2 | Authority: who authorized (user, institution admin); is that authority documented |
| D3 | Source precedence and conflict handling; no silent overwrite |
| D4 | What happens to imported data when the connector is disconnected or the school leaves (`docs/SCHOOL-OFFBOARDING.md`) |
| D5 | Credential storage, rotation, revocation; secrets handling (`SECRETS.md`) |
| D6 | Imported minors/guardian data: separate handling |
| D7 | Logging without personal-data payloads |
| D8 | Degraded mode: native function keeps working; no loss of access |
| D9 | Vendor/subprocessor entry and DPA status |
| D10 | Student visibility into what was imported and why (provenance label) |

## Add-on E — Marketing, growth and communications

Builds on `MARKETING-COMMUNICATIONS-CONSENT-DRAFT.md`, `MARKETING-CLAIM-REVIEW-MATRIX.md`, and the `lead-intake` edge function.

| # | Question |
| --- | --- |
| E1 | Audience: prospects, students, guardians, institution staff, alumni? Never use account/product data for marketing without separate consent. **COUNSEL-REQUIRED** |
| E2 | Channel (email, SMS, push, social, ads) and consent evidence per channel (who, when, wording, source) |
| E3 | Suppression and unsubscribe honored across all systems within `[DECIDE]`; transactional vs. promotional separated |
| E4 | Tracking: pixels, retargeting, lookalike audiences, data-broker lists. Default **no**; any use needs vendor review and counsel |
| E5 | Minors: no marketing to under-18 accounts; guardians contacted only as consented |
| E6 | Lead intake: fields minimized, purpose stated, retention, deletion path, spam/abuse handling |
| E7 | Testimonials/case studies: written permission, scope, expiry, withdrawal path; student data never used without consent |
| E8 | Claims: every privacy or compliance statement checked against `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` and `LEGAL-CLAIMS-APPROVAL-POLICY.md` |
| E9 | Referral and incentive mechanics: do they disclose personal data of a third party? |
| E10 | Social media: no screenshots with student data; moderation/DM handling |

## Reviewer decision block

| Field | Value |
| --- | --- |
| Feature / PR / date | |
| Triggers and add-ons completed | |
| Decision | approve / conditions / reject / defer |
| Conditions, owners, due dates | |
| `pia.ts` row added (ref) | |
| `RETENTION.md` / subprocessors / queue updated (refs) | |
| Counsel questions raised (queue ids) | |
| Reviewer (role) and second reviewer | |

## Activation blockers

No named reviewer (privacy seat unsigned); counsel has not approved AI, marketplace, marketing or minors answers; this template has not been exercised on a real change.
