# Semester design system as governed product infrastructure

**Status: specification. Adoption: partial. Nothing here is deployed.**
Owner: Harrison Rubin (backup reviewer unassigned; see §7.1). Evidence base:
`origin/main` at 7287ddc, 4 October 2026. Companion to, not a replacement for,
[`DESIGN-SYSTEM-GUIDE.md`](../../DESIGN-SYSTEM-GUIDE.md),
[`GOVERNANCE.md`](GOVERNANCE.md), [`SEMESTER-UI-CONSTITUTION.md`](SEMESTER-UI-CONSTITUTION.md),
[`../DESIGN-TOKEN-ARCHITECTURE.md`](../DESIGN-TOKEN-ARCHITECTURE.md) and
[`../product-design/DESIGN-SYSTEM-OPERATING-STANDARD.md`](../product-design/DESIGN-SYSTEM-OPERATING-STANDARD.md).

## 0. Position, and what this document adds

The repository already has a token layer (129 custom properties in
`app/src/styles/tokens.css`), a colour engine (`lib/look.ts`: 13 grounds × 11
accents, 143 audited pairings), about 40 guard tests, and a nightly browser
contrast sweep. The audit's brief ("rebuild with a `packages/design-system`")
is right about the destination and wrong about the method: **the system is a
token-and-guard system, not yet a packaged one.** Rebuilding it would discard
the guards, which are the valuable part. So this spec extends in place and
extracts later (§10).

What exists and is not repeated here: principles, the surface family, type
roles, motion roles, focus and target tokens, the state library, the 12
accessibility guards. Read those first.

What does not exist, and is the subject of this document:

| Gap | Evidence | Section |
|---|---|---|
| One provenance model (three vocabularies today) | `lib/source.ts`, `lib/where.ts`, `lib/status.ts`, `lib/provenance.ts` | §4 |
| Role and institution rules | no `data-role`/tenant token set; constitution defers it | §3.5, §8 |
| Dyslexia-aware mode | an "Easier reading" preset already exists (`lib/accessmode.ts`); no letter/word spacing; the Hyperlegible face is not bundled; **no test that layouts survive WCAG 1.4.12 spacing** (now written: `sweep:spacing`) | §6.6 |
| Component and token versioning, deprecation | grep of `docs/` finds nothing UI-specific | §7.3–7.4 |
| Figma ↔ code parity | no Figma, Code Connect, or token export | §7.2 |
| Visual regression | DD-010 "planned"; no pixel diff in CI | §7.5 |
| Breakpoint guard beyond `app.css` `min-width` | `lib/media.ts` and `tiers.test.ts` exist; 19 stale or off-class queries unchecked | §3.4 |
| Shared Table, Combobox, DateField primitives (Slice 4, built); generic Sheet and ActionPreview (Slice 3, revised, not built) | thirty files wrote their own `<table>`; three hand-rolled comboboxes; four sheets | §2 |
| A manual assistive-technology pass | AT-PASS-PROTOCOL: **not run** | §6.8 |

### 0.1 Contradictions found in the existing docs (fix before building on them)

These are real and each one will produce a wrong implementation if ignored.

1. **Danger colour.** `DESIGN-TOKEN-ARCHITECTURE` says `--status-danger` aliases `--app-warn`; `DESIGN-TOKENS` and DD-006 say `--app-error`. The stylesheet wins; treat the architecture doc as stale.
2. **Status colour vocabulary.** `STATUS-SOURCE-VISUAL-LANGUAGE` names Slate/Brass/Sage/Rose/Gray; the token docs say one warn colour plus shared accent; the constitution uses accent / `--app-passing` / warn / red. Four vocabularies, no tone→token table. §4.3 supplies the table.
3. **Breakpoints.** `lib/media.ts` is the source: 600 / 840 / 1200 / 1600 (+ height 600), checked against `app.css` by `tiers.test.ts`. The constitution (760/1180) and `RESPONSIVE-CONTRACTS.md` (320–599/600–1023/1024+) are stale, and **the first draft of this spec repeated the 760/1180 figures** before Slice 1 read the code; they are corrected below. The CSS still carries 19 non-class queries, six of them at the pre-move 759/1179/1180 edges (§3.4).
4. **Navigation.** `UNIFIED-SEMESTER-SYSTEM` has 5 destinations; the constitution has 7 areas. Not a design-system question; flagged to the product owner, and this spec avoids depending on either.
5. **Provenance naming.** "Institution verified" vs "Official" is open (DD-003); "Imported" vs "Synced" differs between the copy guide and content standards. §4.4 recommends a resolution but it is the owner's call.
6. **Metrics disagree** (hex literals 28 vs 30; frameless screens 7 vs 9). They were measured at different commits and are undated. §7.6 makes the census emit a commit hash and date.
7. **Four overlapping PR checklists** (GOVERNANCE §3, COMPONENT-RELEASE-CHECKLIST, constitution §9, `pull_request_template.md`) and two screen rubrics (22-point and 20-point). §9 designates one.

## 1. Design principles and visual-language direction

The five existing principles stand (action before inventory; one source of
truth, visibly named; calm density; progressive disclosure; failure is a
designed state). The audit adds two the guide lacks, and the platform scope
(faculty, staff, guardian, institution) forces a third. All three are testable:

6. **Authority is always legible.** Any fact a person might act on says who
   stands behind it (§4). *Test:* every object card/row that renders an
   institutional fact takes a `provenance` prop. Target: required, so a missing one
   is a type error and not a review comment. Today it is optional on `ObjectCard`
   (36 callers pass nothing); the census counts the gap and the prop becomes
   required when the count reaches zero.
7. **Same language, density by role; never personalise an institutional fact.**
   (Adopts `INTERACTION-STANDARDS.md:207`.) A registrar console and a student's
   Today share components and words; they differ in density, default disclosure
   and which actions lead. They never differ in what a status colour means.
8. **A decision shows its consequence before it commits.** Approvals, grade
   changes, sharing, payments and AI actions use the action-preview pattern
   (§5.4). *Test:* consequential commands have no code path that skips it.

**Visual-language direction (unchanged, restated so the rule is findable):**
graphite/brass editorial calm; serif display for moments, condensed for
navigation and labels, sans for reading, mono for identifiers only. Colour
carries identity and state, never decoration. Elevation is rare; a border plus
a surface step is the default. Premium here means *precision and quiet*: exact
alignment on the 4px rhythm, no ornament that costs contrast or motion, and
status that is readable at a glance by someone who cannot see colour.

Anti-goals (these are what "unified across student, staff, faculty, guardian"
must not become): a second theme per role; an institution skin that can change
semantic colour; dashboard chrome in the student app; gamified progress.

## 2. Component inventory, ownership and contracts

**Ownership is by domain steward, not by file.** Today every path has one
owner (`.github/CODEOWNERS`: `* @harrisonjrubin7-cmyk`), so GitHub cannot
require an independent code-owner review, because authors cannot approve their
own PR. The stewards below are *roles*; until a second person exists, a role is
satisfied by a recorded self-review plus a green guard, and the claim ceiling
(§7.1) applies.

| Steward role | Owns |
|---|---|
| **DS-Foundations** | `lib/look.ts`, `styles/tokens.css`, `lib/contrast.ts`, token export |
| **DS-Components** | `components/ui.tsx`, `components/unity/*`, `components/shell/Rows.tsx`, new primitives |
| **DS-A11y** | `app/src/a11y/*`, `smoke:a11y`, exceptions register, AT pass |
| **DS-Content** | `content/terms.ts`, `ledger.ts`, microcopy library (§5) |
| **DS-Trust** | `lib/source.ts`, provenance model, `SourceBadge`, `Status` |

Status key: **E** exists and guarded · **P** exists, partial or unguarded ·
**G** gap (not found by the survey; verify before building).

### 2.1 Inventory against the audit's required component families

