# Responsive and shell audit (phase D0)

`c170dcd`, 2026-10-04. Read from source; not run.

## 1. Shell structure

- Bootstrap: `main.tsx` (258 lines): `#/room/<token>` renders `TrustRoom`;
  `?form=` renders `Respond`; otherwise `App`. OAuth return completes first.
- `App.tsx` (1653 lines). `AppFrame` (line 1161) calls `useTier`, `useMedium`,
  `chromeFor(state.nav, state.screen, wide, medium)` (line 1190), then
  `wideFrame()` or `phoneFrame()` (line 1397). Shell parts, all in `App.tsx`:
  `SkipLink` 158, `Header` ~320-607, `TabBar` 610, `CurrentScreen` ~700,
  `Rail` 986-1146, `SystemContextBar` mounted at 902/1520/1627, `Command`
  at 961/1485.
- No router library. `state.screen` is the `Screen` union (`lib/types.ts:696`);
  `screens.tsx` is `SCREENS: Record<Exclude<Screen,'home'|'onboarding'>, ComponentType>`
  (87 lazy rows; a missing id is a compile error). `home` resolves via
  `homeShape` to Today, Springboard or Guides. Unknown strings fall back to Today.
- Nav modes: `tabs | feed | springboard | shelves | workspace | guides`
  (`types.ts:954`); `chromeFor` (`lib/chrome.ts`) draws exactly one chrome.
  `FULLSCREEN`: drill, quiz, guess, lesson, slides, onboarding.
- Destinations: `DESTINATIONS` (`lib/nav.ts:202`, groups Semester, Courses,
  Study, Make, Campus, Life, Beyond, Data) and `NAV_AREAS` (`lib/navareas.ts`,
  7 areas). **Neither is the target's five groups.** `complexity-budgets.json`
  pins 63 destinations in 8 groups (`lib/complexitybudgets.test.ts`).

## 2. Desktop rail vs target

| Target | Today |
|---|---|
| Fixed 248px | `--rail-w`: 0 / 72 (≥600) / `clamp(196px,23vw,232px)` (≥840) / **248 (≥1200)** / 272 (≥1600) — `app.css:752,768` |
| Ink | `.rail` uses `--app-bg` + 1px right border (`app.css:884-892`); follows the chosen ground |
| Groups Today / Learning / My Path / Life / Me (~22 items) | 5 destinations, a gap, up to 5 "quiet" extras (`ask, import, account, connect, settings`), no icons on extras, **no groups** (`App.tsx:1103-1120`) |
| Current: blue wash + blue glyph + 3px leading edge + weight | `aria-current="page"`, `--app-accent-bright`, `--app-hero` background, 1px inset top line |
| ⌘K entry in the rail | none; header search icon and `lib/keys.ts:180` open `state.finder` |
| Persistent system-context bar | `unity/SystemContextBar.tsx`: term selector, breadcrumb, `AccessibilityTools`, workflow trail, "Back to {recent}", sync-health button. Replaced by a bare accessibility strip on `QUIET_ON` = onboarding, search, directory, ask, mail, call |
| Main content max ~1180 | `--layout-operational: 1180px` (`app.css:25`) — match |

The target's destinations map to existing routes except: Tasks (no route),
Advising (no route), Accessibility (no route), Marketplace (not in the rail).
Study, Write, Registration, Campus, Dining, Housing, Community, Family, Billing,
Support, Privacy, Connections exist in `SCREENS` with no rail group metadata.

## 3. Mobile

- `TabBar` (`App.tsx:610`): `<nav class="safe-bottom app-tabs" aria-label="Sections">`;
  5 tabs when `FIVE` (`EXPERIENCE_FLAGS.journeyNavigation !== 'off'`, default on,
  `VITE_JOURNEY_NAVIGATION`). `FIVE_DESTINATIONS = ['home','degree','search','calendar','me']`
  (`lib/tabbar.ts:165`), labels Today / My Path / Search / Plan / Me. **Matches
  the target.** Legacy `DEFAULT_TABS` = home, calendar, study, support, me
  (3-7 tabs, `MOST=7`).
- Labels visible by default; `state.labels !== 'off'` hides them and moves the
  name to `aria-label` — **a user setting that produces icon-only navigation**,
  against "icons must always have visible labels". Needs a decision (ADR-0035).
- `degree` (My Path) is student-only (`lib/role.ts` `STUDENT_ONLY`): non-student
  roles get 4 tabs via `forRole`.
- Current tab: 2px top border + `aria-current`.
- Safe area: `.safe-top` `calc(env(safe-area-inset-top,0px)+14px)` (`app.css:1884`);
  `.safe-bottom` `max(24px, env(safe-area-inset-bottom))` (1887); side insets
  (1921); `viewport-fit=cover` in `index.html`.
- Blur: `.app-header` and `.app-tabs` `blur(18px) saturate(1.3)` on
  `color-mix(--app-bg 82%, transparent)` (`app.css:2009, 2097-2104`); opaque
  fallback `@supports not` (2108-2113); off for reduced transparency, contrast,
  forced colours, calm (`app.css:4025`, `unity.css:1203-1243`).

## 4. Breakpoints

Window classes (`lib/media.ts`, `docs/ADAPTIVE-DEVICE-EXPERIENCE.md:41-45`):
compact <600 (tab bar) · medium 600-839 (rail collapsed to 72px, opens over
content with scrim and Escape) · expanded 840-1199 · large 1200-1599 ·
extra-large ≥1600. `MEDIUM_AT=600`, `TABLET_AT=840`, `DESKTOP_AT=1200`.
Handheld landscape keeps the phone layout.

