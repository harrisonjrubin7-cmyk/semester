# Colour, light and dark

Semester already had a complete, measured light and dark system before this
work: thirteen grounds, eleven accents, a per-ground warning colour, an
"Increase contrast" floor, and a "Match my device" option. This change added
semantic names over it (`app/src/styles/tokens.css`) and did not change a
single colour value.

## Grounds

`GROUNDS` in `app/src/lib/look.ts`. Eight dark, five light. Each defines a
five-step surface ramp (void, bg, panel, hero, raise), a foreground, and the
alpha at which the dim and faint text rungs are mixed from it.

| Ground | Light? | Ramp (void → raise) | Foreground | dim / faint alpha |
| --- | --- | --- | --- | --- |
| Ink (default) | dark | `#040507` `#090a0e` `#12141a` `#191c23` `#22262f` | `#eceef2` | 0.64 / 0.42 |
| Graphite | dark | `#0e0f12` `#16181c` `#1f2229` `#282c34` `#333843` | `#eceef2` | 0.66 / 0.44 |
| Midnight | dark | `#04060d` `#080b15` `#101524` `#171d31` `#212942` | `#e8ecf4` | 0.64 / 0.42 |
| Basalt | dark | `#0b0a09` `#131211` `#1c1a18` `#252220` `#302c29` | `#eeebe6` | 0.65 / 0.43 |
| Oxide | dark | `#000000` `#000000` `#0b0d10` `#14171c` `#1e2229` | `#eceef2` | 0.62 / 0.40 |
| Forest | dark | `#030705` `#070d0a` `#0e1712` `#141f19` `#1d2b23` | `#e7efe9` | 0.64 / 0.42 |
| Wine | dark | `#080405` `#0e090a` `#171012` `#201618` `#2c1f21` | `#f0e9ea` | 0.64 / 0.42 |
| Industry Dark | dark | `#141516` `#1b1c1e` `#232426` `#2b2b2d` `#424244` | `#f2f2f3` | 0.64 / 0.46 |
| Parchment | light | `#e8e4dc` `#f4f1ea` `#fbf9f4` `#ffffff` `#ffffff` | `#1b1a17` | 0.68 / 0.52 |
| Paper | light | `#dfe2e8` `#f2f4f7` `#fbfcfd` `#ffffff` `#ffffff` | `#15181d` | 0.68 / 0.52 |
| Bone | light | `#e4e0d9` `#ece9e3` `#faf9f7` `#ffffff` `#ffffff` | `#1a1a18` | 0.68 / 0.52 |
| Industry | light | `#e7e7ea` `#f2f2f3` `#f5f5f8` `#fafafb` `#ffffff` | `#1d1f20` | 0.70 / 0.52 |
| Fog | light | `#c9cdd4` `#dde1e7` `#e9ecf1` `#f4f6f9` `#fdfdfe` | `#14171c` | 0.70 / 0.52 |

The brief asks for a dark canvas that is "not pure black as a default" and
"near-black charcoal" text rather than pure black. Ink, the default, is a
cooled near-black; Oxide is the one true-black ground and is opt-in, for OLED
battery. Every light ground's foreground is a near-black, never `#000`.

## Accents

`ACCENTS` in `lib/look.ts`: Sterling, Brass, Copper, Jade, Slate, Pewter,
Industry, Oxblood, Moss, Indigo (`id: 'ink'`), Old gold — eleven, plus a hue
slider (`accentFromHue`). Each has four stops: `base`, `bright`, `deep` and
`shade`. On a light ground `tokensFor` draws the accent, its bright and its deep
all from `shade`, the stop dark enough to read as text; on a dark ground it
uses `base`, `bright` and `deep`.

The accents are desaturated metals and stones on purpose. The brief suggested a
deep indigo, ink blue, academic teal or refined violet primary; Indigo, Slate
and Industry are those, and the reader chooses. The default is Sterling.

## Tonal elevation

