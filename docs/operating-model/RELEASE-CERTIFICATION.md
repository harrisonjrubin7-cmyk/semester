# Release certification

<!-- Rendered from app/src/lib/governance/certification.ts by certification.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

Semester’s release model: **build everything, certify GO internally, then
pilot.** A pilot is a deployment and refinement programme — adoption,
configuration, workflow fit, commercial evidence — never the first time a
critical feature runs. Built does not mean enabled; GO does not mean every
module is on for every school.

```
Designed → Built → Internally verified → Production-certified GO → Pilot deployed → Pilot refined → Generally available → Enterprise-ready
```

## The decision: NOT GO

**38 blockers.** GO is computed from the gate, the domains and the council below, never declared. Of the 28 gate items, 4 have passed, 21 are partial and 3 are owed.

- P-1 is partial: Every planned module has UI, service layer, schema, API and permissions.
- T-2 is partial: Tenant-isolation, RLS and SECURITY DEFINER tests.
- T-7 is partial: Penetration test or equivalent assessment.
- R-1 is partial: Student data export and deletion work.
- R-2 is partial: Backup restore drill succeeds in an isolated environment.
- R-3 is partial: Incident-response drill completed.
- R-4 is partial: AI prompt-injection and kill-switch drills completed.
- A-2 is owed: Manual keyboard, screen-reader, zoom and reflow testing of every critical flow.
- O-3 is owed: Every production service has a named operator.
- O-4 is owed: Support staffing and response model ready.
- C-1 is partial: Privacy Policy, Terms, DPA, MSA, pilot SOW, SLA and AI Policy reviewed by counsel.
- C-2 is partial: Legal entity, banking, insurance and IP agreements complete.
- Identity and accounts is not internally verified.
- Path and planning is not internally verified.
- Registration readiness and advising is not internally verified.
- Source and freshness labels is not internally verified.
- Feedback and support is not internally verified.
- AI assistance and actions is not internally verified.
- Institution console is not internally verified.
- Native LMS and Course Studio is not internally verified.
- Career and community is not internally verified.
- Housing is not internally verified.
- Official registration transaction is not internally verified.
- Official gradebook and grade passback is not internally verified.
- Student accounts and payment plans is not internally verified.
- Dining and campus card is not internally verified.
- The founder seat has not signed.
- The product seat has not signed.
- The engineering seat has not signed.
- The security seat has not signed.
- The privacy seat has not signed.
- The accessibility seat has not signed.
- The success seat has not signed.
- The trust seat has not signed.
- The data seat has not signed.
- The finance seat has not signed.
- The operations seat has not signed.
- The champion seat has not signed.

## The ladder

| Rung | Means | Domains here |
| --- | --- | ---: |
| Designed | Product, data, permission and UX specification exists | 0 |
| Built | Code, data model, UI, tests and configuration exist | 14 |
| Internally verified | Automated, security, accessibility and privacy checks all pass | 0 |
| Production-certified GO | The platform passed the GO gate and every council seat signed | 0 |
| Pilot deployed | Activated for a named institution’s cohort under a signed pilot | 0 |
| Pilot refined | Real users completed the workflow; learnings folded into configuration | 0 |
| Generally available | Supported, documented, monitored and contractually sellable | 0 |
| Enterprise-ready | Governed, integrated, audited, scalable and operationally supported | 0 |

A status may not pass the rung its evidence supports: a spec for
*designed*, code for *built*, all four checks passed for *internally
verified*, the platform’s GO for *production-certified*, a named pilot for
*deployed*, and a file of real-user evidence for *refined*.

## Domains

