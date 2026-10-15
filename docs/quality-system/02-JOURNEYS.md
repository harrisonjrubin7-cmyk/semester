# 02 · Critical journey catalog: every role, every domain

> Part of the [quality-system pack](README.md). Status: **proposed**.
> Source of truth: [`app/src/lib/governance/journey-catalog.ts`](../../app/src/lib/governance/journey-catalog.ts).
> This page is held to it by [`journey-catalog.test.ts`](../../app/src/lib/governance/journey-catalog.test.ts):
> a journey missing from this page, a journey on this page that the catalog does
> not have, a title that differs, a role with no journey, a cited file that does
> not exist, and a command that names no real script or suite all fail the build.

## 1. What a journey is, and how this relates to CF-01..CF-10

[`CRITICAL-FLOW-TEST-PLAN.md`](../engineering-operations/CRITICAL-FLOW-TEST-PLAN.md)
names ten priority flows. They stay the spine: **each CF has at least one
journey here, and a test fails if one does not**. A journey is the smaller unit —
one role finishing one outcome — so that "what does a data steward have?" and
"what covers a guardian?" have answers that are not somebody's memory.

A row records, per journey:

| Field | Meaning |
| --- | --- |
| `roles` | rows of `public.app_roles` (the register in `rolelaunch.ts`) who must be able to finish it. A guardian is a relationship, not a grant, so it is an *actor* and says so |
| `priority` | **P0** blocks every gate it is named in; **P1** blocks `tenant-launch`; **P2** is tracked. Same letters as the internal severity vocabulary, on purpose |
| `gate` | the first of the [seven gates](04-GATES-AND-CI.md) at which it must pass, and every later one |
| `layers` | which suites in [03](03-SUITES.md) prove it |
| `run` | commands that exercise it today — checked to exist |
| `evidence` | files that prove part of it — checked to exist |
| `owed` | what is **not** proved, in words |
| `synthetic` | whether production verification probes it ([07](07-PRODUCTION-VERIFICATION.md)) |

**Status is arithmetic, not opinion.** No evidence → `owed`. Evidence and a
non-empty `owed` → `partial`. Evidence and nothing owed → `automated`. There is
no field to type a status into, so a row cannot be promoted by editing a word.
This is `TEST-COVERAGE-MATRIX.md`'s "partial is not a pass" as code. Two further
rules are tests: a P0 journey may not be `owed` (it must stand on something),
and a journey with no evidence must say what is owed.

## 2. Where it stands

<!-- journeys:summary:start -->
**44 journeys · 19 P0 · 18 P1 · 7 P2 · 0 `automated` · 44 `partial` · 0 `owed`.** 28 are gated at `tenant-launch`; 3 are probed in production.
<!-- journeys:summary:end -->

While `automated` reads zero, that is the honest reading, and it is not a failure of the suites:
most proof today is a second-account SQL suite or a gateway test, which proves
the *boundary* and not the person finishing the *journey* in a browser. Closing
the gap is the work, in the order of the next section. A row reaches
`automated` only when its browser (or device) proof exists *and* the owed list
is empty — so the count will move only when something real lands.

## 3. The P0 debt, in one table

The P0 journeys block gates. This is what each is still owed; it is the
work list that the [first pull requests](08-REPOSITORY-AND-FIXTURES.md) §6 draw from.

