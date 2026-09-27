# Empty, loading, error and success states

Every state says what is happening in words, offers the next useful action,
and never carries its meaning in motion or colour alone. Some of these
components existed before this work; the rest were added beside them in
`app/src/components/unity/States.tsx`.

## The components

| State | Component | File | Existed? | Placed on screens? |
| --- | --- | --- | --- | --- |
| Empty | `EmptyState` | `components/ui.tsx` | Yes | Widely |
| Screen talking back (notice or local failure) | `Notice` | `components/ui.tsx` | Yes | Seven device-library workspaces |
| Failed action with retry | `Trouble` (+ `useTrouble` in `lib/trouble.ts`) | `components/Trouble.tsx` | Yes | AI chat and panel, mail compose, source finding, sharing, Exam and others |
| A screen that crashed or went stale | `ScreenTrouble` | `components/Boundary.tsx` | Yes | Wraps screens in `App.tsx` |
| Reversible delete | `Undone` | `components/Undone.tsx` | Yes | Mounted once, app-wide |
| Irreversible action | `TypeToConfirm` | `components/TypeToConfirm.tsx` | Yes | Me, Privacy, Downloads, Adopting |
| Not official | `NotOfficial` | `components/NotOfficial.tsx` | Yes; now leads with the shared "Needs confirmation" chip | Athletics eligibility and NIL (`CaraLog`, `EligibilityCheck`, `Nil`) |
| Loading | `LoadingState` | `unity/States.tsx` | New | The lazy-screen fallback in `App.tsx` |
| Error with recovery | `ErrorState` | `unity/States.tsx` | New | Registration day, graduation simulator, registration portal, campus directory, toolkit (recovery-copy errors); Account sync failure; support access load failure; Import retryable failures |
| Success / milestone | `SuccessState` | `unity/States.tsx` | New | Registration day complete; Close term; Export restore; Snapshots restore |
| Determinate progress | `Progress` | `unity/States.tsx` | New | Update and Import (reading several files); Travel pack download |
| Named steps (AI generation) | `StepStatus` | `unity/States.tsx` | New | Study Studio generation; Update reading one file |
| Permission changed | `PermissionNotice` | `unity/States.tsx` | New | Support access created and revoked; Family permission plan and item saved; Share course after sending |
| Offline | `OfflineStrip` | `unity/States.tsx` | New | Not placed: #860's `SyncStrip` under the header says offline on every screen |
| Save / sync | `SaveState`, `SyncState` | `unity/Status.tsx` | New | `SaveState` in Write, Mine's note editor, Settings → Assistant, the Capture sheet, and context bars that pass `save` |

## When to use which

### Empty — `EmptyState`

Something that would be here is not yet. Say what would fill it and offer it:
`action` is the point of the component. `inline` for a section inside a screen;
the full form for a screen that is entirely empty. The brief's "what this is,
why empty, how to start, what happens next" is the title, the body and the
action.

### Loading — `LoadingState`

```tsx
<LoadingState what="your courses" />
```

Still placeholder bars (`aria-hidden`) that hold the layout so nothing jumps,
plus "Loading your courses…" in a polite `role="status"` for a screen reader,
with `aria-busy` on the region. It replaced the screen fallback that drew four
bars and said nothing. No spinner, no shimmer. Use it for an indeterminate
wait; use `Progress` when the wait has a size.

### Error — `ErrorState`, `Trouble`, `Notice alert`

```tsx
<ErrorState
  title="Could not import"
  body="The file is not a syllabus."
  recover={{ label: 'Choose another file', run: pick }}
  secondary={{ label: 'Add the course by hand', run: byHand }}
  reference="IMP-42"
/>
```

- `ErrorState` for a failure that owns a region: `role="alert"`, a `!` glyph,
  a plain sentence, and a **required** recovery action — an error with no way
  out is a dead end. `reference` is what to quote to support.
- `Trouble` for a failed attempt that is worth one more go (a dropped
  connection, a rate limit): it shows the failing system's own words and a
  retry button, and never retries by itself.
- `Notice alert` for a device-library read or save failure, with the recovery
  download inside it.
Where it is used: the recovery-copy error — a device library that could not
save, with the download as its recovery — on `RegistrationDay`,
`GraduationSimulator`, `RegistrationPortal`, `CampusDirectory` and the
toolkit; Account's sync failure ("Sync did not finish", recovery "Check now",
with the failure's reference in the reference slot); Support access's failed
load ("Try again"); and Import's retryable failures, titled by what failed
(`FAILED_TITLE`), with "Try building it again" for a failed build. Import keeps
`Trouble` for a failure there is nothing to retry (`rollout-c.test.tsx`).

`.state-body` is `white-space: pre-line`, so an error whose body has several
paragraphs keeps its line breaks.

- `ScreenTrouble` catches a render failure and a stale deploy, says the work is
  safe, and offers a way out.

