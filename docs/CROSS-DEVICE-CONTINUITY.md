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
  (`state/store.tsx`), the whole state row and every course row are upserted.
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

1. **Silent overwrite is possible.** `lib/cloud.ts` says so in its header: when
   one record is edited on two devices, the later edit survives. Worse, `push`
   upserts the whole state row with no version check and does not pull first.
   A device that has not pulled since another device pushed will overwrite
   that device's `theirs` fields in the account. The fix is a version check on
   push: send the `updated_at` that was pulled, refuse the write if the row has
   moved on, then pull, merge and retry. The merge notes `lib/merge.ts`
   already records would be the input to a Conflict state.
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

Each of 1–4 is a change to sync semantics that deserves its own branch and
review. They are recorded here, not attempted in the documentation change.
