# Figma mapping

How a Figma variable maps to a Semester token, so a design change and a code
change meet at a name both can check. Read with
[design/DESIGN-SYSTEM-PRODUCT-SPEC.md](design/DESIGN-SYSTEM-PRODUCT-SPEC.md)
§3.3 and §7.2, and [DESIGN-TOKENS.md](DESIGN-TOKENS.md) for what each token is.

## Status

**There is no Figma file for Semester yet, and nothing in this repository
writes to one.** Every row below is `Planned`: the export path exists and is
checked, the Figma variable it names has not been created or compared. A row
moves to `Match` or `Partial` when someone has diffed the Figma variables
against the export and written down what they found; `Obsolete` marks a
variable whose token was removed. The audit fails a row whose path does not
resolve and reports, without failing, a token that has no row yet (spec §7.2
step 4: report first, gate after two clean weeks).

## Direction of truth

Code to Figma. `app/src/styles/tokens.css` names the semantic layer,
`app/src/lib/look.ts` (`tokensFor`) decides every per-ground and per-setting
value, and `app/design-tokens/semester.tokens.json` is the generated copy that
Figma and native clients read. Figma is evidence of approved visual intent; it
is not where a token's value is chosen.

- Never edit `semester.tokens.json` by hand. Change the source, then
  `npm run tokens:export`, and commit the file with the change. `tokenexport.test.ts`
  fails when the two disagree.
- A pixel in a Figma frame is not a reason to write a literal. Map it to the
  closest token, or propose a token through the process in
  [design/GOVERNANCE.md](design/GOVERNANCE.md) §2, measured on all thirteen
  grounds.
- An incomplete Figma frame is not permission to omit keyboard support, a
  visible focus ring, empty, loading and error states, responsive behaviour
  or accessible names.

## Connecting Claude Code to Figma

The repository declares the remote Figma MCP server in `/.mcp.json`
(`type: "http"`, no credentials). Authorise it once per machine with `/mcp` in
Claude Code; the browser prompt keeps the credential out of the repository.
Use that or Figma's own Claude Code plugin, not both: two servers under two
names make tool selection less reliable.

Reads are what the audit needs (variables, nodes, components, screenshots).
A write to a Figma file changes a design other people are working in, so it
needs an explicit instruction for that change.

## Naming

- **Collection**: the setting that moves the value, capitalised: `Ground`,
  `Accent`, `Density`, `TextSpacing`, `TextSize`, `Corners`, plus `Stylesheet`
  and `Constant` for values no setting moves. Each option of the setting is a
  mode of the collection.
- **Primitive variable**: `<Collection>/<token key>`, the key being the CSS name
  without `--`: `Ground/app-panel`.
- **Semantic variable**: `Semantic/<family>/<rest>`, the token key split at its
  first hyphen: `surface-base` is `Semantic/surface/base`. A semantic variable
  is an alias of a primitive and has a single mode.
- A variable that varies with two settings (`r-md` moves with the ground and
  with corners, because the Industry grounds carry a corners opinion) sits in
  the first setting's collection; the other setting's values are in the
  export's `$extensions.semester.modes`.

## What the export does not model

Said once so no consumer assumes it (the same list is in the header of
`app/src/lib/tokenexport.ts`): settings are exported one at a time against the
default look, so `accent` values are those on the default ground and the 143
ground-by-accent pairings belong to `lib/contrast.test.ts`;
`prefers-contrast: more` is a second mode of every colour and is not exported;
the `[data-calm]` overrides in `tokens.css` and any value a component sets
inline are not tokens.

## Collections

| Figma collection | Exported path | CSS custom property | Parity |
| --- | --- | --- | --- |
| `Accent` | `collections.accent` | — | Planned |
| `Constant` | `collections.constant` | — | Planned |
| `Corners` | `collections.corners` | — | Planned |
| `Density` | `collections.density` | — | Planned |
| `Ground` | `collections.ground` | — | Planned |
| `Stylesheet` | `collections.stylesheet` | — | Planned |
| `TextSize` | `collections.textSize` | — | Planned |
| `TextSpacing` | `collections.textSpacing` | — | Planned |

Modes and variable counts are in `collections` in the export: ground
13 modes, accent 11, density 3, text size 4,
text spacing 3, corners 4.

## Primitives the semantic layer points at

