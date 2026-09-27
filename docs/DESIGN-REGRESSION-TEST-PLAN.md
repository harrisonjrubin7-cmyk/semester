# Design regression test plan

What guards the design-excellence work, how the guards were shown to be
guards, and what still has to be checked by hand.

## New test files

| File | Tests | What it guards |
| --- | --- | --- |
| `app/src/styles/tokens.test.ts` | 12 | The semantic layer has every family the brief names; every `var()` resolves to a defined token; `tokens.css` writes no colour; no name shared with `industry.css` and none named `--space-*`, `--radius-*`, `--shadow-*`; the layer ladder is 20/21/80/90/100 and matches `app.css`'s literals; the focus tokens are the ring `app.css` draws; target tokens are 24 and 44; every `--motion-*` role is zeroed for reduced motion and for `data-calm='still'`/`'calm'`. In `unity.css`: every font size is a `--type-*`; no colour except the documented scrim fallback; every transition and animation uses a `--motion-*` role; `.next-step`, `.command-widget-open`, `.visibility-choice` are at least `--target-primary` |
| `app/src/styles/glass.test.ts` | 4 | Finds at least four blurred selectors; blur only on `.app-header`, `.app-tabs`, `.soft-folder`, `.focus-bar`; all four opaque under reduced transparency, more contrast and forced colours; all four opaque under Low stimulation |
| `app/src/lib/unity.test.ts` | 22 | Status vocabulary reads provenance from `where.ts`; every state has a word, a sentence and a glyph; labels are unique; the brief's words; the one sync mapping, offline outranking; Settings and the soft card take their words from it. Pins: defaults, an emptied list stays empty, unknown ids dropped, cap of five, move bounds. About this screen answers four questions for every screen in the `Screen` union. Goals go somewhere real. Workspace modes fall back to Guided and **are read by nothing that decides access**. ⌘K / Ctrl+K opens Search with either modifier, not with Alt, not while typing; bare `k` still goes to the calendar |
| `app/src/components/unity/unity.test.tsx` | 26 | Driven by named controls in jsdom: context bar names and states, and holds an action while it cannot run; Source & details is a modal that takes focus, closes on Escape and returns focus; object card rhythm, one primary, primary held while running; Open in writes a history entry; Capture saves a task, keeps an advisor question as a labelled private note, **is reached from the `+` box carrying over what was typed**, refuses an empty line; command centre reorders with Move up/down and pins without dragging; first goal asks, lands and can be changed; About this screen is a disclosure with four answers; **About this screen on the full-bleed screens** — drawn on every one of them, last, in the same words; opens in place on a screen that scrolls; opens as a sheet on a screen that fills its box, so the composer stays put; Accessibility mode sets the existing settings; Focused shows a working way out; loading, error, success, progress and steps say their state in words |
| `app/src/components/unity/rollout-a.test.tsx` | 8 | The first rollout, each real screen mounted in the real store. The deadline: a context bar naming course, kind and item, with a sample source and Done on it, and Source & details saying where the date came from. The course hub: a context bar at `h2` that calls a seed course a sample whatever the term. The study guide: named under its course, as a sample, keeping where it was built from. Study Studio: the draft under a context bar at `h3`, AI-assisted and saved, with Save & open in Write as its primary; generation as named steps, showing which failed. Update: reading several files as determinate progress; reading one file as three steps and the one it stopped on. No `vi.mock` — it runs in the shared workers and holds `fetch` at the edge instead |
| `app/src/components/unity/rollout-b.test.tsx` | 9 | The recovery-copy error as an announced `ErrorState` with the download as its recovery, on Registration day and in the graduation simulator; Registration day acknowledging a finished checklist and offering only steps it does not already show, and saying nothing is complete while it is not; Close term saying the term is closed and offering the record and the next import; Career's opportunity as an `ObjectCard` with Track it first; Pathway headed by a context bar that says it is yours and unconfirmed with Edit as its one primary; Degree marking its arithmetic as yours and needing confirmation; University's school records as connected task cards, primary only when writing is allowed. Uses module mocks, so it is listed in `MOCKS_MODULES` in `app/vite.config.ts` and runs in the isolated `mocked` project (`src/isolation.test.ts` fails if that list and the tree disagree) |
| `app/src/components/unity/rollout-c.test.tsx` | 19 | Account: Synced in the shared words above the counts; a failed sync as an `ErrorState` whose recovery is the same check. Write, Mine and Settings → Assistant: the shared save line. Support access: created and revoked as permission changes; a failed load as an error that tries again. Family: a saved permission plan. Share course: what the shared file carries. Export and Snapshots: restores as the shared success state. Toolkit: the open workspace under a context bar; a failed save as an error whose way out is the recovery copy. Travel pack: shared progress with Cancel; a run that got nothing as the reason with one way to try again. Import: progress while several files are read; a failed build as an error that builds again; `Trouble` kept for a failure with nothing to retry |