| Domain | Status | Automated tests | Security | Accessibility | Privacy | Pilot activation | To complete |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Identity and accounts | Built | passed | partial | partial | partial | on | Institutional SSO and MFA. Pass the security, manual accessibility and privacy checks. |
| Path and planning | Built | passed | partial | partial | partial | on | Pass the security, manual accessibility and privacy checks. |
| Registration readiness and advising | Built | passed | partial | partial | partial | on | Pass the security, manual accessibility and privacy checks. |
| Source and freshness labels | Built | passed | partial | partial | partial | on | Per-object lineage, not only per source. Pass the security, manual accessibility and privacy checks. |
| Feedback and support | Built | passed | partial | partial | partial | on | A staffed queue with an escalation rota. Pass the security, manual accessibility and privacy checks. |
| AI assistance and actions | Built | passed | partial | partial | partial | conditional: Per course, institution and policy scope. | Run and record the live red-team and kill-switch drills. Pass the security, manual accessibility and privacy checks. |
| Institution console | Built | passed | partial | partial | partial | conditional: For the sponsor’s named administrators only. | A release-certification view of this register. Pass the security, manual accessibility and privacy checks. |
| Native LMS and Course Studio | Built | passed | partial | partial | partial | conditional: For one department or course group. | Submissions, rubrics and assessments end to end. Pass the security, manual accessibility and privacy checks. |
| Career and community | Built | passed | partial | partial | partial | conditional: After student opt-in, employer review, and staffed moderation. | Employer review and a staffed moderation rota. Pass the security, manual accessibility and privacy checks. |
| Housing | Built | passed | partial | partial | partial | conditional: Only for an institution with housing configuration. | Room selection, contracts and maintenance: today it is a student-side calculator. Pass the security, manual accessibility and privacy checks. |
| Official registration transaction | Built | passed | partial | partial | partial | conditional: For selected students and the registrar role, after registrar approval. | An SIS adapter to send committed changes; holds and completions synced from the SIS; per-student time tickets; Pass the security, manual accessibility and privacy checks. |
| Official gradebook and grade passback | Built | passed | partial | partial | partial | conditional: Only after faculty and registrar approval. | A live LTI grade-passback sender. `Grades.tsx` stays the student’s own arithmetic. Pass the security, manual accessibility and privacy checks. |
| Student accounts and payment plans | Built | passed | partial | partial | partial | conditional: Only where the build sets studentAccounts, for a school’s offices holding finance:* capabilities and the students an approver has linked; payments stay on the school’s hosted provider. | No money moves in Semester: no payment is taken, no refund paid out, no aid awarded or disbursed and no registration hold placed — each is an entry a second person approves. Charges and aid credits still arrive by a person’s request rather than from the school’s SIS or aid system, and the finance seat is vacant; Pass the security, manual accessibility and privacy checks. |
| Dining and campus card | Built | passed | partial | partial | partial | conditional: When a campus-card or dining partner configuration is ready. | A real card-office vendor adapter and a sync schedule; Pass the security, manual accessibility and privacy checks. |

### Identity and accounts

Status **Built** · owner `engineering` · spec [`docs/SSO-SECURITY-AND-SESSION-MANAGEMENT.md`](../SSO-SECURITY-AND-SESSION-MANAGEMENT.md)

Code: [`app/src/lib/cloud.ts`](../../app/src/lib/cloud.ts), [`app/src/screens/Recovery.tsx`](../../app/src/screens/Recovery.tsx)

| Check | State | Evidence | Note |
| --- | --- | --- | --- |
| Automated tests | passed | [`app/src/lib/cloud.test.ts`](../../app/src/lib/cloud.test.ts) | Sign-in, sign-up and recovery paths are held by the suite. |
| Security | partial | [`docs/DEFINER-RLS-REGISTER.md`](../DEFINER-RLS-REGISTER.md) | Production matches the approved advisor baseline one for one (T-3); no penetration test, and the negative checks have run on a copy of the schema, not against production. |
| Accessibility | partial | [`app/src/a11y/axe.test.tsx`](../../app/src/a11y/axe.test.tsx) | Automated axe checks run in the suite; manual keyboard, screen-reader, zoom and mobile QA is owed. |
| Privacy | partial | [`docs/MODULE-PRIVACY-MODEL.md`](../MODULE-PRIVACY-MODEL.md) | Defaults and roles are modelled; export, deletion and revocation have not been exercised against production. |

### Path and planning

Status **Built** · owner `product` · spec [`docs/GRADUATION-AND-COST-SIMULATOR.md`](../GRADUATION-AND-COST-SIMULATOR.md) · flags `experiment.today_action_ranking_v2`

Code: [`app/src/lib/pathway.ts`](../../app/src/lib/pathway.ts), [`app/src/screens/Pathway.tsx`](../../app/src/screens/Pathway.tsx), [`app/src/lib/plans.ts`](../../app/src/lib/plans.ts), [`app/src/lib/conflicts.ts`](../../app/src/lib/conflicts.ts)

| Check | State | Evidence | Note |
| --- | --- | --- | --- |
| Automated tests | passed | [`app/src/lib/conflicts.test.ts`](../../app/src/lib/conflicts.test.ts) | Plans, the path grid and conflict detection are held by the suite. |
| Security | partial | [`docs/DEFINER-RLS-REGISTER.md`](../DEFINER-RLS-REGISTER.md) | Production matches the approved advisor baseline one for one (T-3); no penetration test, and the negative checks have run on a copy of the schema, not against production. |
| Accessibility | partial | [`app/src/a11y/axe.test.tsx`](../../app/src/a11y/axe.test.tsx) | Automated axe checks run in the suite; manual keyboard, screen-reader, zoom and mobile QA is owed. |
| Privacy | partial | [`docs/MODULE-PRIVACY-MODEL.md`](../MODULE-PRIVACY-MODEL.md) | Defaults and roles are modelled; export, deletion and revocation have not been exercised against production. |

