# Component spec matrix — 12 fields for every component

> Status: **specification, not a claim of build.** Rows describe the 56 components of the Claude Design handoff kit (`the-main-semester-design-system`) and the contract the app implementation must meet. Where the app already has the component, `COMPONENT_INVENTORY.md` says where; where it does not, that file says "New". Variants are read from the kit's `*.d.ts`; everything else is the contract.

**Analytics events are definitions only.** Per D-005 and `docs/ANALYTICS-EVENTS.md`, nothing here is sent to a server; `ANALYTICS.md` still promises three marks. Names follow `SEMESTER-CONTENT-STANDARDS.md` §8 (snake_case, object then verb). An event moves from this page into collection only through that document's four-step PR. `—` means the component emits no event of its own; its parent does.

**Tokens** are semantic names from `app/src/styles/tokens.css`. No raw value appears in any row; colour is defined only in `app/src/lib/look.ts`.

## 1. Family contracts (apply to every member unless a row overrides)

| Family | Semantic tokens | Accessibility behaviour | Responsive behaviour |
|---|---|---|---|
| core | `--action-primary`, `--action-secondary`, `--text-on-action`, `--shape-control`, `--control-height-standard`, `--target-primary`, `--focus-*` | Native `button`; visible `--focus-ring-*`; name required | 44px target (`--target-primary`); 32px only in dense rows; never hover-only |
| forms | `--surface-plain`, `--border-default`, `--border-strong`, `--text-primary`, `--text-secondary`, `--status-danger(-line)`, `--state-disabled-*`, `--control-height-standard`, `--focus-*` | Label always visible; hint and error tied by `aria-describedby`; error also in `ErrorSummary`; never colour alone | Single column to 600; two-up only at ≥840; 16px minimum text so mobile does not zoom |
| feedback | `--status-*`, `--status-*-wash`, `--status-*-line`, `--surface-quiet`, `--motion-save`, `--motion-progress` | `role=status` (polite) for progress and success, `role=alert` only for failure that blocks; focus never moved | Inline in the region it describes; full-width strip only for page-level state |
| trust | `--status-info|success|attention|neutral`, `--text-secondary`, `--surface-quiet`, `--border-hairline`, `--chart-verified|estimated|stale|student-entered` | Glyph + word + tone; whole provenance read as one sentence; not a tooltip-only fact | Layer 1 label wraps under the fact at 320px; Layer 2 detail opens inline, not on hover |
| governance | `--status-*`, `--state-locked-border`, `--surface-raised`, `--border-default`, `--text-secondary` | Status as word + glyph; actions are buttons with names that include the object; approvals announced | Stacks under the object at <840; actions wrap, never overflow |
| navigation | `--bar-surface`, `--bar-border`, `--brand-ink`, `--layer-chrome`, `--target-primary`, `--layout-gutter` | `nav` landmark with a name; `aria-current="page"`; every item labelled (no icon-only); skip link first | Rail ≥1200 (≥840 collapsed), tab bar <840, five destinations; full capability parity through search/menu |
| overlays | `--surface-modal`, `--sheet-surface`, `--elevation-modal`, `--layer-overlay`, `--layer-curtain`, `--shape-sheet`, `--motion-sheet` | Focus trap, Escape closes, focus returns to opener, scrim click dismisses non-destructive only (`useModal`) | Sheet is full-width bottom sheet <600, side panel ≥840; never taller than viewport, content scrolls |
| surfaces | `--card-surface`, `--card-border`, `--card-shape`, `--surface-raised`, `--shape-card`, `--text-primary`, `--text-secondary` | Heading per card; one primary + one quiet secondary; whole-card click never the only target | One column <600; grid at ≥840 with `--layout-gutter`; long titles wrap, never truncate the object name |
| data | `--chart-*`, `--data-series-1…5`, `--border-hairline`, `--type-role-numeric`, `--text-secondary` | Real `table`/`caption`/`th scope`; chart has a data table equivalent; colour never alone | Table scrolls inside its own region at <840, first column sticky; no page-level horizontal scroll |

