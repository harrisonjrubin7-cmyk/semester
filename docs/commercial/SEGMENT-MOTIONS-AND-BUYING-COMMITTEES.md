# Segment Motions and Buying Committees

| Control | Value |
| --- | --- |
| Status | **CONTROLLED MOTION DESIGN — NO MOTION IS OPERATED, NO COMMITTEE IS NAMED** |
| Owner | Harrison Rubin — company-side commercial owner; seller, partner owner, counsel and finance reviewers unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Sources | [`MARKET-SEGMENTATION.md`](MARKET-SEGMENTATION.md), [`IDEAL-CUSTOMER-PROFILE.md`](IDEAL-CUSTOMER-PROFILE.md), [`BUYER-PERSONAS.md`](BUYER-PERSONAS.md), [`PARTNER-AND-CHANNEL-STRATEGY.md`](PARTNER-AND-CHANNEL-STRATEGY.md), [`../INSTITUTIONAL-GTM-PLAYBOOK.md`](../INSTITUTIONAL-GTM-PLAYBOOK.md), `app/src/lib/k12/edition.ts`, [`../k12/K12-REQUIREMENTS.md`](../k12/K12-REQUIREMENTS.md) |

Five motions share one platform, one claims register and one set of gates. They differ in who decides, how much they can spend, what review they trigger and what must be true before any student data moves. The executive go/no-go (`../market-readiness/EXECUTIVE-GO-NO-GO.md`, 2026-10-02) sets the ceiling for all of them: design-partner discovery, demos and scoping are green; activation, paid institutional pilots and broad enterprise sales are red; individual adoption is an invite-only beta.

## The five motions

| Motion | Who decides | Entry offer | What it can promise today | Next motion |
| --- | --- | --- | --- | --- |
| **Student-led** | the student | invitation beta of the planning experience (`INDIVIDUAL-GROWTH-STRATEGY.md`, `GROWTH-FUNNEL-SPEC.md`) | a controlled beta with the limits the claims register states | a department conversation only if a student introduces one |
| **Department-led** | a department head or program director, with the student-success or advising lead as champion | a bounded cohort pilot on one milestone (`PRIMARY-PILOT-OFFER.md`) | design-partner discovery and scoping | institution-wide review when central IT, privacy or procurement is engaged |
| **Institutional enterprise** | provost or CIO with a committee | requirements learning only | nothing sold or activated until repeatable pilots, assurance, integrations and staffing exist (`MARKET-SEGMENTATION.md`, "defer") | not available |
| **Partner and marketplace** | the partner's authorized owner, and Semester's | one bounded use case under due diligence | no partner, listing or revenue share exists | a partner-sourced introduction enters the department-led or institutional motion |
| **K-12 (grades 9–12 only)** | a district or school leader | discovery only: the K-12 edition may be described and planned, and may not take a district's student data (`mayTakeDistrictData()` is false) | no district is served, and the public page says so | a small school pilot, when the district baseline passes |

## Student-led to institution

Students are never the lead list for an institution. A student may choose to introduce an advisor or program to Semester; that introduction opens a `target_account` with the source recorded as an introduction. Semester does not prospect an institution from its students' account data. Using aggregate counts of invited students by institution, at or above the reporting floor of ten, to prioritize a conversation is an open privacy-review item: until counsel and the privacy owner approve it in writing, that signal is not used. Student ambassadors follow `STUDENT-AMBASSADOR-PLAYBOOK.md` and `REFERRAL-AND-SHARING-SAFETY.md`: no incentive tied to student data or sign-ups, and a clear non-official role.

## Department-led

A department can adopt faster than a campus, and a department that adopts around central IT creates the failure a buyer remembers. So the motion is fast to start and does not skip a review: the same data-flow, privacy, accessibility and procurement questions apply at any price, including a no-fee design-partner term (`../legal-drafts/EVALUATION-AGREEMENT-DRAFT.md`). The proposed minimum annual contract values in `governance/deal-desk.ts` (pilot $15k, department $25k) are defaults, not a price book.

## K-12 (grades 9–12)

Ages and scope are fixed by the platform: no one under 13 may hold an account (`MINIMUM_AGE` in `app/src/lib/age.ts`), so the edition is high schools, career and technical education, early college and dual enrollment, college and career centers and district student-success teams. Middle and elementary schools are not a segment.

**Ideal customer.** A school or program with a graduation, pathway or college-and-career milestone, a counselor or CTE champion, a cohort that can be isolated, and tolerance for a no-student-record-integration scope. The edition's first offer is the Graduation, College and Career Readiness Pilot for grades 9–12, all students 13 or over, running 26 weeks, with the exclusions listed in `edition.ts`: no messaging or discovery between students, no employer visibility, no grades, discipline, special-education or health records.

