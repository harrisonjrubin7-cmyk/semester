# Stream 24: Shared shell, role resolver, navigation, notifications and mobile

Branch `semester/shell-nav-mobile` from `origin/main`. Depends on streams 01 (platform core) and 02 (identity). Read `handoff/BUILD.md` "Read this first" before starting: **the live repo wins every conflict**; extend its authorization core, schema and design system instead of creating parallel ones.

## Inputs
- Prototype files (acceptance reference, not code to ship): `ui_kits/semester-app/Shell.jsx`, `ui_kits/semester-app/NavGroups.jsx`, `ui_kits/semester-app/EndToEnd.jsx`, `ui_kits/semester-app/Controls.jsx`, `ui_kits/semester-app/SemesterOSHome.jsx`, `ui_kits/semester-app/Transition.jsx`, `ui_kits/semester-app/Blueprint.jsx`, `ui_kits/semester-app/DepthA.jsx`, `ui_kits/semester-app/DepthB.jsx`
- Source specifications (copy to `docs/specifications/source/`): `uploads/Mapout and outline semesters company_marketing_for.pdf`
- Screen list with components: `handoff/prototype/SCREEN-INVENTORY.md` (filter Stream = 24)
- Design rules and tokens: `readme.md`, `SKILL.md`, `styles.css`

## Also: shared control plane and education graph
`Platform.jsx`: `#/os/controlchain` (14-step chain identity → tenant → membership → role → capability → scope → policy → classification → consent → source authority → workflow → audit → evidence → outcome; 6 scenarios with exact stop reasons), `#/os/graph` (16 node types with source authority + classification; role read-model lens), `#/os/catalog` (capability records linking screen, roles, workflow, data, authority, policy, API, audit event, tests, release gate, owner; learner and institution lifecycles). Specs: `Semester Master Expansion.pdf`, `One Unified Live Platform.pdf`, `x-control-plane-graph.pdf`. Every screen must call the same control plane; no screen-local permission logic.

## Also: universal screen states
`ScreenStates.jsx`: every route renders in default, loading (skeleton, aria-busy), empty, error (code + retry), no permission (request access, logged), offline (saved copy, official actions wait). Preview with `?state=<name>` or Alt+S in the app; gallery `All Screens.html`. `#/studio/workspace` maps Docs / Tools / Work Studio and the 8 document types with default visibility. Context panel (SemContextPanel): toggle on every screen with Details, Sources (system of record + freshness), Activity, Help, Next step (from Action Center). Specs: `show every screen ui.pdf`, `break down and outline are the docs toold and work.pdf`.

## Screens to build (53)

