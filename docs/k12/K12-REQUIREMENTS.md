# K–12 requirements

<!-- Rendered from app/src/lib/k12/requirements.ts by requirements.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

What the K–12 edition must do, and what a district’s student data waits on.
The minimum age is 13 (D-139), so K–12 here means only the grades where
students are 13 and over: in practice high school, early college and career
and technical education. Nothing here says a district may be served today.

**May a district’s student data be accepted?** No. 11 of 16 baseline items are short of tested or still have a gap.

Baseline: 0 not-started, 3 designed, 3 building, 10 tested.

## The district baseline

Before any district’s student data is accepted, every item here is tested.

| ID | Item | Status | Evidence | Gap | Owner |
| --- | --- | --- | --- | --- | --- |
| KB-01 | A district data privacy agreement or DPSA | designed | `docs/trust/DPA-CHECKLIST.md` — what the agreement must settle, for counsel | No signable agreement; the 1EdTech DPSA template has not been adapted. | `privacy` |
| KB-02 | FERPA-aligned school-official and use-limitation terms | tested | `docs/trust/FERPA-CONSENT-WORKFLOW.md` — the school-official basis and its limits<br>`app/src/lib/trust/ferpa-consent.test.ts` — held | The terms are a workflow in the tree, not yet a signed clause. | `privacy` |
| KB-03 | A COPPA assessment for users under 13 | tested | `supabase/minimum-age.check.sql` — nobody under 13 may hold an account | Nobody under 13 is served, so there is nothing to assess until a district asks for elementary grades; counsel confirms that reading. | `privacy` |
| KB-04 | A parent or guardian consent approach where required | building | `docs/SUPPORTER-FAMILY-PRIVACY-MODEL.md` — the limited-grant model a guardian would use<br>`supabase/k12-guardians.check.sql` — school staff record and verify a minor’s guardian; the link stops counting at 18 | A K–12 school’s staff can record and verify a guardian (D-1022), but no guardian-facing screen reads through the link, and whether any state requires verified consent at 13–17 is counsel’s question. | `privacy` |
| KB-05 | Age-aware product design | tested | `supabase/minimum-age.check.sql` — a minor is out of discovery, matching, messaging and employer visibility | — | `product` |
| KB-06 | Strict role, school, class and guardian boundaries | building | `supabase/rolegrants.check.sql` — roles held per school<br>`supabase/family.check.sql` — a guardian sees only what was granted | No grade or class-section boundary exists; a district tenant is one school. | `security` (vacant) |
| KB-07 | No behavioural advertising | tested | `app/src/lib/gtm/campaign.test.ts` — no targeting on education records | — | `privacy` |
| KB-08 | No sale of student data | tested | `app/src/lib/trust/ai-training-policy.test.ts` — never sold, never used to train | — | `privacy` |
| KB-09 | No public student discovery by default | tested | `supabase/minimum-age.check.sql` — a minor cannot be found, matched or opted into employer view<br>`supabase/expansion.check.sql` — employer visibility is opt-in for everyone | — | `trust` (vacant) |
| KB-10 | Human moderation and an escalation plan | tested | `app/src/community/moderation.test.ts` — the queue and its actions<br>`docs/CRISIS-RESPONSE-RUNBOOK.md` — escalation | No moderator has been trained for minors. | `trust` (vacant) |
| KB-11 | Safe messaging restrictions | tested | `supabase/minimum-age.check.sql` — a minor cannot connect, request a mentor or post in class rooms | — | `trust` (vacant) |
| KB-12 | A data retention and deletion schedule | tested | `app/src/lib/retention.test.ts` — the schedule, held to the tables | No district-specific retention period; the schedule is one for every tenant. | `data` (vacant) |
| KB-13 | A district-controlled AI policy | building | `app/src/lib/coursestudio.ts` — a course sets its own AI policy | A course sets its AI policy; no district-level policy overrides it. | `product` |
| KB-14 | Accessibility documentation | designed | `docs/operating-model/ACCESSIBILITY-GOVERNANCE.md` — the governance, not a statement | No accessibility statement and no VPAT. | `accessibility` |
| KB-15 | An incident-response process | tested | `app/src/lib/governance/incident-comms.test.ts` — who is told, how fast | Never exercised with a district. | `operations` |
| KB-16 | A district security questionnaire package | designed | `docs/market-readiness/HECVAT_DRAFT_RESPONSE.md` — the higher-ed questionnaire, drafted | Drafted for higher education; no K–12 questionnaire answered. | `security` (vacant) |

## What the edition must do

### Age-aware identity

