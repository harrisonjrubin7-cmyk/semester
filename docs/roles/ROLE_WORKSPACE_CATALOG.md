# Role workspace catalog

**As of** 2026-10-05 · **Part of** [`ROLE_SYSTEM_MASTER_MAP.md`](ROLE_SYSTEM_MASTER_MAP.md) · **Status** audit evidence.

**Finding.** Production has one shell: a student-oriented navigation of seven areas (today, plan, learn, help, campus, progress, you; `app/src/lib/navareas.ts`) with a five-destination bar (`lib/tabbar.ts`). Staff capabilities appear as tabs inside the University screen or as separate screens reachable by typed hash. A seven-workspace "institutional" shell and twelve role workspaces exist only behind the build flag `VITE_INSTITUTIONAL_PREVIEW`, over synthetic fixtures that authorize nothing (`components/institutional/RoleWorkspace.tsx`; `lib/oneos.ts` says "Preview only").

Do not read a row below as "the workspace exists for that role". Read the *Where it lives today* column.

| Workspace | Roles | Where it lives today | Class |
| --- | --- | --- | --- |
| Student OS | student family | `screens/Today.tsx`, `Registration.tsx`, `Degree.tsx`, `Support.tsx`, `Family.tsx`, `Privacy.tsx` | Native and verified for local-first logic; official data depends on unbuilt sync |
| Applicant | prospective, admitted | `screens/Applying.tsx`, `Launchpad.tsx`; student carousel | Native but incomplete |
| Faculty / Course Studio | faculty, TA | `Gradebook.tsx` (flag off at every school), `components/CourseStudio.tsx` inside `Account.tsx` | Native but incomplete; no shell |
| TA workspace | teaching_assistant | Gradebook entry only; `grades:enter` is granted to `teaching_assistant` (`supabase/migrations/20260929310000_gradebook.sql` line 83). No TA-specific screen, assigned-work queue or discussion moderation exists | Native but incomplete |
| Advisor | academic_advisor | `AdvisorMeeting.tsx` (student side) and `AdvisorSharedView.tsx` (advisor read) | Native but incomplete; caseload not started |
| Registrar | registrar | `Registration.tsx` Registrar tab (`RegistrarDesk.tsx`), `OfficeActionDesk.tsx` in `Registrar.tsx` | Native but incomplete; `Registrar.tsx` itself is a student term planner |
| Institution control plane | university_admin, integration_admin | `University.tsx` tabs (Modules, Configuration, Workflows, Integrations, Migration, Control, Academic record, Student accounts) | Mixed; `ControlPlane.tsx` hard-codes consent and audit counts to 0 (RG-17) |
| Student accounts / finance | student_accounts_officer, business_admin | `components/institutional/StudentAccounts.tsx` tab | Native but incomplete |
| Campus services | dining_staff, residence_life_staff, others | `Dining.tsx`, `OfficeActionDesk` | Dining native; others publish-only |
| Community / safety | moderator, trust_safety_* | `Moderation.tsx`, `Volunteers.tsx`, `Agreements.tsx`, `components/community/Escalation.tsx` | Supportable (moderator, reviewer) |
| Career / employer | career_*, employer | `ListingDesk.tsx`, `Opportunities.tsx` | Usable |
| Family / guardian | grant-based | `Family.tsx` (permission plans saved on the device only) | Static prototype only for the plans; grants native |
| Operations Command Center | platform_admin, support_agent, incident_responder, trust_officer | `Console.tsx` and `components/console/*` | Native but incomplete; see below |
| Developer / partner | none | none | Not started |
| Board / investor | none | none | Not started |

## Operations Command Center today

Tabs: Command center, Support (needs `support:ticket` and the support flag), Approvals, Break-glass, Audit, Customers, Figures, Finance model, Releases and flags, Launch readiness (read-only record of the twelve launch gates and council seats, added on main after this audit began; it cannot clear a gate), Evidence, Views. Gated by `console:operate` read from `my_capabilities()`; the database enforces.

Not present: Inbox, My Work, Tenant directory and Tenant 360, Pilot workspace, Implementation, Customer health, Integration operations, Security, Privacy, Access reviews, Incidents, Vendors, People, Board, Partners, Developers. Tables exist for pilots (`gtm_pilots`, `gtm_pilot_metrics`), implementation (`implementation_projects`, `implementation_milestones`) and customer success (`success_plans`, `qbrs`, `renewal_opportunities`, `account_health_snapshots`) with no console view reading them.

## Staff tab gating

`University.tsx` builds its tab list per render from `my_capabilities()` through `forSchool()`, which keeps grants scoped exactly to the school and drops platform scope. A tab is hidden when the capability is missing; there is no explanation shown. Gates are client-side display; each RPC re-checks in the database (UNVERIFIED for each function; the definer sweep and `definer-sweep.check.sql` hold the class).

## Shell components found

`SystemContextBar`, `ContextBar`, `ObjectCard`, `ActionPreview`, `NextSteps`, `DecisionTrail`, `Table`, `States` (`LoadingState`, `ErrorState`, `PermissionNotice`), `ModuleGateState`, `ReadState` under `components/unity/` and `components/`. No component named `AppShell`, `SideRail` or `PageHeader` exists. Per `CLAUDE.md` a new shared shell component needs the case in `docs/design/GOVERNANCE.md` §2.
