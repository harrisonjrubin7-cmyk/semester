# Questions for counsel — brief of 30 September 2026

**This is not legal advice and decides nothing.** It gathers, in one place, every question the repository has left open for a qualified lawyer, so that one conversation can close many of them. Each row says what the code assumes today, so counsel can correct it rather than start from nothing. Nothing in Semester relies on an answer here until it is recorded in `docs/DECISION-LOG.md` with counsel's name and date.

The owner decides who counsel is; the privacy seat is held by outside counsel per `app/src/lib/launchreadiness.ts`, and no one has signed.

## A. When a school leaves (release gate G3)

| # | Question | What the repo assumes | Unblocks |
| --- | --- | --- | --- |
| A1 | How long must a departed school's records be kept before any purge may be authorized? | 90 days, 30 minimum — a placeholder (`docs/SCHOOL-OFFBOARDING.md`) | `archive_school`'s default; purge eligibility |
| A2 | What becomes of a former school's *student* work: kept by the student, returned to the school, or destroyed? Does D-124 ("no deletion record survives a restore") need reopening? | Students keep their accounts and their own export; nothing is deleted | The purge procedure, if one is ever built |
| A3 | Does a school's departure end a legal hold placed over it, or must the hold outlive the contract? Who may place one? | A live hold blocks purge eligibility; nobody has placed one | `legal_holds` (#1012) in practice |
| A4 | How long is audit evidence about a departed school kept? | Three years (`audit_event` sweep) | Retention of offboarding cases |

## B. FERPA and who may see what (gap-matrix row b)

| # | Question | What the repo assumes | Unblocks |
| --- | --- | --- | --- |
| B1 | Which **purposes** count as a legitimate educational interest, and which data classes (T0–T5) may each reach? | Access is decided by tenant, role and scope only; no purpose code exists | A purpose-coded, deny-by-default authorization with permit/deny audit |
| B2 | When does a school act as the "school official" for Semester, and when is student consent needed instead? | `docs/trust/FERPA-CONSENT-WORKFLOW.md`, `app/src/lib/trust/ferpa-consent.ts` | Whether a pilot needs per-student consent |
| B3 | Directory information: which fields, and who sets the opt-out? | Not modelled | Any roster or classmate feature at a school |
| B4 | Under-13 and minors (D-139, D-140 K-12 baseline) | Nobody under 13 holds an account; district data refused until sixteen items are tested | The K-12 edition |

## C. Rights requests

| # | Question | What the repo assumes | Unblocks |
| --- | --- | --- | --- |
| C1 | Who answers a data-subject request, and within what time, under which regimes? | Queue and a student intake and tracking screen exist (`data_subject_request`, `DataRightsRequests.tsx`); no answering surface; **no one named**; no response time is decided or promised anywhere | An answering surface and a stated response time |
| C2 | What is refused or withheld when erasure conflicts with another person's record or a hold? | Erasure fails closed for staff who wrote to four immutable tables | Erasure wording in the Privacy Policy |

## D. The drafts in `docs/legal/` (they stay there; this brief lives one level up so their "draft" rule holds)

Thirteen drafts carry **77 `[DECIDE …]` lines**. The ones only counsel can close:

- **Effective dates** on every policy, and the order they go live (Terms and Refund policy first: they govern a charge).
- **Refund and cancellation:** the effective date and any statutory cooling-off language; how a dispute is handled when the webhook records it but changes nothing.
- **Privacy Policy** (14 lines): lawful bases, retention table, international transfers, the provider list (matches `docs/SUBPROCESSORS.md`).
- **Accessibility statement:** the enforcement procedure and regulator to name; dates for the manual review and VPAT — *and whether to publish it at all before an assistive-technology pass exists*.
- **Copyright and takedown** (8 lines): whether to designate an agent.
- **A dedicated abuse / support address** in place of a personal mailbox.

## E. Money: student accounts and dining (owner decision X1)

These two modules are on `main`, off behind flags, with no money moving through Semester (D-146). Before either is switched on for any school (the full list is `docs/MONEY-MODULES-SWITCH-ON.md`):

| # | Question |
| --- | --- |
| E1 | Does holding a ledger, plans, refunds or a swipe pool for a school make Semester a money transmitter, a service provider to a Title IV institution, or neither? |
| E2 | What PCI scope follows from provider payments as built? |
| E3 | What must the contract say about who is merchant of record, who refunds, and who reconciles? |
| E4 | Is it acceptable to remove the code instead of leaving it off? (Product decision, but counsel's answer to E1 bears on it.) |

## F. Pilots, interviews, vendors

| # | Question | Where |
| --- | --- | --- |
| F1 | Do discovery interviews with students need consent or institutional review before the first is held? | `docs/pilot/DISCOVERY-EVIDENCE-LOG.md` |
| F2 | The pilot agreement and DPA: review `docs/trust/PILOT-AGREEMENT-OUTLINE.md` and `docs/trust/DPA-CHECKLIST.md` | pilot SOW |
| F3 | AI providers: their published terms are on file, nothing is signed (D-147). Which terms are acceptable for student data? | `docs/trust/PROVIDER-TERMS.md` |
| F4 | Insurance and company documents named in procurement checklists | not in the repository |

## G. What may be said publicly

Until evidence exists, counsel should confirm the wording never implies: SOC 2, FERPA certification, HIPAA, PCI, HECVAT, pen-test completion, or accessibility conformance (`docs/RELEASE-GATES.md`, "Do-not-claim boundaries"); that a members-only room protects any school; or a response time for a rights request.

## H. Privacy operations (added with the privacy operations pack, `docs/legal-drafts/PRIVACY-OPERATIONS-PACK-DRAFT.md`)

| # | Question | What the repo assumes | Unblocks |
| --- | --- | --- | --- |
| H1 | Which breach-notification duties apply, to whom, and by when? Is the 72-hour account-email commitment in `SECURITY.md` appropriate? | Operational commitment only; statutes not checked | Breach worksheet Step 3; `SECURITY.md` wording |
| H2 | Which ID-verification standard is adequate for access, deletion and guardian requests? | Session plus fresh authentication; email confirmation otherwise | DSR operator screen |
| H3 | Is a minimum age of 13 defensible for every intended audience, and what happens when an under-13 account is found? | D-139 floor; no consent path built | Minors procedure P1 |
| H4 | How is a guardian verified, what may a guardian see at each age, and when do rights pass to the student? | Link accepted by the student or attested by the institution; scoped and revocable | Family screen; guardian-originated requests |
| H5 | Who has authority over a dual-enrollment minor's data: school, parent, or the student? | Not decided; the Supporter model says a decision is needed first | Any dual-enrollment launch |
| H6 | What are the vendor roles and transfer mechanisms, and what notice of subprocessor change is owed to customers? | Engineering classification only; no DPAs signed | Vendor activation |
| H7 | May analytics, product data or AI inputs ever inform marketing? May any tracking or retargeting run? | No: default off | Marketing add-on E |
| H8 | How should deletion be described given provider backup tails and immutable history? | Qualified wording in `RETENTION.md`; stronger absolute wording in `privacy.ts` | Privacy notice; in-app copy |
| H9 | What does the processing register need for each role and basis (candidate rows PR-08 to PR-23)? | All `[DECIDE]` | Trust register completion |

## Suggested order

A1–A3 and C1 first (they unblock built work); then H2–H5 (they gate the rights and minors operating procedures). Then D's effective dates. Then B1 and E1, which decide two large open designs.
