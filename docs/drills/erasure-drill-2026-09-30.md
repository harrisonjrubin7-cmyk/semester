# Export and erasure drill against production, 30 September 2026

Gate item **R-1**: student data export and deletion work. Run against
production (`lzrqvlugnawcgywkhqlz`, Postgres 17), with the owner's written
approval given in the session that ran it.

## What ran

A single `DO` block that ends in `raise exception`, so every write it made
was rolled back whatever happened inside it:

1. Create a synthetic account: an invite, an `auth.users` row, then a profile,
   a state row and a note.
2. As that user, call `export_my_data()` and record which keys came back and
   how large the export was.
3. Call `erase_account(uid)`, then delete the `auth.users` row, as the
   delete-account path does.
4. Walk every column `private.account_data_map()` names (191) and count rows
   still holding the user's id.

## What it read

```
seeded=3 export_keys=data_requests,invites,notes,profiles,state
export_bytes=1764 rows_left=0 invite_left=0 data_requests_recorded=2
users_before=3 users_after=3
```

- The export carried every seeded table plus the requests it recorded.
- After erasure no mapped column still held the user's id, and the invite
  was gone.
- Both requests (export, erasure) were recorded before the rollback.
- `auth.users` held 3 accounts before and after: nothing persisted.

A follow-up read-only query confirmed no drill user, invite or profile was
left in production.

**The control.** The first run failed on `feedback_device_check` while
seeding a feedback row and rolled back with nothing written; that is the
block refusing when a step fails, not passing regardless. The feedback seed
was dropped and the block rerun.

## What it does not prove

- The `delete-account` Edge Function end to end, with a real signed-in
  session and its HTTP path. The drill called the database functions it
  wraps.
- Deletion of storage objects, which the seeded account had none of.

So R-1 stays **partial** until the Edge Function path is exercised with a
real session.

## Why this is not under `docs/evidence/`

The first file in `docs/evidence/` lifts the compliance crosswalk's ceiling
and flips the evidence register, the proof calendar and the game-day
register together. Opening that directory is the owner's decision to make
on its own, not a side effect of recording one drill; when it is opened,
this record moves there.
