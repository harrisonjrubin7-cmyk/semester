# Marketplace and Partnership Strategy

| Control | Value |
| --- | --- |
| Status | **CONTROLLED DESIGN — MARKETPLACE, PAYMENTS, PAYOUTS AND PROVIDER ACCESS REMAIN HELD; NOTHING HERE IS A COMMITMENT, A CLAIM OR APPROVED PAPER** |
| Owner | Harrison Rubin — company-side owner, as in [`PARTNER-AND-CHANNEL-STRATEGY.md`](PARTNER-AND-CHANNEL-STRATEGY.md); backup owner, finance owner, trust-and-safety lead, counsel and partner authority unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Written for | the *Marketplace and Partnership Strategist* prompt of the audit PDF, under its shared preamble. The preamble's closing sections are the last part of this page |

**Tags.** Every statement is one of: **Fact** (true of this repository today, with a path), **Proposal** (a design recommendation, one recommended option), **Hypothesis** (a number or behaviour nobody has measured), **Counsel** (a question only qualified counsel can close — this page decides none). Nothing tagged Proposal or Hypothesis is a decision until it is recorded as `docs/decisions/D-<pull request number>.md`.

## 0. Read this first

### What main already says, so this page does not repeat or contradict it

- **Fact.** The marketplace does not exist. `docs/PLATFORM-CONSTITUTION.md` J-14: "The sponsorship gate is built and tested; … no marketplace." I-03 (workflow marketplace) is `absent`.
- **Fact.** Role `marketplace_partner` exists with no surface (`app/src/lib/rolelaunch.ts`, `supabase/migrations/20260926150000_expansion_roles_and_features.sql`); its stated limit is "Student data absent authorized interaction".
- **Fact.** D-009 held billing out; D-128 stepped aside for **one** plan (Semester Plus, Stripe *test* keys). `docs/legal/REFUND-AND-CANCELLATION-POLICY-DRAFT.md` says that policy must be reviewed before a live key is set. The register at `docs/market-readiness/CAPABILITY-STATUS-REGISTRY.json` has `individual-ga` **BLOCKED** ("payments/tax/refund operations, support capacity"), `support` **INTERNAL** ("staffed queue, backup owner"). A `marketplace` row at **BLOCKED** was added alongside this page, so the register now states the claim ceiling for it.
- **Fact.** The lines not crossed (`docs/MARKET-LEADERSHIP.md`): no student data sold; employers never receive student-level data; no targeted ads from education records (DO-NOT-BUILD 10); *no pay-to-win placement is recorded as "proposed", not as a held boundary*.
- **Fact.** Four existing designs this page must be consistent with, none built: [`PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md`](../PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md) (`provider_registry`, evidence-row-or-no-claim), [`EXTENSION-ECOSYSTEM-GOVERNANCE.md`](../EXTENSION-ECOSYSTEM-GOVERNANCE.md) (`extension_catalog`, `tenant_extensions`, `extension:approve`, offboarding before approval), `app/src/lib/gtm/sponsor.ts` (approved and prohibited categories, protected surfaces), and [`CAMPUS-ESCALATION-POLICY.md`](../CAMPUS-ESCALATION-POLICY.md) (two different professionals, written reasons, an allowlisted payload).
- **Fact.** `docs/operating-model/COMMERCIAL-GOVERNANCE.md`: marketplace revenue share is "set by finance; sponsors never receive student-level data"; payout reconciliation is monthly; payee changes are verified out-of-band.
- **Fact.** Repository mechanics that bind a partner design: `subprocessors.test.ts` fails when the app's content-security policy names a host that no subprocessor row accounts for; DO-NOT-BUILD 13 requires RLS tests, an immutable history and a kill switch before anything above *planned*; DO-NOT-BUILD 3 forbids an unexplained score or ranking.

### Recommendation in one paragraph

**Proposal.** Build the marketplace as a **governed directory first and a store last.** Sequence it by *risk class of what is sold*, not by feature: information-only listings, then institution-approved integrations, then institution-procured services paid by invoice, and only then student-paid checkout through a licensed payment processor that holds the funds. A provider's standing is **earned by evidence and never bought**; ranking is revenue-blind; the institution decides what its students can see; the student can hide everything. Each step is gated on operating controls — a named finance owner, a staffed trust-and-safety queue with a backup, a rehearsed refund-and-dispute runbook, counsel-approved provider terms — and **today none of those exist, so every step stays held** (section 12).

## 1. Marketplace categories, provider types, value proposition, sequencing

### 1.1 Value proposition, by who receives it

| Party | What the marketplace gives them | What it must never do to them |
| --- | --- | --- |
| Student | One place to find vetted help (tutoring, accessibility tools, study material, campus services, housing/transport information, opportunities), with price, data use and provider standing visible *before* acting; everything works without it | Sell their data or attention; hide fees; rank by who paid; make a core Semester function depend on a purchase; follow them off-platform |
| Institution | Approved, accessible, auditable third-party services under its own procurement rules; a way to list its own units' services; one support path | Bypass procurement, sign it up for a vendor, expose a roster, or make it responsible for a provider it did not approve |
| Provider / campus unit | Qualified, intent-based demand; a standard verification once instead of one per campus; clean order, entitlement and payout operations | Promise them volume, hand them student records, or let a tier be purchased |
| Semester | A transaction-fee revenue line (section 8) and a reason for institutions to stay | Create a revenue incentive to approve a provider it would not otherwise approve |

### 1.2 Categories, grouped by risk class

The class sets the *minimum* review, the data a provider may ever see, and the earliest phase it can open. A listing is in exactly one class; the highest-risk attribute decides it.

| Class | Categories (examples) | Money | Student data the provider may receive | Earliest phase | Review required |
| --- | --- | --- | --- | --- | --- |
| **A. Information** | Campus-unit services and hours; verified community resources; scholarships (verified); campus deals as *information* | None | None. Click-through to the provider's own page, labelled | M1 | Identity, listing standards, link-safety |
| **B. Integrations / tools** | Accessibility tools (captioning, reading, dyslexia-aware text), study and productivity tools, LTI-style learning tools, content libraries | Institution-paid or free | Only what the school approves, **at or below the tool's classification ceiling** (extension governance); T0–T2 default | M2 | A plus security, privacy, accessibility conformance report, data-flow review |
| **C. Transactional services** | Tutoring, test prep, coaching, course materials, printing, tickets and dues | Yes | Order fulfilment minimum: name or handle, the item, scheduling window. No academic, family or support data | M3 (institution-invoiced), M4 (student-paid) | B plus business verification, refund terms, payout controls, tax review |
| **D. Opportunity** | Internships, jobs, fellowships, employer events and office hours, alumni mentoring | Employer-paid listing fee only if counsel clears it (section 8) | Named artifacts the student **opts in to share** per application. No grades, accommodations, basic-needs or private AI data, ever | M3 | C plus employer verification, lawful-posting review, fair-hiring review |
| **E. Held / restricted** | Housing leases, health and counselling services, legal, immigration, financial products, loans, proctoring or surveillance tools, AI providers that would receive student data, anything for under-18s | — | — | Not planned. Each needs its own decision, outside counsel and a domain expert before a design | Prohibited at launch |

**Prohibited outright (all classes).** The `PROHIBITED_CATEGORIES` list in `app/src/lib/gtm/sponsor.ts` (predatory lending, gambling, alcohol/tobacco/cannabis, political, adult, unverified employment, academic cheating, discriminatory offer, data broker, surveillance, unapproved financial) **is the marketplace's prohibited list too** — one list, held by one test, not two. Contract-cheating, ghost-writing and exam-answer services are in it as "academic cheating" and are the category most likely to be attempted, so the listing standard names them (section 3.4).

### 1.3 Provider types

