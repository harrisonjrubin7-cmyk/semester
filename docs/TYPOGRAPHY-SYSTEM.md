# Typography

What the app sets type in, at what sizes, and which of those the reader
controls. Nothing here was changed by the design-excellence work except the
addition of a `.nums` utility class; the rest is documented as it stands, with
one open decision at the end.

## Faces

Three are loaded by the app and declared in `app/src/styles/typefaces.css`,
served from the app's own origin:

| Face | Token | Where |
| --- | --- | --- |
| Barlow | `--font-body` (default body) | Body text, controls |
| Barlow Condensed | `--font-heading` (default heading) | Headings, "drawing-office lettering" |
| Cinzel | `--font-display` | Display type clipped to the brushed-metal gradient (`.chrome-text`) — the wordmark and screen titles |

The reader chooses the heading face and the body face separately, in
Settings → Look (`TYPEFACES` and `BODYFACES` in `app/src/lib/look.ts`):

| Heading face (`typeface`) | Stack |
| --- | --- |
| Condensed (default) | `"Barlow Condensed", system-ui, sans-serif` |
| Grotesk | `Barlow, system-ui, sans-serif` |
| System | `system-ui, -apple-system, "Segoe UI", sans-serif` |
| Serif | `Georgia, "Times New Roman", serif` |
| Mono | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` |

| Body face (`bodyface`) | Stack |
| --- | --- |
| Barlow (default) | `Barlow, system-ui, sans-serif` |
| System | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| Hyperlegible | `"Atkinson Hyperlegible", system-ui, sans-serif` |
| Serif | `Georgia, "Times New Roman", serif` |
| Mono | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` |

Every stack ends in a system face, so a font that fails to load degrades to
the same proportions.

Only Barlow, Barlow Condensed and Cinzel have `@font-face` rules in
`typefaces.css`. Atkinson Hyperlegible is not bundled: the Hyperlegible choice
uses it when the device has it installed and falls back to `system-ui`
otherwise. Bundling it is a small follow-up if that choice is to mean the same
thing on every device.

**Differences from the brief.** The brief asks for one primary sans-serif (such
as Inter, Geist or Source Sans 3) and an optional academic serif for long-form
reading. Inter was not added. Barlow is the existing primary sans and adding a
second UI sans would be the "multiple unrelated UI typefaces" the brief warns
against. The optional serif reading face already exists as the Serif body face,
chosen by the reader; it applies app-wide rather than only to long-form
screens, which is a known difference.

## Scale

The type scale is in the `:root` block of `app/src/styles/app.css`. Every step
is `calc(Npx * var(--text-scale, 1))`, so the Text size setting and the
browser's own font size reach it. Full list in
[DESIGN-TOKENS.md](DESIGN-TOKENS.md).

Mapped against the brief's roles:

| Brief role | Brief size | App token | App size at Normal |
| --- | --- | --- | --- |
| Display | 48/56 desktop | Figures only (`--type-2xl` and larger inline sizes) | 28px and up |
| H1 | 36/44 | `--type-display-lg` (screen title) / `--type-xl` | 24 / 26px |
| H2 | 28/36 | `--type-display-sm` | 20px |
| H3 | 20/28 | `--type-display-xs` | 19px |
| Body | 16/24 | `--type-base` | **16px** × `--line-height` 1.55 (was 13px) |
| Body small | 14/20 | `--type-sm` | 12px |
| Label | 12/16 | `--type-xs` / `--type-2xs-plus` | 11 / 10.5px |
| Mono | 14/20 | No dedicated token; mono is a face choice | |