| Route in prototype | Screen | Prototype component |
| --- | --- | --- |
| `#/applicant/status` | Status and documents | CtxApplicantStatus (Controls.jsx) |
| `#/student/notifications` | Notifications | E2xNotify (EndToEnd.jsx) |
| `#/student/firstrun` | First login | CtxFirstRun (Controls.jsx) |
| `#/institution/documents` | Documents | OsxDocuments (SemesterOSHome.jsx) |
| `#/institution/segments` | Audience segments | E2xSegments (EndToEnd.jsx) |
| `#/institution/workflows` | Workflow settings | E2xWorkflows (EndToEnd.jsx) |
| `#/institution/exceptions` | Registration exceptions | CtxExceptions (Controls.jsx) |
| `#/advisor/home` | Advising home | E2xFacultyHome (EndToEnd.jsx) |
| `#/ta/sections` | My sections | DpaTaSections (DepthA.jsx) |
| `#/ta/hours` | Office hours | DpaTaHours (DepthA.jsx) |
| `#/ta/regrades` | Regrade requests | DpaTaRegrades (DepthA.jsx) |
| `#/finops/payments` | Payments and holds | CtxPayments (Controls.jsx) |
| `#/finops/refunds` | Refund queue | DpbFinRefunds (DepthB.jsx) |
| `#/finops/plans` | Payment plans | DpbFinPlans (DepthB.jsx) |
| `#/support/case` | Case SUP-2210 | DpaSupportCase (DepthA.jsx) |
| `#/support/sla` | Service levels | DpaSupportSla (DepthA.jsx) |
| `#/admissions/leads` | Leads | OsxLeads (SemesterOSHome.jsx) |
| `#/admissions/review` | Reader review | OsxReview (SemesterOSHome.jsx) |
| `#/admissions/interviews` | Interviews | OsxInterviews (SemesterOSHome.jsx) |
| `#/admissions/decisions` | Decisions | OsxDecisions (SemesterOSHome.jsx) |
| `#/admissions/funnel` | Funnel | OsxFunnel (SemesterOSHome.jsx) |
| `#/campus/events` | Event approvals | OsxEvents (SemesterOSHome.jsx) |
| `#/marketplace/disputes` | Disputes | DpaMarketDisputes (DepthA.jsx) |
| `#/marketplace/providers` | Provider verification | DpaMarketProviders (DepthA.jsx) |
| `#/trust/permissions` | Permission checker | CtxPermissions (Controls.jsx) |
| `#/family/billing` | Billing | DpaFamilyBilling (DepthA.jsx) |
| `#/family/consent` | What’s shared | DpaFamilyConsent (DepthA.jsx) |
| `#/employer/post` | Post an opportunity | DpbEmployerPost (DepthB.jsx) |
| `#/employer/applicants` | Applicants | DpbEmployerApplicants (DepthB.jsx) |
| `#/company/playbooks` | Playbooks | OsxPlaybooks (SemesterOSHome.jsx) |
| `#/company/kb` | Knowledge base | OsxKb (SemesterOSHome.jsx) |
| `#/company/payouts` | Partner payouts | OsxPayouts (SemesterOSHome.jsx) |
| `#/company/risk` | Matching and anomalies | OsxRiskOps (SemesterOSHome.jsx) |
| `#/operations/notify` | Notification hub | OsxNotify (SemesterOSHome.jsx) |
| `#/os/home` | All products | OsxHome (SemesterOSHome.jsx) |
| `#/os/blueprint` | Architecture blueprint | OsBlueprint (Blueprint.jsx) |
| `#/os/onboard` | Role onboarding | TrxOnboard (Transition.jsx) |
| `#/os/transition` | Company transition | TrxTransition (Transition.jsx) |
| `#/os/system` | End-to-end blueprint | E2xSystem (EndToEnd.jsx) |
| `#/os/signin` | Sign in and roles | E2xSignin (EndToEnd.jsx) |
| `#/os/flows` | Demo flows | CtxFlows (Controls.jsx) |
| `#/success/risk` | Early alerts | OsxRisk (SemesterOSHome.jsx) |
| `#/success/campaigns` | Outreach | OsxCampaigns (SemesterOSHome.jsx) |
| `#/success/timeline` | Service timeline | OsxTimeline (SemesterOSHome.jsx) |
| `#/success/cohorts` | Cohort programs | OsxCohorts (SemesterOSHome.jsx) |
| `#/executive/overview` | Overview | OsxExec (SemesterOSHome.jsx) |
| `#/executive/forecast` | Forecast | OsxForecast (SemesterOSHome.jsx) |
| `#/executive/board` | Board narrative | OsxBoard (SemesterOSHome.jsx) |
| `#/executive/retention` | Retention | DpbExecRetention (DepthB.jsx) |
| `#/clubs/home` | My organization | TrxClubHome (Transition.jsx) |
| `#/clubs/roster` | Roster and officers | DpbClubRoster (DepthB.jsx) |
| `#/clubs/events` | Event check-in | DpbClubEvents (DepthB.jsx) |
| `#/clubs/budget` | Club budget | DpbClubBudget (DepthB.jsx) |

## Behaviors to reproduce
Each bullet is the as-built prototype behavior. Implement it against real data and services; where the prototype simulates (timers, toggles, fake servers), build the real mechanism and keep the toggle as a test fixture.