### Registration readiness and advising

Status **Built** · owner `product` · spec [`docs/ADVISOR-MEETING-MODE.md`](../ADVISOR-MEETING-MODE.md) · flags `scope.sis.registration_hold_summary_read`

Code: [`app/src/lib/registration-plan.ts`](../../app/src/lib/registration-plan.ts), [`app/src/lib/registration-day.ts`](../../app/src/lib/registration-day.ts), [`app/src/lib/advisor-meeting.ts`](../../app/src/lib/advisor-meeting.ts)

| Check | State | Evidence | Note |
| --- | --- | --- | --- |
| Automated tests | passed | [`app/src/lib/advisor-meeting.test.ts`](../../app/src/lib/advisor-meeting.test.ts) | The advisor agenda and registration-day plan are held by the suite. |
| Security | partial | [`docs/DEFINER-RLS-REGISTER.md`](../DEFINER-RLS-REGISTER.md) | Production matches the approved advisor baseline one for one (T-3); no penetration test, and the negative checks have run on a copy of the schema, not against production. |
| Accessibility | partial | [`app/src/a11y/axe.test.tsx`](../../app/src/a11y/axe.test.tsx) | Automated axe checks run in the suite; manual keyboard, screen-reader, zoom and mobile QA is owed. |
| Privacy | partial | [`docs/MODULE-PRIVACY-MODEL.md`](../MODULE-PRIVACY-MODEL.md) | Defaults and roles are modelled; export, deletion and revocation have not been exercised against production. |

### Source and freshness labels

Status **Built** · owner `data` · spec [`docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md`](../FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md) · flags `module.source_freshness_cards`

Code: [`app/src/lib/source.ts`](../../app/src/lib/source.ts)

| Check | State | Evidence | Note |
| --- | --- | --- | --- |
| Automated tests | passed | [`app/src/lib/source.test.ts`](../../app/src/lib/source.test.ts) | The five source labels are held to the database’s check constraint. |
| Security | partial | [`docs/DEFINER-RLS-REGISTER.md`](../DEFINER-RLS-REGISTER.md) | Production matches the approved advisor baseline one for one (T-3); no penetration test, and the negative checks have run on a copy of the schema, not against production. |
| Accessibility | partial | [`app/src/a11y/axe.test.tsx`](../../app/src/a11y/axe.test.tsx) | Automated axe checks run in the suite; manual keyboard, screen-reader, zoom and mobile QA is owed. |
| Privacy | partial | [`docs/MODULE-PRIVACY-MODEL.md`](../MODULE-PRIVACY-MODEL.md) | Defaults and roles are modelled; export, deletion and revocation have not been exercised against production. |

### Feedback and support

Status **Built** · owner `success` · spec [`docs/GO-NO-GO-CHECKLIST.md`](../GO-NO-GO-CHECKLIST.md)

Code: [`app/src/lib/support.ts`](../../app/src/lib/support.ts), [`app/src/lib/supporttickets.ts`](../../app/src/lib/supporttickets.ts), [`app/src/screens/Support.tsx`](../../app/src/screens/Support.tsx)

| Check | State | Evidence | Note |
| --- | --- | --- | --- |
| Automated tests | passed | [`app/src/lib/supporttickets.test.ts`](../../app/src/lib/supporttickets.test.ts) | Ticket creation and routing are held by the suite. |
| Security | partial | [`docs/DEFINER-RLS-REGISTER.md`](../DEFINER-RLS-REGISTER.md) | Production matches the approved advisor baseline one for one (T-3); no penetration test, and the negative checks have run on a copy of the schema, not against production. |
| Accessibility | partial | [`app/src/a11y/axe.test.tsx`](../../app/src/a11y/axe.test.tsx) | Automated axe checks run in the suite; manual keyboard, screen-reader, zoom and mobile QA is owed. |
| Privacy | partial | [`docs/MODULE-PRIVACY-MODEL.md`](../MODULE-PRIVACY-MODEL.md) | Defaults and roles are modelled; export, deletion and revocation have not been exercised against production. |

### AI assistance and actions

