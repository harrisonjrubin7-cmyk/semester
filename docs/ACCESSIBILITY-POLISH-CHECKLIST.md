# Accessibility polish checklist

Each item from the brief's WCAG 2.2 requirements, ticked only where there is
evidence in the repository. `[x]` done and held; `[~]` partly done; `[ ]` not
done. Evidence names the file, test or script.

## Target size

- [x] 24×24 minimum for pointer targets — `.tap`/`.tap-x`/`.tap-y` and the
  `.btn` floor; `styles/taps.test.ts`, `styles/reach.test.ts`;
  `scripts/targets-sweep.mjs` (0 under 24×24 at all densities, per
  `reach.test.ts`'s header; not a CI step).
- [x] 44×44 for primary touch controls — `.btn`, `ActionButton` (46),
  `--target-primary` on `.next-step`, `.command-widget-open`,
  `.visibility-choice` (`styles/tokens.test.ts`).
- [x] Dense controls keep reach at Tight density — `reach.test.ts`.

## Focus

- [x] Visible indicator on keyboard focus — `.device :focus-visible`,
  `a11y/focus.test.ts`.
- [x] Sufficient contrast, offset, consistency — `--focus-color` is
  `--app-accent-deep`, held to 4.5:1 (`lib/contrast.test.ts`); offset 2px;
  one rule app-wide; `Highlight` under forced colours.
- [x] Outlines never removed globally — `focus.test.ts` fails on
  `outline: none` for `:focus-visible` without a redraw.
- [~] Not hidden by sticky header or tab bar — scroll margins of 96px and
  84px (`--focus-clear-top`, `--focus-clear-bottom`). Not measured for the new
  Focus bar.
- [x] Not hidden by sheets and dialogs — they are modal and trap focus
  (`a11y/modal.test.ts`).
- [x] Focus returns to the opener after a sheet closes — `useModal`;
  `unity.test.tsx` asserts it for Source & details.

## Drag alternatives

- [x] Every draggable ordering can be rearranged without dragging —
  `a11y/dragging.test.ts`.
- [x] The new command centre uses Move up / Move down / Pin / Unpin, no drag —
  `unity.test.tsx`.
- [~] Course to schedule, source to evidence matrix, panel resize — no
  evidence matrix or resizable panel exists; course planning alternatives not
  audited here.

## Reflow and zoom

- [~] 320 CSS px with no two-dimensional scrolling — `scripts/accessibility-smoke.mjs`
  checks six journeys at 320px (not a CI step). New components wrap
  (`flex-wrap` throughout `unity.css`) but were not measured at 320px.
- [x] Text scaling and browser font size reach every stylesheet size —
  `styles/textscale.test.ts`, `a11y/type.test.ts`.
- [x] Inputs never under 16px on touch — `styles/fields.test.ts`.
- [x] No orientation lock — `public/manifest.webmanifest` sets no
  `orientation` and no source calls `screen.orientation.lock` (checked by
  search; not held by a test).

## Keyboard and screen readers

- [x] Every control has a name — `npm run lint` (`scripts/labels.mjs`),
  `a11y/labels.test.ts`.
- [x] Landmarks, one `main`, one `h1` — `a11y/landmarks.test.ts`.
- [x] Dialogs trap focus and close on Escape — `a11y/modal.test.ts`,
  `unity.test.tsx`.
- [x] ⌘K / Ctrl+K opens Search, not while typing or under a modal —
  `lib/unity.test.ts`.
- [x] Live regions used sparingly — `SaveState` polite except offline,
  conflict and sync trouble; `Undone` polite and never takes focus;
  `LoadingState` polite.
- [x] Loading announces itself — `LoadingState` (was silent before).
- [x] Step progress read in words — `StepStatus` hidden words and
  `aria-current="step"`.
- [x] Every status carries a word and a glyph, never colour alone —
  `lib/unity.test.ts` "gives every state a word, a sentence and a glyph".
- [ ] Keyboard audit of the rich-text editors, charts and media controls.

## Forms and errors

- [x] Every field labelled — label lint.
- [~] Error beside the field with a summary, focus to the first invalid
  field — `ErrorState` exists for region-level errors; no shared field-level
  error pattern.
- [x] Entered content preserved on failure — Capture keeps focus and clears
  only after a successful save; `Trouble` retries without re-entry.
- [x] Destructive actions confirmed — `TypeToConfirm`; reversible ones undone —
  `Undone`.
- [x] No shake, motion or colour-only error — `ErrorState` and `Trouble` are
  words plus a glyph.

## Media, charts, complex data

- [~] Captions and transcripts — `<track kind="captions">` in
  `components/Sound.tsx` and `ScanIsbn.tsx`; `npm run transcripts` generates
  transcripts. Not audited for every player.
- [~] Text alternatives for visuals — `Meter` says its figure
  (`a11y/tellings.test.ts`). Chart data-table alternatives not audited.

## Motion

- [x] `prefers-reduced-motion` honoured — `app.css` blanket rule; every
  `--motion-*` role zeroed in `tokens.css`.
- [x] The app's own Less motion and Low stimulation — `data-calm`,
  `a11y/calm.test.ts`.
- [x] Script scrolls respect both — `scrollKindly`, `a11y/motion.test.ts`.
- [x] No motion-only state and no autoplay in new components.

## Transparency and contrast preferences

- [x] Glass only on four surfaces — `styles/glass.test.ts`.
- [x] Opaque under reduced transparency, more contrast, forced colours and
  Low stimulation — `glass.test.ts` (new in this change).
- [x] Increase contrast raises dim text and hairlines — `tokensFor` `LOUD`
  floor, `contrast.test.ts`.
- [x] Forced colours keep edges on shared surfaces — `unity.css`
  `@media (forced-colors: active)`.

## Consistent help (SC 3.2.6)

- [~] Help in the same relative place on every screen — About this screen is
  last in every non-exempt screen's content. Missing on the nineteen exempt
  screens, including Calendar and Assignments; see
  [ONBOARDING-AND-CONTEXTUAL-HELP.md](ONBOARDING-AND-CONTEXTUAL-HELP.md#the-exempt-screen-gap).

## Open items

1. About this screen on exempt screens.
2. Field-level error pattern with summary and focus management.
3. Measure the Focus bar against the assistant button and the bottom focus
   clearance.
4. Keyboard and screen-reader audit of data tables, rich-text editors, media
   controls and chart alternatives.
5. Run `smoke:a11y` at 320px over the screens that adopt the new components.
