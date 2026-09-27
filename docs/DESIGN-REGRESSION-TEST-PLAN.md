# Design regression test plan

What guards the design-excellence work, how the guards were shown to be
guards, and what still has to be checked by hand.

## New test files

| File | Tests | What it guards |
| --- | --- | --- |
| `app/src/styles/tokens.test.ts` | 12 | The semantic layer has every family the brief names; every `var()` resolves to a defined token; `tokens.css` writes no colour; no name shared with `industry.css` and none named `--space-*`, `--radius-*`, `--shadow-*`; the layer ladder is 20/21/80/90/100 and matches `app.css`'s literals; the focus tokens are the ring `app.css` draws; target tokens are 24 and 44; every `--motion-*` role is zeroed for reduced motion and for `data-calm='still'`/`'calm'`. In `unity.css`: every font size is a `--type-*`; no colour except the documented scrim fallback; every transition and animation uses a `--motion-*` role; `.next-step`, `.command-widget-open`, `.visibility-choice` are at least `--target-primary` |
| `app/src/styles/glass.test.ts` | 4 | Finds at least four blurred selectors; blur only on `.app-header`, `.app-tabs`, `.soft-folder`, `.focus-bar`; all four opaque under reduced transparency, more contrast and forced colours; all four opaque under Low stimulation |
| `app/src/lib/unity.test.ts` | 22 | Status vocabulary reads provenance from `where.ts`; every state has a word, a sentence and a glyph; labels are unique; the brief's words; the one sync mapping, offline outranking; Settings and the soft card take their words from it. Pins: defaults, an emptied list stays empty, unknown ids dropped, cap of five, move bounds. About this screen answers four questions for every screen in the `Screen` union. Goals go somewhere real. Workspace modes fall back to Guided and **are read by nothing that decides access**. ⌘K / Ctrl+K opens Search with either modifier, not with Alt, not while typing; bare `k` still goes to the calendar |
| `app/src/components/unity/unity.test.tsx` | 20 | Driven by named controls in jsdom: context bar names and states; Source & details is a modal that takes focus, closes on Escape and returns focus; object card rhythm and one primary; Open in writes a history entry; Capture saves a task, keeps an advisor question as a labelled private note, refuses an empty line; command centre reorders with Move up/down and pins without dragging; first goal asks, lands and can be changed; About this screen is a disclosure with four answers; Accessibility mode sets the existing settings; Focused shows a working way out; loading, error, success, progress and steps say their state in words |

## Changed test files

| File | Change |
| --- | --- |
| `app/src/styles/density.test.ts` | `tokens.css` and `unity.css` added to "spacing written past the tokens", each allowed 0 |
| `app/src/styles/deadcss.test.ts` | `unity.css` added to the sheets whose classes must be used |
| `app/src/lib/export.test.ts` | `workspaceMode`, `pinned` and `goal` added to "a backup carries the semester, not the look": a backup neither writes nor restores them |

## Existing tests that now cover the new code without change

| File | Why it covers new code |
| --- | --- |
| `styles/textscale.test.ts` | Reads every `.css` in `app/src/styles/`, so `tokens.css` and `unity.css` |
| `a11y/modal.test.ts` | Every file with `aria-modal="true"` must use `a11y/modal.ts` — includes `UnityLayer.tsx` |
| `a11y/focus.test.ts` | The ring in `app.css`, which now reads the focus tokens |
| `a11y/labels.test.ts`, `scripts/labels.mjs` | Every control in the new components has a name |
| `src/rootunmount.test.ts` | `unity.test.tsx` calls `createRoot` and unmounts in `afterEach` |
| `lib/contrast.test.ts` | Every value a semantic colour token can resolve to |

## Results when this was written

Run from `app/`:

```
npx vitest run src/styles/tokens.test.ts src/styles/glass.test.ts \
  src/styles/density.test.ts src/styles/deadcss.test.ts src/styles/textscale.test.ts \
  src/lib/unity.test.ts src/components/unity/unity.test.tsx src/a11y \
  src/rootunmount.test.ts src/lib/contrast.test.ts
→ 19 files, 186 tests passed
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
3. **Capture.** Press `/` or ⌘K / Ctrl+K; on the empty Search page press
   "Capture something". Type a line, choose "Question for advisor", Save. The
   line appears as a note; "Saved" is shown.
4. **Focus mode.** Settings → Look → Workspace mode → Focused. The tab bar
   disappears; the Focus bar shows at the bottom with the timer and Exit focus;
   Today loses the first goal and pinned widgets. Exit returns everything.
5. **Accessibility mode.** Choose it; Text size shows Large and Movement shows
   Less motion.
6. **About this screen.** At the bottom of Courses, open it: four answers and
   "Open the guidebook". Confirm it is absent on Calendar (known gap).
7. **Offline.** DevTools → offline. The strip appears above the screen
   content; Settings shows "Offline"-consistent words.
8. **Glass fallbacks.** Emulate `prefers-reduced-transparency: reduce`,
   `prefers-contrast: more` and `forced-colors: active` in DevTools rendering;
   the header and tab bar become opaque. Set Movement → Low stimulation; same.
9. **Reduced motion.** Emulate `prefers-reduced-motion: reduce`; the sheet
   appears without rising.
10. **Phone width.** At 390px and at 320px, context rows, object-card actions,
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
