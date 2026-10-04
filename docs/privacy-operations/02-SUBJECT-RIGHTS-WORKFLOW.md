# 02 · Subject-rights workflow

**Status `DESIGNED`. 4 October 2026. Owner: privacy seat (vacant).**

> Not legal advice. **Which rights exist, for whom, on what clock, and what may be refused are [COUNSEL REQUIRED].** This document is the *operating procedure* and the list of what must exist before a response time is stated. It extends [`DATA-RIGHTS-REQUEST-RUNBOOK.md`](../DATA-RIGHTS-REQUEST-RUNBOOK.md), which stays the authority for the daily queue and escalation; where they differ, fix this file.

## 0. What exists and what does not (so no one assumes)

| Piece | State |
| --- | --- |
| Student files and tracks a request | **Built.** `raise_my_data_subject_request(kind, detail)`; screen `DataRightsRequests.tsx`. Idempotent per kind; 30-day `due_at` is a column default and nothing else |
| Anything that **answers** a request | **Does not exist.** No UI, function or RPC updates `data_subject_request`; the only route is SQL as `service_role`. The runbook's "trusted operations service" is not in the repository |
| `verified_at` | Column only; no setter |
| Guardian or institution requests | Values exist in the check constraint; **no producer** |
| Audit of status changes | **None.** Only `privacy.request_raised` and `privacy.export_completed` exist |
| Overdue alerting | **None** |
| Named answerer, backup, response time | **None** (`COUNSEL-BRIEF.md` C1; RM-06) |
| Older queue `data_requests` | A second queue with a different status vocabulary and a `data_steward` role; no screen. Treat as the **receipt ledger**, not a queue, until a decision retires one (08-B13) |

**Rule until the surface exists:** do not publish, say or imply any response time. A request filed today is answered by hand, off the clock the column shows, and the owner must accept that risk in writing.

## 1. Intake channels

| Requester | Channel | Today | Required before launch |
| --- | --- | --- | --- |
| Account holder, self | In app: Privacy → Your privacy requests | Built | Answering surface |
| Account holder who cannot sign in | Dedicated privacy address | **Personal mailbox only** | Dedicated address **[CR]**; manual case opened by the operator, identity per §2 |
| Person with **no account** (site lead, newsletter, trust-room requester, support contact) | Same address; form on the site | **No path.** `site_leads` has no retention and no intake | Case type `NA` (no-account) and a lookup procedure keyed on the email they control |
| Guardian of a minor | Via the school first | No producer | School-mediated procedure **[CR]** |
| Institution on behalf of a student | Institution administrator | No producer | Authority check **[CR]** |
| Authorised agent, lawyer, third party | Address | n/a | Written authority and counsel review before any action **[CR]** |
| Regulator, court, law enforcement | Not a rights request | See legal-hold and law-enforcement drafts | Route to counsel the same day **[CR]** |

## 2. Identity verification: the ladder

Verify the least that settles the case. **Never request a password, a full government identifier, a payment card, or a medical document.**

| Rung | Evidence | Sufficient for |
| --- | --- | --- |
| V0 | Request arrives inside an authenticated session of that account | Access/export, correction, restriction, erasure of that account |
| V1 | Reply from the account's registered email to a one-time confirmation sent by the operator, plus one account fact only the holder would plausibly know (e.g. the month the account was created) | Account holder who cannot sign in; no-account lead or subscriber (against the address in `site_leads`/`gtm_consent`) |
| V2 | V1 plus the institution's own confirmation that the person is enrolled/employed, through a contact the institution gave us in writing | Anything touching institution-held records |
| V3 | School staff confirm the guardian relationship through the existing verified `guardian_links` row; no new document is collected by Semester | Guardian on a K-12 account |
| V4 | Counsel decides | Agent, lawyer, estate, disputed identity, court order |

Record **which rung was used and why**, never the evidence itself. Setting `verified_at` is the proposed trusted action that records the rung (see §8).

## 3. Fulfilment by kind

All steps run as a trusted operator who is **not** the requester. Check the legal-hold state first; a hold changes the answer, it does not silence it.

### Access / export

1. Verify (§2). 2. `export_my_data()` for the subject, through a trusted session. 3. **Check the file before release** for another person's data (guardian restrictions, reports about others) until 8-C4 is closed. 4. Add the withheld notice (`blocks.blocked`, `reports.about`, `community_safety_entries.user_id`) and say device-held files are not included. 5. Release through the app or a one-time link, not by attachment. 6. Record the manifest, not the content.

### Correction

1. Identify the source: **student-entered** (the student can fix it; point them to it), **institution-sourced** (the institution is the source of record; refer, do not alter), **derived/AI** (explain; remove or recompute where Semester controls it). 2. Never edit an academic record on a student's say-so. 3. Tell the requester who holds the record and the route.

### Restriction

No technical restriction mechanism exists. Treat as: stop non-essential processing the operator controls (marketing, AI context), record the scope, and escalate to counsel to define what "restricted" means **[CR]**.

### Erasure

