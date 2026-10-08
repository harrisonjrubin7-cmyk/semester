# Component release checklist

What a new or changed component or screen must show before its pull request
leaves draft. Adapted from the brief to the gates this repository actually
runs. `CLAUDE.md` and `REGRESSION-CHECKLIST.md` are the authorities; this page
collects the design-specific parts.

## Before writing anything

```bash
git fetch origin main
git log --oneline -30 origin/main
git log --oneline -40 origin/main | grep -i <the-thing>
```

Several sessions work this repository at once. If the component or fix has
landed, stop, and check whether the landed version left a guard unwritten.

## The gates

Every command runs from `app/`. The repository root `package.json` is the npm
workspace manifest (`app/` and `packages/*`, one lockfile) and defines none of
these scripts, so `npm test` there fails with "Missing script" instead of
running the suite. Install from the root with `npm ci`.

```bash
cd app
npx tsc -b            # types
npm run lint          # oxlint, plus the style and label audits
npm test              # the suite, in file order
npm run test:shuffle  # the suite, in an order nobody chose
npm run build         # production build
```

All five must pass. `test:shuffle` is not a duplicate: green `test` with red
`test:shuffle` means tests depend on each other. A `window is not defined`
from `react-dom` is a root left mounted — `src/rootunmount.test.ts` requires an
`unmount` in an `afterEach` or `afterAll` for any file calling `createRoot`.

Compare against the figures in `REGRESSION-CHECKLIST.md`; a dropped test is a
regression, not a cleanup.

## Browser checks (not in CI; run and record the result)

| Check | Command | When |
| --- | --- | --- |
| Painted contrast | `npm run dev`, then `npm run sweep:contrast` (scratch Playwright; see script header) | Any colour, surface, shadow or overlay change |
| Target sizes | `npm run sweep:targets` | Any new control or spacing change; run at all three densities |
| Accessibility smoke | `npm run build && npm run preview`, then `npm run smoke:a11y` | Any shell, landmark or layout change; covers 320px reflow on six journeys |
| Screenshot | `.claude/skills/run` | Anything visual. A dark rectangle is a failure to launch, not a dark theme |

## Screen quality threshold

A screen passes when, in its first visible area:

- [ ] It says where the student is (the header title; a `ContextBar` on a
  workspace).
- [ ] It shows what matters now, first and largest.
- [ ] It offers one primary action, as a button.
- [ ] Anything else is one press away behind a disclosure, not removed.
- [ ] Every sourced fact has "Source & details" or a status chip from
  `lib/status.ts`.
- [ ] Empty, loading, error and offline states use the shared components
  ([EMPTY-LOADING-ERROR-SUCCESS-STATES.md](EMPTY-LOADING-ERROR-SUCCESS-STATES.md)).
- [ ] It works at phone width with no loss of capability — same actions, same
  source access, same privacy controls.
- [ ] "About this screen" appears last. It does automatically for any screen
  that goes through `ShellBody`; a new screen that fills its box (a chat, a
  mailbox) is added to `FILLS` in `components/shell/exempt.ts` so the answers
  open in a sheet instead of pushing its pinned controls off the bottom.

## Design-system checklist for a component

### Tokens

- [ ] Colours only through semantic tokens (`--surface-*`, `--text-*`,
  `--border-*`, `--action-*`, `--status-*`) or, in older code, `--app-*`
  primitives. No hex, `rgb()` or `hsl()`.
- [ ] Font sizes only `var(--type-*)`; spacing only `var(--sp-*)` or
  `calc(Npx * var(--density, 1))`.
- [ ] Motion only through `var(--motion-*)`.
- [ ] No new custom property named `--space-*`, `--radius-*` or `--shadow-*`
  (they belong to `industry.css`).
- [ ] If the rules live in `unity.css`, `styles/tokens.test.ts` passes
  unchanged. If they live elsewhere, the same rules still apply and the style
  lint (`npm run lint`) passes.

### Accessibility

- [ ] Native element where one exists (`button`, `a`, `input`, `select`,
  `dialog` semantics via `useModal`).
- [ ] Name, role and state on every control; `aria-expanded` on disclosures;
  `aria-pressed` on toggles.
- [ ] 24×24 minimum target, 44 for primary; use `.tap-y`/`.tap-x`/`.tap` for a
  small drawing.
- [ ] The app focus ring is not overridden; if it must be, it is redrawn
  (`a11y/focus.test.ts`).
- [ ] Any `aria-modal="true"` uses `useModal` (`a11y/modal.test.ts`).
- [ ] Any draggable ordering has a tap alternative (`a11y/dragging.test.ts`).
- [ ] Status never carried by colour alone: word plus glyph.
- [ ] Live regions polite unless the student must act now.
- [ ] Headings: one `h1` per screen (the header's); a component that renders a
  heading takes its level as a prop.

### Trust and privacy

- [ ] States said through `statusOf`, never as string literals.
- [ ] AI output labelled `ai-assisted`, with sources used and limitations.
- [ ] Visibility stated where anything could be shared; only `allowed`
  audiences offered.

### Presentation-only

- [ ] No workspace mode, goal or pin decides access
  (`lib/unity.test.ts` "are read by nothing that decides access").

### Tests

- [ ] A test that drives the component by its named controls, as a student
  would (`components/unity/unity.test.tsx` is the pattern).
- [ ] The new test was proved to be a guard: revert the fix, watch it fail,
  restore.
- [ ] A control is included where a probe could be fooled.
- [ ] `afterEach` unmounts any React root.

## Pull request contents

The brief's list, which this repository's PRs should carry:

- Summary, changed files, affected routes and compatibility notes
- Token and migration notes
- Scorecard rows before → after ([WCAG-UI-AUDIT-SCORECARD.md](WCAG-UI-AUDIT-SCORECARD.md))
- Device matrix: phone, tablet, desktop; each of the three layouts (`SHELLS`
  in `lib/look.ts`: Drawn, Grouped, Soft)
- Tests run, with the counts
- Screenshots from `.claude/skills/run`
- Feature-flag keys and defaults, or "none" with the reason
- Rollback approach
- Known limitations and remediation
- Manual verification steps
- Confirmation that nothing was deployed or merged
