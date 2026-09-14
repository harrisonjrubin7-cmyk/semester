# One app — the audit, seventh pass

Step 1 of `/simplify`, run again. No code in this commit.

Counted against `app/src` at `71f8c10`: **60 destinations** in `lib/nav.ts`, 74
members of the `Screen` union, 100 screen files, 134 components. Baseline before
any change: `npm run lint` exit 0, `npm test` 314 files / 6691 tests passing.

**The screen count is not the problem this time, and no screen is merged or
cut.** The six passes before this one all counted the same three things —
screens that answer one question twice, destinations reachable more than one
way, and settings written from two places. By the sixth the first two were
clean; the third was reported clean and was not, which §3.1 corrects — though
all three of the settings it missed turn out to be keeps. The fault that is
actually left is on an axis none of the six looked at.

## The axis: two controls, one job, on screen at the same time

A route census counts pathways *over time*: you can get to Settings from here,
and also from there. It says nothing about two buttons that do the identical
thing while both are visible in one frame. That is a different and worse fault,
because a route you have to remember costs you nothing when you are not using
it, and a second button sitting four inches from the first costs you a decision
every time you look at the screen.

This pass was opened by a screenshot of **Alerts in the workspace navigation**:
a header carrying `+` and a magnifier, with the workspace's own search field
drawn directly above it and the workspace's own New button drawn directly
beside it. Three of those four controls do two jobs between them.

The census below is of *chrome* only — the bars, rails, sidebars and headers
that are drawn beside every screen. A button inside a screen's own body is that
screen's business and is out of scope here.

---

## 1. The control census

### What is on screen at once, per navigation