## Changed test files

| File | Change |
| --- | --- |
| `app/src/styles/density.test.ts` | `tokens.css` and `unity.css` added to "spacing written past the tokens", each allowed 0 |
| `app/src/styles/deadcss.test.ts` | `unity.css` added to the sheets whose classes must be used |
| `app/src/lib/export.test.ts` | `workspaceMode`, `pinned` and `goal` added to "a backup carries the semester, not the look": a backup neither writes nor restores them |
| `app/src/a11y/tellings.test.ts` | Counts `<ErrorState` as an announced error, since the component is `role="alert"` itself |
| `app/vite.config.ts` | Not a test file: `rollout-b.test.tsx` added to `MOCKS_MODULES` |

## Existing tests that now cover the new code without change

| File | Why it covers new code |
| --- | --- |
| `styles/textscale.test.ts` | Reads every `.css` in `app/src/styles/`, so `tokens.css` and `unity.css` |
| `a11y/modal.test.ts` | Every file with `aria-modal="true"` must use `a11y/modal.ts` — includes `UnityLayer.tsx`, and so the About this screen sheet |
| `lib/onframe.test.ts` | "keeps the capture box reachable now that no sidebar carries it" — the `+` launcher that now leads to Capture |
| `a11y/focus.test.ts` | The ring in `app.css`, which now reads the focus tokens |
| `a11y/labels.test.ts`, `scripts/labels.mjs` | Every control in the new components has a name |
| `src/rootunmount.test.ts` | `unity.test.tsx` calls `createRoot` and unmounts in `afterEach` |
| `lib/contrast.test.ts` | Every value a semantic colour token can resolve to |

## Results when this was written

Run from `app/`, after the rollout:

```
npx vitest run src/components/unity src/lib/unity.test.ts src/styles/tokens.test.ts \
  src/styles/glass.test.ts src/a11y src/lib/onframe.test.ts src/isolation.test.ts
→ 19 files, 223 tests passed
  (unity.test.tsx 26, rollout-a 8, rollout-b 9 in the mocked project,
   rollout-c 19, lib/unity.test.ts 22)
```

The full five gates (`tsc -b`, `lint`, `test`, `test:shuffle`, `build`) are
reported in the PR description, not here.

## How the guards were proven

`CLAUDE.md`: a guard that has never failed is not known to be a guard.

The implementing session reports that it broke each of the two style guards on
purpose and watched them fail before restoring:

- `tokens.test.ts` — a colour literal written into `tokens.css`, and a token
  pointing at an undefined primitive.
- `glass.test.ts` — a surface removed from the reduced-transparency block.

These were done during implementation and are not reproducible from the
repository. To repeat them:

1. In `app/src/styles/tokens.css`, change `--surface-base: var(--app-panel);`
   to `--surface-base: #12141a;`. Run `npx vitest run src/styles/tokens.test.ts`:
   "writes no colour of its own" fails. Restore.
2. Change it to `var(--app-panle)`: "points only at tokens that exist" fails.
   Restore.
