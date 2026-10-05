# Resilient student mode

Part 6 of the expansion command. Phase 3. **Waits for #777.** Most of this
already exists, because the app was built local-first.

## What exists on main

- **The app works offline already.** State lives on the device and syncs when
  it can (`app/src/lib/cloud.ts`, `docs/architecture/0001-local-first-with-supabase.md`).
- A service worker, `app/public/sw.js`: network-first for pages, cache-first
  for media with a size cap, share target, push. `app/src/lib/warm.ts`
  precaches what has been used. Tested by `app/src/lib/swcache.test.ts` and
  `app/src/lib/swmedia.test.ts`.
- `app/src/lib/offline.ts`: `offline()` and `watchConnection()`.
- `app/src/lib/idb.ts` stores files; `app/src/lib/snapshots.ts` keeps rolling
  copies; `app/src/lib/keep.ts` saves without exceeding quota.
- Conflicts: `app/src/lib/merge.ts` merges two devices per field and writes
  `MergeNote`s saying what it did.

## In flight

[#777](https://github.com/harrisonjrubin7-cmyk/semester/pull/777) adds
`lib/syncstatus.ts` (eight sync states, including offline with edits waiting),
pull on focus and return after sign-in. The status words this part needs are
there.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `offline_cache_policies` | **Code**: a table in `sw.js` keyed by data class | The service worker has to decide without a network |
| `downloaded_assets`, `download_licenses` | **IndexedDB** records via `idb.ts`, with an expiry | Device state |
| `sync_queue_records` | **Not needed** for local state | Local-first means the state *is* the queue; `merge.ts` handles the return. An outbox is needed only for the few server-only writes, and those are exactly the ones never to queue |
| `sync_conflicts` | **Extend** `MergeNote` | Surface the notes merge already writes as a review sheet |
| `network_quality_events` | **Declined** as stored data | Network quality is read live (`navigator.connection`) and used at once. Storing it per student is a location-adjacent trail |
| `low_data_preferences` | **Device preference** | Plus honouring `Save-Data` |
| `cache_purge_requests` | **Button**, not a record | `eraseDevice` exists; this adds a narrower "clear downloads" |
| `offline_state_events` | **Declined** as stored data | Same reason as network events |

## Capabilities and flags

- None: this is device behaviour.
- Low-data mode and the downloads manager ride a flag `device.resilient_mode`,
  `off`. The existing offline behaviour is not behind it and does not change.

## Hard boundaries

These are never queued, and a test enumerates them:

- registration changes, drops and adds;
- sensitive handoffs (help requests to counselling, disability services);
- accepting a policy that must be current;
- anything financial or official;
- writeback to an external system;
- role or permission changes;
- anything irreversible.

Offline, these show "Needs a connection" and do nothing. Also:

- Classes T4 and above (#779's classification) are never cached by the service
  worker.
- A cached copy always shows when it was last updated.

## Tests

- The never-queue list: each of these operations, attempted offline, is refused
  with the sentence and leaves no pending write (one table test).
- Airplane mode: go offline, edit a note, add a flashcard, go online — both
  arrive, and no duplicate appears.
- Intermittent network: toggle every 200 ms during a sync; final state equals a
  clean sync.
- A T4 response is not in the service worker's cache after a fetch.
- A conflict between two devices produces a review entry naming both versions.
