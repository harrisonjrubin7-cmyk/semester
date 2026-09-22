# Spec 160–225 — History and the workspace, queued

Master-spec items 160–225: Semester History, workspace tabs, multi-window,
split view, and per-entity version history.

This file is the queue. It exists because **a third of these items are already
built**, and the repository's own opening instruction is to check before
building — see `CLAUDE.md`. Anybody picking up an item starts here, then
re-checks `origin/main` for that item specifically, because the check has a
shelf life measured in minutes on this repository.

Inventoried against `4e71e5f`.

---

## What already exists, and must not be rebuilt

`lib/browser.ts` is 1,361 lines and is already the in-app workspace tab
system. It is the `workspace` navigation (`.deskwork` / `.deskstrip`). Reading
its header before writing anything in this area is not optional: it explains
why it is not `lib/tabs.ts`, which is a different thing with the same name.

| Spec | Item | Where it already lives |
| --- | --- | --- |
| 177 | Workspace tab system | `lib/browser.ts` — `Strip`, `AppTab`, `add`, `select` |
| 178 | Tab types | A tab holds a `Screen` + `Action[]` place; every screen qualifies |
| 179 | Open in new tab | `openBeside`, `placeFor`, `Where` |
| 187 | Duplicate entity tabs | `sameplace` / `tabAt` — opening one place twice is allowed |
| 202 | Pinned tabs | `pin`, `pinnedCount` |
| 203 | Tab groups | `TabGroup`, `makeGroup`, `groupAt`, `tabsIn`, `GROUP_TONES` |
| 205 | Recently closed | `Shut`, `MAX_CLOSED`, `reopen` |
| 206 | Undo close tab | `reopen` |
| 185–186 | Cross-window state sync | `lib/tabs.ts` — BroadcastChannel nudge, re-read from storage |
| 224 | Deep linking | `lib/route.ts` — hash routes, `NAMED` entities |

**`Lane` is not a split pane.** `laneId` / `laneOrder` / `arrangeLanes`
describe runs *within the strip*, left to right. Do not mistake lanes for it.
Split view's *model* now exists — `Strip.split`, `splitWith`, `unsplit`,
`besideTab` — and nothing draws it; see F1 and F2 below.

**`lib/history.ts` is not navigation history.** It is editor undo/redo — a
ring buffer with coalescing, for a sheet or a document. Semester History
(160–176) needs a different module and must not be bolted onto that one.

---

## Two conflicts to settle before building

### 1 · The spec assumes a server product; the screens are local-first

`HistoryEvent` carries `user_id` and `tenant_id`, and 175 asks for
cross-device sync. Semester's screens are device-scoped: `useDeviceLibrary`,
`localStorage`, and `lib/university.ts` documents how little is connected.
There *is* a Supabase backend with tenants and RLS, so the server half is
possible — but "history syncs across devices" is a decision to put a record of
everything a student looked at onto a server, which is a different privacy
posture from everything the app does today.

**Proposed:** build history device-local first (160–171, 176), and treat
cross-device sync (175) as its own later item with its own argument. The spec
itself says history and audit logs must be separate systems (169); keeping it
local is the strongest version of that.

### 2 · "Activity" already half-exists and must not become a second history

176 insists HISTORY and ACTIVITY stay separate. The app already has
`lib/since.ts` and `screens/Changes.tsx` (what changed) and `state.recent`.
Adding a history surface without folding those in would give the app two
answers to "what have I been doing", which is exactly what
`lib/onehome.test.ts` and the `simplify` skill exist to prevent.

**Half settled by A.** The `since.ts` half is done and is enforced rather than
described: neither module imports the other, a `Visit` has nowhere to put a
change, a `Change` has nowhere to put a time, and `lib/trail.test.ts` reads
both sources to say so — because the fault it is for compiles perfectly. The
`state.recent` half is open and is item B's, which is why B is where `RECENT`
moves rather than A.

---

## The queue

Sequenced so each lands on its own. Items are grouped by what they share, not
by spec number.

### A · Semester History — the record (160, 162, 163, 176) · **landed**
`lib/trail.ts` — the `Visit` shape, the fold, the reader — and
`lib/trail.hook.ts`, which holds it on the device and writes it. Device-local,
for the reason conflict 1 gives: the store syncs to the cloud and is what a
backup contains, and a record of everywhere somebody looked is not that.

Three decisions that the rest of A–E inherit:

- **One entry per place, moved rather than stacked.** A browser stacks; this
  app's navigation bounces in a way a browser's does not, and a record that
  stacked would be mostly its own noise. It is also the shape `remember` in
  `state/slices/navigate.ts` already chose for screens, so history is that list
  generalised — a place rather than a screen, with a time, and a cap two orders
  larger — rather than a second one.
- **A place, never what was on it.** Three fields, and none of them can hold a
  title, a body or a search (160, 162). Titles resolve against the live library
  when the history is drawn, so a deleted course has no name to resolve and
  drops out on sight: the record cannot outlive the thing it is about.
- **The mode is not part of a place.** Reading a guide as slides is the same
  place read differently — the reason `replaces` exists in `lib/route.ts` — so
  one guide is one row however it was read.

One writer, in the effect in `state/store.tsx` that puts the address in the
bar. That effect is already the only thing in the app that knows where the app
*is* as one value; `push` cannot do it, because a reducer is pure and the trail
is on the device.