<!-- journeys:debt:start -->
| ID | Journey | Owed before it can be called proved |
| --- | --- | --- |
| `J-ID-01` | Sign up, verify, sign in, recover, use on a second device | sign-up → verify → recover → export → delete in one scripted run (release gate G1) |
| `J-ID-03` | Grant a role: request, a second person approves, audit first | browser journey for the approvals view; role-grant paths outside the console are asserted absent only by a grep |
| `J-ACA-01` | Add a course from its syllabus; deadlines and degree path follow | the same journey signed in; hostile and malformed files through the real extractor |
| `J-ACA-02` | Plan registration, resolve conflicts, hand off to the official system | readback against a real student information system; no seat or eligibility claim exists until then |
| `J-LRN-01` | Build a course, publish, grade, give feedback, release grades | browser journey for a grade change end to end; grade passback to a real learning system |
| `J-LRN-04` | Issue and revoke a functional accommodation passport | a browser journey; faculty-side view acceptance by a disability-services officer |
| `J-PRD-01` | Add actions, events and notes offline; reconnect; conflicts shown | throttled and partitioned browser run; clock-skew, reorder and revoke-while-offline simulator |
| `J-AI-01` | Ask the assistant: sources shown, injection refused, kill switch stops it | a filed model-quality run; a release gate wired to the score |
| `J-AI-03` | A consequential AI suggestion needs a person; the person can override | a browser journey for the review queue |
| `J-COM-01` | Report content; moderate; escalate to two reviewers; appeal | a staffed queue and an answered escalation drill |
| `J-COM-02` | Join a members-only course room, message, react, leave | no school is switched on, so the evidence is not filed (release gate G2) |
| `J-FAM-01` | Invite a guardian, choose what is shared, guardian views, student revokes | browser journey for guardian and student on two devices; counsel review of age and relationship policy |
| `J-FIN-01` | Buy, change, cancel and refund a paid plan | live charges are off pending approval; refund and dispute events change nothing yet; finance reconciliation |
| `J-ADM-01` | Configure a tenant, move its ring, pull the kill switch | target-tenant acceptance by a named customer role |
| `J-ADM-03` | A school leaves: inventory, two-sided approval, export, archive, purge window | rehearsal by a second person; the purge is not built |
| `J-SUP-01` | Ask for help; share context with consent; get an answer; revoke | a ticket does not yet attach a consented grant; a staffed queue and a named owner |
| `J-SUP-02` | Export or delete an account; holds and retention honoured | the one scripted sign-up → export → delete run; a named answerer for rights requests |
| `J-OPS-01` | Release: smoke, alert, degrade or roll back, record the evidence | a second operator; alert delivery history; an immutable release record per revision |
| `J-OPS-02` | Restore from backup into an isolated target and verify invariants | production has never been restored; no recovery time or point can be stated; gateway journal has no backup |
<!-- journeys:debt:end -->

## 4. The catalog

Roles are abbreviated to the first four; the catalog holds them all. *Pri*,
*CF* and *Gate* are defined above. The summary, the debt table and this catalog are
**generated**: `cd app && npm run journeys -- --write` rewrites them, and
`journey-catalog.test.ts` fails if they differ from what the catalog renders.

<!-- journeys:table:start -->
### Identity and tenancy

| ID | Journey | Roles | Pri | CF | Gate | Layers | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `J-ID-01` | Sign up, verify, sign in, recover, use on a second device | prospective_student, student, undergraduate_student, graduate_student, +4 more | P0 | CF-02 | `pull-request` | e2e, rls, offline, synthetic | partial |
| `J-ID-02` | Provision and deprovision people through SSO and SCIM | university_admin, department_admin, university_staff, integration_admin, implementation_manager | P1 | — | `tenant-launch` | contract, rls, security | partial |
| `J-ID-03` | Grant a role: request, a second person approves, audit first | platform_admin, university_admin, data_steward, implementation_manager, portfolio_council | P0 | — | `pull-request` | rls, security | partial |

### Academic core

| ID | Journey | Roles | Pri | CF | Gate | Layers | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `J-ACA-01` | Add a course from its syllabus; deadlines and degree path follow | student, undergraduate_student, graduate_student, transfer_student, dual_enrollment_student | P0 | CF-03 | `pull-request` | e2e, a11y, unit | partial |
| `J-ACA-02` | Plan registration, resolve conflicts, hand off to the official system | student, undergraduate_student, graduate_student, registrar | P0 | CF-04 | `staging` | unit, rls, contract, load | partial |
| `J-ACA-03` | Publish the catalog and requirements; approve a transfer equivalency | registrar, department_chair, dean, transfer_student, transfer_partner_admin | P1 | — | `tenant-launch` | rls, contract | partial |
| `J-ACA-04` | Advising meeting from a plan the student chose to share | academic_advisor, student, undergraduate_student, graduate_student | P1 | — | `tenant-launch` | rls, unit | partial |
| `J-ACA-05` | Arrive: pre-arrival actions, orientation checklist, accepted mentor | admitted_student, orientation_leader, peer_mentor, first_year_staff | P2 | — | `tenant-launch` | rls | partial |
| `J-ACA-06` | Explore programs and cost estimates without an account | prospective_student | P1 | — | `production` | e2e, synthetic | partial |

### Learning

| ID | Journey | Roles | Pri | CF | Gate | Layers | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `J-LRN-01` | Build a course, publish, grade, give feedback, release grades | faculty, teaching_assistant, student | P0 | — | `tenant-launch` | rls, unit, security | partial |
| `J-LRN-02` | Launch from the learning system by LTI, with grade passback off | faculty, student, integration_admin | P1 | — | `tenant-launch` | contract, rls, security | partial |
| `J-LRN-03` | Study with sources: practice, flashcards, a plan, save or dismiss | student, undergraduate_student, graduate_student, tutor, learning_center_staff | P1 | CF-05 | `pull-request` | component, a11y, ai | partial |
| `J-LRN-04` | Issue and revoke a functional accommodation passport | disability_services_officer, disability_services_staff, faculty, student | P0 | — | `tenant-launch` | rls, security | partial |

