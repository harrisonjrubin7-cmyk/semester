# Design system adoption audit (phase D0)

Status: **D0, audit only.** No product behaviour, style or component was
changed. Written 2026-10-04 against `origin/main` at `c170dcd`.

Companion documents, all in this folder:
[DESIGN_MIGRATION_MATRIX.md](DESIGN_MIGRATION_MATRIX.md) ·
[VISUAL_DEBT_REGISTER.md](VISUAL_DEBT_REGISTER.md) ·
[COMPONENT_INVENTORY.md](COMPONENT_INVENTORY.md) ·
[STATUS_AND_PROVENANCE_AUDIT.md](STATUS_AND_PROVENANCE_AUDIT.md) ·
[ACCESSIBILITY_GAP_AUDIT.md](ACCESSIBILITY_GAP_AUDIT.md) ·
[RESPONSIVE_SHELL_AUDIT.md](RESPONSIVE_SHELL_AUDIT.md) ·
[CONTENT_AND_VOICE_AUDIT.md](CONTENT_AND_VOICE_AUDIT.md) ·
[adr/README.md](adr/README.md) (ADR-0030 to ADR-0040, Proposed).

## 0. How to read this, and what it does not prove

- **The reference PDF was not available.** `Semester-Design-System-Reference.pdf`
  is not in the repository and was not in the upload. What was attached is a
  17-page analysis whose substance is the adoption prompt. This audit treats
  that prompt as the contract. Anything the PDF says beyond the prompt is
  unaudited. Supplying the PDF is a D1 precondition.
- **Counts are grep heuristics**, with the command or file named. Nothing was
  rendered, no screenshot was taken, and no test was run for this audit (the
  checkout has no `node_modules`). "Card-in-card" and "colour-only status" in
  particular need a DOM or render audit; this document says so where it matters.
- **Main was checked first** (CLAUDE.md). `git log -300 origin/main` shows no
  design-adoption work, no ADR-0030+, no rail/tab-bar rewrite, and no
  `docs/design/DESIGN_*` files. Not a duplicate. But the repository already holds
  a large design programme, listed in section 2, and this work builds on it.

## 1. Headline findings

1. **Most of the target library already exists; adoption is the gap.** The
   "unity" layer (`app/src/components/unity/`) already has `ContextBar`,
   `ObjectCard`, `NextSteps`, `ActionPreview`, `DecisionTrail`, `ProvenanceChips`,
   `StatusChip`, `SaveState`, `States` (Loading/Error/Success/Progress/
   StepStatus/PermissionNotice/OfflineStrip), `Table`, `Combobox`, and a gallery.
   But `ContextBar` is on 5 of ~89 screens, `StatusChip` has 4 call sites,
   `ActionPreview` has **zero** real call sites (stories only), and
   `lib/source.ts` is imported by 3 screens. Building a second kit would repeat
   the failure this brief forbids.
2. **The brief contradicts the repository's current visual contract in six
   places** (section 3). Those are product decisions, not engineering ones, and
   D1 cannot start until they are made.
3. **There are four trust vocabularies, not one**
   (`lib/source.ts`, `lib/status.ts`, `lib/where.ts`, `lib/factprovenance.ts`),
   they disagree on words and glyphs, and the dominant renderer (`SourceBadge`)
   shows a word with no glyph. See [STATUS_AND_PROVENANCE_AUDIT.md](STATUS_AND_PROVENANCE_AUDIT.md).
4. **The five-destination mobile bar already matches the target**
   (`lib/tabbar.ts:165`, behind `journeyNavigation`, on by default). The desktop
   rail does not: no groups, not always 248px, not Ink, no ⌘K entry, no 3px edge.
5. **The institution side has one scope bar, on one screen.**
   `components/console/ContextBar.tsx` (environment, scope, operator, role, MFA,
   session) exists only on the platform operations console. The institution tabs
   in `screens/University.tsx` have none. No staff surface uses `DecisionTrail`;
   audit references are not mono.
6. **Several requested surfaces do not exist as UI**: Tasks (logic only in
   `domains/tasks`), Advising as a route, Accessibility as a route, Marketplace,
   a tenant-level audit viewer, a tenant-settings screen, a rollout UI. The
   migration cannot "redesign" them; it has to decide whether to build them.
7. **Guards that would make the migration safe are missing.** Nothing fails on a
   hand-rolled badge, a source label without a glyph, an unstructured
   confirmation, emoji, exclamation marks, "user"/"learner" copy, or an icon-only
   control without a tooltip (labels are checked, tooltips are not).

## 2. What already exists (so nothing is rebuilt)

