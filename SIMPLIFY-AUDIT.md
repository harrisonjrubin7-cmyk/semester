# One app — the audit, second pass

Step 1 of `/simplify`, run again. No code in this commit.

Counted against `app/src` at `3a12e03`: **50 destinations** in `lib/nav.ts`, 72
members of the `Screen` union, 75 screen files, 96 components, 8 shelves.

The first pass of this audit ran at `ac5a2c8` against 59 destinations. Every row
in it is resolved and the resolutions are kept at the bottom of this file. Nine
destinations have gone since, across five passes by different hands, and the
first job here was to check what that left behind rather than to re-run the same
greps and re-report the same clusters.

**The headline of this pass is that the remaining duplication is not in the
screens.** It is in one directory drawn twice, one storage report written twice,
and 76 pieces of code with no caller. The screen count should come down by one,
not by nine.

---

## 0. What the last five passes removed

| Pass | Destinations | What went |
| --- | --- | --- |
| Reports at three grains | −2 | `weekly`, `worked` → `brief` |
| A change to a date, two sources | −1 | `check` → `announce` |
| The Ask tab became the conversation | −1 | `chat` → `ask` |
| Files & mail deleted | −1 | `files` |
| Personal → Places folded into the map | 0 | a tab, not a destination |
| Progress → Settings tab | 0 | a tab that rendered the Settings index |
| The second search deleted | 0 | 15 in-screen filters, `screenbox`, `scoped` |

59 → 50. Two of those passes are the precedent this one leans on: a tab that
rendered another screen's content was removed because *pressing the tab and
pressing the button landed on the same list*. That argument is not finished —
see S1.

---

## 1. Screen overlap

Verdict per cluster, with the evidence that decided it.

### S1 — the directory, drawn twice · **MERGE**

`screens/Me.tsx` (the Progress tab) has two tabs: **You** and **Everything**.
The Everything tab renders `Lately`, `NotYetOpened`, and then `GROUPS.map` — a
`Panel` per shelf with a `Destination` row per screen.

`screens/Everything.tsx` has four views. The first, **By area**, renders
`offered(caps)` grouped by shelf. The third, **Not tried**, renders
`untried(rows, state.visited, state.lastOpened)` — which is what `NotYetOpened`
renders.

```
$ grep -n "GROUPS.map" app/src/screens/Me.tsx            # the shelves, in Me
$ grep -n "view === 'area'" app/src/screens/Everything.tsx # the shelves, again
$ grep -n "NotYetOpened" app/src/screens/Me.tsx           # 'not tried', in Me
$ grep -n "view === 'untried'" app/src/screens/Everything.tsx
```

Both read the same registry through the same two helpers (`offered`, `listed`),
gate on the same `school.capabilities`, and draw the same rows. Two of
Everything's four views are the Me tab, and `everything` is not in `HIDE_IN_ME`,
so the directory contains a row that opens the directory.

**The survivor is `me`.** It is in `DEFAULT_TABS`; `everything` is not, and
nothing in the app routes to `everything` except the soft shell's action bar
(`lib/softtop.ts`, twice). What is genuinely only in `everything` is **By task**
(`byTask`, the `taskTags` intention view) and **Shortcuts** (the `?` array,
which is also the `?` sheet and a section of the guide).

So: **By area** and **Not tried** go — Me already draws both. **By task**
becomes a third tab of Me, or Everything survives holding only the two views
that are its own. Either way one destination goes, and the row in the directory
that opens the directory goes with it. This wants a decision, not a default —
it is the one row in this audit where the survivor is arguable, because
Everything's own file comment argues for the split and that argument was written
before Me grew an Everything tab.

### S2 — what the app is storing, written twice · **MERGE**

| | Reads | Renders |
| --- | --- | --- |
| `screens/Data.tsx` (`data`) | `pickPersisted(state)`, `navigator.storage.estimate()` | Every collection, largest first, with bytes · "Room": used of quota, the backend, whether the browser has promised to keep it |
| `screens/settings/Storage.tsx` (`setStorage`) | `localStorage` sizes, IndexedDB | "Your semester", "Drafts in progress", "Attachments", "This browser, in total" · a row to Export |

Both measure the same bytes and answer the same question — *what is this app
taking up, and is it about to run out*. `Storage` is the smaller of the two and
already ends in a link to another screen.

**Survivor: `data`.** Settings → Storage becomes a `NavRow` to it, which is what
Settings does for eight other things. Zero destinations go — `setStorage` is a
settings page, not a destination — but a screen does, and two numbers that do
not agree go with it: both show the browser's own used-of-quota, and beside it
`Data` totals the store a collection at a time while `Storage` totals the store,
the drafts and the attachments as three rows. Neither is wrong and they do not
match, which is what a number kept in two places does. Whichever survives has to
carry the drafts and attachments rows, which exist only on `Storage` today.

### S3 — code with no caller · **CUT**

Not screens: functions. Two counts, from one scan of every `export function`
and `export const` under `app/src`: a name is counted here when no other
production file mentions it and it appears only once in its own file — that is,
nothing but its definition reads it.