| Type | Who they are | Verification track | Typical class |
| --- | --- | --- | --- |
| Campus unit | A department of a tenant institution (dining, housing office, athletics, library, health education information) | Tenant admin asserts the unit; no business verification; still listing standards | A, C |
| Campus-affiliated organisation | A recognised student org, foundation, campus bookstore operator | Tenant attestation plus entity check | A, C |
| Independent professional | A tutor, coach, accessibility specialist | Individual identity + qualifications as claimed + background review where counsel requires | C |
| Business | A company selling a service or product | Business verification (KYB) via the payment processor, plus section 3 | B, C |
| Employer | Company or nonprofit posting opportunities | Employer verification, lawful-posting review | D |
| Content publisher | Learning content, OER curators | Rights/licence check, accessibility of the content | B |
| Integration partner | A vendor connecting via the partner API | Section 7 certification track | B |
| Alumni organisation | Mentoring, networks | Institution attestation | A, D |

### 1.4 Launch sequencing

**Proposal.** Six phases. A phase opens for **one named tenant cohort at a time**, behind a high-risk flag that is off in production until the gate is met by evidence a person verified. This follows the audit's increment 4 ("Commerce and career": exit gate "financial controls, provider/partner governance, dispute and reconciliation workflows") and the rule that no feature is marketed before it reaches Core live or Controlled automation.

| Phase | What opens | What is still impossible | Exit gate (all evidenced, verified by a named person) |
| --- | --- | --- | --- |
| **M0 Foundation** | Schema, RLS, history and kill switch for provider, listing, order, entitlement, dispute and payout records, behind `module.marketplace` (high-risk, off); a sandbox with synthetic data; provider terms and listing standards drafted | Any real provider, any real student, any money | `supabase/marketplace.check.sql` with positive and negative cases; tenant-isolation test; counsel has the provider-terms brief; a named owner for every runbook in section 12 |
| **M1 Directory (Class A)** | Institution-approved, information-only listings; no checkout; links leave Semester with a labelled interstitial | Orders, entitlements, payment, messaging | Listing review queue staffed with a backup; report-and-takedown rehearsed; accessibility check of the listing UI |
| **M2 Approved tools (Class B)** | Tenant-approved integrations and accessibility tools, invoiced to the institution outside Semester | Student payments | Extension governance built (approval, version pin, offboarding record); security and privacy review of the first tools; subprocessor register updated before any host appears in the CSP |
| **M3 Institution-procured services (C, D)** | Orders **paid by the institution** by purchase order or invoice; opportunity listings with opt-in sharing | Student-paid checkout; Semester holding funds | Refund and dispute runbook rehearsed on sandbox money; finance owner and reconciliation dry-run signed; provider terms counsel-approved |
| **M4 Student-paid checkout (C)** | Card payment through a licensed processor that is merchant of record or payment facilitator and holds the funds; provider payouts by the processor | Anything for under-18s; instalments; pay-later | Processor onboarding approved; tax position written by qualified advisors; chargeback and fraud runbooks rehearsed; support queue measured over a full term; counsel sign-off on consumer terms |
| **M5 Ecosystem** | Partner API general availability, certified integrations, tiers, partner directory | — | Partner scorecard run for two quarters; offboarding exercised once on a real or staged provider |

The phases are *capability* order, not dates. The 90-day plans in `docs/market-readiness/` do not schedule M3 or later.

## 2. Provider lifecycle: onboarding, verification, approval

### 2.1 States (one machine, every transition audited)

`invited → applied → identity_verified → business_verified → compliance_review → listing_review → approved(class, tenants[]) → active ⇄ restricted → suspended → offboarding → removed`

- A provider is **approved per class and per tenant**, never globally. A tenant's approval (`tenant_extensions`-style row) is the institution's act, not Semester's.
- `suspended` is immediate and reversible by a human; `removed` is final and triggers section 10.
- No state is reachable by the provider editing its own record. Every transition writes an append-only history row with actor, reason and policy version.

### 2.2 Verification

| Check | Individual | Business | Employer | Campus unit |
| --- | --- | --- | --- | --- |
| Identity | Government-ID check by a verification vendor (the vendor becomes a subprocessor — registry row first) | Beneficial-owner and representative identity | Same as business | Tenant admin attests the unit and its owner |
| Existence | — | Registration, good standing, address, domain control | Same, plus a working HR contact | Tenant record |
| Sanctions and restricted-party screening | Yes | Yes, including owners | Yes | Not applicable if tenant-owned |
| Financial onboarding | Processor-run KYC | Processor-run KYB | Processor-run KYB | Tenant's own account or none |
| Qualifications | As *claimed* only; labelled "provider-stated" unless a source verifies it | — | — | — |
| Reputation and adverse media | Documented search | Documented search | Documented search | — |
| Conflict disclosure | Required (section 8.4) | Required | Required | Required |

**Proposal.** Semester does not hold identity documents; the verification vendor does, and Semester keeps the result, date and reviewer. **Counsel** decides whether background checks are required, permitted or prohibited for tutors and coaches (including jurisdictional limits) before any provider who meets minors or vulnerable students is admitted; until then the answer for those provider types is "no".

### 2.3 Compliance questionnaire (every provider answers; a person scores it)

1. Legal entity, ownership, jurisdiction, insurance held (type and limits as stated — evidence attached).
2. What the service is, who it is for, and what outcomes it does **not** promise.
3. Data: every field requested from a student, why, retention, subprocessors, location, breach-notification commitment, whether any is sold, shared or used for advertising or model training (the answer must be "no" to sale, advertising and training for Class A–D).
4. Security: authentication, encryption, vulnerability management, last independent assessment; a HECVAT-style summary for Class B.
5. Accessibility: WCAG 2.2 AA conformance report for every provider-controlled interface a student must use; a named contact; remediation plan for any gap; no AA claim without evidence.
6. Student-protection: handling of minors (age rule), complaints, safeguarding, incident history in the last five years.
7. Consumer terms: price, fees, renewal, cancellation, refund, who is the seller, what is guaranteed.
8. Licences and professional requirements for the service in each place it will be offered.
9. Academic integrity: confirmation the service does not produce work a student submits as their own.
10. Subcontractors and AI: any AI used in the service, which provider, what data reaches it (feeds the extension data policy).
11. Employer-only: lawful posting, pay transparency where required, no unpaid-work-as-job, equal-opportunity statement, how applicant data is handled and deleted.
12. Willingness to be offboarded: data-return and deletion commitments, accepted before approval (extension governance: no offboarding plan, no approval).

### 2.4 Approvals and separation of duties

**Proposal.** Approval is **two different people** with written reasons — a reviewer who runs the checks and an approver who is not the same person and is not compensated by marketplace revenue (section 8.4) — mirroring the escalation policy's two-professional rule. Class B also needs the security/privacy reviewer's sign-off; Class C also needs finance (payout risk); Class D also needs the career-services owner at the tenant. No approval is possible while the reviewer queue has no backup owner.

| Decision | Responsible | Accountable | Consulted | Informed |
| --- | --- | --- | --- | --- |
| Provider approval (Semester-level) | Trust-and-safety reviewer | Marketplace owner (operations) | Security/privacy, finance (C), legal | Tenant admins |
| Tenant approval of a provider | Tenant marketplace admin | Tenant owner | Procurement, accessibility office | Students (visibility) |
| Provider terms and take rate | Finance | CFO-equivalent | Counsel, marketplace owner | Providers |
| Suspension | Trust-and-safety analyst | Trust-and-safety lead | Marketplace owner | Tenant admins, provider |
| Payout hold or release | Finance operations | Finance owner | Trust-and-safety | Provider |
| Legal position on any of the above | Qualified counsel | Qualified counsel | — | — |

## 3. Listing standards, moderation, quality scoring

### 3.1 What a listing must contain

