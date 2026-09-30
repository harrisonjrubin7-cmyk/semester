# Data visualization system

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

How a chart in Semester is coloured, labelled and made readable without the
colour. The colours are tokens (`--chart-*`, [DESIGN-TOKENS.md](DESIGN-TOKENS.md#chart));
this page is the rules for using them. It exists because analytics, forecasts
and the institution dashboards are about to add more charts, and a chart
palette decided one chart at a time is the fault `lib/look.ts` was built to
avoid.

## Two palettes, two jobs

| | Where | What decides the colours |
|---|---|---|
| **The reader's own** | `SheetChart`, the grapher (`Plot`) | Hues spread around the reader's accent (`lib/tint.ts`). Telling five of somebody's own columns apart; a reader who changes accent takes the chart with them. Unchanged by this page. |
| **Governed** | Anything where a colour *means* something: verified vs estimated, this term vs last, an integration's health | `--chart-1` … `--chart-5` and the four source roles. Fixed hues, lightness derived per ground. |

Do not mix them in one chart. A series that means "estimated" is
`--chart-estimated`, never a hue somebody's accent happened to land on.

## The palette, and what is measured

`chartFor` in `lib/look.ts`: blue, green, amber, violet, and a low-chroma slate
for the fifth (a fifth hue lands between two others; a neutral does not). Red is
left out on purpose: red is `--app-error`, and a series that reads as an error
is a chart that lies.

| Held by `lib/contrast.test.ts` | Bar | Measured floor across all 13 grounds and every surface |
|---|---|---|
| Each series against every surface a ground has | 3:1 (WCAG 1.4.11, graphical objects) | 3.20:1 (series 4), 3.21 (3), 3.27 (1), 3.55 (5), 4.05 (2) |
| The five are apart from each other | RGB distance ≥ 60 | pass on every ground |
| Neighbouring series differ in luminance | ≥ 1.12:1 | pass; this is what keeps them apart for a reader who cannot tell the hues apart. It caught two adjacent series landing on the same 3:1 floor on the light grounds |
| No series reads as the error colour | hue gap ≥ 40° | pass |
| Four source roles are four colours | distinct on every ground | pass |

Measured against the whole ramp, not the page: a light ground's void is two
steps darker than its panel (`CLAUDE.md`, "Contrast"). A label set in a series
colour is text and is held to 4.5:1 separately — use `--chart-label` for labels
and put the series colour on the mark.

Sample values, Ink: `#6995d3 #39c684 #dabf81 #9555ce #b6bfc3`. Parchment:
`#356bb6 #1f6b47 #9a792d #55257e #5c6970`.

## Rules every chart keeps

| Rule | Standard |
|---|---|
| Meaning | Begins with a plain-language takeaway, as text |
| Source | Names source, freshness and owner — `SourceBadge` beside it, and the same colour role |
| Uncertainty | Estimated, modelled, missing and stale values are labelled in words, not only tinted |
| Never colour alone | Every mark that means something also has a direct label, a pattern, or a glyph. The palette is the *third* carrier, as it is for status (`lib/status.ts`) |
| Table alternative | A real table or a chronological list beside or behind the chart |
| Keyboard | Every point or bar reachable and named |
| Scale | Bars start at zero unless the exception is stated on the chart |
| Honesty | No 3D, no area fills that misstate magnitude, no decorative gauges, no vague progress rings for degree progress (a requirement checklist with segmented progress instead) |
| Privacy | Small cohorts are suppressed and the threshold is stated |
| Mobile | Summary + table, or a scroll-safe view |

## What to draw

| Data | Preferred | Alternative |
|---|---|---|
| Degree progress | Requirement checklist + segmented progress | Table |
| Weekly schedule | Time grid | Chronological list |
| Scenario comparison | Side-by-side table with deltas | Delta summary |
| Deadline density | Term timeline | Weekly agenda list |
| Course demand | Trend + aggregate table | CSV export |
| Integration health | Status list + event history | Table |
| Outcomes | Trend line + cohort table | Methodology card |

## What is not done yet

- **Existing charts are not migrated and do not need to be.** `SheetChart` and
  `Plot` keep the reader's palette. Nothing in the app draws a governed chart
  yet; the tokens are ready for the first one.
- **No automated check that a chart has a table alternative.** A chart component
  that takes the rows and renders both would make that structural rather than
  a review item; it should be written with the first governed chart, not before.
- **No pattern fills.** The "never colour alone" rule is carried by labels and
  glyphs today. If a chart ever needs to be told apart in print, that is a
  pattern set, and it belongs in this page first.
