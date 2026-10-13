# Route coverage: checklist vs. app screens

Generated from the uploaded `routes_checklist.yaml` (111 routes) and the `Screen` union in `app/src/lib/types.ts` (81 ids). Matching is by name only: a checklist `screen_key` with the `app_`/`teach_` prefix stripped against an app screen id. A name match does not prove the screen behaves as the route specifies. Roles, capabilities, tables, APIs, and audit events are not filled in: the checklist has them empty, and the app does not declare them per screen.

| Route | screen_key | App screen (name match) | Status |
|---|---|---|---|
| `/` | `home` | home | mapped |
| `/solutions` | `solutions` | — | unmapped |
| `/pricing` | `pricing` | — | unmapped |
| `/pilot` | `pilot` | — | unmapped |
| `/trust` | `trust` | — | unmapped |
| `/resources` | `resources` | — | unmapped |
| `/signup` | `signup` | — | unmapped |
| `/account-recovery` | `account_recovery` | — | unmapped |
| `/app/today` | `app_today` | — | unmapped |
| `/app/action-center` | `app_action_center` | — | unmapped |
| `/app/search` | `app_search` | search | mapped |
| `/app/launchpad` | `app_launchpad` | — | unmapped |
| `/app/me` | `app_me` | me | mapped |
| `/app/privacy` | `app_privacy` | privacy | mapped |
| `/app/trust-room` | `app_trust_room` | — | unmapped |
| `/app/whats-new` | `app_whats_new` | — | unmapped |
| `/app/university` | `app_university` | university | mapped |
| `/app/calendar` | `app_calendar` | calendar | mapped |
| `/app/calendar/conflicts` | `app_calendar_conflicts` | — | unmapped |
| `/app/courses` | `app_courses` | courses | mapped |
| `/app/courses/:courseId` | `app_courses_courseId` | — | unmapped |
| `/app/assignments` | `app_assignments` | — | unmapped |
| `/app/work` | `app_work` | work | mapped |
| `/app/messages` | `app_messages` | — | unmapped |
| `/app/grades` | `app_grades` | — | unmapped |
| `/app/registration` | `app_registration` | registration | mapped |
| `/app/advising` | `app_advising` | — | unmapped |
| `/app/degree` | `app_degree` | degree | mapped |
| `/app/degree/what-if` | `app_degree_what_if` | — | unmapped |
| `/app/study` | `app_study` | study | mapped |
| `/app/study/cards` | `app_study_cards` | — | unmapped |
| `/app/study/read` | `app_study_read` | — | unmapped |
| `/app/study/field-guide` | `app_study_field_guide` | — | unmapped |
| `/app/study/watch` | `app_study_watch` | — | unmapped |
| `/app/study/slides` | `app_study_slides` | — | unmapped |
| `/app/study/doc` | `app_study_doc` | — | unmapped |
| `/app/study/quiz` | `app_study_quiz` | — | unmapped |
| `/app/study/figures` | `app_study_figures` | — | unmapped |
| `/app/study/cases` | `app_study_cases` | — | unmapped |
| `/app/study/cram` | `app_study_cram` | — | unmapped |
| `/app/study/listen` | `app_study_listen` | — | unmapped |
| `/app/ask` | `app_ask` | ask | mapped |
| `/app/write` | `app_write` | write | mapped |
| `/app/solve` | `app_solve` | solve | mapped |
| `/app/sources` | `app_sources` | sources | mapped |
| `/app/classmates` | `app_classmates` | classmates | mapped |
| `/app/groupwork` | `app_groupwork` | groupwork | mapped |
| `/app/maps` | `app_maps` | maps | mapped |
| `/app/activities` | `app_activities` | activities | mapped |
| `/app/housing` | `app_housing` | housing | mapped |
| `/app/meal-plan` | `app_meal_plan` | — | unmapped |
| `/app/support` | `app_support` | — | unmapped |
| `/app/back-on-track` | `app_back_on_track` | — | unmapped |
| `/app/career` | `app_career` | career | mapped |
| `/app/letters` | `app_letters` | — | unmapped |
| `/app/nil` | `app_nil` | nil | mapped |
| `/app/exam-runway` | `app_exam_runway` | — | unmapped |
| `/app/timers` | `app_timers` | — | unmapped |
| `/app/reports` | `app_reports` | — | unmapped |
| `/app/family` | `app_family` | family | mapped |
| `/teach` | `teach` | — | unmapped |
| `/teach/gradebook` | `teach_gradebook` | gradebook | mapped |
| `/teach/assessments` | `teach_assessments` | — | unmapped |
| `/ta/queue` | `ta_queue` | — | unmapped |
| `/advising` | `advising` | — | unmapped |
| `/advising/caseload` | `advising_caseload` | — | unmapped |
| `/advising/referrals` | `advising_referrals` | — | unmapped |
| `/finance` | `finance` | — | unmapped |
| `/finance/students` | `finance_students` | — | unmapped |
| `/support/cases` | `support_cases` | — | unmapped |
| `/admissions` | `admissions` | — | unmapped |
| `/career-hub` | `career_hub` | — | unmapped |
| `/campus-services` | `campus_services` | — | unmapped |
| `/insights` | `insights` | — | unmapped |
| `/trust-console` | `trust_console` | console | mapped |
| `/registrar` | `registrar` | registrar | mapped |
| `/registrar/readiness` | `registrar_readiness` | — | unmapped |
| `/registrar/readiness/:caseId` | `registrar_readiness_caseId` | — | unmapped |
| `/registrar/overrides` | `registrar_overrides` | — | unmapped |
| `/console` | `console` | console | mapped |
| `/console/overview` | `console_overview` | — | unmapped |
| `/console/approvals` | `console_approvals` | — | unmapped |
| `/console/support` | `console_support` | — | unmapped |
| `/console/integrations` | `console_integrations` | — | unmapped |
| `/console/security` | `console_security` | — | unmapped |
| `/console/audit` | `console_audit` | — | unmapped |
| `/portal/applicant` | `portal_applicant` | — | unmapped |
| `/portal/family` | `portal_family` | family | mapped |
| `/portal/alumni` | `portal_alumni` | — | unmapped |
| `/portal/employer` | `portal_employer` | — | unmapped |
| `/portal/partner` | `portal_partner` | — | unmapped |
| `/developers` | `developers` | — | unmapped |
| `/developers/apps` | `developers_apps` | — | unmapped |
| `/developers/webhooks` | `developers_webhooks` | — | unmapped |
| `/investor` | `investor` | — | unmapped |
| `/company` | `company` | — | unmapped |
| `/company/sales` | `company_sales` | — | unmapped |
| `/company/quotes` | `company_quotes` | — | unmapped |
| `/company/contracts` | `company_contracts` | — | unmapped |
| `/company/billing` | `company_billing` | — | unmapped |
| `/company/vendors` | `company_vendors` | — | unmapped |
| `/company/agreements` | `company_agreements` | agreements | mapped |
| `/company/board` | `company_board` | — | unmapped |
| `/ops` | `ops` | — | unmapped |
| `/ops/inbox` | `ops_inbox` | — | unmapped |
| `/ops/incidents` | `ops_incidents` | — | unmapped |
| `/ops/releases` | `ops_releases` | — | unmapped |
| `/ops/access` | `ops_access` | — | unmapped |
| `/ops/privacy` | `ops_privacy` | privacy | mapped |
| `/ops/dead-letters` | `ops_dead_letters` | — | unmapped |
| `/ops/architecture` | `ops_architecture` | — | unmapped |

## App screens with no checklist route

- `account`
- `analyse`
- `announce`
- `applying`
- `athletics`
- `behind`
- `brief`
- `call`
- `clocks`
- `community`
- `connect`
- `costs`
- `course`
- `data`
- `deck`
- `dining`
- `directory`
- `draw`
- `drill`
- `edit`
- `equations`
- `essay`
- `event`
- `exam`
- `export`
- `gap`
- `guess`
- `guide`
- `help`
- `import`
- `item`
- `lesson`
- `links`
- `mail`
- `meals`
- `meet`
- `mine`
- `moderation`
- `note`
- `notifs`
- `onboarding`
- `pathway`
- `people`
- `profile`
- `proof`
- `quiz`
- `runway`
- `settings`
- `sheet`
- `slides`
- `update`
- `volunteer`
- `volunteers`
- `yes`