## 2. Components

| Component | Family | Purpose | Variants | Analytics event | Test requirement |
|---|---|---|---|---|---|
| **Button** | core | Run one action; one primary per decision region | primary · secondary · ghost · danger (red ink, never fill); size md/sm; icon, iconAfter, block, loading, disabled | `button_pressed` | Axe; keyboard Enter/Space; 44px target in `taps` contract; loading keeps width |
| **IconButton** | core | Icon-only control for a familiar action | size md/sm; pressed (toggle) | `icon_button_pressed` | `lint:labels` fails without `label`; tooltip + accessible name match |
| **Icon** | core | Glyph from the 108-name set | size, strokeWidth; decorative unless `label` | — | Decorative icons `aria-hidden`; named ones have `role=img` |
| **Avatar** | core | Identify a person without a photo | size; initials or profile glyph | — | Never derived from an email; decorative beside a name |
| **SectionLabel** | core | Name a section and its count | as h2/h3/h4; aside count | — | Renders a real heading; heading order test |
| **Wordmark** | core | Brand lockup | size; metal (dark chrome); showWord | — | Named image or hidden next to text |
| **TextField** | forms | Capture one value | single/multiline; hint; error; disabled | `field_changed` | Label/hint/error association (`a11y/fielderror`); error text not colour only |
| **Select** | forms | Choose one of a short list | native select; hint | `field_changed` | Native element; label visible |
| **Combobox** | forms | Search a long list | options with detail; open/closed | `option_selected` | ARIA 1.2 combobox pattern; Combobox axe test; Escape closes |
| **DateField** | forms | Capture a date or time, with the zone said | date · date+time; `said` (spoken form) | `field_changed` | Two-zone test; no custom calendar (spec §2.4) |
| **Choice** | forms | Radio/checkbox with the consequence in a sentence | radio · checkbox; about | `choice_selected` | Grouped in fieldset/legend; about text in description |
| **Segmented** | forms | Switch between 2–4 views of the same data | options; value | `view_changed` | Radio-group semantics; arrow keys |
| **Switch** | forms | On/off setting that says its state in words | checked; disabled | `setting_changed` | `role=switch`; word beside track |
| **VisibilityPicker** | forms | Say who can see something | only-me · course · collaborators · portfolio; locked; origin | `visibility_changed` | Locked states give reason; origin shown; preview of audience |
| **StatusChip** | trust | State of one object | status key from `lib/status.ts`; glyph + word + tone | — | `tellings` test: no colour-only meaning |
| **SourceBadge** | trust | Where a fact came from | official · connected · imported · personal · ai · estimated · review · stale · external · sample | `source_report_opened` | Glyph + word; `lib/source.ts` vocabulary only |
| **SourceLine** | trust | One line: source, who, when, beside the fact | source, by, when | — | Plain text; not a tooltip |
| **ProvenanceChips** | trust | Origin + ≤2 cues + age, as one sentence | origin, by, cues, age | — | `ProvenanceChips.test`; spoken as one sentence |
| **AIResponse** | trust | An AI answer that is source-aware and non-authoritative | scope, sources[n], confidence, cost, policy, model, actions | `ai_answer_shown · ai_source_opened · ai_handoff_started` | Must render scope + sources + limits + handoff; consequential `actions` open `ActionPreview`; live region while streaming |
| **EmptyState** | feedback | Explain emptiness and offer one next action | title, body, action | `empty_action_pressed` | Heading + one action; no illustration-only meaning |
| **LoadingState** | feedback | Structural placeholder + spoken "Loading …" | what; bars | — | `role=status`; no shimmer; reduced-motion safe |
| **ErrorState** | feedback | Failure with required recovery | title, body, recover, secondary, reference | `error_recovery_pressed` | Recovery action required by type; reference shown |
| **Notice** | feedback | One-line service or context notice | head, body | `notice_dismissed` | `role=status`; persists until resolved if it carries state |
| **OfflineStrip** | feedback | Say offline, what works, what is queued | queued count; syncs | — | Polite announcement on change; not a toast |
| **PermissionNotice** | feedback | What changed about access, why, where controlled | changed, why, control | `permission_control_opened` | Names the controlling owner; link to the control |
| **ProgressState** | feedback | Determinate wait with Cancel/Retry | done/total; note; failed | `progress_cancelled` | Native `progress`; percent in words |
| **SaveState** | feedback | Saving → Saved near the work | Saving · Saved · Saved locally · Offline · Sync trouble · Conflict | — | Polite live region; no focus move |
| **StepStatus** | feedback | Named steps of a process | waiting · working · done · failed | — | State as word + glyph per step |
| **SuccessState** | feedback | Acknowledge and point to next step | title, body, next | — | No confetti, streaks or ranks |
| **ObjectCard** | surfaces | The universal decision card | kind; statuses; provenance; explanation; metadata; primary+secondary; tone pending/danger | `object_card_action_pressed` | One primary; provenance before explanation |
| **ContextBar** | surfaces | The object a screen is about, with states and actions | kicker, title, states, actions | — | Page title is an h1 once per route |
| **NextSteps** | surfaces | Ordered next safe actions, one line of why each | steps[label, why, aside] | `next_step_pressed` | Ordered list; each item a button/link with the object named |
| **ActionPreview** | surfaces | Say what will happen before it happens | subject; says; exactly; doesNotChange; subjectTo; recovery undo/request/none; provenance | `action_previewed · action_confirmed · action_cancelled` | Required before any consequential action; `whoCanHelp` (optional) names who to ask |
| **Dialog** | surfaces | Modal confirmation naming object, consequence, recovery | destructive; confirm/cancel labels; inline | `dialog_confirmed · dialog_cancelled` | Focus lands on Cancel; Escape closes; `modal` test |
| **QuickActions** | surfaces | Short list of common actions | actions[label, icon] | `quick_action_pressed` | Buttons with names; no hover-only reveal |
| **OpenIn** | surfaces | Hand off to an official or external system | targets; about | `official_system_opened` | Warns before leaving; names the owner |
| **ScreenGuide** | surfaces | Answer the seven screen questions in place | items[q,a]; open | `screen_guide_opened` | Disclosure pattern; content is the seven questions |
| **DataTable** | data | Compare rows | columns (numeric); rows; caption | `table_sorted` | Real table semantics; `Table.test` axe; keyboard |
| **Fields** | data | Label/value record | items[field,value,mono] | — | `dl`/`dt`/`dd` |
| **DecisionTrail** | data | Auditable who/what/when/authority | done · current · waiting · blocked | `trail_opened` | Ordered list; state in words |
| **MetricTile** | data | One number with source and age | label, value, unit, source, updated, delta | — | Number never without source/updated where it is a fact |
| **ProvenanceChart** | data | A chart whose every row has a source | rows[label,value,source]; demo flag | — | Data-table equivalent; `demo` is labelled Sample |
| **PageHeader** | governance | Universal page title: kicker, title, purpose, source, actions | kicker, title, purpose, source, actions | — | One h1; purpose is one sentence |
| **PolicyBadge** | governance | Name the policy that governs this thing | name, version, owner, open | `policy_opened` | Link names the policy; version visible |
| **ConsentBadge** | governance | State of sharing consent | private · shared · expired · revoked · required | `consent_manage_opened` | State in words; recipient and expiry shown |
| **ApprovalBanner** | governance | State of an approval | required · pending · approved · rejected | `approval_requested · approval_decided` | Approver named; decision announced |
| **HealthBadge** | governance | Band + driver of a health score | healthy · watch · atrisk · unknown | — | Band as word; driver always shown; never a bare number |
| **SupportHandoff** | governance | Hand a person to a human office | ready · sent · received · resolved; office, hours, reference | `support_handoff_started` | Reference number shown; hours stated |
| **ErrorSummary** | governance | List form errors at top, linked to fields | errors[field,message] | — | Receives focus on submit; each item links to its field |
| **SideRail** | navigation | Desktop destinations | groups; count; current | `nav_item_opened` | `nav` + `aria-current`; collapsed ≥840 keeps labels reachable |
| **TabBar** | navigation | Mobile destinations (five, labelled) | items; current | `nav_item_opened` | Always labelled; 44px; `tabbar` test |
| **SystemContextBar** | navigation | Where am I, term, sync, search | location, term, sync, actions | `search_opened` | Landmark; sync state is text |
| **CommandPalette** | navigation | Search and commands (⌘K) | groups[items] | `command_selected` | Combobox/listbox; Escape; reachable without a shortcut |
| **Sheet** | overlays | Secondary task over the page | title, actions, inline | `sheet_opened · sheet_closed` | `useModal`; returns focus |
| **UndoToast** | overlays | Confirm a low-risk action and offer undo | message, undoLabel | `undo_pressed` | Polite live region; stays ≥ reading time; never the only record |
| **FocusBar** | overlays | Persistent state of a focus session | task, remaining, pause, end, breakDue | `focus_session_started · focus_session_ended` | Controls named; timer is text, not only a ring |

