> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Semester checklists for counsel — draft

**Status:** every item **requires qualified human counsel review.** The checklists collect facts and questions so counsel's time goes to judgement. A ticked box means "the fact is recorded", never "compliant". Fill in `docs/legal-drafts/LEGAL-REVIEW-INTAKE-TEMPLATE.md` per request; use these as the question bank. Jurisdiction facts J1–J8 are in [`LEGAL-ISSUE-MAP.md`](LEGAL-ISSUE-MAP.md).

Legend for "repo state": what the repository shows today, so counsel can correct it. Nothing here is a statement about deployment.

## A. Education records

- [ ] Which institutions, which role (school official / vendor / independent), recorded per tenant (J5).
- [ ] Which Semester data are education records for which institution; which are not (student-private notes, personal planner).
- [ ] Legitimate-educational-interest purposes and the data classes each may reach (COUNSEL-BRIEF B1). *Repo: access by tenant, role, scope; no purpose code.*
- [ ] Directory information: fields, opt-out owner (B3). *Repo: not modelled.*
- [ ] Redisclosure and use limits flowing to sub-processors and AI providers.
- [ ] Student access, correction and amendment path; interplay with grade-change audit.
- [ ] Parent/guardian rights at post-secondary level; who asserts them.
- [ ] State student-privacy statutes and any required contract terms in the customer's state (J2/J4).
- [ ] Prohibitions to check against product: targeted advertising, profile-building outside the educational purpose, sale, training on student data.
- [ ] Offboarding: return, deletion, retention (COUNSEL-BRIEF A1–A4).

## B. Accessibility

- [ ] Which obligations attach (customer type, federal funding, public entity, contract) (J4, J8).
- [ ] Target standard and version to promise, if any; platforms covered (web, iOS, Android, documents, audio).
- [ ] Status of manual assistive-technology evaluation. *Repo: automated guards on six routes only; CLM-008 prohibits conformance claims.*
- [ ] ACR/VPAT wording and date; who signs.
- [ ] Accommodation request and escalation path; response time stated or not.
- [ ] Third-party content (university feeds, marketplace listings) and who is responsible.
- [ ] AI-generated content and captions/transcripts for audio.
- [ ] Remediation roadmap as a contract exhibit: binding or non-binding.

## C. Children and minors

- [ ] Who can reach an account: ages, enrolment types, dual-credit, K-12 edition (J3). *Repo: under-13 accounts refused.*
- [ ] Age assurance method and whether it is itself a data-collection risk.
- [ ] Parental or school authorisation model if any minor is permitted.
- [ ] Minor-specific limits on advertising, profiling, recommendations, notifications, community and messaging features.
- [ ] State age-appropriate-design and minors' online-safety laws in J2.
- [ ] Guardian visibility for under-18 vs adult students.
- [ ] Minor data retention and deletion defaults; breach notice to guardians (see incident workflow).
- [ ] Safety escalation (self-harm, abuse) duties and routing (`docs/CRISIS-RESPONSE-RUNBOOK.md`).

## D. Consumer (individual subscribers)

- [ ] Terms formation: click-through design, version history, assent records, changes-notice method.
- [ ] Auto-renewal, free-trial and negative-option rules in each state served; cancellation parity with signup; renewal reminders.
- [ ] Price, fee and tax disclosure at checkout; student discounts and eligibility claims.
- [ ] Refund and chargeback policy wording vs actual billing behaviour. *Repo: webhook records disputes but changes nothing — COUNSEL-BRIEF D.*
- [ ] Mandatory arbitration, class waiver and governing-law choices; enforceability by state.
- [ ] Unfair/deceptive practice review of every public claim (see claims process).
- [ ] Dark-pattern review of onboarding, upsell and cancellation flows.
- [ ] Accounts of deceased or incapacitated users; account recovery liability.

## E. Payment