| Figma variable | Exported path | CSS custom property | Parity |
| --- | --- | --- | --- |
| `Ground/app-accent` | `primitive.app-accent` | `--app-accent` | Planned |
| `Ground/app-accent-bright` | `primitive.app-accent-bright` | `--app-accent-bright` | Planned |
| `Ground/app-accent-deep` | `primitive.app-accent-deep` | `--app-accent-deep` | Planned |
| `Ground/app-accent-wash` | `primitive.app-accent-wash` | `--app-accent-wash` | Planned |
| `Ground/app-bg` | `primitive.app-bg` | `--app-bg` | Planned |
| `Ground/app-dim` | `primitive.app-dim` | `--app-dim` | Planned |
| `Ground/app-error` | `primitive.app-error` | `--app-error` | Planned |
| `Ground/app-error-line` | `primitive.app-error-line` | `--app-error-line` | Planned |
| `Ground/app-error-wash` | `primitive.app-error-wash` | `--app-error-wash` | Planned |
| `Ground/app-faint` | `primitive.app-faint` | `--app-faint` | Planned |
| `Ground/app-fg` | `primitive.app-fg` | `--app-fg` | Planned |
| `Ground/app-hero` | `primitive.app-hero` | `--app-hero` | Planned |
| `Ground/app-line` | `primitive.app-line` | `--app-line` | Planned |
| `Ground/app-line-soft` | `primitive.app-line-soft` | `--app-line-soft` | Planned |
| `Ground/app-panel` | `primitive.app-panel` | `--app-panel` | Planned |
| `Ground/app-raise` | `primitive.app-raise` | `--app-raise` | Planned |
| `Ground/app-void` | `primitive.app-void` | `--app-void` | Planned |
| `Ground/app-warn` | `primitive.app-warn` | `--app-warn` | Planned |
| `Ground/app-warn-line` | `primitive.app-warn-line` | `--app-warn-line` | Planned |
| `Ground/app-warn-wash` | `primitive.app-warn-wash` | `--app-warn-wash` | Planned |
| `Ground/chart-1` | `primitive.chart-1` | `--chart-1` | Planned |
| `Ground/chart-2` | `primitive.chart-2` | `--chart-2` | Planned |
| `Ground/chart-3` | `primitive.chart-3` | `--chart-3` | Planned |
| `Ground/chart-4` | `primitive.chart-4` | `--chart-4` | Planned |
| `Ground/chart-5` | `primitive.chart-5` | `--chart-5` | Planned |
| `Ground/chrome-ink` | `primitive.chrome-ink` | `--chrome-ink` | Planned |
| `Stylesheet/ease` | `primitive.ease` | `--ease` | Planned |
| `Constant/font-body` | `primitive.font-body` | `--font-body` | Planned |
| `Constant/font-heading` | `primitive.font-heading` | `--font-heading` | Planned |
| `Stylesheet/lift-1` | `primitive.lift-1` | `--lift-1` | Planned |
| `Stylesheet/lift-2` | `primitive.lift-2` | `--lift-2` | Planned |
| `Stylesheet/lift-3` | `primitive.lift-3` | `--lift-3` | Planned |
| `Ground/r-lg` | `primitive.r-lg` | `--r-lg` | Planned |
| `Ground/r-md` | `primitive.r-md` | `--r-md` | Planned |
| `Ground/r-sm` | `primitive.r-sm` | `--r-sm` | Planned |
| `Stylesheet/type-base` | `primitive.type-base` | `--type-base` | Planned |
| `Stylesheet/type-display` | `primitive.type-display` | `--type-display` | Planned |
| `Stylesheet/type-display-lg` | `primitive.type-display-lg` | `--type-display-lg` | Planned |
| `Stylesheet/type-display-sm` | `primitive.type-display-sm` | `--type-display-sm` | Planned |
| `Stylesheet/type-sm` | `primitive.type-sm` | `--type-sm` | Planned |
| `Stylesheet/type-sm-plus` | `primitive.type-sm-plus` | `--type-sm-plus` | Planned |
| `Stylesheet/type-xl` | `primitive.type-xl` | `--type-xl` | Planned |
| `Stylesheet/type-xs` | `primitive.type-xs` | `--type-xs` | Planned |

## Semantic tokens