- **26 exports nothing reads at all** — not the app, not a test, not their own
  file. `components/Icons.tsx: PlayIcon, PauseIcon`,
  `components/shell/Rows.tsx: SliderRow, DestructiveRow`,
  `components/soft/Soft.tsx: BarButton, Pill`, `lib/activities.ts:
  asAppointments`, `lib/claude.ts: makeCards`, `lib/date.ts: monthName`,
  `lib/intake.ts: intakeFiles, intakeUrl`, `state/store.tsx: useGo`, and 14 more.
- **50 exports whose only reader is their own test.** `lib/connect.ts:
  listMail` and `fetchRemoteText` are the honest example — the Files & mail pass
  said out loud that it was leaving "a tested transport, no longer wired to a
  screen". Also `lib/select.ts: searchItems` (a filter helper from the search
  that was deleted), `lib/settings.ts: rowFor`, `lib/route.ts: linkTo`,
  `lib/records.ts: mergeRows, summaryLine, watermark`, `lib/school.ts: termFor,
  moveOutWhy`, `lib/worth.ts: calibrateFor, guessLine`.

A test is not a reader. A function whose only caller is the test that proves it
works is a function the app does not use, and the test passing is not evidence
that anything needs it. **76 in total**, in 55 files.

Three exclusions, deliberately: an export used inside its own file is not dead
(40 of those, `SettingsIndex` among them — it is rendered by `Settings` two
functions down); the `styles/rules.ts` exports are read by `scripts/styles.mjs`
outside `src`; `data/` course content read only by the guide builder stays.

### S4 — the same UI drawn by hand · **SHARED COMPONENTS**

| Idiom | Shared thing that exists | Hand-drawn instances | Files |
| --- | --- | --- | --- |
| A caps heading (uppercase + letterSpacing, inline) | `SectionLabel`, `.kicker` | **232** | 79 |
| A list row with a hairline under it | `ItemRow` in `components/shell/Rows.tsx` | **33** | 12 |
| "Nothing here yet" | *(none)* | **96** | 71 |
| A chip row that scrolls sideways | `Segmented` | 8 | 6 |

```
$ grep -rn "textTransform: 'uppercase'" --include=*.tsx app/src | wc -l   # 235
$ grep -rn "borderBottom: '1px solid var(--app-line)'" --include=*.tsx app/src | wc -l  # 36
```

Of the 90 caps headings I could tie to an element, 63 are text (`div`, `span`,
`h2`, `li`) and 27 are buttons or links — so roughly two-thirds are `SectionLabel`
written out longhand and one-third are buttons that happen to share the type
treatment. The row count is down from the first audit's 37 in 14 files; the
heading count has never been measured before and is the largest single body of
copy-paste left in the app.

**The empty state is the one worth adding**: 96 hand-written "nothing yet"
blocks in 71 files (`grep -rniE "nothing (here|yet|to)|no .* yet\b"`), each choosing its own size, opacity and margin, is the
reason the same absence reads as three different weights on three screens.

### S5 — three reports, three files of the same shape · **KEEP, recorded**

`lib/brief.ts` (277 lines), `lib/weekly.ts` (267) and `lib/worked.ts` (220) are one
module written three times: `Input` interface → counted struct → `SYSTEM` prompt
constant → report string. The screens merged; the libraries did not. One reader
each, and that reader is one screen at three grains.

Kept, because collapsing them means one prompt for three grains and the prompts
are what make the three reports read differently. Recorded so the next person
does not have to work it out again.

### S6 — one conversation, two shells · **KEEP, owned elsewhere**

`ai/Assistant.tsx` (686 lines, the sheet over any screen) and `ai/Chat.tsx`
(392, the Ask tab) both render `talk.turns` from the one `useAI` store, and both
already share `Composer` and `Turns`. The pieces are shared; the two shells are
not, and they are genuinely two shapes — a sheet that leaves the screen behind
usable, and a screen with the thread list beside it. `/ask-tab` owns this.

### S7 — cleared, with the evidence

| Cluster | Verdict |
| --- | --- |
| `ahead`, `tonight`, `behind`, `runway` | **Keep.** Four questions: is this week survivable · where do tonight's hours buy most · what do I do having already slipped · how many weeks to the exam and what is in the way. Each file argues its own case at the top and each refuses a readiness score. |
| `grades`, `degree` | **Keep.** This term's marks; a four-year ledger. |
| `help`, `everything` | **Keep, but rewrite one blurb.** A generated manual and a directory are different objects. They are not different *in the registry*: "Every screen in the app, what it is for…" and "Every screen in the app, what it does…" are the two blurbs, and they are what search matches on. Whichever survives S1 needs a blurb that does not open with the other's five words. |
| `essay`, `mail`, `proof` | **Keep.** A draft with a voice and a length; an email with a purpose and a mail app; a paste box that reads text back. `Proof`'s panel is already shared under the app's own boxes — one component, several hosts, which is the pattern rather than the problem. |
| `work`, `solve` | **Keep.** Break an assignment into a plan; work a parallel problem and check a step. |
| `data`, `privacy`, `export`, `connect` | **Keep** all four as destinations. What leaves the device, what is held, how to take it, what is plugged in. Only the settings page duplicates one of them — S2. |
| `import`, `update`, `announce`, `edit` | **Keep.** A syllabus in, a reading in, a stated change in, a hand correction. The fifth (`check`) merged last pass. |

