# One app — the audit

Step 1 of `/simplify`, run again. No code in this commit.

Counted against `app/src` at `3a12e03`: **50 destinations** in `lib/nav.ts`, 75
screen files, 89 components, 8 shelves, 4 navigations.

This is the third pass. The first two took the destination count 59 → 56 → 50,
and they took the easy half: two whole clusters of duplicate *screens* (three
reports into one at three grains, two reconciliation screens into one with two
sources) plus the assistant, the second search, the second Settings door and
Files & mail. **There are no duplicate screens left that I can find.** What is
left is two duplicate *controls*, and they are the more dangerous kind, because
a screen you can see twice is an annoyance and a setting you can set twice is a
setting that disagrees with itself.

Saying that plainly matters more than producing a long list. The previous audit
ended with a sentence worth repeating: this app is large because it does a lot,
not because it does the same thing repeatedly.

---

## What I checked, and what it cost to clear

Every cluster the brief names, plus every one the last pass left open. The
verdict column is the point; the evidence is why you can believe it.

| Cluster | Verdict | Evidence |
| --- | --- | --- |
| The six "what is due" screens | **Kept** (settled last pass) | `home`/`ahead`/`tonight`/`mine` answer four different questions; `weekly`+`worked` already merged into `brief` at three grains |
| The assistant's three surfaces | **Done** | `screens/Ask.tsx` is the conversation; only `ai/Assistant.tsx`, `lib/route.ts` and `lib/softtop.ts` dispatch `ask` |
| Five ways to change course data | **Done** | `check` merged into `announce`; `import`/`edit`/`update` are three different inputs |
| Five ways to find a screen | **Kept** | `Everything.tsx`'s own comment argues it: "where is X" and "what would I use this for" are different objects |
| Where you stand | **Kept** | `grades` is this term's marks, `degree` is a four-year ledger |
| The Make cluster (7 screens) | **Kept** | Each carries a distinct fence — see below |
| `quiz` vs Guide's quiz block | **Kept** | Launcher and player, not two homes — see below |
| Header `+` vs springboard FAB | **Kept** | Different jobs, proven in `lib/adding.ts` — see below |
| **The Claude key and model** | **MERGE (D1)** | Two screens, both calling `saveSettings` |
| **The storage measurement** | **MERGE (D2)** | Two screens, same bytes, two different measurements |
| Hand-rolled rows | **Mostly done** | 36 in 13 files, down from 74 in 31; 18 files use shared `Rows` |
| Hand-rolled chip rows | **Open (D3)** | 14 files hand-roll what `ChipRow` already does; 8 use it |

### Three that look like duplicates and are not

Recording these because each cost real reading, and the next person to run this
command should not have to pay for it twice.

**The Make cluster is seven tools, not one tool seven times.** `work`, `solve`,
`analyse`, `essay`, `draw`, `deck` and `proof` all take text and call a model.
They are not interchangeable, and the difference is a *fence* in each one:
`Analyse` computes every number in `lib/stats.ts` and never lets the model
report a figure; `Essay` is gated by `gate()` in `lib/essay.ts` so it cannot
touch coursework; `Solve` works a parallel problem rather than the one being
marked; `Work` refuses to write the assignment at all. Merging any two would
merge their fences, and a fence is the only thing standing between this app and
an Honor Code case. **Kept, emphatically.**

**`quiz` is not a second copy of Guide's quiz.** `Guide.tsx:306` renders a card
describing the quiz with a "Start quiz" button; `startQuiz` in
`state/slices/study.ts:126` pushes `screen: 'quiz'`, which renders `Quiz` out of
`screens/Drill.tsx`. Launcher and player. They read as duplicates from the
registry and are one flow.

**The header `+` and the springboard's floating button both point at
`import`, and they are different buttons.** `lib/adding.ts` makes the header's
`+` mean "add a course" on the courses list and "add something in one line"
everywhere else, and `lib/chrome.ts:100` only draws the FAB on `home` in the
`feed` navigation. So on the one screen where both exist, one adds a deadline
and the other adds a course.