- [ ] Does money move through Semester at all today (J7)? *Repo: off behind flags, D-146.*
- [ ] Merchant of record, refund owner, reconciliation owner per flow (E3).
- [ ] Money-transmission, payment-facilitation or Title IV servicer characterisation (E1).
- [ ] PCI scope as built; SAQ type; what card data never touches Semester (E2).
- [ ] Sales/digital-goods tax on subscriptions; revenue recognition handled by CPA.
- [ ] Stored credentials, instalment/payment-plan, late-fee and collections rules.
- [ ] Financial-aid visibility: data source, accuracy disclaimers, who can see.
- [ ] Unclaimed property and balance-holding rules if any balance persists.

## F. Marketplace

- [ ] Semester's role: venue, agent, seller, or payment facilitator; disclosed how.
- [ ] Provider eligibility, vetting, sanctions/KYC, and ongoing monitoring.
- [ ] Prohibited and restricted listings (academic-integrity, essay mills, regulated services, minors).
- [ ] Order, refund and dispute terms between student and provider; Semester's part.
- [ ] Payouts: timing, holds, reserves, tax forms and reporting, marketplace-facilitator tax.
- [ ] Reviews and ratings integrity; endorsements disclosure.
- [ ] Safety for in-person services; incident handling.
- [ ] Commission disclosure; self-preferencing; antitrust-adjacent questions if exclusive deals.
- [ ] Gate: marketplace "only once consumer protection, provider governance, refund, tax and operational capacity are mature" (audit pricing note). See [`MARKETPLACE-AND-PARTNER-TERMS-DRAFT.md`](MARKETPLACE-AND-PARTNER-TERMS-DRAFT.md).

## G. Marketing and communications

- [ ] Channel-by-channel consent: email, SMS/MMS, push, in-app, social, phone (consent evidence store).
- [ ] Unsubscribe, suppression and sender-identification rules; transactional vs marketing line.
- [ ] Testimonials, endorsements, ambassadors and material-connection disclosure.
- [ ] Comparative and superlative claims ("replaces", "best") — see claims register CLM-006, CLM-010.
- [ ] Use of customer names/logos/quotes: CLM-013 requires exact written permission.
- [ ] Outcome claims (GPA, retention, ROI): CLM-014 prohibits today.
- [ ] Marketing to students on institutional lists; list provenance.
- [ ] Contests, referrals and incentives rules.
- [ ] Cookie/SDK consent for ad and analytics tags (`COOKIE-CONSENT-IMPLEMENTATION-SPEC.md`).

## H. Employment and contractors

- [ ] Worker history: founder, contractors, student helpers, AI-tool use by workers (IP and confidentiality).
- [ ] Classification per worker and state; payroll registration.
- [ ] Invention assignment and confidentiality executed before work began? Gaps and cure.
- [ ] Student workers and minors: age, hours, school-credit arrangements.
- [ ] Equity and vesting paperwork; securities-law exemption counsel.
- [ ] Remote-work state footprint; benefits; workers' compensation.
- [ ] Moonlighting/conflict rules where the founder is also a student (university IP policies, enrolment-based IP claims) — *founder is a university student; counsel should check any institutional IP or conflict policy.*
- [ ] Support-staff access to student data: background checks, training, confidentiality.

## I. Artificial intelligence

- [ ] Inventory of AI uses, providers, models, data classes sent (`docs/trust/AI-SYSTEM-INVENTORY.md`).
- [ ] Provider terms: retention, training on inputs, subprocessors, region, deletion (D-147: terms on file, nothing signed).
- [ ] Training and fine-tuning on student or institutional data: prohibited or consented, and how enforced.
- [ ] Disclosure to users that content is AI-generated; limits statement; citations/provenance.
- [ ] Human confirmation before any consequential action (grade, enrolment, financial, external).
- [ ] Academic-integrity position: does Semester write assignments (solve/write/essay tools) and for whom; institution policy toggles.
- [ ] Automated decision-making, profiling and risk-scoring rules in J2; advisor "early alert" features.
- [ ] Bias/fairness testing evidence for any ranking or recommendation of opportunities or providers.
- [ ] AI-specific laws and procurement requirements in customer jurisdictions.
- [ ] Kill-switch, incident handling and notification (`docs/trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md`).
- [ ] Ownership/licence of AI output; IP infringement risk allocation in terms.
- [ ] Student-supplied API keys: liability, storage, and disclosure.
