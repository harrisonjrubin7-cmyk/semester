# Platform unity patterns

The shared components that make Semester read as one environment rather than a
set of tools: each recurring question ("where did this come from?", "who can
see this?", "what now?") gets one answer, drawn the same way everywhere.

All live in `app/src/components/unity/`, style from `app/src/styles/unity.css`
(semantic tokens only), and are tested in
`app/src/components/unity/unity.test.tsx` and `app/src/lib/unity.test.ts`.

## Where each is used

Read from the code. The rollout onto existing screens is covered by
`components/unity/rollout-a.test.tsx`, `rollout-b.test.tsx` and
`rollout-c.test.tsx`, each of which mounts the real screen inside the real
store.

| Pattern | Component | Placed on |
| --- | --- | --- |
| Context Bar | `ContextBar` | The deadline (`ItemDetail` in `screens/Courses.tsx`); the course hub (`components/CourseHub.tsx`, heading 2); the study guide (`screens/Guide.tsx`); Study Studio's draft panel (heading 3); a programme in `screens/Pathway.tsx` (heading 2); the toolkit's open assignment workspace (`components/toolkit/AssignmentPanel.tsx`, heading 3) |
| Object Card | `ObjectCard` | An open opportunity in `screens/Career.tsx`; school records in `screens/University.tsx` (primary disabled while busy) |
| Next | `NextSteps` | The deadline (next deadline in the same course); `components/RegistrationDay.tsx` (Add backups, Open cart); `components/CloseTerm.tsx` (See your record, Import next term's syllabus) |
| Status vocabulary | `StatusChip`, `statusOf` | Today's path snapshot, `screens/Degree.tsx`, `NotOfficial`, every placed context bar and object card, Settings and the soft layout's sync lines |
| Source & details | `SourceDrawer` via `showSource()` or a `source` prop | Every placed `ContextBar` and `ObjectCard`; Today's path snapshot |
| Save and sync | `SaveState`, `SyncState` | `screens/Write.tsx`, the note editor in `screens/Mine.tsx`, `screens/settings/Assistant.tsx`, the Capture sheet, and the context bars that pass `save` |
| Quick Capture | `QuickCapture` via `showCapture()` | The `+` box's "Or keep it as" row (`KeepItAs` in `QuickAdd`) |
| About this screen | `ScreenGuide` | Every screen, via `ShellBody` |
| Offline strip | `OfflineStrip` | Not placed — `SyncStrip` (#860) says offline under the header on every screen |
| Command centre, first goal | `CommandCenter`, `FirstGoal` | Today |
| Focus bar | `FocusBar` | All three layouts, in Focused mode |
| Visibility | `Visibility` | Only inside Quick Capture (locked to "Only me") |
| Open in | `OpenIn` | Supported by `ObjectCard`'s `openIn` prop; no placed card passes it yet |

The standard states (`ErrorState`, `SuccessState`, `Progress`, `StepStatus`,
`PermissionNotice`, `LoadingState`) are listed with their placements in
[EMPTY-LOADING-ERROR-SUCCESS-STATES.md](EMPTY-LOADING-ERROR-SUCCESS-STATES.md).

Not yet reached: Plan, Research, Data, Campus beyond the directory's error,
Community and Advising. See
[DESIGN-SYSTEM-MIGRATION-PLAN.md](DESIGN-SYSTEM-MIGRATION-PLAN.md).

## The overlay bus — `lib/unity.ts`

The Source & details drawer, the Capture sheet and the About this screen
sheet are the same on every screen, so they are mounted once — `UnityLayer` beside `QuickAdd` in each of
the three layouts in `App.tsx` — and opened from anywhere:

```ts
import { showSource, showCapture, showExplain, closeOverlay } from '../lib/unity';

showSource({ title: 'Midterm 2', origin: 'yours', freshness: 'Entered 3 days ago' });
showCapture();                                   // attached to the course you are in, if any
showCapture(course.id);                          // attached to a given course
showCapture(undefined, { as: 'advisor', text }); // a kind chosen and a line carried over
showExplain(screen);                             // About this screen, as a sheet
closeOverlay();
```

It is a small external store read with `useSyncExternalStore`, not part of the
app's persisted state, because it is transient, per-window, and carries
functions (report, open source) that must not be serialised or synced.

`SESSION_MINUTES = 25` also lives here: the length of a study or focus session
started from Capture, the Focus bar or the palette.

## Context Bar

`ContextBar.tsx`. Where you are, in what, on whose authority:

```
PSY 101 · Research Methods                     context (kicker)
Statistical analysis report                    the object
◇ Course-provided · ↻ Updated today · ✓ Saved  source, freshness, save state
[Open workspace]  Secondary  Source & details  one primary, the rest quieter
```

```tsx
<ContextBar
  context="PSY 101 · Research Methods"
  title="Statistical analysis report"
  statuses={['course-provided', 'updated-today']}
  save="saved"
  source={{ title: 'Statistical analysis report', origin: 'course-provided', sourceName: 'PSY 101 syllabus' }}
  primary={{ label: 'Open workspace', run: open }}
/>
```

- A `<section>` named `"{context}: {title}"`.
- `heading={2}` or `heading={3}` draws the title as a real heading, for the
  screens where the bar replaced the section's own header (the course hub,
  Pathway, Study Studio, the toolkit workspace). It never takes 1: the header
  keeps the screen's one `h1` (`a11y/landmarks.test.ts`). Without `heading`
  the title is a plain line.
- `primary` and `secondary` accept `disabled`, for an action that cannot run
  yet — Study Studio holds "Save & open in Write" while a draft is being
  generated. `unity.test.tsx` → "holds an action while it cannot run".
- Inside a surface that is already a card — `.course-banner`,
  `.portal-panel`, `.blueprint` — the bar drops its own background, border and
  padding and takes the host's surface (`styles/unity.css`), so it never draws
  a card inside a card. In the drawn frame (`.blueprint`) its title keeps the
  size the deadline's title had before (`--type-display-lg`).
- Not the page header: the header names the screen, this names the object.
- Never sticky. Sticky chrome is what obscures focus (WCAG 2.4.11), and the
  header already sticks.
- Rows wrap on a phone rather than truncate, so the source link and save state
  are never the thing a narrow screen drops.
- The brief's per-module variants (Today, Path, Plan, Study, Research…) are
  the same component with different props; no variant components were made.

## Object Card

`ObjectCard.tsx`. One rhythm for every kind of thing — see
[INFORMATION-HIERARCHY.md](INFORMATION-HIERARCHY.md#card-rhythm).

```tsx
<ObjectCard
  kind="requirement"
  title="Registration opens tomorrow"
  explanation="You have two items left before you can register."
  metadata="Tue 14 Oct · 9:00"
  statuses={['needs-confirmation']}
  primary={{ label: 'Finish checklist', run: finish }}
  secondary={{ label: 'View details', run: details }}
  source={{ title: 'Registration', origin: 'yours' }}
  openIn={[{ label: 'Plan', screen: 'calendar' }, { label: 'Study', screen: 'study' }]}
  level={2}
/>
```

Actions accept `disabled`, as on the context bar (`unity.test.tsx` → "holds
its primary while the action is already running"). Placed in Career with
"Track it" as primary and Save / Unsave beside it, and in University as a
connected school record whose first action is primary only when writing is
allowed (`rollout-b.test.tsx`).

Kinds: `assignment`, `course`, `requirement`, `source`, `study`,
`opportunity`, `event`, `appointment`, `task`. The kind sets the eyebrow word
only; it unlocks nothing. The brief's longer object list (dataset, code
project, organisation, policy, service, plan item, community session) is not
enumerated; add a kind when a screen needs one.

## Source & details drawer

`SourceDrawer` in `UnityLayer.tsx`, opened with `showSource(detail)`. One
drawer for planning, study, research, AI output and campus data.

`SourceDetail` (`lib/unity.ts`):

| Field | Shown as | Brief item |
| --- | --- | --- |
| `title` | The sheet's `h2` | |
| `origin: StatusKey` | "Origin": chip plus its sentence | Official / student / course / faculty / AI label |
| `sourceName` | "Source" | Source name and source of truth |
| `freshness` | "Freshness", tabular figures | Updated today / current / stale |
| `sourcesUsed[]` | "Sources used" list | AI-assisted, source-linked disclosure |
| `usedIn[]` | "Used in" list | Source use / derived assets |
| `limitations` | "Limitations", whenever given | Limitations and uncertainty |
| `visibility` | "Who can see this", default "Only you" | Privacy |
| `openSource` | Primary button with its own label | Open source action |
| `report` | "Report an issue" | Report issue action |

It is a modal sheet: `role="dialog"`, `aria-modal="true"`, named
"Source & details", focus moved in and trapped by `useModal`
(`a11y/modal.ts`), closed by Escape, the scrim, or Close, and focus returned to
the opener. On a phone it is a bottom sheet inside the device frame; on a
desk or in the browser shell it is a centred window (`is-window`).

Policy status (the brief's "policy/permission status") is not a separate field;
where it applies it goes in `limitations`.

## Next

`NextSteps.tsx`. The section a workflow ends on.

```tsx
<NextSteps steps={[
  { label: 'Compare two course options', why: 'Your window opens Thursday', run: compare },
  { label: 'Prepare advisor questions', run: prep },
]} />
```

At most three are shown (a longer list is a to-do list); nothing at all is
rendered when there is nothing honest to suggest. Each step is a full-width
button at least `--target-primary` (44px) tall. Hidden in Focused mode.

## Quick Capture

One launcher, reached the same way everywhere: the header's `+`, which is on
every screen in every layout and is also opened by `q` and by the search
home's `+` (`lib/onframe.test.ts` → "keeps the capture box reachable now that
no sidebar carries it"). It opens
`QuickAdd`, which reads a dated line ("econ ps4 friday 5pm") and previews
before writing. Under its field is the **"Or keep it as"** row (`KeepItAs` in
`UnityLayer.tsx`): pick what the line is and the Capture sheet opens with that
kind selected and the typed text carried over, so nothing is typed twice. The
palette's "Capture something" opens the same `+` box.

`QuickCapture` in `UnityLayer.tsx` is the sheet those choices open.

| Kind | Label | Where it lands |
| --- | --- | --- |
| `task` | Action, no date | `addTask` — the task list, attached to the course if one is chosen |
| `note` | Course note | `keepNote`, body "Captured as: Course note" |
| `source` | Source | `keepNote`, "Captured as: Source" |
| `session` | Study session | `addTimer`, "Study: …", 25 minutes |
| `advisor` | Question for advisor | `keepNote`, "Captured as: Question for advisor" |
| `idea` | Idea | `keepNote`, "Captured as: Idea" |

"Action, no date" says what the kind is for: a dated item belongs to the `+`
box itself.

- Attaches to the course you are standing in — read through
  `courseFieldFor(state.screen)` in `lib/parent.ts`, so on Today (where
  `state.courseId` is only the last course opened) it attaches to none — or to
  the one passed in. It says so in an "Attached to" select and lets the student
  change it or choose "No course". A study session has no course to keep (the
  timer takes a label and a length), so the select is not offered for it.
- States visibility with `<Visibility value="only-me" locked />`: everything
  captured is private to the student.
- Save is disabled for an empty line. After Save, focus returns to the field,
  "Saved" is announced, and a line says what it was kept as.
- "Has a due date?" hands the line back to `QuickAdd`; Capture does not grow a
  second date parser.
- The brief's research item, data project and assignment workspace kinds are
  not separate: they are notes until those workspaces have a store to receive
  them.

Tests: `unity.test.tsx` → "quick capture" (keeps a task, keeps an advisor
question as a labelled private note, is reached from the `+` box carrying over
what was typed, will not save an empty line).

## Status vocabulary

`app/src/lib/status.ts`. Every state the app reports about a thing is named
once, with the sentence behind the word. A screen says one of these through
`statusOf(key)`, never in its own words.

| Key | Label | Short | Glyph | Tone | Urgent |
| --- | --- | --- | --- | --- | --- |
| `official` | Official | Official | ◆ | success | no |
| `connected` | Connected | Connected | ○ | neutral | no |
| `made` | Made here | Made here | ○ | neutral | no |
| `yours` | Yours | Yours | ○ | neutral | no |
| `sample` | Sample | Sample | ◌ | neutral | no |
| `stale` | Out of date | Out of date | ! | attention | no |
| `faculty-approved` | Faculty-approved | Faculty-approved | ◆ | success | no |
| `course-provided` | Course-provided | Course-provided | ◇ | info | no |
| `ai-assisted` | AI-assisted, source-linked | AI-assisted | ✦ | info | no |
| `updated-today` | Updated today | Today | ↻ | neutral | no |
| `needs-confirmation` | Needs confirmation | Confirm | ? | attention | no |
| `action-required` | Action required | Action | ! | attention | no |
| `saving` | Saving… | Saving | … | neutral | no |
| `saved` | Saved | Saved | ✓ | success | no |
| `syncing` | Syncing | Syncing | ↻ | neutral | no |
| `synced` | Synced | Synced | ✓ | success | no |
| `offline` | Offline | Offline | ⊘ | attention | yes |
| `queued` | Queued | Queued | ⋯ | neutral | no |
| `conflict` | Conflict needs review | Conflict | ⇄ | danger | yes |
| `sync-error` | Sync trouble | Trouble | ! | danger | yes |
| `signed-out` | Not signed in | None | ○ | neutral | no |
| `device-only` | On this device only | Local | ○ | neutral | no |

The first six are read from `lib/where.ts` (`saysWhere`, `aboutWhere`), so this
table cannot drift from the provenance ladder. `lib/unity.test.ts` holds that,
and that every label is unique, and that every entry has a label, a sentence
over ten characters, and a glyph.

`syncStatusKey(sync, isOffline)` is the one mapping from the store's sync state
(all nine of `SyncStatus`, including `offline`, `queued`, `conflict` and
`review` from #777) to a key; being offline outranks the last sync result,
except when there is nothing to sync or changes are already queued. Both
conflict kinds map to `conflict`.

The store's own states are named by a second table, `SYNC_WORDS` in
`lib/syncstatus.ts` (#777), which Settings, the soft layout's card and
Account read. The two were not merged; `lib/unity.test.ts` holds them to the
same label and short form wherever both name a state, so "Sync trouble" and
"Trouble" cannot drift apart again.

Tone maps to a token through `toneVar(tone)`: attention and danger to
`--status-attention` / `--status-danger` (both the warn ink), success and info
to the accent, neutral to `--status-neutral`.

### Drawing a status

```tsx
<StatusChip status="needs-confirmation" />         // ? Needs confirmation
<StatusChip status="ai-assisted" short />          // ✦ AI-assisted
<SaveState status="saving" />                      // live region, polite
<SyncState />                                      // the account's state, live
```

`StatusChip` is a pill with the glyph (`aria-hidden`), the word, and the
sentence as `title`. `SaveState` is a quiet line with `role="status"` (polite)
or `role="alert"` (assertive) when the state is urgent.

## Visibility

`Visibility.tsx`. "Who can see this?", with the same four answers in every
module:

| Audience | Label | Sentence |
| --- | --- | --- |
| `only-me` | Only me | Nobody else can see it. |
| `course` | Course | People enrolled in the course it is attached to. |
| `collaborators` | Selected collaborators | Only the people you add by name. |
| `portfolio` | Public portfolio | Anyone with the link to your portfolio. |

And a data-source line: "Entered by you", "Provided by your institution" or
"From a system you connected", with "Learn more" going to Privacy.

```tsx
<Visibility value={who} onChange={setWho} allowed={['only-me', 'course']} origin="student-entered" />
<Visibility value="only-me" locked />
```

`allowed` defaults to `['only-me']`: a module offers only the audiences it can
actually honour. The component is presentation only; choosing an audience
never grants access by itself.

## About this screen

`ScreenGuide.tsx` and `lib/explain.ts`. See
[ONBOARDING-AND-CONTEXTUAL-HELP.md](ONBOARDING-AND-CONTEXTUAL-HELP.md).

## Open in

`OpenIn.tsx`. The way from one thing to every place it matters:

```tsx
<OpenIn about="ECON 1020" targets={[
  { label: 'Study', screen: 'guide', courseId: course.id },
  { label: 'Calendar', screen: 'calendar' },
]} />
```

Each target is an ordinary navigation, so it follows the app's one history
rule: opening a screen inside a section pushes an entry and Back returns to
where Open in was pressed (the brief's "return route"). A `courseId` opens the
destination on that course (`openCourse` for `course`, `openGuide` for
`guide`). Opening one of the tab bar's own roots is a tab switch and resets the
stack, as pressing the tab does. `components/unity/unity.test.tsx` → "opens in
another place with a real navigation, so Back comes home" asserts the history
entry.

Buttons with words, in a named group ("Open ECON 1020 in"), wrapping on a
phone.

## Quick actions and ⌘K

`QuickActions.tsx`, on the Search page when the query is empty. Three actions,
chosen because each changes nothing the student cannot see and undo at once:

- Capture something (opens the `+` box, whose "Or keep it as" row leads to
  the Capture sheet; both preview and ask for Save)
- Start a 25-minute focus session (a timer, which can be stopped)
- Turn on / Leave Focus mode (presentation)

`components/Command.tsx` deliberately refuses a verb palette — "a list that
mixes 'go to the calendar' with 'delete this course' is a list where one wrong
Enter is unrecoverable" — so nothing here deletes, submits or shares.

⌘K / Ctrl+K opens the same Search page as `/`. It is the single documented
exception to the "modified keys belong to the browser" rule in `lib/keys.ts`,
and it does nothing while typing or under a modal. `PALETTE` is shown on the
keyboard help sheet (`components/Keys.tsx`) as "Search and quick actions". On a
phone the Search page is the palette and the same chips appear there.

## Command centre and first goal

See [ONBOARDING-AND-CONTEXTUAL-HELP.md](ONBOARDING-AND-CONTEXTUAL-HELP.md) for
`FirstGoal`, and [WORKSPACE-MODES.md](WORKSPACE-MODES.md) for the Focus bar.
`CommandCenter` pins three to five widgets (`lib/widgets.ts`: This week's plan,
Current assignment, Degree requirement progress, Study progress, Upcoming
opportunity) to Today, stored as the `pinned` look key. Reordered with Move up
and Move down behind "Arrange", never by dragging alone. The same list and the
same data on every device.
