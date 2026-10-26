# Semester prototype: screen inventory

Generated 6 Oct 2026 from `ui_kits/semester-app/` (load order in `index.html`). **281 routes across 26 workspaces.** Open any route as `ui_kits/semester-app/index.html#/<workspace>/<screen>`; on a phone frame use `mobile.html`. Every workspace also has a phone menu at `#/<workspace>/__menu`.

Columns: route · nav label · prototype component · source file · build stream (`handoff/execute/`). The prototype is the acceptance reference for behavior and copy; it is not production code.

## Public site (`public`, 8)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/public/home` | Home | PHome | Public.jsx | 11 |
| `#/public/pilot` | Pilot | PPilot | Public.jsx | 11 |
| `#/public/trust` | Trust | PTrust | Public.jsx | 11 |
| `#/public/signup` | Sign up | PSignup | Public.jsx | 11 |
| `#/public/solutions` | Solutions | Solutions | Gaps.jsx | 18 |
| `#/public/pricing` | Pricing | PublicPricing | Membership.jsx | 11 |
| `#/public/resources` | Resources | Resources | Gaps.jsx | 18 |
| `#/public/recover` | Recover account | Recover | Gaps.jsx | 18 |

## Applicant / admitted (`applicant`, 4)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/applicant/application` | Application | Applicant | Portals.jsx | 03 |
| `#/applicant/onboarding` | Getting to day one | Onboarding | Portals.jsx | 03 |
| `#/applicant/admitted` | Admitted checklist | NwxAdmitted | Networking.jsx | 20 |
| `#/applicant/status` | Status and documents | CtxApplicantStatus | Controls.jsx | 24 |

> Added 6 Oct: `#/student/brain` Semester Brain (BrnToday, OpsConsole.jsx, stream 21) is now the student’s first screen and phone Today tab.

