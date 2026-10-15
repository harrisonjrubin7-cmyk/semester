> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Subject-rights request operating kit — template

- **Owner/backup:** `[TBD role]` / `[TBD role]`
- **Version/effective date:** 0.1, not in effect
- **Approval authority:** qualified counsel plus the authorized company decision-maker
- **Builds on:** `docs/DATA-RIGHTS-REQUEST-RUNBOOK.md` (queue, escalation, rehearsal), `docs/legal-drafts/DATA-SUBJECT-REQUEST-PROCEDURE-DRAFT.md`, the `data_subject_request` table (has `verified_at` and an internal due date). This kit adds what those lack.

## Plain-language summary

Intake → verify who is asking → decide scope → fulfil or refuse with a reason → record evidence. Nobody acts on an account until the requester is verified. Refusals are explained and reviewed by counsel until a catalogue is approved. The internal due date is a queue marker, not a promise.

## 1. Request types

| Type | Product path today | Gap |
| --- | --- | --- |
| Access / copy | `export_my_data()`, `Export.tsx` | Device-only data and non-public tables excluded; no manifest |
| Correction | In-app edit; institution-verified fields via the institution | Dispute workflow for academic record |
| Deletion / erasure | `delete-account` → `erase_account()` (hold-aware, fails closed for staff who wrote immutable history) | Vendor propagation; backup tail wording |
| Restriction / objection / opt-out | Preference screens in `Privacy.tsx` | Mapping to specific processing activities |
| Portability | Export | Machine-readable manifest |
| Consent withdrawal | Per-feature toggles; guardian revoke | Evidence of withdrawal propagation |
| Institution-originated (school asks on behalf of a student/class) | None built | Whole procedure (§6) |
| Guardian-originated | None built | Whole procedure (§6) |
| Authority/law-enforcement | `LAW-ENFORCEMENT-REQUEST-PROCEDURE-DRAFT.md` | Out of scope here |

**COUNSEL-REQUIRED:** which of these types Semester must honor, for which users, as which role (own account holder vs. provider acting for an institution).

## 2. Intake

1. Channels: in-app request (preferred), the support address in `app/src/lib/privacy.ts`, institution contact. `[DECIDE]` whether postal or phone channels are offered.
2. Every request, from any channel, is entered in the `data_subject_request` table the same day. Record: received-at, channel, claimed identity, request type, requested scope, institution (if any), minor/guardian flag.
3. Send the **Acknowledgement** (§8-A). Do not state a completion time unless counsel has approved one.
4. Triage flags that change handling: minor or possible minor, open legal hold, open security incident, open dispute/chargeback, law-enforcement contact, repeated/excessive requests, request via a third party.

## 3. Identity verification matrix

Principle: verify with what the requester can already prove; ask for the least additional data; never ask for a government ID by default; never store ID images longer than needed to decide `[DECIDE retention]`.

| Situation | Minimum verification | Do not |
| --- | --- | --- |
| Requester is signed in to the account (session less than `[N]` min old or re-authenticated) | Session + fresh re-authentication (passkey/MFA/password) | Ask for ID |
| Requester writes from the account email, no session | Confirmation link to the account email + one account-knowledge check (e.g. last sign-in month, institution) | Act on the email alone |
| Requester writes from a different email | Treat as unverified. Reply to the account email only: "a request was made; confirm it" | Disclose whether an account exists |
| Institution-linked account (SSO) | Re-authenticate via the institution identity provider, or institution contact confirms in writing | Bypass the institution for institution-owned records |
| Guardian for a minor | See §6 | Accept a bare claim of parenthood |
| Authorized agent | Signed authorization from the account holder plus the holder's verification | Accept agent claim alone |
| Deceased/incapacitated user | Escalate. **COUNSEL-REQUIRED** | Fulfil from a family member's email |

Failed verification: one retry, then close as "unable to verify", tell the requester what would suffice, log it. Suspected fraud/takeover → hand to the security incident workflow (`SECURITY.md`).

## 4. Scoping and fulfilment