Body now meets the brief's 16px, and the reading tier above it moved with it
(rows 17, a card's title 18, an item title 19). Headings from 20px up and the
secondary tier below body — captions, labels, the second line under a row —
did not move, so those stay smaller than the brief's figures; they are the
text the brief itself sets at 12–14px. See "Body is 16px" below.

## How the reader controls it

| Control | Values | Mechanism |
| --- | --- | --- |
| Text size | Compact 0.94, Normal 1, Large 1.09, Largest 1.18 (`SIZES`) | Root font size is that percentage of the browser's own; `--text-scale` is read back from the result |
| Browser font size | Any | Honoured, because the root is a percentage rather than a px value (`a11y/type.test.ts`) |
| Browser zoom | Any | Ordinary CSS px |
| Line height | Tight 1.35, Normal 1.55, Airy 1.75, Loose 1.95 (`LINE_HEIGHTS`) | `--line-height` |
| Reading width | Narrow 52ch, Normal 66ch, Wide 82ch, Full (`READING_WIDTHS`) | `--reading-width`, used by long-form screens and `--layout-reading` |
| Heading and body face | As above | `--font-heading`, `--font-body` |
| Accessibility workspace mode | Sets Text size to Large | `ACCESS_LOOK` |

Guards:

- `app/src/styles/textscale.test.ts` — every font size in every stylesheet
  under `app/src/styles/` answers the Text size setting (measured before the
  fix: 62 of 481 text elements did not grow; after: 5, all Leaflet's own).
- `app/src/styles/rules.ts` (run by `npm run lint` and the suite) — the same
  for inline `fontSize` in TSX.
- `app/src/styles/tokens.test.ts` — every `font-size` in `unity.css` is a
  `var(--type-*)`.
- `app/src/styles/fields.test.ts` — on a coarse pointer, form fields are never
  under 16px, as a floor with `!important` so inline sizes cannot win, and so
  iOS does not zoom on focus.

## Reading width

`--reading-width` (default 66ch) caps paragraphs on the long-form screens — a
guide, a note, a reading. The semantic alias is `--layout-reading`, which
`.screen-guide-body` uses. This matches the brief's 60–75 characters.

## Tabular figures

Dates, durations, counts and grades are set with
`font-variant-numeric: tabular-nums` so columns of figures do not shift. The
existing sheet does this per rule — for example `.mcell-count` and about ten
other rules in `app.css`. This work added a utility class:

```css
/* app/src/styles/unity.css */
.nums { font-variant-numeric: tabular-nums; }
```

It is used by the object card's metadata line, the Source & details freshness
row, the command centre's widget values, `ErrorState`'s reference and
`Progress`'s percentage. `.status-glyph` also sets tabular figures.

## Sentence case

The status vocabulary (`lib/status.ts`), the workspace modes, the goals, the
widgets and every button label added by this work are sentence case in source
("Source & details", "Conflict needs review", "Start 25-minute timer").

Kickers and eyebrows (`.kicker`, `.object-card-eyebrow`,
`.command-widget-label`, `.source-list dt`) are drawn in capitals with
`text-transform: uppercase` and letter-spacing. The text in the DOM stays
sentence case, so a screen reader reads words rather than spelling capitals.

## Pale secondary text

The brief warns against too-pale small text used for hierarchy. The app has
three ink strengths and holds each to a measured bar on every surface of every
ground (`lib/contrast.test.ts`): `--text-secondary` (`--app-dim`) to 4.5:1, and
`--text-tertiary` (`--app-faint`) to 3:1, with the faint rung reserved for
metadata and disabled labels. The shared components use `--text-secondary` for
explanations and never the faint rung.

## Body is 16px

Decided: the brief's 16px floor for reading text is met at the default
setting. It was the open decision in earlier versions of this document, with
body at 13px; the product took option 3 of the three set out there — raise
`--type-base` and re-baseline every screen.

What moved, at Normal, and nothing else:

| Token | Was | Now |
| --- | --- | --- |
| `--type-base` (body) | 13 | **16** |
| `--type-base-plus` (body that is the row) | 13.5 | 16.5 |
| `--type-md` (list rows) | 14 | 17 |
| `--type-md-plus` (the name on a row you open) | 14.5 | 17.5 |
| `--type-lg` (a card's title) | 15 | 18 |
| `--type-display-xs` (an item title) | 17 | 19 |
| inherited default on `body` and `.device` | 15 | 16 |

Every step above body moved with it so rows and titles stay larger than the
body beside them; the order and every token's job are unchanged. From
`--type-display-sm` (20) up nothing moved. Below body nothing moved either:
the captions, labels and kickers are secondary text. The ported portal
screens (`features.css`) set their own sizes, so their reading text — `p`,
`dd`, `summary`, fields, buttons, Study Studio's labels — now reads
`var(--type-base)` and their sub-headings `var(--type-lg)`; their captions
and notices did not move. At Compact (0.94) body is about 15px; that setting
is the reader choosing smaller type.

How it was checked, since jsdom has no layout: every screen in the `Screen`
union at 320px (the reflow width), 420px and 1280px, before and after, for
sideways overflow, text clipped without an ellipsis, and overlapping tap
targets. The two runs were identical — the change introduced none. The probe
was checked first against a planted 580px overflow and a planted clipped
label, which it found; its first run had measured nothing at all, because
the dev server was serving stale bundles and no screen rendered, and a
"no findings" from it would have been false. The one real finding it made —
"About this screen" running under Mail's floating Compose button — was from
this PR's own full-bleed work, not the type change, and is fixed: quiet links
are as wide as their words.

`styles/rules.ts` maps the new pixel values to the same names, so a size
written longhand at 16, 16.5, 17, 17.5, 18 or 19 is reported as the token it
is. Inputs on touch devices keep their own 16px floor (see above).