## Student (`student`, 62)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/student/today` | Today | Today | Student.jsx | 03 |
| `#/student/courses` | Courses | Courses | Student.jsx | 03 |
| `#/student/assignments` | Assignments | Assignments | Student.jsx | 03 |
| `#/student/coursework` | Assignment Studio | Coursework | AssignmentStudio.jsx | 19 |
| `#/student/quiz` | Quiz 4 (live) | Quiz | AssignmentStudio.jsx | 19 |
| `#/student/feedback` | Feedback | Feedback | AssignmentStudio.jsx | 19 |
| `#/student/grades` | Grades | Grades | Student.jsx | 03 |
| `#/student/registration` | Registration | Registration | Student.jsx | 03 |
| `#/student/advising` | Advising | Advising | Student.jsx | 03 |
| `#/student/messages` | Messages | Messages | Student.jsx | 03 |
| `#/student/account` | Money | Account | Student.jsx | 03 |
| `#/student/study` | Study studio | Study | Student.jsx | 03 |
| `#/student/toolkit` | Work on it | Toolkit | Learning.jsx | 03 |
| `#/student/teach` | Teach it back | TeachBack | Learning.jsx | 03 |
| `#/student/briefing` | Briefing | Briefing | DegreeAI.jsx | 19 |
| `#/student/ai` | Ask Semester | Assistant | Learning.jsx | 03 |
| `#/student/recommendation` | Recommendation | Recommendation | DegreeAI.jsx | 19 |
| `#/student/actions` | Action center | ActionCenter | Roles.jsx | 18 |
| `#/student/search` | Search | Search | Roles.jsx | 18 |
| `#/student/launchpad` | Launchpad | Launchpad | Experience.jsx | 03 |
| `#/student/calendar` | Calendar | Calendar | Experience.jsx | 03 |
| `#/student/degree` | The degree | DegreeAudit | DegreeAI.jsx | 19 |
| `#/student/register` | Class search and cart | Registration2 | Portals.jsx | 03 |
| `#/student/bill` | Tuition and aid | Money2 | Portals.jsx | 03 |
| `#/student/opportunities` | Campus marketplace | Marketplace | CampusMarketplace.jsx | 07 |
| `#/student/abroad` | Study abroad | StudyAbroad | CampusMarketplace.jsx | 07 |
| `#/student/clubs` | Clubs | Clubs | CampusMarketplace.jsx | 07 |
| `#/student/market` | Buy and sell | Market | Portals.jsx | 03 |
| `#/student/housing` | Housing | Housing | Roles.jsx | 18 |
| `#/student/housingportal` | Housing application | HousingPortal | Portals.jsx | 03 |
| `#/student/dining` | Meal plan | Dining | Roles.jsx | 18 |
| `#/student/family` | Family sharing | FamilyShare | Roles.jsx | 18 |
| `#/student/write` | Write | Write | Experience.jsx | 03 |
| `#/student/solve` | Solve | Solve | Experience.jsx | 03 |
| `#/student/sources` | Sources | Sources | Experience.jsx | 03 |
| `#/student/community` | Classmates | Community | Experience.jsx | 03 |
| `#/student/groupwork` | Groupwork | Groupwork | Experience.jsx | 03 |
| `#/student/maps` | Maps | Maps | Experience.jsx | 03 |
| `#/student/activities` | Activities | Involvement | Experience.jsx | 03 |
| `#/student/help` | Get help | Help | Experience.jsx | 03 |
| `#/student/recovery` | Back on track | Recovery | Experience.jsx | 03 |
| `#/student/career` | Career | Career | Gaps.jsx | 18 |
| `#/student/me` | Me | Me | Experience.jsx | 03 |
| `#/student/profile` | Profile and portfolio | ProfilePortfolio | ProfilePortfolio.jsx | 20 |
| `#/student/plan` | Membership | StudentPlan | Membership.jsx | 11 |
| `#/student/privacy` | Privacy | Privacy | Gaps.jsx | 18 |
| `#/student/trustroom` | Trust room | TrustRoom | Experience.jsx | 03 |
| `#/student/changes` | What’s new | Changes | Experience.jsx | 03 |
| `#/student/everything` | Everything | Everything | Student.jsx | 03 |
| `#/student/network` | Network | NwxStudentNetwork | Networking.jsx | 20 |
| `#/student/gradebook` | Gradebook | ArxGradebook | AcademicStudent.jsx | 19 |
| `#/student/transcript` | Transcript | ArxTranscript | AcademicStudent.jsx | 19 |
| `#/student/notifications` | Notifications | E2xNotify | EndToEnd.jsx | 24 |
| `#/student/feed` | Feed | SocFeed | Social.jsx | 20 |
| `#/student/me-social` | My social profile | SocProfile | Social.jsx | 20 |
| `#/student/social-privacy` | Social privacy | SocPrivacy | Social.jsx | 20 |
| `#/student/firstrun` | First login | CtxFirstRun | Controls.jsx | 24 |
| `#/student/scenario` | What-if path | RfxScenario | RecordsFlow.jsx | 19 |
| `#/student/advise` | Course advisor | CaxAdvisor | SocialMod.jsx | 20 |
| `#/student/regplan` | Plan registration | ApxRegister | AcademicPlan.jsx | 19 |
| `#/student/majors` | Explore majors | ApxMajors | AcademicPlan.jsx | 19 |
| `#/student/nextsteps` | Executive Advisor | IexAdvisor | ExecAdvisor.jsx | 19 |

## Faculty (`faculty`, 17)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/faculty/home` | Teaching home | FHome | FacultyInstitution.jsx | 04 |
| `#/faculty/course` | Course studio | FCourse | FacultyInstitution.jsx | 04 |
| `#/faculty/roster` | Roster | FRoster | FacultyInstitution.jsx | 04 |
| `#/faculty/grading` | Grading | FGrading | FacultyInstitution.jsx | 04 |
| `#/faculty/announce` | Announcements | FAnnounce | FacultyInstitution.jsx | 04 |
| `#/faculty/builder` | Assignment builder | Builder | AssignmentFaculty.jsx | 19 |
| `#/faculty/bank` | Question bank | QuestionBank | AssignmentFaculty.jsx | 19 |
| `#/faculty/inbox` | Submission inbox | Inbox | AssignmentFaculty.jsx | 19 |
| `#/faculty/grade` | Grade a submission | Grading | LTISequence.jsx | 05 |
| `#/faculty/gradebook` | Gradebook | Gradebook | AssignmentFaculty.jsx | 19 |
| `#/faculty/requests` | Requests | Forms | AssignmentFaculty.jsx | 19 |
| `#/faculty/gradesync` | Grade sync | GradeSync | LTI.jsx | 05 |
| `#/faculty/lineitem` | Grade column | LineItemResolver | LTICompliance.jsx | 05 |
| `#/faculty/coursecopy` | Course copy | CourseCopy | LTITrace.jsx | 05 |
| `#/faculty/gbcontrols` | Gradebook controls | ArsFacultyGradebook | AcademicStaff.jsx | 19 |
| `#/faculty/posting` | Grade posting | RfxPosting | RecordsFlow.jsx | 19 |
| `#/faculty/assistant` | Instructor Assistant | SixInstructor | IntelRoles.jsx | 21 |

