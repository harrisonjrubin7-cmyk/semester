> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Minors and guardian operations note — draft

- **Owner/backup:** `[TBD role]` / `[TBD role]`
- **Version/effective date:** 0.1, not in effect
- **Approval authority:** qualified education/children's-privacy counsel plus the authorized company decision-maker
- **Builds on:** D-139 (minimum age 13), `supabase/migrations/20260929150000_minimum_age.sql`, `20260930233000_k12_guardians.sql`, `20261001075026_k12_guardians_repair.sql`, `docs/security/guardian-data-model.md`, `docs/SUPPORTER-FAMILY-PRIVACY-MODEL.md`, `docs/FERPA-COPPA-1EDTECH-READINESS.md` (COPPA-1 is `TESTING`; counsel has not reviewed).

## Plain-language summary

The product sets a minimum age of 13. It has guardian links and a dual-enrollment role. What is missing is the *operating procedure*: what staff do when a younger child appears, how a guardian is verified, what a guardian may see, and how everything is revoked. This note sets the operating defaults for review. Every legal determination is counsel's.

## Operating defaults proposed (pending counsel)

| Topic | Proposed default | Counsel-required decision |
| --- | --- | --- |
| Minimum age | Keep 13 as the product floor (D-139) | Whether 13 is defensible for all intended audiences, and whether any under-13 use through a school is intended (COUNSEL-BRIEF B4) |
| Age collection | Collect the least needed (date of birth or age band at sign-up); do not store a full DOB unless required | Whether age band is enough |
| Under-13 discovered | Stop processing beyond what is needed to close; do not message the child; do not ask for more data; notify the support role; delete or restrict per counsel's instruction | Required handling, any parental-consent path, retention of the age evidence |
| Parental consent mechanism | None built; do not improvise | Whether any is needed; which method |
| Dual-enrollment and under-18 | Minor flag drives defaults: private by default, no marketing, no community discovery, no AI inference about wellbeing, analytics aggregated | Applicability of education-record and children's rules; who is the authority (school vs. parent) |
| Guardian verification | Link requires an invitation accepted by the **student** (where age permits) or an institution-attested relationship; no self-asserted link | Standard of verification; who attests for K-12 |
| Guardian visibility | Only the scopes granted in the link; never student-private notes, messages, AI chats or drafts by default; each scope individually revocable | Which scopes are permissible at which ages; when rights transfer to the student |
| Revocation | Student, guardian or institution can end a link; takes effect immediately; access log retained | Retention of link history |
| Guardian-originated DSR | Acknowledge and escalate; do not fulfil (see `DSR-OPERATING-KIT-TEMPLATE.md` §6) | Whether a guardian may exercise rights, and for whom |
| Institution-attested minors | Institution contract decides who may act; Semester acts only on the verified institution contact | Role analysis (school official or other) per customer |
| Community and messaging | Minors cannot be discovered by strangers; reporting path visible; no direct messages from unverified adults | Duty-of-care wording |
| Safety escalation | Follow `docs/CAMPUS-ESCALATION-POLICY.md` and `CRISIS-RESPONSE-RUNBOOK.md`; privacy never blocks a safety escalation, but disclosure is recorded | When disclosure is required or permitted |
| Marketplace and ads | Off for minors | Whether any provider may serve minors |
| Breach involving minors | Raises risk score; guardian and institution notification decided by counsel (breach worksheet Step 3) | |

## Procedures

**P1 — Age-gate failure or suspected under-13.** Support receives a report or the system flags a birth date under 13 → record the report without extra personal data → apply the restriction counsel approved (until then: freeze sign-in and escalate within one business day) → counsel decides deletion vs. consent path → respond to the reporter without confirming account details → log.

**P2 — Guardian link request.** Verify the student's acceptance or institution attestation → confirm age-based scope limits → create the link with explicit scopes → send the student a notice of what the guardian can see → log. Re-confirm annually and at 18 `[DECIDE]`.

**P3 — Age transition (turning 18 or leaving K-12).** Review links; require the now-adult student to re-consent or end each link; guardian access to adult records ends unless the student confirms. `[DECIDE]` exact timing.

**P4 — Conflicting guardians or disputed custody.** Neither party is given more access; freeze changes; escalate to counsel; do not adjudicate.

**P5 — Minor's data in an export or deletion request.** Handle through the DSR kit with the minor flag; second reviewer mandatory.

## Controls and evidence

| Control | Evidence today | Missing |
| --- | --- | --- |
| Minimum-age enforcement | `supabase/minimum-age.check.sql` | Evidence of behavior at production sign-up |
| Guardian link model | `k12-guardians.check.sql`, `family.check.sql` | Verification procedure; operator runbook |
| Dual-enrollment role | Role exists in migration `20260926150000` | Policy decision on minors' authority (the Supporter model says one is needed before building) |
| Student-visible notice of guardian access | Family screen | Wording approved by counsel |
| Marketing exclusion for minors | None | Enforcement and test |

## Counsel questions raised (also queued)

H3–H5 in `docs/COUNSEL-BRIEF.md`: age floor and under-13 handling; guardian verification and rights; dual-enrollment authority.

## Activation blockers

Counsel answers to H3–H5 and COUNSEL-BRIEF B1–B4; an operator procedure with an owner; evidence that the age gate behaves as intended in production.
