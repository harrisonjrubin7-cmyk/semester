# 01 · Processing register and lifecycle controls

**Status `DESIGNED`. 4 October 2026, `origin/main` at `8e9b746`. Owner: privacy seat (vacant; interim Harrison Rubin).**

> Not legal advice. **Controller/processor roles, lawful bases and the applicability of any statute are [COUNSEL REQUIRED]** and are shown only as the assumption the code makes. This register supplements, and does not replace, [`trust/PERSONAL-DATA-PROCESSING-REGISTER.md`](../trust/PERSONAL-DATA-PROCESSING-REGISTER.md) (7 candidate rows, all `[TBD]`) and the per-table schedule in [`RETENTION.md`](../../RETENTION.md). **Where a retention period here differs from `RETENTION.md`, that file wins and this one is wrong.**

## How to read it

- **Classes** use the repository's T0–T6 scale (`app/src/lib/integration/classification.ts`; standard in [`trust/DATA-CLASSIFICATION-STANDARD.md`](../trust/DATA-CLASSIFICATION-STANDARD.md)). The class on each row is a *proposal* by this pack, to be confirmed by the data owner.
- **Role (assumed):** `S` = Semester decides purpose and means; `I` = the institution directs and Semester operates; `U` = the student directs (own account, own key). The code and `SUBPROCESSORS.md` already make this three-way split; whether it holds in law is **[CR]**.
- **Complete?** The register is a working register. It is complete only when reconciled to the production database; no such reconciliation has been done.

## A. The register