Errors are never shake-only or colour-only: the attention tone reinforces a
glyph and a sentence.

### Success — `SuccessState`

```tsx
<SuccessState
  title="Registration checklist complete"
  next={{ label: 'Compare two course options', run: compare }}
/>
```

Acknowledge, then point at what is next. `role="status"`, a `✓` glyph, and
"Next: …". No streaks, ranks or comparison; the test asserts none of
"streak", "#1" or "beat" appears.

Where it is used: "Your registration checklist is complete" on Registration
day, which is followed by a Next section offering only steps the screen does
not already show; "{term} is closed" on Close term, keeping the archived line,
with Next offering "See your record" and "Import next term's syllabus";
"Restored" after restoring a backup on Export and after going back a day in
Snapshots.

### Progress — `Progress`

```tsx
<Progress label="Uploading syllabus" done={3} total={4} onCancel={cancel}
          note="Stays on this device." />
```

A real `<progress>` named by `label`, the percentage in words, Cancel while
running, and on `failed` the reason in a `role="alert"` with Retry. `note`
carries the data or permission note the brief asks for on an upload.

### Named steps — `StepStatus`

```tsx
<StepStatus label="Drafting your study guide" steps={[
  { label: 'Gathering sources', state: 'done' },
  { label: 'Drafting', state: 'working' },
  { label: 'Ready', state: 'waiting' },
]} />
```

For AI generation above all: show the work actually being done instead of a
fake instant answer. An ordered list; each step has a glyph and a hidden word
(waiting, in progress, done, failed); the current step has
`aria-current="step"`.

Where it is used: Study Studio's generation ("Making your study guide":
Selecting sources → Drafting → Matching quotations → Ready, showing which step
failed), and Update reading one file ("Reading this file": Working out what it
is → Reading what is in it → Comparing with the course).

### Permission change — `PermissionNotice`

What changed, why, and a link to where it is controlled. `role="status"`.

Where it is used: Support access when a window is created (with the way to
revoke it) and when it is revoked (with no control, since there is nowhere to
go); Family when a permission plan or an item is saved (what changed, why it
is safe, and the preview); Share course after sending (what the file
carries).

### Offline — `OfflineStrip`

"You are offline. You can keep working; changes sync when you are back." — or,
with `queued`, how many changes will sync. Where there is no account copy
(sync off in the build, or signed out) it says "everything is kept on this
device" instead and promises no sync (`syncs`; held by
`components/unity/honesty.test.tsx`). `role="status"`.

**Not placed.** It was drawn by `ShellBody` until #860 added `SyncStrip`
under the header in every layout, which says offline, queued changes, a
conflict or a failed sync and links to Account. Two offline lines on one
screen would be one too many, so the shared strip stepped aside.

### Save and sync — `SaveState`, `SyncState`

A quiet line near the work rather than a toast. `SaveState` announces politely,
except `offline`, `conflict` and `sync-error`, which are assertive because they
change what the student should do next. `SyncState` reads the account's sync
state and connection through `syncStatusKey`, so it says the same words as
Settings.

Where it is used: `SaveState` beside Write's save sentence, under the title in Mine's note
editor, in Settings → Assistant only once something has been saved, in the
Capture sheet after Save, and in every context bar given a `save` state.
`SyncState` is not placed: Account's sync line is #777's live region, worded
from `SYNC_WORDS`, with the announced `ErrorState` beneath it on failure.

### Reversible and irreversible actions — `Undone`, `TypeToConfirm`

Prefer undo: `Undone` is a polite toast with Undo for eight seconds that never
takes focus. For something that cannot be undone, `TypeToConfirm` states what
will be lost and asks for the name to be typed.

### Conflict

"Conflict needs review" is in the vocabulary (`conflict`, `⇄`, urgent). The
only conflict-resolution interface is `components/Adopting.tsx` — which copy of
a term to keep when signing in — and it writes a backup before either
overwrite. There is no per-item conflict UI.

### Policy-restricted and source-stale

The brief's policy-restricted state (what is blocked, why, the approved
alternative) has no dedicated component; `PermissionNotice` or `ErrorState` with
a recovery action to the approved route covers it. Source-stale is the `stale`
status ("Out of date") with its sentence and, in the Source & details drawer,
the freshness row.

## Tests

`components/unity/rollout-a.test.tsx`, `rollout-b.test.tsx` and
`rollout-c.test.tsx` mount each placement above on its real screen and check
it the way a reader would — see
[DESIGN-REGRESSION-TEST-PLAN.md](DESIGN-REGRESSION-TEST-PLAN.md).

`components/unity/unity.test.tsx` → "the standard states": loading is busy and
says so; error is an alert and always offers a way out; success points at
what is next without a streak; progress is a real progress bar with Cancel and
Retry by name; steps say their state in words and mark the current one.
`a11y/tellings.test.ts` holds that messages saying something went wrong are
announced, and counts `<ErrorState` as announced because the component is
`role="alert"` itself.
