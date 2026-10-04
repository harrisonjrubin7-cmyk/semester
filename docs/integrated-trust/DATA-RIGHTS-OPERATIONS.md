# Data-subject rights, consent, retention, deletion and legal holds: operating procedure

Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

**Status: the data layer is built and tested; the operating layer is not.** A person can raise an export, correction, restriction or erasure request from the app. The database records it, walks a catalogue-derived map of every account column to export or erase, refuses to erase a held account, and exempts a stated list of records. **Nothing handles a request after it is raised**: no identity verification step, no status change, no assignment, no overdue monitor, no operator screen. The privacy owner does not exist as a staffed role (outside counsel holds the privacy seat for terms, not for the queue). The thirty-day due date is a placeholder with no legal analysis behind it. This procedure is what the operating layer must do; it labels each step as built, interim or to be built.

Everything about what the law requires — which regimes apply to which student, how long a clock runs, what may be refused, when a guardian or an institution is the right requester, what must be kept — *requires qualified human counsel review* and is queued in `LEGAL-REVIEW-QUEUE.md`. This document does not state it. It states how the work is done once counsel has.

## 1. Who may ask, and through whom

| Requester | Route | Rule | Built |
| --- | --- | --- | --- |
| The account holder | "Privacy and your rights" in the app (`DataRightsRequests.tsx`, `raise_my_data_subject_request`) | The subject and tenant come from the session, never from the form | Yes |
| A guardian of a minor | Institution-mediated; the request is recorded with `requested_by = guardian` | Not acted on until `verified_at` is set by a person | Column only |
| The institution (a school official) | Through the tenant administrator, recorded as `requested_by = institution` | Education records belong to the institution's control; the request is routed to the institution, not fulfilled by Semester alone (requires qualified human counsel review) | Column only |
| Anyone else (an email, a letter, a social message) | A single intake address | Never fulfilled directly; the requester is told how to use the in-app route or the institution route | No address |

## 2. The states

`received` → `verifying` → `in_progress` → `completed`, or `refused`. A request is never deleted. The row carries `due_at`, `requested_by`, `verified_at` and the account's tenant.

**Interim until RM-20 builds the operator surface.** The queue is read by a named privacy owner each business day (there is none; the founder does it, and writes down that the founder did). A status change is a service-role statement reviewed by a second person before it runs, with an `audit_event` row written alongside it by hand. This is a stopgap that is stated here so it is not mistaken for the design.

**To be built (RM-20).** A service-role function and console screen that: verifies; assigns; moves status along the allowed transitions only; refuses `completed` without a recorded outcome; refuses `in_progress` for a guardian or institution request that has no `verified_at`; writes the audit event in the same transaction; and raises an alert at seven days to due, two days to due, and overdue, routed to the privacy owner and the incident commander. The check suite gains the transitions and the alert.

## 3. Identity verification

1. **The account holder, signed in.** The session is the verification for an export or a correction of their own account. For erasure, require fresh authentication within fifteen minutes (a re-sign-in), so a stolen session cannot erase an account.
2. **Anyone else.** Ask for what the institution can confirm, through the institution; never ask for a password, a multi-factor code, a full government identifier or a payment number. Do not accept a photograph of an identity document by email.
3. **A guardian.** The relationship is a verified link (`guardian_links`) created by institution staff; a request without one waits.
4. Record how the requester was verified (method and who), not the document.
5. A request that cannot be verified is refused in writing with the reason and the route to try again. The refusal is a recorded state, not silence.

## 4. Fulfilment, by kind

### 4.1 Export (access and portability)

- **What exists.** `export_my_data()` walks `private.account_data_map()` (191 mapped columns on 30 September), returns one JSON file, and records the export. It withholds three categories and names them in the file: blocks others placed on the person, reports others filed about them, and per-case safety scores. Per-feature exports exist (CSV, Markdown, calendar).
- **What does not.** Device-only content (attachments and drafts in browser storage); a single full-account file that includes it (RM-45); a signed, expiring delivery channel; an accessibility review of the formats.
- **Procedure.** The in-app export is self-service and immediate. A request that asks for more than the file holds (for example material about the person that belongs to a school) is routed to the institution. The exported file is generated on demand and not stored on the server.
- **Check.** `supabase/deletion.check.sql` fails when a new table that references an account is not in the map.

### 4.2 Correction

Profile fields and student-entered data are corrected by the student. A record that comes from the institution is corrected at the source, and the request is forwarded; Semester does not amend an official record on request. Where a correction is accepted, the history is kept, not overwritten.

### 4.3 Restriction

Recorded, and applied by the privacy owner to the fields or uses named. There is no technical restriction primitive today; a restriction is honoured by process and noted on the row. Building one is a design decision for counsel and the data seat.

### 4.4 Erasure

