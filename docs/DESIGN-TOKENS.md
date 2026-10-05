# Design tokens — reference

Every token in `app/src/styles/tokens.css`, with the value it resolves to, and
the primitive scales it points at. Values are copied from the source; if this
page and the stylesheet disagree, the stylesheet is right and this page is
stale.

For how the layers fit together and the rules they keep, see
[DESIGN-TOKEN-ARCHITECTURE.md](DESIGN-TOKEN-ARCHITECTURE.md).

## Semantic tokens (`styles/tokens.css`)

### Surface

| Token | Value | Use |
| --- | --- | --- |
| `--surface-sunken` | `var(--app-void)` | Input wells, tracks, the page under cards on a lifted ground |
| `--surface-canvas` | `var(--app-bg)` | The page |
| `--surface-base` | `var(--app-panel)` | Standard content surface |
| `--surface-raised` | `var(--app-hero)` | Cards and active regions that sit above the base |
| `--surface-overlay` | `var(--app-raise)` | Sheets, menus, the Focus bar |

### Text

| Token | Value | Use |
| --- | --- | --- |
| `--text-primary` | `var(--app-fg)` | Anything a student reads to act |
| `--text-secondary` | `var(--app-dim)` | Second lines, explanations. Held to 4.5:1 |
| `--text-tertiary` | `var(--app-faint)` | Metadata and disabled labels only. Held to 3:1 on every surface |
| `--text-on-action` | `var(--chrome-ink)` | Text on the brushed-metal primary button |

The brief's "inverse text" is `--text-on-action`; there is no separate inverse
token.

### Border

| Token | Value |
| --- | --- |
| `--border-subtle` | `var(--app-line-soft)` |
| `--border-default` | `var(--app-line)` |
| `--border-strong` | `var(--app-accent-deep)` |

### Action

| Token | Value |
| --- | --- |
| `--action-primary` | `var(--app-accent)` |
| `--action-primary-strong` | `var(--app-accent-bright)` |
| `--action-secondary` | `var(--app-accent-wash)` |

The brief asked for default / hover / active / disabled action tokens. Those
states are drawn by the existing `.btn` rules in `industry.css` and `app.css`
and were not re-expressed as tokens.

### Status

| Token | Value | Why |
| --- | --- | --- |
| `--status-attention` | `var(--app-warn)` | The one colour the app spends |
| `--status-attention-line` | `var(--app-warn-line)` | |
| `--status-attention-wash` | `var(--app-warn-wash)` | |
| `--status-danger` | `var(--app-error)` | One rung above attention: hue 350 against 14, held to 6:1 where attention holds 4.5:1 (DD-006) |
| `--status-danger-line` | `var(--app-error-line)` | |
| `--status-danger-wash` | `var(--app-error-wash)` | |
| `--status-success` | `var(--app-accent)` | Calm states share the accent |
| `--status-info` | `var(--app-accent)` | |
| `--status-neutral` | `var(--app-dim)` | |

Tone is the least of three carriers: every status in `lib/status.ts` also has
a word and a glyph.

### Chart

Series colours are derived per ground by `chartFor` in `lib/look.ts` and written
by `tokensFor`; the roles below name them. Held by `lib/contrast.test.ts` › "the
chart series, on every ground". Rules for using them:
[DATA-VISUALIZATION-SYSTEM.md](DATA-VISUALIZATION-SYSTEM.md).

| Token | Value | Note |
| --- | --- | --- |
| `--chart-1` … `--chart-5` | derived per ground | Blue, green, amber, violet, slate. Each 3:1 or better on every surface of every ground (measured floor 3.20:1) |
| `--chart-verified` | `var(--chart-2)` | Institution-verified values |
| `--chart-estimated` | `var(--chart-3)` | Estimated or modelled |
| `--chart-stale` | `var(--app-error)` | Out of date or unavailable |
| `--chart-student-entered` | `var(--chart-4)` | Added by the student |
| `--chart-grid` | `var(--app-line)` | Decoration; not held to a ratio |
| `--chart-axis` | `var(--app-dim)` | Text, held to 4.5:1 |
| `--chart-label` | `var(--app-fg)` | Text |
| `--chart-muted` | `var(--app-faint)` | Metadata only |

