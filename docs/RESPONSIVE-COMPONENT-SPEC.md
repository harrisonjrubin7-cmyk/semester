# Responsive component spec

How the shell's parts behave at each width, as built. Tier names are the ones
in `app/src/lib/media.ts`. See
[ADAPTIVE-DEVICE-EXPERIENCE.md](ADAPTIVE-DEVICE-EXPERIENCE.md) for how they map
onto the spec's five classes.

## One decision for the navigation

`lib/chrome.ts` → `chromeFor(nav, screen, wide)` returns which chrome to draw,
and it is the only place that decides. `chrome.test.ts` runs every combination
and asserts that no two navigations are ever drawn together.

| Chrome | phone | tablet / desktop |
| --- | --- | --- |
| `tabs`: bar at the foot | yes, for the tab navigation — compact only, under 600px | no; becomes the rail |
| `railCollapsed`: the rail as icons, opening out | medium (600–839px), wherever the rail would be drawn | no; the full rail |
| `rail`: the same destinations down the side | no | yes |
| `shelves`: two rows of pills | at every width when chosen | at every width when chosen |
| `desk`: tab strip, one search bar, launcher | at every width when chosen | same, plus the `sidebar` |
| Full-screen screens (`drill`, `quiz`, `guess`, `lesson`, `slides`, `onboarding`) | no chrome | no chrome |

The header's Back button is drawn in every navigation, which is why "no
chrome" never means "no way out".

## Shell components

| Component | Narrow | Wide |
| --- | --- | --- |
| Header (`App.tsx`) | Title, Back, search, capture | Same, with room for labels |
| Search (`components/Command.tsx`) | The same palette, opened over the screen | The same palette, larger |
| Capture (`components/QuickAdd.tsx`) | Box over the column | Box over the window |
| Assistant (`ai/Assistant.tsx`, `ai/Panel.tsx`) | Bottom sheet, lifted clear of the tab bar | Corner panel |
| Keyboard sheet (`components/Keys.tsx`) | Shown wherever there is a fine pointer | Shown |
| Menus (`components/Bench.tsx`) | One sheet of rows | Menubar |

## Tokens that move with width

Set on `:root` in `styles/app.css`, so a screen that uses them adapts without
reading the width itself:

| Token | compact | medium ≥ 600 | expanded ≥ 840 | large ≥ 1200 | extra-large ≥ 1600 |
| --- | --- | --- | --- | --- | --- |
| `--page-pad` | 18px | 20px | 20px | 30px | 30px |
| `--measure` (reading width) | column | column | 760px | 880px | 960px |
| `--canvas` (grids) | column | column | column | 1240px | 1440px |
| `--rail-w` | none | none | clamp(196px, 23vw, 232px) | 248px | 272px |
| `--device-max` | 402px in a desktop window; 100% on a coarse-pointer device | 560px in a desktop window; 100% on a coarse-pointer device | 560px | 860px | 860px |

`--measure` is the spec's "controlled max line length" on extra-large screens.
It steps rather than grows, so the line length does not end up different on
every machine.

## Rules for a new component

1. Read the width through `lib/media.ts` only (`useTier`, `useMedia(WIDE)`,
   `useMedia(DESKTOP)`). Never through `window.innerWidth` or a user-agent
   check.
2. If it reads the width, add a row to `app/src/widthgate.test.ts` saying
   what the narrow window gets. "Hidden" is not an answer.
3. Prefer a token or a stylesheet query over a width check in JavaScript. A
   token adapts every screen at once and cannot hide a control.
4. If it is asking about input rather than room, use `TOUCH` or `FINE`, not
   `WIDE`. See [DEVICE-INPUT-MODE-SPEC.md](DEVICE-INPUT-MODE-SPEC.md).
