# CLAUDE.md

Notes for an agent working in this repository. Everything here was learned by
getting it wrong first; each section says what the failure looked like, because
a rule without its failure is one somebody talks themselves out of.

## Check main before you start, for the thing itself

**Several sessions work this repository at once, and they converge.** Given the
same audit document and the same app, two agents given unrelated prompts reach
the same finding within minutes of each other. That is not a hypothetical: in
one hour on 15 September, main took sixteen merges, and two pieces of work were
built, validated and opened as pull requests here before their authors
discovered the identical fix had already landed — one by ten minutes, one by
forty-four.

So the first thing any task does, before reading code and long before writing
any:

```bash
git fetch origin main
git log --oneline -30 origin/main
```

**Read it for the defect, not for the titles.** Both duplicates above would have
survived a title scan: the palette fix landed as "The faint rung passed on the
panel it was sampled on", the teardown fix inside a commit named for the CI step
that found it. What catches them is grepping for the thing:

```bash
git log --oneline -40 origin/main | grep -i <the-thing>
git log -p --since="6 hours ago" origin/main -- <the-file-you-are-about-to-edit>
git show origin/main:<path> | grep -n <the-symbol-or-value>
```

If it has landed, **say so and stop** — do not open the pull request to be
thorough, and do not re-tune numbers somebody has already argued for. A merged
decision is a decision. Two things are still worth doing when you find one:
check whether their fix covers every instance yours would have (mine covered six
files, theirs covered seven and added a guard), and check whether they left the
recurrence open. Landing the guard nobody wrote is worth more than landing the
fix twice.

Branches move under you for the same reason. Rebase onto `origin/main` before
pushing rather than after CI tells you.

## A decision takes its pull request's number

The decision log numbered decisions in turn, and every pair of open pull
requests collided on the next number and on the end of the same file. One pull
request was renumbered nine times on 30 September, rerunning CI each time. The
log is closed at D-160. A new decision is `docs/decisions/D-<pull request
number>.md`: open the pull request first, then write it
([`docs/decisions/README.md`](docs/decisions/README.md)). The test refuses a
new section in the log and any number written twice.

## The gates, and what each is for

Every command runs from `app/`, not the repository root — the root
`package.json` is the npm workspace manifest (`app/` and `packages/*`, one
lockfile) and defines none of these scripts, so `npm test` there fails with
"Missing script" instead of running the suite. Install from the root
(`npm ci`), which links every workspace; `npm ci` inside `app/` installs only
`app/`'s dependencies and skips the `@semester/*` links.
[REGRESSION-CHECKLIST.md](REGRESSION-CHECKLIST.md) says the same thing at more
length, and holds the baseline figures.

```bash
cd app
npx tsc -b            # types
npm run lint          # oxlint, plus the style and label audits
npm run check:university  # the gateway's own NodeNext typecheck
npm test              # the suite, in file order
npm run test:shuffle  # the suite, in an order nobody chose
npm run build         # production build
```

`check:university` is not a duplicate of `tsc -b`. It compiles the gateway
(`server/`, `api/`, `packages/institution`) under `module: NodeNext`, where a
`.ts` file is CommonJS unless a `package.json` above it says
`"type": "module"`, and nothing under `supabase/functions/` does. So `tsc -b`
can be green while this is red. It happened on #803, when `packages/institution`
re-exported a module from `supabase/functions/_shared/`: every local gate
passed and CI failed with TS1287. Code under `supabase/functions/` stays out of
anything the gateway imports.

`test:shuffle` is not a duplicate of `test`. Green `test` and red
`test:shuffle` means the tests depend on each other, which is a different fault
from a broken test and almost always wants fixing in the *earlier* file — the
one the failure does not name.

Two failure modes live in there and they are not the same:

- **An ordering failure is reproducible.** Vitest prints its seed, and
  `npm run test:shuffle -- --sequence.seed=N` runs that arrangement again.
- **A timing failure is not.** `ReferenceError: window is not defined` out of
  `react-dom` is a React root left mounted when a file ended, and replaying the
  seed does not bring it back: a seed fixes the order, not the race. Consecutive
  green shuffle runs are therefore weak evidence about this class. Do not report
  them as proof. `src/rootunmount.test.ts` is the real guard.

## Proving a change, in a repository that argues from measurement

The commit messages here carry measured figures, and they are checked. Match
that standard rather than the usual one.

- **A guard that has never failed is not known to be a guard.** Revert the fix
  under the new test and watch it go red, then restore it. Two tests in this
  repository passed against a faithful revert of the bug they were written for,
  and were only found because someone tried.
- **Include a control.** Measuring six suspects and finding six problems is also
  what a broken probe looks like. The first teardown probe written here keyed on
  the presence of `__reactContainer$`, which React leaves behind on unmount and
  only nulls — every file read as leaking, including two that were already
  fixed. The controls caught it; nothing else would have.
- **A clean reading is a claim about the probe too.** The second version of that
  probe scanned `document.body` for live roots, and reported
  `screens/call/leaving.test.tsx` clean. It was not clean. That file's teardown
  called `host.remove()`, so its mounted root sat on a *detached* host where a
  document scan cannot see it — the probe was answering a narrower question than
  the one being asked. Counting its tests against its unmounts had said "leak",
  and the count was right. When a measurement clears a suspect the cheap signal
  convicted, find out which one is lying before believing the measurement.