## Institution (`institution`, 19)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/institution/os` | Institution OS | InstitutionOS | InstitutionOS.jsx | 05 |
| `#/institution/queue` | Work queue | OpsQueue | InstitutionOS.jsx | 05 |
| `#/institution/term` | Term planner | TermPlanner | TermPlanner.jsx | 19 |
| `#/institution/announce` | Announcements | AnnouncementComposer | AnnouncementComposer.jsx | 05 |
| `#/institution/handoffs` | Office handoffs | IHandoffs | FacultyInstitution.jsx | 04 |
| `#/institution/registrar` | Registrar | IRegistrar | FacultyInstitution.jsx | 04 |
| `#/institution/people` | Invitations | IPeople | FacultyInstitution.jsx | 04 |
| `#/institution/integrations` | Integrations | IIntegrations | FacultyInstitution.jsx | 04 |
| `#/institution/authority` | Domain authority | AuthorityMap | Authority.jsx | 22 |
| `#/institution/entitlements` | Entitlements | Entitlements | Gaps.jsx | 18 |
| `#/institution/activation` | Module activation | InstitutionActivation | Membership.jsx | 11 |
| `#/institution/regops` | Registration operations | RegOps | PortalsStaff.jsx | 04 |
| `#/institution/onbverify` | Admitted verification | OnbVerify | PortalsStaff.jsx | 04 |
| `#/institution/documents` | Documents | OsxDocuments | SemesterOSHome.jsx | 24 |
| `#/institution/records` | Academic records | ArsRegistrar | AcademicStaff.jsx | 19 |
| `#/institution/segments` | Audience segments | E2xSegments | EndToEnd.jsx | 24 |
| `#/institution/workflows` | Workflow settings | E2xWorkflows | EndToEnd.jsx | 24 |
| `#/institution/exceptions` | Registration exceptions | CtxExceptions | Controls.jsx | 24 |
| `#/institution/substitutions` | Substitution engine | ExxEngine | Exceptions.jsx | 19 |

## Advisor (`advisor`, 7)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/advisor/caseload` | Caseload | RoleAdvising | Roles.jsx | 18 |
| `#/advisor/audit` | Shared degree audit | ArsAdvisorAudit | AcademicStaff.jsx | 19 |
| `#/advisor/home` | Advising home | E2xFacultyHome | EndToEnd.jsx | 24 |
| `#/advisor/engine` | Recommendation engine | AexEngine | AdvisingEngine.jsx | 19 |
| `#/advisor/rules` | Rule evaluator | DpxEvaluator | DpaRules.jsx | 22 |
| `#/advisor/access` | Permission walkthrough | GrxWalk | Guardrails.jsx | 19 |
| `#/advisor/guard` | Explanation guard | GrxGuard | Guardrails.jsx | 19 |

## Teaching assistant (`ta`, 4)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/ta/queue` | My grading | FinOps | Roles.jsx | 18 |
| `#/ta/sections` | My sections | DpaTaSections | DepthA.jsx | 24 |
| `#/ta/hours` | Office hours | DpaTaHours | DepthA.jsx | 24 |
| `#/ta/regrades` | Regrade requests | DpaTaRegrades | DepthA.jsx | 24 |

## Financial operations (`finops`, 4)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/finops/queue` | Accounts and aid | FinOps | Roles.jsx | 18 |
| `#/finops/payments` | Payments and holds | CtxPayments | Controls.jsx | 24 |
| `#/finops/refunds` | Refund queue | DpbFinRefunds | DepthB.jsx | 24 |
| `#/finops/plans` | Payment plans | DpbFinPlans | DepthB.jsx | 24 |