- **Mobile + coherence pass (6 Oct):** mobile.html rebuilt: 6 role groups of jump links (Start, Student, Social, Studio, Applicant/alumni, Staff), remembers last route. Every workspace has a phone More menu at #/<ws>/__menu (workspace switcher + grouped, searchable screens; registered in NavGroups.jsx); tab bars point More there. Phone CSS (≤600px): tables scroll, rows wrap, .ph stacks, nowrap released. Phone sweep: 266 routes, 0 errors; base .stack now minmax(0,1fr) with .stack>*,.ph min-width:0 (fixes long-header overflow).
- **Complete-prototype pass (6 Oct):** NavGroups.jsx: grouped, collapsible, filterable rail for student (8 groups over 62 items), trust, studio, institution, company, operations, faculty, social; workspace-aware mobile tab bars (student, studio, social; others first 4 + More). Shell now renders window.SemRail. Route sweep: 264 nav routes, 0 missing screens. Contract worksheet gained the 7-step destruction verification protocol.
- **Depth pass (6 Oct):** DepthA.jsx (DPA*) + DepthB.jsx (DPB*) deepen 1-screen workspaces: ta (sections, office hours, regrades), support (case with macros + scoped view, SLAs), marketplace (disputes, provider verification), family (billing as authorized payer, what’s shared), employer (post with unpaid-intern test, applicants), clubs (roster/officer handoff, QR check-in, budget), finops (refunds with 2-approver ≥$500, payment plans), executive (retention). Route sweep: all nav routes have screens.
- **Social + PRD controls (6 Oct):** Social.jsx (SOC*): #/student/feed (For You/Following/Campus/Communities/Network/Explore, 8-format composer with audience/comments/tags/reshare/download-off/hide-likes, threads, polls, video mode, mute/block/report, official-campus badge), #/student/me-social (modular profile, reorder/hide sections, field visibility, mentor preview, portfolio project page), #/student/social-privacy (12 controls, keyword filters, comment approval, moderation flow). Controls.jsx (CTX*): #/student/firstrun (4-step first login + 2-action activation), #/trust/permissions (4-check permission evaluator + spec cases), #/institution/exceptions (7-state exception, student/registrar views, delegated authority gate), #/finops/payments (payment-intent → ledger postings + 7 validation hooks; hold lifecycle + hold record), #/applicant/status, #/os/flows (11 demo flows). RecordsFlow.jsx (RFX*): #/faculty/posting (11-step pipeline, 4 state tracks, per-student partial rejection, configurable approval), #/student/scenario (what-if with snapshot, allocation changes, stale + recompute, draft plan), #/os/matrix (role matrices, integration note, FERPA). Uploads with & or () in names were copied to uploads/prd-figma-screen.pdf and uploads/social-outline-2.pdf to read.
- **End-to-end blueprint (6 Oct):** EndToEnd.jsx (E2X*) from uploads/Semester End-to-End System Blueprint.pdf + semester-role-journeys.html: #/os/signin (SSO handoff → multi-role resolver with default role), #/os/system (principles, 10 domains, role homes + global nav, two-sided lifecycle stepper, screen inventory, short routes, GTM personas + ad angles), #/student/notifications (required-read acknowledgement, per-topic channel prefs), #/institution/segments (rule-based audience builder, <10 suppressed), #/institution/workflows, #/advisor/home (alerts, office hours, referral). Short routes #/prospect #/applicant #/admitted #/student #/faculty #/admin #/finance #/clubs #/marketplace #/alumni #/messages resolve to role homes.
- **Transition + onboarding (6 Oct):** Transition.jsx (TRX*): #/os/onboard adaptive onboarding for 9 roles (role → 2–3 questions → 4-step checklist with first-win activation → role homepage), #/os/transition (workstreams, audiences, messaging, funnel, role homepages, legacy-link resolver, company teams, rollout), new Club leader workspace #/clubs/home. From uploads/Mapout and outline semesters company_marketing_for.pdf.
- **One product (6 Oct):** semester-app now opens at #/os/home (Semester OS home: 10 layers as a launcher, phase filter) and #/os/blueprint (12 modules, 2 data flows, entities, RBAC matrix, API, 8 webhooks, departments; from uploads/semester-company-os-blueprint.html). SemesterOSHome.jsx (was CompanyOS.jsx; renamed to avoid a DS name clash with ui_kits/company-os) adds admissions leads/review/interviews/decisions/funnel, new workspaces success (risk, campaigns, timeline, cohorts) and executive (overview, forecast, board), campus/events, institution/documents, operations/notify, company/playbooks, kb, payouts, risk. Prefixes OSX*/BPX* keep globals unique.

## Tasks
1. Map each screen to the repo’s routing and layout; reuse existing components from the design system bundle before adding new ones.
2. Define or extend the data model and API for every state the screens show. Server-authoritative for permissions, grades, money and enrollment.
3. Enforce authorization on the server for every read and write (deny by default). Add negative tests.
4. Implement empty, loading, error, offline and permission-denied states shown in the prototype.
5. Write unit, integration and accessibility tests for each behavior bullet. Use synthetic data only.
6. Keep copy and labels from the prototype unless the repo’s content guide says otherwise.

## Exit gates
- [ ] Every screen above reachable from navigation for the right roles and absent for others
- [ ] Every behavior bullet covered by a passing test
- [ ] Typecheck, lint, unit, integration and a11y checks pass (`handoff/verify.sh`)
- [ ] No production data, secrets or remote migrations touched
- [ ] Report written to `docs/execute/24-shell-nav-mobile-report.md` with evidence; PR opened; STOP for human review
