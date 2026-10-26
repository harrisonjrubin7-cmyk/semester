# Repo crosswalk: what the live `semester` repo already has, and how this design system maps to it

Source: `uploads/show and work through every algorith workflow loop.pdf` (6 Oct 2026). It is an inspection of the real repository and database, so **it outranks the design system's proposed table names.** The coding agent extends what exists. It does not create a parallel schema.

## Status ladder (use for every capability)
| Status | Meaning |
|---|---|
| Specified | A document or design describes it (everything in this design system starts here) |
| Schema-present | The required tables exist |
| Code-present | An implementation exists in source |
| Connected | Frontend, command, records and workers are wired |
| Tested | Success, failure and authorization paths pass |
| Deployed | Verified in a particular environment |
| Operational | Monitoring, ownership, support and recovery work |

`handoff/registry/capabilities.json` reports only design-side facts. The agent's Phase 0 writes `docs/registry-status.json` with these seven levels from repo evidence.

## Tables the repo already has → design-system equivalents
| Repo (verified) | Design system (proposed) | Rule |
|---|---|---|
| role_grants, role_capabilities (69 roles, 96 capabilities, 185 mappings) | ctl.capabilities, ctl.grants | **Use the repo's.** Map ctl.can() onto it, and keep resource scope and expiry |
| institution_membership, institution_identity_provider, tenant_sso_policy | iam.memberships, opsx.integrations (sso) | Use the repo's |
| onboarding_journeys, onboarding_assignments, onboarding_step_progress, onboarding_events | onboard.* (110) | Use the repo's; 110 was modeled on it |
| commercial_products, commercial_plans, commercial_prices, subscriptions, subscription_entitlements | commerce.* (170) | Use the repo's |
| billing_accounts, invoices, payment_events, checkout_sessions, cancellation_requests | cofin.* (210), reference-slice/enterprise-v3/002_billing | Use the repo's; add allocations and reconciliation from 002 only if missing |
| console_duty, approval_request, approval_decision, console_action_record | ctl.action_requests / action_approvals (100) | Use the repo's |
| migration_projects, migration_field_maps, migration_runs, migration_approvals | impl.migration_batches (200) | Use the repo's |
| tenant_module_mode, module_mode_request, module_mode_approval | (none) | Keep: Connect vs Core authority per module |
| school_offboarding, school_offboarding_undo | ops.tenant_lifecycle_requests (210) | Use the repo's |
| course_ai_rules, course_guidance, study_packs | core.course_ai_rules, learn.study_artifacts | Use the repo's; study packs back Study studio |
| gradebook_schemes, gradebook_items, grade_entries, regrade_requests, grade_passbacks | learn.grade_entries / grade_revisions (170) | Use the repo's. It already separates released rows from internal history |
| gtm_accounts, gtm_stakeholders, gtm_decision_log, gtm_pilots, gtm_pilot_outcomes | biz.accounts / opportunities / pilots / pilot_measures (160) | Use the repo's |
| trust_room_requests, contracts, implementation_projects, tenant_rollout, success_plans, renewal_opportunities | biz.contracts, impl.projects (200), ui_kits/company-os | Use the repo's |
| site_leads, cta_routes, referrals, access_gate, invites, beta_invitations, school_membership_requests, consent_record | growth.* (110), iam.invitations (200) | Use the repo's |

