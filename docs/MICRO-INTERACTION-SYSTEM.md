# Micro-interactions and motion

Motion in Semester explains a change of state and then gets out of the way. It
is never the only carrier of a state, never decorative, and never on for
somebody who has asked for less of it — on their device or in the app.

## Motion tokens

Defined in `app/src/styles/tokens.css`. Rules animate through the `--motion-*`
roles, not the raw durations, because the roles are what the reduced-motion
paths zero.

| Role | Value | Brief's figure | Used by |
| --- | --- | --- | --- |
| `--motion-save` | 180ms, `--ease` | save 150ms | `.save-state` colour transition |
| `--motion-insert` | 180ms, `--ease` | insert 180ms | Not yet used by a rule |
| `--motion-panel` | 240ms, emphasized | panel 220ms | Not yet used by a rule |
| `--motion-sheet` | 280ms, emphasized | sheet 280ms | `.unity-sheet` entry (`unity-sheet-in`: fade from 0 and rise 8px) |
| `--motion-progress` | 180ms, linear | progress 200ms / state-driven | `.state-progress-bar` |

The durations are close to the brief's rather than identical: 130ms is the
app's existing hover/press speed (`--fast`) and was kept, and 180/240 are the
standard/slow steps the role tokens share. `--ease-emphasized` is
`cubic-bezier(0.2, 0.8, 0.2, 1)`; `--ease-standard` is the app's `--ease`,
`cubic-bezier(0.22, 1, 0.36, 1)`.

`styles/tokens.test.ts` → "animates only through the motion role tokens" fails
if any `transition` or `animation` in `unity.css` does not use a
`var(--motion-*)`.

## The reduced-motion paths

Three, and they compose rather than compete.

| Path | Mechanism | Where |
| --- | --- | --- |
| Device asks for reduced motion | `@media (prefers-reduced-motion: reduce)` sets every animation and transition to 0.001ms | `app.css` (blanket rule), and `tokens.css` zeroes every `--motion-*` role |
| The app's own setting: Less motion (`still`) or Low stimulation (`calm`) | `data-calm` on the root, written by `App.tsx` from `CALMS` in `lib/look.ts` | `app.css` stills every element under `[data-calm='still']` and `[data-calm='calm']`; `tokens.css` zeroes the roles for both |
| Scrolls the app performs in script | `scrollKindly` and `revealKindly` in `app/src/lib/prefers.ts` use `behavior: 'auto'` when `prefersLessMotion()` is true — which is the app setting *or* the media query, and defaults to reduced when the media query cannot be read | Every programmatic scroll goes through these (`a11y/motion.test.ts`) |

Low stimulation also removes shadows, text shadows and decorative gradients,
and (from this work) turns the four glass surfaces opaque.

Guards: `a11y/calm.test.ts` (the setting is three steps, `calm` contains
`still`, the stylesheet half is present), `a11y/motion.test.ts` (scrolls go
through the helpers), `styles/tokens.test.ts` → "stills every motion role for
reduced motion and for the app's own setting".

## Interaction matrix

What each behaviour the brief names looks like in this app, and which
component draws it. "Motion" is what moves when motion is allowed; "Without
motion" is what the student sees when it is not — which must carry the whole
meaning on its own.

| Behaviour | Component | Motion | Without motion | Announced |
| --- | --- | --- | --- | --- |
| Autosave: Saving… → Saved | `SaveState` in `components/unity/Status.tsx` | Colour eases over `--motion-save` | Glyph and word change (`…` Saving… → `✓` Saved) | `role="status"`, polite |
| Offline → Syncing → Synced | `SyncState` / `SaveState` with `syncStatusKey` (`lib/status.ts`); `SyncStrip` under the header (#860) | None | Word and glyph: `⊘ Offline`, `↻ Syncing`, `✓ Synced` | Offline and conflict are `role="alert"`, assertive; the rest polite |
| Open details | `SourceDrawer` in `UnityLayer.tsx` | Sheet rises 8px and fades in over `--motion-sheet` | Appears in place | Dialog with a name; focus moves in and returns to the opener |
| Capture | The `+` box (`QuickAdd`), then `QuickCapture` in `UnityLayer.tsx` from "Or keep it as" | Same sheet | Same | Focus lands on the field with the typed line carried over; after Save, `SaveState` "Saved" and a line saying what it was kept as |
| Upload / long process | `Progress` in `States.tsx` | Bar value transitions over `--motion-progress` | Percentage in words beside a real `<progress>` | Failure is `role="alert"` with Retry |
| AI output: selecting sources → drafting → matching quotations → ready | `StepStatus` in `States.tsx`, in Study Studio | None | Each step has a glyph and a word; current step has `aria-current="step"` | Ordered list |
| Complete task / milestone | `SuccessState` in `States.tsx` | None | Title with `✓`, and "Next:" with the next action | `role="status"` |
| Validation / error | `ErrorState` in `States.tsx`, `Trouble` in `components/Trouble.tsx` | None — no shake | Title with `!`, plain sentence, a required recovery button | `role="alert"` |
| Delete (reversible) | `Undone` in `components/Undone.tsx` | Toast | Stays 8 seconds (`SHOWN_FOR` in `lib/undo.ts`) with an Undo button | `role="status"`, polite, never takes focus |
| Delete (destructive) | `TypeToConfirm` in `components/TypeToConfirm.tsx` | None | Modal that states counts and asks for the name to be typed | Modal with focus trap |
| Permission change | `PermissionNotice` in `States.tsx` | None | What changed, why, and where to control it | `role="status"` |
| Source refresh | `StatusChip` with `updated-today` / `stale` | None | Word and glyph change (`↻ Updated today`, `! Out of date`) | Not live; read on demand |
| Conflict | `statusOf('conflict')` = "Conflict needs review"; the resolution UI is `components/Adopting.tsx` | None | Word, `⇄` glyph | Urgent |

Each of these is now on real screens: `SaveState` in Write, Mine's note editor,
Settings → Assistant and context bars; `Progress` on
Update, Import and the travel pack; `StepStatus` in Study Studio and Update;
`SuccessState` on Registration day, Close term, Export and Snapshots;
`PermissionNotice` on Support access, Family and Share course; `ErrorState`
on eight screens. The full list is in
[EMPTY-LOADING-ERROR-SUCCESS-STATES.md](EMPTY-LOADING-ERROR-SUCCESS-STATES.md).

## Rules

1. **No motion-only state.** Every row above has a "without motion" column
   that carries the full meaning. That is also what the tests check: words,
   glyphs and roles, never animation.
2. **No shimmer, no spinner for an unknown wait.** `LoadingState` draws still
   placeholder bars and says "Loading … " to a screen reader. A known wait gets
   `Progress`.
3. **No fake progress.** `StepStatus` shows the steps a process is actually in;
   it is not a timer.
4. **Undo over confirm for reversible actions; confirm for irreversible ones.**
   `Undone` for the former, `TypeToConfirm` for the latter.
5. **Announce politely unless the student must act now.** Offline, conflict,
   sync trouble and errors are assertive; everything else is polite, so a
   screen reader is not interrupted mid-sentence.
6. **Performance.** The only new animation is the sheet's single keyframe
   (opacity and transform). Nothing animates continuously.
