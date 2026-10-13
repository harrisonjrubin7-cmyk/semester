# The Semester prototype

`ui_kits/semester-app/` is a single interactive prototype of all of Semester. It is the **acceptance reference** for screens, states, behavior and copy. It is not production code: no backend, synthetic data, state kept in the browser.

## Run it
Serve the design folder with any static server (for example `npx serve design`) and open:
- `ui_kits/semester-app/index.html`: desktop, starts at the Semester OS home
- `ui_kits/semester-app/mobile.html`: the same app in an iPhone frame, with jump links by role

Routes are hash-based: `index.html#/<workspace>/<screen>`. Short aliases: `#/student`, `#/prospect`, `#/applicant`, `#/admitted`, `#/faculty`, `#/admin`, `#/finance`, `#/clubs`, `#/marketplace`, `#/alumni`, `#/messages`, `#/signin`. Every workspace has a phone menu at `#/<workspace>/__menu`.

## Size
281 routes in 25 workspaces. Full list with components, files and build streams: `SCREEN-INVENTORY.md` (machine-readable: `screens.json`).

## How it's built (so you can read it)
- `index.html` loads the design-system bundle (`_ds_bundle.js`), shared CSS, then ~75 JSX files in order. Load order matters: later files extend earlier ones.
- `Shell.jsx` defines `window.SEM_WS` (workspaces: label, person, nav) and the shell (header, rail, mobile tab bar, routing, error boundary). Unknown screens fall back safely.
- Each feature file adds nav items to `SEM_WS.<ws>.nav` and screen components to `window.SEM_SCREENS.<ws>`.
- `NavGroups.jsx` groups large sidebars (`SEM_NAV_GROUPS`), sets per-workspace phone tabs (`SEM_TABS`) and the `__menu` screen.
- Components come from the design system (`window.SemesterDesignSystem_*`: Button, Notice, Switch, MetricTile, Avatar, EmptyState, ErrorState, Icon). Shared CSS classes (`card`, `li`, `ri`, `pill[data-tone]`, `tabs`, `flow`, `sm`, `tok`/`tbad`) live in `index.html`.
- State persists with `window.useLS(key, default)` under `localStorage` keys prefixed `sem-`. Clearing them resets the demo.
- `SEM_DATA` (in `Shell.jsx`) is the demo cast: Maya Chen (student), Prof. Nguyen, Dr. Alvarez, Kendra Lee (advisor), etc.

## What is simulated (build the real thing)
Timers, toggles and fake servers stand in for: SSO, SIS/LMS sync, payments and ledger, Yjs/WebSocket collaboration and Redis fan-out, PDF builds, AI responses, moderation classifiers, metrics and alerts, migrations. Each simulation shows the intended states and failure paths; keep the toggles as test fixtures.

## Where each part is specified
`SPEC-INDEX.md` maps the source PDFs (`uploads/`) to prototype files. `NEXT-SESSION.md` at the project root is the as-built change log, newest first; stream files in `handoff/execute/19–24` quote the relevant entries as "Behaviors to reproduce".
