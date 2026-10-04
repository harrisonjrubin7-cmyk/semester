> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Processing register expansion and field-to-tier seed map — draft

- **Owner/backup:** `[TBD role]` / `[TBD role]`
- **Version/effective date:** 0.1, not in effect
- **Approval authority:** qualified counsel (roles, bases); data owner (facts)
- **Builds on:** `docs/trust/PERSONAL-DATA-PROCESSING-REGISTER.md` (7 rows, mostly `[TBD]`), `docs/DATA-INVENTORY-AND-LINEAGE.md` (302 public tables, generated), `docs/trust/DATA-CLASSIFICATION-STANDARD.md` (T0–T6; unclassified is treated as T3), `RETENTION.md`.

## Plain-language summary

The existing register omits activities that clearly exist in the repository or the plan. This file lists them as **candidate rows** for the trust register, with every role and basis left for counsel. It also seeds a field-to-tier map so classification has a starting point. Rows join the trust register only after owners verify facts; this file does not claim completeness.

## 1. Candidate activities to add

Facts column cites repo evidence; role/basis/retention are not decided here.

| ID | Activity | Subjects and data | Repo evidence | Role / basis | Retention | Rights notes | Open |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PR-08 | Marketing leads and website contact | Prospects: name, email, institution, message | `supabase/functions/lead-intake` | `[DECIDE]` | `[DECIDE]` | Suppression and deletion path | Fields, consent evidence, spam handling |
| PR-09 | Marketing and lifecycle email | Users and prospects: email, preferences | `MARKETING-COMMUNICATIONS-CONSENT-DRAFT.md` | `[DECIDE]` | `[DECIDE]` | Unsubscribe across systems | No channel built? verify |
| PR-10 | Support tickets and replies | Users: message, attachments, diagnostics | `support-reply-notify`; PIA row "support tickets" | `[DECIDE]` | `RETENTION.md` | Redaction and DSR | Staff access scope and recording |
| PR-11 | Beta feedback and pilot figures | Testers, pilot users | PIA rows | `[DECIDE]` | `[DECIDE]` | Consent to use feedback | Terms |
| PR-12 | Community and messaging | Members: posts, media, reports | `docs/COMMUNITY-PRIVACY-MODEL.md`, `COMMUNITY-MEDIA-SAFETY.md` | `[DECIDE]` | `[DECIDE]` | Third-party content in exports | Moderation access; minors |
| PR-13 | Family and guardian links | Guardians, students: relationship, consent scopes, activity log | `k12_guardians` migrations | `[DECIDE]` | `[DECIDE]` | Guardian rights | Verification; minors |
| PR-14 | Billing and subscriptions | Payers: processor ids, plan, status | `billing-*` functions, billing webhook | `[DECIDE]` | Finance schedule `[DECIDE]` | Records kept under finance retention | No card data stored by design; verify |
| PR-15 | Academic record ledger | Students: record entries, immutable history | PIA row; four immutable history tables | `[DECIDE]` (institution-controlled?) | Per institution | Correction vs. immutability | Counsel B2 |
| PR-16 | Integrations (calendar, LMS, SIS, SSO) | Users: tokens, imported items | `calendar`, `canvas`, `lti`, `integration-tick`, `fetchcal` | `[DECIDE]` | Disconnect-and-purge `[DECIDE]` | Provenance and revocation | Offboarding behavior |
| PR-17 | Push notifications | Device tokens, content | `push` | `[DECIDE]` | `[DECIDE]` | Token deletion | Content minimization |
| PR-18 | Trust room / institutional evidence | Institution contacts, evidence | `trust-room` | `[DECIDE]` | `[DECIDE]` | | Access control |
| PR-19 | Audit and security logging | Actors, actions, IPs | audit tables, `SECURITY.md` | `[DECIDE]` | `RETENTION.md` | Immutable logs vs. erasure | Counsel X3/X5 |
| PR-20 | Backups and disaster recovery | Everything | `RESTORE.md`, `RETENTION.md` backup tail | `[DECIDE]` | Provider expiry | Wording of deletion promise | Counsel item |
| PR-21 | Product analytics | Pseudonymous events | `docs/ANALYTICS-EVENTS.md` (only 3 server marks) | `[DECIDE]` | `[DECIDE]` | Opt-out | Confirm what is live |
| PR-22 | Employee/contractor data | Workforce | not in repo | `[DECIDE]` | | | Out of product scope; counsel item |
| PR-23 | Device-only local data | Users: notes, drafts, caches | local persistence in `app/src` | User-held | User/device | Excluded from server export | State plainly in notices |

## 2. Field-to-tier seed map

Tiers per the classification standard (counsel/owner verify; "unclassified = T3" until mapped). Seed only.

| Data element | Proposed tier | Why | Notes |
| --- | --- | --- | --- |
| Email, display name | `[T-verify]` personal identifier tier | Identifies a person | Public handle vs. real name distinction |
| Date of birth / age band | Higher tier | Drives minors handling | Prefer band |
| Institution id, role | Personal / institution-controlled | Reveals affiliation | |
| Course titles, deadlines, tasks | Student-private personal | User-created | Default private |
| Notes, drafts, documents | Student-private personal | Content may contain anything | Treat as high sensitivity by default |
| Grades, transcripts, holds | Education-record tier | Institution-controlled | Counsel B2 |
| Accommodation data | Highest sensitive tier | Health-adjacent | Minimize offline cache |
| Billing status, processor ids | Financial-adjacent | No card numbers stored | Verify |
| AI prompts and outputs | Same tier as the most sensitive input | Users paste anything | Retention per provider |
| Messages, community posts, media | Personal, third-party content | Others' data inside | Moderation access |
| Guardian relationship, consent scopes | Personal, sensitive-relationship | Minors | |
| Device tokens, IP, user agent | Security/telemetry | Linkable | Short retention |
| Audit events | Security-sensitive | Immutable | Counsel on erasure |
| Support attachments | High (unknown content) | | Redaction |
| Lead form data | Personal, prospect | | |

Next step for the data owner: reconcile this against the generated inventory so every table column carries a tier (tracked as a gap in `PRIVACY-OPERATIONS-PACK-DRAFT.md`). A reconciliation check could become a test later; none exists today.

## 3. Verification checklist before a row moves to the trust register

- Table/function citations exist (the trust test checks backticked paths).
- Owner states: is it live, behind a flag, or a plan?
- Each `[DECIDE]` has a queue row or decision record.
- No sentence implies compliance, certification or completeness.

## Activation blockers

Facts unverified by owners; roles, bases, retention open; no jurisdiction register; no production reconciliation.
