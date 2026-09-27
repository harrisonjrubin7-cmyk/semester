# Cross-device continuity

What carries from one device to another today, how, and where it falls short of
the spec. Paths are under `app/src/`.

## Where state lives

- **On the device:** IndexedDB database `semester-store`
  (`state/persist/db.ts`), with localStorage `semester.v1` kept as a fallback
  (`state/shape.ts`, `STORAGE_KEY`). `semester.seen` records the per-row
  `updated_at` stamps this device has already taken.
- **Attached files** stay in IndexedDB on the device that added them and never
  sync (`lib/cloud.ts`, header note).
- **In the account:** Supabase, as one `state` row (everything except courses)
  and one row per course, each with `updated_at` (`lib/cloud.ts`, `pull` and
  `push`).

## How it syncs

- **Push:** 2.5 seconds after any change to persisted state
  (`state/store.tsx`), the state row and every course row are written, each
  as a **compare-and-swap on `updated_at`**: a row this device has read is
  updated only where its stamp is still the one recorded in `semester.seen`,
  and a row it has not read is inserted. If another device got there first,
  `push` throws `Stale` (`lib/cloud.ts`) and writes nothing over it. The store
  then pulls, merges and pushes again, waiting twice as long each round up to
  a minute. Nothing is pushed while the first-sign-in question is open, and
  nothing is attempted without a connection.
  - "Any change" is detected by `sameFields` (`state/shape.ts`), which
    compares the persisted half field by field by reference. It replaced a
    dependency on the serialised half, which on the IndexedDB path is never
    built — it was `''` on every render, so **in any browser with IndexedDB
    an edit did not trigger a push at all** until the next sign-in. Found
    while adding the Queued state; guarded by `state/syncstates.test.tsx`.
    Navigation does trigger a push, because `recent` and `visited` are
    persisted fields.
- **Pull:** when the signed-in account changes, when the connection comes
  back, after a push loses a race, when the app regains focus or becomes
  visible again, and on pull-to-refresh or "Sync now"
  (`components/PullDown.tsx`). The focus pull is skipped if any pull happened
  in the last minute (`FOCUS_PULL_MS`), so switching between tabs does not
  hammer the account, and it does not run offline or while the first-sign-in
  question is open.
- **First sign-in with data on both sides:** the student is asked which copy to
  keep (`lib/adopt.ts`, `components/Adopting.tsx`).
- **Merge** (`lib/merge.ts`): each field has a strategy.
  - `union`: combine lists by id. Where both sides have a record, the later
    stamp wins. This is last-write-wins per record, on device clocks.
  - `latest`: the newer record per key.
  - `theirs`: the incoming copy replaces the field.
  - `mine`: this device's value is never overwritten.

## Status the student can see

`SyncStatus` is `off | signed-out | syncing | synced | offline | queued |
conflict | error` (`state/store.tsx`). What each is called is one table,
`lib/syncstatus.ts`, read by the soft top bar, the Settings index, Account
and Profile. `Record<SyncStatus, …>` makes a state without words a type
error, which is what the four screens' separate `status === …` chains did
not do: a new state fell through to "On this device only" on one and
"Local" on another. Account's status line is a live region (`role="status"`),
so a screen reader hears the change when it happens. Today's decision surface
shows `syncLabel(state.lastSync)`, and a local save failure raises a
`saveTrouble` banner (`App.tsx`).

| Spec state | Semester | When |
| --- | --- | --- |
| Saved | `synced` | The last push landed |
| Saving | `syncing` | A pull is in flight |
| Offline | `offline` | No connection, and nothing waiting to go up |
| Queued to sync | `queued` | No connection, and edits waiting. The flag (`semester.unpushed`) is on disk, so closing and reopening offline still says Queued |
| Conflict needs review | `conflict` | A push has lost the race to another device three times running. Nothing is overwritten; it keeps merging and retrying |

What `conflict` does **not** yet mean is "these two edits of the same note
disagree — pick one". The merge keeps the later edit of a record edited on
both devices, and records it as a `MergeNote` (`lib/merge.ts`) that nothing
surfaces as a choice. Offering that choice is the remaining step towards the
spec's "Conflict needs review".

## Gaps against the spec, in order of risk

1. **Fixed: a push no longer overwrites a copy it has not read.** It used to
   upsert the whole state row with no version check and without pulling
   first, so a device that had not pulled since another device pushed wrote
   straight over it. Guarded by `lib/cloudcas.test.ts` (a fake database that
   honours the stamp filter) and `state/syncretry.test.tsx` (pull, merge and
   retry; no push while the first-sign-in question is open). What remains is
   the merge's own rule: **one record** edited on both devices keeps the later
   edit, and `theirs` settings changed here but not yet pushed give way to
   the account's. Devices on a release older than this one still write
   blindly until they update.
2. **Fixed: a failed push is retried.** It used to set `error` and wait for
   the next edit, so one change made before closing a laptop stayed on the
   laptop. A push that fails with something repeating could fix — the
   network, the service, a rate limit — now goes again by itself, doubling
   from 5 seconds up to 5 minutes, and the error says the changes are safe
   and it will try again. A refusal (sign-in expired, permission, not found)
   and a validation error are not retried, because the same copy would fail
   the same way; the next edit or sign-in pushes anyway. Reconnecting starts
   the waits again. `retriesOnItsOwn` and `pushWait` in `lib/syncstatus.ts`;
   guarded by `state/syncstates.test.tsx`.
3. **Fixed: pull on focus.** A laptop that stayed online overnight now
   catches up when the student switches back to it, rather than showing
   yesterday's semester until a manual refresh.
4. **Fixed: return context after sign-in.** Google, Microsoft, Apple and
   institutional SSO sign in by leaving the page, and the provider has to send
   the tab back to the bare `appUrl()` (the redirect must match the allowlist
   exactly). Before leaving, `components/Credentials.tsx` now writes down
   where the student was — or, on Account, the screen they came to Account
   from — and the store sends the returning tab there once the session
   arrives (`lib/returnto.ts`). The point is used once, expires after fifteen
   minutes, and loses to a link: a page opened at an app address goes where
   the address says. Email sign-up confirmation and password reset are not
   covered, because their links usually open in a new tab or on another
   device, where "where you were" is not this tab's place to guess.
   A notification tap was already covered: it carries `screen` and `item`
   through the service worker to `lib/land.ts`.
5. **Layout preferences sync with `theirs`.** `nav`, `shell`, `mailPane`,
   `tabs` and `shortcuts` follow the last device to change them. Reading
   preferences (`density`, `textSize`, `lineHeight`, `readingWidth` and others)
   are `mine`, so they stay per device, which is what the spec asks. The
   navigation cannot become unusable on another device, because `chromeFor`
   adapts it to the width. Even so, the spec would make `nav` and `mailPane`
   per device as well.

5 is a change to sync behaviour that deserves its own review.
