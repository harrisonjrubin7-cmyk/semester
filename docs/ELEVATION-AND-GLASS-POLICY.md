# Elevation and glass

## Surfaces

Four semantic surface levels, plus the canvas, all mapped onto each ground's
five-step ramp (`app/src/styles/tokens.css`):

| Level | Token | Ramp step | Use |
| --- | --- | --- | --- |
| Sunken | `--surface-sunken` | void | Input wells, timeline tracks, output areas, the page under lifted cards |
| Canvas | `--surface-canvas` | bg | The page |
| Default | `--surface-base` | panel | Standard content surfaces; `--card-surface` and `--bar-surface` |
| Raised | `--surface-raised` | hero | Cards and active workspace regions above the base; the loading bars |
| Overlay | `--surface-overlay` | raise | Sheets, menus, the Focus bar; `--sheet-surface` |

On a dark ground each step is lighter than the one below it, so hierarchy
reads without shadows. On a light ground the upper steps converge on white
(Parchment, Paper and Bone have `#ffffff` for both hero and raise), and
hierarchy is carried by the hairline and, where needed, a lift.

## Elevation

| Token | Value | Use |
| --- | --- | --- |
| `--elevation-none` | `none` | The default. A border is the first tool |
| `--elevation-raised` | `var(--lift-1)` | A card that must separate from a same-coloured surface |
| `--elevation-floating` | `var(--lift-2)` | The Focus bar |
| `--elevation-modal` | `var(--lift-3)` | Sheets (`--sheet-elevation`) |

The `--lift-*` values are black shadows at 0.35–0.5 alpha (see
[DESIGN-TOKENS.md](DESIGN-TOKENS.md#lift)). The soft shell has its own
ground-derived pair, `--shadow-soft-out` and `--shadow-soft-in`, written by
`tokensFor` so the lift is white only on light grounds.

Rules:

1. A hairline before a shadow. The shared components draw a 1px
   `--border-default` or `--card-border` on every card, bar and sheet; only the
   sheet and the Focus bar add a shadow.
2. No card on card on card. The object card, context bar, next-step buttons and
   command-centre widgets all sit on `--surface-base` directly; none nests a
   second bordered surface inside itself. Where a context bar is placed inside
   a surface that is already a card — `.course-banner`, `.portal-panel`,
   `.blueprint` — `unity.css` removes its background, border and padding so it
   takes the host's surface instead of drawing a card inside a card.
3. Nothing is identified by shadow alone. Under `forced-colors: active`
   `unity.css` gives every shared surface a `CanvasText` border, because the
   shadow and the ground colour are both discarded.
4. Low stimulation (`data-calm='calm'`) removes shadows in the existing sheet;
   the shared components add none that would survive it.

## Glass

Translucent, blurred surfaces are allowed in four places and nowhere else.

| Surface | Selector | Where defined | Why it is allowed |
| --- | --- | --- | --- |
| Header | `.app-header` | `app.css` | Chrome over scrolling content |
| Tab bar | `.app-tabs` | `app.css` | Chrome over scrolling content |
| Soft layout's folder | `.soft-folder` | `app.css` | A transient overlay over the launcher |
| Focus bar | `.focus-bar` | `unity.css` | A transient floating control |

Not glass: the Source & details, Capture and About this screen sheets
(`.unity-sheet`) are opaque
`--surface-overlay`, because they hold forms and reading text. The brief lists
the command palette and the quick-capture panel as places glass *may* be used;
neither uses it here.

### Fallbacks

Every allowed surface is opaque in each of these conditions:

| Condition | Rule | Status before this work |
| --- | --- | --- |
| The browser cannot blur | `@supports not (backdrop-filter: blur(1px))` in `app.css`; the Focus bar only turns glass on inside `@supports (backdrop-filter …)` in `unity.css` | Existed for header, tab bar, folder |
| `prefers-reduced-transparency: reduce` | One `@media` block in `unity.css` | **New** — previously the blur stayed on |
| `prefers-contrast: more` | Same block | **New** |
| `forced-colors: active` | Same block (and `app.css` already made `.soft-folder` opaque here) | Partly existed |
| The app's own Low stimulation setting, `:root[data-calm='calm']` | Selectors in `unity.css` | **New** |

The header, tab bar and folder go to `--surface-canvas`; the Focus bar goes to
`--surface-overlay`. This closes a real gap: before, text over a moving blur
remained for people who had asked their device for less transparency or more
contrast.

### The guard

`app/src/styles/glass.test.ts` reads every `.css` file in `app/src/styles/` and:

1. finds every selector that turns on a `backdrop-filter` other than `none`
   (and asserts it found at least four, so an empty result cannot pass);
2. fails if any of them is not one of the four allowed selectors;
3. fails unless the `prefers-reduced-transparency` / `prefers-contrast: more` /
   `forced-colors` block in `unity.css` names all four and sets
   `backdrop-filter: none`;
4. fails unless `unity.css` has a `:root[data-calm='calm']` rule for each.

Adding a fifth glass surface means adding it to `ALLOWED` in that test and to
the table above, and giving it the same fallbacks.

### Rules for any glass surface

- No dense text over variable content: the four surfaces hold a title, tabs,
  a short label and two buttons.
- Contrast is measured against the opaque fallback colour, which is what the
  person who asked for more contrast sees.
- Blur is 14–18px, once per surface; nothing stacks glass on glass.