| Figma variable | Exported path | CSS custom property | Parity |
| --- | --- | --- | --- |
| `Semantic/action/primary` | `semantic.action-primary` | `--action-primary` | Planned |
| `Semantic/action/primary-strong` | `semantic.action-primary-strong` | `--action-primary-strong` | Planned |
| `Semantic/action/secondary` | `semantic.action-secondary` | `--action-secondary` | Planned |
| `Semantic/bar/border` | `semantic.bar-border` | `--bar-border` | Planned |
| `Semantic/bar/surface` | `semantic.bar-surface` | `--bar-surface` | Planned |
| `Semantic/border/default` | `semantic.border-default` | `--border-default` | Planned |
| `Semantic/border/hairline` | `semantic.border-hairline` | `--border-hairline` | Planned |
| `Semantic/border/strong` | `semantic.border-strong` | `--border-strong` | Planned |
| `Semantic/border/subtle` | `semantic.border-subtle` | `--border-subtle` | Planned |
| `Semantic/brand/accent` | `semantic.brand-accent` | `--brand-accent` | Planned |
| `Semantic/brand/canvas` | `semantic.brand-canvas` | `--brand-canvas` | Planned |
| `Semantic/brand/focus` | `semantic.brand-focus` | `--brand-focus` | Planned |
| `Semantic/brand/ink` | `semantic.brand-ink` | `--brand-ink` | Planned |
| `Semantic/brand/muted` | `semantic.brand-muted` | `--brand-muted` | Planned |
| `Semantic/brand/surface` | `semantic.brand-surface` | `--brand-surface` | Planned |
| `Semantic/card/border` | `semantic.card-border` | `--card-border` | Planned |
| `Semantic/card/shape` | `semantic.card-shape` | `--card-shape` | Planned |
| `Semantic/card/surface` | `semantic.card-surface` | `--card-surface` | Planned |
| `Semantic/chart/axis` | `semantic.chart-axis` | `--chart-axis` | Planned |
| `Semantic/chart/estimated` | `semantic.chart-estimated` | `--chart-estimated` | Planned |
| `Semantic/chart/grid` | `semantic.chart-grid` | `--chart-grid` | Planned |
| `Semantic/chart/label` | `semantic.chart-label` | `--chart-label` | Planned |
| `Semantic/chart/muted` | `semantic.chart-muted` | `--chart-muted` | Planned |
| `Semantic/chart/stale` | `semantic.chart-stale` | `--chart-stale` | Planned |
| `Semantic/chart/student-entered` | `semantic.chart-student-entered` | `--chart-student-entered` | Planned |
| `Semantic/chart/verified` | `semantic.chart-verified` | `--chart-verified` | Planned |
| `Semantic/control/height-compact` | `semantic.control-height-compact` | `--control-height-compact` | Planned |
| `Semantic/control/height-standard` | `semantic.control-height-standard` | `--control-height-standard` | Planned |
| `Semantic/data/series-1` | `semantic.data-series-1` | `--data-series-1` | Planned |
| `Semantic/data/series-2` | `semantic.data-series-2` | `--data-series-2` | Planned |
| `Semantic/data/series-3` | `semantic.data-series-3` | `--data-series-3` | Planned |
| `Semantic/data/series-4` | `semantic.data-series-4` | `--data-series-4` | Planned |
| `Semantic/data/series-5` | `semantic.data-series-5` | `--data-series-5` | Planned |
| `Semantic/duration/fast` | `semantic.duration-fast` | `--duration-fast` | Planned |
| `Semantic/duration/instant` | `semantic.duration-instant` | `--duration-instant` | Planned |
| `Semantic/duration/sheet` | `semantic.duration-sheet` | `--duration-sheet` | Planned |
| `Semantic/duration/slow` | `semantic.duration-slow` | `--duration-slow` | Planned |
| `Semantic/duration/standard` | `semantic.duration-standard` | `--duration-standard` | Planned |
| `Semantic/ease/emphasized` | `semantic.ease-emphasized` | `--ease-emphasized` | Planned |
| `Semantic/ease/standard` | `semantic.ease-standard` | `--ease-standard` | Planned |
| `Semantic/elevation/floating` | `semantic.elevation-floating` | `--elevation-floating` | Planned |
| `Semantic/elevation/modal` | `semantic.elevation-modal` | `--elevation-modal` | Planned |
| `Semantic/elevation/none` | `semantic.elevation-none` | `--elevation-none` | Planned |
| `Semantic/elevation/raised` | `semantic.elevation-raised` | `--elevation-raised` | Planned |
| `Semantic/focus/clear-bottom` | `semantic.focus-clear-bottom` | `--focus-clear-bottom` | Planned |
| `Semantic/focus/clear-top` | `semantic.focus-clear-top` | `--focus-clear-top` | Planned |
| `Semantic/focus/color` | `semantic.focus-color` | `--focus-color` | Planned |
| `Semantic/focus/ring-offset` | `semantic.focus-ring-offset` | `--focus-ring-offset` | Planned |
| `Semantic/focus/ring-width` | `semantic.focus-ring-width` | `--focus-ring-width` | Planned |
| `Semantic/font/editorial` | `semantic.font-editorial` | `--font-editorial` | Planned |
| `Semantic/font/product` | `semantic.font-product` | `--font-product` | Planned |
| `Semantic/layer/base` | `semantic.layer-base` | `--layer-base` | Planned |
| `Semantic/layer/chrome` | `semantic.layer-chrome` | `--layer-chrome` | Planned |
| `Semantic/layer/curtain` | `semantic.layer-curtain` | `--layer-curtain` | Planned |
| `Semantic/layer/menu` | `semantic.layer-menu` | `--layer-menu` | Planned |
| `Semantic/layer/overlay` | `semantic.layer-overlay` | `--layer-overlay` | Planned |
| `Semantic/layer/raised` | `semantic.layer-raised` | `--layer-raised` | Planned |
| `Semantic/layer/skip` | `semantic.layer-skip` | `--layer-skip` | Planned |
| `Semantic/layer/sticky` | `semantic.layer-sticky` | `--layer-sticky` | Planned |
| `Semantic/layout/gutter` | `semantic.layout-gutter` | `--layout-gutter` | Planned |
| `Semantic/layout/measure` | `semantic.layout-measure` | `--layout-measure` | Planned |
| `Semantic/layout/operational` | `semantic.layout-operational` | `--layout-operational` | Planned |
| `Semantic/layout/reading` | `semantic.layout-reading` | `--layout-reading` | Planned |
| `Semantic/motion/insert` | `semantic.motion-insert` | `--motion-insert` | Planned |
| `Semantic/motion/panel` | `semantic.motion-panel` | `--motion-panel` | Planned |
| `Semantic/motion/progress` | `semantic.motion-progress` | `--motion-progress` | Planned |
| `Semantic/motion/save` | `semantic.motion-save` | `--motion-save` | Planned |
| `Semantic/motion/sheet` | `semantic.motion-sheet` | `--motion-sheet` | Planned |
| `Semantic/shape/card` | `semantic.shape-card` | `--shape-card` | Planned |
| `Semantic/shape/control` | `semantic.shape-control` | `--shape-control` | Planned |
| `Semantic/shape/pill` | `semantic.shape-pill` | `--shape-pill` | Planned |
| `Semantic/shape/sheet` | `semantic.shape-sheet` | `--shape-sheet` | Planned |
| `Semantic/shape/surface` | `semantic.shape-surface` | `--shape-surface` | Planned |
| `Semantic/sheet/elevation` | `semantic.sheet-elevation` | `--sheet-elevation` | Planned |
| `Semantic/sheet/shape` | `semantic.sheet-shape` | `--sheet-shape` | Planned |
| `Semantic/sheet/surface` | `semantic.sheet-surface` | `--sheet-surface` | Planned |
| `Semantic/state/destructive-text` | `semantic.state-destructive-text` | `--state-destructive-text` | Planned |
| `Semantic/state/disabled-surface` | `semantic.state-disabled-surface` | `--state-disabled-surface` | Planned |
| `Semantic/state/disabled-text` | `semantic.state-disabled-text` | `--state-disabled-text` | Planned |
| `Semantic/state/locked-border` | `semantic.state-locked-border` | `--state-locked-border` | Planned |
| `Semantic/state/preview-surface` | `semantic.state-preview-surface` | `--state-preview-surface` | Planned |
| `Semantic/state/readonly-surface` | `semantic.state-readonly-surface` | `--state-readonly-surface` | Planned |
| `Semantic/status/attention` | `semantic.status-attention` | `--status-attention` | Planned |
| `Semantic/status/attention-line` | `semantic.status-attention-line` | `--status-attention-line` | Planned |
| `Semantic/status/attention-wash` | `semantic.status-attention-wash` | `--status-attention-wash` | Planned |
| `Semantic/status/danger` | `semantic.status-danger` | `--status-danger` | Planned |
| `Semantic/status/danger-line` | `semantic.status-danger-line` | `--status-danger-line` | Planned |
| `Semantic/status/danger-wash` | `semantic.status-danger-wash` | `--status-danger-wash` | Planned |
| `Semantic/status/info` | `semantic.status-info` | `--status-info` | Planned |
| `Semantic/status/neutral` | `semantic.status-neutral` | `--status-neutral` | Planned |
| `Semantic/status/success` | `semantic.status-success` | `--status-success` | Planned |
| `Semantic/surface/base` | `semantic.surface-base` | `--surface-base` | Planned |
| `Semantic/surface/canvas` | `semantic.surface-canvas` | `--surface-canvas` | Planned |
| `Semantic/surface/critical` | `semantic.surface-critical` | `--surface-critical` | Planned |
| `Semantic/surface/feature` | `semantic.surface-feature` | `--surface-feature` | Planned |
| `Semantic/surface/modal` | `semantic.surface-modal` | `--surface-modal` | Planned |
| `Semantic/surface/overlay` | `semantic.surface-overlay` | `--surface-overlay` | Planned |
| `Semantic/surface/plain` | `semantic.surface-plain` | `--surface-plain` | Planned |
| `Semantic/surface/quiet` | `semantic.surface-quiet` | `--surface-quiet` | Planned |
| `Semantic/surface/raised` | `semantic.surface-raised` | `--surface-raised` | Planned |
| `Semantic/surface/sunken` | `semantic.surface-sunken` | `--surface-sunken` | Planned |
| `Semantic/target/compact` | `semantic.target-compact` | `--target-compact` | Planned |
| `Semantic/target/icon` | `semantic.target-icon` | `--target-icon` | Planned |
| `Semantic/target/min` | `semantic.target-min` | `--target-min` | Planned |
| `Semantic/target/primary` | `semantic.target-primary` | `--target-primary` | Planned |
| `Semantic/text/disabled` | `semantic.text-disabled` | `--text-disabled` | Planned |
| `Semantic/text/on-action` | `semantic.text-on-action` | `--text-on-action` | Planned |
| `Semantic/text/primary` | `semantic.text-primary` | `--text-primary` | Planned |
| `Semantic/text/secondary` | `semantic.text-secondary` | `--text-secondary` | Planned |
| `Semantic/text/tertiary` | `semantic.text-tertiary` | `--text-tertiary` | Planned |
| `Semantic/type/role-body` | `semantic.type-role-body` | `--type-role-body` | Planned |
| `Semantic/type/role-caption` | `semantic.type-role-caption` | `--type-role-caption` | Planned |
| `Semantic/type/role-compact` | `semantic.type-role-compact` | `--type-role-compact` | Planned |
| `Semantic/type/role-control` | `semantic.type-role-control` | `--type-role-control` | Planned |
| `Semantic/type/role-display` | `semantic.type-role-display` | `--type-role-display` | Planned |
| `Semantic/type/role-label` | `semantic.type-role-label` | `--type-role-label` | Planned |
| `Semantic/type/role-numeric` | `semantic.type-role-numeric` | `--type-role-numeric` | Planned |
| `Semantic/type/role-page` | `semantic.type-role-page` | `--type-role-page` | Planned |
| `Semantic/type/role-section` | `semantic.type-role-section` | `--type-role-section` | Planned |

## Components

Not mapped. Spec §7.2 steps 2 and 3 want each stable component in Figma
one-to-one by name, with variant properties equal to its TypeScript props and
a Code Connect file in `app/design/figma/*.figma.tsx`. Neither exists, and a
Code Connect file needs the Figma node it connects to, which needs the file. When
the file exists, map the stable components first (`components/ui.tsx`,
`components/Page.tsx`, `components/unity/`), one component per pull request,
and add a section here listing each with its source path and props.

## Changing a mapping

1. Change `tokens.css` or `look.ts`, run `npm run tokens:export`, and commit the
   JSON with the change.
2. Add, edit or remove the row. A rename or removal is a *major* token change
   (spec §7.3): leave the old row as `Obsolete` for one release.
3. `npm run design-system:check` from `app/` runs the audit and the tests that
   hold the export, the ledgers and these rows.
4. `npm run design-system:report` prints the drift summary, including every
   semantic token that still has no row.
