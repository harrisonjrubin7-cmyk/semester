# Offboarding and export

| Control | Value |
| --- | --- |
| Status | **CONTROLLED PROCEDURE — THE DATABASE STEPS EXIST AND HAVE BEEN REHEARSED ONCE BY THEIR AUTHOR; THE EXPORT FILE, THE PURGE AND THE NOTICE ARE NOT BUILT** |
| Owner | Implementation lead seat for the case; two named operators for the export; counsel for disposition |
| Evidence date | 2026-10-04 at `origin/main` `7287ddc` |
| Used in | the exit branch of [phase 10](METHODOLOGY.md#phase-10--optimize); rollout states `offboarding`, `archived` |
| Authority | [`../SCHOOL-OFFBOARDING.md`](../SCHOOL-OFFBOARDING.md) (the eight-step case, full-beta gate G3, [D-1021](../DECISION-LOG.md)) — this document wraps it with the customer-facing process and does not restate or loosen it |
| Also | [`../DATA-PORTABILITY-AND-OFFBOARDING.md`](../DATA-PORTABILITY-AND-OFFBOARDING.md), [`../trust/DATA-EXPORT-STANDARD.md`](../trust/DATA-EXPORT-STANDARD.md), [`../trust/DATA-RETENTION-AND-DELETION-STANDARD.md`](../trust/DATA-RETENTION-AND-DELETION-STANDARD.md), [`../market-readiness/PILOT-OFFBOARDING-PLAYBOOK.md`](../market-readiness/PILOT-OFFBOARDING-PLAYBOOK.md) |

Leaving must be as safe and clear as arriving. A school can walk away with what
is theirs, students keep what is theirs, and nothing is deleted by accident. The
principle behind every step: **a school is never deleted; it leaves through a
case, in steps, and every step but the last is undone by one call.**

## 1. Why a school leaves

| Trigger | Notes |
| --- | --- |
| Non-renewal | renewal outcome `churned`, or `downgraded` with scope removed |
| Pilot end without conversion | the expected path when the value case is not met |
| Customer request / termination for convenience | per the contract; counsel reads it |
| Disqualification or stop decision | an unresolved no-fit, guardrail breach, sponsor withdrawal |
| Risk or non-payment | **payment status never limits data rights**; counsel decides contract remedies |
| Semester stops serving the customer | notice and transition duty per contract |

An honest exit is a valid outcome and is never obstructed: no dark patterns, no
hidden cancellation, no blocked export, no pressure campaign. A customer may
decline further conversation without repeated outreach.

## 2. Roles

| Seat | Does |
| --- | --- |
| Customer executive sponsor | decides to leave; names the school's authority for the case |
| Customer university administrator (`tenant:configure`) | may propose the case; approves an operator-side proposal |
| Semester implementation lead | runs the case; owns the checklist |
| Two Semester operators (distinct people, neither the one who disabled access for the export step) | record and verify the export; disable access; archive; authorize purge eligibility (a third) |
| Security and privacy reviewer | data flow, subprocessors, rights; confirms inventory |
| Counsel | retention length, legal-hold clearance, whether any matter covers the school, whether a departure ends a hold, student-record disposition |
| CSM | customer communication; exit feedback (voluntary) |

Eight steps need up to four different people (proposer, approver, two export
operators, a purge authorizer). Before opening a case, confirm that many people
exist. If they do not, say so to the customer and extend the timeline; do not
collapse a pair.

## 3. Timeline (starting plan; the contract and counsel set real dates)

| When | Step | Owner |
| --- | --- | --- |
| Decision to leave (D) | Exit meeting; confirm authority, effective date, legal-hold position, data and record duties; freeze new enrollment | CSM, IL, counsel |
| D | Open the case (step 1) and take the dependency inventory (step 2) | IL |
| D+? | The other side approves (step 3), a different person | customer admin or operator |
| ≥ 30 days before access ends | **Notice**: students told, in the school's own words, to take their own export (step 4 records that it happened; it sends nothing) | customer comms |
| Effective date | Disable school access (step 5) | operator |
| Within the agreed verification window | Export recorded and verified (step 6); delivered | two operators |
| After verification | Archive with a retention window (step 7; default 90, minimum 30; counsel sets the real length) | operator |
| Window ends | Purge eligibility authorized (step 8) **after counsel confirms no hold**; deletes nothing | a third operator |
| After authorization | Purge — **not built**; see section 7 | — |
| After purge, per provider terms | subprocessor deletion confirmations; backups expire on the disclosed lifecycle | SPR |

## 4. Student continuity (what students keep)

- Students keep their own accounts and sessions; disabling a school's access
  does not touch a student's own session or account, and no record is edited or
  deleted by it.
- Every student can take their data at any time: *Take it with you* (CSV,
  Markdown, calendar, attachments and restorable JSON), the Privacy screen's
  *Download my account data*, and workspace backups.
- Institutional claims about a student (verified records, enrollment-derived
  facts) are the school's to confirm; what happens to them for a *former* student
  is an open decision for counsel and the data owner (see
  [`../CAREER-PORTABILITY-AND-LIFELONG-ACCESS.md`](../CAREER-PORTABILITY-AND-LIFELONG-ACCESS.md)).
  Until decided, claims are shown with their source and date, not as current.
- Notice to students says what is changing, when, what they should export, and
  where to get help — and that taking part in anything is optional.

## 5. The institution export package

The school receives what is theirs and what they need to continue or to audit.
**Each item states whether a generator exists today.**

| # | Item | Contents | Generator today |
| --- | --- | --- | --- |
| 1 | Tenant records | every table's rows for the school; counts match the inventory | **None.** Step 6 *records and verifies* an export made elsewhere; nothing generates the file |
| 2 | Configuration | all published Configuration Studio versions with history | not generated; rows exist |
| 3 | Audit evidence | tenant audit events for the term of the contract | an operator-run extract; no generator |
| 4 | Integration inventory | each connection, scopes, approvals, dates, final state | not generated |
| 5 | Migration records | project, field maps, runs, approvals, archive location | not generated |
| 6 | Support and incident summary | aggregate history, root causes, known issues (no sensitive content) | not generated |
| 7 | Success and EBR records | plan, EBR summaries, decisions | not generated |
| 8 | Contracts and billing | executed paper, invoices, credits | from the finance record |
| 9 | Manifest | file list, row counts per table, SHA-256 of each file, format version, who produced it, when | written by hand today |

**Interim procedure** until a generator exists: operator A produces the files
from the database with a documented, reviewed query set; records
`record_offboarding_export(case, sha256, counts, delivered_to)`; operator B —
a different person — re-derives the counts and calls `verify_offboarding_export`.
Verification refuses an export whose counts differ from the school as it stands,
or that omits any table the inventory found **or any table that holds rows now**
(including one empty at preflight that gained a row). Delivery is over an
encrypted channel the customer named, the customer's receipt is recorded, and
the delivery location is deleted after the customer confirms. A build of the
generator is a product escalation ([`FEEDBACK-AND-ESCALATION.md`](FEEDBACK-AND-ESCALATION.md)), and
`DATA-EXPORT-STANDARD.md` is its specification.

## 6. The case, step by step (wrapper over the eight functions)

Authority is [`../SCHOOL-OFFBOARDING.md`](../SCHOOL-OFFBOARDING.md); this table adds who, evidence and what to
tell the customer.

| # | Function | Who | Evidence to file | Tell the customer |
| --- | --- | --- | --- | --- |
| 1 | `propose_offboarding(school, reason, 'school' \| 'operator')` | school administrator or operator | case id | "A case is open; nothing has been taken away." |
| 2 | `offboarding_preflight(case)` | either side | dependency inventory (tables, rows, members, grants, connections, holds) | the inventory, in plain words |
| 3 | `approve_offboarding(case)` | the **other side, a different person** | approval record | who approved and when |
| 4 | `record_offboarding_notice(case, date)` | either side | notice date and the student notice text sent by the school | it records that students were told; it sends nothing |
| 5 | `disable_school_access(case)` | operator | undo record | grants revoked (each remembered); connections disconnected and credential pointers cleared; sessions of grant-holders ended; rollout suspended; **secrets still need rotating at the provider** |
| 6 | `record_offboarding_export` then `verify_offboarding_export` | two different operators | counts, sha256, delivered_to | the manifest and how to verify it |
| 7 | `archive_school(case, retain_days)` | operator | archive record | the retention window and who decides its end |
| 8 | `authorize_school_purge(case, reason)` | a third operator, after counsel | authorization | "eligible"; it deletes nothing |

`cancel_offboarding` ends a case at steps 1–3. `restore_school(case, reason)`
works from steps 5–7 by an operator other than the one who disabled access; it
refuses after a purge is authorized. `school_purge_eligibility(case)` answers
"why not yet" at any time. Department-, office- and course-scoped grants are
**not** revoked by step 5; list and handle them separately.

## 7. What is not built (state it; never paper over it)

| Gap | Consequence | Interim |
| --- | --- | --- |
| The export generator | the school's file is produced by hand | the interim procedure above |
| **The purge**: category-by-category deletion with confirmation per category | `delete from schools` is refused for everyone, so school data is retained | counsel decides retention; no deletion claim is made |
| Customer and student notification | nothing is sent | the school sends notice; step 4 records it |
| Any offboarding screen | no self-serve for the customer | deliberate: it is a rare contractual event with two named people |
| Deletion confirmation certificate | none to hand over | a signed statement from the implementation lead and operator, listing what was and was not deleted, until the purge exists |
| Offboarding for schools set up before `tenant_rollout` rows existed | the rollout step is skipped | note in the case |

Never promise "your data will be deleted by date X". Promise what the purge-less
state does: the data is archived, access is off, and counsel and the school
decide what happens next.

## 8. Closure checklist

- [ ] Authority and effective date recorded; counsel's legal-hold position on file
- [ ] Case steps 1–7 evidenced; step 8 authorized only after counsel confirmed no hold
- [ ] Export manifest signed for by both operators; the customer confirmed receipt
- [ ] Students told by the school at least 30 days before access ended; the notice text kept
- [ ] **All credentials rotated at their providers**; SCIM and SAML configuration removed on the customer side; connector flags off
- [ ] Support access revoked; open tickets closed or transferred in writing
- [ ] Subprocessors addressed; backups expire per the disclosed lifecycle; exceptions have an owner and date
- [ ] Billing settled, refunds or credits recorded; no obligation left unstated
- [ ] Exit reason recorded from the approved limited taxonomy; voluntary feedback requested separately; **no reference or quote use without separate permission**
- [ ] Renewal outcome recorded (`churned` or `downgraded`); success plan and stakeholder map archived
- [ ] Learning filed: what the method should change for the next tenant
- [ ] Closure confirmation sent to the customer sponsor: what exists, where, who holds it, what has and has not been deleted, and who to contact

## 9. Rehearsal before first use

Offboarding was rehearsed once by its author on a hosted preview database with
synthetic data
([`../evidence/offboarding/2026-09-30-hosted-preview-rehearsal.md`](../evidence/offboarding/2026-09-30-hosted-preview-rehearsal.md)).
Before any real school is offboarded, a **second person** repeats the
rehearsal on a preview branch (never production) with two administrators, walks
steps 1–7, calls `restore_school` as a different operator, checks grants and
connections are back, and files the output in `docs/evidence/` with the date and
the operators' roles. Only then is gate G3 met for a real school, and only for
the steps tested.

## Evidence state

**Repository evidence.** The eight functions, the never-delete trigger, the
rehearsal record and the 98-check suite exist; student export and account
deletion exist.

**Operational evidence.** One author-run rehearsal on synthetic data. No real
school has been offboarded; no second-person rehearsal; no export has been
generated or delivered.

**Missing test/proof.** Second-person rehearsal; export generator with its
manifest; the purge with per-category confirmation; deletion certificate; a
first real closure.

## Claim ceiling

Semester may describe a stepwise, reversible offboarding case and student-side
export.

## Prohibited claims

Do not claim any school's data is exported, deleted, purged or destroyed; do not
state any retention length or legal conclusion; do not claim offboarding has
been used.