| ID | Item | Status | Evidence | Gap | Owner |
| --- | --- | --- | --- | --- | --- |
| KI-01 | Nobody under 13; a date of birth at sign-up, refused in the database | tested | `supabase/minimum-age.check.sql` — held | — | `privacy` |
| KI-02 | An age stated once and never changed; only the day a minor turns 18 kept | tested | `supabase/minimum-age.check.sql` — held<br>`app/src/lib/age.test.ts` — the rules as the app explains them | Self-reported; a district roster would be the better source and is not connected. | `privacy` |
| KI-03 | A district-asserted grade or age, where a district provides one | not-started | — | Rostering from a district SIS is not built; an institution-asserted age would override a stated one. | `data` (vacant) |

### Guardian consent

| ID | Item | Status | Evidence | Gap | Owner |
| --- | --- | --- | --- | --- | --- |
| KG-01 | A student grants a guardian a limited, expiring view of chosen items | tested | `supabase/familyinvites.check.sql` — invites<br>`supabase/familyshare.check.sql` — shared items, re-checked on read | Built for adults’ supporters; open to a minor. | `privacy` |
| KG-02 | Verifiable guardian consent where the law requires it | not-started | — | Not needed while nobody under 13 is served; counsel decides whether 13–17 needs it in any state. | `privacy` |
| KG-03 | No default guardian access to a student’s private work | tested | `supabase/family.check.sql` — a grant names items; nothing is visible by default | — | `privacy` |

### Safety and moderation

| ID | Item | Status | Evidence | Gap | Owner |
| --- | --- | --- | --- | --- | --- |
| KS-01 | Minors kept out of discovery, matching, messaging and employer visibility until 18 | tested | `supabase/minimum-age.check.sql` — held | Video-call and canvas links are open to anyone holding the link, for every age. | `trust` (vacant) |
| KS-02 | Reporting always open to a minor | tested | `supabase/minimum-age.check.sql` — a minor may report | — | `trust` (vacant) |
| KS-03 | Media and community safety rules | designed | `docs/COMMUNITY-MEDIA-SAFETY.md` — the rules for everyone | Nothing specific to minors (maturity MN-08). | `trust` (vacant) |

### AI restrictions

| ID | Item | Status | Evidence | Gap | Owner |
| --- | --- | --- | --- | --- | --- |
| KA-01 | AI answers within a course’s policy, citing the source | tested | `app/src/lib/coursestudio.test.ts` — the course policy<br>`app/src/lib/governance/ai-lifecycle.test.ts` — the release gates | — | `product` |
| KA-02 | District-controlled AI policy and approved source packs | not-started | — | No district level exists above the course. | `product` |
| KA-03 | Age-aware limits on AI features | not-started | — | The assistant does not read the account’s standing. | `product` |

### District configuration

| ID | Item | Status | Evidence | Gap | Owner |
| --- | --- | --- | --- | --- | --- |
| KD-01 | District, school, grade, cohort, teacher and counselor configuration | designed | `docs/operating-model/MULTI-CAMPUS.md` — multi-campus scoping; "district" there means a community-college district | A tenant is one school; no district or grade level. | `product` |
| KD-02 | Tenant isolation | tested | `supabase/tenancy.check.sql` — held | — | `security` (vacant) |

### Data boundaries

| ID | Item | Status | Evidence | Gap | Owner |
| --- | --- | --- | --- | --- | --- |
| KX-01 | Only the fields a workflow needs; no grades, discipline, special education or health records | tested | `app/src/lib/institution-ops.test.ts` — forbidden measures refused | The field list for a district connector is not written. | `data` (vacant) |
| KX-02 | Sponsored content kept out of a student’s view | tested | `app/src/lib/gtm/sponsor.test.ts` — protected surfaces | — | `privacy` |

## For counsel

What the tree cannot decide. Each question names the rows its answer would move.

1. Confirm that a minimum age of 13, refused at sign-up, takes the service outside COPPA’s parental-consent requirement for every district served. (KB-03)
2. The guardian-agreement wording for students aged 13 to 17 in the terms, and whether any state requires verified guardian consent at those ages. (KB-04, KG-02)
3. Adapt the 1EdTech DPSA template to what Semester actually does, and the school-official clause that goes with it. (KB-01, KB-02)
4. Which state student-privacy laws apply in each district’s state, and what each adds to the baseline. (KB-01)
5. Whether a dual-enrollment high-school student in a university tenant needs anything beyond the minor rules. (KB-06)
6. A retention period for a district’s student records, and what happens to them when a student leaves the district. (KB-12)