Status **Built** · owner `trust` · spec [`docs/operating-model/AI-LIFECYCLE-GATES.md`](AI-LIFECYCLE-GATES.md) · flags `ops.external_ai_generation`

Code: [`app/src/lib/assistant.ts`](../../app/src/lib/assistant.ts), [`app/src/lib/aiflags.ts`](../../app/src/lib/aiflags.ts)

| Check | State | Evidence | Note |
| --- | --- | --- | --- |
| Automated tests | passed | [`app/src/lib/aikillswitch.test.ts`](../../app/src/lib/aikillswitch.test.ts) | The kill switch and injection fencing are held by the suite. |
| Security | partial | [`docs/DEFINER-RLS-REGISTER.md`](../DEFINER-RLS-REGISTER.md) | Production matches the approved advisor baseline one for one (T-3); no penetration test, and the negative checks have run on a copy of the schema, not against production. |
| Accessibility | partial | [`app/src/a11y/axe.test.tsx`](../../app/src/a11y/axe.test.tsx) | Automated axe checks run in the suite; manual keyboard, screen-reader, zoom and mobile QA is owed. |
| Privacy | partial | [`docs/MODULE-PRIVACY-MODEL.md`](../MODULE-PRIVACY-MODEL.md) | Defaults and roles are modelled; export, deletion and revocation have not been exercised against production. |

### Institution console

Status **Built** · owner `operations` · spec [`docs/operating-model/PILOT-TO-PRODUCTION.md`](PILOT-TO-PRODUCTION.md) · flags `module.integration_dashboard`, `module.institutional_operations`

Code: [`app/src/screens/Console.tsx`](../../app/src/screens/Console.tsx), [`app/src/lib/ops/console.ts`](../../app/src/lib/ops/console.ts)

| Check | State | Evidence | Note |
| --- | --- | --- | --- |
| Automated tests | passed | [`app/src/screens/console.test.tsx`](../../app/src/screens/console.test.tsx) | The console’s views are held by the suite. |
| Security | partial | [`docs/DEFINER-RLS-REGISTER.md`](../DEFINER-RLS-REGISTER.md) | Production matches the approved advisor baseline one for one (T-3); no penetration test, and the negative checks have run on a copy of the schema, not against production. |
| Accessibility | partial | [`app/src/a11y/axe.test.tsx`](../../app/src/a11y/axe.test.tsx) | Automated axe checks run in the suite; manual keyboard, screen-reader, zoom and mobile QA is owed. |
| Privacy | partial | [`docs/MODULE-PRIVACY-MODEL.md`](../MODULE-PRIVACY-MODEL.md) | Defaults and roles are modelled; export, deletion and revocation have not been exercised against production. |

### Native LMS and Course Studio

Status **Built** · owner `product` · spec [`docs/FACULTY-COURSE-STUDIO-DESIGN.md`](../FACULTY-COURSE-STUDIO-DESIGN.md) · flags `integration.lms_lti`, `scope.lms.assignment_dates_read`

Code: [`app/src/lib/coursestudio.ts`](../../app/src/lib/coursestudio.ts), [`supabase/migrations/20260928309000_course_studio.sql`](../../supabase/migrations/20260928309000_course_studio.sql)

| Check | State | Evidence | Note |
| --- | --- | --- | --- |
| Automated tests | passed | [`app/src/lib/coursestudio.test.ts`](../../app/src/lib/coursestudio.test.ts) | Course shells and studio drafts are held by the suite. |
| Security | partial | [`docs/DEFINER-RLS-REGISTER.md`](../DEFINER-RLS-REGISTER.md) | Production matches the approved advisor baseline one for one (T-3); no penetration test, and the negative checks have run on a copy of the schema, not against production. |
| Accessibility | partial | [`app/src/a11y/axe.test.tsx`](../../app/src/a11y/axe.test.tsx) | Automated axe checks run in the suite; manual keyboard, screen-reader, zoom and mobile QA is owed. |
| Privacy | partial | [`docs/MODULE-PRIVACY-MODEL.md`](../MODULE-PRIVACY-MODEL.md) | Defaults and roles are modelled; export, deletion and revocation have not been exercised against production. |

### Career and community

Status **Built** · owner `trust` · spec [`docs/COMMUNITY-PRIVACY-MODEL.md`](../COMMUNITY-PRIVACY-MODEL.md) · flags `safety.scoped_pseudonymity`, `safety.volunteer_moderation`, `safety.institution_escalation`