## 3. States — loading, empty, error, offline, forbidden

Family defaults are in the family table of §4; this table repeats them per component and records the overrides.

| Component | Loading | Empty | Error | Offline | Forbidden |
|---|---|---|---|---|---|
| Button | Inline: control keeps its width and shows a spoken "Working"; no spinner-only | n/a: a control is not a list | Inline message beside the control, work kept | Disabled with reason, or queued with "Saved on this device" | Hidden only if the action does not exist for the role; otherwise disabled with `PermissionNotice` reason |
| IconButton | Inline: control keeps its width and shows a spoken "Working"; no spinner-only | n/a: a control is not a list | Inline message beside the control, work kept | Disabled with reason, or queued with "Saved on this device" | Hidden only if the action does not exist for the role; otherwise disabled with `PermissionNotice` reason |
| Icon | n/a | n/a | Unknown name renders nothing and fails the icon check | n/a | n/a |
| Avatar | n/a | Profile glyph | n/a | n/a | n/a |
| SectionLabel | n/a | n/a | n/a | n/a | n/a |
| Wordmark | n/a | n/a | n/a | n/a | n/a |
| TextField | Field shows last value, spoken "Checking" if validating | Placeholder is never the label; empty is a valid state with the hint | Message states what, why, how to fix; value kept | Edits kept locally, "Saved on this device, will send when online" | `locked` with owner and reason; value readable if the role may read it |
| Select | Field shows last value, spoken "Checking" if validating | Placeholder is never the label; empty is a valid state with the hint | Message states what, why, how to fix; value kept | Edits kept locally, "Saved on this device, will send when online" | `locked` with owner and reason; value readable if the role may read it |
| Combobox | Field shows last value, spoken "Checking" if validating | Placeholder is never the label; empty is a valid state with the hint | Message states what, why, how to fix; value kept | Edits kept locally, "Saved on this device, will send when online" | `locked` with owner and reason; value readable if the role may read it |
| DateField | Field shows last value, spoken "Checking" if validating | Placeholder is never the label; empty is a valid state with the hint | Message states what, why, how to fix; value kept | Edits kept locally, "Saved on this device, will send when online" | `locked` with owner and reason; value readable if the role may read it |
| Choice | Field shows last value, spoken "Checking" if validating | Placeholder is never the label; empty is a valid state with the hint | Message states what, why, how to fix; value kept | Edits kept locally, "Saved on this device, will send when online" | `locked` with owner and reason; value readable if the role may read it |
| Segmented | Field shows last value, spoken "Checking" if validating | Placeholder is never the label; empty is a valid state with the hint | Message states what, why, how to fix; value kept | Edits kept locally, "Saved on this device, will send when online" | `locked` with owner and reason; value readable if the role may read it |
| Switch | Field shows last value, spoken "Checking" if validating | Placeholder is never the label; empty is a valid state with the hint | Message states what, why, how to fix; value kept | Edits kept locally, "Saved on this device, will send when online" | `locked` with owner and reason; value readable if the role may read it |
| VisibilityPicker | Field shows last value, spoken "Checking" if validating | Placeholder is never the label; empty is a valid state with the hint | Message states what, why, how to fix; value kept | Edits kept locally, "Saved on this device, will send when online" | `locked` with the owner who set it; shows allowed set only |
| StatusChip | Reserve the badge slot; "Checking source" | "No source recorded" is shown, never a blank | "Source unavailable" with the official fallback link | Last known source + age; marked Stale after the freshness window | Source owner named; detail withheld with the reason if the role cannot read it |
| SourceBadge | Reserve the badge slot; "Checking source" | "No source recorded" is shown, never a blank | "Source unavailable" with the official fallback link | Last known source + age; marked Stale after the freshness window | Source owner named; detail withheld with the reason if the role cannot read it |
| SourceLine | Reserve the badge slot; "Checking source" | "No source recorded" is shown, never a blank | "Source unavailable" with the official fallback link | Last known source + age; marked Stale after the freshness window | Source owner named; detail withheld with the reason if the role cannot read it |
| ProvenanceChips | Reserve the badge slot; "Checking source" | "No source recorded" is shown, never a blank | "Source unavailable" with the official fallback link | Last known source + age; marked Stale after the freshness window | Source owner named; detail withheld with the reason if the role cannot read it |
| AIResponse | Reserve the badge slot; "Checking source" | "I could not find this in your sources" + handoff, never an invented answer | Names what failed, keeps the question, offers handoff | Cached answers marked with age; new questions queued or refused with reason | Says which data scope the role may not use |
| EmptyState | This component is the loading state | Sentence, one next step | Failure, scope, preserved work, recovery, reference | States what still works and what is queued | States what is unavailable, why, who controls it, the approved alternative |
| LoadingState | This component is the loading state | Sentence, one next step | Failure, scope, preserved work, recovery, reference | States what still works and what is queued | States what is unavailable, why, who controls it, the approved alternative |
| ErrorState | This component is the loading state | Sentence, one next step | Failure, scope, preserved work, recovery, reference | States what still works and what is queued | States what is unavailable, why, who controls it, the approved alternative |
| Notice | This component is the loading state | Sentence, one next step | Failure, scope, preserved work, recovery, reference | States what still works and what is queued | States what is unavailable, why, who controls it, the approved alternative |
| OfflineStrip | This component is the loading state | Sentence, one next step | Failure, scope, preserved work, recovery, reference | States what still works and what is queued | States what is unavailable, why, who controls it, the approved alternative |
| PermissionNotice | This component is the loading state | Sentence, one next step | Failure, scope, preserved work, recovery, reference | States what still works and what is queued | States what is unavailable, why, who controls it, the approved alternative |
| ProgressState | This component is the loading state | Sentence, one next step | Failure, scope, preserved work, recovery, reference | States what still works and what is queued | States what is unavailable, why, who controls it, the approved alternative |
| SaveState | This component is the loading state | Sentence, one next step | Failure, scope, preserved work, recovery, reference | States what still works and what is queued | States what is unavailable, why, who controls it, the approved alternative |
| StepStatus | This component is the loading state | Sentence, one next step | Failure, scope, preserved work, recovery, reference | States what still works and what is queued | States what is unavailable, why, who controls it, the approved alternative |
| SuccessState | This component is the loading state | Sentence, one next step | Failure, scope, preserved work, recovery, reference | States what still works and what is queued | States what is unavailable, why, who controls it, the approved alternative |
| ObjectCard | Skeleton with the same rows | `EmptyState` inside the card region | `ErrorState` replaces the card body only | Shows last known content with age | `PermissionNotice` in place of content |
| ContextBar | Skeleton with the same rows | `EmptyState` inside the card region | `ErrorState` replaces the card body only | Shows last known content with age | `PermissionNotice` in place of content |
| NextSteps | Skeleton with the same rows | `EmptyState` inside the card region | `ErrorState` replaces the card body only | Shows last known content with age | `PermissionNotice` in place of content |
| ActionPreview | Skeleton with the same rows | `EmptyState` inside the card region | `ErrorState` replaces the card body only | Shows last known content with age | `PermissionNotice` in place of content |
| Dialog | Skeleton with the same rows | `EmptyState` inside the card region | `ErrorState` replaces the card body only | Shows last known content with age | `PermissionNotice` in place of content |
| QuickActions | Skeleton with the same rows | `EmptyState` inside the card region | `ErrorState` replaces the card body only | Shows last known content with age | `PermissionNotice` in place of content |
| OpenIn | Skeleton with the same rows | `EmptyState` inside the card region | `ErrorState` replaces the card body only | Shows last known content with age | `PermissionNotice` in place of content |
| ScreenGuide | Skeleton with the same rows | `EmptyState` inside the card region | `ErrorState` replaces the card body only | Shows last known content with age | `PermissionNotice` in place of content |
| DataTable | Row skeletons at expected height | `EmptyState` row-spanning | Region `ErrorState`; last good rows kept | Last known rows with "as of" | Columns the role may not read are omitted with a one-line note |
| Fields | Row skeletons at expected height | `EmptyState` row-spanning | Region `ErrorState`; last good rows kept | Last known rows with "as of" | Columns the role may not read are omitted with a one-line note |
| DecisionTrail | Row skeletons at expected height | `EmptyState` row-spanning | Region `ErrorState`; last good rows kept | Last known rows with "as of" | Columns the role may not read are omitted with a one-line note |
| MetricTile | Row skeletons at expected height | `EmptyState` row-spanning | Region `ErrorState`; last good rows kept | Last known rows with "as of" | Columns the role may not read are omitted with a one-line note |
| ProvenanceChart | Row skeletons at expected height | `EmptyState` row-spanning | Region `ErrorState`; last good rows kept | Last known rows with "as of" | Columns the role may not read are omitted with a one-line note |
| PageHeader | Skeleton keeps layout; "Checking approval" | States "Nothing waiting" with who decides | Decision not recorded; retry; nothing assumed approved | Read-only; approvals cannot be granted offline | Shows who may approve and how to request |
| PolicyBadge | Skeleton keeps layout; "Checking approval" | States "Nothing waiting" with who decides | Decision not recorded; retry; nothing assumed approved | Read-only; approvals cannot be granted offline | Shows who may approve and how to request |
| ConsentBadge | Skeleton keeps layout; "Checking approval" | States "Nothing waiting" with who decides | Decision not recorded; retry; nothing assumed approved | Read-only; approvals cannot be granted offline | Shows who may approve and how to request |
| ApprovalBanner | Skeleton keeps layout; "Checking approval" | States "Nothing waiting" with who decides | Decision not recorded; retry; nothing assumed approved | Read-only; approvals cannot be granted offline | Shows who may approve and how to request |
| HealthBadge | Skeleton keeps layout; "Checking approval" | States "Nothing waiting" with who decides | Decision not recorded; retry; nothing assumed approved | Read-only; approvals cannot be granted offline | Shows who may approve and how to request |
| SupportHandoff | Skeleton keeps layout; "Checking approval" | States "Nothing waiting" with who decides | Decision not recorded; retry; nothing assumed approved | Read-only; approvals cannot be granted offline | Shows who may approve and how to request |
| ErrorSummary | Skeleton keeps layout; "Checking approval" | States "Nothing waiting" with who decides | Decision not recorded; retry; nothing assumed approved | Read-only; approvals cannot be granted offline | Shows who may approve and how to request |
| SideRail | Chrome renders at once; counts appear when known | Item with zero count shows no badge | Sync trouble shown in `SystemContextBar`, navigation still works | Offline state in the bar; cached destinations stay open | Destinations the role cannot open are absent, not greyed; search says "not available to your role" |
| TabBar | Chrome renders at once; counts appear when known | Item with zero count shows no badge | Sync trouble shown in `SystemContextBar`, navigation still works | Offline state in the bar; cached destinations stay open | Destinations the role cannot open are absent, not greyed; search says "not available to your role" |
| SystemContextBar | Chrome renders at once; counts appear when known | Item with zero count shows no badge | Sync trouble shown in `SystemContextBar`, navigation still works | Offline state in the bar; cached destinations stay open | Destinations the role cannot open are absent, not greyed; search says "not available to your role" |
| CommandPalette | Chrome renders at once; counts appear when known | Item with zero count shows no badge | Sync trouble shown in `SystemContextBar`, navigation still works | Offline state in the bar; cached destinations stay open | Destinations the role cannot open are absent, not greyed; search says "not available to your role" |
| Sheet | Opens with content skeleton; focus on the title | n/a: an overlay always has content | Failure inside the overlay; it stays open | Actions that need the network say so before they are pressed | Does not open; the opener shows the reason |
| UndoToast | Opens with content skeleton; focus on the title | n/a: an overlay always has content | Failure inside the overlay; it stays open | Actions that need the network say so before they are pressed | Does not open; the opener shows the reason |
| FocusBar | Opens with content skeleton; focus on the title | n/a: an overlay always has content | Failure inside the overlay; it stays open | Actions that need the network say so before they are pressed | Does not open; the opener shows the reason |

