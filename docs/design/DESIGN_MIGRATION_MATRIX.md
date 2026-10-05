# Design migration matrix (phase D0)

Maps every element of the target system to what exists, the migration bucket,
and the order. Evidence is in the companion audits. Buckets:
**A** cosmetic (token or class swap) · **B** structural (header, ContextBar,
provenance, layout) · **C** workflow (needs consequence preview or
DecisionTrail) · **N** new (no UI exists).

## 1. Recommended order (changes your eight-step list in two places)

| Step | Phase | Content | Change from your order |
|---|---|---|---|
| 0 | D0 | These documents; decisions U-1..U-6; the reference PDF | |
| 1a | D1 | **One trust vocabulary** (`lib/` table, ten kinds, missing statuses, `announce`), glyph on `SourceBadge` | needs no visual decision |
| 1b | D1 | **Guards first**: hand-rolled badge, glyph/word parity, emoji, "!" , "user", icon-only tooltip, inline radius/shadow/font | moved up from step 8; they make steps 3-7 reviewable |
| 1c | D1 | Tokens, type, theme (after U-1..U-6) | |
| 2 | D2 | Shell: rail groups, system bar, tab bar polish, ⌘K, scope bar | |
| 3 | D3 | Today, Calendar, Tasks, Course workspace, Ask Semester | |
| 4 | D3 | Registration, Grades, Degree, Billing, Family | |
| 5-6 | D4 | Faculty/Advisor/Registrar/Finance; Console approvals/integrations/audit/rollout | |
| 7 | D3 tail | Community, Campus, Career, Support (Marketplace: decide whether to build) | |
| 8 | D5 | Visual regression in CI, responsive, performance | baseline tooling starts in D1 |

Principle: **adopt before restyle.** Put existing `ContextBar`, `ActionPreview`,
`DecisionTrail`, glyph-bearing `StatusChip` onto screens, then change tokens.

## 2. Tokens and foundations

| Target | Existing | Bucket | Phase | Note |
|---|---|---|---|---|
| Authoritative token source | `lib/look.ts` + `styles/tokens.css` + `design-tokens/semester.tokens.json` | B | D1 | Keep `look.ts` as authority; collapse `industry.css` scales (`--radius-*`, `--shadow-*`, `--space-*`) onto `--r-*`, `--elevation-*`, `--sp-*` |
| Ink chrome / Parchment content | grounds `ink`, `parchment` | B | D1 | Blocked on U-1, U-5 |
| Action blue | accent `industry` | A | D1 | Blocked on U-2; re-measure light value |
| Brass editorial only | accent `brass`, Source Line | A | D1 | Blocked on U-3 |
| Source/status hues | `--chart-verified/estimated/stale`, `--app-warn`, `--app-error` | B | D1 | Blocked on U-4; measure on 13 grounds |
| Type roles | `--type-role-*`, `--font-*` | A | D1 | Add `--font-mono` token (mono hard-coded ×4) |
| Shape | `--r-*`, `--shape-*` | A | D1 | Replace 32 `999px` and inline `999`/`50%` with `--shape-pill` or `--r-*` |
| Elevation | `--lift-*`, `--elevation-*`, `--glow` | B | D1 | Remove shadow from ordinary cards, keep for floating |
| Motion | `--duration-*`, `--motion-*` | A | D1 | Off-scale literals to tokens or ledger |
| Focus | `--focus-*`, `app.css:2776` | A | D1 | Unify the 3px rings and `industry.css` ring |
| Settings (calm, contrast, density, text size, reading) | `look.ts`, `Look.tsx`, `CalmSettings.tsx` | A | D1 | Already token-driven; document brand-exempt (ADR-0034, 0037) |

## 3. Components (full table in COMPONENT_INVENTORY.md)

| Target | State | Bucket | Phase |
|---|---|---|---|
| Button, IconButton | CSS family `.btn` ×654 uses; no component | B | D1 |
| TextField, Select, Choice | missing as components; `Field`, `SelectRow`, `PickChips` | B | D1 |
| Switch, Segmented, SectionLabel, Icon | exist (`Toggle`, `Segmented`, `SectionLabel`, `Icons.tsx`) | A | D1 (add tooltip rule) |
| SourceBadge | exists, word only | B | D1 |
| SourceLine | missing | N | D1 |
| StatusChip | exists, 4 call sites | B | D1-D3 |
| AIResponse | missing as a component; pieces in `ai/*`, `intelligence/Disclosure.tsx` | N/B | D3 |
| EmptyState/Loading/Error/Success/Progress/StepStatus/PermissionNotice/OfflineStrip/SaveState/Notice | exist | A | adopt in D3 |
| ObjectCard, ContextBar, NextSteps | exist; ContextBar 5 screens | B | D3 |
| ActionPreview + Dialog | `ActionPreview` 0 real uses; `ConfirmDialog` unstructured; 23 dialog implementations, ~19 share `useModal` | C | D1 (contract), D3 |
| SideRail, TabBar, SystemContextBar, CommandPalette | inline in `App.tsx` / `unity/` / `Command.tsx` | B | D2 |
| DataTable, Fields | `unity/Table.tsx`; `console/Fields.tsx` | A | D4 |
| DecisionTrail | exists as a workflow navigator, not an audit history | N | D4 |

