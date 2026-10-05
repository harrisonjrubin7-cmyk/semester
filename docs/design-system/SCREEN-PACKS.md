# Screen packs — the seven questions, for the 18 named screens

> Status: **specification.** This page does not draw screens. It says, for each of the 18 screens the brief names, which component answers each of the seven questions, where the screen lives in the app today, and where its prototype lives in the Claude Design handoff kit (`ui_kits/…`). "No screen of this name" is a finding, not a placeholder: the screen is a gap and is listed in §4.

## 1. The seven questions and who answers them

Every screen answers all seven, with the same components in the same order (Layer 1 → 2 → 3, `PROGRESSIVE-DISCLOSURE-RULES.md`).

| Question | Component | Layer |
|---|---|---|
| Where am I? | `PageHeader` (kicker, title, purpose) inside `SystemContextBar` (location, term, sync) | 1 |
| What matters now? | `NextSteps` / one `ObjectCard` with the single primary action | 1 |
| What can I do? | One primary `Button`; `QuickActions` for the rest; consequence via `ActionPreview` | 1–2 |
| What is official? | `SourceBadge` (official) + `SourceLine` beside each fact; `OpenIn` to the system of record | 1–2 |
| What is stale or uncertain? | `SourceBadge` stale/estimated/review + age in `ProvenanceChips`; `AIResponse` confidence | 1–2 |
| Who can help? | `SupportHandoff` (office, hours, reference); advisor via `AskAHuman` | 2 |
| Where can I go deeper? | `ScreenGuide`, `DecisionTrail`, `PolicyBadge`, `DataTable` | 3 |

A screen that cannot name a component for a row has a gap in that row; §3 records them.

## 2. The 18 screens

"App" paths are under `app/src/`. "Kit" paths are under `ui_kits/` in the handoff. A dash means none was found by name.

| # | Screen | Pack | App implementation | Kit prototype |
|---|---|---|---|---|
| 1 | Today dashboard | Student OS | `screens/Today.tsx`, `components/TodayActionCenter.tsx` | `student/Today.jsx` |
| 2 | Action Center | Student OS | `components/ActionCenter.tsx` | catalogued only (`master-catalog`, `one-place`); archetype in `every-screen` |
| 3 | Academic Path | Planning | `screens/Degree.tsx`, `screens/Pathway.tsx` | `student/Degree.jsx` |
| 4 | Term Plan | Planning | **no screen of this name**; plans live in `screens/Registration.tsx` + `lib/registration.ts` | `student/Registration.jsx`, `student/Calendar.jsx` |
| 5 | Registration Readiness | Planning | `components/RegistrationReadiness.tsx`, `screens/Registration.tsx` | `student/Registration.jsx` |
| 6 | Course Home | Student OS | `components/CourseDetailV2.tsx`, `screens/Courses.tsx` | `student/Course.jsx` |
| 7 | Course Studio | Course Studio | `components/CourseStudio.tsx` | `staff/Faculty.jsx` |
| 8 | Student AI Copilot | Student OS | `ai/Chat.tsx`, `ai/Turns.tsx`, `ai/Actions.tsx` | `student/Assistant.jsx` |
| 9 | Support Center | Success/support | `screens/Support.tsx`, `components/SupportAccess.tsx`, `AskAHuman.tsx` | `student/HelpSupport.jsx` |
| 10 | Advisor Caseload | Success/support | **no screen of this name**; nearest `components/AdvisorMeeting.tsx`, `AdvisorSharedView.tsx` | `staff/Advisor.jsx` |
| 11 | Registrar Console | Control plane | `screens/Registrar.tsx` | `staff/Registrar.jsx` |
| 12 | Tenant Overview | Control plane | **no screen of this name**; nearest `components/institutional/ControlPlane.tsx`, `console/Customers.tsx` | `console/ConsoleApp.jsx`, `console/Screens.jsx` |
| 13 | Operations Inbox | Operations | **no screen of this name**; nearest `console/SupportQueue.tsx`, `console/Approvals.tsx`, `institutional/FlightPlanInbox.tsx` | `console/SupportQueue.jsx`, `console/Approvals.jsx` |
| 14 | Trust Center | Public/trust | `screens/TrustRoom.tsx`, `institutional/TrustDashboard.tsx`; policy in `docs/TRUST-CENTER.md` | `compliance/Compliance.jsx` |
| 15 | Institutional Pilot page | Public/sales | **none in the app**; copy source `docs/PILOT.md`, `docs/PAID-PILOT-FRAMEWORK.md`; public site `company-site/index.html` | `company-site/Pages.jsx`, `business/Pilot One-Pager.html` |
| 16 | Marketing homepage | Public/sales | `company-site/index.html`, `site.css` | `company-site/Site.jsx` |
| 17 | Mobile navigation | Shell | `App.tsx` `TabBar`, `lib/tabbar.ts` | `mobile/MobileApp.jsx`, component `TabBar` |
| 18 | Desktop navigation | Shell | `App.tsx` `Rail`, `lib/nav.ts`, `components/nav/*` | component `SideRail`, `SystemContextBar` |

