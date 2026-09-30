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
- **One push at a time.** A push started while another is on its way waits
  for it and goes up on the stamps it returns, rather than racing it and
  being refused. The "changes waiting" flag is cleared only if nothing was
  edited after the push left.
- **Sync memory belongs to one account.** The stamps, the base and the review
  list are forgotten when a different account signs in on this device
  (`semester.syncedAs`), so the new account gets a first sign-in's question
  rather than the last account's comparisons. An account emptied from another
  device clears this device's stamps too, so its next push creates the rows
  instead of being refused for ever.
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
| Conflict needs review | `review` | Something was edited on two devices before either synced; both versions are kept until the student chooses (see below) |
| (contention) | `conflict` | A push has lost the race to another device three times running. Nothing is overwritten; it keeps merging and retrying |

### Conflict needs review

When the same record — a note, a task, an appointment, a course, anything
the merge unions — was edited on two devices before either synced, the
student chooses which version to keep (`lib/conflicts.ts`,
`components/Review.tsx`).

Telling that apart from an ordinary edit needs the version both sides last
agreed on, so each device keeps a **base**: a fingerprint of every such
record as of the last push that landed or pull that was taken
(`semester.base`, on the device only). On a pull, a record is a conflict
only if this device's copy differs from the base, the account's copy
differs from the base, and the two differ from each other. An edit on one
side only is not a conflict and is merged as before.

The merge still keeps the later edit, so the app never holds two copies of
one note. The copy it did not keep goes onto a review list on this device
(`semester.review`), the sync line reads **Conflict needs review**, and
Account shows both versions side by side with "Keep this one" on each.
Keeping the version in use clears the question. Keeping the other puts it
back, stamped now, and the ordinary push sends it up, so the other device
receives it as an edit and is not asked again.

**Deletions.** A union cannot express a deletion, so a note deleted on one
device used to come back from the other, and a course deleted offline came
back once the app was closed. The same base tells a deletion from a record
that was never there: in the base, missing on one side, and unchanged on
the other means it was deleted, and it stays deleted on both (`lib/deletions.ts`).
Deleted on one side and *edited* on the other is not settled by a clock: the
edit stays in use, so nothing is lost, and Account says "Deleted on this
device, changed on the other" with **Keep it deleted** beside **Keep this
one**. Only lists with one explicit delete are covered (courses, notes,
actions, appointments, documents, sheets, decks), so a list the app also
trims by itself cannot spread its own trimming. A removal of five or more,
and nearly all of a list, is not believed and the rows come back, because an
app that dropped rows by accident looks exactly like a person deleting
everything. `state/deletions.test.tsx` runs airplane mode, a restart and a
connection that comes and goes against the real store.

**Settings too.** The settings a student chose — the look (accent with its
hue, theme, corners, typefaces, icons, calm, course colours, badges, feed),
the arrangements they made (home screen, groups, favourites, shortcuts row,
feed and course order), and what they said about themselves and their time
(name, about me, hours in a day, sleep window, rules, quiet hours, reminder
lead time) — are offered the same way when changed on both devices. They are
`SETTINGS` in `lib/conflicts.ts`, grouped where one choice writes several
fields. The merge keeps the account's value, as `theirs` always has; keeping
this device's writes it back through `restoreSettings`, which can only
write those fields. The rest of `theirs` is the app's own state — a live
session, a cached geocode — and is never asked about.

**And an unpushed setting is no longer lost to a pull.** `theirs` meant the
incoming value always won, so a setting changed here and pulled over before
its push went up was gone. With the base, a field whose account value has
not moved since the two agreed is this device's change on its way up, and
the pull leaves it (`keptHere`). That matters more now that the app pulls on
focus and on reconnect.

**And the per-key maps.** Ticked-off deadlines, grades typed in, courses
renamed, saved links, attendance policies — everything the merge takes from
the account key by key (`ticks`). The base records each key, and a key
changed on both devices to different values since they agreed — a grade
entered as B+ on one and A- on the other — is offered one key at a time
(`tickConflictsIn`), named by its deadline's title where the key is one.
Keeping this device's writes that one key back (`restoreTick`, which only
writes per-key maps). And a key changed here and not yet pushed is no longer
put back by a pull (`takenTicks`), for the same reason as the settings.

`access` (Access and focus) and `pronounce` (how a name is said), added on
`main` since the settings list was written, are on it.

**Removals sync too.** The per-key merge only adds and overwrites, so a key
removed on one device — a grade cleared, a link unsaved — used to survive on
the other and be pushed straight back. Now a key the base has, the account
no longer carries, and this device still holds unchanged is removed here
before the merge (`removedThere`, the `dropTicks` action). Removed there and
changed here is a conflict, offered with "Not set" on the other side;
keeping that removes it. A key added here and not yet pushed was never in
the base and is left alone.

Not covered: a device with no base yet — before its first sync — where every
difference would look like a conflict, so none are reported, and nothing is
removed.

## Gaps against the spec, in order of risk

1. **Fixed: a push no longer overwrites a copy it has not read.** It used to
   upsert the whole state row with no version check and without pulling
   first, so a device that had not pulled since another device pushed wrote
   straight over it. Guarded by `lib/cloudcas.test.ts` (a fake database that
   honours the stamp filter) and `state/syncretry.test.tsx` (pull, merge and
   retry; no push while the first-sign-in question is open). Edits to the
   same record, setting or ticked key on both devices are put to the student
   (below), and a setting or tick changed here but not yet pushed survives a
   pull. Devices on
   a release older than this one still write blindly until they update.
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
5. **Fixed: layout preferences are per device.** `nav`, `shell`, `mailPane`,
   `tabs` and `directory` are now `mine` in `lib/merge.ts`: a layout is chosen
   for a screen, and a phone and a laptop can each keep their own. A new
   device starts on the defaults and derives the rest from its width;
   `chromeFor` already makes every navigation usable at every width. What the
   student arranged — the home screen's icons, the workspace favourites, the
   feed and course orders, the shortcuts row — and every look setting that is
   about the person (accent, typeface) still follow the account. Reading
   preferences (`density`, `textSize`, `lineHeight`, `readingWidth`, `labels`)
   were already per device. The Layout and navigation screen says so. Guarded
   by `lib/layoutdevice.test.ts`.