3. In `app/src/styles/unity.css`, delete `.soft-folder,` from the
   `@media (prefers-reduced-transparency: reduce), …` block. Run
   `npx vitest run src/styles/glass.test.ts`: "makes every allowed surface
   opaque …" fails. Restore.
4. Add `backdrop-filter: blur(4px);` to `.object-card` in `unity.css`: "allows a
   blur only on the listed surfaces" fails. Restore.
5. In `app/src/lib/status.ts`, give `synced` the label `'Saved'`: "has one
   wording per state" fails. Restore.
6. In any capability helper (for example one exporting `allowed` or
   `forRole`), add a reference to `workspaceMode`: "are read by nothing that
   decides access" fails. Restore.

Controls already built into the tests: `glass.test.ts` asserts it found at
least four blurs, `unity.test.ts` asserts it found at least one access-deciding
file and more than fifty screens, and `density.test.ts` includes a decoy that
must not match. A test that passes because its probe found nothing is caught.

## Manual verification

Using `.claude/skills/run` (dev server, skip the adoption prompt, choose layout
and navigation, screenshot):

1. **Today, Ink and Parchment.** First goal shows "What would help most
   today?"; choosing one navigates; returning shows "Your focus · … · Change".
   Pinned widgets show three rows; Arrange shows Move up / Move down / Unpin.
2. **Source & details.** On Today → Your path, press Source & details. The
   sheet shows Origin "Yours", Used in, Limitations, "Only you". Escape closes
   it and focus is back on the button. Repeat at desk width: it is a centred
   window.
3. **Capture.** Press the header's `+` (or `q`). Type a line with no date and
   choose "Question for advisor" under "Or keep it as": the Capture sheet opens
   with the line already in it and that kind selected. Save. The line appears
   as a note; "Saved" is shown. Repeat from ⌘K → "Capture something": the
   same `+` box opens.
4. **Focus mode.** Settings → Look → Workspace mode → Focused. The tab bar
   disappears; the Focus bar shows at the bottom with the timer and Exit focus;
   Today loses the first goal and pinned widgets. Exit returns everything.
5. **Accessibility mode.** Choose it; Text size shows Large and Movement shows
   Less motion.
6. **About this screen.** At the bottom of Courses, open it: four answers and
   "Open the guidebook". On Calendar it is after the grid and opens in place.
   On Ask and Mail it is one line under the screen; pressing it opens a sheet
   with the same answers and the composer stays on the bottom edge.
7. **Placed components.** Open a deadline: a context bar with its origin
   ("Sample" for a seed course), Source & details, and Next below. Open a
   course: the banner is a context bar, not a card inside a card. In Study
   Studio, generate a guide and watch the named steps; Save is disabled while
   it runs. In Career, open an opportunity and switch to Detailed mode: the
   source sentence appears on the card.
8. **Offline.** DevTools → offline. The strip appears above the screen
   content; Settings shows "Offline"-consistent words.
9. **Glass fallbacks.** Emulate `prefers-reduced-transparency: reduce`,
   `prefers-contrast: more` and `forced-colors: active` in DevTools rendering;
   the header and tab bar become opaque. Set Movement → Low stimulation; same.
10. **Reduced motion.** Emulate `prefers-reduced-motion: reduce`; the sheet
   appears without rising.
11. **Phone width.** At 390px and at 320px, context rows, object-card actions,
    Open in and capture kinds wrap without horizontal scroll.

## Visual evidence

There is no snapshot tooling in the repository and none was added, so there are
no visual regression snapshots. Visual evidence is screenshots taken with
`.claude/skills/run` and attached to the PR, at minimum: Today (dark and
light), the Source & details sheet (phone and desk), the Capture sheet, Focused
mode, and Settings → Workspace mode. `scripts/contrast-sweep.mjs` and
`scripts/targets-sweep.mjs` are the measured equivalents for contrast and
target size.

Adding snapshot tests is a follow-up. If added, capture per ground (at least
Ink, Parchment, Industry, Fog) and per density, because both change geometry
and colour.
