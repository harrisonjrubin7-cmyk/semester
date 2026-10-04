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
| Dyslexia-aware mode | only separate settings; no preset, no letter/word spacing | §6.6 |
| Component and token versioning, deprecation | grep of `docs/` finds nothing UI-specific | §7.3–7.4 |
| Figma ↔ code parity | no Figma, Code Connect, or token export | §7.2 |
| Visual regression | DD-010 "planned"; no pixel diff in CI | §7.5 |
| Breakpoint tokens | literals only; three docs disagree | §3.4 |
| Generic Sheet, Table, Combobox, Toast primitives | none found | §2 |
| A manual assistive-technology pass | AT-PASS-PROTOCOL: **not run** | §6.8 |

### 0.1 Contradictions found in the existing docs (fix before building on them)

These are real and each one will produce a wrong implementation if ignored.

1. **Danger colour.** `DESIGN-TOKEN-ARCHITECTURE` says `--status-danger` aliases `--app-warn`; `DESIGN-TOKENS` and DD-006 say `--app-error`. The stylesheet wins; treat the architecture doc as stale.
2. **Status colour vocabulary.** `STATUS-SOURCE-VISUAL-LANGUAGE` names Slate/Brass/Sage/Rose/Gray; the token docs say one warn colour plus shared accent; the constitution uses accent / `--app-passing` / warn / red. Four vocabularies, no tone→token table. §4.3 supplies the table.
3. **Breakpoints.** `lib/media.ts` has 760/1180 (+600 height); `RESPONSIVE-CONTRACTS.md` has 320–599/600–1023/1024+; `GOVERNANCE` screenshots at 375/768/1280. §3.4 reconciles: bands are test widths, 760/1180 are the layout switches.
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
   institutional fact accepts a required `provenance` prop; a missing one is a
   type error, not a review comment.
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
| | Combobox, date/time picker | P | `DeadlinePicker.tsx` is domain-specific | Components |
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
| | Generic Sheet / Drawer | G | four bespoke sheets share only the trap | Components |
| Data | Table (responsive) | G | only `DecisionTable`, gradebook | Components |
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
| | Live-region announcer | G | each component hand-rolls `aria-live` | A11y |
| | Readable-density / dyslexia preset | G | §6.6 | A11y |

