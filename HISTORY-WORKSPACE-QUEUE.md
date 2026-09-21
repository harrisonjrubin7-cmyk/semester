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
describe runs *within the strip*, left to right. Split view (191–194) is
genuinely absent; do not mistake lanes for it.

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

---

## The queue

Sequenced so each lands on its own. Items are grouped by what they share, not
by spec number.

### A · Semester History — the record (160, 162, 163, 176)
The `HistoryEvent` shape, the entity types, the writer, and the line between
history and activity. No UI. Device-local.

### B · History — the screen (161, 164, 165, 167)
The screen, grouping (Today / Yesterday / This week / Older), search, and
`RECENT` fed from the same record rather than from `state.recent`.

### C · History — privacy and retention (169, 170, 171)
Clear item / range / all, pause, retention window, search history held
separately. Must land with or before B: a history surface that cannot be
cleared should not ship.

### D · Continue working (168)
Needs A. The spec is right that this beats raw history — it joins history to
deadlines, which the app already knows.

### E · Restore context and back-to-where-I-was (166, 223)
Needs A and the existing `Action[]` place mechanism in `lib/browser.ts`.
166 warns against over-persisting transient UI state; honour that.

### F · Split view (191, 192, 193, 194)
Genuinely new. Two panes, hard limit two. `AI side-by-side` (194) is the
case that justifies it. Do not nest.

### G · Workspace presets and saved workspaces (195–201)
Needs F. Presets arrange existing features and create no new ones (199).

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
