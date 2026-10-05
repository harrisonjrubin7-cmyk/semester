# Semester pilot delivery factory

| | |
| --- | --- |
| **Version** | 0.1 |
| **As of** | 2026-10-05, `origin/main` `790ebbf` |
| **Owner** | Harrison Rubin (every seat today) |
| **Target** | The Registration Readiness Pilot |
| **Result** | **Not deployable.** No step has run against a customer. |

## Facts that bound everything below

- No signed pilot, order form, contract or named customer exists
  (`contracts/README.md`, `ops/customer-commitments/README.md`,
  `company-site/index.html:445`).
- Official decision 2026-10-03: paid institutional pilot **NO-GO / RED**;
  individual invitation-only unpaid validation **CONDITIONAL GO**
  (`GO-NO-GO-DECISION.md`).
- 0 of 18 external evidence items closed (`docs/finalization/EXTERNAL-EVIDENCE-QUEUE.md`).
- The pilot's committee seats (champion, sponsor) are empty
  (`docs/institutional-readiness/PILOT-GOVERNANCE-CHARTER.md`: "BLANK CHARTER — NO
  NAMED PILOT AUTHORIZED").

## Pilot wedge

The first pilot is one workflow: **a student's registration readiness** — see
what is due, what blocks, what the official next step is, make a plan, get
policy-bounded help or an official handoff, and come back to see progress. It is
not a registrar replacement. Registration is `Plan and official handoff`
(`screens/Registrar`), not the ledger in `Registration.tsx`, which is off at
every school.

Scope to confirm by founder decision and then freeze: one cohort of at least 10
students (the suppression floor `MIN_COHORT = 10` in `lib/institution-ops.ts`
would hide anything smaller), one term, one advisor group, 26 weeks
(`pilotReadiness()` in `app/src/lib/gtm/pilot.ts`), two or three metrics, a
midpoint review.

## Step map

Legend for state: **CODE** reachable and tested · **PARTIAL** · **DB-ONLY**
tables or RPCs, no screen · **LIB** pure logic, not wired · **DOCS** document or
blank template · **ABSENT**.

| # | Step | Owner seat | Data source | System screen | Permission | State today |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Prospect qualified | Founder / GTM | `gtm_prospects`, `gtm_accounts`, `gtm_stakeholders`, `gtm_decision_log` (`20260928090000`) | none (no CRM UI) | `console:operate` | DB-ONLY + DOCS (`IDEAL-CUSTOMER-PROFILE.md`, `DISCOVERY-CALL-SCRIPT.md`) |
| 2 | Pilot scoped | Founder / Customer success | `gtm_pilots*`; `pilotReadiness()` | none; `pilotReadiness` is imported only by tests and `k12/edition.ts` | `console:operate` | LIB + DB + DOCS (`PILOT-OFFER.md` "DISCOVERY/SCOPING ONLY", `PILOT-PROPOSAL-TEMPLATE.md` with `[REQUIRED]` fields) |
| 3 | Contract and security boundary approved | Founder + counsel | `quotes`, `contracts` (`20260929070000`); `trust_room_*` | `TrustRoom.tsx` | `console:operate` | PARTIAL: tables and trust room; agreements are drafts (`[TO BE APPROVED]`); **no counsel** |
| 4 | Tenant provisioned | Implementation | `schools`, `tenant_plan`, `implementation_projects` (trigger on a signed order form, `20260929080000`), `tenant_rollout` | no create-tenant screen | `console:operate` | PARTIAL; trigger depends on a signed order form, none exists |
| 5 | Roles and policy configured | Implementation | `role_grants`, `tenant_feature_policy`, `tenant_sso_policy` | `ConfigurationStudio.tsx`, `ControlPlane` | verified grant | CODE (needs a verified grant) |
| 6 | Cohort imported or provisioned | Implementation | `private.roster_*` RPCs; `public.invites` | **no screen**; invites by SQL Editor (`PILOT.md`) | `service_role` (roster); operator (invites) | DB-ONLY |
| 7 | Official student context synced or marked unavailable | Implementation + customer IT | `canonical_display`, `lib/readiness.ts`, `lib/fromschool.ts` | source labels (~25 of 96 screens) | student | PARTIAL: "marked unavailable" mechanism exists; no live connector |
| 8 | Students invited | Customer success | `public.invites`, `beta_invite` RPC | none operator-side; student `BetaPanel.tsx` | operator | PARTIAL: mechanism by SQL |
| 9 | Students onboard | Product | first-run state | `Onboarding.tsx`, `FirstRun.tsx` | student | CODE for students; no program/term/credit-target capture |
| 10 | First meaningful action | Product | action store | `RegistrationPortal.tsx`, `RegistrationDay.tsx`, `lib/today-decision.ts` | student | CODE; **measurement not wired** (three marks only) |
| 11 | Target readiness workflow completed | Product | plan, agenda (`lib/agenda.ts`) | `Registrar`, `WorkflowBuilder` | student | CODE, client-side and local-first |
| 12 | Support and feedback operate | Support | `support_tickets`, `help_requests`, `feedback`, `beta_feedback` | `Support.tsx`, `console/SupportQueue.tsx`, `SaySomething.tsx` | student, operator | CODE for intake; **no staffed service**; ticket send off by default |
| 13 | Admin / champion dashboard operates | Customer success | `gtm_pilot_metrics`, `gtm_pilot_outcomes`; `institution-ops.ts` | staff console only; **no champion role or dashboard** | `console:operate` | PARTIAL / ABSENT |
| 14 | Weekly pilot review runs | Customer success | metrics | none | — | DOCS (blank `PILOT-WEEKLY-BUSINESS-REVIEW.md`) |
| 15 | Midpoint executive review | Founder | `midpointReviewDate` | none | — | DOCS (template, "NO EBR HAS BEEN HELD") |
| 16 | Final outcome report generated | Customer success | `pilotVerdict()`, `gtm_pilot_outcomes` | none | — | LIB + DOCS (blank) |
| 17 | Annual conversion decision recorded | Founder | `PilotDecision = convert / expand / pause / stop` | none | — | LIB + DOCS |
| 18 | Expansion and renewal plan created | Customer success | `renewal_opportunities` (auto-row at signing, `ends_at − 120 days`), `success_plans`, `qbrs` | none | — | DB-ONLY + DOCS |

Summary: steps 5, 9, 10, 11 and 12 (intake) are real for students. Steps 1–4,
6–8 and 13 have a database or library foundation and no operator or champion
screen. Steps 14–18 are blank templates or unwired pure functions.

## Step contract: success, failure, support, contingency, evidence

| # | Success metric | Failure state | Support action | Rollback / contingency | Evidence that the step ran |
| --- | --- | --- | --- | --- | --- |
| 1 | Prospect meets the ideal-customer profile and has a named sponsor and champion | Missing sponsor or committee role (`unmappedRoles`) | Founder records the gap in `gtm_decision_log` | Disqualify; no spend | CRM row with stakeholders mapped |
| 2 | `pilotReadiness()` returns no problems: 26 weeks, cohort, baseline, sponsor, champion, 2–3 metrics, midpoint | Any problem listed | Founder resolves each | Do not issue a proposal | Frozen scope document with dates |
| 3 | Executed agreement; DPA and security path approved; data map signed | Counsel or buyer rejects terms; security review fails | Founder with counsel; trust room request log | Pilot stays unpaid design-partner on synthetic data | Executed paper in `contracts/`; entry in `ops/customer-commitments/` |
| 4 | Tenant exists with `tenant_plan` and rollout state `off` for everything not in scope | Provisioning trigger fails or enables extra modules | Operator reads `tenant_policy_audit_event` | Set rollout `off`; kill switch per feature | Audit event rows; `tenant_rollout_evidence` |
| 5 | Roles assigned to named people; policies match the data map; no unreviewed capability | Over-grant; SSO policy mismatch | Operator reverts via `role_grants` audit trail | Revoke grants; invitation-only access | `role_grant_audit_event` rows |
| 6 | Roster validated; zero unexplained rejects; promote succeeds | Validate rejects rows; duplicates | Operator exports reject report to the champion | `private.roster_rollback` | Staging, validation and promotion reports |
| 7 | Each official field either synced inside its freshness target or labelled **unavailable** | Stale or wrong data shown as current | Operator flips the item to unavailable | Kill switch for the adapter; degraded-mode entry | Source labels on screen; freshness record |
| 8 | ≥ 80 % of the cohort receives a valid invitation (threshold to be agreed) | Bounce, wrong address, code reuse | Support resends; champion nudges | Pause invites with `set_invite_only` | Invite counts by status |
| 9 | Student reaches Today with program, term and credit target set | Abandonment at first run | Support macro; walkthrough | Concierge onboarding by champion | `activation` event (to be defined) |
| 10 | Student completes one registration-readiness action in the first session (to be agreed) | No action in 7 days | Nudge within ethics policy (`ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md`) | Advisor outreach | `action_completed` event (to be defined) |
| 11 | Student has a saved plan and has seen the official handoff | Plan abandoned | Advisor meeting mode | Manual advising | `plan_saved` event (to be defined) |
| 12 | Tickets acknowledged within the stated time; feedback triaged weekly | Ticket unanswered past the clock | On-call per [support](SEMESTER_SUPPORT_AND_INCIDENT_READINESS.md) | Backup responder (unassigned) | Ticket timestamps; weekly triage log |
| 13 | Champion sees cohort metrics above the suppression floor and nothing else | Small-cell disclosure; wrong scope | Operator removes access | Revoke champion view; send CSV | Dashboard capture and access log |
| 14 | Weekly review held with decisions logged | Skipped two weeks | Founder escalates to sponsor | Async written review | Dated review document |
| 15 | Midpoint review held with sponsor; continue / adjust / stop recorded | Sponsor absent | Founder reschedules inside the window | Written midpoint | Dated review with decision |
| 16 | Outcome report generated from measured metrics against baseline | Baseline missing | Customer success reconstructs from logs | Report states what was not measurable | Report filed under `docs/evidence/` |
| 17 | `convert / expand / pause / stop` recorded with reasons | No decision by the end date | Founder escalates | Extend by agreement | Decision record |
| 18 | Renewal and expansion plan dated; reference permission asked | No budget cycle fit | Founder re-times | Pause at term end with export | Plan; permission record |

Items marked "to be agreed" or "to be defined" are placeholders for a founder
and customer decision. They are not targets, and no number in this table is a
measured result.

## What must be built to run steps 1–13 on a synthetic tenant

1. Operator screens: create tenant, import cohort, send invites, view status.
2. A pilot screen over `gtm_pilots*` calling `pilotReadiness` and `pilotVerdict`.
3. Activation and first-action events, after the privacy decision that today
   limits collection to three marks (`opened`, `course`, `studied`).
4. A champion role and cohort dashboard with the suppression floor.
5. The support address and staffed queue ([support](SEMESTER_SUPPORT_AND_INCIDENT_READINESS.md)).

Steps 14–18 then need only discipline and the templates that already exist.

## Gates

| Gate | Passes when |
| --- | --- |
| P-1 Dress rehearsal | Steps 1–13 run end to end on a synthetic tenant and each leaves its evidence |
| P-2 Commercial | Executed agreement and approved security path |
| P-3 Implementation | Tenant configured, owners named, training planned |
| P-4 Launch | Users invited, support live, rollout approved |
| P-5 Adoption | Activation baseline recorded |
| P-6 Outcome | Metrics agreed and measured |
| P-7 Executive | Midpoint and final sponsor reviews held |
| P-8 Conversion | Annual decision made or next action recorded |

P-1 is the only gate this repository can close without a customer.