- **A structural check catches what a runtime probe misses.**
  `src/rootunmount.test.ts` asks only whether a file that calls `createRoot` has
  an `unmount` in an after hook. It cannot be fooled by a detached host, a race
  that did not fire, or a probe with a bug in it, and it found that file.
- **Look at the screenshot.** For anything visual, drive the app — `.claude/skills/run`
  has the browser setup, the adoption prompt, and the seeding. A dark rectangle
  is a failure to launch, not a dark theme.

## Contrast, if you are touching `lib/look.ts`

Thirteen grounds, two faded strengths, and both have now been wrong the same
way: measured against `--app-panel`, which is the surface a fade of the
foreground is *strongest* on. A light ground's void is two steps darker.
`lib/contrast.test.ts` walks the whole ramp for both rungs — keep it that way,
and measure a new ground against every surface it has rather than the one that
flatters it.

## Building UI: Semester's design system

Semester is a calm academic workspace, not a dashboard theme. Build screens
native to it: a clear hierarchy, one primary action, useful content, consistent
density, and every state a student can reach. Do not reach for generic SaaS
patterns — decorative card grids, gradient surfaces, pill badges, one-off
shadows. The fastest way to write a screen is to copy the last one; the rules
below exist because by November the last one is whatever was written last.

**Which file wins, in order.** When two disagree, the earlier one is right and
the later one is stale.

1. `app/src/lib/look.ts` decides every colour (13 grounds, 11 accents), measured by `lib/contrast.test.ts`.
2. `app/src/styles/tokens.css` is the semantic CSS-token authority: `--surface-*`, `--text-*`, `--border-*`, `--action-*`, `--status-*`, `--focus-*`, `--layer-*`, `--motion-*` and the rest.
3. `app/src/lib/tokenexport.ts` produces the export from 1 and 2.
4. `app/design-tokens/semester.tokens.json` is **generated. Never edit it.** `npm run tokens:export` rewrites it and `lib/tokenexport.test.ts` fails when it drifts. The docs (`docs/DESIGN-TOKENS.md`, `DESIGN-SYSTEM-GUIDE.md`) copy these; they are stale where they differ.
5. The tests in `app/src/styles/` and `app/src/a11y/` are design contracts, not suggestions. Extend them; do not loosen one to get green.
6. Figma is evidence of approved visual intent, never an authority over any of the above.

**Before writing UI,** search `components/ui.tsx`, `components/Page.tsx`,
`components/unity/`, `gallery/stories.tsx` and the nearest screen in
`screens/`, and say which existing pattern you are reusing. A new shared
component needs the case made in `docs/design/GOVERNANCE.md` §2; a wrapper or a
feature-local variant needs evidence that the shared one cannot serve. Add no
UI dependency, framework, Tailwind, Storybook or package; there are none.

**Values.** Use semantic variables and the scales. Do not write a raw colour,
spacing, radius, shadow, z-index, font size, duration or easing in feature UI.
`npm run design-system:audit` counts them per file against
`src/styles/rawbudget.ts`; the ledger may shrink and may not grow. A raw value
is allowed where it is the definition of a token (a custom property in
`tokens.css`, `app.css`'s `:root`, `industry.css`, `look.ts`), in a test
fixture, in a generated file, or in `ALLOWED_RAW`/`hex.test.ts` with a reason.

**Accessibility.** Native elements first. Visible keyboard focus. An accessible
name on every icon-only control (`npm run lint:labels`). A field's label,
description and error are programmatically related (`components/FieldMessage.tsx`).
Colour is never the only status signal: pair it with a word or glyph
(`lib/status.ts`). Honour reduced motion by animating through `--motion-*`.

**Responsive.** The breakpoints are `lib/media.ts` (600 / 840 / 1200 / 1600),
the gutter is `--page-pad`, the touch target is `--target-primary` (44px).
Critical content and the primary action survive at 320px; nothing important
depends on hover. Contracts: `styles/{breakpoints,gutter,taps,density,stacking}.test.ts`.

**States.** Cover the ones that apply: default, loading, empty, error with a
way back, disabled, success, long content, and permission. Use the shared
`EmptyState`, `Notice`, `ErrorState`, `LoadingState` and `PermissionNotice`
(`components/ui.tsx`, `components/unity/States.tsx`) and the vocabulary in
`docs/design/RECOVERY-STATE-LIBRARY.md`.

**Figma.** Only when a Figma URL, node, component or variable is given, use the
Figma MCP (`.mcp.json`; each developer authenticates with `/mcp`). Read it;
never write to a Figma file unless the user asked. Map a Figma variable to an
exported token path and a Figma component to an existing React or CSS pattern
*before* creating anything, and record what does not map in
`docs/design-system/FIGMA-MAPPING.md` and `figma-mapping.json`. A Figma frame
that omits loading, empty, error, disabled, permission, keyboard, focus or
narrow states does not remove them from the task. Do not add a raw value for
pixel parity.

**Done means** the gates above pass and these pass too, from `app/`:

```bash
npm run design-system:check   # token export in step, raw values within the ledger, Figma mapping valid
npm run design-system:report  # the same plus the contract tests, written to reports/design-system/
```

and your summary names the files changed, the existing assets reused, the
states and accessibility covered, and the design-system gaps still open. Three
skills do this work: `/build-semester-ui`, `/audit-semester-design-sync` (read
only until asked to implement) and `/create-semester-component`.
