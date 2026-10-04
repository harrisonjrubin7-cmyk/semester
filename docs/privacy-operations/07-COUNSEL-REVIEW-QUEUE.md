# 07 · Privacy counsel review queue

**Status `OPEN`; no item closed. 4 October 2026. Owner: privacy seat (vacant) to prepare; qualified counsel (unassigned) to decide.**

> **Everything in this queue is [COUNSEL REQUIRED].** This file prepares questions and facts; it decides nothing, and no answer may be relied on until recorded in the decision log with counsel's name and date. It is the privacy slice of [`LEGAL-REVIEW-QUEUE.md`](../../LEGAL-REVIEW-QUEUE.md) (v0.2, 3 Oct) and the successor to the privacy rows of [`COUNSEL-BRIEF.md`](../COUNSEL-BRIEF.md) (30 Sep, partly stale: C1 says "no screen"). **Rows marked NEW are in neither document.**

## How an item closes

Counsel has reviewed the identified version; the business decision is recorded; any product or operational change is evidenced; an authorised approver records the permitted use (internal, publishable, negotiable, executable). Wording must not be used to hide a behaviour gap: change the product when needed to make approved language true.

## Priority queue

Priority follows `LEGAL-REVIEW-QUEUE.md` (L0 blocks a motion; L1 blocks a feature; L2 blocks a geography).

| ID | Pri | Question for counsel | What the code or docs assume today | Facts counsel needs | Blocks | Source |
| --- | --- | --- | --- | --- | --- | --- |
| P-01 | L0 | Which education-privacy and child-privacy regimes apply (FERPA, COPPA, state student-privacy laws), in which role is Semester (school official, processor, controller), and for which users? | School-official posture assumed in `FERPA-CONSENT-WORKFLOW`; minimum age 13 (D-139); K-12 means 13+ | User ages, institution types, states, what records Semester holds | Any pilot; K-12 edition | LRQ L0; CB B1–B4 |
| P-02 | L0 | **Breach notification:** which duties and clocks apply, to whom, and what may be promised? | 72 h called a commitment in `SECURITY.md` and the incident summary; "no approved deadline" in five other documents; Anthropic's 48 h unsigned | Contract clocks; states; vendors; minors | Institutional signature; privacy policy §9 | **NEW** |
| P-03 | L0 | **Rights-request clock and answerer:** what time, if any, may be promised, under which regimes, and who may answer? | 30-day column default; 24 h first response in support draft; "do not promise" elsewhere | Which regimes apply; named owner | Answering surface; Privacy-screen copy | CB C1 (stale) |
| P-04 | L0 | Privacy notice, age and minors posture; contents and effective date. Does a post-hoc under-13 statement need deletion? | Draft §8 "[DECIDE: 13 or 18]"; code withdraws but keeps the account | Audience; geography | Broad individual launch | LRQ L0 |
| P-05 | L0 | Is the **three-way role split** (Semester decides / institution directs / student directs) a sound legal characterisation, and which parties are processors, subprocessors, controllers? | `SUBPROCESSORS.md` classification, "an engineering classification, not a legal opinion" | Contracts | DPA; public register | LRQ L0 |
| P-06 | L0 | **Guardians of minors:** consent model, record-access rights, evidence required to verify a guardian, what a guardian may see | Staff vouch; no portal; `guardian_may_read` unused | School processes; state | K-12 edition (COPPA-4/5, KG-02) | CB B4 |
| P-07 | L1 | **Erasure design:** may kept tables, 7-year financial records and school-owned records stand; may staff with immutable history be anonymised; **reopen D-124** (no deletion ledger); 7-day backup tail and resurrection | As built | Drill report; backup facts | Erasure wording; production personal data | CB A2, C2; LRQ L1 |
| P-08 | L1 | **Erasure completeness:** consent rows are copied as JSON into `tenant_policy_audit_event` until the school is removed, and unsalted hashes of the account id persist in 3-year audit events. Acceptable, or must they be cleared? | Not addressed in any document | See 08-C5, C8 | Erasure claims | **NEW** |
| P-09 | L1 | Legal holds and law-enforcement requests: who may place one, effect on a school's departure, preservation of audit rows, notice to the person | `legal_holds` built; no screen; hold-aware sweeps | Matter types | Production data | CB A3; LRQ L1 |
| P-10 | L1 | **Company site and lead capture:** notice, lawful collection, retention for `site_leads` and `gtm_*`, third-party loads (CDN scripts, YouTube-nocookie), storage keys, no-cookie claim | No retention; no banner; "sets no cookies" | Site inventory in 03 §6 | Site forms live | **NEW** |
| P-11 | L1 | **Marketing communications:** consent standard, email/SMS rules, suppression, referral and ambassador programmes, testimonials, children excluded | `gtm_consent` append-only, server-side; no sender approved | Channels | Campaigns | LRQ L1; **referral/ambassador NEW** |
| P-12 | L1 | **AI:** provider terms acceptable for student data (none signed); training and retention; whether runtime class enforcement is required before the shared key turns on; disclosure wording | Shared key off; no runtime class check | Provider terms; data flow | AI launch claims | CB F3; LRQ L1; class check **NEW** |
| P-13 | L1 | **Student-data DPA:** whether a subprocessor DPA is required before any institution data flows; subprocessor-change notice and objection mechanics | Draft addendum and checklist only | Institution forms | Paid pilot | LRQ L0; **change notice NEW** |
| P-14 | L1 | **Education-record access:** right to inspect and review; no screen exists | PIA states the gap | Records held | School records | **NEW** (PIA §) |
| P-15 | L1 | **Employer, career and marketplace data sharing:** roles, consent, minors excluded, third-party data about reviewers or providers | Career in code; marketplace not built; no dedicated doc | Product plans | Career/marketplace | **NEW** |
| P-16 | L1 | **Support access and break-glass:** is the consent-plus-time-box design sufficient; student visibility of support history | Built; no history screen | n/a | Support access PIA | LRQ L1 |
| P-17 | L1 | **Family/supporter model for adults:** bearer-code claim without identity check | Documented design (D-037) | n/a | Family launch | **NEW** |
| P-18 | L2 | International users, GDPR applicability, cross-border transfers | Not designed | Intended countries | Any non-US user | LRQ L2 |
| P-19 | L2 | Research and interview consent (discovery interviews) | None | Pilot plan | First interview | CB F1 |
| P-21 | L1 | **Access requests and withheld records:** may a person's export or access response leave out a school's guardian restriction (a court-order flag and staff note about a guardian link), say only that one exists, or must it include it? | Withheld whole from both the student's and the guardian's export (D-1240); the file says a restriction was left out | The restriction's purpose; which regimes apply; school process | Answering access requests for K-12 accounts | **NEW** (08 C4) |
| P-20 | L2 | Dedicated privacy and security contact address replacing a personal mailbox; **who is the accountable person** | Personal Gmail | n/a | Any public notice | **NEW** |

## Standing instructions for the preparer

1. For each item, attach: the exact code or doc location, the decision-log entry, and a **facts-only** one-page brief. No conclusions.
2. Present alternatives and a recommendation for operational choices (for example, the 30-day target); say plainly which part is operational and which part is legal.
3. Record the answer, counsel's name, date and scope in the decision log; update the affected document; remove the `[DECIDE]` line; change product behaviour if needed.
4. Review weekly while anything is open (the queue's own cadence). Order of work: **P-02, P-03, P-01, P-04, P-06, P-07**, because they unblock built work or contradict published text.
5. **Do not engage anyone as counsel on the assumption this list is complete.** It is built from the repository; the owner and counsel will know questions it cannot.