---

## 1. Routes per destination — and a correction to how it was counted

The obvious grep is wrong, and the last pass used it.

```
$ grep -rn "screen: '…'" --include=*.tsx --include=*.ts app/src
```

That misses every route through the reducers, which pass the screen
positionally: `push({ …state, quiz: action.quiz }, 'quiz')`. Twelve
sub-screens are reached only that way — `drill`, `quiz`, `guess`, `lesson`,
`slides`, `exam`, `item`, `course`, `event`, `note`, `guide`, `update` — and
counting without them makes `quiz` look dead when it is not. Both greps
together:

```
$ grep -rn "screen: '[a-zA-Z]*'" --include=*.tsx --include=*.ts app/src | grep -v nav.ts
$ grep -rhno "}, '[a-z][a-zA-Z]*'" --include=*.ts app/src/state/slices/
```

The result, for every destination reached more than three times:

| Destination | Routes | What they actually are |
| --- | --- | --- |
| `home` | 9 | `land.ts` / `shape.ts` fallbacks |
| `edit` | 8 | 2 × `softtop`, then 6 contextual (a course card, an office-hours row, a drop-by card) |
| `mine` | 7 | 2 × `Today`, 2 × `Calendar`, all four onto a *named tab* |
| `import` | 7 | header `+`, springboard FAB, `softtop`, and four contextual |
| `item` | 6 | deep links from insights and notifications |
| `ahead` | 6 | 3 × `softtop`, 2 × the reports, 1 × an insight |
| `tonight` | 5 | 5 × `softtop`, i.e. one contextual action on five screens |

