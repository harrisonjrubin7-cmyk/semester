# Component inventory (phase D0)

`app/src/components/` has 430 entries (396 top-level `.tsx`), plus subfolders
`unity/`, `console/`, `nav/`, `shell/`, `desk/`, `academic/`, `mail/`, `room/`,
`toolkit/`, `institutional/`, `gradebook/`, `enrollment/`. There is no single
library. The nearest is the **unity layer** (`components/unity/`) and the
primitives file `components/ui.tsx`. Counts: 2026-10-04, `c170dcd`, grep.

## 1. Target library mapped to what exists

| Target | Exists as | Path | Tests | Gallery story | Action |
|---|---|---|---|---|---|
| Button | CSS family `.btn` (+ `-primary`, `-icon`, `-ghost`, `-secondary`, `-block`), 654 JSX uses; `ActionButton` | `styles/app.css`; `ui.tsx:877` | taps tests | no | **New** thin component over the classes |
| Icon | `Icons.tsx` (105 exports, 108 shapes in `icons.data.ts`); `{size, className, style}`, always `aria-hidden` | `components/Icons.tsx` | `scripts/icons.mjs` | no | Keep |
| IconButton | CSS `.btn-icon` only | | labels lint | no | **New**; requires `aria-label` + tooltip |
| Wordmark / Mark | `Brand.tsx` (`Mark`, `Wordmark`), `MarkClass.tsx`, `mark.data.ts` | `components/Brand.tsx` | | no | Keep |
| SectionLabel | `ui.tsx:23` (renders `<h2>`) | | | no | Keep |
| TextField | `Field` (`academic/Form.tsx:28`), `FieldMessage`, raw `.input` | | `a11y/fielderror.test.ts` | no | **New** wrapper: label + hint + error association |
| Select | `SelectRow` (`shell/Rows.tsx:481`), `unity/Combobox.tsx` | | Combobox axe | yes (Combobox) | Wrap |
| Choice | `PickChips` (`ui.tsx:291`), `ChipRow`, `TickBox` | | | no | **New** |
| Switch | `Toggle` (`ui.tsx:504`) | | | no | Rename/alias |
| Segmented | `ui.tsx:343` | | | no | Keep |
| SourceBadge | `components/SourceBadge.tsx` — word only | | `SourceBadge.test.tsx`, `decisionlabels.test.ts` | no | **Change**: glyph + word |
| SourceLine | none | | | | **New** (Source Line is a BRAND-PLATFORM §2.6 device) |
| ProvenanceChips | `unity/ProvenanceChips.tsx` | | `ProvenanceChips.test.tsx` | yes | Keep; 2 call sites |
| StatusChip / SaveState | `unity/Status.tsx:14,34`; `SyncState:65`, `useOffline:52` | | `lib/unity.test.ts` | no | Add `announce`, `role="status"` |
| AIResponse | none; pieces in `ai/Chat.tsx`, `ai/Turns.tsx`, `ai/Actions.tsx`, `intelligence/Disclosure.tsx` | | no `Chat` test | no | **New** composed component |
| EmptyState | `ui.tsx:743` (40 importing files) | | | no | Keep |
| LoadingState / ErrorState / SuccessState | `unity/States.tsx:24,46,93` | | | no | Keep |
| ProgressState | `Progress` `unity/States.tsx:131`; `Meter` `ui.tsx:586` | | | no | Merge |
| StepStatus | `unity/States.tsx:194` | | | no | Keep |
| PermissionNotice | `unity/States.tsx:213` | | | no | Keep; adopt for family |
| OfflineStrip | `unity/States.tsx:241`; `OfflineBanner.tsx` | `OfflineBanner*.test.tsx` | | no | Merge |
| Notice | `ui.tsx:697`; `StatusNotice`, `AbsenceNotices`, `AgeBanner`, `ReadOnlyBanner` | | | no | Merge |
| ObjectCard | `unity/ObjectCard.tsx` (+ `GridCard.tsx`) | | | yes | Keep |
| ContextBar | `unity/ContextBar.tsx`; `console/ContextBar.tsx` | | | no | Rename console one `ScopeBar` |
| NextSteps | `unity/NextSteps.tsx` | | | no | Keep |
| ActionPreview | `unity/ActionPreview.tsx` (subject, says, exactly, doesNotChange, subjectTo, recovery, provenance); no "who can help" | | axe test | yes | **Add `whoCanHelp`**; adopt |
| Dialog | none by name; `ConfirmDialog.tsx`, `a11y/modal.ts` `useModal` (focus trap, Escape, focus return) | | `a11y/modal.test.ts` | no | **New** `Dialog`; 23 implementations to fold |
| SideRail | inline `Rail` in `App.tsx:986` | | `mediumrail.test.tsx` | no | **Extract** (D2) |
| TabBar | inline `TabBar` in `App.tsx:610`; `lib/tabbar.ts` | | `tabbar.test.ts` | no | **Extract** |
| SystemContextBar | `unity/SystemContextBar.tsx` (90) | | `SystemContextBar.navigation.test.tsx` | no | Keep; add env/tenant on staff |
| CommandPalette | `Command.tsx` (1321) | | | no | Keep; rail entry |
| DataTable | `unity/Table.tsx`; `DecisionTable.tsx` | | axe | yes | Keep |
| Fields | `console/Fields.tsx` only | | | no | Promote |
| DecisionTrail | `unity/DecisionTrail.tsx` (31) — workflow stepper | | `DecisionTrail.test.tsx` | no | **New** audit-history component; rename stepper |