1. Verify. 2. Hold check (`account_is_held()`); a hold returns 55006 and must not be bypassed. 3. Surface what is **kept on purpose** (`KEPT_TABLES` and the Privacy-page explanations: shared threads, financial records for seven years, support-access events, school-owned records). 4. Run the `delete-account` path; do not run SQL deletes by hand. 5. If it fails closed (staff who wrote immutable history, or a refuse-FK), it is an exception (§4), not a retry loop. 6. Confirm sign-in is removed (`signInRemoved`). 7. Tell the requester the 7-day backup tail and that a restore could briefly resurrect data, which is replayed by `RESTORE.md` where possible **[CR]** (D-124).

## 4. Exceptions and refusals

Every refusal names the reason and the appeal route. **No refusal text is final until counsel approves its wording [CR].**

| Code | Situation | What the operator does | Counsel |
| --- | --- | --- | --- |
| X1 | Legal hold on account or tenant | Pause; tell the requester a hold applies without detail; log; notify counsel | Wording of the notice |
| X2 | Another person's record (messages in shared threads, reports, blocks, safety entries) | Withhold that part; say it exists | Standard sentence |
| X3 | Institution-held education record | Refer to the institution; do not alter or delete | **[CR]** school-official role |
| X4 | Financial record inside the 7-year window | Keep; minimise identity where possible | **[CR]** |
| X5 | Staff account tied to immutable history tables | Erasure fails closed; offer deactivation; escalate to engineering | **[CR]** whether anonymising is acceptable |
| X6 | Device-held data | Explain it is on the device; give the on-device export path | None |
| X7 | Manifestly repeated or abusive requests | Do not refuse on the operator's own judgement | **[CR]** |
| X8 | Identity cannot be verified | Say what rung is missing | n/a |
| X9 | Request concerns a minor and the requester is not the minor | Route through the school; V3 | **[CR]** |
| X10 | Backup copy | Explain expiry (7 days, unverified) | **[CR]** |

## 5. Clock (decision pending)

The repository has four different statements: **30 days** (the column and runbook), "do not promise a deadline" (trust runbook, DSR draft, `COUNSEL-BRIEF`), **24 h first response** for privacy (support-policy draft), and "[DECIDE: e.g. 30]" (privacy-policy draft). **Which clock is promised, if any, is [COUNSEL REQUIRED] (queue item P-03).** Until decided: the column's `due_at` is an *internal target only*, never shown to the requester as a promise, and the UI copy must be checked against that (06).

Internal escalation, unchanged from the runbook: due in 7 days → privacy owner and operations review; due in 2 business days → incident commander plans the same day; overdue, misrouted, cross-tenant or unauthorised → stop, preserve, open the incident path ([05](05-PRIVACY-INCIDENT-COORDINATION.md)).

## 6. Downstream propagation checklist

After an erasure or restriction, confirm each place that holds a copy outside the database transaction:

| Place | Action | Owner |
| --- | --- | --- |
| Supabase auth | Removed by `delete-account` | Automatic |
| Stripe | Customer record retained for the financial window; confirm what is deleted vs retained **[CR]** | Finance |
| Resend | Email logs at the provider; confirm retention and request deletion if kept | Operations |
| Anthropic / OpenAI | Only the request in transit; confirm provider retention terms (terms not signed) **[CR]** | Operations |
| Student-directed providers (Google, Microsoft, Zoom) | Not ours; tell the person to revoke at the provider | Operator |
| Backups | 7-day tail | Operator tells requester |
| Institution | Notify if it holds a copy of an export or record | Operator |

## 7. Case-log template (one row per case; keep in the access-controlled queue, not in chat or tickets)

```
case_id:            <data_subject_request.id, or NA-YYYYMMDD-n for no-account>
kind:               export | erasure | correction | restriction | other
requested_by:       self | guardian | institution | agent | no-account
tenant:             <id or none>
received_at / due_at (internal target):
operator (not the requester):
verification rung + date + who:   V0 | V1 | V2 | V3 | V4
hold check:         clear | held (X1)
action taken:       <procedure section>
exceptions applied: X-codes
output:             manifest id / receipt id (no content)
propagation:        §6 rows done
resolution text sent (plain language):
counsel consulted:  yes/no, matter ref
resolved_at / outcome: completed | refused
appeal route stated: yes/no
```

## 8. What must be built (ordered)

1. Name the answerer and a backup; record in the decision log.
2. A trusted function `answer_data_subject_request(id, status, verified_rung, resolution)` (service-role or a dedicated capability), refusing the requester as operator, setting `verified_at`, and writing `privacy.request_status_changed`.
3. An overdue view and alert (due within 7 days / overdue) wired to the health checks.
4. A holds screen and `privacy.hold_placed` / `privacy.hold_released` events.
5. Guardian and institution producers, **after** counsel decides V3/V4 **[CR]**.
6. A no-account intake form on the site and a retention period for `site_leads`.
7. Quarterly rehearsal (two synthetic accounts in two tenants, all four kinds, the exception catalog), filed under `docs/evidence/privacy/` with an `ops/evidence.ts` entry.

## 9. Metrics

Count per month, reported to the privacy seat and never published: requests by kind and requester type; median and maximum days to resolve; share inside the internal target; refusals by X-code; verification rung mix; cases needing counsel; propagation misses. A metric is only reported once the audit event that supports it exists.
