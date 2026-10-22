repo: harrisonjrubin7-cmyk/semester
branch: main
path: app/src

## Last sync
date: 2026-10-05T03:38:34Z

### Upstream since last sync
- `docs/design-system/` (FIGMA-MAPPING, README, BASELINE) and `workflow-lab/` (Next.js app) have landed.
- Not yet in repo: `.mcp.json`, the three new skills, `app/scripts/design-system-*`, baseline JSON.
- No `--source-*` / Semester-blue tokens in `app/src/styles` — this project's source palette remains a proposal.

## Previous sync
date: 2026-10-05T00:49:21Z

### Updated in this project
- Seven navigation areas and App directory from lib/navareas.ts + screens.tsx
- 14 new student screens (Calendar, Study, Write, Sheets, Decks, Mail, Connect, Settings, Privacy, Support, Community, Maps, Notifications, Me)
- TA, Student affairs, Security operations, Support queue; new External audiences kit

## Sync history
- 2026-10-04T21:30:28Z — voice/naming, SourceLine, student + staff + mobile kits
- 2026-10-04T21:10:19Z — initial tokens, components, Student + Console kits

## Screen map
| Project screen | Repo files |
| --- | --- |
| ui_kits/student — Today | app/src/components/StartToday.tsx, components/unity/ObjectCard.tsx, unity/NextSteps.tsx |
| ui_kits/student — Course | components/unity/ContextBar.tsx, unity/Table.tsx, SourceBadge.tsx |
| ui_kits/student — Assistant | components/unity/States.tsx, unity/ActionPreview.tsx, lib/source.ts |
| ui_kits/student — Family | components/unity/Visibility.tsx, unity/DecisionTrail.tsx |
| ui_kits/student — Shell | components/desk/Sidebar.tsx, unity/SystemContextBar.tsx |
| ui_kits/console — Approvals | components/console/Approvals.tsx, console/Fields.tsx |
| ui_kits/console — Shell/Overview/Audit | components/console/ContextBar.tsx, console/Audit.tsx, institutional/IntegrationDashboard.tsx |
| ui_kits/student — Registration | app/src/components/enrollment/StudentRegistration.tsx |
| ui_kits/student — Grades | app/src/components/gradebook/StudentGrades.tsx |
| ui_kits/student — Advising | app/src/components/AdvisorMeeting.tsx |
| ui_kits/student — Degree, Billing, Career | docs/BRAND-PLATFORM.md, components/CareerEvidence.tsx (not read in full) |
| ui_kits/staff — Faculty | app/src/components/gradebook/InstructorBook.tsx |
| ui_kits/staff — Advisor | app/src/components/AdvisorMeeting.tsx, AdvisorSharedView.tsx |
| ui_kits/staff — Registrar, Finance | enrollment/RegistrarDesk.tsx, institutional/StudentAccounts.tsx |
| ui_kits/mobile | lib/look.ts (NAVS tabs), docs/BRAND-PLATFORM.md §1.8 |
| ui_kits/student — App directory, areas | app/src/lib/navareas.ts, app/src/screens.tsx |
| ui_kits/student — Calendar, Study, Write, Sheets, Decks, Mail, Connect, Settings, Privacy, Support, Community, Maps, Notifications, Me | app/src/screens/* (names + areas only; layouts composed from shared primitives) |
| ui_kits/staff — TA, Student affairs | gradebook/InstructorBook.tsx, docs/BASIC-NEEDS-NAVIGATOR.md (not read) |
| ui_kits/console — Security, Support queue | console/BreakGlass.tsx, console/SupportQueue.tsx (not read in full) |
| ui_kits/external | docs/BRAND-PLATFORM.md §1.1, §3 |
| handoff/claude-code-toolkit | lib/tokenexport.ts, docs/DESIGN-TOKENS.md, styles/hex.test.ts, design-tokens/semester.tokens.json, .claude/skills/ |
| ui_kits/workflow-lab, handoff/workflow-router-app | uploads/list every artifact and thing for claud to genrate.md (spec), live site https://harrisonjrubin7-cmyk.github.io/semester/ |
| ui_kits/architecture | uploads/arch-map.pdf, cqrs.pdf, sim.pdf, chatgpt.pdf (specs, not repo code) |
| tokens/* | app/src/styles/tokens.css, industry.css, unity.css, typefaces.css, lib/look.ts |
