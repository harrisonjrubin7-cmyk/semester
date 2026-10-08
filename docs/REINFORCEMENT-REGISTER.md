# Reinforcement Register

<!-- Rendered from app/src/lib/reinforceregister.ts and app/src/lib/ops/operatingmodel.ts by reinforceregister.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

Seven briefs of 29 September 2026 ask what else would make Semester the
leader and the benchmark of its market. They repeat each other, so a row
here is one thing the tree would have to hold, citing every brief item that
asks for it; where another register already reads the same thing, the row
names it rather than restating it. Nothing here says Semester is the
benchmark: the counts below are the finding.

| Key | Brief |
| --- | --- |
| R | [Any other area or aspect that can be further reinforced, expanded, improved and strengthened](../docs/expansion/Reinforcing-the-Operating-Disciplines.pdf) |
| M | [Anything else to make this bulletproof, irresistible, the front runner and the benchmark](../docs/expansion/Final-Moats-and-the-Benchmark-Checklist.pdf) |
| E | [Executive answer: edtech benchmark audit](../docs/expansion/Executive-Answer-Edtech-Benchmark-Audit.pdf) |
| F | [Feature benchmark dashboard, TrustEd Apps gap matrix, pricing and margins, K–12 playbook](../docs/expansion/Feature-Benchmark-TrustEd-Pricing-and-K12.pdf) |
| P | [Semester: 1EdTech TrustEd Apps compliance, competitive benchmark, GTM and university packaging playbook](../docs/expansion/1EdTech-Compliance-and-GTM-Playbook.pdf) |
| V | [TrustEd Apps vetting matrix: the summary and the five most urgent actions](../docs/expansion/TrustEd-Apps-Vetting-Matrix-Summary.pdf) |
| L | [Anything else to make me the leader and pioneer of this market](../docs/expansion/Leader-and-Pioneer-of-the-Category.pdf) |

Statuses were assessed against `origin/main` at `beaa839`; a test holds each
to the kind of file it cites. Nothing is above `tested`, because nothing has
an artifact under `docs/evidence/`.

## Where it stands