| Layer | Where | Note |
|---|---|---|
| Design contract (prose) | `DESIGN-SYSTEM-GUIDE.md`, `docs/design/*`, `docs/DESIGN-SYSTEM-MIGRATION-PLAN.md` (Phases 0-8, shipped on one branch), `docs/DESIGN-TOKEN-ARCHITECTURE.md`, `docs/TRUST-CUES-AND-SOURCE-PRESENTATION.md`, `docs/ELEVATION-AND-GLASS-POLICY.md` | This work extends them; it does not supersede them without an ADR |
| Brand | `docs/BRAND-PLATFORM.md` (Graphite and Brass; Source Line as signature device; brand-exempt zones §4.1) | In tension with the brief, section 3 |
| Debt register | `docs/design/DESIGN-DEBT.md` (DD-001..DD-010) | The new register cross-references it, section 5 of the register |
| Tokens (authority) | `app/src/lib/look.ts` (`GROUNDS` 13, `ACCENTS` 11, `tokensFor`) applied as inline custom properties by `App.tsx` | Runtime, not a build step |
| Tokens (semantic) | `app/src/styles/tokens.css` (252 lines, aliases only, no colour) | Guarded by `styles/tokens.test.ts` |
| Tokens (export) | `app/design-tokens/semester.tokens.json`, generated, test-checked | One direction only: CSS/TS to JSON |
| Components | `app/src/components/` (430 entries), `components/ui.tsx`, `components/unity/` | See COMPONENT_INVENTORY |
| Gallery | `app/src/gallery/` (6 stories, all in `unity/`), `scripts/gallery-shots.mjs` (not in CI) | Visual regression baseline is runner-made, not CI-enforced |
| Guards | `npm run lint` (oxlint + `scripts/styles.mjs` + `labels.mjs` + `terms.mjs`), 17 style tests, `lib/contrast.test.ts` (143 pairings), 14 `a11y/*` tests, `designcontracts.test.ts` | See section 6 |

## 3. Where the brief and the repository disagree (user decisions, blocking D1)

Each row is a conflict between the prompt's visual contract and what the repo
ships and has measured. None is resolved here. Each is carried by an ADR
marked **Needs decision**.