`lib/chrome.ts` guarantees no two *navigations* are drawn together. It says
nothing about the header, which it explicitly excludes ("the header belongs to
the screen you are on"), nor about the workspace's bar and sidebar, which it
counts as one navigation expressed at two widths. So the workspace draws three
pieces of chrome at once — `TopBar`, `Sidebar`, and the slim `Header` inside the
pane — and nothing has ever compared their contents.

Read out of `App.tsx:1218-1256`, `components/desk/TopBar.tsx:258-296`,
`components/desk/Sidebar.tsx:75-99` and `App.tsx:696-828`:

| Job | `TopBar` | `Sidebar` (wide) | slim `Header` | On screen at once |
| --- | --- | --- | --- | --- |
| Open the capture box (`quickAdd`) | — | **New** (`Plus`) | **`+`** | **2** (wide) |
| Open the palette (`finder`) | **the search field** | — | **magnifier** | **2** (every width) |
| Go to `search` | **the wordmark** | **Search home** row | — | **2** (wide) |
| Go to `settings` | **gear** | **Settings** row | — | **2** (wide) |
| Go to `ask` | **AI Tutor** | — | — | 2 with `Assistant`'s corner button |
| Open the launcher (`apps`) | nine dots | — | — | 1 |
| Go to `notifs` | bell | — | — | 1 |
| Go to `profile` | avatar | — | — | 1 |
| Go to `connect` | — | Connect row | — | 1 |

The last four rows are the point. `Header`'s `slim` prop already exists to stop
exactly this: it drops the launcher, the bell and the avatar because `TopBar`
carries all three.

```
$ grep -n "slim" app/src/App.tsx
526:  slim = false,
764:          {!slim && (          # the launcher
776:          {atRoot && !slim && (# the bell
819:          {!slim && showsAvatar# the avatar
1230:            {!ownTitle && <Header slim />}
```

**`slim` suppressed three of the five duplicates and missed two.** It was
written against the three controls `TopBar` has in its `.desktop-tools` cluster
and never checked against `TopBar`'s search field or `Sidebar`'s New button.
That is the whole of W1 and W2 below — not a design decision anybody made, an
unfinished list.

### W1 — the palette, twice · **CUT the header's magnifier in the workspace**

`TopBar` draws a permanent search field at every width — `.desktop-search` has
no `display: none` at any breakpoint (`styles/app.css:4750`) — and its own file
opens by saying that being permanent is the entire point:

> A search field that is *always there* is the whole of what this adds. […] it
> was behind a magnifier in a row of four icons, which is the difference between
> a thing people use fifty times a day and a thing people use when they remember
> it exists. — `components/desk/TopBar.tsx:3-9`

The magnifier that sentence is about is still there, one row below the field,
opening the same `finder`. The bar's argument for existing is the argument for
removing it.

### W2 — the capture box, twice · **CUT the header's `+` where the sidebar is drawn**

`Sidebar`'s New button and the header's `+` both dispatch
`{ type: 'quickAdd', open: true }`, four inches apart, and `Sidebar` says so:

> **New** is the capture box, not a menu. […] at the top of the column in the
> position every workspace puts its primary action, it is the first thing the
> eye lands on. — `components/desk/Sidebar.tsx:10-14`

It is the first thing the eye lands on and then the eye lands on a second one.

**Not an unconditional cut.** `sidebar: desk && wide` (`lib/chrome.ts`), so a
narrow workspace has no New button, and `TopBar` has no `+`. There the header's
`+` is the only pointing route to the capture box. It stays there.

### W3 — the search home, twice · **CUT the sidebar's Search home row**

`TopBar`'s wordmark and `Sidebar`'s second row both `go` to `search`:

```
$ grep -rn "screen: 'search'" app/src --include=*.tsx | grep -v test
components/desk/TopBar.tsx:117:  onClick={() => dispatch({ type: 'go', screen: 'search' })}   # the wordmark
App.tsx:1218:  <TabStrip alwaysOn onBlank={() => dispatch(…'search')} />                  # blank tab
App.tsx:1246:  <ScreenTrouble … onLeave={() => dispatch(…'search')} />                    # crash exit
$ grep -n "row('search'" app/src/components/desk/Sidebar.tsx
85:      {row('search', 'Search home', SearchIcon)}
```

The wordmark survives: it is drawn at every width in this navigation (only
`.desktop-word` is hidden under 760px — the `S` mark stays,
`styles/app.css:4740`), and a wordmark that returns you to the front door is the
one navigation convention every browser and every workspace app already taught.
The row is wide-only and second.

### W4 — Settings, twice · **CUT the sidebar's Settings row**

Same shape, same survivor, for the stronger reason. `TopBar`'s gear is one of
the four `.desktop-tools`; `Sidebar`'s last row goes to the same screen.
`Sidebar`'s own charter is against itself here:

> a sidebar earns its width by holding the handful of places somebody returns to
> *between everything else* — `components/desk/Sidebar.tsx:5-8`

Settings is not a place you return to between everything else. Nothing is lost
at either width: the gear is drawn wide, and narrow — where the sidebar does not
exist at all — settings is in the launcher and in the bar's own app search,
which is what `styles/app.css:4859` already says out loud.

### W5 — the assistant · **CUT one button; the two surfaces are a KEEP**

Recorded as "do not fix here" on the first writing, because `/simplify` says
`/ask-tab` owns the assistant. Re-opened on request, and it splits cleanly in
two — which is why the deferral was half right.

**The two surfaces are not the duplicate.** `ai/Assistant.tsx`'s panel and the
Ask tab are one conversation behind two doors, deliberately: the panel carries
the screen you are standing on, the tab is the room where every thread lives,
and both draw the *same* components — `Turns.tsx`, `Opening.tsx`,
`Composer.tsx`, `Actions.tsx` — precisely so one conversation cannot start
reading as two products. They are named apart too: the floating button says
"Ask about <screen>", the tab's controls say "AI Tutor", so the W6 fault is not
present either. The screen-level duplicate this cluster used to have is already
gone — `chat` was merged into `ask` in an earlier pass, and `lib/route.ts:135`
keeps the old address pointing at the survivor. **Keep,** and `/ask-tab` still
owns any rebuild.

**One button was a plain duplicate.** `TopBar` draws an AI Tutor button on
every screen in the workspace; `screens/Search.tsx` drew a second one, same
words and same glyph and the same `go ask`, one row below the first — on the
screen the workspace opens on. Measured in a browser at 1280px, before:

```
aiTutor: ["AI Tutor", "AI Tutor"]      # two, one frame
```

The bar's survives, by the rule every survivor in this pass has used: it is
drawn on every screen in this navigation and the search home is drawn on
exactly one. **Cut.**

### W7 — the search home's centre repeats the bar · **FIX — the centre box focuses the bar**

Found while cutting W5's button, and it is the same fault one size larger. On
the `search` screen the bar's row and the screen's centre are drawn one above
the other, and at rest both are visible:

```
searchFields: ["topbar", "searchhome"]   # two
cmdK: 2                                  # two ⌘K hints
```

The AI Tutor pair was one of four things duplicated between them, and it is the
only one this pass removed. What is left is two search boxes and two ⌘K hints —
and they are *not* simply copies, which is what makes this a design question
rather than a deletion:

| | The bar's | The centre's |
| --- | --- | --- |
| Says | "Search apps and features" | "Search your semester" |
| Is | a real input, answering with screens inline | a button that opens the palette |
| Answers with | apps | records — courses, deadlines, readings, notes |
| ⌘K | opens the palette, *not* this field | opens the palette, which is what it is |

Two fields, two vocabularies, two result sets, one above the other — and only
one of the two ⌘K hints is telling the truth about the field it sits in. The
browser idiom this is borrowed from, a new-tab page with a big centre box under
the omnibox, resolves it by making the centre box *focus the omnibox* rather
than open a second search.

Three ways out, and they are genuinely different products: focus the bar from
the centre box, drop the centre and let the wordmark and the shortcuts be the
screen, or keep both and make the ⌘K hint honest. Recorded rather than picked,
because redesigning the screen the app opens on is past "remove the
redundancy". **The first was chosen.**

#### The ⌘K hints were both false, which settles the third option

Checked before touching either, and it is worse than "one of the two is
honest", which is what the row above assumed:

```
$ grep -rn "metaKey" app/src/lib/keys.ts app/src/ai/Assistant.tsx
lib/keys.ts:131      if (e.metaKey || e.ctrlKey || e.altKey) return null;
ai/Assistant.tsx:326 if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { … ai.show() }
```

`lib/keys.ts` ignores anything carrying a modifier **on principle** — the rule
that keeps this app out of the browser's shortcuts, argued at the top of that
file — so no binding in the app's shortcut table can be ⌘-anything. The only
⌘K listener in the codebase is the assistant's, and it opens the assistant.

So both chips sat inside a *search field* advertising a key that opens a chat,
and two file headers asserted the same thing in prose: `TopBar.tsx`'s "every
route into it still works: ⌘K, `/`…" and `Search.tsx`'s "⌘K still opens the
palette". Four wrong statements about one key.

Both chips are **removed rather than corrected**, because there is no key to
correct them to: nothing focuses the bar's field from the keyboard today, and
adding a binding is a feature rather than the removal of a false claim. Both
prose notes are fixed where they stand. Giving the bar a real focus shortcut is
a reasonable follow-up and is deliberately not done here.

#### How the centre box focuses the bar

The gap is the one `components/desk/suggesting.ts` already names: the shell
renders the bar, the router renders the screen, and siblings have no prop
between them. That file carries a fact *down* ("my list is over your centre");
the new `components/desk/barfocus.ts` carries a request *up* ("take the
cursor"), as the same shape of context and for the same stated reasons.

It stays a `<button>`, not an input. A second text box that forwarded its
keystrokes would be the duplicate again wearing a disguise — and there is
nothing to type into a control whose whole job is to hand the cursor
somewhere else.

The two rules also turn out to agree rather than fight: click the box, the
cursor lands in the bar, and the moment you type, the bar drops its list and
`centreHidden` takes the centre row away. That is one motion, and it is the
browser's.

---

## 2. The same fault outside the workspace

### F1 — two `Plus` glyphs, two meanings · **CUT the FAB**

The feed navigation draws a floating action button on the home screen of a
phone:

```
$ grep -n "fab:" app/src/lib/chrome.ts
150:    fab: nav === 'feed' && screen === 'home' && !wide,
$ sed -n '1792,1812p' app/src/App.tsx
    onClick={() => dispatch({ type: 'go', screen: 'import' })}
    aria-label="Import a syllabus"
    …
    <Plus size={24} />
```

The header above it is drawing a `Plus` too, and `showActions` is unconditional
(`App.tsx:563`), so on the feed home on a phone there are **two `Plus` buttons on
screen, and they do different things** — one opens the capture box, one opens the
syllabus importer. The header's own comment is the argument against the one
below it:

> It briefly opened the importer on the courses list — the `+` adding what the
> screen lists — and that made the one control whose meaning you can rely on
> into one you have to check. — `App.tsx:698-702`

That is precisely the state the FAB restores, from the other direction. And the
FAB is the narrowest control in the app: one nav, one screen, one width.
`import` keeps seven routes without it —

```
$ grep -rn "screen: 'import'" app/src --include=*.tsx --include=*.ts | grep -v test
lib/keys.ts:66        # the `n` shortcut
screens/Courses.tsx:253
screens/FirstRun.tsx:34
screens/Gap.tsx:135
screens/Runway.tsx:118
screens/Yes.tsx:205
screens/me/You.tsx:214
```

— plus its own registry row, so search finds it by "syllabus", and the directory
and the launcher both list it. Six of those seven are empty-state offers on the
screen that noticed the gap, which is not a pathway competing for attention; the
FAB is.

Cutting it removes a field from `Chrome` as well as a button, which is the part
that makes this a simplification rather than a deletion: `chromeFor` stops
answering a question about a button while claiming, in its own words, to be only
about navigation.

### F2 — the rail and the header, checked and clear · **KEEP**

The wide non-workspace layout draws `Rail` and a full (non-slim) `Header`. The
rail's rows are the tab list plus `ask`, `import`, `account`, `connect`,
`settings`, filtered against the tabs so nothing is listed twice
(`App.tsx:1321-1332`). The header's five are `quickAdd`, `finder`, `apps`,
`notifs`, `profile`. **The two sets are disjoint** — no overlap, at any width —
apart from `ask`, which is W5's business. Nothing to do.

### F3 — the phone layout, checked and clear · **KEEP**

`TabBar` draws `barFor(state.tabs, …)`; the header draws the same five as F2.
`profile` is not a tab and cannot become one — `PINNED` is `me`
(`lib/tabbar.ts:66`) and `me` is a different screen. Disjoint apart from the FAB,
which is F1. Nothing else to do.

---

## 3. Re-checks: the axes the first six passes owned

| Axis | State at `71f8c10` |
| --- | --- |
| **Screen overlap** | No new destination since the sixth pass. Its D1 (the application tracker) and the Progress → Everything merge are both landed; `screens/Directory.tsx` is the one directory and `screens/Me.tsx:145` is a row into it, not a second copy. Nothing to add. |
| **Routes per destination** | Re-run. The only destination that gained a pathway is `search`, via `Sidebar`, and that is W3. |
| **Duplicated controls (settings writes)** | Re-run, and it is **not** the null result the sixth pass recorded. Three settings are written from two places each. See §3.1 — one of the three is this pass's axis again, and none of the three is a disagreement. |
| **Findability** | Unaffected by this pass: nothing here removes a destination, a `blurb`, a `keyword` or a `taskTag`. Every control cut below has another control, on screen, doing its job. |


### 3.1 — the settings census, re-run and corrected

The sixth pass reported a null result here. It is not one. Every `set*` action in
`state/slices/settings.ts`, against every production file that dispatches it:

```
$ for a in $(grep -o "case '[a-zA-Z]*':" app/src/state/slices/settings.ts | …); do
>   grep -rln "type: '$a'" app/src --include=*.tsx --include=*.ts \
>     | grep -v '\.test\.' | grep -v 'state/'
> done
```

Eight actions come back with more than one writer. Five of them are not settings
at all — `markAttendance`, `toggleDone`, `timeSpent`, `setDayBudget` and
`toggleNotif` are *data* written from the object it is about and again from
`lib/tools.ts`, which is the assistant's tool surface and is supposed to be able
to do what a person can do. The remaining three are real, and they split two to
one:

| Setting | Written from | Verdict |
| --- | --- | --- |
| `feedOrder` | `screens/Today.tsx:1327` (drag the section itself) and `screens/settings/Nav.tsx:71,319` (a list with arrows) | **KEEP** |
| `boardOrder` | `screens/Springboard.tsx` (drag the tile itself) and `screens/settings/Nav.tsx:95` (the same list with arrows) | **KEEP** |
| `ground` | `screens/settings/Look.tsx:298,331` (ten grounds) and `components/desk/Customize.tsx:47` (dark / light) | **FIX — and it turned out to be a defect, not only a duplicate** |

The first two are kept because they are not two copies of a control, they are
**the object and the index of the object**. Dragging the checklist above the
rail on Today is the thing itself moving; the arrows in Settings are the only
way to move a section without a pointer and the only visible sign the list has
an order at all. Both write the same key through the same resolver — `ordered()`
and `afterMove()` — so they cannot disagree, and the comment at `Today.tsx:1322`
already says why there are two: *"Two places, one order — this is the one you
are looking at when you decide."* `/simplify`'s own rule about direct
manipulation is the argument for keeping them, not against.

`ground` is different, and looking at it properly turned a judgement call into
a bug report. `Customize` writes it too, and its own file opens by defending
that:

> It is a shortcut to settings, not a second settings. […] The temptation with a
> panel like this is to grow it until it is the settings screen in a drawer, at
> which point there are two settings screens that disagree.
> — `components/desk/Customize.tsx:4-13`

The defence sounds right and is false, because of the one option it does not
mention. `screens/settings/Look.tsx` puts **Match my device** *above* the ten
grounds, for the reason written beside it — it is the answer for most people,
and a device on a light-and-dark schedule otherwise means coming back twice a
day. The pair could not express it.

It read the ground through `resolveGround`, whose whole job is to turn the
`device` instruction into a palette. So:

| Saved `ground` | What the pair showed | What pressing the other side wrote |
| --- | --- | --- |
| `device`, device dark | **Dark**, lit — a choice never made | `paper`, destroying the instruction |
| `device`, device light | **Light**, lit | `ink` |
| `oxide` | **Dark**, lit | `paper`, over a chosen ground |

Three faults in one control, all verified against the real functions before
anything was changed: it **misreported** the setting, it **overwrote** it
silently and one way — pressing the lit side is a no-op, so there is no route
back to Match my device from that panel — and the ground it wrote for "light"
(`paper`) is not even the one Match my device resolves light to (`parchment`,
`DEVICE_LIGHT` in `lib/look.ts`).

So not a judgement about the front door after all. **The pair is gone.** A
faithful three-state version would still be a second writer of one key, and the
row beneath it already opens the page where all eleven states are one tap each
— so that row does the reporting instead: it names the ground you are on,
through a new `groundName`, which is the function that does *not* erase
`device`. `resolveGround` answers "which palette do I paint"; `groundName`
answers "what did this person choose"; the pair was built on the first while
doing the second's job, and having both named makes that hard to repeat.

---

## 4. What to do, in order

| # | Change | Survivor | Lost |
| --- | --- | --- | --- |
| W1 | Header drops the magnifier in the workspace | `TopBar`'s field | nothing — the field is on screen at every width |
| W2 | Header drops `+` where `Sidebar` is drawn | `Sidebar`'s New | nothing wide; the `+` stays narrow, where it is the only one |
| W3 | `Sidebar` drops the Search home row | `TopBar`'s wordmark | nothing — the mark is drawn at every width |
| W4 | `Sidebar` drops the Settings row | `TopBar`'s gear | nothing — gear wide, launcher narrow |
| F1 | Cut `chrome.fab` and the button | the header's `+` for adding, seven routes for importing | one shortcut on one screen; the glyph stops meaning two things |
| W6 | `Sidebar`'s directory row is renamed, not cut | both — they are different places | the shared name, which was the fault |
| W5 | The search home drops its AI Tutor button | `TopBar`'s, drawn on every screen | nothing — the bar's is inches above it |
| W7 | The centre box focuses the bar instead of opening a second search; both `⌘ K` chips go | `TopBar`'s field — the only one now | nothing; the front door has one search field, reachable from two places |

**Eight controls go, one is renamed, one stops being a search and becomes a way
into the one that is. No destination goes**, which is why the screen count
stays at 60 and why nothing in this pass needs a state migration —
no saved `screen` can become invalid when no screen is removed.

### W6 — one name, two places · **RENAME**

Found while cutting W3 and W4, and it is not the same fault as either. The
bar's nine dots carry `aria-label="All apps"` and open the launcher; the
sidebar's second row read "All apps" and went to `screens/Directory.tsx`. Not
duplicates — a panel over the page you were reading is a different object from
a screen — but one name, in one frame, for two destinations. A screen reader
read them out identically, and pressing one was the only way to find out which
you had, which is worse than a plain duplicate: a duplicate at least takes you
somewhere you expected.

Cutting either would have lost something real, so neither is cut. The row is
**App directory** now, and the two are called what they are.

The rule the five share gets written down rather than left as five edits:
`lib/header.ts` already owns "how many things the action row can carry and which
one yields", and it gains the rest of the row's arithmetic so that the answer to
"does the header draw this control" is one tested function instead of five
conditions in the markup — the shape `lib/chrome.ts` exists to enforce, applied
to the one piece of chrome `lib/chrome.ts` deliberately does not cover.

---

## 5. Resolved

Every row above is closed. Three commits, each green.

| Row | Commit | What landed |
| --- | --- | --- |
| W1, W2 | `80061c0` | `headerRow` in `lib/header.ts` decides all five; the markup asks. `slim` is gone, replaced by the two facts it was standing in for. |
| W3, W4, W6 | `0cb57a6` | `Sidebar` loses Search home and Settings; its directory row is renamed. `lib/onframe.test.ts` holds the invariant. |
| F1 | `79b9681` | The FAB and `chrome.fab` go; `chromeFor` answers one question again. |
| W5 | *"The assistant is offered once"* | The search home's duplicate AI Tutor button goes. The panel and the tab stay: one conversation, two doors, named apart and sharing every component — `/ask-tab` still owns any rebuild. |
| W7 | *"One search field in the workspace"* | Fixed, by the first of the three routes the audit set out. The centre box focuses the bar through a new `components/desk/barfocus.ts`; both `⌘ K` chips go, along with the four statements in prose and markup that said ⌘K opens a search when it opens the assistant. |
| §3.1 `feedOrder`, `boardOrder` | — | Kept. The object and the index of the object, through one resolver. |
| §3.1 `ground` | *"The ground has one home"* | Fixed. The Dark/Light pair goes; the row below reports the ground through `groundName` and opens the page that owns it. `lib/onframe.test.ts` gains a one-writer-per-preference census, with `Customize`'s one-way exit to the tab bar stated as the exemption it is. |

### The claim, checked rather than asserted

`npm run lint` exit 0. `npm test` **315 files / 6731 tests**, all passing —
thirty more than the baseline, all of them new checks on this pass's
invariants. `npm run build` clean.

And driven in a browser, because an absent control is easy to claim and hard to
see. Chromium at two widths, four navigations, `pageerror` empty throughout:

| Frame | Header's action row | Other chrome |
| --- | --- | --- |
| Workspace, Alerts, 1280px | **empty** | bar's field + tools; sidebar New, App directory, favourites, Connect |
| Workspace, Alerts, 420px | **Add something in one line**, alone | bar's field + tools; no sidebar |
| Feed, home, 420px | add · search · All apps · Alerts · Profile | no floating import button; **one `+` on the screen** |
| Tab bar, Alerts, 420px | add · search · All apps | the tab bar, unchanged |

And the panel, on the two saved grounds the pair got wrong:

| Saved `ground` | Customize now reads | Swatches on screen |
| --- | --- | --- |
| `device` | Colour and type · **Match my device** | 0 |
| `oxide` | Colour and type · **Oxide** | 0 |

And the search home, which had two of the assistant's button:

| Frame | AI Tutor controls | Note |
| --- | --- | --- |
| Workspace, search home, 1280px | **1** (was 2) | the bar's; W7's two search fields remain, open |
| Workspace, any other screen | 1 | unchanged |
| Rail, 1280px | 1 — the rail's "Ask Claude" row | the floating button is named apart |

And the front door's search, at both widths — the centre box clicked, the
cursor followed, and nothing opened over the page:

| Frame | Search inputs | `⌘` on the page | Centre box focuses the bar |
| --- | --- | --- | --- |
| Workspace, search home, 1280px | **1** (was 2 fields) | **0** (was 2) | yes |
| Workspace, search home, 420px | **1** | **0** | yes |

Then typing into it: the bar's value became what was typed, its suggestions
opened, and `centreHidden` took the centre row away — one motion, the
browser's. The palette did not open, which is the whole of the change.

The first row is the screenshot this pass opened with, and it is the one that
matters: on Alerts in the workspace, the header is now the way back and the
screen's name, which is all a header on that screen was ever for.


---

# Appendix — the audit, sixth pass

Step 1 of `/simplify`, run again against the app as it is now. No code in this
commit.

Counted against `app/src` at `8e5774d`: **60 destinations** in `lib/nav.ts`, 82
members of the `Screen` union, 100 screen files, 136 components, 8 shelves
holding between five and eight each. Baseline before any change: `npm run lint`
exit 0, `npm test` 311 files / 6673 tests passing.

**The app grew by eleven destinations since the last audit was written**, and
that is the whole reason for this pass. The fifth pass ran at `3a12e03` against
50; since then `university`, `create`, `call`, `meet`, `draw`, `equations`,
`write`, `sheet`, `groupwork` and the four Beyond workspaces — `athletics`,
`career`, `family`, `pathway` — arrived across five ports. **None of them had
been through this command.** The previous audits' clusters were re-checked and
still hold; everything new below is new ground.

**The headline is that the ported screens brought exactly one duplicate home
with them, and it is also a layout bug.** The rest of what they brought is one
UI block written six times and a short tail of dead exports. The screen count
does not need to come down; one tab does.

---

## 0. What the previous five passes left, re-checked

Two of the last audit's open items are now closed, and the check is worth
recording because both were things it said it was *not* going to fix:

| Left open at `3a12e03` | State now |
| --- | --- |
| **"Erase from this device" does not exist** — the app promised it in `lib/privacy.ts` and `lib/cloud.ts`, and no screen offered it | **Closed.** `lib/erase.ts` exists and `screens/Privacy.tsx:30` calls `eraseDevice`. The machinery the last pass kept rather than cut (`wipe`, `clearSnapshots`, `clearFiles`, `clearVersions`, `clearShared`) is the thing it now calls. |
| **The `set*` census is the wrong net** — the Claude key bypassed the reducer, so no `set*` scan could see it | **Closed, and re-run on the wider net.** See §3: the null result is now real. |

---

## 1. Screen overlap

### D1 — the application tracker, given two homes · **MERGE — cut the tab**

`screens/Career.tsx` has six tabs. The second is not Career's:

```
$ grep -n "Applying" app/src/screens/Career.tsx
28:import { Applying } from './Applying';
195:      {tab === 'tracker' && <Applying />}
```

`applying` is a destination in its own right — Beyond shelf, its own `blurb`,
`keywords` and `taskTags`, and a card on Today (`components/Applying.tsx`)
putting recruiting deadlines beside the coursework they collide with. So
pressing Career → Applications and opening Applications land on the identical
body. One job, two homes — the shape §5 cut for Today's Report tab (T1) and
#34 cut for Settings.

Three things separate this from the four-times-reversed grade table (T2), and
all three point the same way:

- **The data was never duplicated, only the home.** Career's "Track it"
  (`Career.tsx:435`) dispatches `addApplication` into `state.applications`,
  which is exactly what `Applying` reads. `Career.tsx:47` says so out loud:
  "embedded rather than reimplemented… Two trackers, one of which is nearly
  the other, is how a student ends up with half their deadlines in each."
  That reasoning is right and this merge keeps it — there is still one
  tracker. It just stops having two front doors.
- **It is a layout defect the codebase already warns about.** `Applying`
  opens `<Page>` (`Applying.tsx:68`) and Career renders it inside its own
  `<Page>`. That trips the `Inside` guard in `components/Page.tsx` — *"`<Page>`
  inside `<Page>`. A screen has one frame; its sub-views are parts of it, not
  screens of their own"* — which is doubled side padding and doubled trailing
  space above the tab bar. T1 and T2 both needed a `bare` prop to embed a
  screen; this embed has none, so it is not a considered embed.
- **T2's deciding argument does not apply.** The grade table stayed a tab
  because `Courses.tsx` had called it one of three views of the same four
  courses since it was written, and because Courses is in `DEFAULT_TABS`.
  Neither is true here: Career's own comment calls the tracker *another
  screen*, and neither `career` nor `applying` is a default tab.

**Verdict: the tab goes, the destination stays.** The destination is what the
directory, the search box and the tab bar point at, and a tab cannot be any of
those. Career keeps the hand-off it already has — "Track it" still writes to
the tracker — and gains a row that opens it, which is what Settings does for
eight other things.

−1 tab, 0 destinations.

### D2 — two screens called People · **KEEP both, rename the tab**

`Career.tsx:66` labels a tab **People**. `people` is a destination labelled
**People and letters**. Same word, two places, and this time the two are
genuinely two questions:

| | Store | Shape | Question |
| --- | --- | --- | --- |
| `career` → People | device library, `lib/career.ts:85` | `CareerContact`: name, organization, interests, **permission**, next, nextDate | who have I met in this industry, did they agree to be on a list, what is my next move |
| `people` | `state/shape.ts`, `lib/letters.ts:35` | `Person` + `Visit` + `Ask`: role, courseId, email, every conversation logged, every letter asked for | which professor will write about me in two years, and have I given them anything to write |

Merging them would move a device library into `state/shape.ts`, and the brief
is explicit: *do not touch data shape to make a merge easier*. They are also
the case the brief names — two things that look alike and are asked by a
different person in a different mood.

So the cost is the shared **name**, and that is the half that can be fixed for
nothing. This is T3's precedent exactly, where Study's "Tonight" tab became
"Revise" so it stopped colliding with the `tonight` screen. The tab becomes
**Contacts**. Two jobs, two names, both still there.

### D3 — the device-library notice, drawn six times · **SHARED COMPONENT**

The six workspaces that keep their data in a device library each hand-draw the
same status block, with byte-identical inline styles:

```
$ grep -rln "lib.error || notice\|notice || lib.error" app/src/screens
Create.tsx  Career.tsx  Athletics.tsx  Family.tsx  Pathway.tsx  University.tsx
```

`role="status"`, a 1px `--app-line` border at `--r-md`, `--sp-5` padding,
`--sp-4` block margin, `textWrap: 'pretty'` — and in four of the six, a
`lib.blocked` branch rendering a "Download recovery copy" button where the
only thing that differs is the filename string. Thirty-three files in the app
render some `role="status"` block; these six render *the same one*.

→ one `LibraryNotice` in `components/`, taking the library handle and the
recovery filename. This is the pattern `EmptyState` and `PickChips` already
set: one component, several hosts.

### D4 — exports with no caller, recounted · **CUT the dead, keep the contracts**

One scan of every `export function`/`const`/`class` under `app/src`, counting a
name as unread when no *production* file but its own mentions it:

- **7 with no reader at all** — not the app, not a test, not their own file:
  `components/mail/List.tsx: Face`, `components/CourseTag.tsx: CourseDot`,
  `lib/intake.ts: intakeUrl`, `lib/runway.ts: courseOf`,
  `lib/select.ts: SEMESTER`, `lib/docversions.ts: allVersions`,
  `lib/browser.hook.ts: forgetStrip`.
- **31 whose only reader is their own test.**

Down from 26 and 50 at the last pass, which is the evidence that the cut held
and that eleven new screens brought very little dead weight with them.

Five of the 7 go — `CourseDot`, `courseOf`, `SEMESTER`, `forgetStrip` and
`intakeUrl`, and with the last of them `isUrl`, whose only job was routing to
it. Two turn out to be unfinished wiring rather than dead code and are
finished instead; see §5. The 31 do **not** all go, and the last pass's rule — "a test is not a
reader" — needs one qualification it did not have: some of these are *contracts
a test asserts*, where the export exists so the test can state a rule about the
app rather than to be called. `lib/contrast.ts: AA_TEXT, AA_LARGE` (the WCAG
thresholds every colour in the app is checked against), `lib/privacy.ts:
SYNCED_FIELDS, NEVER_SYNCED` (what may and may not leave the device — and
`lib/context.ts` is out of scope by the brief's own guardrail) and
`lib/erase.ts: DATABASES` (which `erase.test.ts` uses to fail the build when a
database is opened that erase does not clear) are all of that kind. Deleting
them deletes the rule, not the dead code. They stay, and this paragraph is why.

### D7 — the directory, drawn twice again · **MERGED — `directory` survives**

The fifth pass's S1 merged the `everything` screen into Progress, on the
grounds that two screens must not both draw the registry. Then the workspace
shell arrived with `screens/Directory.tsx`, and they now both do.

| | Reads | Draws | Reached from |
| --- | --- | --- | --- |
| `directory` | `allApps(caps, role)`, `saysFor`, `readFavourites` — all of `lib/desk.ts` over `lib/nav.ts` | Every app, list or grid, category rail down the side, a star per row | The workspace sidebar, the launcher's "All apps", the search home |
| `me` → **Everything** | `offered(caps)`, `lately`, `untried` | Every app, as headed shelves, with Lately and Not tried above | The Progress destination, in every navigation |

Both gate on the same capabilities through the same registry, and both print
every destination with its blurb. `Directory.tsx` claimed in its own comment to
be "the only surface in the workspace that shows the whole registry" — written
before the two met, and corrected in this pass.

**Nothing hides either from the other.** The three-navigations defence that
clears `import` and `edit` in §2 does not apply: `me` is a destination, so it
is reachable in the workspace navigation too, and a student there can open two
full directories without leaving it.

**Recorded first and merged second**, and the reason for the gap is §6 of this
file rather than any doubt about the finding. The survivor question here is
which of two things a person *navigates by* should survive, and that depends
on which navigation they actually use — `directory` is the better screen and
is unreachable outside the workspace; `me` is a destination in `DEFAULT_TABS`'
world and works in all five. §6 is a record of exactly this question being
answered four times from the code and reversed four times by the person whose
app it is, at the cost of a migration each way.

It was taken to them, and the answer is **`directory` survives**. So Me's
Everything tab becomes a row that opens it — precisely the rule `Me.tsx`
already states for itself about the Settings tab it dropped: *"pressing the tab
and pressing the Settings button landed on the same list, so the app had two
homes for one thing. The screen kept its own — this keeps the row that opens
it."*

### What the merge carried

**Two lists, which were the only things the tab had that the screen did not.**
**Lately** (the four places you were) and **Not opened yet** (three you have
never been, from `lib/unseen.ts`) are on `directory` now. Nothing else in the
app drew either, so losing them was the whole risk in this merge, and
`screens/directory.test.tsx` mounts the screen and reads them off it rather
than grepping for the import — a static check passes on a screen that imports
a list and never renders it, which is exactly the failure a merge introduces.
Both stand aside the moment a filter or category is on: they answer "where was
that", and a list ignoring the filter above one obeying it reads as a bug.

**One card, not two.** Favourites drew its own; Lately would have been a second
copy of it in the same file, which is the thing this pass exists to remove.

**`directory` did not become a destination**, and that is deliberate rather
than an omission. Every shelf but two is already at `MOST_ON_A_SHELF`, and the
`Screen` union's own note is right that this is the shell looking at itself,
the way a browser's new-tab page is not a bookmark. So `me` keeps the
Everything keywords — "sitemap", "what can this app do", "never opened" — and
search still lands there, one tap from the row. Reachable from the Progress
row in every navigation, and from the sidebar, the launcher and the search
home in the workspace.

**`#/everything` is retired a second time**, now onto `directory`. It first
went to the Progress tab that had duplicated the Everything *screen*; a link
written when Everything was a screen is on a screen again. `opens.meTab` went
with it — it had exactly one setter — and `meTab` narrows to `'you' | 'task'`.
No state migration: `meTab` is `Ephemeral` (`state/shape.ts`), never read back
out of a save.

### Two things the merge found that the audit had not

**`Launcher` and `nav/Folder` were the tab's other half.** The tab drew shelves
at `directory: 'list'` and eight shelf tiles at `'tiles'`; the screen draws
rows and cards for the same two. Both launcher files had exactly one caller —
the tab — so they go with it. `lib/launcher.ts` stays: `groupOrder` still
orders the apps sheet and the workspace apps panel through `lib/apps.ts`, which
is why the ordering board in Settings → Navigation still has something to
order. Its copy said "the tiles inside a folder, and the directory rows on Me",
which was true of neither afterwards, and now names the two surfaces that read
it.

**One setting was being read two ways — a §3 finding the §3 method could not
see.** `directoryOf` resolves the unchosen state at the point of use (soft
draws tiles); Progress' tab resolved it and `Directory.tsx` compared the raw
key to `'tiles'`. So an unchosen soft-layout account got the list on the
directory while **Layout and navigation** showed Tiles selected. It could
disagree only because there were two renderers; there is one now, and it
resolves. The `DIRECTORIES` blurbs described the launcher's nine shelf tiles
and now describe what the setting actually draws.

### D5 — three springboards over existing screens · **KEEP, recorded**

Three of the new screens carry their own list of links to other destinations:

| Screen | Links out to | What it is |
| --- | --- | --- |
| `create` | 6 of 9 tiles → `write`, `deck`, `sheet`, `draw`, `study`, `mine` | "you know what you want to make, not which screen makes it" |
| `university` | 11 destinations | which of 37 service areas this app can honestly touch |
| `pathway` | 7, in `CONNECTED` (`Pathway.tsx:71`) | what a multi-term project touches |

This is the `everything`-versus-`me` shape at smaller scale, and the temptation
is to call all three a second directory. **They are not, and the distinction is
the one the brief itself draws**: the directory and search are indexes and do
not count as pathways. Each of these is an index too — task-scoped rather than
whole-app — and none of them reimplements the screen it points at. `Create`
says so in its own comment: *"A second document editor here would be a second
place documents could live"*, and it does not build one; the three makers it
does own (a form, a design, a video) have no other home in the app.

Cutting them removes an affordance and no duplication. Kept, recorded, so the
seventh pass does not have to work it out again. The line worth holding is the
one Create already states: a hub may *point*, and the moment one of these grows
an editor of its own it becomes a D1.

### D6 — the previous clusters, re-checked

| Cluster | State |
| --- | --- |
| `ahead` · `tonight` · `behind` · `runway` | **Keep**, unchanged. Four questions, each file still arguing its own case. |
| `brief` grains vs `calendar` grains | **Keep.** Grains of one report and grains of one grid. |
| `ask` vs the assistant sheet | **Keep**, owned by `/ask-tab`. Shared `Composer`/`Turns`, two shapes. |
| `applying` vs `career` vs `pathway` | **Three questions, one merge.** A recruiting deadline (`applying`), an industry and its evidence (`career`), a project spanning terms (`pathway`). Only the *tracker's second home* is duplication — D1. |
| `people` vs `career`→People | **Keep**, rename — D2. |
| `grades` | **Closed. Do not reopen.** Reversed four times; §6 records why it takes an instruction from the app's owner, not a fresh reading of `Courses.tsx`. |

---

## 2. Routes per destination

Re-run, excluding tests and the nine navigation-infrastructure files
(`nav.ts`, `App.tsx`, `shape.ts`, `land.ts`, `route.ts`, `navigate.ts`,
`desk.ts`, `tabbar.ts`, `settings.ts`):

```
# screen -> distinct production files dispatching to it
$ for s in $(grep -oP "^    screen: '\\K[a-zA-Z]+" app/src/lib/nav.ts); do
    grep -rlP "screen: '$s'(?![a-zA-Z])" --include=*.ts --include=*.tsx app/src \
      | grep -vE '\.test\.|nav\.ts|App\.tsx|shape\.ts|land\.ts|route\.ts|navigate\.ts|desk\.ts|tabbar\.ts|settings\.ts' \
      | sort -u | wc -l | xargs echo "$s"
  done | sort -k2 -rn
courses 8 · import 7 · mine 6 · edit 6 · calendar 6 · study 5 · ahead 5 · exam 4
… 16 destinations have two · 15 have one · 12 have none
```

**The brief's "no destination reachable more than one way" is not a claim this
app can honestly make, and should not.** Three passes have now examined the top
of this table and reached the same answer, so it is stated once here as
settled: the counts are three things, none of which is a duplicate home.

- **Three navigations, one drawn at a time.** `App`, `lib/softtop.ts` and the
  springboard each offer `import` and `edit`; `NAVS` in `lib/look.ts` means a
  student sees exactly one of the three. Cutting any removes the affordance for
  whoever chose that navigation.
- **Contextual actions.** `insights/`, `lib/toolnow.ts`, `components/Clashes.tsx`
  — a card answering a question you are already holding, which is the shape the
  brief asks for rather than one it forbids.
- **Keyboard shortcuts.** `lib/keys.ts` is an accelerator over the tab bar, not
  a second door.

What *is* checkable, and is the real form of the rule, is that **no destination
has a second home** — no screen's body is rendered in two places. After D1 that
is true, and `lib/onehome.test.ts` is what holds it.

One hole in the grep, kept from the last audit because it is still true:
`screen: '…'` misses routes passed positionally through the reducers
(`push({ … }, 'quiz')`), which is how twelve sub-screens are reached. Second
grep: `grep -rhno "}, '[a-z][a-zA-Z]*'" app/src/state/slices/`.

---

## 3. Duplicated controls — a real null result this time

The last pass said its census used the wrong net, because the Claude key was
written by `saveSettings()` rather than by a reducer action and no `set*` scan
could see it. Re-run on the wider net — *which files write this setting, by any
route*:

- **Reducer actions.** Every `set*` in `state/slices/settings.ts` against every
  non-`state/` file that dispatches it: **no action is dispatched from more
  than one file.** The census returns empty.
- **Module helpers that bypass the reducer.** `saveSettings` has exactly one
  caller outside its own module: `screens/settings/Assistant.tsx`.
  `screens/Connect.tsx:487` keeps only a comment and a row saying where the key
  went — the #46 merge held.
- **Direct `localStorage.setItem` in screens or components.** Two files,
  `components/Watching.tsx` and `components/Boundary.tsx`, both writing the
  error log. Neither is a setting.

**No control has a second copy**, and unlike the last three times this was
claimed, the scan that says so is the one that would have caught the exception.

---

## 4. Findability — already satisfied, checked not assumed

- **Every one of the 60 destinations has a `blurb`.** Script-checked, zero
  missing.
- **Every one has at least one `taskTags` entry**, so nothing is invisible to
  the directory's intention view. Zero missing.
- **All 8 shelves hold between five and eight.** `Beyond` 5, `Life` 7, the
  other six at 8. The brief's "reduce a shelf under three" does not fire, and
  `nav.test.ts` already holds the ceiling.

D1 and D2 remove no destination, so no `keywords` need moving and no
`state/shape.ts` migration is required — a point checked rather than assumed,
because every previous pass in this file needed one.

---

## 5. What to do, in order

| # | Change | Destinations | Tabs | Kind | Done |
| --- | --- | --- | --- | --- | --- |
| D1 | Career's Applications tab → the `applying` screen | 0 | −1 | Merge | ✅ `d14912d` |
| D2 | Career's People tab → "Contacts" | 0 | 0 | Rename | ✅ `d14912d` |
| D3 | `Notice` — one component, **eight** hosts | 0 | 0 | Shared component | ✅ `fd57928` |
| D4 | 7 dead exports — **5 cut, 2 wired**, plus the `isUrl` that only routed to one of them | 0 | 0 | Cut | ✅ `41c1607` |
| D5 | Three springboards | 0 | 0 | Keep, recorded | ✅ recorded |
| D6 | Previous clusters | 0 | 0 | Keep, re-checked | ✅ recorded |
| D7 | The directory drawn twice — `directory` against Progress → Everything | 0 | −1 | Merge | ✅ survivor `directory`, on the app owner's instruction |

### What each turned out to be, once done

**D1 carried a guard with it.** `lib/onehome.test.ts` existed precisely to stop
a screen becoming a tab of another screen, and this got past it: it looks for
a `bare` prop, on the reasoning that embedding a screen needs a frameless
render path in order to compile. Career simply wore the doubled `<Page>`
frame instead. The test now asks the question directly — which components are
a destination's whole body, per `App.tsx` and `lib/nav.ts`, and does any
screen render one it did not define — and is checked against the embed Career
actually had. Its first version mistook `Array<Application>` for a render;
that is recorded in the test.

**D3 was eight, not six.** The two the exact-match scan missed were found by
the guard written for it: `creation/VideoEditor.tsx`, the same box drifted one
type step larger, and a false positive in `components/Replaced.tsx` — an undo
toast that shares a border with the notice and nothing else. The rule matches
the box's three measurements now rather than its decoration, because a rule
that catches the wrong file teaches people to add exceptions to it.

**D4 found two things that were not dead code but unfinished wiring**, and
both are now finished rather than cut:

- `Face` draws a sender's monogram; `mail/Reader.tsx` hand-wrote its exact one
  line instead of calling it.
- `allVersions` was written, tested, and commented *"for the storage figures
  on the Data screen"* — and never called. So the Data screen's answer to
  "what is this app taking up" omitted the document history entirely: its own
  database, holding up to twenty full copies of every document, invisible to
  all three figures beside it. `lib/erase.ts` found the same database missing
  from the other end. Data counts it now, as a fourth row outside the store.

That is the second time in two passes that the honest reading of a test-only
export was *"a promise the app has not finished keeping"* rather than *"dead
code"*. The last pass found it for Erase from this device. **The rule to carry
forward is not "a test is not a reader" on its own** — it is that an unread
export is one of three things, and they are told apart by reading its comment:
dead (cut it), a contract a test asserts (keep it), or wiring somebody stopped
halfway through (finish it).

### Nothing needed a migration, and that is checked rather than assumed

No destination was removed, so no `keywords` moved and no saved `screen` can
now name something that is gone. The three nets that would have caught it are
in place either way:

- the current screen is `Ephemeral` (`state/shape.ts:727`), defaulted to
  `home` in `blank()` — it is never read back out of a save;
- a saved tab bar goes through `readTabs` (`lib/tabbar.ts:86`), which drops
  screens not in `DESTINATIONS`;
- a deep link goes through the `opens` table in `lib/route.ts`, which is what
  still lands `#/grades` and `#/weekly` on their survivors.

**60 destinations, and they stay 60.** That is the finding, not a failure to
find one: five passes have already taken this app from 59 to 49 and the eleven
that arrived since are eleven things it does, not eleven ways of saying one
thing. What the ports did bring was one screen given a second home, one tab
named after another screen, and one block of markup written six times.

---

# Appendix — the audit, passes two to five

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

> **A third pass ran against `3a12e03` at the same time as this one**, by other
> hands and without sight of it, and landed three things before this document
> was written. They are folded in below rather than kept apart, because two
> audits of one app is exactly the shape this command exists to remove.
>
> · **S2 is done** — and was reached independently, with the same survivor and
>   the same requirement to carry the drafts and attachments rows across. Two
>   passes agreeing about a merge from different starting points is the best
>   evidence either of them offers.
> · **§3's conclusion was wrong, and is corrected there.** There *was* a
>   genuine second copy of a control. A `set*` scan cannot see it.
> · **A second chip idiom** had five hand-rolled copies and no component; §4
>   carries it as S8.

**Status.** S1 and S3 are done on this branch, and S4 is half done — the half
left is a design decision rather than a mechanical one, recorded in its own
row. S2 was done twice over: once here and once by the pass above, which
reached the same survivor from a different start. Where the two touched the
same file, the other pass's version stands, because it landed first and there
is no argument between them.

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

### S2 — what the app is storing, written twice · **MERGE — done**

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

**Done, and reached independently.** The third pass merged this before reading
this section and landed on the same survivor for the same reason, with one
detail worth adding to the record: the two numbers disagreed because they were
two *measurements*, not two renders — `Data` asks `space()` in
`lib/inventory.ts`, `Storage` called `navigator.storage.estimate()` inline.
`space()` survives; it asks the same browser API and also reports which backend
is live and whether the browser has promised not to evict. The drafts and
attachments rows moved across as this section requires, drawn below the store's
total and outside it, since that total is the size of one string the app writes
and these are not in it.

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
| A caps label (uppercase + letterSpacing, inline) | `SectionLabel`, `.kicker` | **229**, in **58** distinct style combinations | 79 |
| A list row with a hairline under it | `ItemRow` in `components/shell/Rows.tsx` | **33** | 12 |
| "Nothing here yet" | `EmptyState` in `components/ui.tsx` — it exists, and five screens used it | **~40** | 29 |
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

**Two corrections to this row, both of them mine.**

`EmptyState` is not missing. It is in `components/ui.tsx`, it takes an `action`
— the button that says what would put something there — and five screens were
already using it. And the count of hand-written empty blocks is about forty in
29 files, not 96 in 71: the grep behind the larger number was matching
explanatory prose ("nothing is fetched", "nothing fires while you are typing")
along with the empty states. **Eleven of the forty are converted**, two of them
gaining an action they did not have.

**The caps labels are not one idiom and should not be replaced in bulk.**
229 inline uses, and grouping them by what they actually set — size, tracking,
opacity, whether they switch to the heading face — gives **58 distinct
combinations**. The largest group, 51 of them, sets no size at all and is
mostly buttons: CLEAR, SAVE, ADD ONE. `SectionLabel` is not what those are.
Nor is it a silent swap for the ones that are headings: the class is 12px at
0.2em tracking in the accent colour, and most of these are `--type-xs` at 0.1em
inheriting the text colour, so converting them makes quiet labels louder on
sixty screens.

That is a decision about which two or three of the 58 are the real ones, taken
screen by screen with the app in front of you. It is not a find-and-replace,
and a pass that removes duplication has no business making that call on its
own. Recorded, with the numbers, for whoever takes it.

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

**One hole in this grep, found on the third pass and worth keeping written
down.** `screen: '…'` misses every route through the reducers, which pass the
screen positionally — `push({ …state, quiz: action.quiz }, 'quiz')`. Twelve
sub-screens are reached only that way (`drill`, `quiz`, `guess`, `lesson`,
`slides`, `exam`, `item`, `course`, `event`, `note`, `guide`, `update`), so a
count without them makes `quiz` read as dead code when it is the second half of
a flow that starts on the guide. The second grep is
`grep -rhno "}, '[a-z][a-zA-Z]*'" app/src/state/slices/`.

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

### The one this scan could not see · **MERGE**

**There was a genuine second copy of a control, and the table above cannot
contain it.** The scan is "every `set*` action dispatched from more than one
file" — and the Claude API key, the proxy field and the model picker do not go
through the reducer at all. They call `saveSettings()` in `lib/claude.ts`, which
writes `localStorage` directly. A duplicate implemented that way is invisible to
this method by construction, however carefully the method is run.

```
$ grep -ln "config.apiKey" app/src/screens/*.tsx app/src/screens/settings/*.tsx
app/src/screens/Connect.tsx            # a private ClaudeAccount(), ~145 lines
app/src/screens/settings/Assistant.tsx # the whole screen
```

Both rendered a key field and a model list; both called `saveSettings`. Settings
is the survivor — a strict superset, with two providers, the routing between
them and the month's spend — and the two things only Connect had moved rather
than died: the **check-this-key** button, and the sentence saying there is no
"sign in with Claude" to hunt for, which now sits on the page somebody hunting
for a login button actually lands on. Connect keeps a row saying where the key
went. Done on the third pass.

**The lesson for the next run of this section** is that "dispatched from more
than one file" is the wrong net. The right question is *which files write this
setting*, by whatever route — a reducer action, a direct `localStorage` write,
or a module-level helper. The rest of the table stands; it was checked again
after this one was found.

**No other second copy of a control.** Same finding as the first pass, from a
scan that now has three fewer screens to disagree about — and one hole in it,
named above.

---

## 4. What to do, in order

| # | Change | Destinations | Kind |
| --- | --- | --- | --- |
| S1 | The directory drawn twice — `everything`'s By-area and Not-tried views against Me's Everything tab | −1 | ✅ Merged into Progress, which gains a By-task tab |
| S2 | Settings → Storage becomes a row that opens `data` | 0 | ✅ Merged |
| S3 | 76 exports with no caller — 26 dead outright, 50 read only by their own test | 0 | ✅ Cut: 62 gone, 14 kept with reasons |
| S4 | `EmptyState` where a screen drew its own; the caps labels left alone | 0 | ◐ 11 of ~40 converted; the labels are a design pass |
| S5 | `brief`/`weekly`/`worked` libraries | 0 | Kept, recorded |
| S6 | The assistant's two shells | 0 | Kept, `/ask-tab` |
| S7 | The `help` / `everything` blurb collision | 0 | Reword with S1 |
| S8 | The second chip idiom — five hand-rolled copies, no component | 0 | Shared component, **done** |

Two of those are already done, on the third pass that ran alongside this one:

| # | Change | Landed as |
| --- | --- | --- |
| S2 | Settings → Storage is a row that opens `data`; the drafts and attachments rows moved with the measuring | the survivor is `data`, as this section asks |
| — | The Claude key stopped being a control on two screens | see §3, "the one this scan could not see" |
| S8 | `PickChips` in `components/ui.tsx` | five sites converted, three left alone on purpose |

**S8, stated properly**, because the naive count oversells it. There are two
chip idioms in this app and only one had a component. `ChipRow` is a filled,
uppercase 29px chip in a row that scrolls sideways, and its comment explains why
it must not grow: the calendar stacks a `Segmented` directly above one, and at
44px their targets overlapped by 4px, in which band the lower row silently won
taps meant for the upper. The other is an outlined pick that wraps onto several
lines under a heading — five copies, padding drifting between 7px and 9px, radius
between `--r-sm` and `--r-md`. Converting those into `ChipRow` would have shrunk
them, uppercased them and put them in a scrolling row: three changes nobody asked
for. Registrar's found-dates list and Degree's "Taking it now" are **toggles**,
not picks, and stay hand-written; Mine's course filter is `ChipRow`'s shape but
its value is `CourseId | null`, and threading a sentinel through the filter for a
styling win is not a trade worth making.

**50 → 49 destinations**, and the honest headline is again that this app is
large because it does a lot. The duplication that is left is one directory, one
storage report, and a long tail of code and markup nothing calls.

---

## 5. What this pass found and did not fix

Two things turned up while cutting S3 that matter more than the rows above.

**"Erase from this device" does not exist.** `lib/privacy.ts` tells the student
"This device's own copy is separate — signing out leaves it alone, and Erase
from this device removes it", and `deleteEverything` in `lib/cloud.ts` ends by
saying the same. No screen in the app offers it. The pieces are all written and
none is called: `state/persist/db.ts` `wipe`, `lib/snapshots.ts`
`clearSnapshots`, `lib/threads.ts` `clearAll`, `lib/scrollback.ts` `forgetAll`,
`ai/live.ts` `resetLive`. They are kept for that reason rather than cut. A
promise the app makes twice and cannot keep is a bug; building the button is a
feature, which is why this pass stopped at saying so.

**Two libraries are a second implementation of what a screen does inline.**
`lib/intake.ts`'s three doors — files, pasted text, a URL — are tested and
unused, while `screens/Update.tsx` builds its `Intake` objects itself for both
files and pastes. Same shape for `lib/merge.ts`'s `mergePersisted`, which
merges whole records while the sync merges per field through `STRATEGY`. In
both, the library copy is the tested one and the screen's is the one that runs.
Deleting the library would delete the tests; the fix is the screen calling it,
which is a refactor with behaviour in it rather than a deletion.

Each merge must carry, as before: the survivor's `keywords` widened with the
dead screen's, a `state/shape.ts` migration so a saved `screen` that no longer
exists lands on the survivor, and a test for that migration.

---

## 5. Duplicate tabs — the axis this audit had not looked at

Counted against `app/src` at `659a424`: **50 destinations**, 57 screen files.

Sections 1–4 audited *screens* and *routes*. Neither catches a **tab that
renders another screen**, because the tab adds no destination and no `go`
dispatch — the grep in section 2 cannot see it. It is a second front door all
the same, and it is the shape #34 removed for Settings.

The tell is a `bare` prop: a screen exported with a second render path that
drops its own `<Page>` frame so it can sit inside somebody else's.

```
$ grep -rn "bare" --include=*.tsx app/src/screens | grep -v 'className'
screens/Reports.tsx:43   export function Reports({ bare = false })
screens/Today.tsx:273      {tab === 'brief' && <Reports bare />}
screens/Grades.tsx:29    export function Grades({ bare = false })
screens/Courses.tsx:74       <Grades bare />
```

Two, and the app has exactly two remaining. Both are destinations in their own
right, so each is one job with two homes.

### Every screen-level tab bar, and what each tab is

| Screen | Tabs | Any tab a destination? |
| --- | --- | --- |
| `home` Today | Today · Hours · Week · Done · **Report** | **Yes — `brief`** |
| `courses` Courses | Courses · Coming up · **Grades** | **Yes — `grades`** |
| `study` Study | Guides · Tonight · Tools | Name collision only — see below |
| `me` Progress | You · Everything | Name collision only — see below |
| `mine` Personal | Tasks · Events · Notes · Files | No (Places went in #35) |
| `brief` Reports | Day · Week · Term | No — grains of one report |
| `calendar` Calendar | Day · Week · Month · Semester | No — grains of one grid |
| `degree` | What is left · Taken · Requirements | No |
| `people` | People · Letters | No |
| `clocks` | Timers · Alarms | No |
| `applying` | Open · Add one · Closed | No |
| `activities` | Yours · Add one · Find things | No |
| `registrar` | Fill them in · Paste the page | No |
| `deck` | From a unit · From a brief | No |
| `exam` | From your cards · Written for you | No |
| `announce` | A connected feed · Paste a calendar | No — M2's two sources |
| `maps` | Campus · Nashville | No — map scope |

Everything else that renders a `<Segmented>` is an option picker inside a form
(`settings/Look`, `settings/Nav`, `Essay` lengths and voices, `Exam` and `Deck`
durations, `Sources` filter). Those are controls, not tabs, and are out of
scope.

### T1 — Today's "Report" tab · **CUT the tab, keep the screen**

`brief` is a destination with `short: 'Report'`, three grains of its own, and
its own `keywords`. Today renders the same component inline as a fifth tab.
Pressing Today → Report and opening Reports land on the identical body, and
the tab even shares `state.report`, so the grain you left on one is the grain
you find on the other. One job, two homes.

The tab is the copy that goes, per #34: the screen is the thing the directory,
the search box and the tab bar all point at, and a tab cannot be any of those.
It also buys back the fifth-tab problem the code comments about — the comment
at `Today.tsx:262` records that "This week" had to be shortened to "Week"
because Report made the switcher a fifth tab and it wrapped to two lines.

### T2 — Courses' "Grades" tab · **CUT the tab, keep the screen**

Identical shape. `grades` is a destination (`root: 'courses'`, `taskTags:
['stand']`); `Courses.tsx:70` intercepts its own `grades` tab and returns
`<Grades bare />` inside a `<Page bottom={0}>`. Section 1 Cluster E already
ruled that `grades` stays a screen; this is the second door to it.

### Kept, with the reason

- **Study → "Tonight" is not the `tonight` screen.** The tab ranks every unit
  in every course by what has come round in the review schedule, how cold it
  is and what is tested soon, then fills the time you say you have and starts
  the cards. The screen is points of final grade per hour over outstanding
  deadlines. Two questions — *what should I revise* and *how do I spend the
  evening* — that happen to share a word. Both kept, per the rule about two
  things that look alike. **The shared name was the real cost, and it is the
  half that could be fixed without merging anything: the tab is "Revise" (T3).
  Two jobs, two names, both still there.** (The tab was "Tonight's 25 minutes"
  — the weakest unit per course, sized by a fixed string in the course module —
  until `lib/revise.ts`.)
- **Progress → "Everything" is not the `everything` screen.** `Everything.tsx`
  argues this out in its own file comment and section 1 Cluster D accepted it:
  "where is the thing called X" versus "what would I use this for, and what
  have I never opened". Same collision, same verdict.
- **Today → "Week" is not `ahead`.** Five upcoming rows and the next campus
  event, against seven days of hours arithmetic, clash detection and reading
  extents. A preview is not the screen it previews.

### Done

| # | Change | Tabs | Destinations | Done |
| --- | --- | --- | --- | --- |
| T1 | Today's "Report" tab → the `brief` screen | −1 | 0 | ✅ `0ec5044` |
| T2 | Courses' "Grades" tab → the `grades` screen | −1 | 0 | ✅ `0ec5044` |
| T3 | Study's "Tonight" tab renamed "Revise" | 0 | 0 | ✅ |

### After T1 and T2

Two tabs go; no destination goes; nothing becomes unreachable, because in both
cases the survivor is the destination and it keeps its own row, keywords and
task tags. `homeTab` and `coursesTab` are `Ephemeral` — declared in the
`Ephemeral` interface, defaulted in `blank()`, never read back out of a save —
so there is no persisted value to migrate, which is why #34 narrowed `meTab`'s
union and added no migration either. The `bare` prop and its second render path
come out of both screens with the callers.

---

## 6. T2, revisited — which home the grade table gets

Section 5 found the two duplicate tabs and cut both, keeping the destination
each time. T1 is right and stands. **T2 is reopened here and resolved the
other way**: the tab stays and the `grades` destination goes.

Nothing in section 5's evidence changed. What changed is the question it asked.
"Which copy is the copy" has one answer when the two are a screen and an inline
render of that screen — the tab is the copy, which is why #34 cut it for
Settings and why T1 cuts it for the report. It has a different answer when the
embedded screen is genuinely *a view of its host*:

- `Courses.tsx` has said so in its own file comment since it was written:
  "Three views of the same four courses: the courses themselves, everything
  they are asking of you as one list, and what any of it is worth." The third
  view is the grade table. Two of the three shipped as tabs and one shipped
  twice.
- `grades` had `root: 'courses'` in the registry, so even the directory filed
  it under the screen it is a view of.
- Courses is in `DEFAULT_TABS`. The tab is one tap; the destination is two
  taps down a directory. "What do I need on the final" is not a two-tap
  question in week ten.

The report is the opposite case, and that is why the two go different ways: it
has a grain switcher of its own, so as a tab of Today it was a switcher inside
a switcher, and "what is on now" and "how did it go" are asked on different
days by a different person.

### What T2' carries

Deleting a destination is more than deleting a tab, so:

- `courses` takes the grades `keywords`, the plural included — "where are my
  grades" matched `registrar` and nothing else until it did.
- `#/grades` retires into `#/courses` on the grades grain, through a new
  `opens.courses` alongside `opens.report` and `opens.changes`. The course id
  the link used to carry went with it: the table lists every course and never
  read it.
- The soft shell's header and the assistant's context both read the grain, so
  the running-grade hero and the grade rows follow the tab rather than being
  lost with the `case 'grades'` they lived in.
- The projection insight can name the grain it means.
- `UNLOCKS.grades` and the now-unread `hasGrades` fact go: Courses is where the
  first score is typed, and gating it would hide the way in.
- A stored tab bar or `recent` entry naming `grades` is dropped, with a test
  for each.

`lib/onehome.test.ts` from section 5 still holds and is what keeps this honest:
the tab renders `<Grades />` with no prop to choose a frame, because there is
only one caller and one frame.

**50 → 49 destinations.**

### The rest of the sweep

Two censuses run alongside T2', recorded because a null result is worth as much
as a finding — and one of them was a null result for the wrong reason.

- **Controls. This one was wrong, and §3 above says why.** The census was every
  `set*` action in `state/slices/settings.ts` against every file that dispatches
  it: 18 actions, one of them — `setLook` — written from more than one file, and
  those four writes touch different keys. That is all true and it is not the
  question. The Claude key, the proxy field and the model picker were a genuine
  second copy at the time this ran, and they call `saveSettings()` rather than
  the reducer, so no `set*` census could have seen them however carefully it was
  run. Read as "no control is duplicated *through the reducer*"; §3 has the
  finding and #46 has the merge.
- **Routes, recounted.** `edit` 5, `import` 4, `mine` 3, everything else two or
  fewer — unchanged from section 2 and left alone for its reasons.
- **Screens imported by screens**, the other way a screen could hide inside
  one: `FirstRun` (a shared empty state), `Guide → FieldGuide` (`field` is a
  `StudyMode`, not a `Screen`) and `Today → GapOffer` (`gap` has no directory
  row). None is a destination; none is a duplicate.

---


### T2, a third time — the destination comes back, on Semester

Reversed again, by the person the app is for. The reasoning in this section
is about *which of Courses and the tab* is the copy, and it answers that
well. It does not answer the question actually being asked, which is whether
"how am I doing" is a thing you go to or a thing you find while looking at
something else.

It goes back to being a destination, and to Semester rather than Courses:
the shelf that already holds Reports and When you are behind, which are the
other two ways of asking it. `root` stays `courses`, so the tab bar still
lights Courses when you are on it — the answer above about which screen it
is a view of was never in dispute.

The tab goes, so there is still exactly one way in. That is the half of §5
and §6 that has held through all three turns: whatever the grade table is,
it should not be two things at once.

### T2, a fourth time — the tab, and this one is the answer

Asked for directly by the person the app is for: the grade table is the
Grades tab of Courses, and `grades` is not a destination. This restores the
state §6 and #44 left, and reverts the turn above.

Nothing in the reasoning of the turn above is withdrawn — it is a fair
argument, and it is left standing so this section stays the record of what
was argued rather than only of what won. What settles it is not a better
argument: it is that the question it turns on, whether "how am I doing" is a
thing you go to or a thing you find while looking at something else, is a
question about how one person uses their own app, and that person has now
answered it. Three of the four turns here were an assistant reasoning from
the code about a preference the code cannot contain.

So the practical note for whoever reads this next: this row is closed. It has
been reversed four times, twice in each direction, and each turn cost a
migration of `#/grades`, the tab bar's `root`, the assistant's context and
the projection insight. Reopening it needs a new instruction from the person
whose app it is, not a fresh reading of `Courses.tsx`.

What held through all four turns is still the only part that was never in
dispute: whatever the grade table is, it is not two things at once.
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

### M3, as far as it went

One of the two was real and is fixed: the edit screen's "take the semester on"
button dispatched `go: 'edit'` from `edit`, which pushed a history entry, so
Back landed somebody on the screen they had just pressed Back from. `adopt()`
alone is enough — the editor draws on the next render.

The rest were not duplicates on inspection. `import` is offered by the Courses
screen, by the soft shell's action bar and by the springboard's floating
button, and those are three different navigations of which exactly one is on
screen at a time (`NAVS` in `lib/look.ts`). Cutting any of them would remove
the affordance for whoever chose that navigation. Left alone, deliberately.

**59 → 56 destinations.** That is a smaller cut than the brief assumed, and the
reason is worth stating plainly: this app is large because it does a lot, not
because it does the same thing repeatedly. The duplication that exists is
concentrated in the reports, the two reconciliation screens, and the assistant —
and the assistant is a different command.

Every merge must carry: the survivor's `keywords` widened with the dead
screen's, a `state/shape.ts` migration so a saved `screen` that no longer
exists lands on the survivor, and a test for that migration.

---
