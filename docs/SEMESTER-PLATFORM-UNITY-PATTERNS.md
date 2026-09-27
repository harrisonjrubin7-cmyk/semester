# Platform unity patterns

The shared components that make Semester read as one environment rather than a
set of tools: each recurring question ("where did this come from?", "who can
see this?", "what now?") gets one answer, drawn the same way everywhere.

All live in `app/src/components/unity/`, style from `app/src/styles/unity.css`
(semantic tokens only), and are tested in
`app/src/components/unity/unity.test.tsx` and `app/src/lib/unity.test.ts`.

## Where each is used today

Honest status: the components are built and tested; adoption across screens
has started, not finished.

| Pattern | Component | Placed on a screen? |
| --- | --- | --- |
| Status vocabulary | `lib/status.ts`, `StatusChip` | Yes — Today's path snapshot, `NotOfficial`, Settings sync line, soft layout sync card, Study Studio's AI label |
| Source & details drawer | `SourceDrawer` via `showSource()` | Yes — Today's path snapshot, Study Studio's AI study guide |
| Quick Capture | `QuickCapture` via `showCapture()` | Yes — from the Search page's quick actions (and so ⌘K / Ctrl+K) |
| About this screen | `ScreenGuide` | Yes — every non-full-bleed screen, via `ShellBody` |
| Offline strip | `OfflineStrip` | Yes — every screen, via `ShellBody`, while offline |
| Command centre, first goal | `CommandCenter`, `FirstGoal` | Yes — Today |
| Focus bar | `FocusBar` | Yes — all three layouts, in Focused mode |
| Context Bar | `ContextBar` | **Not yet** — built and tested only |
| Object Card | `ObjectCard` | **Not yet** |
| Next | `NextSteps` | **Not yet** |
| Visibility | `Visibility` | Only inside Quick Capture (locked to "Only me") |
| Open in | `OpenIn` | Only inside `ObjectCard` |

Rolling the unplaced ones out to Path, Plan, Research, Data, Career, Campus,
Community and Advising is the main follow-up; see
[DESIGN-SYSTEM-MIGRATION-PLAN.md](DESIGN-SYSTEM-MIGRATION-PLAN.md).

## The overlay bus — `lib/unity.ts`

The Source & details drawer and the Capture sheet are the same on every
screen, so they are mounted once — `UnityLayer` beside `QuickAdd` in each of
the three layouts in `App.tsx` — and opened from anywhere:

```ts
import { showSource, showCapture, closeOverlay } from '../lib/unity';

showSource({ title: 'Midterm 2', origin: 'yours', freshness: 'Entered 3 days ago' });
showCapture();          // attached to the course in view, if any
showCapture(course.id);  // attached to a given course
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

`QuickCapture` in `UnityLayer.tsx`, opened with `showCapture(context?)`.

| Kind | Where it lands |
| --- | --- |
| Task | `addTask` — the task list, attached to the course if one is chosen |
| Course note | `keepNote`, body "Captured as: Course note" |
| Source | `keepNote`, "Captured as: Source" |
| Study session | `addTimer`, "Study: …", 25 minutes |
| Question for advisor | `keepNote`, "Captured as: Question for advisor" |
| Idea | `keepNote`, "Captured as: Idea" |

- Attaches to the course in view (or the one passed in), says so in an
  "Attached to" select, and lets the student change it or choose "No course".
- States visibility with `<Visibility value="only-me" locked />`: everything
  captured is private to the student.
- Save is disabled for an empty line. After Save, focus returns to the field,
  "Saved" is announced, and a line says what it was kept as.
- "Has a due date?" hands the line to `QuickAdd`, which already parses dates
  and courses and previews before writing; Capture does not grow a second
  date parser.
- The brief's research item, data project, assignment workspace and calendar
  block kinds are not separate: calendar blocks and dated items go through
  `QuickAdd`; the others are notes until those workspaces have a store to
  receive them.

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
(`off`, `signed-out`, `syncing`, `synced`, `error`) to a key; being offline
outranks the last sync result, except when there is nothing to sync.
Settings (`screens/settings/Index.tsx`) and the soft layout's card
(`components/soft/SoftTopBody.tsx`) both read their words from it, which ended
"Sync trouble" beside "Trouble" and "Not signed in" beside "None" as two
unrelated strings. `lib/unity.test.ts` checks both files use it.

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

- Capture something (opens the Capture sheet, which previews and asks for Save)
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