---

## 2. Routes per destination

Every `screen: '…'` outside `lib/nav.ts`, counted by file, tests excluded:

| Destination | Files | Reading |
| --- | --- | --- |
| `home` | 7 | `land.ts`, `shape.ts`, `navigate.ts` fallbacks. Not front doors. |
| `edit` | 7 | `Courses`, `Essay`, `Import`, `DropBy`, `OfficeHours`, `guidebook`, `softtop` |
| `import` | 6 | `App`, `keys`, `softtop`, `FirstRun`, `Runway`, `Yes` |
| `courses` | 6 | one tab plus five contextual actions |
| `mine`, `calendar` | 5 | tab plus deep links |
| everything else | ≤4 | |

`edit` and `import` were examined in the first pass and left alone on the
grounds that `App`, `softtop` and the springboard are three *navigations* of
which exactly one is drawn at a time (`NAVS` in `lib/look.ts`). That still
holds; I re-ran it rather than trusting it.

**Three destinations have nothing routing to them at all** — `activities`,
`analyse`, `solve` — reachable by the tab bar, the directory and search only.
That is the shape the brief asks for, and it is worth saying that the app is
mostly already in it: the counts above are `softtop`'s contextual action bar and
the insight cards, both of which answer a question you are already holding.

---

## 3. Duplicated controls

Every `set*` action dispatched from more than one file outside `state/`:

| Action | Files | Verdict |
| --- | --- | --- |
| `setLook` | `Appearance`, `settings/Look`, `settings/Nav`, `nav/Folder`, `lib/tools` | **Fine.** One shared control with two hosts, plus the springboard's own key and the assistant's tool surface. |
| `setMineTab`, `setDueTab`, `setCoursesTab` | `Today`, `Courses`, `Calendar`, `report/Day`, `openhit` | **Deep links.** "Open Mine, on tasks". |
| `setSample` | `SampleMark`, `FirstRun`, `settings/Courses` | **Fine.** One component, three hosts. |
| `setCalView`, `setCalDay` | `Clashes`, `Calendar` | **Fine.** A clash card jumps to its day. |
| `setLinkUrl` | `Courses`, `Links` | **Cleared.** Different namespaces in one map: `Courses` writes `lms:${course.id}`, `Links` writes campus and user link ids. Checked because it looked like the same editor twice. |
| `setDayBudget` | `Clashes`, `lib/tools` | **Fine.** The tool surface is the assistant, not a second screen. |
| `setReport`, `setChanges`, `setQuery` | 2 each | **Deep links.** |

**No genuine second copy of a control.** Same finding as the first pass, from a
scan that now has three fewer screens to disagree about.

---

## 4. What to do, in order

| # | Change | Destinations | Kind |
| --- | --- | --- | --- |
| S1 | The directory drawn twice — `everything`'s By-area and Not-tried views against Me's Everything tab | −1 | Merge, needs a decision on the survivor |
| S2 | Settings → Storage becomes a row that opens `data` | 0 | Merge |
| S3 | 76 exports with no caller — 26 dead outright, 50 read only by their own test | 0 | Cut |
| S4 | An `EmptyState` component (96 hand-written), then `SectionLabel` for the 68 headings written longhand | 0 | Shared components |
| S5 | `brief`/`weekly`/`worked` libraries | 0 | Kept, recorded |
| S6 | The assistant's two shells | 0 | Kept, `/ask-tab` |
| S7 | The `help` / `everything` blurb collision | 0 | Reword with S1 |

**50 → 49 destinations**, and the honest headline is again that this app is
large because it does a lot. The duplication that is left is one directory, one
storage report, and a long tail of code and markup nothing calls.

Each merge must carry, as before: the survivor's `keywords` widened with the
dead screen's, a `state/shape.ts` migration so a saved `screen` that no longer
exists lands on the survivor, and a test for that migration.

---

## Appendix — the first pass, resolved

Run at `ac5a2c8` against 59 destinations. Kept because the verdicts still hold
and this pass re-used them rather than re-deriving them.

| # | Change | Destinations | Done |
| --- | --- | --- | --- |
| M1 | `weekly` + `worked` → `brief`, at three grains | −2 | ✅ `bc8c5b3` |
| M2 | `check` → `announce`, at two sources | −1 | ✅ `28d8422` |
| M3 | The duplicate `edit` and `import` offers | 0 | ◐ one fixed; the rest are three navigations, left deliberately |
| M4 | The `home` blurb, and the merged screens' `keywords` | 0 | ✅ |

Its two corrections to the brief it was given are worth keeping too: the six
"what is due" screens were four questions and not one, and `proof` was never a
screen about where you stand.