## 4. Family state defaults

| Family | Loading | Empty | Error | Offline | Forbidden |
|---|---|---|---|---|---|
| core | Inline: control keeps its width and shows a spoken "Working"; no spinner-only | n/a: a control is not a list | Inline message beside the control, work kept | Disabled with reason, or queued with "Saved on this device" | Hidden only if the action does not exist for the role; otherwise disabled with `PermissionNotice` reason |
| forms | Field shows last value, spoken "Checking" if validating | Placeholder is never the label; empty is a valid state with the hint | Message states what, why, how to fix; value kept | Edits kept locally, "Saved on this device, will send when online" | `locked` with owner and reason; value readable if the role may read it |
| feedback | This component is the loading state | Sentence, one next step | Failure, scope, preserved work, recovery, reference | States what still works and what is queued | States what is unavailable, why, who controls it, the approved alternative |
| trust | Reserve the badge slot; "Checking source" | "No source recorded" is shown, never a blank | "Source unavailable" with the official fallback link | Last known source + age; marked Stale after the freshness window | Source owner named; detail withheld with the reason if the role cannot read it |
| governance | Skeleton keeps layout; "Checking approval" | States "Nothing waiting" with who decides | Decision not recorded; retry; nothing assumed approved | Read-only; approvals cannot be granted offline | Shows who may approve and how to request |
| navigation | Chrome renders at once; counts appear when known | Item with zero count shows no badge | Sync trouble shown in `SystemContextBar`, navigation still works | Offline state in the bar; cached destinations stay open | Destinations the role cannot open are absent, not greyed; search says "not available to your role" |
| overlays | Opens with content skeleton; focus on the title | n/a: an overlay always has content | Failure inside the overlay; it stays open | Actions that need the network say so before they are pressed | Does not open; the opener shows the reason |
| surfaces | Skeleton with the same rows | `EmptyState` inside the card region | `ErrorState` replaces the card body only | Shows last known content with age | `PermissionNotice` in place of content |
| data | Row skeletons at expected height | `EmptyState` row-spanning | Region `ErrorState`; last good rows kept | Last known rows with "as of" | Columns the role may not read are omitted with a one-line note |

## 5. Open gaps this matrix surfaces

- `ActionPreview` has `whoCanHelp` now, but only the gallery uses the component; the 23 hand-written dialogs in `COMPONENT_INVENTORY.md` have not adopted it.
- `AIResponse` is the kit's single component; in the app the same job is split between `ai/Answer.tsx` (text), `intelligence/Disclosure.tsx` (receipt) and `ai/Actions.tsx`. The receipt carries the badge, sources, information used, uncertainty and policy, and now a route to a person.
- `COMPONENT_INVENTORY.md` is stale on `SourceBadge` (it already draws glyph + word).
- Offline and Forbidden cells are contracts. Few have a test; each row's test requirement is the minimum for that to change.
- Event names here are proposals; none has been through D-005.