Code: [`app/src/lib/career.ts`](../../app/src/lib/career.ts), [`app/src/screens/Community.tsx`](../../app/src/screens/Community.tsx), [`supabase/migrations/20260928032000_community.sql`](../../supabase/migrations/20260928032000_community.sql)

| Check | State | Evidence | Note |
| --- | --- | --- | --- |
| Automated tests | passed | [`app/src/screens/Community.test.tsx`](../../app/src/screens/Community.test.tsx) | Community screens and moderation paths are held by the suite. |
| Security | partial | [`docs/DEFINER-RLS-REGISTER.md`](../DEFINER-RLS-REGISTER.md) | Production matches the approved advisor baseline one for one (T-3); no penetration test, and the negative checks have run on a copy of the schema, not against production. |
| Accessibility | partial | [`app/src/a11y/axe.test.tsx`](../../app/src/a11y/axe.test.tsx) | Automated axe checks run in the suite; manual keyboard, screen-reader, zoom and mobile QA is owed. |
| Privacy | partial | [`docs/MODULE-PRIVACY-MODEL.md`](../MODULE-PRIVACY-MODEL.md) | Defaults and roles are modelled; export, deletion and revocation have not been exercised against production. |

### Housing

Status **Built** · owner `product` · spec [`docs/BASIC-NEEDS-NAVIGATOR.md`](../BASIC-NEEDS-NAVIGATOR.md)

Code: [`app/src/lib/housing.ts`](../../app/src/lib/housing.ts), [`app/src/screens/Housing.tsx`](../../app/src/screens/Housing.tsx)

| Check | State | Evidence | Note |
| --- | --- | --- | --- |
| Automated tests | passed | [`app/src/lib/housing.test.ts`](../../app/src/lib/housing.test.ts) | The student-side housing sums are held by the suite. |
| Security | partial | [`docs/DEFINER-RLS-REGISTER.md`](../DEFINER-RLS-REGISTER.md) | Production matches the approved advisor baseline one for one (T-3); no penetration test, and the negative checks have run on a copy of the schema, not against production. |
| Accessibility | partial | [`app/src/a11y/axe.test.tsx`](../../app/src/a11y/axe.test.tsx) | Automated axe checks run in the suite; manual keyboard, screen-reader, zoom and mobile QA is owed. |
| Privacy | partial | [`docs/MODULE-PRIVACY-MODEL.md`](../MODULE-PRIVACY-MODEL.md) | Defaults and roles are modelled; export, deletion and revocation have not been exercised against production. |

### Official registration transaction

Status **Built** · owner `data` · spec [`docs/FEATURE-FLAG-REGISTRY.md`](../FEATURE-FLAG-REGISTRY.md) · flags `writeback.registration_submit`, `integration.sis_read`

Code: [`app/src/lib/enrollment/service.ts`](../../app/src/lib/enrollment/service.ts), [`supabase/migrations/20260929300000_registration_transaction.sql`](../../supabase/migrations/20260929300000_registration_transaction.sql)

| Check | State | Evidence | Note |
| --- | --- | --- | --- |
| Automated tests | passed | [`supabase/registration_transaction.check.sql`](../../supabase/registration_transaction.check.sql) | Enroll, waitlist, drop, withdraw, holds and overrides, allowed and denied; the last seat cannot be taken twice. |
| Security | partial | [`docs/DEFINER-RLS-REGISTER.md`](../DEFINER-RLS-REGISTER.md) | Production matches the approved advisor baseline one for one (T-3); no penetration test, and the negative checks have run on a copy of the schema, not against production. |
| Accessibility | partial | [`app/src/a11y/axe.test.tsx`](../../app/src/a11y/axe.test.tsx) | Automated axe checks run in the suite; manual keyboard, screen-reader, zoom and mobile QA is owed. |
| Privacy | partial | [`docs/MODULE-PRIVACY-MODEL.md`](../MODULE-PRIVACY-MODEL.md) | Defaults and roles are modelled; export, deletion and revocation have not been exercised against production. |

### Official gradebook and grade passback

Status **Built** · owner `data` · spec [`docs/FEATURE-FLAG-REGISTRY.md`](../FEATURE-FLAG-REGISTRY.md) · flags `writeback.lms_grade_passback`

Code: [`app/src/lib/gradebook/ledger.ts`](../../app/src/lib/gradebook/ledger.ts), [`app/src/lib/gradebook/passback.ts`](../../app/src/lib/gradebook/passback.ts), [`supabase/migrations/20260929310000_gradebook.sql`](../../supabase/migrations/20260929310000_gradebook.sql)