## 4. Student surfaces

Lines are the main file. "Reg." = registered in `screens.tsx` (87 rows).

| Surface | File (lines) | Bucket | Phase | Main risk |
|---|---|---|---|---|
| Today | `screens/Today.tsx` (2146) | C | D3 | Shared home-shape logic with Springboard/Guides; no screen-level test |
| Calendar | `screens/Calendar.tsx` (3041) | C | D3 | Largest bundle; drag/keyboard tests |
| Tasks | **not found** (only `domains/tasks`) | N | D3 | Decide: build as a route or keep inside Today/Courses |
| Course workspace | `screens/Courses.tsx` (939) + `CourseDetailV2` | B | D3 | Three ids share a file; deep-link bug history (`#/course/bus`) |
| Study | `screens/Study.tsx` (1364) | B | D3 | |
| Write | `screens/Write.tsx` (2718), `Sheet.tsx` (4749) | B | D3 | Editors; focus handling |
| Grades | `screens/Grades.tsx` (505) | A/B/C | D3 | Grade numbers need provenance; no confirmation found |
| Degree | `screens/Degree.tsx` (1030) | C | D3 | Simulator preview should use `ActionPreview` |
| Advising | no route (`AdvisorMeeting.tsx`) | N/B | D3 | |
| Registration | `screens/Registration.tsx` (167), `RegistrationDay.tsx` (585) | C | D3 | Deadline-day actions |
| Career | `screens/Career.tsx` (1475) | B | D3 tail | |
| Campus | `screens/University.tsx` (1539) is institution tabs; student campus is `Maps`, `Directory`, `Athletics` | B | D3 tail | Highest error-string count |
| Dining / Housing | `Dining.tsx` (484) / `Housing.tsx` (288, no test) | A | D3 tail | |
| Billing | `Costs.tsx` → `Bill.tsx` (580), `MyStudentAccount` | C | D3 | Payments; no confirmation found |
| Family | `screens/Family.tsx` (718) | C | D3 | Consent; no shared `PermissionNotice` for sharing |
| Support | `Support.tsx`, `Help.tsx` | B | D3 tail | |
| Ask Semester | `ai/Chat.tsx` (564) | B/C | D3 | 107 KB of 116 KB route budget |
| Privacy/Data | `Privacy.tsx`, `Data.tsx` | C | D3 | |
| Accessibility | no route (`AccessibilityPanel`, unity `AccessibilityTools`) | N | D2 | Rail target lists it |
| Community | `Community.tsx` (626) + 5 | C | D3 tail | Post/report |
| Marketplace | **not found** | N | decide | |

Other registered screens not in your list (so none is forgotten): Search,
Directory, Pathway, Hub, Create, Mine, Note, Import, Update, Connect, Work,
Mail, Export, Yes, Draw, Solve, Edit, Analyse, Meet, People, Brief/Reports,
Equations, Changes, Gap, Groupwork, Call, Runway, Clocks, Behind, Activity,
Whatsnew, Recovery, Console, Item, Event, Notifs, Quiz, Guide, Drill, Guess,
Lesson, Exam, Slides, Deck, Essay, Paper, Springboard, Guides, Onboarding,
settings ×9. Each inherits the shell H1 and needs only the bucket-B header work
unless it owns an irreversible action.

## 5. Staff and console surfaces

| Surface | Where | Bucket | Phase |
|---|---|---|---|
| Faculty gradebook | `screens/Gradebook.tsx`, `gradebook/InstructorBook.tsx` (558) | C | D4 |
| Advisor workspace | `AdvisorMeeting.tsx`; no staff caseload screen | N/C | D4 |
| Registrar desk | `enrollment/RegistrarDesk.tsx` (379), `OfficeActionDesk.tsx` | C | D4 |
| Finance / student accounts | `institutional/StudentAccounts.tsx` (688) | C | D4 (highest risk: money) |
| Student affairs / campus ops | `institutional/OperationsStudio.tsx` (aggregates only) | B | D4 |
| Console shell | `screens/Console.tsx`, `console/*` | A/B | D4 (reference implementation) |
| Approvals / Break-glass | `console/Approvals.tsx`, `BreakGlass.tsx` | C | D4 |
| Audit log | `console/Audit.tsx` (85) | B | D4 (mono refs) |
| Integrations | `institutional/IntegrationDashboard.tsx` (413) | B/C | D4 (trust level missing) |
| Tenant settings / modes | `ModulesPanel.tsx`, `ConfigurationStudio.tsx` | C | D4 |
| Rollout / implementation | **no UI** (docs and scripts only) | N | decide |
| Tenant audit viewer | **none**; `auditEventCount: 0` hard-coded at `University.tsx:~848` | N | decide |

## 6. Dependencies

- Everything visual waits on U-1..U-6.
- D2 rail waits on the `complexity-budgets.json` bump (63 destinations).
- D3 `Tasks`/`Advising`/`Accessibility` routes wait on a "build or fold in" call.
- D4 `DecisionTrail` as an audit history needs a data source; today only
  `familyshare.readLog`, `SupportAccess`, and console `audit.read` exist.