Provider legal name and the legal name of the *seller*; class and category; a plain-language description of what is delivered and what is **not**; total price including every fee (no drip pricing); renewal and cancellation terms; refund terms in the standard form; delivery method and expected timing; the accessibility statement and conformance evidence; what student data is requested and why; support contact and response expectation the provider will honour; a complaint route; the date verified and by whom. A listing missing any of these cannot reach `listing_review`.

### 3.2 Claims

A provider may not claim a Semester endorsement, certification, partnership, "official" status, or outcome ("raise your GPA", "guaranteed offer") unless an evidence row with a person as verifier supports it (the provider-maturity rule). Testimonials need a verifiable purchaser. AI-generated listing text is allowed only if the provider attests to it and a person reviews it. Nothing on a listing may be presented as an institutional recommendation (DO-NOT-BUILD 7).

### 3.3 Moderation

| Layer | What it does | Human involvement |
| --- | --- | --- |
| Pre-publication | Automated checks (prohibited terms, link safety, price anomalies, duplicate/clone listings, image safety) then review queue by class | A person approves every new listing and every material edit to a Class C–D listing; automation may only *hold*, never approve |
| Post-publication | Report button on every listing and provider message; automated anomaly flags (refund spike, complaint cluster, off-platform steering language, review manipulation); scheduled re-verification | A person decides enforcement; a temporary automated hold lasts hours, not days, and is reviewed by a person within the stated window |
| Appeals | Provider may appeal any restriction or removal with evidence | A reviewer who did not decide the first time |

Reviews and ratings: only a verified purchaser (or attendee, for Class A events) may rate; ratings are shown with their count and date; incentivised, provider-written or reciprocal reviews are removed; provider replies are labelled. Student identity in a review is a handle the student controls.

### 3.4 Listing standards that name the cases people try