1. Check for a **legal hold** on the account, its tenant or the platform. If one exists, `erase_account` refuses (error 55006) before touching a row, and a trigger on the auth user table is the backstop. The student is told it is not a fault and is not told why. The request moves to `in_progress` with a note and waits for the release.
2. Check for **records the institution controls** (grades in an official ledger, financial records inside their retention period). They stay; the student is told which kinds stay and why in plain words.
3. Run the **delete-account function** with the requester's verified session, which calls `erase_account` and then removes the auth user, all in one transaction.
4. **What it keeps, on purpose.** Messages in other people's threads (they show a gap); a report the person filed, with the reporter cleared; posts held by an open moderation case, withdrawn and re-attributed to "Deleted account"; moderator decisions; the `data_requests` row with the user cleared; financial records for seven years after their year; the support-access log (FERPA recordkeeping); school offboarding records and holds; known-abuse media; the console audit chain. Each is listed in `RETENTION.md`; the periods are not approved by counsel.
5. **A known limit.** Four history tables refuse updates, so a staff account that wrote to them cannot be erased; the function fails closed. Resolve by a decision on those tables, not by loosening the refusal.
6. **After.** Record the outcome on the request. Tell the requester what was removed and what was kept, and that provider backups age out on the provider's schedule (documented as seven days, not read from the dashboard) and that a restore could briefly bring a deleted row back, because there is deliberately no deletion ledger (D-124, which counsel may reopen).
7. **Providers.** The model, payment, email and hosting providers hold copies under their own terms. No propagation procedure or evidence exists (RM-22). Until it does, the notice says so.

## 5. Consent

| What | Where it lives | Gap |
| --- | --- | --- |
| Capability consent (per capability and policy version) | `consent_record` | The preference record fields in the consent spec are all to be decided |
| Sharing with an advisor, supporter or family member | `advisor_shares`, `support_shares`, `support_access_grant`, `family_grants` | No purpose, legal basis, signature method or revocation reason; a revoked share can be deleted by the student; reads log reader and time only (RM-24) |
| A guardian of a minor | `guardian_links`; parental consent (COPPA) | Parental consent has not begun counsel review |
| Marketing | `gtm_consent` (append-only, versioned) | Sending is off; the draft consent text is unapproved |
| AI training | None needed: no training on student content by default | A policy with no technical control and no signed provider terms |
| Capture assets | `capture_asset` tied to `consent_record` | Withdrawal makes derivatives unreadable but does not physically delete rows |
| Cookies and storage | A specification only | No implementation |

**Rule.** An authenticated action is not a signature. Where a share or a disclosure needs consent, the record states who consented, to whom, for what purpose, on what basis, with what text, when, and until when, and a revocation is kept even if the share row is removed.

## 6. Retention

The schedule is `RETENTION.md`, tripwired both ways against the schema (`retention.test.ts`). The principles are the load-bearing ones and are not changed by this document:

- **Student work is never aged out.** Notes, courses, tasks and state stay until the student deletes them.
- **Operational logs** are short (access log 90 days; gateway audit and intelligence audit 180 days; rate-limit rows one day).
- **Audit records** are three years; the console audit chain is never swept.
- **Financial records** are seven years after the end of their year, by a monthly purge.
- **Moderation records** are tied to closure and enforcement: ninety days for no action, a year after enforcement or an appeal decision.
- **Gaps with no clock yet:** outbox events, closed support tickets, roster imports, student-account ledgers, `domain_outbox_events`. Counsel approves the periods; until then each is kept and listed.

## 7. Legal holds

- **Placing.** A `hold:place` capability holder places a hold over their own school; the platform service role places a platform hold. A hold needs a reason and a matter reference.
- **Effect.** It blocks erasure and every retention sweep in scope.
- **Releasing.** A different person holding `hold:release`, enforced by a constraint. A hold is never edited except to record its release and never deleted.
- **Gaps.** Provider backup expiry is not suspended by a hold; the monthly financial purge is not stated as hold-gated; device deletion is outside it; escalation deliveries and volunteer events carry no account and are covered only by the platform gate (RM-23).
- **The procedure** is a draft with every field to be decided (`docs/legal-drafts/LEGAL-HOLD-PROCEDURE-DRAFT.md`; requires qualified human counsel review).

## 8. Offboarding a school

A school row is never deleted (a trigger refuses it for every role, because 125 tenant tables cascade). The eight-step case is: propose, preflight, approve by the other side, record the notice, disable access, record and verify the export by two operators, archive for at least thirty days (default ninety, a placeholder), authorize the purge. The purge, the export generator, the notice and any screen are not built; a live hold blocks purge eligibility.

## 9. Rehearsal and evidence

- **Quarterly:** two synthetic accounts in two tenants; one request of each kind through the operator surface; one held account; one guardian request; the overdue alerts. The record goes under `docs/evidence/privacy/` with the date (exercise TT-06 is the first).
- **The erasure drill of 30 September** ran inside a rolled-back block against production with the owner's written approval: 191 columns checked, no rows left. It did **not** cover the delete-account function end to end, storage objects, a held account, community or media content, backups, provider propagation, the operator workflow or an actual dated request-to-closure case (RM-08).
- **Measures to report monthly** once the surface exists: requests received, by kind; median and longest time to completion; requests past due; refusals and their reasons; holds blocking requests; failures of the erasure function.

## 10. Roles

| Role | Does | Seat | Today |
| --- | --- | --- | --- |
| Privacy owner | Runs the queue; verifies; decides refusals with counsel | privacy | Outside counsel holds the seat for terms; no one runs the queue |
| Data steward | Runs exports and erasure with a second person | data | **Vacant** |
| Counsel | Decides what law requires, what may be refused, what may be disclosed | privacy (outside counsel) | Held |
| Second reviewer | Reviews every status change and every erasure before it runs | any other seat | Unassigned |