**Cohort size.** `edition.ts` states 50 to 250 students; the pilot framework's hard bounds are 10 to 200. Until the owner decides which governs, scope every K-12 pilot at 200 or fewer.

**Buying committee.** Typical roles; confirm each in discovery, because districts organize these differently.

| Role | Decides or reviews | Evidence they ask for |
| --- | --- | --- |
| district leader for curriculum or college and career readiness | economic sponsor | outcome measures, cost, decision date |
| CTE director or counselor lead | champion | counselor workflow, student agenda, resource accuracy |
| district technology and data-privacy owner | student-data review | data map, data-processing terms, subprocessors, deletion |
| accessibility coordinator | accessibility review | testing evidence and limits, with no conformance claim |
| purchasing office and, above a threshold, a board | contract path | quote, terms, insurance, vendor registration |
| counsel | terms and student-privacy law | counsel-approved paper; state and district rules vary and are decided by counsel, never by Semester |
| family-communication owner | guardian notices | what is shared, and how a student chooses to share it |

**Gate.** Before any district student data, every item in the district baseline of `K12-REQUIREMENTS.md` must be `tested`, which is false today. Until then the K-12 motion is discovery, demo on synthetic data and scoping.

## Partner and marketplace

Partners follow `PARTNER-AND-CHANNEL-STRATEGY.md`: six channel hypotheses, none approved.

| Partner type | Role | Committee on Semester's side | Precondition |
| --- | --- | --- | --- |
| implementation or integration consultant | scoped configuration and coordination | owner, security and privacy, counsel | contract, DPA, least-privilege access, training |
| technology or provider ecosystem | documented interoperability | owner, product, security | approved adapter or sandbox and substantiated listing language |
| employer or service provider (marketplace) | verified events, office hours, opportunities, never student-data access | owner, finance, counsel, security and privacy, trust and safety | provider approval, consumer protection, refund and dispute process, tax and vendor review |
| association, event or content collaborator | qualified introductions | owner and claims owner | sponsorship disclosure and contact consent |

Marketplace revenue share is set by finance (`../operating-model/COMMERCIAL-GOVERNANCE.md`), the sponsor placement policy in `app/src/lib/gtm/sponsor.ts` stays off, and sponsors never receive student-level data. No partner may be named, and no listing or compatibility may be claimed, before the evidence for it is filed.

## Institutional buying committee

Eight roles to map before the outcome workshop, plus whoever owns AI policy for any pilot that uses AI features (`../INSTITUTIONAL-GTM-PLAYBOOK.md`): academic sponsor, champion, IT and identity, security, privacy or registrar, accessibility, procurement, legal. For each, record the actual person, authority, objection, evidence request and decision process (`BUYER-PERSONAS.md`).

## Roles and quotas

There is no seller, sales engineer, partner manager or customer-success hire, and no quota exists. Until a motion has produced a closed opportunity, the owner works every motion; a role is split out only when a measured bottleneck (for example, review turnaround or implementation capacity on a real pilot) is recorded. Quotas are not set from this document.

## Land and expand

Expansion is adjacent, not a leap to campus replacement (`PRIMARY-PILOT-OFFER.md`): another cohort, program or approved read-only source, each with its own readiness check and launch-council go.

- Expansion potential for an account = eligible population of the adjacent unit × the participation rate measured in the first pilot × the approved per-unit price. Every term is blank until it is measured or approved; never fill one from a benchmark.
- Expansion enters the forecast only as its own motion after a signed final verdict of convert or expand.
- `netRevenueRetention()` in `app/src/lib/gtm/kpi.ts` is the retention measure once recurring revenue exists.

## References

No reference, logo, quote or case study exists or is promised (CLM-013). A reference conversation is considered only after a customer has completed accepted scope, has no unresolved P0 or P1 and signs the permission record in `CUSTOMER-REFERENCE-PROGRAM-DRAFT.md`. No reference target count is set; the first target is one consented conversation after a first final verdict. Participation is separate from price, support and renewal, and a discount never buys a statement.

## Evidence state

**Repository evidence.** Segmentation, personas, partner strategy, the K-12 edition, its requirements register and the go/no-go define the boundaries used here.

**Operational evidence.** No student, department, institution, district or partner conversation is recorded as a motion with outcomes.

**Missing test/proof.** Run discovery in each motion, name a real committee for one account in each, record the first objection pattern per motion and revisit the order with evidence.

## Claim ceiling

Semester may describe these as its planned motions and use them to structure discovery.

## Prohibited claims

Do not state that any motion, segment, partner, marketplace or K-12 offer is live, validated or available, that a district is served, or that student data may be accepted from a district.