| Check | State | Evidence | Note |
| --- | --- | --- | --- |
| Automated tests | passed | [`supabase/gradebook.check.sql`](../../supabase/gradebook.check.sql) | Drafts visible only to the course’s authors, released grades to their student, append-only history, passback of released versions only. |
| Security | partial | [`docs/DEFINER-RLS-REGISTER.md`](../DEFINER-RLS-REGISTER.md) | Production matches the approved advisor baseline one for one (T-3); no penetration test, and the negative checks have run on a copy of the schema, not against production. |
| Accessibility | partial | [`app/src/a11y/axe.test.tsx`](../../app/src/a11y/axe.test.tsx) | Automated axe checks run in the suite; manual keyboard, screen-reader, zoom and mobile QA is owed. |
| Privacy | partial | [`docs/MODULE-PRIVACY-MODEL.md`](../MODULE-PRIVACY-MODEL.md) | Defaults and roles are modelled; export, deletion and revocation have not been exercised against production. |

### Student accounts and payment plans

Status **Built** · owner `finance` · spec [`docs/FINANCIAL-READINESS-WORKSPACE.md`](../FINANCIAL-READINESS-WORKSPACE.md)

Code: [`supabase/migrations/20260929220000_student_accounts.sql`](../../supabase/migrations/20260929220000_student_accounts.sql), [`supabase/migrations/20260929230000_student_payment_plans.sql`](../../supabase/migrations/20260929230000_student_payment_plans.sql), [`app/src/components/MyStudentAccount.tsx`](../../app/src/components/MyStudentAccount.tsx), [`app/src/components/MyStudentAccount.test.tsx`](../../app/src/components/MyStudentAccount.test.tsx), [`app/src/components/institutional/StudentAccounts.tsx`](../../app/src/components/institutional/StudentAccounts.tsx), [`app/src/components/institutional/StudentAccounts.test.tsx`](../../app/src/components/institutional/StudentAccounts.test.tsx), [`supabase/student-payment-plans.check.sql`](../../supabase/student-payment-plans.check.sql)

| Check | State | Evidence | Note |
| --- | --- | --- | --- |
| Automated tests | passed | [`supabase/student-accounts.check.sql`](../../supabase/student-accounts.check.sql) | The ledger written only by a second person’s approval, high-value approval over the threshold, no card stored, reconciliation and close, and a linked student reading only their own account, allowed and denied; student-payment-plans.check.sql holds the plans the same way. |
| Security | partial | [`docs/DEFINER-RLS-REGISTER.md`](../DEFINER-RLS-REGISTER.md) | Production matches the approved advisor baseline one for one (T-3); no penetration test, and the negative checks have run on a copy of the schema, not against production. |
| Accessibility | partial | [`app/src/a11y/axe.test.tsx`](../../app/src/a11y/axe.test.tsx) | Automated axe checks run in the suite; manual keyboard, screen-reader, zoom and mobile QA is owed. |
| Privacy | partial | [`docs/MODULE-PRIVACY-MODEL.md`](../MODULE-PRIVACY-MODEL.md) | Defaults and roles are modelled; export, deletion and revocation have not been exercised against production. |

### Dining and campus card

Status **Built** · owner `product` · spec [`docs/BASIC-NEEDS-NAVIGATOR.md`](../BASIC-NEEDS-NAVIGATOR.md) · flags `module.dining`

Code: [`app/src/lib/dining/service.ts`](../../app/src/lib/dining/service.ts), [`app/src/lib/dining/orders.ts`](../../app/src/lib/dining/orders.ts), [`supabase/migrations/20260929330000_dining.sql`](../../supabase/migrations/20260929330000_dining.sql)

| Check | State | Evidence | Note |
| --- | --- | --- | --- |
| Automated tests | passed | [`supabase/dining.check.sql`](../../supabase/dining.check.sql) | Plans, ledger, orders held to capacity and the shared-swipe pool, allowed and denied; staff cannot tell a shared swipe. |
| Security | partial | [`docs/DEFINER-RLS-REGISTER.md`](../DEFINER-RLS-REGISTER.md) | Production matches the approved advisor baseline one for one (T-3); no penetration test, and the negative checks have run on a copy of the schema, not against production. |
| Accessibility | partial | [`app/src/a11y/axe.test.tsx`](../../app/src/a11y/axe.test.tsx) | Automated axe checks run in the suite; manual keyboard, screen-reader, zoom and mobile QA is owed. |
| Privacy | partial | [`docs/MODULE-PRIVACY-MODEL.md`](../MODULE-PRIVACY-MODEL.md) | Defaults and roles are modelled; export, deletion and revocation have not been exercised against production. |