## Support desk (`support`, 3)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/support/desk` | Cases | SupportDesk | Roles.jsx | 18 |
| `#/support/case` | Case SUP-2210 | DpaSupportCase | DepthA.jsx | 24 |
| `#/support/sla` | Service levels | DpaSupportSla | DepthA.jsx | 24 |

## Admissions (`admissions`, 6)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/admissions/applicants` | Applicants | Admissions | Roles.jsx | 18 |
| `#/admissions/leads` | Leads | OsxLeads | SemesterOSHome.jsx | 24 |
| `#/admissions/review` | Reader review | OsxReview | SemesterOSHome.jsx | 24 |
| `#/admissions/interviews` | Interviews | OsxInterviews | SemesterOSHome.jsx | 24 |
| `#/admissions/decisions` | Decisions | OsxDecisions | SemesterOSHome.jsx | 24 |
| `#/admissions/funnel` | Funnel | OsxFunnel | SemesterOSHome.jsx | 24 |

## Career Hub (`career`, 4)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/career/postings` | Postings | CareerPostings | Services.jsx | 03 |
| `#/career/review` | Listing review | ListingReview | CampusMarketplace.jsx | 07 |
| `#/career/coaching` | Coaching | CareerCoaching | Services.jsx | 03 |
| `#/career/outcomes` | Outcomes | CareerOutcomes | Services.jsx | 03 |

## Campus services (`campus`, 5)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/campus/requests` | Service requests | CampusRequests | Services.jsx | 03 |
| `#/campus/capacity` | Housing capacity | CampusCapacity | Services.jsx | 03 |
| `#/campus/dining` | Dining | CampusDining | Services.jsx | 03 |
| `#/campus/rules` | Wallet rules | DiningRules | PortalsStaff.jsx | 04 |
| `#/campus/events` | Event approvals | OsxEvents | SemesterOSHome.jsx | 24 |

## Marketplace moderation (`marketplace`, 3)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/marketplace/queue` | Review queue | Moderation | PortalsStaff.jsx | 04 |
| `#/marketplace/disputes` | Disputes | DpaMarketDisputes | DepthA.jsx | 24 |
| `#/marketplace/providers` | Provider verification | DpaMarketProviders | DepthA.jsx | 24 |

## Institutional insights (`insights`, 3)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/insights/readiness` | Readiness | Insights | Roles.jsx | 18 |
| `#/insights/business` | Campus business | CampusBusiness | CampusBusiness.jsx | 15 |
| `#/insights/budget` | Department budget | BudgetWorkspace | BudgetWorkspace.jsx | 15 |

## Trust console (`trust`, 21)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/trust/audit` | Audit explorer | Trust | Roles.jsx | 18 |
| `#/trust/matrix` | Access matrix | FerpaMatrix | Ferpa.jsx | 22 |
| `#/trust/monitor` | Governance monitor | GovMonitor | GovMonitor.jsx | 22 |
| `#/trust/permissions` | Permission checker | CtxPermissions | Controls.jsx | 24 |
| `#/trust/social` | Social moderation | SmxModeration | SocialMod.jsx | 20 |
| `#/trust/ranking` | Feed ranking lab | SrxRanking | SocialRank.jsx | 20 |
| `#/trust/safety` | Social safety pipeline | SrxSafety | SocialRank.jsx | 20 |
| `#/trust/ferpa` | FERPA checklist | ApxFerpa | AcademicPlan.jsx | 19 |
| `#/trust/airisk` | AI risk and filters | ArkRisk | AiRisk.jsx | 20 |
| `#/trust/dpa` | Vendor DPA draft | DpxDpa | DpaRules.jsx | 22 |
| `#/trust/aiaudit` | AI RMF audit | SvxAudit | SocialVideo.jsx | 20 |
| `#/trust/release` | Model release gate | GrxRelease | Guardrails.jsx | 19 |
| `#/trust/drills` | Direct-control drills | ExxDrills | Exceptions.jsx | 19 |
| `#/trust/incident` | Moderation incident | InxIncident | Incidents.jsx | 20 |
| `#/trust/manage` | Triggers and rollback | InxManage | Incidents.jsx | 20 |
| `#/trust/dataflow` | Data flow and Schedule A | ZnxFlow | DataZones.jsx | 22 |
| `#/trust/cloud` | Cloud controls | ClxCloud | CloudAccounts.jsx | 22 |
| `#/trust/revocation` | DC-02 revocation lab | RvxLab | Revocation.jsx | 22 |
| `#/trust/fieldmap` | SIS field map | IexMap | ExecAdvisor.jsx | 19 |
| `#/trust/contract` | Contract worksheet | TrnContract | TestsContract.jsx | 22 |
| `#/trust/auditpkg` | Audit package | ObxAudit | Outbox.jsx | 20 |

