# Platform constitution and capability map

<!-- Rendered from app/src/lib/governance/constitution.ts by constitution.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

Semester has covered the product domains a university runs on. What remains
is not another module; it is keeping the ones there coherent. Every capability
belongs to one of eight primitives, and a proposed feature that strengthens
none of them is deferred, merged or rejected.

**37 capabilities named by the four briefs: none complete, 27 partial, 10 absent.** A partial row cites the file that holds part of it; an absent row cites nothing. The test states these counts, so a change either way is a line in a diff.

## The eight primitives

| Primitive | One shared system | Lives in | Capabilities |
| --- | --- | --- | ---: |
| Identity and tenancy | Who the actor is and which tenant boundary applies | `packages/institution/src/identity.ts` | 0 |
| Permission, consent, and authority | Who may read, write, approve, share, export, or revoke for a stated purpose | `app/src/lib/privacy.ts` | 2 |
| Canonical data and provenance | What a record means, where it came from, how fresh it is, and how it is corrected | `app/src/lib/provenance.ts` | 7 |
| Policy and rules | Versioned institutional, course, contractual, and product constraints | `packages/institution/src/policy.ts` | 2 |
| Action and workflow | Draft, review, confirmation, execution, receipt, recovery, and reconciliation | `app/src/lib/actions.ts` | 9 |
| Integration gateway | Bounded external-system contracts, health, idempotency, fallback, and revocation | `app/server/institution/gateway.ts` | 2 |
| Trust and evidence | Audit events, controls, evidence, claims, incidents, and approvals | `app/src/lib/ops/evidence.ts` | 7 |
| Experience and accessibility | Coherent interaction patterns, accessible alternatives, errors, degraded behavior, and support routes | `app/src/lib/accessmode.ts` | 8 |

## The constitution

| Part | The product is held to | Held by |
| --- | --- | --- |
| Student control | Students control personal plans, drafts, sharing, and exports. | `app/src/lib/advisor-shares.ts` |
| Institutional authority | Official institutional systems remain authoritative unless an institution explicitly approves Semester for a bounded workflow. | `docs/DOMAIN-REPLACEMENT-REGISTER.md` |
| Provenance | Meaningful facts carry source, provenance, freshness, and correction paths. | `app/src/lib/provenance.ts` |
| High-impact actions | High-impact actions are explained, previewed, confirmed, and audited. | `app/src/lib/actions.ts` |
| AI | AI cites authorized sources, follows institutional and course policy, and does not silently make high-impact decisions. | `app/src/lib/source.ts` |
| Least privilege | No person, integration, or agent receives unrestricted student-data access by default. | `app/src/lib/privacy.ts` |
| Tenancy and purpose | Tenant data is isolated and sensitive requests are purpose-bound. | `app/server/institution/gateway.ts` |
| Accessibility | Accessibility is a release criterion. | `docs/DEFINITION-OF-DONE.md` |
| Failure recovery | Failures preserve data, expose honest status, and retain an official or human fallback. | `app/src/lib/statusnotice.ts` |
| Public claims | Public claims cannot exceed verified maturity and current evidence. | `app/src/lib/ops/claims.ts` |
| Tenant activation | Tenant activation requires the applicable policy, approval, data map, support ownership, monitoring, and rollback path. | `app/src/lib/governance/config-tiers.ts` |
| Smallest safe solution | Semester builds the smallest safe solution that improves a defined student decision or institutional workflow. | `docs/DO-NOT-BUILD.md` |

## Feature admission

Answered before work starts on any feature, workflow, screen, integration or
system. The answers are the first section of the pull request.

1. What student, faculty, staff or institution problem does this solve?
2. Which of the eight primitives does it strengthen?
3. What is the source of truth?
4. What data is needed, and what is the minimum necessary amount?
5. Who can read, write, share, export or delete it?
6. What policy and consent rules apply?
7. How does it work with keyboard, screen readers, mobile, low bandwidth and reduced motion?
8. What does it do when a dependency fails or data is stale?
9. What is the fallback or official handoff?
10. What is the success metric?
11. Who owns support, security, privacy, accessibility and operations?
12. How can it be audited, exported, migrated, rolled back or retired?

## Priority order

|  | Complete |
| --- | --- |
| P0 | Make the core platform safe, persistent, accessible and observable |
| P1 | Complete the student Action Center, Path, Plan, Learning and Support loops |
| P2 | Complete the faculty, advisor and institution operating workflows |
| P3 | Complete integration, migration, trust and procurement systems |
| P4 | Complete native LMS/SIS replacement modules through controlled parallel runs |
| P5 | Expand into credentials, federation, marketplace, global, K–12, alumni and life |