Six gaps matter most because screens are re-implementing them now: **Sheet,
Table, ActionPreview, Announcer, Combobox/DatePicker, ApprovalTimeline.** They
are the first library work (§10).

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
Responsive rule at <760, 760–1179, >=1180, and 200% text / 400% reflow
Reduced-motion / calm / forced-colors behaviour
Density behaviour: comfortable/snug/tight, and per role (§8)
Content rules: label grammar, max length, truncation, i18n expansion budget
Provenance: required | optional | n/a
Tests: unit, axe, keyboard, and the mutation proof that the guard fails (§9)
Telemetry events (snake_case object_verb)
```

### 2.3 Worked contracts for the first three new primitives

**`Sheet`** (replaces `ExplanationSheet`, `ReviewSheet`, `TileSheet`, `SourceDrawer` shells)

```ts
type SheetProps = {
  label: string                       // required; accessible name
  open: boolean
  onClose: (reason: 'escape' | 'outside' | 'button' | 'route') => void
  presentation?: 'auto' | 'bottom' | 'side'   // auto: bottom <760, side >=760
  size?: 'sm' | 'md' | 'lg'
  returnFocusTo?: RefObject<HTMLElement>      // default: the opener
  dismissible?: boolean                        // false only for TypeToConfirm flows
  children: ReactNode
}
```
Built on `a11y/modal.ts` (trap, Escape, focus return); inert background;
`--layer-overlay`; 280 ms `--motion-sheet`, zero under reduced motion/calm;
never mounted inside the scroll pane (`stacking.test.ts`).

**`Table`** (responsive; the first real consumer is Gradebook)

```ts
type TableProps<Row> = {
  caption: string                     // required, visible or visually hidden
  columns: Array<{ id: string; header: string; cell: (r: Row) => ReactNode;
                   priority: 1 | 2 | 3; numeric?: boolean; sortable?: boolean }>
  rows: Row[]; rowKey: (r: Row) => string
  rowAction?: (r: Row) => { label: string; run: () => void }   // first action survives compaction
  compact: 'scroll' | 'stack'         // <760: scroll region (not the document) or stacked rows
  selection?: 'none' | 'single' | 'multi'
  empty: ReactNode                    // required EmptyState content
}
```
Real `<table>` semantics when columns are compared; stacked layout keeps row
identity and the first action (guide: lists vs tables). Sort state is exposed
via `aria-sort` and announced.

**`ActionPreview`** (the consequence-before-commit pattern, §5.4)

```ts
type ActionPreviewProps = {
  action: string                      // verb + object: "Submit grade change for MATH 2300"
  effects: Array<{ who: string; what: string }>   // who is affected, what changes
  reversible: { kind: 'undo' | 'request' | 'none'; window?: string; how: string }
  authority: Provenance               // who must/does approve
  needs?: 'confirm' | 'type-to-confirm' | 'second-person'
  onCommit: () => Promise<CommandResult>   // maps the audit's CommandResult states
}
```
Renders inside `ConfirmDialog`/`Sheet`. `status: 'pending_approval'` renders
the approval timeline with owner, SLA and cancel/edit rules (audit interface
state matrix, "Approval pending").

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
| Breakpoints | **literals** | §3.4 |
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

Media queries cannot read custom properties, so a breakpoint "token" is a
documented constant plus a guard, not a CSS variable:

| Name | Value | Meaning | Source |
|---|---|---|---|
| `compact` | < 760 | phone shell | `TABLET_AT` |
| `medium` | 760–1179 | tablet shell | |
| `wide` | ≥ 1180 | desktop shell | `DESKTOP_AT` |
| `short` | height < 600 | landscape phone | `TALL_AT` |

`RESPONSIVE-CONTRACTS` bands (320/600/1024) are **verification widths**, not
layout switches. Add `styles/breakpoints.test.ts`: every `@media` width in the
CSS must be one of the four above or appear on a ledger (19 legacy ones
today, ratcheting down, same mechanism as `hex.test.ts`). `lib/media.ts` is
the single source; CSS literals are checked against it.

### 3.5 Density and role

Density is a person's setting. Add a **default** by role, applied only when the
person has not chosen one:

| Role group | Default density | Default disclosure |
|---|---|---|
| Student, applicant, alumni, guardian/family | Comfortable | Guided |
| Faculty, advisor, TA | Snug | Focused |
| Registrar, finance, student-affairs, IT, support | Snug (Tight opt-in) | Detailed |

A role is **never** a permission (`lib/role.ts` contract); it selects defaults
and vocabulary only. Implement as `data-role-group` on the root and a single
defaults table in `look.ts`, not per-component overrides. Guard: `sweep:targets`
already runs all three densities; extend it to run each role-group default.

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

```ts
type Provenance = {
  origin:    'official' | 'connected' | 'user' | 'ai' | 'sample'   // who produced it
  assurance: 'verified' | 'unverified' | 'needs_review'            // has someone vouched
  freshness: 'current' | 'stale' | 'unknown'                       // + observedAt
  lifecycle?: 'pending' | 'submitted' | 'approved' | 'rejected' | 'revoked'
  access?:   'restricted'                                           // + who controls it
  authority?: string       // named office, e.g. "Registrar"; REQUIRED when origin='official'
  observedAt: string; system?: string
}
```

This is the audit's `SourceMetadata` with `origin` split so it stays honest,
and it is a **superset mapping**, not a rewrite (§4.4). Rules:

1. Axes are independent; the *display* shows the origin chip always, and adds
   at most two further cues, chosen by this priority: `restricted` > `stale` or
   `unknown` freshness > `needs_review` > `pending` > `verified`. Everything else
   goes in the details drawer (`SourceDrawer`), not on the row.
2. `origin:'official'` without `authority` is a type error. A badge cannot say
   "Official" without naming who.
3. `ai` always carries model-agnostic wording ("AI-assisted"), the sources used,
   and a route to a human for any tier ≥ 2 (audit AI tiers).
4. `stale` is computed from `observedAt` against a per-source freshness window
   set by the connector/health state, never hard-coded in a component.
5. Estimated values (`origin:'ai'` or computed) are styled to draw the eye
   *more* than official ones (existing `wantsAttention`), since they are the
   ones to double-check.
6. Never fabricate freshness: no "live", "current", "up to date" copy unless
   `freshness='current'` was derived from a real `observedAt`.

### 4.3 Visual encoding (the tone→token table that is missing today)

Every chip is **word + glyph + tone**; tone is never the only carrier
(`tellings.test.ts`). Colours map only to tokens that already exist and
already pass contrast on all 13 grounds; no new hue is introduced.

| Cue | Word | Glyph | Tone → token | Notes |
|---|---|---|---|---|
| origin official | Official · {authority} | ◆ | accent / `--status-success` family | filled |
| origin connected | Connected · {system} | ⇄ | neutral | outline |
| origin user | You | ◇ | neutral | outline |
| origin ai | AI-assisted | ✦ | attention (`--app-warn`) | wash background |
| origin sample | Sample | ○ | neutral | dashed border |
| verified | Verified · {by} | ✓ | success | adds to origin, never replaces it |
| needs review | Needs review | ? | attention | |
| stale | Stale · {age} | ↻ | attention | text always includes age |
| unknown freshness | Age unknown | ? | attention | |
| pending | Pending · {owner} | … | info | owner + SLA in drawer |
| restricted | Restricted · {who controls} | ⊘ | neutral, **lock glyph and text** | never a bare lock |
| blocked / failed | {What failed} | ! | danger (`--app-error`) | |

Distinguishing "filled / outline / dashed" gives a second non-colour channel
for origin, readable in forced colours and greyscale. Verify with a greyscale
screenshot and `forced-colors` run (§9).

### 4.4 Migration from today's vocabulary

| Today | Maps to | Open question |
|---|---|---|
| `institution_verified` | `origin:'official'`, `assurance:'verified'` | **DD-003**: this spec recommends the user-facing word "Official" plus the named authority, keeping the DB value `institution_verified` unchanged (names, not values) |
| `imported` | `origin:'connected'` if a refresh operates, else `origin:'user'`-imported + `freshness:'unknown'` | resolves the "Imported vs Synced" copy conflict: say **Imported** unless a continuing refresh exists |
| `student_entered` | `origin:'user'` | |
| `estimated` | `origin:'ai'`/computed, `assurance:'unverified'` | |
| `needs_review` | `assurance:'needs_review'` | |
| `ai_assisted` / `external` / `unavailable_stale` | `origin:'ai'` / `origin:'connected'` / `freshness:'stale'` | display-only kinds stay out of the DB union (constitution §7) |
| `Where` (`official, connected, made, yours, sample, stale`) | same axes | retire "Made here"/"Yours" wording |
| `StatusKey` sync keys (saving, synced, offline, queued, conflict …) | **not provenance**; stay in `Status.tsx` | sync state describes the app, not the datum |

Migration is a type-level adapter first (`toProvenance(sourceLabel, …)`), with
no data or DB change, and the five-value DB constraint untouched. Components
move one family at a time; `lib/where.ts` is deleted last, under §7.4.

### 4.5 Where provenance is mandatory

Grades, holds, balances and charges, registration status, degree-audit rows,
deadlines imported from an LMS, advisor/faculty notes, anything a guardian is
shown, every AI output, every record in an institutional queue. Optional on
purely personal content (a student's own note). Today **5 files** use
`SourceBadge`; the adoption target is a census-tracked number (§7.6), and the
rule "an object card renders an institutional fact only with `provenance`" is
enforced by type.

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
Arrow/Home/End; Escape closes the topmost layer only). No hover-, drag- or
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
**Announcer** (gap, §2): `polite` for save/sync/progress, `assertive` only for
blocking errors; one live region per page, messages de-duplicated and rate-limited
so a sync burst does not flood a user. Tables expose caption, headers and sort.
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

**Dyslexia-aware mode (new).** No dedicated mode exists; the parts do. Specify a
named **Reading comfort** preset that sets, in one place, existing settings plus
two new tokens, and is user-adjustable afterward:

| Property | Value | Mechanism |
|---|---|---|
| Body face | Atkinson Hyperlegible | existing `hyperlegible` bodyface (bundling decision still pending in the migration plan: **needs owner decision**) |
| Line height | 1.75 (Airy) | existing |
| Reading width | 52–66ch | existing Narrow/Normal |
| Text size | Large (1.09) minimum | existing |
| Letter spacing | +0.02em | **new** `--tracking-body` |
| Word spacing | +0.08em | **new** `--word-space` |
| Alignment | left, never justified; no italic for body emphasis | rule + lint |
| Density | Comfortable | existing |
| Motion/stimulation | Less motion on | existing |
| Underline/long-caps | none for emphasis; bold only | rule |

Offer it as a choice with a preview, not as a diagnosis; do not claim it
"helps dyslexia". The evidence for any single typeface is weaker than for
spacing, size and reduced crowding, so ship the spacing controls independently
and measure with users. This is a specification; **nothing is verified** until
the AT/user pass in §6.8 runs.

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
| | Compact < 760 | Medium 760–1179 | Wide ≥ 1180 |
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

### Slice 1 — Token export and breakpoint guard
`tokens:export` + snapshot test; `lib/media.ts` constants + `breakpoints.test.ts` with a ledger; `--tracking-body`/`--word-space`; delete or use the two unused motion roles.
*Exit:* JSON validates against the DTCG schema; export round-trips; ledger counts recorded.

### Slice 2 — Provenance model
`lib/provenance.ts` gains the five-axis type and `toProvenance()` adapters from `SourceLabel`/`Where`/`TRUST_KINDS`; `SourceBadge` renders from it with the §4.3 encoding; `provenance` required on `ObjectCard`.
*Exit:* tests for every axis combination and the priority rule; greyscale and forced-colors screenshots; no DB or stored-value change. Adopt on Gradebook, Today deadlines, Bill, Grades first (highest consequence).

### Slice 3 — Announcer, Sheet, ActionPreview
Build in that order (Sheet and ActionPreview depend on the announcer's policy). Migrate `ExplanationSheet` first as the proof, then `ReviewSheet`, `TileSheet`, `SourceDrawer`.
*Exit:* each passes the §9.1 gate including a reverted-fix red run; zero behaviour change in migrated screens, shown by their existing tests.

### Slice 4 — Table and Combobox/DatePicker
Gradebook is the first consumer (faculty value, highest density). Stacked and scroll compact modes both tested at 320.
*Exit:* axe, sort announcements, keyboard grid navigation, horizontal-scroll region not document.

### Slice 5 — Reading comfort preset and role-group defaults
Preset (§6.6) and `data-role-group` defaults (§3.5), extending `sweep:targets` to all combinations. Measure with at least a small set of real users; do not market until the AT pass has run.

### Slice 6 — Gallery and visual regression
Dev-only gallery route; Playwright screenshot job with runner-generated baselines (§7.5), non-blocking for two weeks, then blocking for token/layout paths.

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
| 1 | DD-003: "Institution verified" → "Official · {authority}" | Yes, keep DB value |
| 2 | Atkinson Hyperlegible: bundle with the app? | Yes; needed for the Reading comfort preset and offline |
| 3 | Canonical breakpoint source | `lib/media.ts` 760/1180; bands are test widths |
| 4 | Who is the second reviewer / AT pass owner? | Name both; both are currently blank |
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