## 3. What each screen answers, by row

Cells name components. **Gap** marks a row with no component today.

| Screen | Where am I | What matters now | What can I do | What is official | Stale / uncertain | Who can help | Deeper |
|---|---|---|---|---|---|---|---|
| Today dashboard | `PageHeader` + term in `SystemContextBar` | One `ObjectCard` from the Action Center ranking | Primary on that card; `QuickActions` | `SourceBadge` official on each dated item | Age via `ProvenanceChips`; sync via `SaveState` | `SupportHandoff` footer | `NextSteps`, link to Action Center |
| Action Center | `PageHeader` "Action Center" | Ranked `ObjectCard` list; first is the decision | Primary per card; Done/Snooze with `UndoToast` | `SourceLine` per action origin | Estimated vs official separated by `SourceBadge` | `AskAHuman` per card | `DecisionTrail` of what was done, `ScreenGuide` for ranking |
| Academic Path | `PageHeader` + program in `ContextBar` | Next requirement unmet | "Plan this" → Term Plan | `SourceBadge` official for audited requirements | Estimated progress carries assumptions (`Fields`) | Advisor via `AskAHuman` | `DataTable` of requirements; `DecisionTrail` of changes |
| Term Plan | `PageHeader`; plan name in `ContextBar` | Conflicts first | Save plan; compare plans | Official sections vs student-entered (`SourceBadge`) | Section data age in `ProvenanceChips` | Advisor / registrar `SupportHandoff` | `DataTable` of sections. **Gap: no named screen** |
| Registration Readiness | `PageHeader`; registration window in `Notice` | Holds and prerequisites that block today | One primary per blocker; `ActionPreview` before any official step | Registrar-owned items `official`; `OpenIn` registrar | Estimated eligibility labelled; stale holds flagged | `SupportHandoff` registrar with hours | `StepStatus` of readiness; `PolicyBadge` |
| Course Home | `ContextBar` (course, term, section) | Next due item | Open material; ask | Syllabus `official`; student notes `personal` | Imported LMS data with age | Instructor/TA contact; `AskAHuman` | `DataTable` grades; `ScreenGuide` |
| Course Studio | `PageHeader` + course in `ContextBar` | Unpublished changes | Publish via `ActionPreview` (names who sees it) | Published vs draft word on each item; `PolicyBadge` for integrity policy | AI-drafted content marked `ai`; unreviewed flagged | Instructional designer `SupportHandoff` | `DecisionTrail` of edits; version history. `ApprovalBanner` when review required |
| Student AI Copilot | `PageHeader`; data scope listed in `AIResponse` | The answer plus its limits | Follow-ups; actions open `ActionPreview` | `sources[n]` with kind; "not official" stated | `confidence`; "could not find in your sources" | `AIResponse` handoff to human office | `PolicyBadge` for AI policy; source anchors |
| Support Center | `PageHeader` "Support" | Open request status | Start request; `SupportHandoff` | Office hours/policies `official` | Last staff update age | Named office + reference | `DecisionTrail` of the request |
| Advisor Caseload | `PageHeader` + cohort in `ContextBar` | Students needing contact today (`HealthBadge` with driver) | Message/schedule via `ActionPreview` (consent shown by `ConsentBadge`) | `SourceBadge` per field; consent gate | Data age per student; `HealthBadge` unknown band | Escalate: `SupportHandoff` student support | `DataTable`; `DecisionTrail`. **Gap: no named screen** |
| Registrar Console | `PageHeader`; term + environment in `SystemContextBar` | Exceptions awaiting decision | Decide with `ActionPreview`; `ApprovalBanner` | System-of-record rows `official` | Sync age; conflicts as `SaveState` Conflict | Registrar lead; audit contact | `DecisionTrail`; `DataTable` |
| Tenant Overview | `PageHeader` + tenant/environment | Health band and the top driver | Open the one failing area | Contract/config `official`; connector health as freshness | Connector age; `HealthBadge` unknown | Support/CSM `SupportHandoff` | `DataTable`; `PolicyBadge`. **Gap: no named screen** |
| Operations Inbox | `PageHeader` + queue scope | Oldest breaching item | Claim, resolve, escalate (`ActionPreview` for customer-visible) | Policy-tagged items (`PolicyBadge`) | Item age vs SLA as word | On-call `SupportHandoff` | `DecisionTrail`. **Gap: no named screen** |
| Trust Center | `PageHeader` "Trust" | What data is used and who sees it | Open a policy; request evidence | Evidence `official` with date; claims only from the approved register | Unverified claims are not shown (`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`) | Security contact `SupportHandoff` | `PolicyBadge`, subprocessors, `DecisionTrail` of changes |
| Institutional Pilot page | `PageHeader` | What a pilot is and costs | Request a pilot (form with `ErrorSummary`) | Only claims in the approved register | Pilot figures labelled `sample` unless measured | Named contact | Pilot framework doc. **Gap: no page in the app** |
| Marketing homepage | Wordmark + nav | One-sentence position | One primary: request a pilot | Customer/compliance claims only if approved | n/a — no live data; no unsupported claims | Contact | Trust Center, Pilot page |
| Mobile navigation | `TabBar` current item | n/a (chrome) | Five labelled destinations; search | Same destinations as desktop (parity) | Offline state in `SystemContextBar` | Support is a tab | `CommandPalette`/search for the rest |
| Desktop navigation | `SideRail` `aria-current` + `SystemContextBar` | n/a (chrome) | Groups; `CommandPalette` | Same destinations as mobile | Sync state | Support in rail | Collapsed ≥840; all capabilities reachable |

## 4. The seven packs and what is missing

| Pack | Screens | Missing |
|---|---|---|
| Student OS | Today, Action Center, Course Home, AI Copilot | Action Center kit prototype is archetype-only; no composed `AIResponse` app component |
| Planning/registration | Academic Path, Term Plan, Registration Readiness | Term Plan is not a named screen |
| Course Studio | Course Studio | Review/approval state (`ApprovalBanner`) not wired on publish |
| Student success/support | Support Center, Advisor Caseload | Advisor Caseload is not a named screen |
| Institutional control plane | Registrar Console, Tenant Overview | Tenant Overview is not a named screen |
| Operations command center | Operations Inbox | One inbox view across queues does not exist |
| Public company/sales/trust | Trust Center, Pilot page, Marketing homepage | Pilot page not built; every claim on it must pass the claims register |

Each gap above is a decision for the owner, not something this page builds. Building any of them follows `/build-semester-ui`: search `components/ui.tsx`, `components/unity/`, the gallery and the nearest screen first, and add no new shared component without the case in `GOVERNANCE.md` §2.
