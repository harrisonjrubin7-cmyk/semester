# Semester design-system baseline

Read-only audit taken before the design-system hardening work (5 October 2026,
`origin/main` at `5eba494`). Every figure was read from the tree with the command
beside it; none is carried over from another document. Where this page and the
stylesheet disagree, the stylesheet is right.

The attached strategy document is a reference for intent only. It was written
largely for a greenfield pnpm/Tailwind/Storybook monorepo, and its own
repository-analysis section says those templates are wrong for Semester. Nothing
here adopts that structure.

## 1. Current architecture

| Concern | What exists | Evidence |
|---|---|---|
| Frontend stack | React 19, Vite 8, TypeScript 7, Vitest 5, jsdom, oxlint. No Tailwind, Storybook, pnpm or component library. | `app/package.json` |
| Package management | npm workspaces (`app`, `packages/*`), one lockfile at the root. Every script runs from `app/`. | root `package.json`, `CLAUDE.md` |
| Styling | Hand-written CSS with custom properties: `app.css` (11,287 lines), `unity.css`, `industry.css`, `features.css`, `tokens.css` and five smaller sheets. Inline `style={{}}` objects in TSX (6,439 sites). | `wc -l app/src/styles/*.css` |
| Token authority | Three layers. *Primitive* `--app-*`, `--r-*`, `--lift-*` are written per ground and setting by `tokensFor` in `lib/look.ts` or fixed in `app.css`. *Semantic* `--surface-*`, `--text-*`, `--status-*`, `--focus-*`, `--layer-*`, `--motion-*` and others live in `styles/tokens.css`. *Component* `--card-*`, `--bar-*`, `--sheet-*` are at the bottom of the same file. | `tokens.css` header |
| Export path | `tokens.css` + `lib/look.ts` + `app.css` primitives → `buildTokenExport()` in `lib/tokenexport.ts` → `design-tokens/semester.tokens.json` through `npm run tokens:export` (`TOKENS=write vitest run src/lib/tokenexport.test.ts`). | `app/package.json`, `tokenexport.test.ts:21` |
| Screens and components | 152 entries in `src/screens/`, 430 in `src/components/`. Shared frames `Page`, `SettingsPage`; shared controls in `components/ui.tsx` (`ActionButton`, `EmptyState`, `Notice`, `Segmented`, `TabList`, `Toggle`, `Meter` and others); the unified layer in `components/unity/` (`Table`, `Combobox`, `DateField`, `ActionPreview`, `ObjectCard`, `States`, `Status`, `ProvenanceChips`). | directory listings |
| Gallery | `src/gallery/stories.tsx` is a static story list read by `gallery.test.tsx` and `scripts/gallery-shots.mjs`. It is the repository's Storybook substitute. | `docs/design/README.md` |
| Contract and test enforcement | See §3. | |
| CI | One workflow, `ci.yml` (`build`, `account-sync`, `secrets`, `notify`), plus `contrast.yml` (nightly sweep), `docs.yml`, `codeql.yml`, `supply-chain.yml`, `drift.yml` (infrastructure, unrelated), and deploy workflows. | `.github/workflows/` |
| Claude configuration | `CLAUDE.md` (139 lines) and `.claude/` (`commands/`: `ask-tab`, `calendar-direct`, `simplify`; `skills/`: `run`, `add-course`, three vendored third-party skills). No `.mcp.json`, no `settings.json`. | `ls -a`, `ls .claude` |

## 2. Source-of-truth map