**`state.recent` is still what feeds the directory's Lately row**, and folding
it into the trail is item B. Not done here on purpose: it changes what two
screens draw, and it retires a synced field in favour of a device-local one —
which makes Lately's ordering stop crossing devices. That is a product change
and it belongs with the screen that justifies it, not slipped in under "add a
record".

### B · History — the screen (161, 164, 165, 167)
Needs A, which has landed. The screen, grouping (Today / Yesterday / This week
/ Older), search, and `RECENT` fed from the same record rather than from
`state.recent` — which means retiring `state.recent`, a synced field with two
readers (`screens/Directory.tsx`, `screens/Springboard.tsx`) and an entry in
`pickPersisted`. `keyread.test.ts` will require it gone rather than merely
unread.

Two things A deliberately left for this item: the `useSyncExternalStore`
subscription (`lib/trail.hook.ts` publishes to no one yet, and plumbing with
nothing plugged into it cannot be told from broken plumbing), and filtering to
real destinations, which `recent` does at render and A copied the reasoning
for.

### C · History — privacy and retention (169, 170, 171)
Clear item / range / all, pause, retention window, search history held
separately. Must land with or before B: a history surface that cannot be
cleared should not ship. `forgetTrail` in `lib/trail.hook.ts` is the call all
four Clear controls will make; A wrote it because clearing is a property of the
record rather than of a screen.

### D · Continue working (168)
Needs A. The spec is right that this beats raw history — it joins history to
deadlines, which the app already knows.

### E · Restore context and back-to-where-I-was (166, 223)
Needs A and the existing `Action[]` place mechanism in `lib/browser.ts`.
166 warns against over-persisting transient UI state; honour that.

### F1 · Split view — the model (191, 192, 193) · **landed**
`Strip.split`, `splitWith`, `unsplit`, `besideTab`, and `tidy`'s fourth rule.
Two panes, hard limit two, and the limit is structural: one optional field
cannot hold three. The pane names a tab **by id**, not by seat, so it survives
a close in front of it, a drag and a pin — the three moves an index loses
silently. Stale panes are dropped rather than repaired, the same way
`storedTabs` drops a tab it cannot read.

`select` now goes through `tidy` rather than `reveal` alone, because going to
the tab that is in the second pane is one of the two ways to end up drawing one
page twice, and the other is closing it.

### F2 · Split view — the render (191, 192, 194) · **blocked, and not on effort**

A pane has to draw a tab's page. A page in this app is a function of
`state.screen` and `state.nav`: one navigation, in one store, read by
ninety-eight screen components. **Two panes showing two places needs a
navigation per pane**, which is a change to `state/shape.ts` and the store, not
to the strip. Nothing in the workspace layout renders a screen that is not
`state.screen` — `App.tsx` mounts one `<CurrentScreen />`.

Three ways were considered and two of them are traps:

- **A second store for the second pane.** Two stores syncing, two
  localStorage writers, two answers to what the library contains. This is the
  bug the repository treats as fatal, arrived at from a new direction.
- **One store, a nav override per pane, navigations forwarded to the store.**
  Clicking a course in the right pane moves the left one. Anybody would hit it
  in the first minute.
- **One store, a nav override per pane, and the panes swap when you touch the
  inactive one.** This is the one worth designing. The inactive pane is a view
  you can read; interacting with it makes it the live pane and puts the other
  one beside it, which is what `select` already does to a tab and is already
  modelled — `at` and `split.id` trade places. It needs a real argument about
  what a frozen pane may run: effects, focus, scroll restoration, and the
  screen-scoped fields on `State` (`calMonth`, `moneyTab`, the report grain)
  that are global today and are per-pane the moment there are two.

Note that "navigation" is not a clean subset of the action union — plenty of
actions both move you and set a screen-scoped field — so a pane provider that
intercepts *nav actions by type* would be a guess-list that rots. The
coordinate has to move onto the pane, not the dispatch.

F1 landing first is deliberate: the render will need exactly that model, and a
pane named by index is the cheap thing somebody reaches for under a deadline.

### G · Workspace presets and saved workspaces (195–201)
Needs F2. Presets arrange existing features and create no new ones (199).

### H · Multi-*browser*-window (180, 181, 182, 188, 189, 190)
`window.open` + the existing BroadcastChannel sync. Respect popup blocking
and provide the menu fallback (182). Tab detachment by drag is the hard part
and may not be worth it on the web.

### I · Version history (214, 215, 216, 218, 219, 220)
Per-entity, and the largest block. Each needs its own argument about what a
meaningful version is — 215 explicitly warns against snapshotting every cell
edit forever. 220 says plan history must never rewrite official records.

### J · AI conversation and action history (172, 173, 174, 221, 222)
Depends on the Ask tab's current shape. 222's rule is the load-bearing one:
never imply an external action can be undone when it cannot.

### K · Platform polish (204, 207–213)
Tab search, session restore, crash recovery, window titles, badges, keyboard,
context menus. Mostly small, mostly independent, best done last.

### Deferred, needs a product decision
- **175 cross-device history sync** — see conflict 1.
- **183, 184 native macOS wrapper** — there is no desktop app; this is not a
  code change but a project.

---

## Rules for anybody working this queue

- Re-check `origin/main` for the specific item immediately before committing,
  not only before starting.
- Read `lib/browser.ts` before touching anything tab-shaped.
- Every guard gets run against a faithful wrong implementation before it is
  called a guard.
- No derived score, rank or meter — the constraint the rest of the app is
  built on applies to history too. "You viewed 43 things this week" is not a
  fact worth deriving into a judgement.