## Capability map

| Id | Capability | Primitive | Priority | Status | Evidence file | What exists, what would close it |
| --- | --- | --- | --- | --- | --- | --- |
| J-01 | Universal learner journey engine | action-workflow | P1 | partial | `app/src/lib/pathway.ts` | Life stages and milestone templates exist; no goal → decision → support → evidence → reflection chain, and no flow for major exploration, recovery, research, graduate school or alumni. |
| J-02 | Life-event model | experience-accessibility | P1 | partial | `app/src/lib/lifeevents.ts` | Twelve events with no field to type in, drawn on Behind behind VITE_ME_LIFE_EVENTS (off by default): optional adjustments, help routes that seed Help with nothing filled in, a plan that clears after four weeks with one follow-up. Kept on the device only, sent nowhere. Not on Today, and Behind shows it only once a term is imported. |
| J-03 | Student-success playbook system | action-workflow | P2 | absent | — | No institution-configurable playbook object; `institution-ops.ts` defines metrics and `CampaignManager.tsx` sends, neither is a playbook. |
| J-04 | Continuous feedback and “You said, we changed” | experience-accessibility | P1 | partial | `app/src/lib/momentfeedback.ts` | Two of eight moments are asked (an AI answer that has a source, a help request just sent) behind VITE_ME_MOMENT_FEEDBACK (off by default), with a daily cap, a gap, a way out and an off switch; What’s new shows the log (empty) and the controls. Answers stay on the device: no collection path to a school exists, so no aggregate is shown to anyone. Six moments are declared and not asked. |
| J-05 | Learning-community infrastructure | experience-accessibility | P5 | partial | `app/src/community/circles.ts` | Rules and schema are strong (opt-in, capped, ended, no popularity, no open DMs); circles are not persisted and have no screen. |
| J-06 | Academic portfolio and showcase | data-provenance | P5 | partial | `app/src/lib/career-evidence.ts` | Confirmed skills, artifacts, résumé versions; no reflection step, no limited-share link, no per-item visibility column. |
| J-07 | Relationship map (My Network) | experience-accessibility | P2 | partial | `app/src/lib/mentors.ts` | Career contacts with permission state and follow-up, mentors, advisor meetings; no unified view, and DO-NOT-BUILD rule 1 forbids a new root. |
| J-08 | Credential verification network | data-provenance | P5 | absent | — | CREDENTIAL-WALLET.md is a design; no issuer model, revocation state, share model, QR verify page or schema registry. |
| J-09 | Content and knowledge strategy (layers and metadata) | data-provenance | P3 | absent | — | Trust labels exist (`source.ts`, `where.ts`); no owner, licence, authority, expiry or locale metadata on content. |
| J-10 | Institution benchmarking framework | trust-evidence | P3 | partial | `app/src/lib/cohortfloor.test.ts` | The small-cohort floor holds in app and database; no opt-in cross-institution benchmark exists, and none may rank publicly. |
| J-11 | Platform localization and cultural adaptation | experience-accessibility | P5 | partial | `app/src/lib/locale.ts` | Date, time and number formats and RTL detection; no message catalogue, no `dir`, no terminology mapping, one data region. |
| J-12 | AI transparency receipt | trust-evidence | P1 | partial | `app/src/intelligence/Disclosure.tsx` | Per-answer disclosure is built; no persisted per-interaction receipt with source versions and permissions used. |
| J-13 | Education privacy UX (Privacy Center) | permission-consent-authority | P0 | partial | `app/src/lib/mecontrols.ts` | Fifteen Me controls and a Privacy screen; not yet one “what Semester knows” center, and no student view of who viewed a profile. |
| J-14 | Ethical revenue and marketplace controls | trust-evidence | P3 | partial | `app/src/lib/gtm/sponsor.ts` | The sponsorship gate is built and tested; no per-item why/who/paid/data/hide card, and no marketplace. |
| J-15 | Public ethics and accountability report | trust-evidence | P3 | partial | `app/src/lib/standard.ts` | The Semester Standard is public; the annual report is owed until a year has passed. |
| I-01 | Institutional memory system | data-provenance | P2 | partial | `app/src/lib/ops/operatingsystem.ts` | A 60-row document register with owners and review dates; no versioned policies, catalog-year snapshots or “what changed” timeline. |
| I-02 | Decision provenance | data-provenance | P2 | partial | `app/src/lib/provenance.ts` | Domain records carry decided_by and rationale; no generic model with authority, policy version, evidence and appeal path. |
| I-03 | Education workflow marketplace | action-workflow | P5 | absent | — | Workflow state machines exist in `packages/institution`; no installable workflow package. |
| I-04 | Explainability by default beyond AI | action-workflow | P1 | partial | `app/src/lib/actions.ts` | Actions, screens, policy denials and notifications each explain; three shapes, no shared contract, no “why can I do this”. |
| I-05 | Semantic policy and regulation engine | policy-rules | P3 | absent | — | No clause extraction or version diff; `policysim.ts` simulates flag and retention changes only. |
| I-06 | Cross-role simulation | permission-consent-authority | P2 | partial | `app/src/components/institutional/RoleWorkspace.tsx` | A sandbox preview with fixtures behind a build flag; production has no view-as by design. |
| I-07 | Workflow digital twin | action-workflow | P3 | absent | — | Mapping simulation exists (`integration/simulate.ts`); no trigger → policy → role → notification → outcome model. |
| I-08 | Platform observability graph | trust-evidence | P0 | partial | `app/src/lib/statusnotice.ts` | Incidents name affected screens by hand; no service → dependency → workflow → cohort model. |
| I-09 | Adaptive interface engine | experience-accessibility | P1 | partial | `app/src/lib/accessmode.ts` | Device, preference and role adaptation exist and are never inferred; term phase and workflow are thin, and no one engine joins them. |
| I-10 | Product localization and terminology engine | experience-accessibility | P5 | partial | `app/src/lib/vocabulary.ts` | Semester’s own terms are owned; the per-institution dictionary (course / module / paper) is planned only. |
| I-11 | Minimum-necessary automation framework | action-workflow | P0 | partial | `packages/institution/src/automation.ts` | The seven-rung ladder is in the gateway contract and the commit path asks it, with its grounds, before it claims an action; eight features declare a rung in `automationrungs.ts`. Browser features other than the help request do not call it, and no action pipeline yet names who decides. |
| I-12 | Architecture simplification program | policy-rules | P0 | partial | `app/src/donotbuild.test.ts` | Roots, notifiers, the locale formatter and the definer register are guarded mechanically; there is no general reuse-the-primitive guard. |
| O-01 | Accreditation and program review | trust-evidence | P3 | absent | — | Maturity area `accreditation` lists the controls; no outcomes mapping, curriculum map or evidence repository. |
| O-02 | Institutional research and survey operations | trust-evidence | P3 | absent | — | No survey builder, cohort selection or fatigue control; the cohort floor is the only part in place. |
| O-03 | Campus events and space operations | action-workflow | P3 | partial | `app/src/screens/Activities.tsx` | Campus activities exist; no RSVP/waitlist, room requests or capacity controls. |
| O-04 | Student organizations and leadership | action-workflow | P3 | partial | `app/src/screens/Activities.tsx` | Activities and a leadership record exist; no officer roles, transition checklist or budget handoff. |
| O-05 | Institutional communications and crisis readiness | experience-accessibility | P3 | partial | `app/src/lib/statusnotice.ts` | Status notices and an announcements screen; no audience targeting, acknowledgement or communication audit log. |
| O-06 | Course materials and affordability | data-provenance | P3 | partial | `app/src/screens/Costs.tsx` | A cost screen exists; no required-materials list, OER identification or library-reserve links. |
| O-07 | Data warehouse and institutional BI integration | integration-gateway | P3 | absent | — | No connectors, data catalog or query audit log; the trust dashboard is aggregate-only. |
| O-08 | Mobile ID and physical campus integration | integration-gateway | P5 | absent | — | Not built, and any build is bounded: no location tracking and no access-log browsing as a student feature. |
| O-09 | Disaster and academic disruption planning | action-workflow | P0 | partial | `app/src/lib/governance/maturity.ts` | Maturity area `disaster` lists the controls and offline study exists; no closure, modality-change or deadline-adjustment workflow. |
| O-10 | Documentation and knowledge management | data-provenance | P2 | partial | `app/src/lib/ops/operatingsystem.ts` | A document register with owners and review dates; no SOP library, versioned forms or staff onboarding. |