| Role | Location | Edited by hand? |
|---|---|---|
| Colour decision for 13 grounds × 11 accents | `app/src/lib/look.ts` (`tokensFor`, `GROUNDS`, `ACCENTS`) | Yes, with `lib/contrast.test.ts` |
| Semantic CSS tokens | `app/src/styles/tokens.css` | Yes |
| Foundational raw values | `look.ts`; the first `:root` block of `app.css` (type, spacing, leading, lift, ease); `industry.css` `:root` (the Industry system's own tokens) | Yes |
| Token export logic | `app/src/lib/tokenexport.ts` | Yes |
| **Generated export** | `app/design-tokens/semester.tokens.json` | **Never.** `npm run tokens:export` |
| Drift guard for the export | `app/src/lib/tokenexport.test.ts` (`matches the committed file`, `exports every token tokens.css defines`, `resolves every semantic reference`) | |
| Token reference page | `docs/DESIGN-TOKENS.md` (copy of `tokens.css`; stale if they differ) | Yes |
| Architecture and rules | `docs/DESIGN-TOKEN-ARCHITECTURE.md`, `DESIGN-SYSTEM-GUIDE.md`, `docs/design/*` | Yes |
| Breakpoints | `app/src/lib/media.ts` (600 / 840 / 1200 / 1600), held to `app.css` by `lib/tiers.test.ts` | Yes |
| Figma | **No role is defined and nothing exists.** `docs/design/DESIGN-SYSTEM-PRODUCT-SPEC.md` §7.2 says "No Figma file, Code Connect mapping, or token export exists" and proposes code → Figma as the single direction for tokens. | |

Figma's intended role, taken from the product spec and the task brief: an input
for approved visual intent. Code owns behaviour, accessibility, responsive
behaviour, public APIs and token values.

## 3. Existing strengths to preserve

| Asset | What it holds |
|---|---|
| `src/lib/tokenexport.test.ts` | Export equals the committed file; every `tokens.css` token is exported; every reference resolves; ink contrast ≥ 4.5 on all grounds; deterministic bytes; has a control against a vacuous diff. |
| `src/styles/tokens.test.ts` | Semantic layer points only at tokens that exist; writes no colour; shares no name with `industry.css`; layer ladder and focus ring pinned; every `--motion-*` zeroed for reduced motion and calm; `unity.css` animates only through motion roles and sets font sizes from the scale. |
| `src/styles/hex.test.ts` | Quoted hex colours in `.tsx` are on a per-file ledger with a reason each; may shrink, may not grow (30 today). |
| `src/styles/rules.ts` + `budget.ts` + `scripts/styles.mjs` | Font size, leading, spacing and shorthand drift in TSX on a generated per-file ledger (`lint:styles --fix`); `sheetLiterals` forbids named font faces and radii in CSS; `multipliers` keeps `--density`/`--text-scale` on tokens. Reports file, line and a suggested token. |
| `src/lib/contrast.test.ts`, `scripts/contrast-sweep.mjs`, `paint.mjs`, `contrast.yml` | Contrast on every ground, in tokens and in painted pixels. |
| `src/styles/{breakpoints,density,gutter,inset,reach,scale,stacking,taps,textscale,textbuttons,motion,glass,print,fields,deadcss,sweepdensity}.test.ts` | Responsive, touch-target (`taps`), stacking, density and motion contracts. |
| `src/a11y/*.test.ts` | Focus, landmarks, skip link, modal, motion, calm, labels (`lint:labels`), non-colour status (`tellings`), field errors, axe, titles. |
| `scripts/design-census.mjs`, `screen-audit.mjs`, `gallery-shots.mjs`, `accessibility-smoke.mjs` | Adoption figures, screen audit, visual baseline (not in CI), keyboard/reflow journeys in CI. |
| `rules.ts` `sources()` | Throws on an empty walk, so a rule cannot pass by checking nothing. Any new audit must use it. |
| `docs/design/GOVERNANCE.md` | New-pattern procedure: search first, show the existing one cannot serve, measure on all grounds. |
| `CLAUDE.md` proof rules | A guard must be shown to fail against a revert; include a control; ratchet ledgers. |

## 4. Gaps relative to the strategy document

| Area | Gap | Evidence |
|---|---|---|
| Claude persistent instructions | `CLAUDE.md` says nothing about design tokens, UI rules, Figma or what is generated. | `grep -ciE "token\|figma\|design" CLAUDE.md` → 0 |
| UI-generation procedure | No skill for building UI. The rules sit in `DESIGN-SYSTEM-GUIDE.md` and `docs/design/`, written for people. | `.claude/skills/` |
| Audit procedure | `/simplify` audits for duplicate screens and pathways, not token or state drift. `scripts/screen-audit.mjs` is a screen census. | `.claude/commands/simplify.md` |
| Figma mapping governance | No `.mcp.json`, no mapping, no ownership statement. | `ls .mcp.json` → absent |
| Token drift detection | Covered for the export. There is no single command that says so (`tokens:export` writes; the check is buried in the suite). | `app/package.json` scripts |
| Raw-value enforcement | Covered for TSX hex, TSX type/leading/space, CSS radius and font face. **Not covered:** colour literals in CSS outside `tokens.css`/`unity.css`; `rgb()`/`hsl()`/`oklch()` anywhere; `z-index`, `box-shadow`, duration and easing literals in CSS and TSX; arbitrary spacing in CSS. | §6 figures |
| Component and pattern discovery | `docs/design/GOVERNANCE.md` says "search first" but there is no machine-readable inventory; the component list lives in `ui.tsx` and `gallery/stories.tsx`. | |
| Accessibility and responsive checks | Strong tests exist but nothing tells an agent which apply to a change. | §3 |
| CI reporting | No design-system summary or artifact in any workflow. `census:design` prints and never fails. | `ci.yml` |

## 5. Risk classification

| # | Severity | Finding | Evidence |
|---|---|---|---|
| R1 | **Major** | Raw values in CSS are unguarded. `app.css` holds 66 hex, 56 `rgb()/hsl()/oklch()`, 36 `z-index`, 58 `box-shadow` and 34 `border-radius: Npx` lines; `features.css` 1 hex; `unity.css` 3 shadows. `hex.test.ts` reads quoted hex in `.tsx` only; `tokens.test.ts` reads two sheets. Many of those lines are token definitions in `:root`, but nothing separates definition from use. | per-file `grep -c`, `hex.test.ts`, `tokens.test.ts` |
| R2 | **Major** | Raw z-index, shadow and motion values in TSX are unguarded: 27 `zIndex:` literals, 356 `borderRadius`/`boxShadow`/`transition`/`animation` property sites. `tokens.test.ts` checks `zIndex` only under `src/ai/`. | `grep -rnE` over `src/**/*.tsx` |
| R3 | **Major** | Agents have no design-system instructions. A session asked for a screen has `CLAUDE.md` (no UI rules) and 300+ documents, and the repository has already seen duplicate work from agents that did not find existing assets. | `CLAUDE.md`, its "Check main" section |
| R4 | **Major** | No Figma integration or mapping. A Figma URL in a prompt has no protocol: nothing says which side wins, where variables map, or where unresolved mappings are recorded. | spec §7.2, no `.mcp.json` |
| R5 | Minor | No single "is the export in step" command or report. `tokens:export` writes; the guard is a test. | `package.json` |
| R6 | Minor | Documentation disagrees with itself on breakpoints: `docs/design/GOVERNANCE.md` §2 says 760 and 1180; `lib/media.ts` says 600/840/1200/1600. The spec §0.1 already lists this. Not changed here; the new skills cite `media.ts`. | `GOVERNANCE.md:34`, spec §0.1 |
| R7 | Minor | 14 of 99 screens have neither `Page` nor `SettingsPage`; 1,697 raw `<button>`s against 418 `ActionButton`s. Existing debt, tracked by `census:design`. Deferred. | `npm run census:design` |
| R8 | Minor | The visual baseline (`gallery:shots`) is not in CI. Deferred; needs a runner-made baseline. | `docs/design/README.md` |
| — | Blocker | **None found.** Typecheck and the three token/style contract files pass on `main`; no source-of-truth conflict was found. | `lint:styles`, `vitest run` of the three files: 27 passed |

Pre-existing failures: **none.** Measured on `main` before any change: `npx tsc -b`
exit 0; `npm run lint` exit 0 (one oxlint warning, within the 25 allowed); `npm test`
1,419 files passed and 1 skipped, 22,868 tests passed and 69 skipped.

## 6. Measured raw-value baseline (feature-facing, before this work)

From `grep` over `app/src`, tests excluded for TSX. These are rough, and they
count token definitions as well as uses. The audit added by this work counts uses
only and replaces them: 330 raw values across 50 files (colour 78, layer 55,
elevation 42, radius 12, motion 9, CSS spacing 81, CSS type 53), now on
`src/styles/rawbudget.ts`.

| File | hex | colour functions | z-index | shadow | `border-radius: Npx` | time | `cubic-bezier` |
|---|---|---|---|---|---|---|---|
| `styles/app.css` | 66 | 56 | 36 | 58 | 34 | 13 | 3 |
| `styles/industry.css` | 36 | 0 | 0 | 5 | 0 | 0 | 0 |
| `styles/features.css` | 1 | 0 | 0 | 2 | 4 | 0 | 0 |
| `styles/unity.css` | 0 | 1 | 0 | 3 | 0 | 0 | 0 |
| `styles/operating-rhythm.css` | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| `styles/tokens.css` | 0 | 0 | 0 | 0 | 0 | 15 | 1 |
| `.tsx` | 31 (ledgered) | — | 27 | 356 style properties for radius, shadow, transition and animation together | | | |

`tokens.css` is where durations and the easing curve are *defined*, which is
what a token file is for.

## 7. Minimal implementation plan

No new dependency, package, framework or token source. Everything extends an
existing file or follows an existing convention.

| # | File | Change | Why | Acceptance |
|---|---|---|---|---|
| 1 | `CLAUDE.md` | Add a "Design system" section: purpose, source-of-truth order, UI rules, accessibility, responsive, Figma protocol, completion criteria. Nothing existing is edited. | R3, R4 | Section present; existing sections byte-identical (`git diff` shows additions only). |
| 2 | `.claude/skills/build-semester-ui/SKILL.md` | Procedure for building UI from existing assets. | R3 | Frontmatter parses; every path and command it names exists (checked by test 8). |
| 3 | `.claude/skills/audit-semester-design-sync/SKILL.md` | No-edit audit and report format. | R3, R5 | Same. |
| 4 | `.claude/skills/create-semester-component/SKILL.md` | Gate for a new shared component. | R3 | Same. |
| 5 | `.mcp.json` | Remote Figma endpoint only, no credentials. | R4 | Valid JSON; contains no key other than `type` and `url`. |
| 6 | `docs/design-system/FIGMA-MAPPING.md` + `figma-mapping.json` | Ownership, rules, empty template, machine-readable manifest. | R4 | Validator accepts the empty template; rejects a mapping to a missing token. |
| 7 | `app/src/styles/designsystem.ts` | Pure functions: raw-value rules, per-file ledger comparison, mapping validation, report rendering. Uses `sources()`/`sheets()`/`withoutComments()` from `rules.ts`. | R1, R2, R4 | Tests in 9. |
| 8 | `app/src/styles/rawbudget.ts` | Generated per-file ledger of raw values already in the tree (same shape and `--fix` workflow as `budget.ts`). Growth fails; shrinking says to tighten. | R1, R2, and the "no false failure on legacy" requirement | Audit passes on the tree; adding one raw value to a clean file fails. |
| 9 | `app/src/styles/designsystem.test.ts` | Valid input passes; a planted raw value fails; a mapping to a missing token fails; a mutated source makes the export differ from the committed file; a control proves the walk reads real files; the skills and docs name only paths and scripts that exist. | Proof standard in `CLAUDE.md` | Each guard shown red against a revert, then restored. |
| 10 | `app/scripts/design-system.mjs` | CLI: `tokens`, `audit` (`--fix`), `mapping`, `report`, `check`. `tokens` runs the existing `tokenexport.test.ts`; it never builds a second export. | R1, R2, R4, R5 | Exit 1 on a finding, 2 when it could not run. |
| 11 | `app/package.json` | `tokens:check`, `design-system:audit`, `design-system:report`, `design-system:check`. | R5 | `lib/ci.test.ts` requires CI to run every `check:*` script; these are not named `check:*`, so CI runs them explicitly (step 12). |
| 12 | `.github/workflows/ci.yml` | One step after `Lint` running `design-system:check`; one `if: always()` step uploading `app/reports/design-system/`. Uses already-approved, SHA-pinned Actions only. | CI reporting | `supplychain.test.ts` and `deploygate.test.ts` still pass. |
| 13 | `app/.gitignore` | Ignore `reports/` (the report is regenerated, like `dist-site`). | Repository convention for derived output | `git status` clean after a run. |
| 14 | `docs/design/README.md`, `docs/developers/ONBOARDING.md` | Add the commands to the "enforced by code" table and the MCP setup to onboarding. | `docs:impact` tooling rule | `npm run docs:impact` passes. |

### Deferred on purpose

- Fixing the legacy raw values themselves (R1, R2): the ledger records them; shrinking it is separate work.
- Raw `<button>` and missing `Page` frames (R7), and the breakpoint text in `GOVERNANCE.md` (R6).
- Visual regression in CI (R8).
- Any Figma write, Code Connect, or a nightly Figma parity job: needs credentials and a real Figma file.
- A decision record. `CLAUDE.md` requires one to take its pull request's number and this task may not open a pull request, so none is written; one belongs in the PR that lands this.
- Extraction into `packages/*`, Style Dictionary, Storybook, Tailwind.

## 8. Assumptions, gaps and validation

- **No clarification is needed to proceed.**
- **Assumption:** raw values inside a custom-property *definition* (`--x: #fff;`) are token definitions, not uses, and are not counted. Feature rules that *use* a raw value are counted.
- **Assumption:** `industry.css` and the primitive `:root` of `app.css` are foundational. They are exempt by the same rule, not by a file allowlist.
- **Missing tooling:** none. Dependencies were installed with `npm ci` at the root.
- **Missing credentials:** a Figma account, a Figma file URL and variable metadata. The mapping manifest therefore ships as an empty template; no mapping is invented.
- **Validation commands (all from `app/`, all present in `package.json`):** `npx tsc -b`, `npm run lint`, `npm run check:university`, `npm test`, `npm run test:shuffle`, `npm run build`, `npm run docs:impact`, plus the four new scripts.