**The honest claim, stated as the brief asks for it:** no destination in
`lib/nav.ts` has two general front doors. Every count above three is one of
three things — `lib/softtop.ts`'s action bar, which is one registry giving each
screen a single contextual "what you came to do next"; a deep link that names a
tab or an id (`setMineTab` then `go: 'mine'` is not "open Mine", it is "open
Mine's appointments"); or a fallback in `land.ts`. A contextual action is not a
pathway to a home. It is the app answering the question you are already
holding, and removing them would not simplify the app, it would make it stupid.

What I cannot claim is the stronger version — "exactly one pathway each" — and
I am not going to write it down when the greps above say otherwise.

---

## 2. Duplicated controls — the two real findings

### D1 — the Claude key and model live on two screens · **MERGE**

The whole point of the rule, and the app has one.

```
$ grep -ln "config.apiKey" app/src/screens/*.tsx app/src/screens/settings/*.tsx
app/src/screens/Connect.tsx
app/src/screens/settings/Assistant.tsx
```

Both render a key field and a model picker. Both call `saveSettings`.
`Connect.tsx` holds it in a private `ClaudeAccount()` component (lines 65–223,
~145 lines) rendered at line 495; `settings/Assistant.tsx` is the whole screen.

`settings/Assistant` is the survivor, and not by preference — it is a strict
superset. It has two providers (Claude *and* OpenAI), the routing between them
(`route()`, `routeLabel`), the monthly spend, and the disclosure about what
leaves the device. Its own file comment already says this is where the choice
belongs: "a choice made once, checked occasionally, and belonging on a page you
go to on purpose."

Connect's copy has exactly one thing Settings lacks: a **check this key works**
button (`checkKey`). That moves rather than dies.

`screens/Links.tsx`'s comment is the tell that this has been half-known for a
while — it describes the links as having lived "at the bottom of Connect, under
the accounts, the calendar feeds **and the Claude settings**." The Claude
settings should have left when the links did.

**Verdict: delete `ClaudeAccount` from Connect; move `checkKey` into
Settings → Assistant; leave a link where the block was.** No destination goes.

### D2 — the storage measurement lives on two screens · **MERGE**

```
$ grep -ln formatBytes app/src/screens/Data.tsx app/src/screens/settings/Storage.tsx
app/src/screens/Data.tsx
app/src/screens/settings/Storage.tsx
```

`Data.tsx` renders "Room" — bytes used of quota, with a bar.
`settings/Storage.tsx` renders "Space used" — your semester, drafts,
attachments, and the browser's total. **The same fact, measured twice by two
different code paths**: `Data` through its own `room` hook, `Storage` by calling
`navigator.storage.estimate()` inline. Two numbers that can disagree, about the
one thing somebody opens these screens to check.

`Data.tsx`'s file comment carefully explains why it is not the *privacy*
screen. It never asks why it is not the *storage settings* page, which is the
screen it actually overlaps.

`data` is the survivor: it is a directory destination with its own shelf,
keywords and search entry, and it is the richer screen (per-collection counts,
the total, the span of dates). It is missing only Storage's breakdown of drafts
and attachments, which moves across.

Settings → Storage keeps what is genuinely a setting-page job — `Snapshots`
(restore from a local copy) and the link to Take it with you — and its "Space
used" group becomes a row pointing at Data.

**Verdict: the measurement has one home (`data`); Settings keeps the actions.**
No destination goes.

### Everything else in `settings.ts`, cleared

Every `set*` action dispatched from more than one file, re-checked:

| Action | Files | Verdict |
| --- | --- | --- |
| `setLook` | `Appearance`, `settings/Look`, `settings/Nav`, `nav/Folder` | **Fine.** `Appearance` is one shared control with two hosts; `Folder` writes a different key |
| `setMineTab` | `Calendar`, `Mine`, `Today` | **Deep link**, not a control |
| `setDueTab`, `setCoursesTab` | `Brief`, `Courses`, `Today` | **Deep link** |
| `setSample` | `SampleMark`, `FirstRun`, `settings/Courses` | **Fine.** One component, three hosts |
| `setCalView`, `setCalDay` | `Clashes`, `Calendar` | **Fine.** A clash card jumps to the day it is about |
| `setMeTab` | `Ahead`, `Me` | **Fine** |

A shared component rendered on two screens is not a duplicated control. A
second implementation of the same control is, and D1 is the only one.

---

## 3. Duplicated UI

| Thing | Hand-rolled | Shared | Where |
| --- | --- | --- | --- |
| List rows | 36 in 13 files | 18 files use `shell/Rows` | `Guide`, `Update`, `Calendar` |
| Chip rows | 14 files | 8 files use `ChipRow` | `Look` (5), `Applying` (4), `People` (3) |
| Section labels | — | 82 files use `SectionLabel` | settled |

The row work is two-thirds done and the remaining 36 are concentrated in three
screens that draw genuinely unusual rows. **D3 is the chip rows**: 14 files
build a row of mutually-exclusive pressed buttons by hand when
`components/ui.tsx` exports `ChipRow` for exactly that.

One number in this section needs care, because the naive grep oversells it:
`aria-pressed` appears 71 times across 45 files, but most are a *single* toggle
button — a star, a filter, a switch — and a single toggle is not a chip row and
must not be converted into one. Only 14 files map a list into chips. That is
the real number and it is the one D3 is scoped to.

---

## 4. The work, in order

| # | Change | Destinations | Status |
| --- | --- | --- | --- |
| D1 | Claude key + model → Settings → Assistant only | 0 | to do |
| D2 | Storage measurement → `data` only | 0 | to do |
| D3 | 14 hand-rolled chip rows → `ChipRow` | 0 | to do |

**No destination is cut by this pass, and that is the finding.** 50 stays 50.
The previous two passes removed the duplicate screens; what was left when I
looked was two settings that could disagree with themselves and a component
used by a third of the files that should use it.

Nothing here touches `lib/context.ts`, `docs/data-contract.md` or
`packages/contract`, and no merge blurs a syllabus-derived date with a
student-written one.
