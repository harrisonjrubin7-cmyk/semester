# UI Consistency Matrix

| Control | Value |
| --- | --- |
| Status | **CONTROLLED ADOPTION MATRIX — CONSISTENCY PARTIAL** |
| Owner | Harrison Rubin — Product Design and Frontend Engineering; backup design reviewer unassigned |
| Evidence date | 2026-10-03 at repository revision `8fc5fd56` |
| Canonical references | [`DESIGN-SYSTEM-OPERATING-STANDARD.md`](DESIGN-SYSTEM-OPERATING-STANDARD.md), [`INTERACTION-STANDARDS.md`](../design/INTERACTION-STANDARDS.md), [`SEMESTER-UI-CONSTITUTION.md`](../design/SEMESTER-UI-CONSTITUTION.md) |

## Pattern matrix

| Concern | Canonical pattern/source | Adoption state | Known gap / required review |
| --- | --- | --- | --- |
| App shell and page frame | `App.tsx`, `Page`, `SettingsPage`, page-frame guard | **STRONG / EXCEPTIONS** | frameless screens require documented focus/editor reason; reconcile remaining exceptions |
| Navigation and context | navigation registry/areas, shared headers/context bars | **STRONG / COMPLEX** | multiple legacy organizational maps require task-based validation, not a new shell |
| Primary and secondary action | `ActionButton`, one-primary rule, overflow/secondary controls | **PARTIAL** | no universal one-primary guard; portal/action forks and dense screens need review |
| Cards and object rows | card only for object/decision/action; object contracts | **PARTIAL** | full contracts for Course, Service, Event, Person, Place, Source and Plan remain incomplete |
| Empty/no-results | `EmptyState` | **PARTIAL ADOPTION** | route/state census needed; eliminate one-off empty treatments during touched work |
| Loading/progress | route skeleton, `LoadingState`, `Progress`, `StepStatus` | **PARTIAL ADOPTION** | ensure final-layout sizing, cancellation and no fake progress |
| Error/validation/recovery | `ErrorState`, `Trouble`, `ScreenTrouble`, `Notice` | **PARTIAL ADOPTION** | field-error and route-wide recovery consistency remain incomplete |
| Success/save/sync | `SuccessState`, `SaveState`, shared sync vocabulary, `Said` | **PARTIAL/STRONG WORDING** | prevent duplicate announcements and reconcile all save surfaces |
| Offline/stale/restricted | shared sync/source vocabulary and notice patterns | **PARTIAL** | permission state lacks one universal component; exercise every core journey |
| Modal/sheet/drawer/popover | `useModal`, shared overlays, explanation sheet | **STRONG CONTRACT / VARIED IMPLEMENTATION** | migrate only when touched; verify focus/return and mobile keyboard/safe area |
| Tabs/chips/selection | shared `TabList`, `Segmented`, chips, toggles | **STRONG** | browser-style workspace tabs must not be reused as content tabs |
| Confirm/undo/destructive action | `TypeToConfirm`, `Undone` | **STRONG FOUNDATION** | census remaining native/one-off confirmations and destructive flows |
| Source/freshness/authority | `SourceBadge`, `NotOfficial`, intelligence disclosure | **PARTIAL** | reconcile vocabulary and route coverage; test comprehension |
| AI-assisted content | intelligence disclosure, named steps, source/limit/human route | **PARTIAL** | universal route notice, reporting and non-AI alternatives unproven |
| Forms | native labels plus shared fields/rows | **PARTIAL** | complete error-summary, autocomplete and preservation review |
| Tables/charts/media | labelled charts with required semantic alternative | **PARTIAL** | table/text equivalents and mobile reading modes incomplete |
| Typography/spacing/color/shape | Semester tokens and user settings | **STRONG / GUARDED** | remaining ledgered literals/style forks need intentional reduction |
| Motion | shared roles, reduced-motion media and calm settings | **STRONG FOUNDATION** | manual route verification and any remaining literal exceptions |
| Responsive composition | layout contract and canonical media tiers | **PARTIAL** | device/zoom/state matrix and visual comparison not complete |
| Content and terminology | Semester content standards and shared status/source vocabularies | **PARTIAL** | product copy guide and automated terminology coverage remain next batch |

## Review protocol

For every changed surface, identify its screen family, object type, dominant action, component reuse, trust labels, all system states, responsive transformations, keyboard/focus behavior, reduced-motion result and copy vocabulary. Record a deliberate exception with owner, user reason, accessibility impact, migration/expiry and regression evidence. “Looks similar” is not an exception record.

## Evidence state

**Code/config evidence.** Component imports, style budgets, page-frame/navigation/label/modal/tabs/token tests and the generated screen audit provide substantial structural evidence.

**Operational evidence.** No complete current component-adoption census, screenshot regression baseline, cross-route design review or observed terminology/source-comprehension study is filed.

**Missing test/proof.** Generate the route/component/state inventory, review every exception, add representative visual baselines, execute the responsive/accessibility plans and close or explicitly accept critical inconsistency.

## Claim ceiling

Semester may say it maintains canonical UI patterns and automated guards for many foundations. It must describe route/component adoption as partial where this matrix says so.

## Prohibited claims

Do not claim universal UI consistency, complete component reuse, no design debt, pixel parity or user-validated coherence without route-wide evidence.
