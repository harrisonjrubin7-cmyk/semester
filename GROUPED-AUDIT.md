# Grouped shell — the audit, before any code

Task 1 of the grouped-layout plan. No code in this commit.

The plan's method is right and its premise is half right, and the half that is
wrong is the part that decides how long this takes. Reporting that first,
because it changes what commit 2 should contain.

---

## The premise, checked

> the screens already render through a small set of shared components (list
> rows, cards, section headers, stat blocks, form controls). Convert THOSE.

**Cards, section headers and form controls: yes.** Those are shared, and
converting them does carry most of the app.

**List rows: no.** There is no shared row component. `DeadlineRow` exists and
is used by two files. Everything else is hand-rolled, and the giveaway is one
string:

```
borderBottom: '1px solid var(--app-line)'
```

74 occurrences, across **31 of 58 screens**, plus 10 components. Every one of
those is somebody drawing a row by hand. They are not identical — some are
`<button>`, some `<div>`, the padding varies between 9px and 13px, some carry
a tick box, some a chevron, some a trailing tag.

So the free ride covers headers, cards and controls. Rows have to be built
first and then adopted, and adopting them is a per-screen edit across 31
screens. That is the real shape of the work.

---

## What is actually shared

Counted by files importing and rendering each one (`src/screens` and
`src/components`, 58 screens and 76 components).

| Pattern | Component | Files | Grouped equivalent | Free? |
|---|---|---|---|---|
| Section header | `SectionLabel` | **78** | `Group` header | Yes |
| Card / framed object | `Blueprint` | **62** | `Group` container | Yes |
| Segmented choice | `Segmented` | 21 | `SelectRow` | Yes |
| Filter chips | `ChipRow` | 9 | `SelectRow`, or stays as chips | Yes |
| Switch | `Toggle` | 8 | `ToggleRow` | Yes |
| Checkbox | `TickBox` | 8 | trailing element of `ItemRow` | Yes |
| Empty state | `EmptyState` | 5 | `Group` with a footer | Yes |
| Progress bar | `Meter` | 4 | inside `ItemRow` | Yes |
| Deadline row | `DeadlineRow` | 2 | `ItemRow` | Yes |
| Date picker | `DateRow` | 1 | `SelectRow` | Yes |
| **Item list row** | **none** | **31 screens** | **`ItemRow`** | **No** |

`SectionLabel` is already an `<h2>` with a class, so the accessibility
requirement for group headers is met before this starts. `Blueprint` is a card
frame with four registration marks; in grouped mode it becomes the inset
container and drops the marks, which is a one-line branch inside it.

Two screens use neither `SectionLabel` nor `Blueprint` and will need looking at
directly: **Gap** and **Springboard**.

---

## What must be exempt

Screens whose body becomes worse as an inset list. These get `FullBleed` —
grouped chrome around them, edge-to-edge content inside.

**Grids, drawn by hand with `gridTemplateColumns`:**

- `Calendar` — the month and week grids
- `Springboard` — the icon grid

**Long-form reading**, found by `whiteSpace: 'pre-wrap'`, a reading-width cap,
or rendered markdown — 13 screens and 4 components:

- `Guide`, `Update`, `Brief`, `Weekly` — the field guide and the reports
- `Essay`, `Work`, `Solve`, `Analyse`, `Ask` — everything that produces or
  reviews long text
- `Account`, `Connect`, `Classmates`, `Mine` — each has a prose block inside an
  otherwise listy screen, so these need `FullBleed` around a section rather
  than around the screen
- `CheckIt`, `ProjectFile`, `Trouble`, `RecordButton` — components, exempt
  wherever they appear

**Drawn output:**

- `Diagram` — SVG figures inside guides
- `Drill`, `Guess` — the flashcard views, which are one large object rather
  than a list
- `Maps` — the map

That is **19 screens** with at least part of the body exempt. Nine of them are
exempt entirely; ten need the exemption around one section, with the rest of
the screen grouped.

---

## What this means for commit 2

The plan's ordering holds, with one addition. Commit 2 should be:

1. The `shell` look key, the merge strategy, the Appearance picker, `useShell`.
2. The primitives — including `ItemRow`, which has no existing counterpart and
   is the one that carries the 31 screens.
3. The branch inside `Blueprint` and `SectionLabel`, which is what makes 78 and
   62 files change without being touched.

Commit 3 is then the 31-screen adoption pass plus the `FullBleed` exemptions,
which is where the real time goes and where a screen-by-screen list belongs.

---

## Two things I want to flag before building

**`Blueprint`'s registration marks are the app's signature.** The Industry
system's stated rule is that a framed element never drops them, and the
component's own comment says so. Grouped mode drops them, because an inset iOS
group with crosses in its corners is neither thing. That is a deliberate
departure from the design system, in one mode only, and it is worth being sure
about before it ships.

**"Pixel-identical in plain mode" is testable and I intend to test it**, by
rendering each screen in both modes and diffing plain against the current
build. That is the acceptance criterion most likely to be quietly broken by a
refactor of `Blueprint`, and it is the one worth a real check rather than a
claim.