### Productivity

| ID | Journey | Roles | Pri | CF | Gate | Layers | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `J-PRD-01` | Add actions, events and notes offline; reconnect; conflicts shown | student, undergraduate_student, graduate_student, transfer_student, +3 more | P0 | CF-01 | `pull-request` | offline, unit, rls, e2e | partial |
| `J-PRD-02` | Write a document, sheet or deck; export it; restore it elsewhere | student, undergraduate_student, graduate_student, transfer_student, +2 more | P1 | — | `pull-request` | unit, component, rls | partial |

### AI services

| ID | Journey | Roles | Pri | CF | Gate | Layers | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `J-AI-01` | Ask the assistant: sources shown, injection refused, kill switch stops it | student, undergraduate_student, graduate_student, transfer_student, +2 more | P0 | CF-05 | `staging` | ai, security, unit | partial |
| `J-AI-02` | Set a course AI policy; the assistant obeys it for that course | faculty, teaching_assistant, student | P1 | — | `tenant-launch` | ai, rls | partial |
| `J-AI-03` | A consequential AI suggestion needs a person; the person can override | academic_advisor, faculty, university_admin | P0 | — | `tenant-launch` | ai, rls, security | partial |

### Campus life

| ID | Journey | Roles | Pri | CF | Gate | Layers | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `J-CAM-01` | Order a meal; give or use a shared swipe; staff work the queue | student, undergraduate_student, dining_staff | P2 | — | `tenant-launch` | rls, load | partial |
| `J-CAM-02` | Find a space, a housing assignment, a person, a place on the map | student, undergraduate_student, residence_life_staff, resident_assistant | P2 | — | `tenant-launch` | rls, contract | partial |
| `J-CAM-03` | Run a club or a team: members, events, officers, compliance | organization_member, organization_officer, organization_admin, athletic_academic_support, athletics_compliance_officer | P2 | — | `tenant-launch` | rls, contract | partial |
| `J-CAM-04` | An office publishes an action or event to the students it reaches | career_center_staff, study_abroad_advisor, international_student_advisor, veterans_certifying_official, +4 more | P1 | — | `tenant-launch` | rls, security | partial |

### Community and trust

| ID | Journey | Roles | Pri | CF | Gate | Layers | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `J-COM-01` | Report content; moderate; escalate to two reviewers; appeal | student, moderator, trust_safety_reviewer, trust_safety_senior, community_manager | P0 | — | `tenant-launch` | rls, component, security | partial |
| `J-COM-02` | Join a members-only course room, message, react, leave | student, undergraduate_student, graduate_student, transfer_student, dual_enrollment_student | P0 | — | `tenant-launch` | rls, security | partial |

### Family and guardian

| ID | Journey | Roles | Pri | CF | Gate | Layers | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `J-FAM-01` | Invite a guardian, choose what is shared, guardian views, student revokes | student, dual_enrollment_student, high_school_counselor, guardian (not a role) | P0 | — | `tenant-launch` | rls, security, component | partial |

### Finance

| ID | Journey | Roles | Pri | CF | Gate | Layers | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `J-FIN-01` | Buy, change, cancel and refund a paid plan | student, undergraduate_student, graduate_student, alumni, +2 more | P0 | CF-10 | `staging` | rls, contract, security | partial |
| `J-FIN-02` | See a bill, choose a payment plan, pay, get a receipt | student, undergraduate_student, graduate_student, student_accounts_officer, billing_contact | P1 | — | `tenant-launch` | rls, contract, unit | partial |
| `J-FIN-03` | The institution is billed: plan, usage, invoice, dispute | billing_contact, finance_operator, account_executive, university_admin | P1 | — | `tenant-launch` | rls, contract | partial |

### Career and lifelong

| ID | Journey | Roles | Pri | CF | Gate | Layers | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `J-CAR-01` | A verified opportunity is published; a student applies; the employer sees only the application | student, undergraduate_student, graduate_student, employer, +3 more | P1 | — | `tenant-launch` | rls, contract | partial |
| `J-CAR-02` | Keep a lifelong profile; offer mentoring; stay reachable only by consent | alumni | P2 | — | `tenant-launch` | rls | partial |

### Marketplace

| ID | Journey | Roles | Pri | CF | Gate | Layers | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `J-MKT-01` | A partner onboards, lists an offer, a moderator approves it | marketplace_partner, research_partner, business_admin, moderator | P2 | — | `tenant-launch` | rls, security | partial |

### Administration