No ghost-writing, exam-taking, "assignment help" that supplies finished work, or answer-key sales; no guaranteed admission, grade, visa, aid or job outcomes; no steering students to pay or talk **off platform** (on Class C, a fulfilment that completes off-platform voids the provider's protections); no collection of credentials; no unsolicited contact; no pressure scarcity ("only 2 left") unless true and verifiable.

### 3.5 Quality score (explainable, never purchasable)

**Proposal, with every weight a Hypothesis to be tuned on real data.** The score exists to drive *review priority, re-verification frequency and a coarse badge* — and a secondary ranking input within a relevance-sorted list. It is shown to the provider with its reasons and inputs (DO-NOT-BUILD 3).

| Input | Weight (hyp.) | Measured from | Note |
| --- | ---: | --- | --- |
| Fulfilment reliability | 25 | Orders delivered on time and as described | Verified orders only |
| Verified-purchaser outcome | 20 | Ratings and structured post-order answers | Needs n ≥ 20 verified orders to show a number; below that "New" |
| Refund and dispute rate | 15 | Share of orders refunded or disputed, adjusted for category norm | Provider-fault reason codes weigh more than buyer's-remorse |
| Responsiveness | 10 | First response and resolution against the provider's own stated times | |
| Accessibility evidence | 15 | Conformance report age and completeness; defects reported by users | A missing report caps the total at "Listed" regardless of the rest |
| Listing accuracy and compliance | 10 | Moderation findings, claims upheld, policy breaches | |
| Safety record | 5 | Confirmed safety reports | **Any confirmed P0/P1 finding is a hard stop, not 5 points** |

**Hard rules.** A score never raises an unverified provider; a hard-stop finding overrides any score; no input is a student's inferred attribute, demographic, grades or behaviour; the score is never sold, never affected by fees, tier, advertising or sponsor status; the provider can see and contest every input.

**Ranking.** Relevance to the student's *stated* need first; then quality bands (not the raw number); never tier, fee or sponsorship. Sponsored placement, if it ever exists, is a separate, labelled slot governed by `sponsor.ts` and sits outside the protected surfaces (AI answers, advising, course recommendations, degree plan, registration, financial-aid deadlines, add/drop, crisis support, accommodations, grades). Every listing card carries its *why shown*, *who paid*, *what data is shared* and a *hide* control (the J-14 card).

## 4. Order, entitlement, refund, dispute, payout, support, tax and fraud

**Design stance.** Semester does not custody student or provider funds. Money moves through a licensed processor (merchant of record or payment facilitator) that does the identity checks on payees, holds funds, pays providers out and files the tax forms it is responsible for. **Counsel and qualified accountants** confirm the structure before M4 (section 11); the workflows below assume it and fail closed if it does not hold.

### 4.1 Order lifecycle

`cart → quoted (price, fees, tax shown; terms version recorded) → pending_payment → paid (processor event, idempotent) → entitlement_issued → fulfilling → delivered → completed (after window) | refund_requested → refunded | disputed → resolved(outcome) | cancelled | failed`

Rules:

- **The processor's signed event is the only thing that moves an order to `paid`.** A client cannot, and a webhook replayed ten times changes nothing (idempotency key on every command; correlation id on every row). This is the pattern D-132 already uses for cancellation: the provider accepts first, Semester records second.
- Every state shows the student what is true now: *pending*, *failed*, *refunded* — never a fake success (preamble rule 4).
- The price, fees, tax, seller identity, refund terms and listing version are **frozen on the order** at quote time.
- A confirmation is required before payment (the existing checkbox pattern: amount, renewal, where to cancel). No pre-ticked boxes; no dark patterns (DO-NOT-BUILD 4).

### 4.2 Entitlement

An **entitlement** is the record that a student is allowed something: source order, provider, scope, start, end, status (`active · paused · expired · revoked`), and who revoked it and why. It is the single thing the provider's service checks.

- Issued on `paid`; revoked on full refund, upheld chargeback, provider suspension *where continuing is unsafe*, or expiry.
- **Floor.** Whatever the outcome, a student keeps access to, and the export of, anything they created or uploaded inside Semester (D-009). A provider's suspension never deletes the student's own work.
- Institution-procured entitlements are issued from the institution's order and revoke when the seat is withdrawn, with notice to the student.

### 4.3 Refunds

**Proposal.** One standard refund policy form that every Class C listing must adopt or exceed, written by counsel (the draft at `docs/legal/REFUND-AND-CANCELLATION-POLICY-DRAFT.md` is the Semester Plus policy and does not cover third-party sellers). Mechanics: a student requests; the provider answers within its listed window; unanswered or refused requests go to Semester review; refunds go to the original payment method; the provider's payout is debited or the reserve is used; no student is told to take a refund as credit. A refund never reverses the student's right to export.

| Reason code | Default outcome (to be set with counsel) | Provider-score effect |
| --- | --- | --- |
| Not delivered / not as described | Full refund | Counts against provider |
| Provider cancelled | Full refund | Counts against provider |
| Duplicate or unauthorised charge | Full refund; fraud case | Fraud workflow |
| Student changed mind within the listed window | Per the listing's stated policy, never less than the standard form | Neutral |
| Accessibility barrier prevented use | Full refund; accessibility finding opened | Counts against provider |

### 4.4 Disputes

Ladder: **(1)** student ↔ provider resolution window (messaging kept on platform, reported content reachable by trust-and-safety under the consented-access rule); **(2)** Semester human mediation with the order record, the listing as it was at purchase, and both parties' evidence; **(3)** processor chargeback process — Semester assembles the evidence packet but the processor decides; **(4)** for institution-procured orders, the institution's escalation contact. Every outcome has a code, a written reason and an appeal path to a reviewer who did not decide it. Semester mediates the *marketplace order*; it does not adjudicate academic-integrity, discrimination or conduct matters — those route to the institution's own process.

### 4.5 Payouts

- Provider is paid by the processor to a verified account; **a change of payee or bank details has a cooling-off period and out-of-band confirmation** (existing control), and is never approved by one person.
- **New-provider reserve** (percentage and period are Hypotheses set by finance with counsel) and a **delayed release** until the order's dispute window has passed.
- **Holds:** an open P0/P1 case, a fraud flag or a sanctions hit stops payout automatically; releasing a hold takes two people.
- **Negative balances** are recouped from future payouts or the reserve; unrecoverable amounts are a finance matter, not auto-written-off.
- Monthly reconciliation of orders, processor reports, payouts, refunds and fees (existing finance control), with an exceptions list reviewed by someone who did not run the payouts.
- **Counsel:** unclaimed-funds rules, payout currency, cross-border payees, minimum thresholds.

### 4.6 Support

Three tiers: **(1)** provider answers first for fulfilment questions within its stated response; **(2)** Semester support for anything involving money, safety, access or a provider who has not answered, using the existing consent-based, time-bound, audited support-access rule — no standing view of a student's records; **(3)** trust-and-safety and finance for holds, disputes and safety. Marketplace help is reached from the same place as all help (DO-NOT-BUILD 6). **Fact:** support is `INTERNAL` with no staffed queue; **Proposal:** the support policy promises no response time publicly, matching the contact page, until the queue has been measured.

### 4.7 Tax

**Counsel and qualified tax advisors**, before M3 for institution orders and M4 for student orders. The design requirements are: tax calculation by a tax service at quote time, shown before payment; the seller of record identified on every receipt; tax-exempt institution certificates stored with the tenant and applied to institution orders; provider tax identity collected by the processor, not by Semester; a record that supports whichever marketplace-facilitator and information-reporting obligations the advisors determine apply, by place; separate treatment of digital goods, services and physical goods; an audit trail for every tax decision. Semester does not "decide" tax in code — it applies the tax service's result and records it.

### 4.8 Fraud

| Threat | Controls (Proposal) |
| --- | --- |
| Stolen cards / carding | Processor fraud tooling; velocity limits per payer and per provider; 3-D Secure where available; small first-order limits |
| Fake or cloned provider | KYB, domain control, sanctions screening, clone detection, new-provider reserve, listing review |
| Account takeover (student or provider) | MFA/passkeys for providers (required), device and session management, step-up on payout or payee change |
| Collusive refund / dispute abuse | Reason-code pattern monitoring, cross-order link analysis, human review before payout hold release |
| Review manipulation | Verified-purchaser-only, velocity checks, removal and score reversal |
| Payout redirection | Out-of-band payee verification, cooling-off, two-person approval, alert to the old contact |
| Off-platform steering, phishing in messages | Link scanning, keyword and pattern flags, reporting, warning banners, enforcement |
| Student impersonation / fake discount abuse | Verification through the institution's identity provider where an offer is restricted to students |

**Boundary.** Fraud analytics score *transactions, providers and sessions*. They do not build behavioural risk profiles of students, use academic, family, support or conduct data, or make an adverse decision about a student without a human review and an appeal (boundaries `surveillance` and `ai-decisions`). A student whose payment is declined sees a reason and a way to reach a person.

## 5. Student and institution controls

### 5.1 Institution (tenant) controls

All default **off**. Each is a setting, an audit event and a flag the tenant admin owns; none needs custom code.

| Control | Options | Notes |
| --- | --- | --- |
| Marketplace | Off / On | One switch; off hides every marketplace surface for the tenant and revokes provider data access |
| Visibility mode per category | Hidden · Information only · Visible and purchasable by students · **Institution-purchased only** · Required through procurement | "Required through procurement" is how a campus keeps an existing exclusive contract (for example a bookstore) honoured |
| Provider allow-list | Approve, restrict (to named courses or programs), pilot, suspend, remove — per provider **and per version** | Matches `tenant_extensions` states |
| Procurement | Purchase-order and invoice flow, approver chain, budget caps per unit and per term, funding source (institution / student / split), tax-exempt certificate on file | Institution approvals are institution decisions; Semester records them |
| Data-sharing ceiling | Classification ceiling per provider and per category (T0–T5) | Anything above the ceiling is refused by the platform, not by the provider's promise |
| Sponsorship and advertising | Off by default (existing policy); a tenant may forbid contractually | A tenant cannot be opted in by Semester |
| Reporting | Aggregate only: orders, refund and complaint rates per provider, accessibility defects. **No student-level reporting** to the institution | The small-cohort suppression rule held by `app/src/lib/cohortfloor.test.ts` applies |
| Provider incident feed | Tenant admin is told when a provider it approved is restricted or suspended | See section 9 |
| Revenue share to the institution | **Held** — Counsel (section 11, item 14) | Avoid it until procurement-ethics counsel has answered |

### 5.2 Student controls

| Control | Behaviour |
| --- | --- |
| Turn off the marketplace entirely | One setting; nothing else in Semester depends on it |
| Hide a provider, a category, or "anything sponsored" | Persistent and reversible; hidden providers cannot contact the student |
| Why shown / who paid / what is shared / hide | On every card (the J-14 spec) |
| Consent per provider | A plain-language screen listing fields shared, purpose and retention; defaults to sharing nothing; revocable, with the revocation propagated to the provider and logged |
| Messages | On-platform; the student controls who can start a conversation; report and block on every message |
| Orders | Full history, receipts, entitlements and a one-tap export; refund request and dispute status visible |
| Under-18 and guardian | **No marketplace for under-18s until counsel and a safeguarding review say otherwise.** Guardian visibility of a student's purchases only through the existing consent model, or where the guardian paid |
| Accessibility | Every marketplace surface is keyboard, screen-reader and reduced-motion tested before it opens; price and terms are in text, not only in images |

## 6. Partnership strategy by ecosystem

**Rule for every row.** Native first: Semester works without the partner (the audit's "native when necessary, connected when available"). A partner is an *accelerator, import channel or distribution channel* — never the only way a capability works. No partnership, certification, "works with" or logo appears anywhere until an evidence row exists whose verifier is a person (provider-maturity rule), and a listing in a partner's directory is not an endorsement.

| Ecosystem | Why it matters | Integration pattern | Native fallback | First move (a design-partner pilot, not a launch) | Never |
| --- | --- | --- | --- | --- | --- |
| **LMS** (Canvas, Brightspace, Blackboard, Moodle-class) | Where coursework and grades already live | LTI 1.3 launch and deep linking; read-only course/assignment import first; grade passback only by tenant approval | Native courses, assignments, calendar (manual and import) | One tenant, one LMS, read-only, reconciliation report | Silent sync failure; writeback by default; scraping credentials |
| **SIS** (Banner, PeopleSoft, Colleague, Workday-class) | Authoritative records | Institution-controlled export or API, read-only, reconciled; no direct SIS connection in v1 (boundary `sis-direct`) | Native registration, schedule and degree-plan modules under controlled parallel run | Roster and term-calendar feed for one program | Claiming replacement before parallel-run evidence and counsel review |
| **IdP / identity** (Entra, Okta, Google, federation such as InCommon) | One identity; student verification for restricted offers | SAML/OIDC SSO, SCIM provisioning, group-to-role mapping, passkeys | Semester identity domain | One tenant SSO, SCIM off until deprovisioning is tested | Over-broad claims or scopes; provisioning without a deprovisioning test |
| **Payments** | Required before any money | Processor with a marketplace product (merchant-of-record or facilitator), hosted checkout so card data never touches Semester, signed webhooks | None for money — **the marketplace stays held if this is not approved** | Sandbox-only until M4 gate | Semester custody of funds; card data in Semester; payout code outside the processor |
| **Campus services** (dining, housing, transit, library, health education, bookstore, campus card) | Daily relevance | Tenant-approved feeds; information listings first; campus-card/ticketing later | Directory, maps, events native | One unit's hours-and-menu information (Class A) | Health/counselling services as listings (Class E); stale information shown as current — freshness SLO required |
| **Career** (employers, career-platform vendors, alumni) | Outcomes | Opt-in artifact sharing, employer verification, lawful imports only | Native portfolio, opportunities, pathways | One career-services office, employer-verified events only | Employers receiving student-level data; paid placement; discriminatory targeting; scraping profiles |
| **Learning content** (OER, publishers, tutoring) | Substance | LTI deep-link content; licence metadata; accessibility of content captured at listing | Native study tools and sources | Open/licensed content only with rights recorded | Reselling content without rights; hidden paywalls on core study flows |
| **AI** | Capability and cost | **Suppliers, not marketplace listings:** model providers sit behind the AI gateway under the per-tenant provider list and recorded terms (`provider-terms.ts`, where every document is `published` and none `accepted` or `signed`). Third-party AI *tools* in the marketplace are Class B and need an extension data policy | Native AI services | Keep supplier terms in the vendor register; any AI tool listing waits for M2 | Student data to a provider whose terms are not accepted and filed; training on student content; tool use without human confirmation on consequential actions |
| **Accessibility** | Differentiator and obligation | Class B category with disability-services-office approval; captioning/transcription, reading and dyslexia-aware tools, alt-text | Native accessibility modes | Office-approved tools only, evidence-based | Anything that requires disclosing a disability to a provider without the student's explicit consent; accessibility as a premium tier |
| **Employer ecosystem** | Opportunity | Employer verification, event and listing publication via `marketplace_partner` role with `opportunity:publish` only | Native opportunities | Career-office-curated employers | Any access to grades, accommodations, basic-needs or private AI data; "talent search" over student profiles |

**Partner motions that are not marketplace.** Implementation and referral partners follow [`PARTNER-AND-CHANNEL-STRATEGY.md`](PARTNER-AND-CHANNEL-STRATEGY.md) — a referral or reseller motion waits until the direct motion is repeatable. A partner cannot consent to unrelated marketing of an individual. Discounts and commissions never buy a claim, a favourable research result, or a safety or accessibility compromise.

## 7. API, SDK and partner integration requirements

**Proposal.** One versioned partner surface, designed once and used by Semester's own first-party connectors so the public contract is exercised daily.

### 7.1 Platform requirements

| Area | Requirement |
| --- | --- |
| Contract | OpenAPI 3.1 spec as the source of truth; semantic versioning; additive changes only within a major; changelog; **deprecation notice of at least twelve months** for a breaking change (Hypothesis; set with counsel and the first partners) |
| Auth | OAuth 2.0 authorization-code with PKCE for user-delegated access; client-credentials for server-to-server; short-lived tokens; **scopes map to the classification classes T0–T5** and to a tenant; a token can never exceed the tenant's ceiling; mutual-TLS optional for high-risk partners |
| Tenancy | Every call is tenant-scoped; the partner sees only tenants that approved it; cross-tenant calls are impossible by construction and covered by the tenant-isolation test |
| Webhooks | Signed (HMAC with timestamp), replay-protected, retried with backoff, dead-letter queue, delivery log visible to the partner for its own events; secret rotation without downtime |
| Idempotency | Idempotency key required on every write; correlation id returned and logged |
| Rate limits | Per partner, per tenant and per endpoint, documented, with `Retry-After` |
| Sandbox | Synthetic data **only** — never copied from production; separate credentials; reset on demand; contract tests run against it |
| Data | Minimum necessary fields; no bulk export of student data to a partner; field-level provenance (who asserted it and when); partner may write only its own listings, orders, fulfilment status and entitlements |
| Audit | Every partner call is an audit event the tenant can export and the partner can see for its own activity |
| Kill switches | Per partner, per tenant, per scope, global (`kill.extensions`-style); a revoked credential fails closed within a stated bound |
| Embedded surfaces | LTI 1.3 or a sandboxed frame with a restrictive content-security policy; **no third-party script runs in the first-party app**; a new host appears in the CSP only after its subprocessor row exists (`subprocessors.test.ts`); no advertising or tracking SDK (DO-NOT-BUILD 10) |
| Accessibility | WCAG 2.2 AA conformance evidence for every partner-controlled interface a student sees; a named accessibility contact; defects are a listing finding |
| Reliability | Published status page; incident notification to Semester within a stated window; support contact reachable in a defined time; degraded-mode behaviour documented (a partner outage never breaks a native workflow) |
| Security | Secrets in a vault, rotation, least privilege, vulnerability-disclosure contact, annual assessment evidence for Class B+ |

### 7.2 SDKs and tooling

| Deliverable | Notes |
| --- | --- |
| TypeScript SDK, then Python | Generated from the OpenAPI spec, no bundled telemetry, no network calls beyond the API |
| Sandbox CLI and mock server | Reuses `mock-adapter`/`mock-campus` style fixtures already in `app/src/lib/integration/` |
| Conformance suite | The tests a partner must pass for Integrated status: auth, tenant isolation, idempotency, webhook signature and replay, rate-limit behaviour, data-minimisation, offboarding revocation, accessibility smoke |
| Partner portal | Credentials, scopes, sandbox, delivery logs, listing management, scorecard view, incident contact — itself accessible and itself behind the same controls |
| Docs | Quick-start to first sandbox call, data dictionary, error catalogue, runbook for a partner incident |

### 7.3 Partner agreement requirements (inputs for **Counsel**)

Roles under data-protection law for each flow; permitted purposes; no sale, no advertising, no training use; sub-processor flow-down; breach notification window; deletion and return on exit; audit right; accessibility warranty; insurance; indemnity; service levels; confidentiality; claims and brand rules; suspension and termination for cause; survival of student-protection terms.

## 8. Revenue model, take rate, incentives, conflicts, tiers

### 8.1 Streams

| Stream | Phase | Basis | Position |
| --- | --- | --- | --- |
| None | M0–M2 | — | Nothing is charged. Class A is free to list and to read |
| Institution platform and implementation fees | Existing | Separate from the marketplace | The marketplace does not subsidise, and is not subsidised by, institution pricing |
| Transaction fee on Class C | M3 (institution-invoiced) / M4 | Percentage of order value net of refunds and tax, plus processor pass-through | The primary marketplace revenue line |
| Integration partner fees | M5 | Usage or seat for commercial partners that use the partner API at scale | Not charged to campus units or nonprofits |
| Employer listing/event fees | M3+ if cleared | Flat fee per campaign or seat | **Counsel** first; never priced by access to students, never by placement rank |
| Sponsorship | Separate gate | `sponsor.ts` | Off by default; never student-data-targeted; not a marketplace ranking input |
| Listing / verification fee | Not recommended | — | A fee to be listed filters out small campus providers; if ever used, it covers *verification cost only* and is waived for campus units |

### 8.2 Take rate — Hypotheses, to be set by finance and checked against real contribution margin

| Class | Starting hypothesis | Reason |
| --- | --- | --- |
| A, B | 0% | Information and tools; revenue elsewhere |
| C institution-invoiced | 5–10% of net order value | Lower dispute and fraud cost; invoice carries no card fee |
| C student-paid | 10–15% of net order value, processor fees passed through visibly | Covers dispute, fraud, support and tax operations |
| D | 0% on opportunities; flat fee on employer campaigns if cleared | Do not charge per student reached |
| Earned discount | Up to a stated reduction for providers at the top quality band with accessibility evidence, ≥ N verified orders | Earned by evidence; never bought |

**Illustrative unit economics (assumptions, not data).** A $50 tutoring order, 12% take = $6.00; payment processing assumed at about 3% = $1.50 (verify against the processor's current published rates); expected refunds and disputes assumed at 4% of orders costing the average order plus $15 of handling = $3.00 average per order *when it happens*, ≈ $0.12 expected; support at 0.15 tickets per order × $6 = $0.90. Contribution ≈ $6.00 − $1.50 − $0.12 − $0.90 ≈ **$3.50 per order** before tax operations, fraud losses, reserve cost, and the staffed queue. At that margin the marketplace pays for itself only at volumes that need real demand evidence; **marketplace take rate** (existing dashboard metric: marketplace gross profit ÷ GMV) is therefore tracked from the first sandbox order, and no phase is opened *because* the model needs the revenue.

### 8.3 Incentives

Allowed: earned fee reductions; first-order fee waiver for campus units; co-marketing *information* with disclosed relationship. Not allowed: paid ranking; paying students to share data, refer peers or buy; commissions to staff, advisors, faculty or student ambassadors tied to student purchases; "free trial" mechanics that need card capture to start for Class C; any incentive that depends on a student's data.

### 8.4 Conflict management

| Conflict | Risk | Control |
| --- | --- | --- |
| Semester earns more when more orders complete | Approves marginal providers; softens enforcement | Reviewers and trust-and-safety are **not paid on GMV or take**; approval needs a person outside revenue; trust-and-safety lead can block and the block is reported to the board-equivalent |
| Semester's own products compete with listings (study tools, AI tutor, premium plan) | Self-preferencing | Ranking is revenue-blind and first-party items carry a "from Semester" label; first-party never gets a quality score advantage; recorded in the ranking test |
| Institution benefits from provider revenue | Institution steers students | No revenue share to institutions until Counsel clears it; institutional controls are visibility and procurement, not commission |
| Employers pay and want reach | Pay-to-play, discrimination | No targeting by protected or inferred attributes; no placement for sale; opt-in only |
| Provider is also a Semester vendor or investor | Favourable treatment | Conflict disclosure at onboarding; related-party providers get a second reviewer and public disclosure on the listing |
| Staff or advisors hold interests in a provider | Biased approval | Annual declaration; recusal recorded |
| Sponsor and ranking | Pay-to-win | Separate slots, protected surfaces, labelled; no data |

### 8.5 Partner tiers

**Proposal.** Tiers describe *evidence*, never price. Each has a verifier (a person), a date and an expiry; an expired tier reverts the display to the level below.

| Tier | Name | Evidence | What it may say | What it may not |
| --- | --- | --- | --- | --- |
| P0 | Prospect | Conversation only | Nothing | Any relationship wording |
| P1 | Listed | Identity and listing standards passed, tenants approved | "Listed on Semester for [tenant]" | "Verified", "partner", "certified" |
| P2 | Verified | P1 + business verification + compliance questionnaire + accessibility evidence, re-verified on schedule | "Verified provider" with the date | Endorsement, outcome claims |
| P3 | Integrated | P2 + conformance suite passed + sandbox + support and incident contacts + data-flow review | "Integrates with Semester (tested [date])" | "Certified" unless a certification evidence row exists |
| P4 | Strategic | P3 + executed partner agreement + joint plan + executive sponsor, per the channel strategy | Only what the agreement authorises | Exclusivity, preferred ranking, student data access |

The **institution's** approval is a separate, per-tenant status that Semester displays but does not grant. Nothing about a tier changes a provider's ranking.

## 9. Trust-and-safety policy and escalation

### 9.1 Principles

People decide consequential outcomes; automation may hold, flag and route. Student safety outranks marketplace revenue. Every report gets an acknowledgement and a human owner. Enforcement is proportionate, explained and appealable. Evidence is preserved before anything is deleted. Reporters are protected from retaliation. Semester does not promise 24/7 or emergency response; crises are routed to people and published resources (existing crisis notice).

### 9.2 What is reportable

Fraud or deceptive pricing; unsafe or illegal service; harassment, threats, sexual misconduct or grooming; discrimination; solicitation of academic dishonesty; impersonation or fake credentials; privacy violation or unauthorised data collection; off-platform steering and phishing; accessibility barriers; counterfeit or stolen goods; self-harm or crisis content; minors in a restricted context; intellectual-property infringement (DMCA procedure, designated agent subject to **Counsel**).

### 9.3 Severity and response

Targets are internal; none is published or promised until measured over a term.

| Severity | Examples | Immediate action | Owner | Internal target (Hypothesis) |
| --- | --- | --- | --- | --- |
| **P0** | Credible threat to a person's safety; suspected exploitation or grooming; self-harm; active account compromise exposing student data; live fraud ring | Suspend provider and listings; freeze payouts; preserve evidence; **people-routed crisis handling**; open an incident; inform the security/privacy owner | Trust-and-safety lead + incident manager | Human on the case within one hour of detection in staffed hours |
| **P1** | Serious harassment or discrimination; a confirmed data-handling breach by a provider; payment fraud; credential misuse; repeated policy violation after warning | Restrict; hold payouts; notify affected tenants; preserve evidence | Trust-and-safety lead | Same business day |
| **P2** | Deceptive listing, refund failures, accessibility barrier, off-platform steering | Warn; correct or remove listing; compensate student if owed; score impact | Analyst | Two business days |
| **P3** | Minor listing defect, unclear terms | Educate; fix request | Analyst | Five business days |

### 9.4 Escalation

1. **Intake** — in-product report, email, tenant-admin report, processor alert, or detection. An acknowledgement goes to the reporter.
2. **Triage** — a person assigns severity and a case owner. A case with no owner, or an owner without a backup, escalates to the marketplace owner.
3. **Contain** — suspend, restrict, hold payouts, revoke entitlements *only where continuing is unsafe*; the student keeps their own work.
4. **Investigate** — preserve evidence; the reviewer who decided originally does not hear the appeal; consent-based, time-bound, audited access to any private content.
5. **Decide and notify** — written reason to the provider and the reporter (within what privacy permits); tenants told of any approved-provider restriction.
6. **External escalation** — to an institution's safety or conduct office, regulators or law enforcement, **only** under the existing escalation rules: P0/P1, a category the written agreement covers, **two different professionals** with written reasons, an allowlisted minimum payload, no automation or volunteer approval. Law-enforcement requests follow the law-enforcement-request procedure draft. **Counsel** decides reporting duties (including for minors and for cases that involve child safety).
7. **Learn** — a post-incident review; changes to listing standards, score inputs or tests; transparency reporting of counts by category and outcome.

Roles: marketplace owner (operations), trust-and-safety lead, analysts, finance owner, security/privacy owner, counsel, tenant admins. Moderator access is **report-and-case scoped**, never open-ended; moderators get wellbeing support and rotation. **Fact:** no trust-and-safety lead, backup or counsel is named in this repository today.

## 10. Partner scorecard and offboarding

### 10.1 Scorecard

Reviewed quarterly for P2 and above, annually in depth, and on any trigger (P0/P1 case, complaint spike, security or accessibility defect, ownership change, contract change). Thresholds are Hypotheses for the first two quarters, then tuned. A red line is a **hard stop**, not a point deduction.

| Dimension | Measures | Green | Amber | Red line |
| --- | --- | --- | --- | --- |
| Student outcome | Verified-purchaser rating, completion rate, repeat use | Meets category norm | Below norm for a quarter | Confirmed harm |
| Operational quality | On-time fulfilment, first-response and resolution vs stated | ≥ target | Missed once | Repeated misses after warning |
| Trust and safety | Reports per 1,000 orders, upheld findings, time to remediate | None upheld | Any P2 upheld | Any P0/P1 upheld |
| Financial integrity | Refund rate, dispute rate, chargeback ratio, payout exceptions | Within band | Rising | Processor threshold approach; fraud finding |
| Security and privacy | Questionnaire currency, incident record, data-flow changes, subprocessor changes | Current and clean | Overdue evidence | Undisclosed data use; breach not reported in window |
| Accessibility | Conformance report current, defects open and age | Current; none critical | Report ageing | Unremediated critical barrier |
| Integration health | Conformance pass, webhook success, error rate, deprecation compliance | Pass | Degrading | Fails isolation, replay or revocation test |
| Commercial and relationship | Terms adherence, claims accuracy, support responsiveness | Clean | Warning issued | Unauthorised claim; steering off platform |
| Institutional fit | Tenant approvals, tenant complaints, tenant removals | Stable | One removal | Removal by multiple tenants |

The scorecard is visible to the provider with reasons and evidence; a summary (no student-level data) is visible to approving tenants.

### 10.2 Offboarding

Kinds: **voluntary**, **for cause**, **emergency suspension**, **tenant removal** (only that tenant's approval ends), **partner exit** (integration or agreement ends). The extension rule applies: removal has a path *before* approval, and completion is blocked until data return or deletion is recorded.

| When | Step | Owner |
| --- | --- | --- |
| T0 | Decision recorded with reason and two approvers (emergency suspension may start with one and is confirmed by a second within the stated window); new orders and new consent stop | Trust-and-safety |
| T0 | API credentials and webhook secrets revoked or scoped down; embedded surfaces unloaded on next load; claims, logos and listings removed | Engineering + marketing |
| T0–T1 | Open orders: fulfil, transfer to another provider with the student's choice, or refund; entitlements per the floor in section 4.2 | Finance + support |
| T0–T1 | Notify affected students and approving tenants with a clear reason and next steps; no defamation, no unverifiable allegations | Trust-and-safety + comms |
| T1+ | Payouts held until the dispute window passes; reserve applied to refunds and chargebacks; final reconciliation | Finance |
| T1+ | Data: provider returns or deletes everything it received, signed confirmation recorded; Semester deletes provider-side personal data on its own schedule subject to **legal hold**; audit evidence kept per retention schedule | Privacy + provider |
| T+30 (Hypothesis) | Post-mortem; update listing standards, score inputs, tests; decide re-application eligibility and cooling-off | Marketplace owner |
| Always | A student's own work and export remain accessible; a legal hold overrides deletion without hiding request status | Privacy |

**Reinstatement** needs a new application, fresh verification, and a reviewer who was not on the original decision.

## 11. Required legal and counsel review items

**This page makes no legal conclusion.** Each row is a question for qualified counsel (and, where marked, tax and financial advisors). Per the counsel brief, nothing relies on an answer until it is recorded as a decision with counsel's name and date. "What the page assumes" is a placeholder to correct, not an answer.

| # | Question | What the page assumes | Unblocks |
| ---: | --- | --- | --- |
| 1 | **Money-handling structure.** Does using a licensed processor as merchant of record or payment facilitator keep Semester outside money-transmission and similar licensing regimes in each place it operates? | Semester never holds funds | M4; the whole payout design |
| 2 | **Seller of record and consumer-protection regime.** Who is the "seller" to a student; which consumer-protection, auto-renewal, cooling-off and disclosure rules apply to a marketplace order, by place? | Provider is seller; Semester is facilitator; the standard refund form meets or exceeds the strictest case | Refund policy; terms; listing form |
| 3 | **Marketplace-facilitator tax and information reporting** (advisors). Collection, remittance and reporting for sales, digital goods, services; payee forms; VAT or equivalent for cross-border | The tax service computes; the processor collects payee identity | M3/M4; receipts |
| 4 | **Provider terms and marketplace terms.** Agency vs principal, indemnity, insurance, liability limits, claims and brand, suspension rights, dispute procedure and governing forum | Drafted from section 7.3 and the existing MSA drafts | Provider onboarding |
| 5 | **FERPA and student-record exposure.** When a provider or employer receives any information about a student, which flows are directory information, consented disclosure or school-official arrangements; does any marketplace flow create an education record | No education-record data flows to providers; consent per provider | Class B–D data ceilings |
| 6 | **Minors.** Whether any marketplace flow may reach under-18 students, consent and guardian rules, safeguarding duties, mandatory reporting | None — marketplace closed to under-18s | Any K-12 or dual-enrolment path |
| 7 | **Background checks and licensing** for tutors, coaches and anyone meeting students; occupational licences by place | Not required at launch because such providers are held | Class C individual providers |
| 8 | **Sanctions, export and anti-corruption.** Screening scope, ownership thresholds, handling of hits, gifts and hospitality rules | Screen providers and owners at onboarding and on re-verification | Onboarding |
| 9 | **Employer and opportunity law.** Posting rules, pay-transparency, unpaid-internship rules, fair-hiring, whether any screening makes Semester a consumer-reporting participant, discrimination and ad-targeting limits | Opt-in artifact sharing; no talent search | Class D |
| 10 | **Platform and content liability.** Hosting and moderation duties, notice-and-takedown, designated agent, transparency or risk-assessment duties in places that impose them | Report-and-takedown with a human decision | Moderation policy; terms |
| 11 | **Accessibility obligations** for provider content and for Semester as a platform; what accessibility claims may be made; procurement expectations (conformance report formats) | WCAG 2.2 AA evidence required; no claim without it | Listing standard; public statement |
| 12 | **Privacy roles and notices.** Controller/processor roles per flow, lawful basis, notice and consent text, cross-border transfers, retention, rights requests across Semester and provider | No sale, no advertising, no training; per-provider consent | Privacy notice; DPA; partner agreement |
| 13 | **AI.** Terms for any AI used inside a provider's service or by Semester on marketplace data; whether any listing involving AI needs additional disclosures | AI tools are Class B and gated by the extension data policy | M2 |
| 14 | **Institutional procurement and ethics.** Revenue share or fees paid to an institution; gifts and conflicts for public and private institutions; exclusive-contract compatibility; purchase-order and invoice terms | No revenue share; institution controls only | Institution fee design |
| 15 | **Payments disputes and chargebacks.** Liability allocation between Semester, provider and processor; evidence standards; reserves and set-off rights | Provider bears fault-based refunds and chargebacks | Payout terms |
| 16 | **Unclaimed funds, currencies and cross-border payees** | Domestic only in M4 | Payout design |
| 17 | **Claims.** Which phrases about the marketplace, partners, certification, verification and safety may be used in any channel | None until evidence; see the claims library | All marketing |
| 18 | **Insurance** for Semester and required of providers | Unknown | Provider terms |
| 19 | **Housing, health, legal, immigration and financial listings** if ever proposed | Held (Class E) | Any Class E decision |
| 20 | **Law-enforcement and regulator requests; incident-notification duties** to institutions, students and authorities | Existing procedure drafts | Escalation step 6 |

## 12. Launch gates: what the controls are and where they stand

Nothing in sections 1–10 may open for real students, providers or money until its row is `evidenced`. The "state" column is what this repository shows today.

| Gate | Evidence required | Opens | State at `7287ddc` |
| --- | --- | --- | --- |
| G-OWN | Named marketplace owner, **backup**, trust-and-safety lead and backup, finance owner, counsel | M1 | **Not met** — only the company-side owner is named; the rest are unassigned (channel strategy, counsel brief) |
| G-DATA | Marketplace tables with RLS, immutable history and a kill switch; `supabase/marketplace.check.sql` positive and negative; flag `module.marketplace` high-risk, off, production refused | M0 → M1 | **Not met** — no marketplace tables exist |
| G-TERMS | Counsel-approved provider terms, listing standards, refund form, privacy notice | M1 (Class A terms), M3 | **Not met** — drafts only; counsel unnamed |
| G-QUEUE | Staffed review and trust-and-safety queue with backup; measured response over at least a term | M1 | **Not met** — support `INTERNAL`, no staffed queue |
| G-ACCESS | WCAG 2.2 AA test plan and manual assistive-technology pass on every marketplace surface | M1 | **Not met** — no marketplace surface; the accessibility statement itself still awaits a pass |
| G-EXT | Extension governance built; subprocessor rows before any new CSP host; data-flow review | M2 | **Not met** — designed, not built |
| G-PROC | Institution procurement flow, tax-exempt handling, finance dry-run | M3 | **Not met** |
| G-PAY | Processor approved; sandbox orders through the full lifecycle; reconciliation rehearsed; refund, dispute, fraud and payout runbooks rehearsed with named owners | M3 → M4 | **Not met** — only Semester Plus on test keys; `individual-ga` is BLOCKED |
| G-TAX | Tax position written by qualified advisors; tax service integrated | M3/M4 | **Not met** |
| G-RISK | Fraud monitoring, payout holds, two-person approvals, payee-change controls live | M4 | **Not met** |
| G-LEGAL | Items 1–6, 12, 15 answered and recorded with counsel's name and date | M4 | **Not met** |
| G-EXIT | Offboarding exercised end to end on a staged provider | M5 | **Not met** |

**Decisions requested from the owner.** On 4 Oct 2026 the owner accepted (a) to (d) as written: (a) the marketplace stays held until G-OWN, G-DATA, G-TERMS and G-QUEUE are met; (b) "no pay-to-win placement or paid ranking" moves from *proposed* to a held boundary, with a test still owed; (c) the class model, with Class E staying prohibited; (d) the processor-holds-funds principle as a precondition for M4. They are recorded together as one decision, [`D-1236`](../decisions/D-1236.md), as `docs/decisions/` asks. (e) naming counsel and the backup owners is **still open**.

## 13. Preamble outputs

### Assumptions

- Semester is a multi-tenant system where the institution governs what its students see; the marketplace therefore defaults to **off**, **hidden**, and **sharing nothing**.
- A licensed processor will hold funds and onboard payees; if not, M4 does not open.
- Take rates, weights, reserves, targets and thresholds in this page are **Hypotheses** and carry no evidence.
- The audit PDF's prompt text was read in full for this role and its surrounding sections (roles, RACI, domain model, risks, the shared preamble); the audit's architecture and delivery sections were read selectively.
- Partner and product names are *classes of counterparties* used as examples; no relationship, integration or endorsement with any is claimed.

### Risks and unresolved questions

Regulatory (section 11); revenue incentive vs safety (8.4); empty marketplace and low liquidity (a thin directory is worse than none — phase on named cohorts); accessibility of third-party content; provider concentration; fraud and chargebacks outrunning the staffed queue; a first outage in the payment or webhook path; scope pressure to open M4 for revenue before G-RISK; the "no pay-to-win" rule being only *proposed*.

### Files changed or proposed

*Changed:* this page; `docs/market-readiness/CAPABILITY-STATUS-REGISTRY.json` (one new row, `marketplace`, `BLOCKED`). *Proposed, not built:* `supabase/migrations/<ts>_marketplace.sql` and `supabase/marketplace.check.sql`; `provider_registry`, `provider_certifications` (provider-maturity doc); `extension_catalog`, `tenant_extensions`, `extension_reviews`, `extension_offboarding_records` (extension doc); `marketplace_listing`, `marketplace_order`, `marketplace_entitlement`, `marketplace_dispute`, `marketplace_payout`, `marketplace_case`; flag `module.marketplace` in `app/src/lib/flags.ts`; `docs/trust/MARKETPLACE-PROVIDER-TERMS-DRAFT.md`; runbooks listed under *Operational*; a held-boundary entry for no paid ranking.

### Tests added

None. This is a document, and a page that asserts a test exists would be a fake success state. **Proposed**, each to be shown failing against a faithful revert before it is trusted:

- Ranking is invariant to fee, tier and sponsor status (property test over randomised inputs, with a control that does vary on relevance).
- A provider with no verifier-person evidence row renders no "verified", "partner" or "certified" wording anywhere.
- An order moves to `paid` only from a signed processor event; replaying the event ten times changes nothing.
- A refunded or suspended provider's entitlement revokes, and the student's export still works.
- A token cannot read above its tenant's classification ceiling or in another tenant; a revoked credential fails closed.
- Every `marketplace_*` table has RLS positive and negative cases, a history row on each consequential change, and a kill switch (DO-NOT-BUILD 13).
- The prohibited-category list for the marketplace is the same list as `sponsor.ts` (single source).
- The CSP names no host the subprocessor register lacks, after each provider integration.

### Accessibility implications

Every marketplace surface — listing cards, consent screens, checkout, order status, disputes, messaging, provider portal — needs keyboard, focus, semantic structure, contrast, reduced-motion and screen-reader testing before it opens; price, fees and terms in text; no countdown or scarcity pressure; accessible receipts; an accessibility finding is grounds for refund and a listing defect; the accessibility *category* is never a premium tier; disability disclosure to a provider only with explicit student consent.

### Security and privacy implications

New attack surface: payments, webhooks, partner API, provider accounts, messaging, embedded content, payee data. Controls: tenant-scoped authorisation at API and database; scopes bound to classification; signed, replay-protected webhooks; secrets in a vault; MFA for providers; two-person approvals for payee changes and hold release; no third-party script or tracker in the first-party app; synthetic data only in the sandbox; minimum-necessary disclosure with per-provider consent; no sale, advertising or training use; audit export for tenants. New subprocessors (identity verification, tax service, processor, messaging) enter the register **before** their host enters the CSP.

### Operational and runbook implications

Runbooks to write and rehearse (named owner each): provider onboarding and re-verification; listing review; report triage; P0/P1 incident; refund; dispute and chargeback; payout hold and release; payee change; payout reconciliation; fraud response; provider offboarding; tenant provider removal; processor or webhook outage and degraded mode; sanctions hit; legal hold. On-call and a backup owner for the trust-and-safety queue before M1. Status communications use the incident-communications templates.

### Traceability matrix updates

| Row | Capability | Status | Evidence | Blocker |
| --- | --- | --- | --- | --- |
| J-14 | Ethical revenue and marketplace controls | `partial` (unchanged) | `app/src/lib/gtm/sponsor.ts`; this page | No marketplace; no per-item why/who/paid/data/hide card |
| I-03 | Education workflow marketplace | `absent` (unchanged) | — | Depends on extension governance |
| `marketplace` (new) | Marketplace and provider governance | `BLOCKED` in the capability register | This page; `docs/market-readiness/CAPABILITY-STATUS-REGISTRY.json` | Gates G-OWN … G-EXIT |
| (existing) | Provider maturity and partnerships | designed | `docs/PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md` | Waits for #779's catalog |
| (existing) | Extension ecosystem governance | designed | `docs/EXTENSION-ECOSYSTEM-GOVERNANCE.md` | Waits for classification |

## Evidence state

**Repository evidence.** Constitution, market-leadership lines, commercial governance, sponsorship gate, provider-maturity and extension designs, escalation policy, subprocessor test, DO-NOT-BUILD rules and the refund draft support this design and constrain it.

**Operational evidence.** None: no approved provider, listing, order, payout, dispute, partner, institution approval, counsel opinion, tax position, processor approval, staffed trust-and-safety queue, or measured take rate exists.

**Missing test/proof.** Select one cohort and Class A listings from one campus unit; satisfy G-OWN, G-DATA, G-TERMS, G-QUEUE; run the directory for a term with measured report handling; only then design M2 with real tenants.

## Claim ceiling

Semester may describe a marketplace and partner ecosystem as a **governed design under review** and may conduct confidential due diligence with prospective partners without implying a relationship.

## Prohibited claims

Do not claim a marketplace, provider network, partner, certified or verified provider, integration, payments, payouts, escrow, refunds, buyer protection, employer access, institution approval, revenue, take rate, or traction until the gate in section 12 is evidenced and counsel has approved the wording.