| Step | Check | Evidence |
| --- | --- | --- |
| 1 Scope | Inventory lookup (`docs/DATA-INVENTORY-AND-LINEAGE.md`) plus device-only data, vendors, backups | Scope note in log |
| 2 Holds | Query holds (`legal_holds`). If held, do not delete; follow the exception row (§5) | Hold id (not matter details) in log |
| 3 Other people's data | Redact third-party personal data in exports; check shared spaces, messages, group work | Redaction note |
| 4 Execute | Use the product path in §1; for gaps, a manual procedure approved by counsel | Function-call record / ticket |
| 5 Propagate | Notify vendors holding the data per `VENDOR-PRIVACY-REVIEW-TEMPLATE.md` §4 | Vendor confirmation or outstanding list |
| 6 Second check | A second person (or the requester's own re-export) confirms result | Reviewer role + date |
| 7 Respond | Fulfilment or refusal message (§8-B/C) via the verified channel | Sent copy |
| 8 Close | Update the table; add the log row; sample for the quarterly review | Log row |

Delivery of exports: authenticated download from the account, or a time-limited link to the verified address. Never attach personal data to an email.

## 5. Exception and refusal catalogue (draft — counsel approves each row)

| Code | Situation | Draft handling | Needs counsel |
| --- | --- | --- | --- |
| X1 | Legal hold on the data | Do not delete; tell the requester the data is preserved under a legal obligation without matter detail | Yes |
| X2 | Record the institution must keep (academic record, financial ledger) | Route to the institution; Semester removes only what it controls | Yes |
| X3 | Staff who wrote to immutable history tables | Erasure fails closed by design; explain what is and is not removed | Yes |
| X4 | Data about another person | Redact; fulfil the rest | Yes |
| X5 | Security or fraud-prevention need | Retain the minimum for the shortest `[DECIDE]` period | Yes |
| X6 | Backup tail | State that copies expire on the provider schedule in `RETENTION.md`; do not claim immediate removal | Yes (wording) |
| X7 | Unverifiable identity | Close per §3 | No |
| X8 | Manifestly unfounded or excessive | Escalate to counsel before refusing or charging | Yes |
| X9 | Request outside the user's rights as determined by role/jurisdiction | Counsel decision only | Yes |

Every refusal states the reason in plain language, what the requester can still do, and how to contact `[support address]`. **COUNSEL-REQUIRED:** whether to state an appeal route and to which regulator.

## 6. Guardian- and institution-originated requests

Rule: **do not act until verified.** Until counsel answers B4 and the minors questions in `MINORS-AND-GUARDIAN-OPERATIONS-DRAFT.md`, these requests are acknowledged and escalated, not fulfilled.

| Origin | Verify | Scope limit |
| --- | --- | --- |
| Guardian of a minor | Existing verified guardian link and consent record (`k12_guardians`); else escalate | Only what the link's scope allows; never the minor's private productivity content by default |
| Parent of an adult student | Treat as a third party; route to the student | None without the student's consent or counsel determination |
| Institution officer | Written request from the institution's designated contact on file; role checked against the contract | Only records the institution controls; student-private content stays private |
| School offboarding | `docs/SCHOOL-OFFBOARDING.md` process | Per-school departure terms are counsel item A1 |

## 7. Jurisdiction clock table (placeholder)

Nothing below is a determination. Counsel fills every cell.

| Regime / source | Applies to Semester? | Acknowledge by | Respond by | Extension rule | Source cited by counsel |
| --- | --- | --- | --- | --- | --- |
| `[DECIDE]` U.S. education-record rules | `[DECIDE]` | `[DECIDE]` | `[DECIDE]` | `[DECIDE]` | `[DECIDE]` |
| `[DECIDE]` U.S. children's-privacy rules | `[DECIDE]` | | | | |
| `[DECIDE]` Tennessee and other state law | `[DECIDE]` | | | | |
| `[DECIDE]` EU/UK (only if offered) | `[DECIDE]` | | | | |
| `[DECIDE]` Contract (DPA/addendum) clocks | `[DECIDE]` | | | | |

Until filled, the only clock in use is the internal queue marker.

## 8. Message templates (skeletons; counsel approves wording before use)

**A. Acknowledgement.** "We received your request on `[date]` (reference `[id]`). Before we act, we need to confirm it's you: `[verification step]`. We'll tell you what we find. Questions: `[support address]`."

**B. Fulfilment.** "Your `[type]` request (`[id]`) is complete. `[What was done and where to find it.]` `[Anything retained, why, and for how long — see exceptions.]` `[Provider copies expire on their schedule; see retention page.]`"

**C. Refusal or partial.** "We couldn't fully complete your `[type]` request (`[id]`). `[Plain reason from the catalogue.]` You can still `[alternatives]`. `[Appeal/complaint route — counsel decision.]`"

**D. Unable to verify.** "We couldn't confirm your identity for request `[id]`. To proceed, `[what would suffice]`. We haven't shared or changed anything."

**E. Institution/guardian holding notice.** "We received a request relating to a student account. We can't act on it until `[verification]`. We haven't disclosed whether an account exists."

## 9. Request log (one row per request; keep in the restricted privacy records store, see the pack's Evidence handling; never in the repo)

| Field | Value |
| --- | --- |
| Request id (matches `data_subject_request`) | |
| Received / acknowledged / verified / completed dates | |
| Channel and origin (self, guardian, institution, agent) | |
| Type and scope | |
| Flags (minor, hold, incident, dispute, LE) | |
| Verification method and outcome | |
| Systems and vendors touched; propagation status | |
| Exceptions applied (X-codes) | |
| Outcome (fulfilled / partial / refused / unable to verify) | |
| Operator and second reviewer (role) | |
| Counsel consulted (yes/no, date, decision ref) | |
| Lessons / defects raised | |

Retention of the log itself: `[DECIDE]` (counsel) — keep the minimum personal data, hash or id references rather than content.

## 10. Audit and rehearsal

- Monthly: sample `[N]` closed requests; check every row has verification, second review and a sent message.
- Ageing report: open requests past the internal marker are reviewed weekly; a miss is logged and, if it could be a statutory miss, raised to counsel and linked in the breach worksheet only if personal data was exposed.
- Quarterly rehearsal per the runbook: one access, one erasure on a test account, one guardian-originated, one with a hold. Save results as a dated, personal-data-free record under `docs/evidence/privacy/` with an evidence-register entry (see the pack's Evidence handling).
- Metrics (no personal data): volume by type, median and 90th-percentile time to verify and to close, refusal rate by code, verification-failure rate.

## Product-behavior mapping and gaps

| Needed | State |
| --- | --- |
| Operator screen for the queue | Not built |
| Named owner and backup | None |
| Full-archive export with manifest | Not built |
| Vendor propagation | No procedure (see vendor template) |
| Live deletion/DSR test suites executed | Not on the last validation host |

## Activation blockers

Counsel approval of §1, §5, §7 and §8; a named owner; an operator screen; one executed rehearsal filed and registered as evidence.