| ID | Journey | Roles | Pri | CF | Gate | Layers | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `J-ADM-01` | Configure a tenant, move its ring, pull the kill switch | university_admin, implementation_manager, platform_admin, portfolio_council | P0 | CF-08 | `canary` | rls, e2e, security | partial |
| `J-ADM-02` | Import a roster and migrate records; reconcile; roll back | implementation_manager, university_staff, department_admin, data_steward | P1 | — | `tenant-launch` | rls, recovery | partial |
| `J-ADM-03` | A school leaves: inventory, two-sided approval, export, archive, purge window | university_admin, data_steward, platform_admin, compliance_owner | P0 | — | `tenant-launch` | rls, recovery, security | partial |
| `J-ADM-04` | Read governed, aggregate, suppressed analytics for a scope | institutional_researcher, department_chair, dean, portfolio_council | P1 | — | `tenant-launch` | rls, security | partial |

### Support, safety and rights

| ID | Journey | Roles | Pri | CF | Gate | Layers | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `J-SUP-01` | Ask for help; share context with consent; get an answer; revoke | student, undergraduate_student, support_agent, customer_success, incident_responder | P0 | CF-06 | `staging` | rls, e2e, a11y | partial |
| `J-SUP-02` | Export or delete an account; holds and retention honoured | student, data_steward, compliance_owner, trust_officer, alumni | P0 | CF-07 | `staging` | rls, recovery, security | partial |
| `J-SUP-03` | Publish the trust room; place and lift a legal hold | trust_officer, compliance_owner, content_owner, data_steward | P1 | — | `tenant-launch` | rls, security | partial |

### Integration

| ID | Journey | Roles | Pri | CF | Gate | Layers | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `J-INT-01` | Configure, approve, sync, reconcile, pause, replay a connector | integration_admin, implementation_manager, university_admin, research_partner | P1 | — | `tenant-launch` | contract, rls, security | partial |
| `J-INT-02` | Import a calendar or learning-system schedule; freshness and source shown | student, undergraduate_student, graduate_student, transfer_student, dual_enrollment_student | P1 | — | `staging` | contract, unit, e2e | partial |

### Operations and commercial

| ID | Journey | Roles | Pri | CF | Gate | Layers | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `J-OPS-01` | Release: smoke, alert, degrade or roll back, record the evidence | platform_admin, incident_responder | P0 | CF-09 | `production` | synthetic, recovery, e2e | partial |
| `J-OPS-02` | Restore from backup into an isolated target and verify invariants | platform_admin, incident_responder, data_steward | P0 | — | `tenant-launch` | recovery | partial |
| `J-OPS-03` | Run a campaign; review it; report on it without student data | account_executive, marketing_admin, marketing_analyst, campaign_reviewer, content_owner | P2 | — | `production` | rls, security | partial |
| `J-OPS-04` | Respond to an incident: declare, contain, communicate, review | incident_responder, support_agent, platform_admin, trust_safety_senior | P1 | — | `tenant-launch` | recovery | partial |
<!-- journeys:table:end -->

## 5. The state matrix every journey is run through

Reused from the CF plan, not restated differently: for each in-scope journey run
authorized and unauthorized roles, and the states *first-run/empty, populated,
loading/saving, success, stale, offline/degraded, restricted, validation/error,
retry, destructive confirmation, recovered/resumed*. Cover phone, desktop,
keyboard, screen reader, 200–400 % zoom, reduced motion and large or long
content. For server boundaries: cross-tenant access, replay/duplicate, rate
limit, timeout, unsafe input or redirect, kill switch, audit and
deletion/offboarding.

**Per-journey acceptance, in one sentence each (every journey must satisfy all
six before its status can be `automated`):**

1. The happy path completes in a browser at phone and desktop, asserted on what
   the person would *see* before the next step is allowed to start (the
   `golden-path.mjs` standard).
2. The same journey with the adapter, the model and the network each failing
   still lets the person finish natively, or shows the degraded-mode state that
   the capability register declares (CTO 07 §9).
3. A second account — wrong role, other tenant, revoked — is refused at the
   database and at the API, and the refusal is a stated message, not a blank.
4. The journey leaves exactly the audit events and no others.
5. It is operable by keyboard and passes the axe smoke at 320 px reflow.
6. It has a kill switch or an explicit statement that it cannot be switched off,
   and its failure is something an on-call person can see.

## 6. Adding to the catalog

- **A new role** (a row in `rolelaunch.ts`): the test turns red until a journey
  names it. That is deliberate.
- **A new capability or screen:** add a journey, or add the role to an existing
  one and say in `owed` what the new path lacks.
- **A journey becomes proved:** add the evidence, delete the `owed` line in the
  same commit, and show the new evidence red against a revert of the thing it
  guards (`CLAUDE.md`). The doc table is regenerated in the same commit.
- **Never** delete an `owed` line to make a row look better. If the work is
  abandoned, change the journey (and its priority) in a decision.