## The GO gate

Items marked **P0** are conditions of a full GO: while one is open the answer is NOT GO, whatever else passes.

### Full product completion

| ID | Item | State | P0 | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| P-1 | Every planned module has UI, service layer, schema, API and permissions. | partial | P0 | [`app/src/lib/governance/certification.ts`](../../app/src/lib/governance/certification.ts) | Every domain has a service layer, schema, permissions and a screen (registration, gradebook and dining screens arrived last, each saying in one sentence when its school has it off; student accounts has the student’s view on Bill and the staff ledger on University); none has a live vendor or SIS adapter behind it, and none takes a payment. |
| P-2 | Every module has loading, empty, error, stale and degraded states. | partial |  | [`docs/EMPTY-LOADING-ERROR-SUCCESS-STATES.md`](../EMPTY-LOADING-ERROR-SUCCESS-STATES.md) | Specified; not audited module by module. |
| P-3 | Every module has tenant, role, cohort and feature configuration. | partial |  | [`app/src/lib/flags.ts`](../../app/src/lib/flags.ts) | Tenant, cohort, role and feature scopes exist in the evaluator and the database; not every module is yet behind a flag. |

### Full technical verification

| ID | Item | State | P0 | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| T-1 | Unit tests for all domain logic. | partial |  | [`REGRESSION-CHECKLIST.md`](../../REGRESSION-CHECKLIST.md) | A large suite runs in order and shuffled; unbuilt domains have none. |
| T-2 | Tenant-isolation, RLS and SECURITY DEFINER tests. | partial | P0 | [`docs/drills/security-suites-preview-2026-10-01.md`](../drills/security-suites-preview-2026-10-01.md) | The last full no-data preview run passed 67 of 95 suites. The next approved caller grants and duplicate-history repair are applied; strict catalog/ACL verification passes. The full fixture rerun is blocked by expired connector approval requests, so the historical count is not recertified. Production was not touched. |
| T-3 | Production RLS, grants and function remediation applied and verified. | passed | P0 | [`docs/DEFINER-RLS-REGISTER.md`](../DEFINER-RLS-REGISTER.md) | Read on production at 21:38 UTC on 29 September: the remediation migrations are applied, and the security advisor lists exactly the 151 callable definer functions and 45 policy-less tables the register gives a disposition, one for one, with nothing at error level. |
| T-4 | Webhook replay, idempotency, ordering and signature tests. | passed |  | [`app/src/lib/billing/webhook.test.ts`](../../app/src/lib/billing/webhook.test.ts) | The Stripe webhook’s signature and replay are held. |
| T-5 | Load tests for registration, learning, search, gradebook and notifications. | partial |  | [`supabase/load.sh`](../../supabase/load.sh) | Concurrency scenarios for flag reads, plan saves and demand reads run against the full schema, and found and fixed a plan-save deadlock; since D-1019 the same run is four windows, and fails a scenario that gets slower or leaks a connection. Registration, gradebook and notification scenarios are owed, as are large-tenant, file-processing and AI-cost scenarios, and no run is against production-like infrastructure. |
| T-6 | Visual regression and cross-device testing for core surfaces. | partial |  | [`docs/DESIGN-REGRESSION-TEST-PLAN.md`](../DESIGN-REGRESSION-TEST-PLAN.md) | Planned; the contrast workflow runs, cross-browser does not. |
| T-7 | Penetration test or equivalent assessment. | partial | P0 | [`docs/trust/PENETRATION-TEST-PLAN.md`](../trust/PENETRATION-TEST-PLAN.md) | A plan, not a report. |

### Full trust verification

| ID | Item | State | P0 | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| R-1 | Student data export and deletion work. | partial | P0 | [`docs/drills/erasure-drill-2026-09-30.md`](../drills/erasure-drill-2026-09-30.md) | Export and erasure proven on production in a rolled-back drill (every mapped column empty after); the delete-account Edge Function with a real session is still owed. |
| R-2 | Backup restore drill succeeds in an isolated environment. | partial | P0 | [`supabase/restore-drill.sh`](../../supabase/restore-drill.sh) | The rehearsal runs in CI against a fresh database; a production restore has not been performed. |
| R-3 | Incident-response drill completed. | partial | P0 | [`docs/operating-model/INCIDENT-COMMUNICATIONS.md`](INCIDENT-COMMUNICATIONS.md) | Runbooks exist; no tabletop is recorded. |
| R-4 | AI prompt-injection and kill-switch drills completed. | partial | P0 | [`app/src/lib/aikillswitch.test.ts`](../../app/src/lib/aikillswitch.test.ts) | Attempted against production on 29 September: it stopped at a 501 before reaching the switch, because ANTHROPIC_API_KEY is not set on the project. |
| R-5 | Vendor and subprocessor register complete. | partial |  | [`docs/SUBPROCESSORS.md`](../SUBPROCESSORS.md) | Listed; the vendor-risk reviews are not all done. |
| R-6 | Consent and sharing flows expire, revoke and audit correctly. | partial |  | [`docs/CONSENT-SHARING-DESIGN.md`](../CONSENT-SHARING-DESIGN.md) | Designed and held in tests; not verified in production. |