Each ramp steps up in lightness from void to raise on a dark ground, which is
the tonal elevation the brief asks for ("shadows alone do not communicate
hierarchy well on dark backgrounds"). The semantic names map onto the ramp:

| Semantic | Ramp step |
| --- | --- |
| `--surface-sunken` | void |
| `--surface-canvas` | bg |
| `--surface-base` | panel |
| `--surface-raised` | hero |
| `--surface-overlay` | raise |

Hairlines (`--app-line`, `--app-line-top`, `--app-line-soft`) separate surfaces
before shadows do; the `--lift-*` shadows are the second tool. See
[ELEVATION-AND-GLASS-POLICY.md](ELEVATION-AND-GLASS-POLICY.md).

## The warning colour

The app has one colour that is not the accent: an oxidised red-orange for
something that needs attention. It is not a fixed hex. `warnFor(ground)` walks
the lightness of hue 14°, saturation 0.5, from `#c8785f` toward darker (light
ground) or lighter (dark ground) until it reaches 4.6:1 against every surface
in that ground's ramp — 4.6 rather than 4.5 so a later ramp tweak does not push
a ground under. `--app-warn-line` and `--app-warn-wash` are the same colour at
0.45 and 0.09 alpha.

This is why `--status-attention` and `--status-danger` are the same token and
why success and info share the accent. The brief's four semantic colours
(success, warning, danger, info) were not introduced as four hues; the app
reserves colour for one meaning and carries the rest in words and glyphs. See
[TRUST-CUES-AND-SOURCE-PRESENTATION.md](TRUST-CUES-AND-SOURCE-PRESENTATION.md)
for the vocabulary.

## Contrast testing

| Instrument | What it measures | How to run |
| --- | --- | --- |
| `app/src/lib/contrast.test.ts` | Every accent × ground pairing (11 × 13 = 143): text rungs, accent-deep on panel and on the accent wash, accent fill as a non-text mark at 3:1, the faint rung at 3:1 on every surface of every ground, the warn colour at 4.5:1 wherever it is read, the primary button's glow on light grounds, and the "Increase contrast" floor | `npm test` |
| `app/scripts/contrast-sweep.mjs` | What Chromium actually painted, composited, on listed screens — catches surfaces that are not tokens (two washes stacked, a shadow under text) | `npm run dev`, then `npm run sweep:contrast` with a scratch Playwright (see the script header) |
| `app/scripts/paint.mjs` | Samples a screenshot rather than the style tree | See its header |

`CLAUDE.md` records the one recurring mistake: measuring a faded rung against
`--app-panel`, the surface that flatters it most. A light ground's void is two
steps darker. `contrast.test.ts` walks the whole ramp for both faded rungs.

Because `tokens.css` writes no colour (`styles/tokens.test.ts`), every semantic
colour token resolves to a value this audit already covers.

## Increase contrast

`usePrefersContrast()` in `lib/prefers.ts` reads `prefers-contrast: more`, and
`tokensFor(look, true)` raises the dim, faint, hairline and track alphas to the
`LOUD` floor (dim 0.9, faint 0.76, line 0.34, line-soft 0.2, track 0.24,
line-top 0.24). It is done in `tokensFor` because the tokens are inline styles
on the root and a media query cannot override them. Under the same preference
the four glass surfaces go opaque (`styles/unity.css`).

## Light, dark and Match my device

The brief asks for system / light / dark "only when the existing platform and
accessibility coverage can support it consistently". That already existed, at
greater granularity:

- **Match my device** — `MATCH_DEVICE = 'device'`, labelled "Match my device".
  `resolveGround('device', prefersDark)` returns Ink after dark and Parchment in
  daylight (`DEVICE_DARK`, `DEVICE_LIGHT`), from `usePrefersDark()`.
- **Any of the thirteen grounds** — a fixed choice.
- `App.tsx` sets `color-scheme` on the root from the resolved ground's `light`
  flag, so native controls and scrollbars follow.

The ground is a look key and syncs with the account (`lib/merge.ts`), which is
the brief's "persist user preference safely across devices where allowed".

No new dark mode was added by this work.

## What the brief proposed and what stands

| Brief | Stands | Why |
| --- | --- | --- |
| Replace the palette with a blue primary and new semantic hues | Not done. Semantic names alias the existing primitives | The brief's own rule is "migrate toward semantic tokens; no unsafe all-at-once visual rewrite", and the existing 13 grounds are contrast-tested at 143 pairings. New hexes would sit outside that audit |
| Canvas not pure white everywhere | Already true: light grounds' bg steps are `#f4f1ea`, `#f2f4f7`, `#ece9e3`, `#f2f2f3`, `#dde1e7` | |
| Near-black text | Already true on every light ground | |
| Success / warning / danger / info colours | Two tones (accent, warn); every state carries a word and glyph | One-colour rule of the existing design |
| System / light / dark | Match my device plus 13 grounds | Existed |
| Dark mode adjusts accent and semantic colours for contrast | `shade` stop on light, `warnFor` per ground | Existed |