| # | Brief says | Repository today (evidence) | Why it matters |
|---|---|---|---|
| U-1 | Light mode content is Parchment; chrome is Ink | Default ground is **Ink (dark)** (`state/shape.ts:1547`); Parchment is only the "Match my device" light result (`look.ts:468`). 13 grounds are user-selectable | "Parchment content in light mode, Ink chrome always" implies a fixed pairing; today chrome follows the chosen ground |
| U-2 | Action colour is Semester blue (#416180 light, #94bce3 dark) | Default accent is **Sterling silver** (`state/shape.ts:1544`). The blue exists as the optional `industry` accent: dark `#94bce3`, light shade `#3f5e7c` (not `#416180`). `industry.css` also carries an unused `#5980a6` that fails contrast | Making blue the default changes the first-run look for every account; the light value must be re-measured, not copied |
| U-3 | Brass is editorial only, never a routine fill | `DESIGN-SYSTEM-GUIDE.md`: "Brass is a focus and action signal". `brass` and `gold` are user-selectable global accents; `BRAND-PLATFORM.md` uses Brass as the accent/focus colour | Direct reversal of a written rule |
| U-4 | Distinct hues for official/connected/AI/estimated/stale/success | "**One-colour rule**": one warning colour, success and info alias the accent (`--status-success` = `--status-info` = `--app-accent`); "reserve colour for one meaning and carry the rest in words and glyphs" (`COLOR-AND-DARK-MODE-SPEC.md`, `BRAND-PLATFORM.md` §2.2) | New hues must pass `contrast.test.ts` on all 13 grounds × every surface; this is the largest measurement job in D1 |
| U-5 | Flat Ink chrome, "quiet, not glossy" | `--chrome` is a brushed-metal 172° gradient (`look.ts:1757-1759`); the rail uses `--app-bg`, a hairline right border | Chrome is a brand device today (the three-slab mark, chrome text) |
| U-6 | Pure white is not the content canvas | Light grounds' `hero`/`raise` steps are `#ffffff` (Parchment, Paper, Bone). Canvas (`bg`) is off-white; cards on it are white | "Canvas" is already off-white; "surface" is white. Decide whether cards may be white |

Also resolved by the brief, and recorded so the decision is not lost:
**DD-003** ("Official" vs "Institution verified") is settled in favour of
**Institution verified** (prompt section 4). The DB-backed `SOURCE_LABELS`
stay untouched (`lib/source.test.ts` ties them to the migration).

## 4. Foundations measured against the target

| Target | Today | Verdict |
|---|---|---|
| Rail 248px | 72 (≥600) / `clamp(196,23vw,232)` (≥840) / **248 (≥1200)** / 272 (≥1600) (`app.css:752,768`) | Partial |
| Content max ~1180 | `--layout-operational: 1180px` (`tokens.css`, `app.css:25`) | Match |
| Page padding 18/20/30 | `--page-pad` 18 / 20 / 30 (`app.css:691-760`) | Match |
| Radii 3/6/10 | `--r-sm/md/lg` = 3/6/10 (`app.css:119-121`); user can switch to square/soft/round (`CORNERS`, `look.ts:600`) | Match by default; user-variable |
| Pills only for floating bars | `999px` ×32 in CSS, inline `borderRadius: 999` ×9, `'50%'` ×23; `--shape-pill` used ×3 | Fail: untokenised pills |
| No shadow on ordinary cards | 69 `box-shadow` declarations; shadows on `.desk-panel`, `.today-dominant-card`, `.action-panel-primary`, `.appicon-tile` and others | Partial |
| Motion 130/180/240/280 | Tokens match (`--duration-*`); literals 90/340/520/560 ms remain, mostly ledgered (`styles/motion.test.ts`) | Mostly match |
| 44px targets | `--target-primary: 44px`; `--target-icon: 40px` (below 44); `taps.test.ts` enforces | Match, one exception |
| Focus ring 2px action blue + offset | `outline: 2px solid var(--focus-color)`, offset 2px (`app.css:2776-2790`); **3px rings** at `app.css:2638, 11118, 11186`; separate ring in `industry.css:150-151,270` | Inconsistent; colour is accent-deep, not "blue" |
| Barlow / Barlow Condensed 600 / Cinzel / mono | Self-hosted woff2 (`styles/fonts`), `font-display: swap`; Cinzel loaded but used at 2 selectors (`app.css:481,2120`); mono hard-coded ×4 in `app.css` | Match; mono unmanaged |
| Blur only on tab bar and focus bar, opaque fallback | `glass.test.ts` allows 4 surfaces (`.app-header`, `.app-tabs`, `.soft-folder`, `.focus-bar`); fallbacks present | Header and folder exceed the brief's two |
| No gradients, no decorative imagery | 14 CSS gradients + JS chrome gradient; `<img>` only for user content/QR; emoji only in chat-reaction data | Gradients need review |
| Tokens authoritative | Three parallel scales: radius `--r-*` vs `--radius-*` (industry) vs `--shape-*`; shadow `--lift-*` vs `--shadow-*` vs `--elevation-*`; spacing `--sp-*` vs `--space-*`. 6,439 inline `style={{` in 358 files; 319 inline `borderRadius`; 261 `fontFamily` | Not authoritative; duplicates |
| Hard-coded colour | CSS hex: `app.css` 66, `industry.css` 36 (token source), `features.css` 1; rgb/hsl 56 in `app.css`; TSX hex 43 (ledgered by `styles/hex.test.ts`) | Ledgered, not zero |

## 5. Phase plan check (prompt sections 9 and your 8-step order)

Your eight-step order maps cleanly: 1 tokens/type/theme/trust vocabulary → D1;
2 shell → D2; 3-4 student surfaces → D3; 5-6 staff/console → D4; 7 secondary
student surfaces → D3 tail; 8 → D5/D6. Two changes are recommended in
[DESIGN_MIGRATION_MATRIX.md](DESIGN_MIGRATION_MATRIX.md): land the **guards**
(D6 items) alongside D1, not last, because they are what make D3/D4 reviewable;
and migrate by **component adoption** (put `ContextBar`, `ActionPreview`,
`SourceBadge`-with-glyph on existing screens) before any **restyle**.

## 6. Guards that exist, and what is not guarded

Exist: `styles/tokens.test.ts` (no colour in tokens.css), `scale.test.ts`,
`hex.test.ts` (TSX hex ledger), `motion.test.ts` (duration ledger),
`glass.test.ts`, `taps.test.ts`/`reach.test.ts`, `textscale.test.ts`,
`density.test.ts`, `deadcss.test.ts`, `lib/contrast.test.ts`,
`lib/tokenexport.test.ts`, `a11y/*` (axe over `<App/>`, landmarks, skiplink,
modal, labels, tellings, motion, calm), `pageframe.test.ts`,
`designcontracts.test.ts`, `decisionlabels.test.ts`, `lib/ops/clm018.test.ts`,
`content/terms.ts` retired-word ledger.

Not guarded (each becomes a D6 item): hand-rolled status/source badges;
glyph-plus-word parity across the four vocabularies; `ConfirmDialog` structure
(what changes / what does not / reversibility / who can help); `window.confirm`
(5 call sites remain); icon-only controls lacking a tooltip; AI output without
the AI label; "official"-looking facts without a source; emoji; exclamation
marks; "user"/"learner"; Title Case; date-format order; inline `borderRadius`,
`boxShadow`, `fontFamily`; nested cards; tenant branding reaching status,
consent, AI or accessibility UI (policy only, `lib/governance/config-tiers.ts:64`;
no consumer of `brand.accent_color` found).

## 7. Authorization and audit behaviour that must not move

Capability checks are advisory in the UI and enforced by RLS and RPCs
(`lib/capabilities.ts`, `lib/institutional-access.ts:1-8`: "Presentation context
is not authorization"). Restyling must not move a gate into, or out of, the UI.
Guards: `screens/console.test.tsx`, `lib/console/client.test.ts`,
`lib/ops/console.test.ts`, `consoleduties.test.ts`, `MfaStep.test.tsx`;
`packages/platform/src/isolation/isolation.test.ts`,
`lib/contract/tenantcontract.test.ts`, `lib/tablerls.test.ts`;
`supabase/*.check.sql` (console-approvals, gradebook, student-accounts,
configuration-studio, workflow-builder, advisor, records).

**Correction to the brief:** `app/src/isolation.test.ts` is about Vitest worker
isolation (which test files mock modules) and `app/src/keygate.test.ts` is about
AI-key gate buttons. Neither guards tenant isolation or authorization.

Role gating is by *hiding* (`lib/role.ts` `STUDENT_ONLY`, `lib/school.ts`
`allowed`), not blocking: `CurrentScreen` has no per-route guard, so
`#/console`, `#/registrar`, `#/gradebook` remain reachable by hash (the screens
re-check on render; the reducer was not verified for a redirect). A staff shell
must not assume the router blocks.

## 8. Risks

| Risk | Evidence | Mitigation |
|---|---|---|
| Rail rewrite breaks heavily tested chrome logic | `chrome.test.ts` enumerates nav × screen × width; `mediumrail.test.tsx` depends on `.rail`, `data-collapsed`, the 72px column; `widthgate.test.ts` row for `App.tsx` | Keep `chromeFor` semantics; change presentation inside it |
| URL scheme drift | `route.ts` `RETIRED`, `DOORS`, `?screen=`, manifest shortcuts, `#/room`, `?form` | `fromHash` must accept every old form (`route.test.ts`, `logindoor.test.tsx`) |
| Persisted state | `state.tabs`, `state.nav` (6 modes), `state.labels`, `state.role` | Additive changes only |
| Stylesheets are read as text by tests | `mediumrail`, `tiers`, `breakpoints`, `deadcss`, `textscale`, `density` | Rename/remove rules with the tests in the same change |
| Colour changes | 143 accent × ground pairings + faint rung on every surface | New hues measured against **every** surface (CLAUDE.md "Contrast") |
| Budgets | `perf-budgets.json` (`ai/Chat.tsx` 107 KB of 116 KB; first load 445 KB of 479 KB), `complexity-budgets.json` caps destinations at 63 | Adding rail groups/screens needs a budget change in the same PR |
| Two ⌘K handlers | `lib/keys.ts:180` and `ai/Assistant.tsx:517` | Rail ⌘K button reuses `state.finder` |
| Docs disagree on breakpoints | `RESPONSIVE-CONTRACTS.md` (600/1024) vs code and `ADAPTIVE-DEVICE-EXPERIENCE.md` (600/840/1200/1600) | Fix the doc to the code, D2 |

## 9. D0 gate recommendation

**PASS WITH DATED EXCEPTIONS** for the D0 deliverables.

- Exception E-1 (to 2026-10-11): reference PDF not supplied; contract is the prompt text.
- Exception E-2 (to D5): no rendered verification. Nested cards, colour-only
  status and clutter are unmeasured; counts are greps.
- Exception E-3 (to D1 start): U-1 to U-6 undecided.

**D1 is NO-GO until U-1 to U-6 are decided** and the PDF is supplied. The
smallest safe D1 slice that needs none of them: one trust vocabulary table
(ten source kinds plus the missing statuses, with an `announce` string), a
glyph on `SourceBadge`, and the D6 guards that fail on regression. See
[DESIGN_MIGRATION_MATRIX.md](DESIGN_MIGRATION_MATRIX.md) §1.
