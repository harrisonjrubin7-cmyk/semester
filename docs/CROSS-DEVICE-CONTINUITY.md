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
  a minute; from the third round the sync line says another device is
  changing the semester at the same moment. Nothing is pushed while the
  first-sign-in question is open.
- **Pull:** when the signed-in account changes, and on pull-to-refresh or
  "Sync now" (`components/PullDown.tsx`). **Not** on focus, on becoming
  visible, or on coming back online.
- **First sign-in with data on both sides:** the student is asked which copy to
  keep (`lib/adopt.ts`, `components/Adopting.tsx`).
- **Merge** (`lib/merge.ts`): each field has a strategy.
  - `union`: combine lists by id. Where both sides have a record, the later
    stamp wins. This is last-write-wins per record, on device clocks.
  - `latest`: the newer record per key.
  - `theirs`: the incoming copy replaces the field.
  - `mine`: this device's value is never overwritten.

## Status the student can see

`SyncStatus` is `off | signed-out | syncing | synced | error`
(`state/store.tsx`). It is shown on Account, the Settings index, Profile, the
soft top bar and Today's decision surface. A local save failure raises a
`saveTrouble` banner (`App.tsx`).

| Spec state | Semester |
| --- | --- |
| Saved | `synced` |
| Saving | `syncing` |
| Offline | **missing**: `lib/offline.ts` can tell, but the status does not say so |
| Queued to sync | **missing**: edits wait in local storage for the next push, with no indicator |
| Conflict needs review | **missing** |

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
2. **A failed push is not retried.** It sets `error` and waits for the next
   change.
3. **No pull on focus or reconnect.** A laptop left open overnight shows
   yesterday's state until something triggers a pull.
4. **No return context after sign-in.** OAuth, SSO and password reset all
   return to the bare `appUrl()`. A notification tap does carry `screen` and
   `item` through the service worker to `lib/land.ts`, so deep links from
   notifications work. Only the sign-in path loses the place.
5. **Layout preferences sync with `theirs`.** `nav`, `shell`, `mailPane`,
   `tabs` and `shortcuts` follow the last device to change them. Reading
   preferences (`density`, `textSize`, `lineHeight`, `readingWidth` and others)
   are `mine`, so they stay per device, which is what the spec asks. The
   navigation cannot become unusable on another device, because `chromeFor`
   adapts it to the width. Even so, the spec would make `nav` and `mailPane`
   per device as well.

Each of 2–5 is a change to sync behaviour that deserves its own review.
