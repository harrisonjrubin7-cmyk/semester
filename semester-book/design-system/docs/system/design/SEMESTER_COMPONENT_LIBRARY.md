# Component library

_Semester design, intelligence, workflow and data system · 2026-10-05 · Source: uploads/expand further on brand identy algorthims workflow.pdf, reconciled with this design system (readme.md, tokens/, components/). Where they differ, this design system wins and the difference is listed._

> Semester should make an institutionally complex world feel personally clear.

Required shared components mapped to this design system (`components/`, namespace `SemesterDesignSystem_e9f3ba`).

| Required | In this system | Status |
| --- | --- | --- |
| AppShell | Shell templates (student-screen, console-screen, platform-shell) | Have |
| ContextBar | ContextBar, SystemContextBar | Have |
| GlobalNavigation | SideRail | Have |
| MobileNavigation | TabBar | Have |
| GlobalSearch / CommandPalette | CommandPalette | Have |
| PageHeader | PageHeader | Have |
| SourceBadge | SourceBadge | Have |
| FreshnessBadge | SourceBadge updated prop + freshness.ts | Partial |
| AuthorityBadge | SourceLine by/authority | Partial |
| PolicyBadge | PolicyBadge | Have |
| ConsentBadge | ConsentBadge (+ VisibilityPicker input) | Have |
| StatusBadge | StatusChip | Have |
| HealthBadge | HealthBadge | Have |
| RiskBanner | Notice | Partial |
| ActionCard | ObjectCard | Have |
| ActionCenter | NextSteps | Have |
| WorkflowStepper | StepStatus | Have |
| DecisionCard | ActionPreview + Dialog | Have |
| EvidenceDrawer | Sheet + SourceDetails | Have |
| AuditTimeline | DecisionTrail | Have |
| DataTable | DataTable | Have |
| EmptyState / LoadingState / ErrorState | EmptyState, LoadingState, ErrorState | Have |
| OfflineState | OfflineStrip | Have |
| ForbiddenState | PermissionNotice | Have |
| SupportHandoff | SupportHandoff | Have |
| AIAnswerPanel | AIResponse | Have |
| CitationPanel | ProvenanceChips | Have |
| ActionPreview | ActionPreview | Have |
| ApprovalBanner | ApprovalBanner | Have |
| FormField | TextField, Select, Combobox, DateField, Choice, Switch | Have |
| ErrorSummary | ErrorSummary | Have |
| Modal | Dialog, Sheet | Have |
| Toast | UndoToast | Have |
| NotificationCenter | Student Notifications screen | Pattern only |

**Gaps closed (Oct 2026):** PolicyBadge, ConsentBadge, HealthBadge, SupportHandoff, ApprovalBanner, ErrorSummary, PageHeader in components/governance/.

## Every component defines

Semantic token usage · accessibility requirement · responsive behaviour · loading/empty/error/offline/forbidden states · analytics event · source/freshness display · test coverage. Recorded in each component's `.prompt.md` and `.d.ts`.

Modules may not invent their own colours, spacing, status vocabulary, permission behaviour or source labels.
