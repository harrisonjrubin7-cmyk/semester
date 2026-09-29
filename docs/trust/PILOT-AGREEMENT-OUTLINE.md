# Pilot Agreement Outline

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

**A business outline for counsel. It is not legal advice and not agreement
language.** It sets out what a 26-week institutional pilot agreement has to
cover, and a sample scope that matches what Semester can actually support.
`docs/market-readiness/PILOT_PLAYBOOK.md` is the operational side: how a pilot
is run once it is signed.
`docs/PAID-PILOT-FRAMEWORK.md` and `docs/PILOT-TO-ANNUAL-CONVERSION.md` cover
the commercial side: price, how long a pilot may run, who approves it, and how
a pilot becomes, or does not become, an annual agreement. This outline covers
only what the contract has to say.

## Sections the agreement needs

1. Parties, effective date and order of precedence (MSA, DPA, SOW, SLA)
2. Pilot purpose and the business problem it tests
3. Term and timeline, with milestones
4. Cohort and participating departments
5. Included features
6. Explicit exclusions
7. Implementation responsibilities
8. Institution responsibilities
9. Semester responsibilities
10. Data scope, classification and source systems
11. Privacy, DPA and security addendum ([`DPA-CHECKLIST.md`](DPA-CHECKLIST.md))
12. SSO, LMS and SIS integration boundary
13. AI use and course AI policy controls
14. Accessibility commitments
15. Training, support and escalation
16. Fees, payment schedule, taxes, usage and AI capacity limits
17. Availability and support terms. For a pilot, these are best-effort with
    named response times, not a credit-bearing SLA ([`SLA.md`](SLA.md))
18. Success metrics
19. Governance meetings and escalation path
20. Confidentiality and intellectual property
21. Feedback and product improvements
22. Incident notification
23. Termination, data export, deletion and retention
24. Conversion, expansion, pause or stop decision
25. Reference or case-study permission, as a separate opt-in
26. No production authority, grade authority or registration writeback before
    written approval

## Sample scope

| Item | Sample |
| --- | --- |
| Institution | [Institution legal name] |
| Term | [Term, e.g. Spring 2027] |
| Duration | 26 weeks |
| Cohort | Two introductory courses; up to 500 students; up to 12 faculty and TAs; selected tutoring and library staff |
| Decision | A written convert, expand, pause or stop decision within 15 business days of the final review |

**Included:**

- Tenant setup and branding
- SSO
- LMS course, roster and assignment read integration through LTI 1.3
- Student Today
- The course workspace and study tools
- Source and freshness labels
- Course-aware AI under the pilot's course AI policy
- Tutoring and library referral
- Admin integration-health view
- Pilot analytics and a weekly working group

**Excluded:**

- Grade passback
- Official registration writeback
- Financial aid and billing records
- Housing and dining transactions
- Marketplace or payment processing
- High-stakes assessment delivery
- Replacing the LMS

**Data:** the minimum necessary identity, role, course, section, enrollment,
assignment and deadline data, plus the approved service directory.

The exclusions are not modesty. Each one is a workflow whose failure harms a
student's record, and none of them has the evidence behind it yet: no load
test, no restore drill, no reconciliation. Include one only after its evidence
exists.

## Success scorecard

Fill in the targets with the institution before signing, not after.

| Measure | Target |
| --- | --- |
| Activation rate | [target]% |
| First meaningful action | [target]% |
| Weekly return to the course workspace | [target]% |
| Study or plan completion | [target]% |
| Tutor or library handoff completion | [target]% |
| Student usefulness and trust | [target] |
| Faculty usefulness | [target] |
| Source freshness within SLA | [target]% |
| Unresolved P0 or P1 accessibility issues | None |
| Material security or privacy incidents | None |
| Support response and resolution | Within the pilot commitment |

## Before sending this to an institution

These must be true first. Each is tracked in [`README.md`](README.md).

- A legal entity exists to be a party.
- A DPA has been drafted by counsel.
- Cyber-liability insurance is in place.
- The SSO exchange has been proven with the institution's own IdP (HECVAT IAM-1).
- A named support route and response times exist.