## Family delegate (`family`, 3)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/family/shared` | Shared with me | FamilyView | Roles.jsx | 18 |
| `#/family/billing` | Billing | DpaFamilyBilling | DepthA.jsx | 24 |
| `#/family/consent` | What’s shared | DpaFamilyConsent | DepthA.jsx | 24 |

## Alumni (`alumni`, 7)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/alumni/home` | Lifelong account | Alumni | Roles.jsx | 18 |
| `#/alumni/directory` | Directory | NwxAlumniDirectory | Networking.jsx | 20 |
| `#/alumni/mentor` | Mentorship | NwxAlumniMentor | Networking.jsx | 20 |
| `#/alumni/groups` | Groups and events | NwxAlumniGroups | Networking.jsx | 20 |
| `#/alumni/jobs` | Shared jobs | NwxAlumniJobs | Networking.jsx | 20 |
| `#/alumni/visibility` | Who sees what | NwxAlumniPrivacy | Networking.jsx | 20 |
| `#/alumni/transcript` | Transcript | ArxTranscript | AcademicStudent.jsx | 19 |

## Employer (`employer`, 3)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/employer/roles` | Opportunities | Employer | Roles.jsx | 18 |
| `#/employer/post` | Post an opportunity | DpbEmployerPost | DepthB.jsx | 24 |
| `#/employer/applicants` | Applicants | DpbEmployerApplicants | DepthB.jsx | 24 |

## Company (`company`, 17)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/company/home` | Company home | CHome | CompanyOps.jsx | 11 |
| `#/company/pipeline` | Pipeline | CPipeline | CompanyOps.jsx | 11 |
| `#/company/contracts` | Contracts | CContracts | CompanyOps.jsx | 11 |
| `#/company/support` | Support | CSupport | CompanyOps.jsx | 11 |
| `#/company/billing` | Invoices | CBilling | CompanyOps.jsx | 11 |
| `#/company/os` | Company OS | COS | CompanyOps.jsx | 11 |
| `#/company/account` | Customer account view | AAccount | CompanyOps.jsx | 11 |
| `#/company/quotes` | Quotes | Quotes | Gaps.jsx | 18 |
| `#/company/lifecycle` | Billing lifecycle | Lifecycle | Gaps.jsx | 18 |
| `#/company/ledger` | Ledger | Ledger | Gaps.jsx | 18 |
| `#/company/recon` | Reconciliation | Recon | Gaps.jsx | 18 |
| `#/company/vendors` | Vendors | Vendors | Gaps.jsx | 18 |
| `#/company/agreements` | Customer agreements | Agreements | Gaps.jsx | 18 |
| `#/company/playbooks` | Playbooks | OsxPlaybooks | SemesterOSHome.jsx | 24 |
| `#/company/kb` | Knowledge base | OsxKb | SemesterOSHome.jsx | 24 |
| `#/company/payouts` | Partner payouts | OsxPayouts | SemesterOSHome.jsx | 24 |
| `#/company/risk` | Matching and anomalies | OsxRiskOps | SemesterOSHome.jsx | 24 |

## Operations (`operations`, 17)

> Merged 6 Oct: these are now tabs of one **Operations console** at `#/operations/console/<key>` (groups: Command center, Integrations, Collaboration, Database, Access control). The old `#/operations/<key>` routes open the same console tab. Also added: `#/operations/rebuild`, `#/operations/policy` (RebuildPolicy.jsx).


| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/operations/home` | Command center | OHome | CompanyOps.jsx | 11 |
| `#/operations/incidents` | Incidents | OIncidents | CompanyOps.jsx | 11 |
| `#/operations/releases` | Releases | OReleases | CompanyOps.jsx | 11 |
| `#/operations/access` | Access | OAccess | CompanyOps.jsx | 11 |
| `#/operations/privacy` | Privacy requests | OPrivacy | CompanyOps.jsx | 11 |
| `#/operations/deadletters` | Dead letters | ODead | CompanyOps.jsx | 11 |
| `#/operations/architecture` | Architecture | Architecture | Gaps.jsx | 18 |
| `#/operations/lti` | LTI launch checks | LtiLaunch | LTI.jsx | 05 |
| `#/operations/ltiseq` | LTI sequence | LtiSequence | LTISequence.jsx | 05 |
| `#/operations/lticompliance` | LTI audit | LtiCompliance | LTICompliance.jsx | 05 |
| `#/operations/ltitrace` | Launch trace | LtiTrace | LTITrace.jsx | 05 |
| `#/operations/jwt` | JWT inspector | JwtAndAgs | JwtInspector.jsx | 22 |
| `#/operations/notify` | Notification hub | OsxNotify | SemesterOSHome.jsx | 24 |
| `#/operations/feeddelivery` | Feed delivery | FdxDelivery | FeedDelivery.jsx | 20 |
| `#/operations/presence` | Presence reliability | OprPresence | OpsReliability.jsx | 23 |
| `#/operations/migrations` | Migration runner | OprMigrate | OpsReliability.jsx | 23 |
| `#/operations/guards` | Route guards | OprGuards | OpsReliability.jsx | 23 |

## Semester OS home (`os`, 8)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/os/home` | All products | OsxHome | SemesterOSHome.jsx | 24 |
| `#/os/blueprint` | Architecture blueprint | OsBlueprint | Blueprint.jsx | 24 |
| `#/os/onboard` | Role onboarding | TrxOnboard | Transition.jsx | 24 |
| `#/os/transition` | Company transition | TrxTransition | Transition.jsx | 24 |
| `#/os/system` | End-to-end blueprint | E2xSystem | EndToEnd.jsx | 24 |
| `#/os/signin` | Sign in and roles | E2xSignin | EndToEnd.jsx | 24 |
| `#/os/flows` | Demo flows | CtxFlows | Controls.jsx | 24 |
| `#/os/matrix` | Academic records matrix | RfxMatrix | RecordsFlow.jsx | 19 |

> Added 6 Oct: `#/student/brain` Semester Brain (BrnToday, OpsConsole.jsx, stream 21) is now the student’s first screen and phone Today tab.

## Student success (`success`, 4)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/success/risk` | Early alerts | OsxRisk | SemesterOSHome.jsx | 24 |
| `#/success/campaigns` | Outreach | OsxCampaigns | SemesterOSHome.jsx | 24 |
| `#/success/timeline` | Service timeline | OsxTimeline | SemesterOSHome.jsx | 24 |
| `#/success/cohorts` | Cohort programs | OsxCohorts | SemesterOSHome.jsx | 24 |

## Executive OS (`executive`, 4)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/executive/overview` | Overview | OsxExec | SemesterOSHome.jsx | 24 |
| `#/executive/forecast` | Forecast | OsxForecast | SemesterOSHome.jsx | 24 |
| `#/executive/board` | Board narrative | OsxBoard | SemesterOSHome.jsx | 24 |
| `#/executive/retention` | Retention | DpbExecRetention | DepthB.jsx | 24 |

## Club leader (`clubs`, 4)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/clubs/home` | My organization | TrxClubHome | Transition.jsx | 24 |
| `#/clubs/roster` | Roster and officers | DpbClubRoster | DepthB.jsx | 24 |
| `#/clubs/events` | Event check-in | DpbClubEvents | DepthB.jsx | 24 |
| `#/clubs/budget` | Club budget | DpbClubBudget | DepthB.jsx | 24 |

