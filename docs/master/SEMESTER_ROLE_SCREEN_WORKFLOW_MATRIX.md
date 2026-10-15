# Role × screen × workflow matrix (PDF targets vs code)

**As of** 2026-10-05 · **Status** Phase 0. Built from greps and listings; "by name" rows mean the requested export name was not found, not that no equivalent exists.

## 1. PDF primary navigation by role → repository

| Role | PDF navigation | Repository |
| --- | --- | --- |
| Student | Today, Plan, Learn, Help, Campus, Progress, You | `lib/navareas.ts` has exactly these 7 areas |
| Faculty | Courses, Gradebook, Students, Content, Office Hours, Insights | `screens/Gradebook.tsx`, `OfficeHours.tsx` (student display only); no faculty shell found |
| Advisor | Caseload, Students, Plans, Support, Appointments, Outcomes | caseload/check-in/success-plan steps: nothing built (`SEMESTER_GAP_REGISTER.md`) |
| Registrar | Terms, Catalog, Registration, Records, Rules, Reports | `screens/Registrar.tsx`; `registration_*`, `academic_record_*` tables and RPCs exist |
| Finance | Accounts, Requests, Reconciliation, Plans, Holds, Reports | `student_account_*`, `student_payment_plan*` tables; screens `Bill.tsx`, `Costs.tsx` (student side) |
| Institution admin | Overview, People, Policies, Features, Integrations, Audit | `screens/Console.tsx`, `University.tsx`; `tenant_*`, `school_*` tables |
| Semester operator | Overview, Inbox, Approvals, Tenants, Customers, Support, Trust | Console (§2) |
| Investor / Employer / Guardian / Partner | per PDF | Family (`family_*`, `guardian_*`) and `Opportunities.tsx` exist; no investor, employer or partner portal found |

## 2. Operations Command Center (PDF's 31 items)

Console tabs today (`screens/Console.tsx`): Command center, Approvals, Break-glass, Audit, Customers, Figures, Finance model, Releases and flags, Evidence, Views; plus Support when the operator holds `support:ticket`.

| Status | Items |
| --- | --- |
| Exists | Executive overview, Approvals, Break-glass, Audit explorer, Releases, Finance/runway, Operator preferences, Support ops (flag-gated) |
| Partial | Operations Inbox, Customer 360, GTM accounts, Customer health, Revenue/billing, Trust/compliance, Incidents (static playbooks), Risks (static), Forecasts |
| Missing | My Work, Tenant directory, Tenant 360, Pilot workspace, Implementation, Integration ops, Privacy, Security, Access reviews, SLOs, Error budgets, Vendors, Board/investor reports, Capacity/hiring |

## 3. Components requested by the PDFs (51)

Found under the requested name (18): SystemContextBar, ContextBar, SourceBadge, StatusChip, Segmented, Combobox, DateField, ErrorSummary, EmptyState, LoadingState, ErrorState, SuccessState, ObjectCard, NextSteps, ActionPreview, FocusBar, Fields, DecisionTrail.

Equivalent exists under another name (candidates, not confirmed): Button/IconButton → `ActionButton` (`ui.tsx`); Switch → `Toggle`; Dialog → `ConfirmDialog`; DataTable → `unity/Table.tsx`; UndoToast → `Undone.tsx`; OfflineState → `OfflineBanner.tsx`; ForbiddenState → `ModuleGateState.tsx`; VisibilityPicker → `unity/Visibility.tsx`; SourceLine → `unity/ProvenanceChips.tsx`; SupportHandoff → `GetHelp.tsx`/`AskAHuman.tsx`; TabBar → `lib/tabbar.ts`; ApprovalBanner → `console/Approvals.tsx`; ReleaseGate → `console/Releases.tsx`.

Not found, no equivalent identified: AppShell (`components/shell/` exists but exports none by that name), SideRail, PageHeader, CommandPalette (`Command.tsx` is a candidate), TextField, Select, Choice, AuthorityBadge, FreshnessBadge (`Fresh.tsx` candidate), PolicyBadge, ConsentBadge, HealthBadge, DecisionCard, MetricTile, ProvenanceChart, AIResponse, CitationPanel, AIContextPanel.

Per `CLAUDE.md` a new shared component needs the case made in `docs/design/GOVERNANCE.md` §2. Renaming existing components to match the PDF is not a goal; mapping names is (see PR #1304's crosswalk).

## 4. Workflows

The 17-workflow, 319-step catalog is `SEMESTER_WORKFLOW_CATALOG.md`; the build status per step is `SEMESTER_GAP_REGISTER.md` (203 not fully built, 75 with nothing built).
