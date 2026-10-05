# Visual debt register (phase D0)

New rows for the design-system adoption. The existing register is
[DESIGN-DEBT.md](DESIGN-DEBT.md) (DD-001..DD-010); these rows are numbered
**VD-** so the two cannot collide, and cross-reference where they overlap.
Evidence is a grep, a file and line, or a named test. Counts are heuristics
from 2026-10-04 on `c170dcd`; re-run before trusting.

Priorities: P0 fails WCAG A/AA or misstates provenance · P1 visible
inconsistency on a core screen · P2 elsewhere · P3 cleanup.

| ID | Category | Evidence | Target | Pri | Phase |
|---|---|---|---|---|---|
| VD-001 | Four trust vocabularies disagree | `lib/source.ts`, `status.ts`, `where.ts`, `factprovenance.ts`; e.g. connected glyph `○` vs `↔` vs target `⇄`; personal `◇` vs `○` (STATUS_AND_PROVENANCE_AUDIT §1). Overlaps DD-003 | One table, ten kinds | P0 | D1 |
| VD-002 | `SourceBadge` shows no glyph | `components/SourceBadge.tsx`; ~33 call sites. Glyph-bearing `StatusChip` has 4 call sites, `ProvenanceChips` 2 | Glyph + word everywhere | P0 | D1 |
| VD-003 | Missing statuses | Pending approval, Approved, Rejected, Verified, Hold on account, Draft, Live, Preview absent from `status.ts`; no `announce` string (only `urgent` boolean, `status.ts:69`) | Full vocabulary with announcement | P1 | D1 |
| VD-004 | Hand-rolled badges and colour dots | `grep 'className="[^"]*\b(pill\|badge\|chip\|tag)\b'` 75 hits (ceiling); 32 colour-dot patterns; `.trust-scorecard-row.is-green/yellow/red` colour-only (`app.css:10694-10696`) | Shared components only | P1 | D1 guard, D3 |
| VD-005 | `ConfirmDialog` unstructured; `ActionPreview` unused | `ConfirmDialog.tsx` takes free-form `preview`; `ActionPreview` only in `gallery/stories.tsx`; no "who can help" field | `ActionPreview` as the dialog body | P0 | D1 contract, D3 |
| VD-006 | `window.confirm` | `ActionCenter.tsx:94`, `toolkit/ResearchPanel.tsx:328`, `DataPanel.tsx:185`, `AssignmentPanel.tsx:155`, `creation/Publishing.tsx:166` | `Dialog` | P1 | D3 |
| VD-007 | No confirmation found on billing and grade actions | none of `ConfirmDialog`/`confirm`/`TypeToConfirm` in `screens/Bill.tsx`, `screens/Grades.tsx` (not read to confirm what those screens do) | Verify, then preview | P0 (unverified) | D3 |
| VD-008 | ContextBar adoption 5 of ~89 | `unity/ContextBar.tsx` in Courses, Pathway, Guide, `CourseHub`, console | Every screen's object | P1 | D3 |
| VD-009 | Duplicate ContextBar | `unity/ContextBar.tsx` and `console/ContextBar.tsx` (different jobs, same name) | Rename console one to `ScopeBar` | P3 | D2 |
| VD-010 | 23 dialog/sheet implementations | `rg -l 'role="(alert)?dialog"\|aria-modal'`; not on `useModal`: `OperatingRhythmWorkspace`, `TabPeek`, `call/Stage`, `calendar/Move` (inferred from import list) | One `Dialog` on `useModal` | P1 | D1 |
| VD-011 | Chip/badge implementations ×9 | `StatusChip`, `ProvenanceChips`, `SourceBadge`, `StatusBadge` (`site/claims.tsx`), `ChipRow`, `PickChips`, `Chips`, `BookmarkChips`, `DeadlinePicker` local `Chip` | Two: `StatusChip`, `SourceBadge` | P2 | D3 |
| VD-012 | Two offline components | `OfflineBanner.tsx` and `unity/States.tsx` `OfflineStrip` | One | P2 | D3 |
| VD-013 | Three parallel token scales | radius `--r-*`/`--radius-*`/`--shape-*`; shadow `--lift-*`/`--shadow-*`/`--elevation-*`; spacing `--sp-*`/`--space-*` | One each | P1 | D1 |
| VD-014 | `industry.css` loaded before `tokens.css` | `main.tsx:4-16`; `tokens.test.ts` forbids shared names | Fold into tokens | P2 | D1 |
| VD-015 | Untokenised pills | CSS `999px` ×32; inline `borderRadius` 999 ×9, `'50…'` ×23; `--shape-pill` ×3 | `--shape-pill` only on floating bars | P1 | D1 |
| VD-016 | Inline style volume | 6,439 `style={{` in 358 files; `borderRadius` 319, `fontFamily` 261, `boxShadow` 26, `transition` 20; CSP keeps `style-src 'unsafe-inline'` partly for this | Classes + tokens; guard on new literals | P1 | D1 guard |
| VD-017 | Shadows on ordinary cards | 69 `box-shadow` declarations; `.desk-panel`, `.today-dominant-card`, `.action-panel-primary`, `.appicon-tile`, `.mb-row.is-open`; `--glow` default has literal rgba (`app.css:401`) | Hairline only; shadow for floating | P2 | D1 |
| VD-018 | Gradients | 14 CSS gradients (`app.css` 10, `unity.css` 2, `features.css` 2) + JS `--chrome` | Review each against "quiet chrome" | P2 | D1 (U-5) |
| VD-019 | Blur beyond two surfaces | `glass.test.ts` allows `.app-header`, `.app-tabs`, `.soft-folder`, `.focus-bar` | Tab bar and focus bar | P3 | D1 |
| VD-020 | Off-scale motion | 90, 340, 520, 560 ms literals; `--fast` duplicates `--duration-fast` | Tokens | P3 | D1 |
| VD-021 | Focus ring inconsistency | 3px at `app.css:2638, 11118, 11186`; `industry.css:150-151,270` own ring and `:focus{outline:none}`; `.standards-audit` uses `--app-fg` (`app.css:11277`) | One ring, 2px | P1 | D1 |
| VD-022 | Icon target 40px | `--target-icon: 40px` (`tokens.css`) | 44px or documented composite exception | P2 | D1 |
| VD-023 | Mono unmanaged | `ui-monospace…` literal at `app.css` 5322, 5545, 5748, 5764; `--font-mono` only in `features.css:277` | `--font-mono` token | P3 | D1 |
| VD-024 | Dingbat glyphs as UI text | ✓ ×31, ✕ ×23, ☐ ×10, ☒ ×7, ★ ×4 … in ~14 files (`screens/Sheet.tsx` 9, `Drill.tsx`, `Onboarding.tsx`, `unity/States.tsx`, `Tabs.tsx`) | `Icons.tsx` or status glyph table | P2 | D3 |
| VD-025 | `--status-success` = `--status-info` = accent | `tokens.css:89-97` | Distinct (U-4) | P1 | D1 |
| VD-026 | Cinzel loaded, barely used | 2 faces; `app.css:481, 2120` | Editorial moments only | P3 | D1 |
| VD-027 | Rail not grouped, not fixed 248 | `App.tsx:986-1146`; `--rail-w` 72/196-232/248/272 | Five groups, 248 | P1 | D2 |
| VD-028 | No ⌘K entry in the rail | `Command` reachable by header search icon and `lib/keys.ts:180` | Visible entry | P2 | D2 |
| VD-029 | Active-item marker | pill + inset line (`App.tsx:1103-1120`); tab bar 2px top border | 3px leading edge, blue wash | P2 | D2 |
| VD-030 | `QUIET_ON` hides the system bar on 6 screens | `SystemContextBar.tsx` (onboarding, search, directory, ask, mail, call) | Decide per screen | P2 | D2 |
| VD-031 | Scattered breakpoints | 759, 839, 899, 1179, 1199 all in use; 2 `@container` rules; `RESPONSIVE-CONTRACTS.md` (600/1024) disagrees with code (600/840/1200/1600) | One set | P2 | D2 |
| VD-032 | No scope bar on institution tabs | `screens/University.tsx` (18 tabs) vs `console/ContextBar.tsx` | Scope bar on all staff surfaces | P0 | D4 |
| VD-033 | No mono audit references | `--font-mono` unused in `console/Audit.tsx` (bare `<code>` ×2) | Mono refs | P2 | D4 |
| VD-034 | `DecisionTrail` is not a history | `unity/DecisionTrail.tsx` (31 lines) navigates a student workflow; used only by `SystemContextBar` | Audit/approval history component | P1 | D4 |
| VD-035 | Integrations lack trust level | `IntegrationDashboard.tsx` shows direction, status, last sync, freshness, errors, reconciliation — not trust level | Add | P2 | D4 |
| VD-036 | Hard-coded zero evidence | `University.tsx:~848` `auditEventCount: 0`, `activeConsentCount: 0` fed to `ControlPlane` | Real data or "not measured" | P0 | D4 |
| VD-037 | AI answer lacks per-request cost, step status, source drawer, proposal state | `ai/Chat.tsx:496` monthly count only; `IntelligenceDisclosure` mounted only when flag on; `lib/assistant-confidence.ts` unused by AI UI | `AIResponse` | P1 | D3 |
| VD-038 | Sample marking inconsistent | `SourceBadge`/`source.ts` cannot say Sample (`TrustKind` lacks it); `Where.sample` can | One vocabulary | P1 | D1 |
| VD-039 | Family sharing has no shared notice | bespoke sentences (`Family.tsx:138,300`), `FamilyInvite.tsx:94`; no `PermissionNotice` for consent | Per-switch what/what-not | P1 | D3 |
| VD-040 | Tenant branding exemption is policy only | `lib/governance/config-tiers.ts:64`; no consumer of `brand.accent_color` found; no test | Guard (ADR-0037) | P1 | D1 |
| VD-041 | Date format mixed | `lib/date.ts` yields "Thu 9 Oct"; `lookup.ts`, `integration/school-records.ts` use en-US `toLocale*` options → "Thu, Oct 9" | One formatter | P2 | D3 |
| VD-042 | Title Case | `WeeklyReset.tsx:92`, `ResearchPanel.tsx:75`, `OperatingRhythmWorkspace.tsx:277` (sample only) | Sentence case | P3 | D3 |
| VD-043 | Reaction emoji | `lib/roomchat.ts:51`, `lib/mesh.ts:422`, `room/Write.tsx:225` | Needs a decision: brief says never | P2 | decide |
| VD-044 | Visual regression not in CI | `npm run gallery:shots` "not in CI"; 6 stories, all in `unity/`; uncovered: States, Status, SystemContextBar, DecisionTrail, NextSteps, ContextBar, ReadState | Baseline in CI | P1 | D5 |
| VD-045 | Dyslexia/reading manual script missing | ACCESSIBILITY_GAP_AUDIT §4 | Script | P2 | D5 |

## Cross-reference to DESIGN-DEBT.md

DD-003 (Official vs Institution verified) is **resolved by the brief** (Institution
verified) and folds into VD-001. DD-004 (seven screens with neither frame) and
DD-010 (no screenshot comparison on PRs) are the same fault as VD-008 and
VD-044. DD-008 and DD-009 are *guarded by a ledger*, not zero: VD-016 and VD-015
extend the ledger idea to inline radius, shadow and font.