Owner, data classification, permission model, contracts, SLO, fallback,
migration state and release status are held for the shipped modules by
[`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md),
[`CAPABILITY-PARITY-MATRIX.md`](CAPABILITY-PARITY-MATRIX.md) and
[`ROLE-LAUNCH-REGISTER.md`](ROLE-LAUNCH-REGISTER.md); this map adds the primitive,
the priority and the evidence, and does not duplicate them.

## Departments and the line each does not cross

Semester serves every department by centralising the experience, workflow,
explanation and action layer, not by giving departments broad student-data
access: need → minimum data → role and purpose check → consent where the
student is the source → approved workflow or official handoff → audit and
retention.

| Department | Boundary |
| --- | --- |
| Registrar | Remains authoritative for transcript, enrollment and degree conferral until formally replaced |
| Admissions / enrollment | Admissions decisions and official application records remain governed workflows |
| Financial aid | Do not calculate awards or expose detailed aid data without authorization |
| Student accounts / bursar | Do not operate the official ledger or store payment credentials |
| Housing / residence life | Avoid contracts, room assignments, incident case records and location data by default |
| Dining / campus card | Do not store purchase history or card credentials |
| Library | Licensed research content requires approved library integration |
| Disability / accessibility office | No diagnosis storage or broad faculty access |
| Counseling / wellbeing | No therapy notes, diagnoses or clinical case management |
| Title IX / conduct | Never build generic case management without specialist legal governance |
| Campus safety / emergency | Do not replace emergency systems or expose sensitive incident data early |
| International student office | No immigration advice or sensitive case files without specialized authority |
| Veterans / military services | Do not determine benefits eligibility |
| Athletics | No health or injury data, effort scoring or eligibility decisions |
| Student employment | Payroll and employment records remain HR-owned |
| Career services | No employer access without explicit student opt-in |
| Alumni / advancement | Strictly separate donor and advancement data from student academic records |
| Research administration | IRB, grants, contracts and compliance remain authorized specialist functions |
| Procurement | Procurement owns contract authority |
| Legal / compliance | Legal decisions and case files remain restricted |
| Institutional research | No small-cohort or individual surveillance analytics |
| Communications / marketing | Separate institutional communications from product marketing |
| Advancement / foundation | Separate from student data and respect fundraising law |
| Facilities / transportation | No real-time location tracking by default |
| IT / security | IT retains infrastructure and security authority |
| Human resources | Payroll, employment files and benefits remain HR-owned |
| Faculty senate / curriculum committees | Formal academic governance remains institution-controlled |
| Institutional effectiveness / accreditation | Preserve audit trails and approved evidence sources |
| Continuing education | Separate commercial and continuing-ed rules and credential requirements |
| Bookstore / OER office | Purchasing stays in official commerce systems |
| Community engagement | Student consent and safety requirements apply |
| Parent / family programs | Never default to education-record access |
| K–12 district operations | Separate COPPA/FERPA/state student-privacy product mode |

## Roles (56)

Every role is defined by 10 things before it exists: scope; capabilities; data it can read; data it can never read; actions it can take; approval requirements; consent requirements; expiry; audit requirements; support and training needs.

- **Learners.** Student, Prospective student, Applicant, Admitted student, Transfer student, Dual-enrollment student, Graduate student, Returning student, Alumni, Lifelong learner.
- **Teaching.** Faculty, Co-instructor, Teaching assistant, Instructional designer, Department chair, Program director, Dean.
- **Support.** Academic advisor, Success coach, Tutor, Writing-center staff, Library staff, Career coach, Peer mentor, Orientation leader.
- **Offices.** Registrar, Curriculum analyst, Financial-aid officer, Bursar staff, Housing staff, Dining staff, International advisor, Veterans certifying official, Athletics compliance officer, Disability services officer, Research administrator.
- **Governance.** Institutional researcher, Institution administrator, IT administrator, Security officer, Privacy officer, Accessibility lead, Procurement officer, Legal counsel, Communications officer, Alumni/advancement officer.
- **Outside.** Parent/guardian, Employer, Mentor, Community partner, Credential issuer, Integration partner, Vendor, Auditor, Accreditor, Government/regulatory reviewer.

## The fourteen operating areas

Academic Core · Learning & Assessment · Planning & Registration · Advising & Support · Campus Life · Career & Lifelong Learning · Identity & Credentials · Finance & Affordability Navigation · Communications & Community · Research & Accreditation · Institutional Operations · Data, Trust & Governance · Integration & Migration · K–12 / Family / Alumni Extensions