## Screens the repo already has (source files) → design references
| Repo screen | Design reference in this system |
|---|---|
| FirstRun, Onboarding | semester-app `#/public/signup` |
| Today, Hub, Me | semester-app `#/student/today`, `#/student/everything` |
| Courses, EditCourse, Lesson | semester-app `#/student/courses`, `#/faculty/course` |
| Study, Exam | study-studio (11 formats), `#/student/teach` |
| Grades, Gradebook | `#/student/grades`, faculty-grading |
| Calendar, Work, Write, Sheet, Slides, Draw | `#/student/toolkit` and Work for this |
| Registration, Registrar, Degree, Pathway | readiness-pilot, `#/student/registration`, registrar-console |
| Bill, Costs, Runway | `#/student/account` |
| Support, Help, Family, Athletics | screens.js directory (queued) |
| Career, Opportunities, Applying | screens.js directory (queued) |
| Community, Groupwork, Classmates, Meet, Mail | community kit, `#/student/messages` |
| Dining, Meals, Housing, Maps, Directory | screens.js directory (queued), migration 240 |
| Import, Export, Data, Privacy, Recovery | `#/operations/privacy`, screens.js directory |
| Console, Reports, TrustRoom, Agreements, Moderation | `#/operations/*`, console-entry, company-os |

**Presence is not completion.** A screen file or table existing in the repo puts it at Code-present or Schema-present. It's Connected only when the screen calls a command that writes the record, a worker processes it, and the result shows on screen.

## Reference precedence
Repo → `reference-slice/enterprise-v4/` (71 tables, full RLS, billing state machines) → `semester-platform/` (227 tables, wider domains). Earlier slices are superseded. Every screen also shows a source badge: official, synced, entered by you, or AI suggestion.

## Hard rules carried from the inspection
- A university email address alone never grants instructor or administrator authority.
- Enabled RLS does not prove the policies, grants, elevated functions or storage rules are correct. Test each one.
- The figures above (69 roles, 96 capabilities, 3 products, 9 plans, 11 prices) are database inventory counts, not customers or proven workflows.

## Role workspaces in the prototype (`ui_kits/semester-app/index.html#/<workspace>/<screen>`)
| Role | Workspace route | Leads with |
|---|---|---|
| Visitor / prospect | public/home, pilot, trust, signup | Signup → institution match → consent → goal → courses → Today |
| Student | student/* (41 screens) | Today, Action center, Search, Courses, Assignments + Work for this, Grades, Registration, Advising, Messages, Money, Study studio, Work on it, Teach it back, Ask Semester, Degree, Housing, Meal plan, Family sharing, Launchpad, Calendar (conflicts), Write (AI policy + revisions), Solve (step by step), Sources (citations), Classmates (consent first), Groupwork, Maps (accessible routes), Activities, Get help, Back on track, Career, Me, Privacy, Trust room, What’s new, Everything |
| Family delegate | family/shared | Only the student-chosen items, with an end date |
| Alumni | alumni/home | Transcript request (registrar-issued), credentials |
| Instructor | faculty/* | Course studio (publish/unpublish), roster with accommodation instructions only, grading, announcements |
| Teaching assistant | ta/queue | Assigned grading only; no publish or release |
| Advisor | advisor/caseload | Assigned students, sourced signals, notes, referrals |
| Registrar / office staff | institution/* | Office handoffs (resolve ≠ clear), registrar, invitations, integrations |
| Student accounts / aid | finops/queue | Charges, refunds over $250 need a second approver, aid verification |
| Support / wellbeing / housing staff | support/desk | Team-owned cases; protected notes stay with the team |
| Career services | career/postings, coaching, outcomes | Posting review before students see it; coaching notes never shared with employers; self-reported vs confirmed outcomes |
| Housing and dining staff | campus/requests, capacity, dining | Service tickets (urgent within 4 h), beds vs capacity, closures published to students |
| Admissions | admissions/applicants | Documents, decisions with a second reviewer |
| Leaders / analysts | insights/readiness | Aggregates only; groups under 10 suppressed |
| Security / privacy officer | trust/audit | Audit explorer, access reviews, privacy requests |
| Employer / partner | employer/roles | Roles reviewed by the career office; applicants who chose to apply |
| Semester business | company/* | Pipeline (lost needs a reason), contracts, support (student-approved access), invoices, company OS, customer account view |
| Semester platform operator | operations/* | Command center, incidents (72 h clock), releases (blocked by AI evals), access (no self-grant, ≤ 90 days high-impact), privacy (verify then fulfil), dead letters |