`--app-error`, `--app-error-line` and `--app-error-wash` are the primitives
under `--status-danger`; `--chart-1` … `--chart-5` are primitives too, written
per ground.

### Focus

| Token | Value | Note |
| --- | --- | --- |
| `--focus-color` | `var(--app-accent-deep)` | Held to 4.5:1 against the panel by `lib/contrast.test.ts` |
| `--focus-ring-width` | `2px` | `app.css` keeps the literal `2px` because `a11y/focus.test.ts` reads it |
| `--focus-ring-offset` | `2px` | |
| `--focus-clear-top` | `96px` | `scroll-margin-top` on focus, clear of the frosted header (WCAG 2.4.11) |
| `--focus-clear-bottom` | `84px` | `scroll-margin-bottom`, clear of the tab bar |

### Target size

| Token | Value | Note |
| --- | --- | --- |
| `--target-min` | `24px` | WCAG 2.2 SC 2.5.8 floor |
| `--target-compact` | `32px` | |
| `--target-icon` | `40px` | |
| `--target-primary` | `44px` | The practical fingertip that `.tap` and `.btn` already reach |

### Motion

| Token | Value |
| --- | --- |
| `--duration-instant` | `0ms` |
| `--duration-fast` | `130ms` (the app's existing `--fast`) |
| `--duration-standard` | `180ms` |
| `--duration-slow` | `240ms` |
| `--duration-sheet` | `280ms` |
| `--ease-standard` | `var(--ease)` = `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--ease-emphasized` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| `--motion-save` | `var(--duration-standard) var(--ease-standard)` |
| `--motion-insert` | `var(--duration-standard) var(--ease-standard)` |
| `--motion-panel` | `var(--duration-slow) var(--ease-emphasized)` |
| `--motion-sheet` | `var(--duration-sheet) var(--ease-emphasized)` |
| `--motion-progress` | `var(--duration-standard) linear` |

Every `--motion-*` role becomes `0ms linear` under
`@media (prefers-reduced-motion: reduce)` and under
`:root[data-calm='still']` / `:root[data-calm='calm']`. The `--duration-*`
values are not zeroed; rules animate through the `--motion-*` roles so that
they are.

### Layers

| Token | Value | What sits there |
| --- | --- | --- |
| `--layer-base` | `0` | |
| `--layer-raised` | `1` | |
| `--layer-sticky` | `20` | `.deskwork > .desktop-bar`, `.mb-shade`; the Focus bar reads the token |
| `--layer-chrome` | `21` | `.deskwork > .deskstrip` |
| `--layer-overlay` | `80` | `.soft-folder`; `.unity-scrim` reads the token |
| `--layer-menu` | `90` | `.bench-pop` |
| `--layer-skip` | `100` | `.skip-link` |
| `--layer-curtain` | `1500` | `.splash`, above the map's 1200 |

These name the literals already in `app.css`; the literals themselves were not
replaced (see [DESIGN-SYSTEM-MIGRATION-PLAN.md](DESIGN-SYSTEM-MIGRATION-PLAN.md)).

### Elevation

| Token | Value |
| --- | --- |
| `--elevation-none` | `none` |
| `--elevation-raised` | `var(--lift-1)` |
| `--elevation-floating` | `var(--lift-2)` |
| `--elevation-modal` | `var(--lift-3)` |

### Shape

| Token | Value |
| --- | --- |
| `--shape-control` | `var(--r-sm)` |
| `--shape-card` | `var(--r-md)` |
| `--shape-surface` | `var(--r-lg)` |
| `--shape-sheet` | `var(--r-lg)` |
| `--shape-pill` | `999px` |

### Layout

| Token | Value |
| --- | --- |
| `--layout-reading` | `var(--reading-width, 66ch)` |
| `--layout-measure` | `var(--measure, 100%)` |
| `--layout-gutter` | `var(--page-pad, 18px)` |

### Component tokens

| Token | Value |
| --- | --- |
| `--card-surface` | `var(--surface-base)` |
| `--card-border` | `var(--border-default)` |
| `--card-shape` | `var(--shape-card)` |
| `--bar-surface` | `var(--surface-base)` |
| `--bar-border` | `var(--border-subtle)` |
| `--sheet-surface` | `var(--surface-overlay)` |
| `--sheet-shape` | `var(--shape-sheet)` |
| `--sheet-elevation` | `var(--elevation-modal)` |

## Primitive scales (`styles/app.css`)

### Type — every step is `calc(Npx * var(--text-scale, 1))`

| Token | px at scale 1 | Job |
| --- | --- | --- |
| `--type-3xs` | 9 | Tracked caps label in a grid |
| `--type-2xs` | 10 | Tile caption, grid cell |
| `--type-2xs-plus` | 10.5 | Caps kicker over a section |
| `--type-xs` | 11 | Labels, kickers, meta |
| `--type-xs-plus` | 11.5 | The second line under a row |
| `--type-sm` | 12 | Captions, second-rank prose |
| `--type-sm-plus` | 12.5 | A caption with something to say |
| `--type-base` | 16 | Body |
| `--type-base-plus` | 16.5 | Body that is the row |
| `--type-md` | 17 | List rows, the thing you tap |
| `--type-md-plus` | 17.5 | The name on a row you open |
| `--type-lg` | 18 | A card's own title |
| `--type-display-xs` | 19 | A card or item title |
| `--type-display-sm` | 20 | A section's own heading |
| `--type-display` | 22 | A figure read at a glance |
| `--type-display-lg` | 24 | The screen's title |
| `--type-xl` | 26 | The one heading on a screen |
| `--type-2xl` | 28 | The figure a screen is about |

### Spacing — every step is `calc(Npx * var(--density, 1))`

| Token | px at Comfortable |
| --- | --- |
| `--sp-1` | 2 |
| `--sp-2` | 4 |
| `--sp-3` | 6 |
| `--sp-4` | 8 |
| `--sp-5` | 10 |
| `--sp-6` | 12 |
| `--sp-7` | 16 |

The brief proposed 4 through 64. The app's scale stops at 16 because that is
where its measured usage clusters; larger gaps are written as
`calc(Npx * var(--density, 1))` at the site.

### Leading

| Token | Value | Band |
| --- | --- | --- |
| `--leading-none` | 1 | One line that sets its own box |
| `--leading-display-xl` | 1.08 | 30–60px |
| `--leading-display-lg` | 1.1 | 26–30px |
| `--leading-display` | 1.15 | 18–25px |
| `--leading-display-sm` | 1.2 | 15–20px |
| `--leading-display-xs` | 1.25 | 14–17px |
| `--leading-tight` | 1.3 | |
| `--leading-tight-plus` | 1.35 | |
| `--leading-normal-minus` | 1.4 | |
| `--leading-normal` | 1.45 | |
| `--leading-relaxed` | 1.5 | |
| `--leading-relaxed-plus` | 1.55 | |
| `--leading-loose` | 1.6 | |

Body leading is the reader's `--line-height` setting: Tight 1.35, Normal 1.55,
Airy 1.75, Loose 1.95 (`LINE_HEIGHTS` in `lib/look.ts`).

### Radius — written per look by `tokensFor`

| Corners setting | `--r-sm` | `--r-md` | `--r-lg` |
| --- | --- | --- | --- |
| Drawn (default for 11 grounds) | 3px | 6px | 10px |
| Square (default for Industry, Industry Dark) | 0 | 0 | 0 |
| Soft | 6px | 12px | 18px |
| Round | 10px | 18px | 28px |

### Lift

| Token | Value |
| --- | --- |
| `--lift-1` | `0 1px 2px rgba(0, 0, 0, 0.4)` |
| `--lift-2` | `0 1px 2px rgba(0, 0, 0, 0.45), 0 6px 18px rgba(0, 0, 0, 0.35)` |
| `--lift-3` | `0 1px 3px rgba(0, 0, 0, 0.5), 0 12px 36px rgba(0, 0, 0, 0.5)` |

### Easing

| Token | Value |
| --- | --- |
| `--ease` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--fast` | `130ms var(--ease)` |

## Machine-readable export

`app/design-tokens/semester.tokens.json` is these tokens as data — per-ground,
per-accent, per-density, per-corner values as modes, the semantic layer as
references, and the ink contrast of each ground. It is generated, never edited:
`npm run tokens:export` (from `app/`) rewrites it and
`src/lib/tokenexport.test.ts` fails when it differs from `lib/look.ts` and the
stylesheets. What it does not model is in the header of `lib/tokenexport.ts`.
