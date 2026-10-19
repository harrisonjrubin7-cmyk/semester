# Design token architecture

Semester's visual values live in three layers. Only the middle one is new; the
other two existed, were already measured, and were not changed by this work.

```
primitive   --app-*  --type-*  --sp-*  --leading-*  --r-*  --lift-*  --ease  --fast
            decided per ground and per setting            app.css, lib/look.ts
    │
semantic    --surface-*  --text-*  --border-*  --action-*  --status-*  --focus-*
            --target-*  --duration-*  --motion-*  --layer-*  --elevation-*
            --shape-*  --layout-*                          styles/tokens.css
    │
component   --card-*  --bar-*  --sheet-*                   styles/tokens.css
    │
rules       styles/unity.css and, over time, everything else
```

The brief proposed a `tokens/primitive|semantic|component/` folder tree. The
repository keeps tokens as CSS custom properties in stylesheets and as the map
`tokensFor` returns, so the same three layers are expressed in those two places
rather than in a new tree.

## Where each layer lives

### Primitive

Two sources, and a rule that decides which one a token belongs to.

- **Per ground and per reader setting** — `tokensFor(look, moreContrast)` in
  `app/src/lib/look.ts`. It returns one flat map of custom properties, written
  whole onto the root element by `App.tsx` on every change: the five-step
  surface ramp (`--app-void` … `--app-raise`), the three ink strengths
  (`--app-fg`, `--app-dim`, `--app-faint`), the accent family, `--app-warn`,
  the hairlines, the corner radii (`--r-sm/md/lg`), the heading and body faces,
  `--line-height`, `--reading-width` and `--density`. Every ground defines every
  key (`look.test.ts` checks the sets match), so switching ground is atomic.
- **Fixed** — the `:root` block at the top of `app/src/styles/app.css`: the
  type scale (`--type-*`), spacing (`--sp-*`), leading (`--leading-*`), the
  three lifts (`--lift-1..3`), `--ease` and `--fast`. `app.css` also holds
  dark-ground fallbacks for the per-ground tokens so the sheet is complete
  before the first script runs.

Because `tokensFor` writes inline styles on the root, a `:root` rule in CSS can
never override a per-ground primitive. That is why "Increase contrast" is
handled inside `tokensFor` (the `LOUD` floor) rather than in a media query.

### Semantic

`app/src/styles/tokens.css`, loaded after `app.css` and `features.css` by
`app/src/main.tsx`. Each semantic token names a *job* — "the raised surface",
"secondary text", "the focus colour" — and points at a primitive with `var()`.
A handful are plain numbers that have no primitive yet: target sizes, motion
durations, the layer ladder, the focus clearances.

### Component

The last block of `tokens.css`: `--card-surface`, `--card-border`,
`--card-shape`, `--bar-surface`, `--bar-border`, `--sheet-surface`,
`--sheet-shape`, `--sheet-elevation`. Each points at a semantic token. The
brief's longer list (button, input, navigation, dialog, table, chart,
toolbar, context_bar, workspace) was not created; those components still read
primitives directly, and a component token is added when a second component
needs the same decision.

## Rules the layer keeps

### 1. No colour is written in the semantic layer

Every colour in the app is decided in `lib/look.ts`, by the thirteen grounds
and eleven accents, so `lib/contrast.test.ts` sees every value a semantic
colour token can resolve to. A hex written into `tokens.css` would be one
colour across thirteen grounds and outside that audit — the fault `warnFor` was
written to undo for the old fixed `--app-warn`.

`styles/tokens.test.ts` → "writes no colour of its own" fails on any hex,
`rgb()`, `rgba()`, `hsl()` or `hsla()` in `tokens.css`. The shared-component
sheet has the same check with one documented exception: the scrim fallback
`var(--scrim, rgba(0, 0, 0, 0.5))`.

### 2. Every `var()` points at something that exists

CSS does not fail on an undefined custom property; the value computes to
nothing and every component reading it loses its colour at once.
`tokens.test.ts` → "points only at tokens that exist" resolves every `var()` in
the `:root` block against `app.css`, `industry.css`, `tokens.css` and the keys
`tokensFor({})` returns.

### 3. No name is shared with `industry.css`

`industry.css` (the design system underneath) loads first and owns
`--space-*`, `--radius-*` and `--shadow-*`. A same-named declaration later in
the cascade does not add a scale; it silently retunes every component in the
system. This happened once: `--space-2` redefined from 6.8px to 4px moved the
primary button on every screen (recorded in the spacing comment in `app.css`).
That is why spacing is `--sp-*`, radii are `--r-*`, and elevation is `--lift-*`
and `--elevation-*`.

`tokens.test.ts` → "shares no name with industry.css" fails on any overlap and
on any `--space-`, `--radius-` or `--shadow-` name in `tokens.css`.

### 4. Adopting a name changes the name, not the value

This is the migration rule. A semantic token is introduced at the value the app
already draws, so replacing `var(--app-panel)` with `var(--surface-base)` in a
rule moves nothing on screen. The layer ladder is pinned to the literals the
stacking rules use (20, 21, 80, 90, 100); the focus tokens are pinned to the
ring `app.css` already draws. `tokens.test.ts` holds both. See
[DESIGN-SYSTEM-MIGRATION-PLAN.md](DESIGN-SYSTEM-MIGRATION-PLAN.md) for the
order in which existing rules should adopt names.

## How tokens reach the reader's settings

Two multipliers carry the Text size and Density settings into every rule that
uses the scales. A token or a rule that drops the multiplier does not fail
anywhere — it keeps resolving to a good-looking number and the setting silently
stops working at that site.

| Setting | Root property | Written by | Scales that carry it |
| --- | --- | --- | --- |
| Text size (Compact 0.94, Normal 1, Large 1.09, Largest 1.18) and the browser's own font size | `--text-scale` | `App.tsx`: the root font size is set to `scaleOf(textSize) × 100%` of the browser's own size, then `--text-scale = scaleFrom(rootPx)`, i.e. the resulting root px ÷ 16 | every `--type-*` is `calc(Npx * var(--text-scale, 1))` |
| Density (Comfortable 1, Snug 0.86, Tight 0.74) | `--density` | `tokensFor` | every `--sp-*` is `calc(Npx * var(--density, 1))`; `industry.css`'s `--space-*` too |
| Corners (Drawn, Square, Soft, Round) | `--r-sm/md/lg` | `tokensFor` | `--shape-control/card/surface/sheet` |
| Line height, reading width, faces | `--line-height`, `--reading-width`, `--font-body`, `--font-heading` | `tokensFor` | `--layout-reading` reads `--reading-width` |

The semantic layer inherits these for free because it points at the scales.
The guards:

- `styles/textscale.test.ts` reads every `.css` file in `app/src/styles/`, so
  `tokens.css` and `unity.css` are covered: no font size the setting cannot
  reach.
- `styles/tokens.test.ts` → "sets every font size from the type scale" holds
  every `font-size` in `unity.css` to `var(--type-*)`.
- `styles/density.test.ts` → "spacing written past the tokens" allows zero
  unscaled px spacing in `tokens.css` and in `unity.css`.

## Status tokens and the one-colour rule

The app spends colour on one thing: something that needs attention. So
`--status-attention` and `--status-danger` both resolve to `--app-warn`, and
`--status-success` and `--status-info` both resolve to the accent. This is
deliberate. Every status also carries a word and a glyph
(`app/src/lib/status.ts`), so none is conveyed by colour alone. See
[COLOR-AND-DARK-MODE-SPEC.md](COLOR-AND-DARK-MODE-SPEC.md).