## Semester Social (desktop) (`social`, 13)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/social/home` | Home | SdxHome | SocialDesktop.jsx | 20 |
| `#/social/compose` | Create | SdxCompose | SocialDesktop.jsx | 20 |
| `#/social/video` | Video feed | SdxVideo | SocialDesktop.jsx | 20 |
| `#/social/thread` | Thread | SdxThread | SocialDesktop.jsx | 20 |
| `#/social/profile` | Profile | SdxProfile | SocialDesktop.jsx | 20 |
| `#/social/project` | Project | SdxProject | SocialDesktop.jsx | 20 |
| `#/social/reels` | Scroll feed | SvxFeed | SocialVideo.jsx | 20 |
| `#/social/comments` | Comment tree | SvxThread | SocialVideo.jsx | 20 |
| `#/social/studio` | Connected prototype | CnxStudio | SocialConnected.jsx | 20 |
| `#/social/accounts` | Accounts (mock API) | ClxAccounts | CloudAccounts.jsx | 22 |
| `#/social/tests` | Test runner | TrnRunner | TestsContract.jsx | 22 |
| `#/social/outbox` | Mixed feed + outbox | ObxFeed | Outbox.jsx | 20 |
| `#/social/analytics` | Analytics and approvals | AnxDash | FeedAnalytics.jsx | 20 |

## Semester Studio (`studio`, 31)

| Route | Screen | Component | File | Stream |
| --- | --- | --- | --- | --- |
| `#/studio/home` | Studio home | StaHome | StudioA.jsx | 21 |
| `#/studio/files` | My Work | StaFiles | StudioA.jsx | 21 |
| `#/studio/make` | Make | StaMake | StudioA.jsx | 21 |
| `#/studio/assignment` | Assignment workspace | StaAssignment | StudioA.jsx | 21 |
| `#/studio/research` | Research Studio | StbResearch | StudioB.jsx | 21 |
| `#/studio/calendar` | Calendar | StbCalendar | StudioB.jsx | 21 |
| `#/studio/assistant` | Executive Assistant | StbAssistant | StudioB.jsx | 21 |
| `#/studio/intelligence` | Intelligence | StbIntel | StudioB.jsx | 21 |
| `#/studio/policy` | AI Policy Center | StbPolicy | StudioB.jsx | 21 |
| `#/studio/course` | ECON 201 folders | StcCourse | StudioC.jsx | 21 |
| `#/studio/doc` | Document | StcDoc | StudioC.jsx | 21 |
| `#/studio/sheet` | Spreadsheet | StcSheet | StudioC.jsx | 21 |
| `#/studio/slides` | Presentation | StcSlides | StudioC.jsx | 21 |
| `#/studio/share` | Share panel | StcShare | StudioC.jsx | 21 |
| `#/studio/ask` | Assistant request gate | StcAsk | StudioC.jsx | 21 |
| `#/studio/sync` | Offline sync | StdSync | StudioD.jsx | 21 |
| `#/studio/branches` | Versions and branches | StdBranches | StudioD.jsx | 21 |
| `#/studio/math` | Math canvas | StdMath | StudioD.jsx | 21 |
| `#/studio/session` | Live session | SteSession | StudioE.jsx | 21 |
| `#/studio/grading` | Grading stream | SteGrading | StudioE.jsx | 21 |
| `#/studio/export` | Citations and export | SteExport | StudioE.jsx | 21 |
| `#/studio/tutor` | Learning Tutor | SixTutor | IntelRoles.jsx | 21 |
| `#/studio/vectors` | State vectors | SixVectors | IntelRoles.jsx | 21 |
| `#/studio/buildqueue` | Export queue | StfBuild | StudioF.jsx | 21 |
| `#/studio/gateways` | Sync gateways | StfGateways | StudioF.jsx | 21 |
| `#/studio/worker` | Worker | StfWorker | StudioF.jsx | 21 |
| `#/studio/peers` | Peer and Friend | StfPeers | StudioF.jsx | 21 |
| `#/studio/recovery` | Recovery simulator | StgSim | StudioG.jsx | 21 |
| `#/studio/litreview` | Literature review | StgLit | StudioG.jsx | 21 |
| `#/studio/presence` | Presence audit | SthAudit | StudioH.jsx | 21 |
| `#/studio/tools` | All tools | SthTools | StudioH.jsx | 21 |