## 2. Duplicates (measured)

| Pattern | Count | Evidence |
|---|---|---|
| Modal/dialog/sheet | 23 files | `rg -l 'role="(alert)?dialog"\|aria-modal\|<dialog'` |
| Chip/badge | 9 implementations | StatusChip, ProvenanceChips, SourceBadge, StatusBadge, ChipRow, PickChips, Chips, BookmarkChips, DeadlinePicker `Chip` |
| Tab lists | 3 | `ui.tsx` TabList, `Tabs.tsx`, tablist tests |
| Offline notice | 2 | `OfflineBanner`, `OfflineStrip` |
| Notice/banner | 11 files | `*Banner\|*Notice\|*Callout` |
| Empty state | 1 shared + ad-hoc `.empty*` (3 CSS selectors) | 45 files mention |
| ContextBar | 2 | unity, console |
| `.btn` families | 5 modifiers + `ActionButton`, `PrintButton`, `RecordButton`, `.appicon`, `.institutional-nav-button`, `.institutional-journey-button`, `.journey-card` | |

## 3. Specimen coverage

`app/src/gallery/` (286 lines): `stories.tsx` has 6 stories, all in `unity/`:
ProvenanceChips, Table, Combobox, DateField, ActionPreview, ObjectCard.
`gallery.test.tsx` asserts every story renders and every file in
`components/unity/` has a story or an explicit exemption (exemption list not
read). Uncovered unity files: `States`, `Status`, `SystemContextBar`,
`DecisionTrail`, `NextSteps`, `ContextBar`, `ReadState`. `scripts/gallery-shots.mjs`
screenshots against a runner-made baseline and is **not in CI**.

## 4. Adoption counts (why this is an adoption problem)

| Component | Real call sites |
|---|---|
| `SourceBadge` | ~33 files |
| `StatusChip` | 4 (`ContextBar`, `UnityLayer`, `NotOfficial`, `TodayDecisionSurface`) |
| `ProvenanceChips` | 2 (`ObjectCard`, `ActionPreview`) |
| `ContextBar` (unity) | 5 screens |
| `ActionPreview` | 0 outside the gallery |
| `DecisionTrail` | 1 (`SystemContextBar`) |
| `States` (Loading/Error/Success…) | 5 screens |
| `ConfirmDialog` | ~16 components; `useConfirm` in Dining |
| `lib/source` | 3 screens (Today, Calendar, Mine) |
| `lib/status` | 2 screens (Courses, Guide) |

## 5. Contract each component must meet (for D1 tests)

TypeScript props; accessible name and, for icon-only controls, a tooltip
(labels are linted by `a11y/labels.ts`; tooltips are **not** checked today);
tokens only (no literal colour, radius, shadow, duration); renders in light and
dark and under `data-calm`, `prefers-contrast`, `forced-colors`; a gallery story;
a test where interaction or semantics matter. "Do not introduce a new UI
library" holds: nothing here needs one.
