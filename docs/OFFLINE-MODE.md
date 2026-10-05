# Offline Mode: Phase M

**Flag:** `offline_mode` (`VITE_OFFLINE_MODE`). Off by default (D-012).

With the flag off nothing changes, and the app stays what it already was:
local-first, with the account as a copy. Tests hold the controls:

- an official hand-off can be confirmed with the flag off;
- a refusal runs only with the flag on.

**Where:** the badge sits under the header, in the slot the save-trouble
notice uses, in every layout. The refusals are in the shared
`ConfirmDialog` and in the calls that send.

**Server and service worker:** no change. **Decisions:** D-055 and D-056.

> `Offline mode` Last synced 9:05 AM. Everything you change is saved on this device and syncs when you are back online. Sharing an advisor meeting and sending your course plan can be kept here and sent by you when you are back. Publishing, deleting your account and official sites wait until you are connected.

## What the command asks, and how

| Command asks for | How |
|---|---|
| Explicit last-sync time | The ledger's `lastSyncedAt`, set by every successful sync: "Last synced 9:05 AM" today, "Sep 20, 8:00 AM" before that, "Not synced from this device yet" when there is none |
| "Offline mode" badge | `components/OfflineBanner.tsx`, with `role="status"` and the chip **Offline mode**. After reconnecting: "Back online — Syncing the changes you made offline…", then "Not synced yet" while anything is still waiting |
| Queue safe local changes | Already the architecture: every change is saved on the device first. The ledger records since when the account has not taken them. A test adds a task offline and reads it back from the device |
| Sync on reconnect | The `online` event with changes waiting calls the store's `refresh()`: pull, merge, push. With nothing waiting, or no account, it doesn't |
| Conflict resolution strategy | `lib/merge.ts`'s per-field policy: lists merged by id, ticks unioned, timestamped records newer-wins, settings later-wins, device settings kept. The existing merge notes say what happened. A test holds an offline edit meeting a remote one |
| No offline execution of high-risk actions | `requireOnline` refuses sharing, sending to the school, publishing and deleting the account, and says nothing was sent or queued. An official hand-off cannot be confirmed offline. Revoking and stopping are not blocked (D-056) |
| Keep two of them, without sending | Added after D-055, and its reasoning kept: a share with an advisor and a course plan can be **kept** on the device offline (`lib/sync/outbox.ts`, IndexedDB `semester-outbox`). Coming back online makes them ready; it never sends them. The student sends each with one tap, a request older than three days is never sent, and a request cut off mid-flight is read as possibly delivered, so a share is checked before it goes again. Publishing, deleting an account, official sites and any official or financial write stay refused and are never held (`lib/sync/classes.ts`). Erase device clears it |
| Do not show stale imported data as current | The office feed and demand view keep no cached copy and say so offline. `asOf(at)` dates anything imported that is shown from the device |
| Service worker only if compatible | No change. `public/sw.js` already serves same-origin files from its cache and refreshes them in the background, so every screen loaded once opens offline. Media (decks, handouts, audio) is cache-first |
| Offline data model and sync queue | `lib/offline-mode.ts`: `Ledger`, `afterSync`, `syncOnReconnect`, `badge`, `requireOnline`, `asOf` |

## What is available offline

Every item is on the device already. A test opens saved schedules and the
degree plan with `fetch` failing and the browser offline.

| Item | Where it lives |
|---|---|
| Today snapshot | The saved state (IndexedDB `semester-store`, or `semester.v1`): deadlines, tasks, the plan |
| Saved schedules | `semester.registration.v1` |
| Saved degree plan | The saved state: `requirements` and `taken` |
| Registration checklist | `semester.registration-day.v1` |
| Advisor agenda | `semester.advisor-meeting.v1` |
| Downloaded study packs | The service worker's media cache, cache-first |
| Flashcards | The saved state: `decks` and `reviews` |
| Selected sources | The saved state: `sources`, with Source Locker's choices in `semester.source-locker.v1` |

A screen never opened on this device cannot open offline, because its code
was never fetched. `ScreenTrouble` already says so rather than failing
silently.

## Files

| New | Purpose |
|---|---|
| `lib/offline-mode.ts` | The ledger, badge wording, `requireOnline`, `asOf`, `useOnline`, `AVAILABLE_OFFLINE` |
| `lib/sync/outbox.ts`, `lib/sync/senders.ts`, `lib/sync/useOutbox.ts`, `lib/sync/classes.ts`, `components/WaitingSends.tsx` | The held sends, their two senders, the hook, the class of every write that needs a connection, and the panel on Account |
| `components/OfflineBanner.tsx` | The badge, the ledger's upkeep, and sync on reconnect |

| Changed | Change |
|---|---|
| `App.tsx` | The badge joins the save-trouble slot when the flag is on, lazy-loaded |
| `components/ConfirmDialog.tsx` | An external hand-off cannot be confirmed offline, with the flag on |
| `lib/advisor-shares.ts`, `lib/office-actions-remote.ts`, `lib/course-demand-remote.ts`, `lib/cloud.ts` | `requireOnline` before a share, a send, a publish, or deleting the account |
| `components/OfficeActionFeed.tsx`, `components/DemandDesk.tsx` | Offline, they say they load when connected rather than showing an error or an old copy |
| `styles/app.css` | `.offline-banner`, `.offline-chip` |

## Tests

| File | Covers |
|---|---|
| `lib/offline-mode.test.ts` | **The ledger:** reads, starts "not synced" at the first failure, clears on sync, syncs on reconnect only with an account and something waiting. **The badge:** offline wording; no promised sync without an account; catching up; nothing when caught up. **Refusals:** thrown offline with the flag on; not online, and not with the flag off (the controls). **`asOf`.** **The merge:** an offline edit and a remote one both kept, and a setting takes the later copy |
| `components/OfflineBanner.test.tsx` | **The badge:** shown offline, with the last sync; absent online. **A write made offline:** saved on the device at once, marked waiting, synced on reconnect. **No sync on reconnect** without an account (the control). **Available offline:** saved schedules and the degree plan open with `fetch` failing. **High-risk actions:** every one refused offline, with nothing left in storage to fire later. **The hand-off:** can't be confirmed offline; can be online or with the flag off (the controls) |

**Revert checks.** Each guard was shown red against a revert and green on
restore:

- never refusing;
- refusing with the flag off;
- an open hand-off;
- no sync on reconnect;
- syncing without an account;
- going offline not marked;
- deleting unguarded;
- sharing unguarded;
- promising a sync to a device with no account.

## Responsive manual-test checklist

- [x] 390 and 1280px, in Chromium with the network cut: the badge under the
  header. No overflow and no `pageerror`.
- [ ] A real device in airplane mode, with an account: make changes,
  reconnect, and see them on another device.
- [ ] Parchment (light) ground; VoiceOver / NVDA.

## Analytics: definitions only (D-005)

Nothing below is collected.

| Event | When |
|---|---|
| `offline_resynced` | A reconnect sync finishes (whether it merged anything, never what) |
| `offline_refused` | A high-risk action is refused (`kind` only) |

## Rollback

Leave the flag unset (the default). The ledger is a small device record;
"Erase this device" clears it with every `semester.` key. There is no server
change and no service-worker change.