| Family | Component | State | Where / note | Steward |
|---|---|---|---|---|
| Navigation | App shell, Page, SettingsPage | E | `Page.tsx`, `pageframe.test.ts` | Components |
| | Command palette | P | `components/Command.tsx` | Components |
| | Skip link, landmarks | E | `skiplink.test.tsx`, `landmarks.test.ts` | A11y |
| | Breadcrumbs / back-to-parent | G | back rule is in guide; no component | Components |
| Input | Field + FieldMessage | E | `FieldMessage.tsx`, `fielderror.test.ts` | Components |
| | Toggle, Segmented, TickBox, Chips | E | `ui.tsx` | Components |
| | Combobox | E (Slice 4) | `unity/Combobox.tsx` + `lib/combobox.ts`; three hand-rolled ones remain to migrate (`desk/TopBar.tsx` is the full ARIA pattern; `Command.tsx`, `TabFind.tsx` are listbox-in-dialog) | Components |
| | Date | E (Slice 4) | native `<input type=date>` (56 files) is the right control; `unity/DateField.tsx` adds label, hint, range-in-words and the message wiring. `DeadlinePicker.tsx` is a *chip picker for which deadline*, not a calendar. No custom calendar: see §2.4 | Components |
| | File upload | P | `FilePick` | Components |
| | Rich text / sheet cell | G | editors are screen-specific | Components |
| Action | ActionButton (+ `.btn*`) | E | `ui.tsx`, `industry.css`; **1,089 raw `<button>`s remain** (census) | Components |
| | `.portal-*` second button system | P | `features.css`; 2 screens + 11 components; to retire | Components |
| Status | StatusChip, SaveState, SyncState | E | `unity/Status.tsx` | Trust |
| | SourceBadge | E | only 5 files use it | Trust |
| | System-status banner | E | `StatusNotice` | Trust |
| Feedback | Loading/Error/Success/Permission/Offline | E | `unity/States.tsx` | Components |
| | Toast (Undone, Said) | E | `lib/undo.ts` | Components |
| Overlay | ConfirmDialog, TypeToConfirm, Popover | E | `ConfirmDialog.tsx`, `a11y/modal.ts` | A11y |
| | Sheet / Drawer | **not a primitive** | Fifteen overlays already share `useModal` (trap, Escape, focus return); the "sheets" are four different presentations. See §2.3. `useScrim` (built, Slice 3) is the shared behaviour they were missing | A11y |
| Data | Table (responsive) | E (Slice 4) | `unity/Table.tsx`; adopted by `StudentGrades`. Thirty-odd files still hand-write `<table>`; `InstructorBook` (editable cells) and `DecisionTable` are next | Components |
| | HorizontalOverflow | E | `HorizontalOverflow.tsx` | Components |
| | Charts | E | `DATA-VISUALIZATION-SYSTEM.md`, `--chart-*` | Foundations |
| Workflow | Approval timeline, exception queue | G | audit-required; institutional console has bespoke | Components |
| | Status stepper | E | `StepStatus` | Components |
| | Action-preview card | G | `ConfirmDialog` `preview` slot is the seed | Components |
| Learning | Course/assignment card, receipt | P | domain components, no shared contract | Components |
| AI | Disclosure, source drawer | P | `SourceDrawer`, intelligence disclosure | Trust |
| | Data-scope picker, feedback control | G | | Trust |
| Support | Help panel, ticket form | P | `GetHelp.tsx`, `AskAHuman.tsx` | Content |
| Accessibility | Focus ring, reduced-motion, contrast variants | E | tokens + guards | A11y |
| | Live-region announcer | E | **`Said.tsx` is the app's one live region** (polite, store-driven via `useStore().say`, keyed so a repeated sentence re-announces). 214 files carry their own `role=status/alert` or `aria-live`, most legitimately (field errors, `ErrorState`). Not a gap; the first draft was wrong | A11y |
| | Reading-comfort preset | P | `PRESETS` in `lib/accessmode.ts` has "Easier reading" (large text, airy lines, narrow measure) and "Focus"/"Lower load"; extend it, do not add a parallel one. Letter/word spacing and a bundled legible face are missing (§6.6) | A11y |

Four gaps mattered because screens were re-implementing them: **Table,
Combobox, ActionPreview** and the backdrop-dismiss behaviour (plus ApprovalTimeline, still open); a generic Sheet turned out not to be one. Two of the
six the first draft named were not gaps: the announcer exists (`Said`), and the
date control is the native input. Verify a "G" with a grep before building it.

### 2.2 API contract template (every library component must publish this)

```
Name / steward / status (alpha | beta | stable | deprecated) / since: x.y.z
Purpose, and the sentence "use X instead when ..."
Props: typed, with a default for every optional prop; no `style` escape hatch
       on stable components (the inline-style rule in styles/rules.ts applies)
Required a11y props are REQUIRED in the type (label, or labelledBy)
States covered: default, hover, focus-visible, active, disabled, loading,
       error, read-only, restricted, empty (list the ones that do not apply)
Tokens consumed (semantic only; none of --space-*, --radius-*, --shadow-*)
Keyboard map, focus order, focus return, announced text
Responsive rule at compact <600, medium 600–839, expanded 840–1199, large >=1200, and 200% text / 400% reflow
Reduced-motion / calm / forced-colors behaviour
Density behaviour: comfortable/snug/tight, and per role (§8)
Content rules: label grammar, max length, truncation, i18n expansion budget
Provenance: required | optional | n/a
Tests: unit, axe, keyboard, and the mutation proof that the guard fails (§9)
Telemetry events (snake_case object_verb)
```

### 2.3 Worked contracts for the first three new primitives

**`Sheet` — dropped as a primitive (Slice 3), with evidence.** The first draft
proposed one component to replace "four bespoke sheets". Reading them:

- `ReviewSheet` is **not an overlay**; it is an in-page review list (a "sheet" as in a
  document). The first draft was wrong to list it.
- The overlays are four *presentations*: `ExplanationSheet` and `CourseDetailV2`
  (modal bottom sheet below 1200px, docked non-modal drawer from 1200px),
  `UnityLayer`'s private `Sheet` (a scrim with a window or pane), `TileSheet`
  (a full-screen "folder" with swipe-to-dismiss), and `ConfirmDialog` (a dialog).
- What they share is already one primitive: **`useModal`**, used by 15 files, which is
  documented as "one trap, in one place". What remains per overlay is ~10 lines of
  attributes plus its own design.

A wrapper would unify those ten lines at the price of touching four designs with
no visual test, and add no capability. So none was built. What *was* missing
was a behaviour, found by reading how they close:

**`useScrim`** — *built*, `a11y/modal.ts`. Four dialogs closed on `onClick` of the
backdrop with `stopPropagation` on the panel. The browser fires `click` on the
nearest common ancestor of the press and the release, so pressing inside a panel,
dragging a selection out and letting go over the backdrop dispatched a click on the
backdrop and **closed the dialog under the reader** (the source drawer's excerpt is
selectable text people copy). Reproduced in Chromium: `stopPropagation` on the panel
does not prevent it, because the click never passes through the panel. A dismissal now
needs the press *and* the release on the backdrop, via pointer events; a click with no
pointer events before it (a script, an assistive technology) still dismisses as it
always did. Adopted in `ExplanationSheet`, `CourseDetailV2`, `ConfirmDialog` and
`UnityLayer`; a tree-wide test fails on a new `…wash|backdrop|scrim… onClick=`.

**`Table`** — *built (Slice 4)*, `components/unity/Table.tsx`.

```ts
type Column<Row> = { id: string; header: string; cell: (r: Row) => ReactNode
                     numeric?: boolean; sortable?: boolean; rowHeader?: boolean }
type TableProps<Row> = {
  caption: string; captionHidden?: boolean       // the table's name, drawn or not
  columns: Column<Row>[]; rows: Row[]; rowKey: (r: Row) => string
  sort?: { id: string; dir: 'ascending' | 'descending' } | null
  onSort?: (columnId: string) => void             // a request; the caller reorders
  compact?: 'scroll' | 'stack'                    // default 'scroll'
  empty: ReactNode                                // required
}
```
Changes from the first draft, each for a reason found in the code:

- **No column `priority`.** Dropping columns on a phone is hiding data, which
  `widthgate.test.ts` forbids ("width may change how something is reached, never
  whether"). Both compact modes keep every cell: `scroll` keeps the columns in a
  named, focusable region (the page does not scroll sideways); `stack` makes each
  row a block with the column label on every cell and the table roles written out
  (CSS `display: block` makes some screen readers stop calling it a table).
- **No `rowAction`, no `selection`.** Nothing needs either yet; a prop nobody passes
  is a promise nobody has tested.
- **Sorting is the caller's.** The table shows the order it is given and reports a
  request; it never reorders. Outcomes are said through `useStore().say` like every
  other outcome, because the app has one live region and this file must not add a second.
- Reuses the existing `.integration-table` look, so adopting it changes no pixels.

**`Combobox`** — *built (Slice 4)*, `components/unity/Combobox.tsx` with the key
arithmetic pure in `lib/combobox.ts`. The ARIA editable combobox with list
autocomplete: real focus never leaves the box, `aria-activedescendant` names the
row, `aria-expanded` follows the list. Arrows wrap; Enter chooses only when a row
is the cursor (otherwise it is the form's); one Escape puts the list away and keeps
the text, the next clears it (TopBar's behaviour); **Home and End stay with the
text caret.** It does not filter (the caller owns matching, `lib/typeahead.ts` is
one), does not announce result counts (the live region is for outcomes, not
keystrokes), and is not a menu. For choosing one of a few known options, use a
native `<select>`.

**`DateField`** — *built (Slice 4)*, `components/unity/DateField.tsx`, with
`lib/datefield.ts`. See §2.4.

**`ActionPreview`** — *built (Slice 3, ships unadopted)*, `components/unity/ActionPreview.tsx`.
`ConfirmDialog` already is the preview-then-choice dialog (`preview: ReactNode`, focus
starts on Cancel, Tab trapped), so this is the *content* of that slot, not a second
dialog. About thirty callers hand-write their previews; the sample read consistently
had a bold subject, what will happen to whom, and what stays, and one
(`OfficeActionDesk`) typed "Institution verified · scope · source" by hand where the
provenance chips now exist. The shape follows the explainability doc's impact fields
(`says`, `doesNotChange`, `subjectTo`) and adds the part that was always optional and
should not be:

```ts
type Recovery = { kind: 'undo'; how?: string } | { kind: 'request'; how: string }
              | { kind: 'none'; how?: string }
ActionPreview({ subject?, says, exactly?, doesNotChange?, subjectTo?, recovery, provenance? })
```
`recovery` is **required in the type** (proved: making it optional fails `tsc`), and a
`request` recovery must say how, because "it can be reversed" with no way to ask is
the sentence that sends someone to support. Rendered as a definition list in the order
people ask: what happens, exactly what, what stays the same, can I take it back.
Reversible work should not use a dialog at all: `lib/undo.ts` offers an undo toast,
because a confirmation clicked through a hundred times stops asking.

*Adoption is a content decision, not a refactor.* None of the thirty dialogs states
whether it can be undone, so moving one onto `ActionPreview` means writing a sentence
about reversibility that the product has never claimed. That belongs to DS-Content and
the screen's owner, one dialog at a time, not to a mechanical migration.

### 2.4 Why there is no custom calendar

`DESIGN-SYSTEM-GUIDE.md`: native input semantics where they exist. The native date
control is right on every platform, including a phone's own picker, and a hand-built
calendar grid is the widget most often broken for screen readers and switch users.
56 files use it. What the native control does not do is what `DateField` adds: a
visible label, a hint, the range checked in words (a keyboard user can type past
`min`/`max`), no complaint until the person has left the box, and the message wired
the one way `FieldMessage` wires it. Dates are handled as `YYYY-MM-DD` strings and
built from parts, never `new Date('2026-10-04')` (UTC midnight, the evening before
in every timezone west of Greenwich; guarded under `TZ=America/Chicago`). A custom
calendar needs an owner decision and the AT pass first.

## 3. Token architecture

Keep the three layers (primitive → semantic → component) and the four rules
(no colour in the semantic layer; every `var()` resolves; no collision with
`industry.css`; adopt by changing the name, not the value). Additions:

### 3.1 Naming grammar (currently implicit)

`--{category}-{role}[-{variant}][-{state}]`; categories are the existing ones
(`surface, text, border, action, status, focus, target, duration, motion, layer,
elevation, shape, layout, chart, type-role`). New categories need a DS-Foundations
decision file. **Never name a token for its value** (`--blue-500`) or its
screen (`--gradebook-header`); name it for its job. A token with one consumer
is a component token or a local variable, not a semantic token.

### 3.2 Coverage against the audit's list

| Dimension | Today | Add |
|---|---|---|
| Colour | 13 grounds × 11 accents, status, chart, brand | the **provenance tone map** (§4.3) as tokens; nothing else |
| Type | 9 roles, 18-step scale incl. half-steps | freeze half-steps (alias only); new work uses the 6 semantic steps; add `--tracking-body`, `--word-space` for §6.6 |
| Spacing | `--sp-1..7` × `--density` (2,4,6,8,10,12,16 px) | document the 4px macro rhythm vs 2px fine steps in one place |
| Radius | `--r-sm/md/lg` by Corners setting | none |
| Elevation | `--lift-1..3`, 4 semantic names, glass policy | none |
| Motion | 15 `--motion-*`/5 durations, 2 easings | delete or use `--motion-insert`/`--motion-panel` (currently unused by any rule) |
| Breakpoints | `lib/media.ts` constants + `tiers.test.ts`; stylesheet queries guarded by `breakpoints.test.ts` | ledger of 19 shrinks (§3.4) |
| Density | `--density` 1 / .86 / .74, per person | add a **role default** (§3.5), never a role override of the person's choice |
| Semantic state | attention, danger, success, info, neutral | fix doc drift (§0.1.1) |
| Target | 24 / 32 / 40 / 44 | none |

### 3.3 Token source of truth and export (Figma-parity prerequisite)

Colour is decided only in `look.ts`; that stays. What is missing is a
*machine-readable export*. Add `npm run tokens:export`, producing
`app/design-tokens/semester.tokens.json` in the W3C Design Tokens format with:

- **Collections:** `primitive` (modes = the 13 grounds, resolved by `tokensFor`), `semantic` (aliases from `tokens.css`), `setting` (density, text scale, corners as modes).
- **Metadata per token:** `$description`, `$extensions.semester = { since, status, steward }`, and for colours the measured ratio against its pairing from `contrast.ts`.
- A snapshot test that fails when the export drifts from `tokens.css` + `look.ts`.

This file feeds Figma variables (§7.2) and any future native (iOS/Android)
client, and is the `packages/design-system` seed. No Style Dictionary is
required for the first slice; a 100-line script over `tokensFor` suffices, and
adding a build dependency is deferred until a native target exists.

### 3.4 Breakpoints

**Implemented (Slice 1).** The breakpoints already have one source,
`lib/media.ts`, and `lib/tiers.test.ts` holds `app.css`'s `min-width` queries to
it. Media queries cannot read custom properties, so a breakpoint "token" is a
documented constant plus a guard; no CSS variable is added.

| Window class | Width | Shell | Constant |
|---|---|---|---|
| compact | < 600 | phone, tab bar | |
| medium | 600–839 | phone tab bar, rail collapsed to icons | `MEDIUM_AT` 600 |
| expanded | 840–1199 | rail beside the column, touch sizes | `TABLET_AT` 840 |
| large | ≥ 1200 | desktop window | `DESKTOP_AT` 1200 |
| extra-large | ≥ 1600 | wider measure and canvas | `EXTRA_LARGE_AT` 1600 |
| handheld | height < 600 **and** coarse pointer | a phone on its side is a phone at any width | `TALL_AT` 600 |

`RESPONSIVE-CONTRACTS` bands (320/600/1024) are *verification widths* for
screenshots, not layout switches.

`styles/breakpoints.test.ts` extends the existing guard to every stylesheet and
to `max-width` and `max-height`: a width or height condition must be a class
edge (`min-width` at the edge, `max-width` at the pixel before it) or be on a
shrink-only ledger with the file and a reason. It found 19 off-edge queries,
which matches the constitution's "19 legacy breakpoints":

| Where | Queries | Why it is on the ledger |
|---|---|---|
| `features.css` | `min-width: 1180`, `max-width: 1179` ×2, `max-width: 759` ×3 | written against the **old** 760/1180 edges |
| `unity.css` | `max-width: 759` | same |
| `app.css` | 520, 559, 560 ×3, 640 ×2 (small-phone tweaks); 600 and 900 written inclusive; 1100 (no class) | narrow adjustments / off-by-one / no class behind it |
| `form-usability.css`, `unity.css` | `max-width: 639` | small-phone adjustment |

The six at the old edges are a **real layout inconsistency**, not just tidiness:
between 760 and 839 px, and again 1180–1199 px, those blocks lay a screen out
for a different window class than the shell around it. The guard freezes them;
moving each to the class edge changes what is drawn at those widths, so it is a
screenshot-checked change of its own (Slice 9).

### 3.5 Density and role

**Not built (Slice 5); this records why, and what the decision is.** The first
draft proposed a density default by role, "applied only when the person has not
chosen one". Reading the code:

- **Role is the person's own choice** (`lib/role.ts`: `pickable()`, `state.role`, and
  "selecting a role here never manufactures a grant"). So a default derived from it
  needs no async lookup and cannot flicker. That removes the risk the first draft
  assumed.
- **But "has not chosen" is not representable.** `state.density` is always a string,
  `'comfortable'` by default, so a role default cannot tell an untouched setting
  from one the person set to Comfortable on purpose. Making it representable means a
  data-model change to a persisted, synced look key (an `'auto'` value or a
  "chosen" flag), with hydration to check on older builds. The migration plan
  records that check as never done.
- **It cuts across the app's own rule.** `lib/accessmode.ts`: "Nothing here is
  switched on because of how somebody uses the app." A role is not behaviour, but a
  presentation change nobody asked for is the same kind of act.

Options, for the owner (spec §11): **(a)** when a role is picked, *offer* "Use a
denser layout for this role?" — explicit, no data-model change, consistent with
the accessmode rule; **(b)** a true default via `'auto'`, with the hydration check;
**(c)** nothing. Recommendation: (a). The table below is the proposed content of
the offer, not an automatic default:

| Role group | Offered density | Offered disclosure |
|---|---|---|
| Student, applicant, alumni, guardian/family | Comfortable | Guided |
| Faculty, advisor, TA | Snug | Focused |
| Registrar, finance, student-affairs, IT, support | Snug (Tight opt-in) | Detailed |

A role is **never** a permission. Guard when built: `sweep:targets` already runs all
three densities and covers the offered ones.

## 4. Status and provenance system

### 4.1 The problem

Four partially overlapping vocabularies exist today: `SourceLabel` (5, matches a
DB constraint), `TRUST_KINDS` (+3 display-only), `Where` (6), `StatusKey` (22),
and `Provenance {source, scope, status}` (used only by `lib/journal.ts`). The
audit asks for eight states a user can see: official, connected, user-created,
AI-generated, stale, pending, verified, restricted. Those are **not one axis**:
"AI-generated" is an origin, "stale" a freshness, "pending" a lifecycle,
"verified" an assurance, "restricted" an access state. Putting them in one
badge list forces contradictions (can something be official *and* stale? yes).

### 4.2 Model: five orthogonal axes, one display

Implemented in `app/src/lib/factprovenance.ts` as `FactProvenance`. (Not
`Provenance`: that name is `lib/provenance.ts`'s source/scope/status sentence,
used by the journal. Different types, different names.)

```ts
type Origin = 'official' | 'connected' | 'imported' | 'user' | 'computed'
            | 'ai' | 'external' | 'sample' | 'unknown'      // who produced it
type FactProvenance = {
  origin; assurance: 'verified' | 'unverified' | 'needs_review'
  freshness: 'current' | 'stale' | 'unknown'; observedAt?: number | null
  lifecycle?: 'pending' | 'submitted' | 'approved' | 'rejected' | 'revoked'; owner?
  access?: 'restricted'; controller?; system?; verifiedBy?
} & (origin extends 'official' ? { authority: string } : {})   // a union in the code
```

The first draft of this spec had five origins. Reading the four vocabularies
it replaces showed that was too few: `imported` is not `student_entered`;
`Where.made` (rule-based extraction) is not AI, and `status.ts` says the
student must be able to tell them apart (`computed` vs `ai`); `external`
exists; and the stored `needs_review` label says nothing about origin, so
mapping it to any real origin would invent a claim the old badge never made
(`unknown`). Rules:

1. Axes are independent. The display shows the origin chip always, plus **at most
   two** further cues, chosen by this priority: `restricted` > age (`stale`, or
   `unknown` where a reader expects an age) > `needs_review` > lifecycle >
   `verified`. Everything else is said in the screen-reader sentence and the
   Source & details drawer. `verified` is not drawn on an official fact, which is
   verified by definition.
2. `origin:'official'` without `authority` is a **type error** (proved: making the
   field optional fails `tsc` on the guard's `@ts-expect-error`). The stored
   `institution_verified` label carries no office, so its adapter defaults to
   "Your institution", which is all the old text ever claimed; callers that know
   the office pass it.
3. `ai` is always worded "AI-assisted" and, for tier ≥ 2 outputs, offers a route
   to a human.
4. Age is computed from `observedAt` against **the caller's** freshness window
   (`freshnessState` has no default on purpose). The single exception is
   `fromWhere('connected')`, where `Where` has already applied its three-day rule.
5. Estimated and AI facts draw the eye more than official ones (existing
   `wantsAttention`); a test holds that every kind the old badge drew loud still does.
6. Never fabricate freshness: absent time is `unknown`, and `unknown` is drawn only
   for `official` and `connected` origins, where a missing age is itself
   information (neutral tone, not a warning).
7. **Chips are role-neutral.** The same chip is read by the student, the
   faculty member, the advisor and the guardian, so "You"/"Yours" (right for one
   reader in four) is "Student entered".
8. **Nothing here changes a stored value, and nothing here produces `official`
   that was not already `official`.** `where.test.ts` records that no adapter in
   this build returns `Where.official`; the adapters preserve that, and a test
   asserts exactly one input maps to each of the two official outputs.

### 4.3 Visual encoding

Every chip is **glyph + word + tone**; tone is never the only carrier
(`tellings.test.ts`). Tones map to the existing `--status-*` tokens
(`toneVar`), so no hue is introduced and every ground's contrast audit already
applies. Origin has a second carrier in *how the chip is drawn*: solid fill and
heavier edge for an institution's fact, outline for the rest, dashed for a
sample. Verified in greyscale and in `forced-colors: active` (solid gets a 3px
edge there, since forced colours drop the fill).

| Cue | Word | Glyph | Tone |
|---|---|---|---|
| origin official | Institution verified · {authority} (word is one constant; DD-003) | ◆ | success, solid |
| origin connected | Connected · {system} | ↔ | neutral |
| origin imported | Imported | ↓ | neutral |
| origin user | Student entered | ◇ | neutral |
| origin computed | Estimated | ≈ | attention |
| origin ai | AI-assisted | ✦ | attention |
| origin external | External | ↗ | neutral |
| origin sample | Sample | ◌ | neutral, dashed |
| origin unknown | Source not recorded | · | neutral |
| restricted | Restricted · {who} decides | ⊘ | neutral |
| stale | Out of date | ↻ | attention |
| age unknown | Age unknown | – | neutral |
| needs review | Needs review | ? | attention |
| pending / submitted | Pending · {owner} / Submitted · {owner} | … / ↑ | neutral |
| approved | Approved | ✔ | success |
| rejected / revoked | Not approved / Revoked | ✕ / ↩ | attention |
| verified (non-official) | Verified · {by} | ✓ | success |

Untested assumption: the glyphs render in the system fonts of every supported
device. They rendered in Chromium on Linux in the checks for Slice 2; the
words carry the meaning if one does not, but verify on iOS and Android.

### 4.4 Migration from today's vocabulary (implemented as adapters)

`fromSourceLabel` and `fromWhere` read the existing vocabularies; the database
check constraint and `SOURCE_LABELS` are untouched.

| Today | Becomes | Note |
|---|---|---|
| `institution_verified` | origin `official`, assurance `verified`, authority "Your institution" unless named | word stays "Institution verified" until DD-003 |
| `imported` | origin `imported` | resolves "Imported vs Synced": **Imported** unless a refresh operates |
| `student_entered` | origin `user` | |
| `estimated` | origin `computed` | |
| `needs_review` | origin `unknown`, assurance `needs_review` | no invented origin |
| `ai_assisted` / `external` | origin `ai` / `external` | display-only kinds stay out of the DB union |
| `unavailable_stale` | origin `connected`, freshness `stale` | |
| `Where.official / connected / stale / made / yours / sample` | `official` / `connected`+current / `connected`+stale / `computed` / `user` / `sample` | "Made here" and "Yours" are retired by this mapping |
| `StatusKey` sync keys | **not provenance**; stay in `Status.tsx` | sync state describes the app, not the datum |

The adapters are injective on the eight kinds (no two stored or display labels
map to the same fact), which is what lets the screen say everything the
database stores. `SourceBadge` itself is **unchanged** in Slice 2; its callers
move one family at a time, and `lib/where.ts` is deleted last (§7.4).

### 4.5 Where provenance is mandatory

Grades, holds, balances and charges, registration status, degree-audit rows,
deadlines imported from an LMS, advisor/faculty notes, anything a guardian is
shown, every AI output, every record in an institutional queue. Optional on
purely personal content (a student's own note). Today **5 files** use
`SourceBadge`; the adoption target is a census-tracked number (§7.6), and the
rule "an object card renders an institutional fact only with `provenance`" becomes
a type rule once the callers are migrated (`ObjectCard` takes it optionally today).

### 4.6 Connector health (from the audit) maps to freshness, not to new chips

| Health | Effect on cues |
|---|---|
| Healthy | none beyond origin |
| Delayed | `freshness:'stale'` with age; data stays usable |
| Degraded | stale + affected scope named; native alternative offered |
| Failed | stale + stop dependent automation; show native/fallback path |
| Reconciliation mismatch | `assurance:'needs_review'`; never silently overwrite |
| Disabled | not an error: shows the institution-contact path |

## 5. Content design and microcopy standards

Adopts `SEMESTER-CONTENT-STANDARDS.md` (voice, retired words, sentence case,
verb-plus-object labels, "you") and the copy guide's six-point decision
contract (what this is, why now, where it came from, what will happen, what
you can do, how to recover). Additions follow. Examples obey the retired-word
lint (no "Something went wrong", "task", "smart", "unverified").

### 5.1 Universal message shape

**What happened → what still works → what you can do → who can help.** One
sentence each, in that order, no apology theatre, no blame, no exclamation
marks, no jargon codes in the sentence (a reference ID is a separate line).

### 5.2 Errors

| Case | Pattern | Example |
|---|---|---|
| Retryable | name the thing; say work is kept; retry | "We couldn't save this note. Your text is still here. Try again." |
| Connector down | name the system; show last good time; native path | "Brightspace hasn't updated since 9:40 AM. Your saved courses and deadlines are still available. Open Brightspace" |
| Permission | who controls it; how to ask; no sensitive leak | "Only the Registrar can change this record. Request a change" |
| Validation | field-level reason, input preserved, summary at top | "Enter a date after Sept 15." |
| System | calm, retry, support reference | "This page didn't load. Try again, or contact support with reference 4F2A-91." |

Never: "Something went wrong" (DD-002), "Oops", error codes as the message,
red-only styling, clearing the user's input.

### 5.3 Trust, privacy and consent

- Say where data goes *at the moment of the choice*, not in a policy link: "Your advisor will see your degree plan, not your notes."
- Consent states are verbs with scope and revocation: "Share grades with Maria Lopez until Dec 20 · Stop sharing".
- Never "we value your privacy"; never imply access that the policy engine would deny (D-1019/D-1067 faculty privacy boundary).
- Sample/demo data is always labelled: "Sample course — not your institution record."
- Company and sales copy keeps the claim ceiling: no "compliant", "certified", "FERPA-ready" or "live" unless an approved evidence entry exists (copy guide).

### 5.4 Approvals and consequential actions (`ActionPreview`)

Title = verb + object. Body = who is affected and what changes, in that order.
Footer = reversibility ("You can undo this for 8 seconds" / "This can't be
undone. Contact the Registrar to correct it"). Confirm button repeats the verb
("Submit grade change"), never "OK" or "Confirm". Pending states name the
owner and expected time: "Waiting for Dean's office · usually 2 business days
· Cancel request". Rejections give the reason and the next step.

### 5.5 AI

Always "AI-assisted", never "smart". Every output states what it used
("Based on your syllabus and 3 readings"), how sure it is when it matters,
and offers: report a problem, see sources, ask a person. Action-proposing AI
shows the preview first (tier 3+). Declines are specific and give a safe
route: "I can't change your grade. Your instructor can. Draft a message to
them". Never imply the AI is the registrar, gradebook, payment system or
a care provider. No streak/guilt/pressure copy.

### 5.6 Academic workflows

Deadlines: absolute date + time + zone when it differs from the institution's,
plus relative time ("Fri, Oct 9, 11:59 PM CT · in 5 days"). Hard moments never
say "overdue!" in red alone, "failing", or a miss count without a way forward.
Grades show provenance and "what counts" before the number. Registration
never shows a success state until the server confirms (audit: "no false
confirmation").

### 5.7 Support

Offer a human route at every dead end ("Ask a person"); say who answers and when.
Support access to a student's data is announced to the student and time-bound.
Status/incident copy uses the status page's five words (investigating, identified,
monitoring, resolved, scheduled).

### 5.8 Enforcement

`lint:terms` already ratchets retired words. Add: a **microcopy library**
(`content/microcopy.ts`, typed keys with the six-point fields) so strings are
reviewed once and reused; `i18n expansion budget` of +40 % per string checked
in the Sheet/Table/Button tests; reading-level check (target grade ≤ 9 for
system messages) as an advisory script, not a gate, until validated.

## 6. Accessibility specification

Baseline: WCAG 2.2 AA, with the repo's existing guards. This section states the
*specification*, the guard that holds it, and what is still unproven.

### 6.1 Focus
Visible ring on every interactive element: `--focus-color` (=`--app-accent-deep`,
≥4.5:1), 2px, offset 2px; survives forced-colors. Focus never lands under a
sticky region (`--focus-clear-top` 96px, `--focus-clear-bottom` 84px — WCAG 2.4.11).
Overlays trap, restore focus to the opener, and mark the background inert.
Route changes move focus to the page `h1`. Guard: `focus.test.ts`, `modal.test.ts`.

### 6.2 Keyboard
Everything reachable and operable; order follows reading order. Composite widgets
use the ARIA authoring pattern keys (roving tabindex for tabs/segmented/menus,
Arrow/Home/End; Escape closes the topmost layer only). Pressing outside a dialog dismisses it only if the press *and* the release were outside (`useScrim`), so a selection that overshoots does not close it. No hover-, drag- or
swipe-only action; every drag has a single-pointer alternative (2.5.7,
`dragging.test.ts`). Shortcuts are optional, discoverable and remappable
(2.1.4).

### 6.3 Contrast and colour
Text ≥ 4.5:1, large ≥ 3:1, non-text/UI and chart marks ≥ 3:1 (floor measured at
3.20), across **every surface the ground has**, not the flattering one
(CLAUDE.md contrast rule). New colour needs `contrast.test.ts` coverage across
all 13 grounds before merge. Forced-colors, `prefers-contrast: more`, and
`prefers-reduced-transparency` are supported today. Colour is never the only
signal (`tellings.test.ts`); §4.3 adds shape and fill as a second channel.

### 6.4 Screen reader
One `main`, one visible `h1`, landmarks, document title per screen. Every
control has a programmatic name (`lint:labels`). Status changes use the shared
**`Said`** (the one live region, `useStore().say`): `polite`, outcomes only, never
keystrokes; keyed on the time so a repeated sentence re-announces. Blocking errors
use `role="alert"` in the component that owns them (`ErrorState`). Whether to add
rate-limiting for a sync burst is open: it has not been shown to be a problem. Tables expose caption, headers and sort.
Provenance chips read as one phrase ("Official, from the Registrar, verified,
updated today"), not four fragments; glyphs are `aria-hidden`.

### 6.5 Touch targets
44px primary touch controls; 24px WCAG 2.5.8 minimum for crowded composites
with keyboard parity and a test; `.tap` expansion for small glyphs; enforced at
all three densities (`taps.test.ts`, `reach.test.ts`, `sweep:targets`). Spacing
between adjacent targets ≥ 8px at compact.

### 6.6 Reduced motion, cognitive load, dyslexia-aware mode
**Reduced motion** is honoured from the OS and from Semester's own *Less motion*
and *Low stimulation* settings (`--motion-*` zeroed; scripted scroll too). No
essential meaning depends on motion; no parallax, no looping decoration, no
fake progress.

**Cognitive load.** One primary action per decision region; progressive
disclosure by default (`Fold`); plain-language purpose sentence per screen;
no time limits without extension (2.2.1); errors preserve input; consistent
help location (3.2.6); undo preferred to confirm for reversible actions; a
*Focused* workspace mode that hides everything but the current task.

**Reading comfort (revised in Slice 5).** The first draft said no preset exists.
One does: `PRESETS` in `lib/accessmode.ts` has **Easier reading** (`textSize: large`,
`lineHeight: airy`, `readingWidth: narrow`), plus Focus and Lower load, applied through
`setLook` and undone key by key; modes are never inferred from behaviour. That is the
mechanism to extend. What the draft proposed beyond it, and where each stands:

| Proposed | Status | Why |
|---|---|---|
| Atkinson Hyperlegible as the body face | **Built** | Bundled (SIL OFL, four Latin files, ~71 kB, fetched only when the face is picked; `src/styles/fonts-hyperlegible/OFL.txt` credits it; kept apart because the company site mirrors `fonts/` byte for byte). Verified in Chromium: the face reports `loaded` once selected. `lib/fontclaims.test.ts` keeps the check: every offered face must be an OS family or bundled, and every `@font-face` must have a file; its ledger is now empty |
| Letter and word spacing (`--tracking-body`, `--word-space`) | **Built** (`textSpacing` look key: Normal 0/0, Open 0.02/0.08em, Wide 0.05/0.16em) | Offered only after the sweep came back clean; a test refuses any step above the 0.12em / 0.16em the sweep measures. Set on `.device`, inherited by body text; `.chrome-text` keeps its own tracking, and components that set their own `letter-spacing` do not follow it |
| Comfortable density, Less motion | already settings | add to the existing preset if wanted |
| Left alignment, no italic emphasis | rule | enforce when the preset is extended |

**WCAG 1.4.12 text spacing: measured, and not met.** `readiness register` has said
since it was written that there is "no text-spacing (1.4.12) test". `npm run
sweep:spacing` (`scripts/spacing-sweep.mjs`) is that test, run against the real app in
Chromium: every destination at 420px and 1280px, the standard's own override
(line height 1.5, letter 0.12em, word 0.16em, paragraph 2em), reporting only what is
**new** compared with the same page before. Result on 4 October 2026: all 126 views
opened, 0 page errors, **6 of 63 screens lose text**, all by `text-overflow: ellipsis`:
the page title (`h1.chrome-text`: "Calendar" → "Calend…", "Edit the course",
"Term deadlines", "Take it with you" at 420px),
the Write templates' lines (`span.paper-line`: "What was covered" → "What was cov…",
five of them, at both widths), and two quiz rows on Courses and Calendar at 1280px.
Two of the probe's own first results were wrong and are corrected in the script's
header: it flagged a button whose label merely wrapped (the line box overflowed; the
glyphs did not), and every screen that scrolls (it read vertical scrolling as
clipping). Each was found by looking at the screenshot and fixed before the numbers
were believed; the built-in control (a fixed-height box that must be flagged and a
growing one that must not) passes at both widths.

**Fixed, and re-measured the same day.** The page title now wraps (`overflow-wrap`,
no `nowrap`/ellipsis; the header is a flex row with no fixed height), which cleared
the four title findings. The next-deadline title on a Courses card wraps too. Two
truncations are the design and are exempt **by name, with a reason, counted in the
output** (`EXEMPT` in the script): `.paper-line` (aria-hidden template thumbnails)
and `.mcell-name > span` (aria-hidden month-grid summary; the cell's label and the
day view carry the title). Result: 126 of 126 views opened, 0 page errors,
**0 of 63 screens with new loss**, 11 exempted boxes; control passes at both widths.
The reverse was checked: with the title fix reverted the sweep reports the four
findings again. Still not covered: placeholder text inside inputs (the Courses search
placeholder is cut at 420px under the override), which is not text content.

Reporting only what is *new* means truncation that was already there is not listed:
the Write title reads "Write a docume…" at 420px with no override at all, and the
spacing makes it worse. That is a pre-existing defect the sweep deliberately does not
count; a baseline run (spacing off) of the same probe would list it.

Limits, stated once: first view of each screen only, not other tabs, modals, empty or
error states; overlap is not measured; not a gate (it needs a browser and a dev server,
like the other sweeps). A clean run would mean "no new clipping or truncation on first
views", not "AA 1.4.12 met".

### 6.7 Language and internationalisation
Today: English strings only, `<html lang="en">` fixed, no RTL. Spec for when
translation starts: logical CSS properties only for new work (no `left/right`),
`dir` set with `lang`, string expansion +40 %, formatters from `lib/locale.ts`,
machine-translated policy never authoritative (copy guide). Add a
`logical-properties` lint ratchet now so the debt does not grow.

### 6.8 What is proven versus not
Proven by automation: axe on 15 rendered screens, 12 token/layout/contrast
guards, nightly browser contrast sweep. **Not proven: any manual assistive-technology
pass.** `AT-PASS-PROTOCOL.md` is written and unrun (pass owner unassigned);
NVDA, JAWS, VoiceOver (macOS/iOS), TalkBack, voice control, 200 %/400 % zoom and
forced-colors have no recorded result. Until it runs, the permitted claim is
"automated checks pass", never "accessible" (operating-standard claim ceiling).
Assign the pass owner, budget it, and make "AT pass current within one release
train" a release gate once run.

## 7. Governance, parity, versioning, regression

### 7.1 Claim ceiling and decision rights
Permitted claims: "specified", "guarded by named tests", "adoption N of M".
Prohibited: "complete reuse", "pixel consistency", "universal accessibility",
"fully governed". Decision rights: new pattern → DS-Components + DS-A11y
approve; new token category → DS-Foundations; colour → contrast test across 13
grounds; vocabulary change → DS-Content + DS-Trust; **exception to any guard →
DS-A11y, recorded in the exceptions register with expiry.** With one human
owner, an approval is a recorded self-review; record it as such and add a
second reviewer per path in `CODEOWNERS` as soon as one exists (the file already
notes this). A decision lives at `docs/decisions/D-<PR number>.md`.

### 7.2 Figma ↔ code parity
No Figma file, Code Connect mapping, or token export exists. Procedure, in
order, each step independently useful:

1. **Single direction of truth for tokens: code → Figma.** `tokens:export` (§3.3) feeds a Figma variables collection with the same collections/modes (13 grounds, 3 densities, text scales, corner styles).
2. **Components: Figma mirrors the inventory (§2.1), one-to-one by name.** Each Figma component carries variant properties equal to the TS props and a description linking the contract.
3. **Code Connect** maps each stable component to its source file/props; mapping files live in `app/design/figma/*.figma.tsx` and are reviewed with the component.
4. **Parity check (scheduled, non-blocking at first):** nightly job diffs the exported token JSON against the Figma variables export and lists missing/mismatched tokens and components with no Code Connect mapping. Report, don't fail, until two consecutive clean weeks; then gate token PRs.
5. **Change flow:** design change → Figma branch → review → PR links the Figma frame; code change that alters a token regenerates the export and must show the Figma diff. Drift is a defect with an owner and a date, tracked in DESIGN-DEBT.

### 7.3 Versioning
Two independent semver tracks, recorded with Changesets once the package exists
(§10; before that, a `CHANGELOG` section per DS release):

- **Tokens** `tokens@x.y.z`: patch = value change that preserves contrast and meaning; minor = new token or new mode; **major = rename, removal, or meaning change.**
- **Components** `@semester/ui@x.y.z`: patch = fix with no API/visual-contract change; minor = new optional prop/variant; major = removed/renamed prop, changed default, changed keyboard or announced behaviour (an a11y behaviour change is always at least minor and always documented).
- Stability labels: `alpha` (no guarantees, not used in production screens), `beta` (API may change in a minor), `stable` (semver), `deprecated`.
- Every release note states: what changed, who is affected, migration step, and the guard that proves it.

### 7.4 Deprecation
Lifecycle: **Propose → Deprecate → Migrate → Remove**, mirroring the platform's
"identify → measure usage → communicate → migrate → deprecate → remove".

1. *Deprecate:* mark `@deprecated` with the replacement; add a DESIGN-DEBT row and a lint warning on new imports; announce in the release notes.
2. *Migrate:* codemod or a documented one-file recipe; usage counted by `census:design`; no new uses allowed (a ratchet, like `hex.test.ts`).
3. *Remove:* only at zero uses, after at least one full release train **and** at least 30 days from deprecation, in a major version; the removal PR links the census showing zero.
4. Tokens are never removed while aliased by a component token or a user setting; **never silently remove anything that stores a student's saved setting** (look keys migrate; older builds' hydration was not verified in the migration plan — check before any look-key change).

First deprecation candidates: `.portal-*` buttons, `lib/where.ts`, bespoke sheets after `Sheet` lands, half-step type sizes for new work.

### 7.5 Visual regression (DD-010, unbuilt)
Why it isn't built: fonts render differently between a container and the CI
runner, so baselines must be generated **on the runner**. Specification:

- Playwright `toHaveScreenshot`, run in CI only; baselines committed per runner image, regenerated by an explicit labelled workflow, never locally.
- Matrix, kept small to stay reviewable: widths 375 / 768 / 1280; grounds Ink, Parchment, Industry, Fog; density Comfortable and Tight; calm on/off for motion-bearing components; forced-colors one pass; 200 % zoom one pass. Later: 320 / 430 / 1024 / 1440.
- Subject: a **component gallery route** (a dev-only page rendering every stable component in every state) plus six canonical screens (Today, Calendar, Gradebook, Course, Settings, a Console queue). Components are tested in isolation so a pixel change names its cause.
- Tolerance: zero for tokens/layout; a small per-component threshold documented in the contract for anti-aliasing. Failure uploads the diff as an artifact; an intentional change is approved by updating baselines in the same PR, with the Figma frame linked.
- Not a substitute for `contrast.yml` (colour correctness) or axe (semantics); it detects *unintended change*.

### 7.6 Measurement
`census:design` is the adoption instrument but its figures are undated and
disagree across docs. Make it print commit hash and ISO date, write
`design-census.json`, and publish deltas in each DS release note. Track:
Page-framed screens (73/86 today), `ActionButton` vs raw `<button>` (314 vs
1,089), `EmptyState` files (25), `SourceBadge`/`provenance` files (5), hex
literals (28–30), legacy breakpoints (19), off-scale values (27), deprecated
imports. **Adoption numbers go in release notes; they are never claimed as
"consistency".**

## 8. Device and audience patterns

### 8.1 Shells
| | Compact + medium < 840 | Expanded 840–1199 | Large ≥ 1200 |
|---|---|---|---|
| Navigation | bottom bar (5) + sheet launcher | rail + sheet | persistent rail + contextual panel |
| Content | single column, `--layout-measure` | one column + optional side panel | up to `--layout-operational` (1180px) |
| Overlays | bottom sheet | side sheet / dialog | side sheet / dialog / popover |
| Tables | scroll region or stacked rows | scroll region | full table |
| Primary action | reachable in thumb zone, never hidden by keyboard | in header | in header |
| Density default | Comfortable | role default | role default |

Window width may change *how* something is reached, never *whether* (`widthgate.test.ts`).

### 8.2 Mobile specifics
Safe-area insets; sticky regions never cover focus (`--focus-clear-*`); inputs ≥ 16px to prevent zoom; offline and sync states first-class (`OfflineStrip`, `SaveState`); drafts survive backgrounding; no gesture-only action; support Dynamic Type/browser font size (text scales from the browser root).

### 8.3 Tablet
Split view is the opportunity: list + detail with provenance drawer docked, not modal. Pointer and touch are both primary: 44px targets *and* visible hover states; no hover-only information.

### 8.4 Desktop
Keyboard-first: command palette, documented shortcuts, focus never trapped outside modals, visible row focus in dense tables, multi-select with Shift/Ctrl and announced counts.

### 8.5 Assistive technology contexts
Screen reader + keyboard are the reference path, not an afterthought: the golden journeys in `AT-PASS-PROTOCOL` are the acceptance script. Voice control: visible label equals accessible name (2.5.3), so "click Submit grade change" works. Switch/eye-tracking: no timing-dependent interaction. Zoom/reflow: 400 % at 320 CSS px without two-dimensional scrolling for primary tasks (`smoke:a11y`). Captions/transcripts for any media.

### 8.6 Audience-specific rules (same components, different defaults)
- **Student:** Guided, comfortable; AI visible but optional; no institutional jargon.
- **Faculty/advisor:** Snug; queues and exceptions lead; every student-linked view shows its **grant scope** ("Showing students in MATH 2300, Fall 2026") because visibility is limited to verified course/term grants.
- **Staff/registrar/finance:** Detailed; bulk actions require `ActionPreview` with count and sample; four-eyes where policy demands; audit-notice line on sensitive reads.
- **Guardian/family:** only what was shared, labelled with who shared it, scope and expiry; revocation one tap away; no inference of anything not shared; age/consent rules decide visibility, never the UI.
- **Institution theming:** a tenant may supply a logo and **one accent chosen from a pre-audited ramp**; it cannot alter status, provenance, focus, chart or neutral tokens, and it passes the same 13-ground contrast test. Anything beyond that is out of scope until a tenant-theming decision exists. (No tenant token mechanism exists today.)

## 9. QA checklist and handoff

**One checklist, many pointers.** This section is the canonical design-QA
list; GOVERNANCE §3, COMPONENT-RELEASE-CHECKLIST and the PR template should
link here instead of restating it (resolves §0.1.7). Use one rubric:
the 11-criterion, 22-point screen audit in GOVERNANCE §4, with the
constitution's rubric retired.

### 9.1 Component PR gate (all must be true or explicitly waived by DS-A11y with expiry)
Pre-work: `git fetch origin main`, grep log for the thing (CLAUDE.md).
From `app/`:

- [ ] `npx tsc -b`, `npm run lint`, `npm run check:university`, `npm test`, `npm run test:shuffle`, `npm run build`
- [ ] Contract (§2.2) filled in; steward named; stability label set
- [ ] Tokens: semantic only; no hex, no off-scale px, no `--space-*`/`--radius-*`/`--shadow-*`; any new colour measured on all grounds against **every** surface
- [ ] States: default/hover/focus/active/disabled/loading/error/read-only/restricted/empty each present or marked N/A
- [ ] Keyboard map tested; focus return tested; Escape layering tested
- [ ] Names, roles, states exposed; axe clean; announcement text written
- [ ] Targets ≥ 44 primary / ≥ 24 minimum, at Comfortable and Tight
- [ ] Reduced motion, Low stimulation, forced-colors, increase-contrast, 200 % text, 400 % reflow
- [ ] Provenance prop present where §4.5 requires
- [ ] Copy from the microcopy library; `lint:terms` clean
- [ ] **A guard was shown to fail**: revert the fix under the new test and record the red run (CLAUDE.md); include a control case
- [ ] Roots unmounted in tests (`rootunmount.test.ts`)
- [ ] Screenshots: compact + wide, one dark and one light ground, plus greyscale for status components
- [ ] Figma frame linked; Code Connect updated; token export diff attached
- [ ] Release note: semver impact, who is affected, migration step
- [ ] Visual baselines updated (once §7.5 exists)

### 9.2 Handoff requirements (design → engineering)
A handoff is complete only with: the Figma frame (all states, all three widths,
dark and light ground, density extremes); the filled API contract; annotated
focus order and announced text; the content (from the library, with error and
empty copy); provenance mapping per data field; the data it needs and who
owns that data; analytics events; responsive rules by name; acceptance
criteria including an accessibility criterion per story; and a named
reviewer for each steward role. **Engineering rejects a handoff missing
states or copy; design rejects an implementation without the screenshot
matrix.** No "design in code review".

### 9.3 Screen definition of done
Page frame or documented exception; one primary action; purpose sentence;
every state in the audit's interface-state matrix (loading, empty, permission
denied, offline, sync pending, degraded dependency, validation failure, system
failure, approval pending, AI uncertainty, sensitive workflow) designed before
engineering starts; source and freshness on facts; works 320 px → desktop,
200 % zoom; keyboard and screen reader path stated.

## 10. First component library implementation plan

**Principle: extract by seam, behind the existing guards. No big-bang move.**
Each slice is one reviewable PR, ships dark (no screen adopts it) until its
guard is proven, and is reversible by deleting the file.

### Slice 0 — Housekeeping (days)
1. Fix the doc drift in §0.1 (danger colour, tone map, breakpoints note); add this spec and the four missing design docs to `docs/design/README.md`.
2. `census:design` emits commit + date + JSON.
3. Resolve the pending owner decisions listed in §11.
*Exit:* docs agree with the stylesheet; one canonical QA list.

### Slice 1 — Token export and breakpoint guard (built; PR pending)
- `lib/tokenexport.ts` + `npm run tokens:export` → `design-tokens/semester.tokens.json`. Variables are *discovered*: `tokensFor` is asked for every option of ground, accent, density, text size and corners, and a key whose value changes becomes a variable with modes (a variable that varies with several settings records each). The semantic layer is `tokens.css` as references; `app.css`'s `--sp-*`, `--type-*`, `--leading-*`, `--lift-*` are included with their multiplier. Ink variables carry per-ground contrast.
- `lib/tokenexport.test.ts`: snapshot, mode completeness, reference resolution, "exports everything `tokens.css` defines", control cases, determinism.
- `styles/breakpoints.test.ts`: §3.4.
- Not in this slice (moved): `--tracking-body`/`--word-space` → Slice 5 with the reading-comfort preset; the two unused motion roles → Slice 0 follow-up.
*Exit met:* each guard shown red against a deliberate break (a stray 777 px query, a fixed-but-unlisted legacy query, range syntax, a changed ground colour, a re-pointed semantic alias) and green when restored.

### Slice 2 — Provenance model (built; PR pending)
- `lib/factprovenance.ts`: the `FactProvenance` type, cue priority, role-neutral words, the sentence for a screen reader, and `fromSourceLabel` / `fromWhere` adapters (§4.2–4.4).
- `components/unity/ProvenanceChips.tsx` (+ styles in `unity.css`, reusing `.status-chip` and `--status-*`): origin plus at most two cues, hidden from assistive technology and replaced by one sentence.
- `ObjectCard` takes an optional `provenance`. **Not made required**: 36 call sites pass nothing today, and making it required is the migration, not this slice.
- **Not done:** `SourceBadge` still renders from `TrustKind`; no screen has adopted the chips yet (Gradebook, Today deadlines, Bill and Grades are the first candidates); the details drawer does not list cues beyond the two drawn; the design census does not yet count cards without `provenance`.
*Exit met:* every axis combination and the priority rule are tested; six deliberate breaks were each shown red (three cues, swapped priority, invented origin, assumed freshness, chips exposed to assistive technology, optional authority) and restored; rendered on Ink, Parchment and Fog in colour, greyscale and forced colours.

### Slice 3 — Scrim dismissal and ActionPreview (built; PR pending)
- **The Sheet primitive was dropped** (§2.3): the overlays share `useModal` already and differ in design; `ReviewSheet` is not an overlay. The Announcer was dropped earlier (`Said` exists).
- `useScrim` (`a11y/modal.ts`) fixes a real bug: a dialog closing when a selection is released over its backdrop. Adopted at all four such backdrops; `a11y/scrim.test.tsx` holds the behaviour and fails on any new bare-`onClick` backdrop.
- `components/unity/ActionPreview.tsx`; **ships unadopted**, for the reason in §2.3.
- Not done: `TileSheet` and `Command` have swipe/outside behaviours of their own and were not touched; `ApprovalTimeline` is still unbuilt; no dialog yet states its reversibility.
*Exit met:* the scrim bug reproduced in Chromium, then the real hook driven by real mouse input in the same browser (backdrop press+release closes; inner click, a drag from panel to backdrop, and a drag from backdrop to panel do not); the hook's behaviour and the tree-wide rule each shown red against a deliberate break; `ActionPreview` four deliberate breaks red (a dropped row, an empty label, a changed sentence, an optional `recovery` rejected by the compiler); existing suites for the four dialogs unchanged and green; axe clean; rendered on Parchment at 390px.

### Slice 4 — Table, Combobox, DateField (built; PR pending)
- `components/unity/Table.tsx`; `StudentGrades` adopted, with a characterization test written first against the old markup and passing unchanged after (and the 17 existing gradebook tests untouched).
- `components/unity/Combobox.tsx` + `lib/combobox.ts`; **ships dark**: no screen uses it yet. Migrating `TopBar` (it has `TopBar.test.tsx`), then `Command` and `TabFind`, is the next step and the proof.
- `components/unity/DateField.tsx` + `lib/datefield.ts`; ships dark.
- Not done: `InstructorBook` (editable cells, the faculty gradebook) and `DecisionTable` still hand-write their tables; a visible "this scrolls" affordance on a clipped table (`HorizontalOverflow` exists and is the candidate); the other ~28 `<table>` files; keyboard grid navigation (it is a data table, not an ARIA grid — arrow-key cell navigation is deliberately absent and only needed for editable cells).
*Exit met:* axe clean on Table (both modes), Combobox (closed and open) and DateField, with a control proving the probe flags a real violation in jsdom; ten deliberate breaks each shown red (lost `aria-sort`, a table that reorders its own rows, a stacked table that drops a column, a scroll region that is not focusable, a row header demoted to a cell in the real gradebook, no blur handling, a pointer press that steals focus, Home/End hijacked, exclusive date bounds, the UTC date trap under `TZ=America/Chicago`), and an eleventh for the stacked-caption CSS rule, a bug no jsdom test could see and only the screenshot found; rendered on Ink and Parchment at 390 and 1000px with no sideways page scroll.

### Slice 5 — Reading comfort and role defaults (partly built; PR pending)
Built:
- `scripts/spacing-sweep.mjs` / `npm run sweep:spacing`: the missing WCAG 1.4.12 test (§6.6), with a control and two corrected false positives. **It found real losses**; they are listed in §6.6 and fixed in Slice 5 (title, deadline row; two by-design truncations exempted by name).
- `lib/fontclaims.test.ts`: every offered typeface must be an OS family, bundled, or on a shrink-only ledger. Records "Hyperlegible is not bundled" as the one entry.
- `sweepscreens.test.ts` now holds the new sweep to the shared screen registry.

Deliberately **not** built, with reasons in §3.5 and §6.6:
- *Spacing controls (`--tracking-body`, `--word-space`)*: unsafe until the six truncations are fixed.
- *Atkinson Hyperlegible*: needs the bundling decision.
- *Role density defaults*: "has not chosen" is not representable without a data-model change, and it cuts across the app's never-inferred rule; the recommendation is to offer, not default.
- *A new "Reading comfort" preset*: one exists; it should be extended after the above.

*Next, in order:* (Role density offer: built as option (a), `denserLayoutFor` in `lib/role.ts`, shown beside the role picker; choosing a role never changes density, which a test pins. Atkinson Hyperlegible: bundled, four Latin files, `fontclaims` ledger now empty.) Remaining: second reviewer and assistive-technology pass. (Truncations: fixed, §6.6. Spacing control and the Easier reading preset's `textSpacing: 'open'`: built.) The readiness register's "no 1.4.12 test" line is now out of date; updating it regenerates documents and the claims register, so it is left for the owner of those claims.

### Slice 6 — Gallery and visual regression
**Built, with the CI decision left open.** `src/gallery/stories.tsx` draws the stable components in the states that matter (provenance chips, Table scrolling/stacked/empty, Combobox, DateField, ActionPreview in each recovery, ObjectCard with provenance); `pages.tsx` renders them under ink, parchment and fog with the real `tokensFor`. `npm run gallery:shots` screenshots them at 420 and 1280 and compares with a runner-generated baseline in `app/.gallery/` (gitignored; `--update` writes it). Controls: the same page twice must be identical, and a changed page must differ. Checked against a deliberate CSS change: all six shots reported changed; restored, zero. `gallery.test.tsx` makes every component in `components/unity/` have a story or a reason on a shrink-only ledger (17 app-level components have none yet), and proves the gallery does not read the clock, which caught `ObjectCard` measuring ages from the real `now` (it takes an optional `now` now).
**Not done:** a CI job. It needs a baseline produced on the CI runner and a decision on whether it blocks; the plan above (non-blocking for two weeks, then blocking for token/layout paths) stands, and wiring it is left to the owner of `ci.yml`.

### Slice 7 — Figma parity
Variables import, component set, Code Connect for the stable components, nightly parity report (§7.2). Gate token PRs after two clean weeks.

### Slice 8 — Package extraction (only now)
Move stable components, tokens export and the guards that test them into `packages/design-system` (the audit's target), keep `app/` consuming it, introduce Changesets and the semver tracks (§7.3). Verify `check:university`: **nothing under `supabase/functions/` may be imported by the gateway** (TS1287, #803). Native clients consume the JSON export, not React code.

### Slice 9 — Retire duplicates
Migrate raw `<button>` to `ActionButton`, `.portal-*` to shared buttons, `where.ts` removal, bespoke sheets, half-step type, legacy breakpoints — each under §7.4, tracked by census ratchets.

**Sequencing rationale:** provenance and Sheet/ActionPreview before packaging,
because trust and consequence are where the product's risk is, and packaging
before they are right would just move the inconsistency into a package.

**Risks:** one owner and no independent reviewer (mitigate: guards as the
reviewer, second `CODEOWNERS` entry as soon as possible); runner-font drift in
visual tests (mitigate: runner-generated baselines); look-key hydration across
versions (mitigate: add a migration test before changing any key); scope creep
into a tenant-theming product (mitigate: §8.6 limits to logo + one audited
accent until a decision exists).

## 11. Open decisions for the owner (not decided here)

| # | Decision | Recommendation |
|---|---|---|
| 1 | DD-003: "Institution verified" → "Official · {authority}" | Yes, keep the DB value. The word is one constant (`OFFICIAL_WORD` in `lib/factprovenance.ts`), so the change is one line plus the tests that name it |
| 2 | Atkinson Hyperlegible: bundle with the app? | Yes; needed for the Reading comfort preset and offline |
| 3 | ~~Canonical breakpoint source~~ | Settled by the code: `lib/media.ts` 600/840/1200/1600. Open: when to move the six queries still at 759/1179/1180 |
| 4 | Who is the second reviewer / AT pass owner? | Name both; both are currently blank |
| 4a | Bundle Atkinson Hyperlegible (SIL OFL)? | Yes: it is already offered and currently misdescribed. Needs the font file and an OFL entry in the supply-chain ledger |
| 4b | Role density: offer on role pick, default via `'auto'`, or nothing? | Offer on role pick (§3.5) |
| 5 | Tenant theming scope | Logo + one audited accent only, for now |
| 6 | When does `packages/design-system` extraction start? | After Slice 3 passes |
| 7 | Which of the two screen rubrics survives? | The 22-point GOVERNANCE one |

## 12. What this document did not verify

It was written from reading the repository, not from running it. The component
inventory states (E/P/G) come from a code survey and a file listing; **verify a
"G" with a grep before building it** — several primitives may exist under other
names across ~110 flat screen files. Gate commands were not re-run for this
document because it changes no code. The survey did not read
`components/institutional/` in depth, `docs/EMPTY-LOADING-ERROR-SUCCESS-STATES.md`,
`INTERACTION-STANDARDS.md` in full, or the audit PDF beyond pages 1–34, so
institutional-console component details and any design section later in the
audit are not reflected. No claim in this document is evidence that any
capability is live, accessible, or compliant.