`RESPONSIVE-CONTRACTS.md` (repo root) says compact 320-599, medium 600-1023,
wide 1024+ — **it disagrees with the code**. Fix the doc.

Page padding `--page-pad`: 18 (<600), 20 (600-1199), 30 (≥1200) — match the brief.
`--measure` 760 / 880 / 960; `--canvas` 1240 / 1440.

`@media` counts (styles + `site/site.css`): `max-width:839px` 11, `min-width:1200px`
8, `min-width:840px` 6, `max-width:759px` 4, `max-width:560px` 3,
`max-width:1199px` 3, `max-width:1179px` 2, `min-width:600px` 2, `max-width:640px`
2, and singletons at 639, 1100, 900, 899, 600, 559, 520, 1600, 1180, 900.
`prefers-reduced-motion` ~6-9, `forced-colors` 6-7, `prefers-contrast` ~4-6,
`pointer: coarse` 2. Only 2 `@container` rules. **759, 839, 899, 1179 and 1199
are all in use**; `lib/tiers.test.ts` and `styles/breakpoints.test.ts` hold some
of them to TS constants. Consolidating is a D2 task, test-first.

## 5. Staff and institution shells

Staff and console UIs are **screens inside the student shell**, not separate
shells, reached by role/capability hiding. Only `Console.tsx` (platform
operations; `#/console`, nested under `me`, in no menu; `holdsConsole()`
needs `console:operate` at platform scope, `lib/console/client.ts:29-31`) has a
scope bar: `console/ContextBar.tsx` shows Environment (word + shape from
`lib/environment.ts`, build-time only), Scope, Operator, Role (live grants),
MFA freshness (15 min, `MFA_FRESH_MINUTES`), Session expiry, Support access.
The 18-tab institution screen `University.tsx` shows no environment, tenant,
role or MFA; the only environment label elsewhere is the demo banner
`InstitutionalPreviewBar` (`INSTITUTIONAL_PREVIEW`). Target: a dark scope bar on
every staff surface, reusing the console bar's fields.

## 6. Routes that must stay valid

`#/<screen>[/<id>][?mode=]` for every `Screen` id including `#/course/<id>`,
`#/guide/<id>?mode=`, `#/event`, `#/item`, `#/note`, `#/write/<id>`,
`#/sheet/<id>`, `#/deck/<id>`, `#/call/<code>`, `#/edit/<id>`,
`#/drill|quiz|lesson|slides/<id>`. `RETIRED` aliases (only ever grows): weekly→brief,
worked→brief, check→announce, chat→ask, grades→courses (grades tab),
setStorage→data, everything→directory, ahead→home (week), tonight→home (hours).
`DOORS`: `#/login`, `#/signin`, `#/signup` → account. `#/room/<token>`,
`?form=<id>`, `?screen=<root|settings|ask|account>`, `?share=1`, OAuth `?code=`
return, PWA shortcuts `./?screen=study`, `./?screen=calendar`
(`public/manifest.webmanifest`). Guards: `lib/route.test.ts`, `routewhy.test.ts`,
`oneroute.test.ts`, `deeplink.test.ts`, `state/deeplink.test.tsx`,
`state/logindoor.test.tsx`, `state/returnto.test.tsx`, `lib/help-routes.test.ts`,
`nav.test.ts`, `nav.registry.test.ts`, `navareas.test.ts`, `tabbar.test.ts`,
`chrome.test.ts`.

## 7. Responsive tests

| File | Asserts |
|---|---|
| `mediumrail.test.tsx` | at 700px: rail collapsed, no tab bar, every tab keeps its name (clipped, not removed), Escape closes without Back, scrim, 72px column |
| `widthgate.test.ts` | every file reading WIDE/DESKTOP/HANDHELD/MEDIUM/`useTier`/`useMedium` has an `ASKS` row stating what the narrow window gets |
| `pageframe.test.ts` | every screen renders `<Page`/`<SettingsPage` or is in `FRAMELESS` with a reason |
| `lib/tiers.test.ts` | tiers and window classes match CSS boundaries |
| `lib/media.test.tsx` | layout survives missing/changing `matchMedia` |
| `lib/chrome.test.ts` | never two navigations at once, all combinations |
| `styles/breakpoints.test.ts` | boundaries on class edges or ledger |
| `a11y/skiplink.test.tsx`, `components/keysnarrow.test.tsx`, `unity/SystemContextBar.navigation.test.tsx`, `nav/institutional-nav.test.tsx`, `screens/mailpaging.test.tsx` | as named |

Not found: any rendered viewport test at 320 / 375 / 768 / 1024 / 1440 in CI, and
any 400%-zoom test. `smoke:a11y` is a real browser but is not in CI.

## 8. Gaps, in order

1. Rail: groups, fixed 248, Ink, active marker, ⌘K — D2.
2. Staff scope bar on every staff surface; mono references — D4.
3. `labels: off` produces icon-only tab bar — decision (ADR-0035).
4. Breakpoint consolidation and `RESPONSIVE-CONTRACTS.md` correction — D2.
5. Rendered responsive and zoom checks in CI — D5.
6. Route guard: hiding is not blocking — document, do not assume (adoption audit §7).