| # | Activity | Data (proposed class) | Role | Recipients | Retention (per `RETENTION.md` unless noted) | Erase / export | Open item |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Account and sign-in | email, auth records, provider identities (T2) | S | Supabase; Google/Microsoft/Apple when the student chooses | Life of account; sign-ups never confirmed: 30 days | Erased with account; `auth.users` stripped record in export | Dormant-but-used accounts are kept forever by design; confirm with counsel **[CR]** |
| 2 | Age declaration | birth date read once and discarded; `minor_until` / `under_minimum`, source (T2) | S | Supabase (`private.account_ages`) | Life of account | Erased; in export map | Self-declared only; a post-hoc under-13 statement marks the account but does not delete it (see 8-C6) **[CR]** |
| 3 | Student workspace sync (notes, tasks, courses, study) | student-authored content (T2) | S | Supabase | Never aged out; tombstones 90 days | Export: `export_my_data()`; erased with account | Device-only files (IndexedDB attachments, drafts) are outside the server export (G-05) |
| 4 | AI, Semester's key | the request text, which can include a syllabus or notes (T2; T3+ must not be sent) | S | Supabase function → Anthropic | Per-account usage counters; tenant `ai_policy.retention_days` for metadata | Chat threads are device-held; `ai_memories` is synced and erased with account | No class check at AI runtime (8-C7); provider terms not signed (D-147); shared key off until activation rows exist |
| 5 | AI, student's own key | the request, sent from the browser | U | Anthropic / OpenAI, directly | Not held by Semester | n/a | Disclosure wording only |
| 6 | AI, institution gateway | request plus approved sources (≤ tenant's allowed class) | I | Vercel gateway → OpenAI (institution-approved) | Review 1 day after expiry if unconfirmed, 90 days if completed; audit 180 days | Gateway journals use a pseudonymous id, so they are **not** in the subject's export | Pseudonym is unsalted SHA-256 (8-C8) |
| 7 | Institution identity and provisioning (SSO, SCIM) | name, email, role, affiliation (T2–T3) | I | Supabase | Provisioning audit 3 years | Institution records are in `KEPT_TABLES`; the student link is cleared | Who answers a student's request about an institution-held record **[CR]** |
| 8 | LTI launch and score return | launch claims; a score for a graded link (T3) | I | Supabase; the institution's LMS | Nonces 1 hour after expiry | Per source, not yet verified | Per-source purge logic designed, not verified |
| 9 | Institution record feeds (integration pipeline, academic records, student account entries) | education records (T3) | I | Supabase | Runs/errors 180 days, events 30, dead letters 90; reconciliation tables **no purge** | Kept as the school's record | FERPA role and the right to inspect **[CR]**; reconciliation tables lack a sweep |
| 10 | Student-directed connections (Google, Microsoft, Zoom, Canvas/ICS) | whatever the student's own account returns, read in the browser; relayed host + token for Canvas/ICS | U | the named provider | Not held except what the student saves | Revocation stops the next sync and deletes nothing by itself | State this plainly in the control (06) |
| 11 | Guardian links (K-12 edition, 13+) | relationship, rights, verifier, restrictions incl. court-order flag (T3–T4) | S/I | Supabase | Links ended, never removed; history immutable | Both ends' erasure ends the link; restriction record may leak into export (8-C4) | Guardian consent approach (COPPA-5/KG-02) not started; counsel memo (COPPA-4) not started **[CR]** |
| 12 | Family / supporter sharing (adult student) | named items the student chooses to share (T2) | S | Supabase | Invite 7 days unclaimed; grant ≤ 200 days | Revocation is permanent; reads are logged to the student | Bearer-code claim, no check of who claims |
| 13 | Advisor and support shares; support access | learning-progress aggregate (T2) | S | Supabase | Grants ≤ 7 days; `support_access_event` kept as long as the student's records | `forget_my_support_access()` on erasure | No screen shows the student their support-access history |
| 14 | Community, reports, moderation, safety | posts, reports, cases, safety deltas (T2–T4) | S | Supabase | Reports 90 days; cases 90 days / 1 year; safety entries 1 year | Three columns deliberately withheld from export; posts a case holds are withdrawn, not deleted | Appeal and "student gets a sentence, not the number" wording **[CR]** |
| 15 | Rights requests and receipts | request kind, detail ≤ 1,000 chars, status (T2) | S | Supabase | With the account; receipts keep counts only | Deleted with account | No answering surface (02); no clock of its own |
| 16 | Audit and security logging | pseudonymised actor/object, action, outcome (T2) | S | Supabase | 3 years; `access_log` 90 days; console and support-access audit never swept | Not exported (no FK by design) | Unsalted pseudonyms can be re-derived by anyone holding the UUID |
| 17 | Product activity marks | three marks, one per account per day (T2) | S | Supabase | 400 days | Erased with account | `ANALYTICS-PLAN.md` describes a larger funnel the code does not send; reconcile (08-B8) |
| 18 | Billing | email, plan, Stripe customer/subscription ids; never card data (T2) | S | Stripe | Financial records 7 years after year-end | Kept for the 7 years; identity handling on erasure **[CR]** | Inactive until keys are set |
| 19 | Company-site lead forms | name, work email, organisation, role, message, page, UTM/referrer, salted IP hash (T2) | S | Supabase (`site_leads`); Resend | **None: `site_leads` has no retention period** | No intake path for a non-account person | Highest-priority gap; lead-form notice **[CR]** |
| 20 | Newsletter, marketing consent, GTM events | email, consent log (`gtm_consent`), `gtm_*` events (T2) | S | Supabase; no sender or vendor approved | `gtm_*` events: no purge | Consent log is append-only; erasure semantics **[CR]** | No preference centre; marketing consent law **[CR]** |
| 21 | Trust-room NDA requests | requester name, email, organisation (T2) | S | Supabase | Not stated in `RETENTION.md` summary | Non-account requester | Add a row and a period |
| 22 | Support tickets and email notices | ticket text, email, reference (T2; may include T3–T4 if the person writes it) | S | Supabase; Resend | Closed tickets: no purge | `forget_my_support_tickets()` on erasure | Contact is a personal mailbox; dedicated address **[CR]** |
| 23 | Push notifications | device subscription, encrypted payload (T2) | U/S | Browser vendor's push service | Until sent, or two consecutive failures | Erased with account | Cron parked per `scheduler.sql` |
| 24 | Career, mentor and employer visibility | profile, portfolio, applications (T2) | S | Supabase; employers only through a student's choice | Student work never aged out | Erased with account | No employer-sharing privacy doc; employer data sharing **[CR]**; minors excluded in code |

Not in the register because **not built**: marketplace orders and payouts, alumni network, PIA-owed surfaces (Community in full, school records, Course Studio, LTI, Transfer/Career/Basic-Needs, support access). Each needs a row *before* it ships (04).

## B. Lifecycle control matrix (what each control actually is today)

| Control | Mechanism | State | Proven by | Gap |
| --- | --- | --- | --- | --- |
| Classification | T0–T6; DB `data_classification_rules`; `source_records` accepts T0–T3 only | Enforced on the integration path | `integration-control-plane.check.sql` | **Not enforced at AI runtime**; flag evaluator's `ctx.classification` has no production caller |
| Retention | pg_cron sweeps, write-time pruning, check constraints | Enforced where listed | `retention.test.ts` (doc ↔ schema), sweep `*.check.sql` | `domain_outbox_*`, `integration_reconciliation_*`, `gtm_*`, `site_leads`, closed `support_tickets`, `capture_asset` storage objects |
| Deletion | `delete-account` → `erase_account()` in one transaction; refuses on hold | Enforced | `deletion.check.sql`, `legal-holds.check.sql`, 2026-09-30 synthetic drill | Staff who wrote four append-only history tables cannot be erased (fails closed); JSON snapshots (8-C5) |
| Backups | Provider daily, 7-day expiry | **Unverified** | none | 7 days is plan-tier documentation, not read off the dashboard; no restore drill; D-124 **[CR]** |
| Export | `export_my_data()`; catalog-driven map | Enforced | `deletion.check.sql` | Device files; AI context; guardian-restriction leak (8-C4) |
| Legal hold | `legal_holds`; blocks erasure and purge | Enforced in DB | `legal-holds.check.sql` | No screen, no runbook, no `privacy.hold_*` audit event |
| Consent | `consent_record`; `gtm_consent` | Partial | `*.check.sql` per capability | `policy_version` is a free label; no policy-text store; no recorded FERPA exception; shares write no `consent_record` |
| Audit | `audit_event`, immutable, 3-year sweep | Enforced | `audit-and-subject-requests.check.sql` | Only two `privacy.*` actions exist |

## C. Minors and guardians: one control matrix

Currently spread across `guardian-data-model.md`, the K-12 register, `SUPPORTER-FAMILY-PRIVACY-MODEL.md` and the age migration.

| Population | What the code does | What it does not do | Counsel |
| --- | --- | --- | --- |
| Under 13 | Sign-up with a birth date under 13 is refused | A later self-statement marks the account `under_minimum` and withdraws it from rosters; it does not delete | **[CR]** whether that is acceptable |
| 13–17 (minor) | Excluded from discovery, matching, messaging, employer view, mentor and connection requests; can still report and share with a guardian | Age is self-declared; no district roster source | **[CR]** age floor, consent model |
| No stated age | "Not cleared" and kept out of everything a minor is kept out of until `state_my_age` (once) | n/a | n/a |
| Guardian of a minor | Link verified by school staff only (`guardians:manage`), K-12 school, minor student, age-cleared guardian; ended, never removed; stops at 18 at query time | `guardian_may_read` is unused: **a guardian can read nothing but their own link row**; no portal (K12-003); staff vouching has no evidence mechanism | **[CR]** guardian consent, record-access rights |
| Supporter of an adult | Student-minted 8-character code, 7 days, single use, named items, per-read log | Claimant identity is not checked | **[CR]** whether code possession suffices |

Owner decision recorded elsewhere and not reopened here: minimum age 13 (D-139). `docs/legal/PRIVACY-POLICY-DRAFT.md` §8 still says "[DECIDE: 13 or 18]"; reconcile (08-B5).

## D. Cadence

| Activity | Frequency | Owner |
| --- | --- | --- |
| Reconcile register rows to `RETENTION.md` and the generated inventory | On every migration that adds a table (the test already forces a `RETENTION.md` row; this adds the register row) | Engineer on the PR, reviewed by privacy seat |
| Reconcile repository to production schema | Quarterly, dated, filed as evidence | Privacy seat with engineering |
| Re-check classification of each row | When a field is added | Data owner |
| Confirm backup expiry from the provider dashboard | Once now, then at each plan change | Operations |