### Full accessibility verification

| ID | Item | State | P0 | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| A-1 | Automated accessibility testing. | passed |  | [`app/src/a11y/axe.test.tsx`](../../app/src/a11y/axe.test.tsx) | axe runs over rendered screens in the suite. |
| A-2 | Manual keyboard, screen-reader, zoom and reflow testing of every critical flow. | owed | P0 | — | Not performed. |
| A-3 | VPAT or a professional VPAT plan. | partial |  | [`docs/trust/HECVAT-VPAT-PLAN.md`](../trust/HECVAT-VPAT-PLAN.md) | A plan. |

### Full operations verification

| ID | Item | State | P0 | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| O-1 | Feature flags and kill switches work at every scope. | partial |  | [`supabase/feature_cohorts.check.sql`](../../supabase/feature_cohorts.check.sql) | Every scope, cohort included, is enforced and checked; no kill switch has been engaged against production and no rollback drill is recorded. |
| O-2 | Monitoring, alerting, audit logs and status page work. | partial |  | [`docs/trust/APM-RUNBOOK.md`](../trust/APM-RUNBOOK.md) | Status page and smoke tests exist; on-call routing does not. |
| O-3 | Every production service has a named operator. | owed | P0 | — | The operations seat is vacant. |
| O-4 | Support staffing and response model ready. | owed | P0 | — | No staffed queue. |
| O-5 | Billing, cancellation, refunds, invoices and dunning tested end to end. | partial |  | [`app/src/lib/billing/checkout.test.ts`](../../app/src/lib/billing/checkout.test.ts) | Checkout and dunning are held; cancellation has not reached Stripe. |

### Full company verification

| ID | Item | State | P0 | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| C-1 | Privacy Policy, Terms, DPA, MSA, pilot SOW, SLA and AI Policy reviewed by counsel. | partial | P0 | [`docs/trust/DPA-CHECKLIST.md`](../trust/DPA-CHECKLIST.md) | Drafts exist; no counsel review. |
| C-2 | Legal entity, banking, insurance and IP agreements complete. | partial | P0 | [`docs/SAAS-LAUNCH-KIT.md`](../SAAS-LAUNCH-KIT.md) | Outlined, not executed. |
| C-3 | HECVAT and TrustEd evidence package complete. | partial |  | [`docs/market-readiness/HECVAT_READINESS.md`](../market-readiness/HECVAT_READINESS.md) | In progress. |
| C-4 | Public claims audited against evidence. | passed |  | [`app/src/lib/ops/claims.ts`](../../app/src/lib/ops/claims.ts) | The claims register holds every public claim to its word. |

## The Production Readiness Council

Each seat signs *approved*, *approved with a documented non-P0 condition*,
or *not approved*. A signature is recorded only when the seat’s holder
gives it in writing.

| Seat | Signature |
| --- | --- |
| `founder` | unsigned |
| `product` | unsigned |
| `engineering` | unsigned |
| `security` | unsigned |
| `privacy` | unsigned |
| `accessibility` | unsigned |
| `success` | unsigned |
| `trust` | unsigned |
| `data` | unsigned |
| `finance` | unsigned |
| `operations` | unsigned |
| `champion` | unsigned |

## What a pilot is for, after GO

| Objective | What it learns |
| --- | --- |
| Adoption | Which modules students, faculty and staff use first |
| Onboarding | Where real people misunderstand language, permissions or value |
| Configuration | Which institutional policies, branding, workflows and sources need adjusting |
| Implementation | How long setup, data mapping, training and support actually take |
| Support | Which documentation, prompts and escalation paths need improvement |
| Outcome evidence | Whether Semester creates clarity, planning progress, prepared advising and support discovery |
| Commercial fit | Which packaging, pricing, contract scope and implementation model institutions accept |
| Change management | How staff, faculty, advisors and students adopt a connected platform |
| Expansion | Which modules create the strongest next institutional need |