| Area | Items | not-started | designed | building | tested |
| --- | ---: | ---: | ---: | ---: | ---: |
| [OPM](#opm) The operating model | 3 | 0 | 0 | 1 | 2 |
| [LIF](#lif) One student lifecycle | 5 | 0 | 1 | 1 | 3 |
| [GRA](#gra) The Semester Graph and the university knowledge graph | 5 | 0 | 0 | 3 | 2 |
| [ACT](#act) The next right action | 4 | 0 | 0 | 0 | 4 |
| [OUT](#out) Outcomes and measurement | 6 | 1 | 2 | 0 | 3 |
| [IMP](#imp) Implementation as a product | 9 | 2 | 2 | 1 | 4 |
| [PKG](#pkg) Editions, pricing and margins | 10 | 2 | 0 | 2 | 6 |
| [PRC](#prc) Procurement before the sales call | 12 | 5 | 3 | 0 | 4 |
| [TRU](#tru) 1EdTech TrustEd Apps | 4 | 0 | 1 | 0 | 3 |
| [CSX](#csx) The customer-success engine | 3 | 1 | 0 | 1 | 1 |
| [GOV](#gov) Councils, governance and people | 7 | 0 | 5 | 1 | 1 |
| [PRM](#prm) The Student Data Promise | 7 | 0 | 0 | 0 | 7 |
| [A11](#a11) Accessibility as a moat | 6 | 1 | 1 | 1 | 3 |
| [AIX](#aix) The trusted AI layer | 7 | 0 | 1 | 1 | 5 |
| [REL](#rel) Reliability as a visible feature | 7 | 1 | 2 | 1 | 3 |
| [GRW](#grw) Growth, habit and community | 6 | 2 | 1 | 0 | 3 |
| [PAR](#par) Partners and design partners | 4 | 1 | 0 | 0 | 3 |
| [NAR](#nar) The category narrative and precise claims | 4 | 0 | 0 | 1 | 3 |
| [BEN](#ben) The benchmark itself | 5 | 0 | 1 | 2 | 2 |
| [K12](#k12) K–12, as a configured edition later | 3 | 0 | 0 | 0 | 3 |
| **total** | **117** | **16** | **20** | **16** | **65** |

## Where a brief and the tree disagree

Nothing here changes a recorded decision. Each is put to the seat that owns it.

None is open. The four this register found — the Plus price, the pilot length, the statement’s “payments” and the first-year document’s name — the owner settled (D-134).

## The register

### OPM

**The operating model.** Every product area has a primary user, a problem, five owners, a success metric, its dependencies, a fallback and a maturity stage, so no module drifts away from the system it belongs to.

| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| OPM-001 | Ten product areas, each with its fourteen fields | tested | `app/src/lib/ops/operatingmodel.ts` — PRODUCT_AREAS<br>`app/src/lib/ops/operatingmodel.test.ts` — every field filled, every owner a seat, every dependency an area | Most ownerships rest on vacant seats; the rendered table says which. | R1 | — |
| OPM-002 | Per-feature charters below the areas | tested | `app/src/lib/governance/charters.ts` — one charter per module and ops flag<br>`app/src/lib/governance/charters.test.ts` — no empty field, no lapsed review | Eight charters; most of what students use is not behind a chartered flag. | R1, M16 | — |
| OPM-003 | A named owner for every seat the areas rest on | building | `app/src/lib/launchreadiness.ts` — COUNCIL: four seats held, all by the founder | Eight of twelve seats are vacant. | R1, M13 | — |

### LIF

**One student lifecycle.** Semester serves a person before, during and after college, and keeps the student’s own context across every stage.

| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| LIF-001 | Life stages from prospect to alumni as one vocabulary | tested | `app/src/lib/pathway.ts` — LIFE_STAGES<br>`app/src/lib/pathway.test.ts` — held<br>`docs/LIFECYCLE_REQUIREMENTS.md` — one identity across stages | Four stage vocabularies (pathway, launchpad, learner pathways, role) and no state machine joining them; a stage changes nothing about identity or permissions. | R2, F1 | — |
| LIF-002 | Admitted and first-term students | building | `app/src/lib/launchpad.ts` — prospect to first term<br>`app/src/screens/Launchpad.tsx` — the checklist | No test of its own. | R2, R18 | — |
| LIF-003 | Transfer, working, caregiver, online, graduate and international students | tested | `app/src/lib/learner-pathways.ts` — nine pathways<br>`app/src/lib/learner-pathways.test.ts` — held<br>`app/src/lib/transferhub.test.ts` — the transfer hub | Held in code; nothing under docs/evidence/ shows it operating. | R2 | — |
| LIF-004 | Study abroad and near graduation | tested | `app/src/lib/abroad.test.ts` — credit mapping<br>`app/src/lib/graduation.test.ts` — the projection | No graduation-to-alumni transition. | R2 | — |
| LIF-005 | Alumni: portfolio, mentoring and continuing access | designed | `docs/CAREER-PORTABILITY-AND-LIFELONG-ACCESS.md` — nothing built yet | The alumni role exists and is not ready. | R2, L4 | — |

### GRA

**The Semester Graph and the university knowledge graph.** One explainable graph joins the student, their goals, requirements, courses, work, skills, portfolio, opportunities, mentors and actions — and the need, office, resource, appointment and outcome — so every surface can say why.

| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| GRA-001 | Student → goal → requirement → course → assignment → skill → artifact → opportunity | building | `app/src/lib/skills-graph.ts` — course and work to skill to opportunity<br>`app/src/lib/skills-graph.test.ts` — the skills part | Skills only: no goal, requirement or assignment node joins it. | R3, M2, L6 | `oneos:graph` |
| GRA-002 | Need → office → resource → appointment → follow-up → outcome | building | `app/src/lib/nowrongdoor.ts` — need to office<br>`app/src/lib/office-actions.test.ts` — office to action | Nothing records the appointment, the follow-up or the student’s outcome. | R3, L6 | — |
| GRA-003 | Every recommendation explainable | tested | `app/src/lib/actions.ts` — reason, source and alternatives<br>`app/src/lib/actions.test.ts` — held<br>`app/src/lib/whydue.test.ts` — why this card, now | Held in code; nothing under docs/evidence/ shows it operating. | R3, L6 | `oneos:ac-why` |
| GRA-004 | An owner, source, verification, review date, population, accessibility and handoff on every campus item | building | `app/src/lib/campusdirectory.ts` — the directory<br>`app/src/lib/integration/catalog.ts` — a steward per source | No review date or applicable population on a directory entry. | M2, R21 | `oneos:campus-graph`, `lead:PL-07` |
| GRA-005 | The graph kept portable, correctable and auditable | tested | `app/src/lib/export.test.ts` — everything leaves as files<br>`supabase/evidence-graphs.check.sql` — tenant and person isolation | No correction flow on a graph edge. | L6, M3 | — |

### ACT

**The next right action.** The Action Center turns course, calendar, plan, advisor, campus, job and registration signals into one explainable action with what happens if the student acts or waits.

| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| ACT-001 | What happened, why it matters, its source and when it matters | tested | `app/src/lib/actions.ts` — the envelope<br>`app/src/components/ActionCenter.test.tsx` — held | Held in code; nothing under docs/evidence/ shows it operating. | L5 | `oneos:ac-envelope`, `oneos:ac-source` |
| ACT-002 | What happens if the student acts, and if they wait | tested | `app/src/lib/actions.test.ts` — consequence | Held in code; nothing under docs/evidence/ shows it operating. | L5 | `oneos:ac-consequence` |
| ACT-003 | Primary action, alternatives and who can help | tested | `app/src/components/ActionCenter.test.tsx` — alternatives and the help route | Held in code; nothing under docs/evidence/ shows it operating. | L5 | `oneos:ac-next` |
| ACT-004 | Official, estimated, imported or needs review on every action | tested | `app/src/lib/source.ts` — the source vocabulary<br>`app/src/lib/source.test.ts` — held | Confidence is not a field. | L5, E, F1 | — |

### OUT

**Outcomes and measurement.** Success is a measurable, student-controlled outcome per module, measured in four separate layers, and never a claim about grades or retention from engagement.

| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| OUT-001 | The never-measured list: risk scores, reading time, attention, individual AI use | tested | `app/src/lib/institution-ops.ts` — FORBIDDEN<br>`app/src/lib/institution-ops.test.ts` — refused, not hidden<br>`app/src/lib/cohortfloor.test.ts` — no cohort under ten | Held in code; nothing under docs/evidence/ shows it operating. | R4, M11, L3 | — |
| OUT-002 | A student-controlled outcome for each module (My Path to Passport) | not-started | `docs/PRODUCT-ANALYTICS-DATA-ETHICS.md` — what may be measured | Three server marks exist (ANALYTICS.md); no module has its outcome defined as an event, and a fourth mark needs a decision (D-005). | R4, E, P | — |
| OUT-003 | Activation: time to first value, Path Snapshot rate, backup-course and agenda rates, week-4 retention | designed | `app/src/lib/gtm/kpi.ts` — the funnel formulas<br>`ANALYTICS.md` — three marks | The formulas exist; none of the named rates is instrumented. | E, P, F | `lead:PL-03` |
| OUT-004 | Student clarity: “I understand what I need to do next” | tested | `app/src/lib/clarity.ts` — one question, on the device<br>`app/src/lib/clarity.test.ts` — held | The answer never leaves the device, so no pilot can aggregate it yet. | E, F, P, L4 | — |
| OUT-005 | The Outcomes Lab: adoption, meaningful use, experience, operations and educational outcomes, measured apart | designed | `app/src/lib/ops/firstyear.ts` — the measures, targets null<br>`docs/operating-model/RESEARCH-AND-SERVICE-DESIGN.md` — the research practice | The layers are not one framework; educational outcomes need a study design and approvals nobody has written (expansion register RES). | M11 | — |
| OUT-006 | No causal claim from engagement | tested | `app/src/lib/ops/claims.ts` — PROOF_RULES<br>`app/src/lib/ops/claims.test.ts` — held<br>`app/src/site/site.test.tsx` — no page says Semester improves retention, persistence, graduation or grades | Held in code; nothing under docs/evidence/ shows it operating. | M11, M17, E | — |

### IMP

**Implementation as a product.** An institution can launch in weeks rather than quarters, through a repeatable playbook, a launch kit and a migration path that never forces a replacement.

| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| IMP-001 | A thirteen-phase playbook, each phase with stakeholders, inputs, outputs, owner, risks and a go/no-go | designed | `docs/operating-model/PILOT-TO-PRODUCTION.md` — phases 0–7 with owners and exit criteria<br>`docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md` — six one-line phases | About nine of the thirteen phases are covered; no single artifact carries all of them. | R5, E | `lead:PL-14` |
| IMP-002 | Rollout states with exit gates, read-only first | tested | `app/src/lib/governance/rollout.ts` — the chain<br>`supabase/tenant-rollout.check.sql` — enforced by the database | Held in code; nothing under docs/evidence/ shows it operating. | R5, R22, L4, L9 | — |
| IMP-003 | Integration sandbox and mapping versions with rollback | tested | `app/src/lib/integration/quality.test.ts` — propose, simulate, approve, roll back | docs/SYNC-SIMULATION-SANDBOX.md still says nothing is built. | R22, M8, L9 | — |
| IMP-004 | Content, onboarding and launch templates | tested | `app/src/lib/launch/content.test.ts` — the launch package<br>`docs/launch/STUDENT-QUICK-START.md` — ready | Faculty and advisor quick starts and the ambassador kit are not started. | M8, L9 | — |
| IMP-005 | Guided tenant setup and an SSO wizard | designed | `docs/SSO-TENANT-ONBOARDING.md` — a checklist<br>`supabase/tenant-sso-policy.check.sql` — the policy the wizard would write | No wizard; the SSO tables have no screen. | M8, L9, E | `oneos:ic-tenant` |
| IMP-006 | Every pilot runs 26 weeks: the Registration and Path Pilot length | tested | `app/src/lib/gtm/pilot.ts` — PILOT_WEEKS<br>`app/src/lib/gtm/pilot.test.ts` — exactly 182 days, or refused | The owner set it (D-134). The offer itself — 25–100 students, the explicit exclusions, the price sheet — is not packaged as one document. | E, P, V | — |
| IMP-007 | Pilot dashboard | building | `app/src/lib/gtm/pilot.ts` — readiness and verdict | No screen reads the pilot tables. | M8, L9 | — |
| IMP-008 | Institution data migration: plans, catalog, directories, events | not-started | `docs/market-readiness/MIGRATION_PLAYBOOK.md` — no production load path; evidence path and roster staging only | Student-side import only; no SIS, ERP, Google or Microsoft mapping template. | R22 | — |
| IMP-009 | Parallel-run mode | not-started | — | Named once in docs/INSTITUTIONAL_REQUIREMENTS.md; nothing designs it. | R22 | — |

### PKG

**Editions, pricing and margins.** One platform sold as purpose-built editions, priced so the operating cost of every package can be explained, and never in a way that makes a student doubt a recommendation.

| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| PKG-001 | Editions on one identity, one data model and one console | building | `app/src/lib/launchkit.ts` — twelve modules with buyer, metric and guardrail<br>`app/src/lib/entitlement.test.ts` — resolution order, in shadow | The packages are not the briefs’ editions, and no entitlement is tied to a package. | R6, E, P | — |
| PKG-002 | Student plans: Free, Plus, Pro | tested | `app/src/lib/plans.ts` — Plus $7.99 or $59, Pro planned at $14.99 or $99<br>`app/src/lib/plans.test.ts` — the pricing page and the catalog checkout charges, held to one price | Pro has no catalog price and cannot be bought. | E, F, P | — |
| PKG-003 | Institution price floors and implementation fees | tested | `app/src/lib/governance/deal-desk.ts` — minimum ACV per segment<br>`app/src/lib/governance/deal-desk.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. | R19, F, P | — |
| PKG-004 | An institution value and pricing calculator | not-started | `docs/SAAS-LAUNCH-KIT.md` — the calculator’s inputs, and “none exists” | No function computes an estimate from pilot size, registration volume, advising capacity or integration scope. | R7, F | — |
| PKG-005 | A gross-margin model by package: cloud, AI, storage, notifications, payments, support, implementation, moderation | not-started | `docs/operating-model/COMMERCIAL-GOVERNANCE.md` — the AI unit-economics dashboard, designed | Costs are recorded (the AI journal) and formulas tested (kpi.ts); nothing joins them per package. | R19, F, P | — |
| PKG-006 | AI priced on real cost: per-tenant budget and per-account allowance | tested | `supabase/gateway-journal.check.sql` — tokens and cost per action | No cost per active user or per meaningful action is reported. | R19, F | — |
| PKG-007 | Export, deletion and a saved plan never behind a paywall | tested | `app/src/lib/plans.test.ts` — ALWAYS_INCLUDED | Held in code; nothing under docs/evidence/ shows it operating. | M18, E, F | — |
| PKG-008 | Sponsored content labelled and kept out of academic, advising and support recommendations | tested | `app/src/lib/gtm/sponsor.test.ts` — protected surfaces<br>`app/src/lib/gtm/campaign.test.ts` — no targeting on education records | No placement surface exists, by design. | R20, M18, F, P | — |
| PKG-009 | Community participation and support discovery never gated by a plan | building | `app/src/community/governance.ts` — REVENUE_NOT_TAKEN names it | Nothing in entitlement resolution carves support or community out of plan gating. | M18 | — |
| PKG-010 | Employer visibility opt-in, time-limited and auditable | tested | `supabase/expansion.check.sql` — opt-in visibility and view log | Expiry is enforced by a policy the check does not exercise. | M18, L4 | `connect:CTL-008` |

### PRC

**Procurement before the sales call.** A buyer gets the whole package — security, privacy, accessibility, AI, implementation and contract — before asking, through a Trust Center and a Trust Room.

| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| PRC-001 | The policy set, each with its status | tested | `app/src/lib/ops/claims.ts` — POLICIES<br>`app/src/lib/ops/claims.test.ts` — nothing in force, and the site says so | Nothing is in force; the privacy seat that would put it in force is vacant. | R8, M5, E, F, P, V | — |
| PRC-002 | Security overview and architecture | designed | `docs/trust/SECURITY-WHITEPAPER.md` — the overview<br>`docs/UNIVERSITY-OS-ARCHITECTURE.md` — the architecture | No data-flow diagram as a picture. | R8, M5, E | — |
| PRC-003 | Subprocessor register | tested | `app/src/lib/trust/subprocessors.test.ts` — held to the code<br>`docs/SUBPROCESSORS.md` — draft | Not yet read by counsel. | R8, M5, F, P | — |
| PRC-004 | Retention and deletion | tested | `app/src/lib/retention.test.ts` — the schedule<br>`supabase/deletion.check.sql` — deletion | Held in code; nothing under docs/evidence/ shows it operating. | R8, M5, F, P | — |
| PRC-005 | Accessibility statement and VPAT | not-started | `docs/trust/HECVAT-VPAT-PLAN.md` — a plan | Neither exists; /accessibility/ is an evidence page, not a statement. | R8, M5, F, P, V | — |
| PRC-006 | AI policy a student or institution reads | not-started | `docs/trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md` — the internal data-use policy, draft | The public AI Use Policy is not started. | R8, M5, F, P, V | — |
| PRC-007 | An Advertising and Sponsorship Policy and a standalone Acceptable Use Policy | not-started | — | Sponsorship rules are code (sponsor.ts); no policy document; the AUP is a section of the terms draft. | F, P | — |
| PRC-008 | DPA, pilot statement of work, standard contract | designed | `docs/trust/DPA-CHECKLIST.md` — notes for counsel<br>`docs/trust/PILOT-AGREEMENT-OUTLINE.md` — an outline | Outlines, not signable documents. | R8, M5, E, P | — |
| PRC-009 | Business continuity summary | designed | `docs/market-readiness/DISASTER_RECOVERY.md` — not started<br>`RESTORE.md` — the restore procedure | No RTO or RPO is stated. | R8, M5, E | — |
| PRC-010 | Company overview and insurance documents | not-started | — | Neither exists; the entity is the owner’s to attest. | R8, E | — |
| PRC-011 | A versioned Trust Room that grants exact versions and logs every open | tested | `app/src/screens/TrustRoom.tsx` — the reviewer’s page<br>`supabase/trust-room.check.sql` — held | The mechanism; no artifact is published into it. | E, F, P | `lead:PL-08` |
| PRC-012 | A public Trust Center hub | not-started | — | Two /trust/ pages exist; no hub gathers the policy set. | E, F, P, V | `oneos:trust-center` |

### TRU

**1EdTech TrustEd Apps.** TrustEd Apps is a documentation and operations programme that proves what Semester does, across data privacy, security practices, accessibility and generative-AI data.

| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| TRU-001 | The four rubrics mapped to controls and scored from the registers | tested | `app/src/lib/trust/compliance-crosswalk.ts` — thirty-nine rubric items, eleven of them the Generative AI Data Rubric<br>`app/src/lib/trust/compliance-crosswalk.test.ts` — scores computed, capped at 2 without evidence | A rubric item has no owner, review date or remediation of its own; the P0 tracker below adds them for the playbook’s blockers. | F, P, V, E | — |
| TRU-002 | The playbook’s P0 blockers, each with an owner and evidence | tested | `app/src/lib/reinforceregister.ts` — P0<br>`app/src/lib/reinforceregister.test.ts` — every P0 owned by a seat and cited | Most owners are vacant seats. | P, V | — |
| TRU-003 | Every SECURITY DEFINER function with a disposition | tested | `app/src/lib/definerregister.test.ts` — held<br>`docs/DEFINER-RLS-REGISTER.md` — the register | The playbook marks this not started; #965 landed it. | F, P, V | — |
| TRU-004 | The certification sequence: membership, privacy vetting, GenAI rubric, self-assessments, LTI, annual renewal | designed | `docs/FERPA-COPPA-1EDTECH-READINESS.md` — EDT-5 and EDT-7 not started | No ordered sequence with owners and dates; no membership. | E, F, L11 | — |

### CSX

**The customer-success engine.** Every institution has a shared success plan, named roles, a launch calendar, an adoption view, a quarterly review and a renewal plan, so it gains a partner rather than a licence.

| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| CSX-001 | Success plans, quarterly reviews, renewals and account health | tested | `supabase/commercial.check.sql` — the tables and their refusals<br>`supabase/commercial-automation.check.sql` — the nightly health run | No screen reads them. | R9, M7, E | `oneos:co-success` |
| CSX-002 | Named roles per institution: sponsor, implementation, student success, IT and security, content, faculty champion, student ambassadors | building | `app/src/lib/gtm/pilot.ts` — COMMITTEE_ROLES | Committee roles for a pilot decision; no per-institution success roster. | R9, M7 | — |
| CSX-003 | An adoption dashboard of leading indicators | not-started | `docs/PILOT-TO-ANNUAL-CONVERSION.md` — the conversion process | Health signals are account-level only, by design; none of the brief’s indicators is computed. | R9, M7, E | — |

### GOV

**Councils, governance and people.** Formal oversight that is not cosmetic: each body with a charter, a cadence, decision rights, an escalation path and documented outcomes, and the non-obvious roles filled before scale exposes gaps.

| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| GOV-001 | Student advisory council, paid and representative | designed | `docs/operating-model/RESEARCH-AND-SERVICE-DESIGN.md` — the recruitment matrix<br>`app/src/site/benchmark.tsx` — /research/: not yet running | No council, members or compensation policy; no seat. | R10, M14, L12, P | — |
| GOV-002 | Institutional advisory council | designed | `docs/operating-model/RISK-GOVERNANCE.md` — customer advisory councils, none named | The champion seat is vacant. | R11, M14, L12, P | `lead:PL-13` |
| GOV-003 | Accessibility, security and privacy, and AI governance bodies | designed | `docs/operating-model/ACCESSIBILITY-GOVERNANCE.md` — the accessibility body<br>`docs/operating-model/AI-GOVERNANCE-BOARD.md` — the most complete charter | No body has members; the AI board’s cadence differs between its charter and RISK-GOVERNANCE. | M14, L12, R13 | — |
| GOV-004 | Community safety council | designed | `app/src/lib/governance/module-privacy.ts` — a community safety area with an owner<br>`docs/CAMPUS-MODERATION-SOP.md` — the moderation standard such a body would own | No body exists. | M14, L12 | — |
| GOV-005 | Product and feature-governance board | designed | `docs/operating-model/PORTFOLIO-GOVERNANCE.md` — the portfolio council | No members. | M14 | — |
| GOV-006 | A review record for every high-risk feature: purpose, data, harms, consent, access, equity, oversight, audit, sunset | tested | `app/src/lib/governance/pia.ts` — eleven questions<br>`app/src/lib/governance/pia.test.ts` — held | Harms, bias and equity, human oversight and a sunset condition are not fields. | R13, M14 | — |
| GOV-007 | The non-obvious hires | building | `app/src/lib/launchreadiness.ts` — twelve seats | Six of the brief’s twelve roles have no seat; no hiring plan or role scorecard. | M13, L16 | — |

### PRM

**The Student Data Promise.** A short, public, plain-language promise, each line backed by a control, so students trust Semester with context because they keep control of it.

| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| PRM-001 | No sale; no training of general models on student data | tested | `app/src/lib/transparency.ts` — NEVER<br>`app/src/lib/trust/ai-training-policy.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. | R14, M18, F, P, V | — |
| PRM-002 | No behavioural advertising on education records, plans or study activity | tested | `app/src/lib/transparency.ts` — NEVER, added here<br>`app/src/lib/gtm/campaign.test.ts` — every education-record field refused as targeting | Held in code; nothing under docs/evidence/ shows it operating. | R14, M18, F, P | — |
| PRM-003 | Study activity never used to label ability or motivation | tested | `app/src/lib/transparency.ts` — NEVER, added here<br>`app/src/lib/institution-ops.test.ts` — attention and engagement inference refused | Held in code; nothing under docs/evidence/ shows it operating. | R14, M4 | — |
| PRM-004 | You see where information came from, and why a recommendation appeared | tested | `app/src/lib/standard.ts` — source and ai-context<br>`app/src/lib/standard.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. | R14 | — |
| PRM-005 | You decide what to share, with whom and for how long, and can take it back | tested | `app/src/lib/sharing.test.ts` — every share ends<br>`app/src/lib/trust/ferpa-consent.test.ts` — the consent workflow | Held in code; nothing under docs/evidence/ shows it operating. | R14, M3 | — |
| PRM-006 | Disconnect, export and delete | tested | `app/src/lib/export.test.ts` — export<br>`app/src/lib/deleteaccount.test.ts` — deletion | Held in code; nothing under docs/evidence/ shows it operating. | R14, M3 | — |
| PRM-007 | The promise published as one page | tested | `app/src/site/benchmark.tsx` — /trust/data-and-ai-transparency/ and the Semester Standard<br>`app/src/lib/transparency.test.ts` — every line held to the tree | Published as the transparency page’s commitment and the Standard; no page is titled Student Data Promise, and no line is in force as policy. | R14, F, P, V | — |

### A11

**Accessibility as a moat.** Accessibility is a visible part of the company: preferences that travel, accessible creation and exports, a public centre, and disabled students in paid research.

| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| A11-001 | Keyboard, labels, focus, landmarks, motion and contrast checked on every build | tested | `app/src/a11y/labels.test.ts` — every control named<br>`app/src/lib/keys.test.ts` — shortcuts<br>`app/src/lib/look.test.ts` — motion and contrast | No screen-reader pass by a person yet. | R15, M6, L4 | `lead:PL-05` |
| A11-002 | Captions and transcripts | tested | `app/src/lib/captions.test.ts` — captions | Held in code; nothing under docs/evidence/ shows it operating. | R15, M6 | — |
| A11-003 | A public accessibility page with a way to report a barrier | tested | `app/src/site/site.test.tsx` — the route | No published plan, no response commitment, no keyboard or screen-reader guide. | R15, M6, P | — |
| A11-004 | Preferences that travel across every surface and device | building | `app/src/lib/look.ts` — look settings | Held on the device; not a synced preference profile. | M6, P | `lead:ONE-08` |
| A11-005 | A student-controlled accommodations workflow | not-started | — | Nothing stores or routes an accommodation, by design until the privacy seat is held. | M6 | — |
| A11-006 | Disabled students and accessibility professionals in paid research | designed | `docs/operating-model/ACCESSIBILITY-GOVERNANCE.md` — the paid assistive-tech panel | No panel has met. | M6, P | — |

### AIX

**The trusted AI layer.** Not “we have an AI chatbot”: intelligence that knows the course and the policy, cites its source, distinguishes fact from estimate, and never acts without the student’s confirmation.

| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| AIX-001 | Citations to the page or document an answer rests on | tested | `app/src/lib/cite.test.ts` — page and document | No slide or timestamp field. | M4, R21, L7, P | — |
| AIX-002 | Source strength and the fact, estimate, draft distinction | tested | `app/src/ai/quality.test.ts` — per-answer source strength | Held in code; nothing under docs/evidence/ shows it operating. | M4, L7 | — |
| AIX-003 | Course and institution policy boundaries | tested | `app/src/lib/governance/ai-lifecycle.test.ts` — the release gates | Held in code; nothing under docs/evidence/ shows it operating. | M4, L7, P | `oneos:ai-policy` |
| AIX-004 | Confirmation before send, share, pay, register, delete or change | tested | `app/src/lib/governance/ai-assurance.test.ts` — risk tiers and human confirmation | Held in code; nothing under docs/evidence/ shows it operating. | M4, L7, P | — |
| AIX-005 | Prompt-injection defence | tested | `app/src/ai/injection.live.test.ts` — skips without a key | The live suite has not been run by the owner (D-122). | L7, P | — |
| AIX-006 | Feedback: helpful, wrong, needs source, not relevant, already done | building | `app/src/lib/feedback.ts` — feedback<br>`app/src/components/ActionCenter.test.tsx` — done and not relevant | Helpful and needs source are not controls. | R21, L7 | — |
| AIX-007 | Evaluation sets for correctness, integrity, accessibility, privacy and recommendation quality | designed | `docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md` — nothing built<br>`app/src/lib/extractaccuracy.test.ts` — one slice: syllabus extraction | One labelled corpus; no release-gating evaluation. | R21, L7, P | — |

### REL

**Reliability as a visible feature.** A student trusts Semester more when another system fails, because it explains what is unavailable, keeps safe context and offers the official fallback — and the company can show its reliability.

| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| REL-001 | A public status page | tested | `app/public/status.html` — the page<br>`app/src/lib/statuspage.test.ts` — held | No uptime history, planned-maintenance calendar or per-connector status. | L2, F | — |
| REL-002 | Source freshness and degraded-mode messaging in the app | tested | `app/src/lib/source.test.ts` — the labels<br>`app/src/lib/offline.test.ts` — offline | Held in code; nothing under docs/evidence/ shows it operating. | L2, E | — |
| REL-003 | Service objectives and error budgets for the critical flows | designed | `docs/operating-model/SLOS-AND-ERROR-BUDGETS.md` — the objectives | Nothing measures them; no on-call rota exists. | L8 | — |
| REL-004 | Backup and restore rehearsed | building | `supabase/restore.sh` — the rehearsal CI runs on every change<br>`RESTORE.md` — the procedure | Run by a CI step rather than a test file; no production restore, no RTO or RPO. | L8, M15 | — |
| REL-005 | Release notes and a changelog | designed | `CHANGELOG.md` — for testers | Held in code; nothing under docs/evidence/ shows it operating. | L2 | `oneos:co-changelog` |
| REL-006 | A responsible-disclosure route | tested | `app/public/.well-known/security.txt` — the contact<br>`app/src/lib/security.test.ts` — held | No bug bounty. | L2 | — |
| REL-007 | A quarterly Trust Report | not-started | — | Nothing reports incidents, privacy requests, accessibility issues, AI feedback or community reports as a series. | L3 | `lead:PL-10` |

### GRW

**Growth, habit and community.** Value before login, privacy-safe referral, and recurring rituals that make Semester the student’s operating rhythm rather than an emergency app.

| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| GRW-001 | Free public tools: timeline, schedule builder, registration checklist, advisor agenda | tested | `app/src/site/tools/Tools.test.tsx` — five tools, nothing sent | Eight of the thirteen tools the brief lists are named or absent. | R16, E, P | — |
| GRW-002 | A tool’s result carried into an account and a plan | not-started | — | The tools save nothing, deliberately; no import on sign-up exists. | R16, L13 | — |
| GRW-003 | Referral that reveals nobody | tested | `supabase/referrals.check.sql` — an ambassador sees two counts<br>`app/src/components/referrallink.test.tsx` — the link | No invite to a group, event, club or planning session. | R17, L13, E | `connect:AMB-001` |
| GRW-004 | Sunday reset, Registration Ready and Semester Wrapped | tested | `app/src/lib/weekly.test.ts` — the weekly report<br>`app/src/lib/registration-day.mode.test.ts` — registration day<br>`app/src/lib/wrapped.test.ts` — Wrapped | Named differently in the app; Wrapped and registration mode are off by default. | R18, M1 | — |
| GRW-005 | Midterm Momentum, Career Friday and Graduation Countdown | not-started | — | None exists. | R18, M1 | — |
| GRW-006 | Growth loops: utility, ambassador, advisor, pilot, content, partner, employer, community | designed | `docs/INSTITUTIONAL-GTM-PLAYBOOK.md` — the institutional motion<br>`app/src/lib/gtm/campaign.ts` — the lifecycle stages | No loop model; loops are prose in the briefs. | E, P, L13 | — |

### PAR

**Partners and design partners.** Partners expand Semester without rebuilding every system, each on one standard model, and design partners shape the common operating system without fragmenting it.

| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| PAR-001 | A standard partnership record: purpose, integration, data boundary, value, commercial model, support, branding, privacy, metric, exit plan | not-started | `docs/PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md` — nothing called partnered without evidence | No record carries the brief’s eleven fields. | R12 | — |
| PAR-002 | Provider registry and vendor review | tested | `supabase/integration-quality.check.sql` — provider maturity<br>`app/src/lib/trust/vendorrisk.test.ts` — held | No vendor assessed. | R12, M15 | — |
| PAR-003 | A design-partner programme with bounded configurability and early access under flags | tested | `app/src/lib/governance/config-tiers.test.ts` — configurability without forks<br>`app/src/lib/beta.test.ts` — beta cohorts | No packaged programme and no partner. | M9, E | `lead:PL-13` |
| PAR-004 | Case studies only after real results | tested | `app/src/lib/ops/claims.test.ts` — PROOF_RULES | Held in code; nothing under docs/evidence/ shows it operating. | M9, E | — |

### NAR

**The category narrative and precise claims.** One sentence every stakeholder repeats, and nothing on any page that the operation cannot back.

| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| NAR-001 | A headline and a statement, held to the register beside them | tested | `app/src/lib/oneos.ts` — HEADLINE and STATEMENT<br>`app/src/lib/oneos.test.ts` — held | The briefs’ “connection problem” and “connected education operating system” sentences are not used. | M10, L1, P | `oneos:why-not` |
| NAR-002 | One promise per stakeholder | building | `app/src/lib/oneos.ts` — MESSAGES | Four audiences; the brief names ten. | L1 | — |
| NAR-003 | No page claims to replace an official system, guarantee an outcome, improve retention, be fully compliant or be AI-safe | tested | `app/src/site/site.test.tsx` — the five refused on every page, with a control | Held over the site only; the app and the RFP library have their own lists. | M17 | — |
| NAR-004 | Compliance words refused in the RFP library and launch guides | tested | `app/src/lib/gtm/rfp.test.ts` — CLAIM_WORDS | Held in code; nothing under docs/evidence/ shows it operating. | M17, M15 | — |

### BEN

**The benchmark itself.** A benchmark competitors are measured against: a production bar per feature, a module scorecard, a comparison by workflow, a published annual study, and a final checklist answered honestly.

| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| BEN-001 | A production bar every feature must clear before it is more than a demo | building | `app/src/lib/governance/quality-gates.ts` — the definition of done<br>`app/src/lib/governance/quality-gates.test.ts` — the gate, on fixtures | No feature is graded against it. | M16, F | — |
| BEN-002 | A 0–5 module scorecard, and “fully built” only at 4 or more on depth, privacy, accessibility, reliability and source integrity | tested | `app/src/lib/reinforceregister.ts` — SCORING and mayClaimFullyBuilt<br>`app/src/lib/reinforceregister.test.ts` — held | The model and its gate; no module has been scored by a reviewer. | F, M16 | — |
| BEN-003 | A comparison by workflow against LMS, SIS, student-success, career and campus-app categories | building | `app/src/lib/oneos.ts` — COMPARISON: eight rows, two columns | The six-category, twenty-workflow matrix is not built. | F, E | — |
| BEN-004 | An annual Connected Student Experience Benchmark | designed | `docs/MARKET-LEADERSHIP.md` — PL-03: the annual Academic Friction Index<br>`app/src/site/benchmark.tsx` — /research/: the method, no edition | No data and no edition. | M12, L10 | `lead:PL-03`, `lead:PL-12` |
| BEN-005 | The final checklists, answered against existing question sets | tested | `app/src/lib/reinforceregister.ts` — CHECKLIST<br>`app/src/lib/reinforceregister.test.ts` — every question answered by a set that exists | Four questions have no set that asks them. | M, P, L | — |

### K12

**K–12, as a configured edition later.** K–12 is a deliberate extension of the same operating system, entered only once a district agreement, age-aware controls and guardian consent exist.

| ID | Item | Status | Evidence | Gap | Asked by | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| K12-001 | A stated minimum age and a posture on children | tested | `supabase/minimum-age.check.sql` — under 13 refused at sign-up by the database<br>`docs/legal/TERMS-OF-SERVICE-DRAFT.md` — at least 13 | Set by the owner (D-139); counsel has not reviewed it, and an age is stated, not verified. | F, P | — |
| K12-002 | Guardian consent, age-aware design and strict guardian boundaries | tested | `supabase/minimum-age.check.sql` — a minor is out of discovery, matching, messaging and employer visibility until 18<br>`supabase/k12-guardians.check.sql` — only a K–12 school’s staff record a guardian, for a minor, and the link stops counting at 18 | Age-aware design is held, and a K–12 school’s staff can record and verify a guardian (D-1022); nothing a guardian reads through the link exists yet, and no guardian-facing screen is built. | F, P | `connect:CTL-006` |
| K12-003 | K–12 positioning, segments, module configuration, pilot and PRD | tested | `app/src/lib/k12/edition.ts` — positioning, five segments, ten modules configured for a school, the 26-week pilot<br>`app/src/lib/k12/edition.test.ts` — held<br>`app/src/site/k12.tsx` — /k-12/, which says no district uses Semester | No PRD. Offered to nobody: mayTakeDistrictData() is the sixteen-item district baseline (D-140), and it is false. | F, P | — |

## The operating model

The ten product areas the first brief names, each with the fields it asks every area to define. Every owner is a council seat; a seat nobody holds is marked vacant rather than given a name.

Of 50 ownerships, **15 rest on a vacant seat**.

| Area | Primary user | Problem | Product | Data | Security and privacy | Support | Accessibility | Success metric | Depends on | Integrations | Fallback | Maturity | Next |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Student Experience | A student, on any device, with or without a connected school | The university is spread across systems, and nothing says what matters next or why. | `product` | `data` (vacant) | `privacy` | `success` | `accessibility` | Students completing at least one meaningful action in a week: a plan saved, a conflict resolved, an agenda made. | trust | None: the student’s own data | Local-first: everything a student added works on the device with no account and no network. | tested | A weekly meaningful-action count that the app can report without reading content, measured in a pilot. |
| Academic & Learning Experience | A student in a course, and the instructor who sets its policy | Material, course policy and study work sit in separate tools, and nothing keeps study tied to its source. | `product` | `data` (vacant) | `privacy` | `success` | `accessibility` | Source-linked practice or a study plan completed for a course the student is taking. | ai, integrations | An LMS through LTI 1.3, where a school connects one | The student adds the syllabus and material themselves; nothing needs the LMS. | tested | One course run with its instructor’s policy in force, and the study outcome counted. |
| Campus & Community Experience | A student looking for a resource, an office, a group or an event | Campus resources and groups are hard to find and harder to trust as current. | `product` | `data` (vacant) | `trust` (vacant) | `success` | `accessibility` | A verified resource found, or a safe handoff to the office that owns the problem. | integrations, trust | The institution’s resource directory and events, where published | The official office’s own page, linked, with the freshness label saying the copy may be old. | tested | A campus’s own offices publishing and owning their entries, with a review date each. |
| Career & Opportunity Experience | A student turning coursework into evidence, and later an employer the student opts in to | What a student learned never reaches what they apply for. | `product` | `data` (vacant) | `privacy` | `success` | `accessibility` | Evidence saved, a portfolio item updated, or an application step completed. | learning, trust | None: the student’s own data | Export: the student’s evidence leaves as files, with or without Semester. | tested | An employer-visibility opt-in used by a real student, expiring on its date. |
| Institution Operations | An institution’s administrators, offices and implementation team | An institution cannot govern a student product it cannot configure, audit or roll back. | `product` | `data` (vacant) | `security` (vacant) | `success` | `accessibility` | A tenant moved through its rollout states with every exit gate met and none waived. | integrations, trust | Institutional SSO; SCIM, for an institution that provisions | The pilot_read_only rollout state: nothing is written back while anything is in doubt. | tested | One tenant configured by the institution itself rather than by the founder. |
| Trust, Privacy & Security | Every student, and every reviewer who decides whether an institution may buy | Nobody can trust a product with education records unless its controls can be shown, not asserted. | `privacy` | `data` (vacant) | `security` (vacant) | `success` | `accessibility` | Every public claim and every high-risk action resting on a test or an audit record. | — | None: the student’s own data | Deny by default: row-level security refuses what no policy allows. | tested | The security and privacy seats accepted by people qualified to hold them, and an external assessment. |
| Integrations & Data | An institution’s integration owner | Institutional data arrives late, partial or wrong, and nobody can see which. | `data` (vacant) | `data` (vacant) | `security` (vacant) | `operations` | `accessibility` | Every imported fact carrying its source and freshness, and every failing connection visible before a student sees stale data. | trust | SIS; LMS; Calendars and files, with incremental consent | Student-entered data, labelled as such, until the connection is healthy again. | tested | One live institutional connection reconciled over a term. |
| AI & Automation | A student asking for help with material they are allowed to use | A general chatbot does not know the course, the policy or the source, and cannot say which it used. | `product` | `data` (vacant) | `privacy` | `success` | `accessibility` | Answers that cite the source they rest on, and consequential actions confirmed by the student before they happen. | learning, trust | A model provider, through the metered gateway | Every workflow runs without AI; the assistant is an addition, never the only way. | tested | An evaluation set scored on every release (docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md). |
| Customer Success | An institution’s sponsor and implementation lead | An institution that buys software and is left alone does not renew. | `success` | `data` (vacant) | `privacy` | `success` | `accessibility` | A success plan with goals, risks and a next review for every institution, and renewal decided 120 days before the end. | institution | None: the student’s own data | The founder, acting in the success seat, by hand. | tested | A screen that reads the success tables; today only the database holds them. |
| Growth & Community | A student who has not signed up yet, and the ambassador who told them | Paid acquisition asks for trust before showing value. | `founder` | `data` (vacant) | `privacy` | `success` | `accessibility` | Referred students who reach a first meaningful action, never raw sign-ups. | student, trust | None: the student’s own data | The public tools work with no account and send nothing. | tested | A public tool’s result carried into an account the student makes; nothing does that yet. |

## The playbook’s P0 blockers

Every row the compliance playbook marks P0 — a blocker before institutional data, a public claim or formal vetting — with a seat as owner and the tree’s reading in place of the playbook’s, which predates much of what has landed.

| ID | Control | Owner | Status | Evidence | Next |
| --- | --- | --- | --- | --- | --- |
| DP-01 | Public privacy notice | `privacy` | designed | `docs/legal/PRIVACY-POLICY-DRAFT.md` | Counsel review, then in force with a version and date. |
| DP-02 | Terms of Service | `privacy` | designed | `docs/legal/TERMS-OF-SERVICE-DRAFT.md` | Counsel review, the minimum age of 13 (D-139) included. |
| DP-03 | Data inventory | `data` (vacant) | tested | `app/src/lib/retention.test.ts` | A field-level data dictionary beyond the per-table inventory. |
| DP-04 | Data minimisation | `data` (vacant) | tested | `app/src/lib/governance/module-privacy.test.ts` | A minimum-field review per connector scope. |
| DP-05 | Student data ownership | `privacy` | tested | `app/src/lib/transparency.test.ts` | The promise in force as policy. |
| DP-06 | No sale; no education-record behavioural advertising | `privacy` | tested | `app/src/lib/gtm/campaign.test.ts` | The same words in contract language. |
| DP-08 | Subprocessors | `privacy` | tested | `app/src/lib/trust/subprocessors.test.ts` | Counsel review; published. |
| DP-09 | Retention | `data` (vacant) | tested | `supabase/retention-sweeps.check.sql` | Job logs kept as evidence. |
| DP-10 | Export and deletion | `privacy` | tested | `supabase/deletion.check.sql` | An end-to-end run recorded under docs/evidence/. |
| DP-11 | Consent | `privacy` | tested | `app/src/lib/sharing.test.ts` | An audit-log sample. |
| DP-14 | Third-party sharing | `security` (vacant) | tested | `app/src/lib/trust/vendorrisk.test.ts` | A vendor approval review for each processor. |
| SEC-01 | Security governance | `security` (vacant) | designed | `SECURITY.md` | The security seat accepted. |
| SEC-02 | Secure SDLC | `engineering` | tested | `app/src/lib/branchprotection.test.ts` | CI screenshots kept as evidence. |
| SEC-03 | Secrets management | `engineering` | tested | `app/src/lib/security.test.ts` | A rotation runbook exercised. |
| SEC-04 | Authentication and admin MFA | `security` (vacant) | tested | `supabase/console-control-plane.check.sql` | Fresh MFA is held for the operations console only; the claims register still says planned (IAM-005) for every other privileged role. |
| SEC-05 | Authorisation and tenant isolation | `security` (vacant) | tested | `supabase/rls-coverage.check.sql` | An external review. |
| SEC-06 | SECURITY DEFINER review | `security` (vacant) | tested | `app/src/lib/definerregister.test.ts` | Kept current as functions are added. |
| SEC-07 | Database RLS | `security` (vacant) | tested | `supabase/rls-coverage.check.sql` | A linter baseline kept. |
| SEC-09 | Logging and audit | `security` (vacant) | tested | `supabase/access.check.sql` | One event taxonomy and its retention. |
| SEC-11 | Vulnerability management | `engineering` | designed | `docs/SUPPLY-CHAIN.md` | Patch SLAs by severity, measured. |
| SEC-13 | Incident response | `operations` | tested | `app/src/lib/governance/incident-comms.test.ts` | The first tabletop exercise. |
| SEC-14 | Business continuity | `operations` | designed | `RESTORE.md` | An RTO and RPO, and a production restore drill. |
| SEC-18 | Environment separation | `engineering` | designed | `docs/SUPPLY-CHAIN.md` | Staging isolation validated. |
| A11Y-01 | Accessibility statement | `accessibility` | not-started | — | Write it from the /accessibility/ evidence. |
| A11Y-02 | WCAG 2.2 AA as the acceptance baseline | `accessibility` | tested | `app/src/lib/governance/quality-gates.test.ts` | Applied to a real feature, not a fixture. |
| A11Y-03 | Keyboard access | `accessibility` | tested | `app/src/lib/keys.test.ts` | A manual pass of the critical flows. |
| A11Y-04 | Screen-reader support | `accessibility` | tested | `app/src/a11y/labels.test.ts` | An NVDA and VoiceOver pass by a person. |
| A11Y-05 | Contrast and colour | `accessibility` | tested | `app/src/lib/look.test.ts` | — |
| AI-01 | AI disclosure | `product` | not-started | — | The public AI Use Policy. |
| AI-02 | Provider register | `product` | tested | `app/src/lib/trust/subprocessors.test.ts` | Regions and retention per provider. |
| AI-03 | No unauthorised training | `privacy` | tested | `app/src/lib/trust/ai-training-policy.test.ts` | Provider settings recorded as evidence. |
| AI-04 | Source permissions | `product` | tested | `app/src/lib/governance/ai-lifecycle.test.ts` | — |
| AI-05 | Source grounding | `product` | tested | `app/src/lib/cite.test.ts` | Slide and timestamp citations. |
| AI-06 | Academic integrity | `product` | tested | `app/src/lib/coursestudio.test.ts` | A course policy in force at one institution. |
| AI-08 | Consequential action confirmation | `product` | tested | `app/src/lib/governance/ai-assurance.test.ts` | — |
| AI-09 | Prompt-injection defence | `security` (vacant) | tested | `app/src/ai/injection.live.test.ts` | The live suite run by the owner. |

11 of 36 are owned by a vacant seat.

## The module scorecard

Score a module 0–5 on each criterion. A module may not be called fully built until it scores at least 4 on `depth`, `privacy`, `accessibility`, `observability`, `integrity`; an unscored criterion fails. No module has been scored by a reviewer, so none may be called fully built.

| Criterion | 0 | 3 | 5 | Gates “fully built” |
| --- | --- | --- | --- | --- |
| Real workflow depth | Mockup only | Basic working flow | End-to-end, persistent, exception-safe workflow | yes |
| Data integrity | Demo-only | Imported data | Authoritative or clearly labelled source, freshness, reconciliation | yes |
| Privacy and permissions | Generic access | Basic role control | Object-level, consent-based, audited, revocable control | yes |
| Accessibility | Unverified | Basic keyboard support | WCAG 2.2 AA tested, accessible exports, assistive-tech validation | yes |
| Mobile readiness | Desktop only | Responsive | Mobile-native workflows, offline where appropriate | — |
| Integration | Manual links | One connection | Standard connector, health, freshness, fallback, reconciliation | — |
| Observability and reliability | No measurement | Basic events | SLOs, error tracking, audit, adoption, support and quality metrics | yes |
| Student value | Nice feature | Helpful workflow | Repeatedly reduces real friction and creates visible progress | — |
| Institutional value | Local utility | Department value | Governed, measurable, scalable cross-campus value | — |
| Defensibility | Easily copied | Some workflows | Unique graph, relationships, trust, integrations and adoption loop | — |

## The final checklists

The questions the briefs end on, merged where they ask the same thing, each pointed at the question set the tree already answers it in rather than answered again here.

| Question | Asked by | Answered in |
| --- | --- | --- |
| Does a student have one place to understand the whole journey, and reach a useful next step within minutes? | M, P, L | [`app/src/lib/oneos.ts`](../app/src/lib/oneos.ts) |
| Do all modules share identity, permissions, sources, actions, search, workspace and intelligence? | M | [`app/src/lib/ops/leadership.ts`](../app/src/lib/ops/leadership.ts) |
| Can a student start from a course, deadline, event, resource, mentor or opportunity and reach a clear next action? | M, L | [`app/src/lib/oneos.ts`](../app/src/lib/oneos.ts) |
| Does it work on desktop, mobile, low bandwidth, keyboard and assistive technology? | M, L | [`app/src/lib/ops/leadership.ts`](../app/src/lib/ops/leadership.ts) |
| Can users see source, freshness, limitation and ownership for important information? | M, P, L | [`app/src/lib/standard.ts`](../app/src/lib/standard.ts) |
| Can users control sharing, revoke access, export and request deletion? | M, P | [`app/src/lib/standard.ts`](../app/src/lib/standard.ts) |
| Are AI actions explainable, source-grounded, policy-aware and confirmed before consequential changes? | M, L | [`app/src/lib/standard.ts`](../app/src/lib/standard.ts) |
| Are security, privacy, accessibility and incident practices documented and tested? | M, L | [`app/src/lib/trust/compliance-crosswalk.ts`](../app/src/lib/trust/compliance-crosswalk.ts) |
| Can a university pilot quickly with limited data, controlled scope and a measurable outcome? | M, P, L | [`app/src/lib/operationalreality.ts`](../app/src/lib/operationalreality.ts) |
| Can IT, legal, privacy, accessibility, advising and student-success stakeholders all understand the platform? | M | [`app/src/lib/ops/leadership.ts`](../app/src/lib/ops/leadership.ts) |
| Does the console make content, permissions, integrations, flags, freshness and support governable without custom code? | M, P | [`app/src/lib/operationalreality.ts`](../app/src/lib/operationalreality.ts) |
| Can Semester prove implementation quality and operational reliability, and explain degraded states? | M, L | [`app/src/lib/operationalreality.ts`](../app/src/lib/operationalreality.ts) |
| Is there a repeatable sales, implementation, success, support and renewal model, with its operating cost explained per package? | M, P | [`app/src/lib/operationalreality.ts`](../app/src/lib/operationalreality.ts) |
| Is every high-risk feature owned and reviewed? | M | [`app/src/lib/governance/pia.ts`](../app/src/lib/governance/pia.ts) |
| Can the team ship safely, monitor quality, recover from failure and learn from each pilot? | M, L | [`app/src/lib/operationalreality.ts`](../app/src/lib/operationalreality.ts) |
| Does Semester improve the student experience without becoming a surveillance system? | P | [`app/src/lib/ops/leadership.ts`](../app/src/lib/ops/leadership.ts) |
| Do students, advisors, faculty, staff, accessibility experts and institutions meaningfully shape the product? | M, L | **No set asks it** |
| Is Semester known for a category-defining promise, not a list of features? | M, L | **No set asks it** |
| Does it publish evidence, useful free tools, trusted content and original market insight? | M, L | **No set asks it** |
| Does it earn student habit, institutional sponsorship and partner distribution, and grow more valuable as verified information connects? | M | **No set asks it** |
