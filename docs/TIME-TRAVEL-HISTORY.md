# Evaluation history ("time travel")

> Code: `app/src/lib/history/` · Decision: D-1019 · **This is an engineering default. It is not an approved retention schedule, and nothing here claims legal, institutional or counsel approval.**

A student, an advisor or a school asks why Semester gave an answer on a day:
why was STAT 201 shown as satisfying quantitative reasoning on 15 September?
The honest answer needs the rule and its version, what was shown, and how fresh
the source was. It does not need a copy of the student's record, so this keeps
the least that answers the question, for a short time, and forgets on request.

## What is kept

One record per evaluation, with only these fields: an id, the time, the school
(so a school's records can be removed together), the rule-side subject, the rule
and its version, the outcome and explanation **as the student was shown them**,
which source it rested on and how fresh it was, and a fingerprint. Text fields
are cut to fixed lengths. Any other field a caller passes is dropped, not
stored, and a test holds that with generated inputs.

## The defaults, and what each protects

| Default | Why it is the safe one |
| --- | --- |
| **30 days**, never more than **90** | A longer request is clamped, not refused, so a mis-set value cannot become a long-lived store. |
| **200 records**, never more than 1000 | Oldest go first; the store cannot grow without limit. |
| **No snapshot of the inputs** | The history can explain an answer but cannot recompute it. Turning snapshots on stores at most 4 KB per record and expires with it. |
| **0 days is off**, and off writes nothing | Switching it off also deletes what is there. |
| **On the device only** | Not synced, not uploaded. There is no server copy to delete, and a test fails if this module imports the account client or calls the network. |
| **No student identifier** | The record is on the student's own device. |
| **A fingerprint, not the inputs** | It says whether two evaluations saw the same thing. It is a hash of a small input, which can be guessed when the input is low-entropy, so it is treated as personal data: deleted, exported and expired with its record. |

A record is shown while `now` is before its time plus the retention; the last
instant is excluded. Shortening retention hides records at once. Lengthening it
cannot bring back what a purge already deleted. An expired record is never
returned, even if the purge that would delete it has failed.

## Lifecycle

- **Record:** a no-op when off; otherwise stores, then deletes whatever has
  expired or is over the cap, so nothing lingers on disk looking gone.
- **Delete by the student:** *Erase from this device* clears this database (it
  is in `DATABASES` in `lib/erase.ts`, and the erase test fails if it is not).
- **Delete by a school:** `forget({ tenantId })` removes one school's records;
  `forget({ subject })` and `forget({ before })` narrow it. An empty scope
  removes nothing, because "everything" is `clear`, which is asked for by name.
- **Export:** `exportAll()` returns every record still visible, in full, with
  the policy that governs it.
- **Failure:** every call returns a result and none throws into the caller. A
  failed write does not stop the screen that asked. A failed clear returns
  `false` and never claims it worked.
- **Offline:** there is no network path, so there is nothing to queue or
  reconcile. It behaves the same with no connection.

## Not built

- **Nothing records yet.** No rule evaluator calls `history.record`. Which
  evaluations, with what subject and rule version, is a product decision for
  each (the degree audit first).
- **No screen.** A "why did it say that?" view, with its keyboard and
  screen-reader behaviour, belongs inside an existing screen and not a new
  destination, which the complexity budget would refuse.
- **The export screen does not list it.** `exportAll()` is the hook; the student
  data export flow has not been wired to it.
- **No school ceiling is wired.** `clampPolicy` takes a ceiling from a school or
  a contract; nothing supplies one.
- **No institutional (server-side) history.** A school answering a dispute or an
  audit needs a different store with a different owner, which this does not
  attempt. See below.

## Decisions required before any of this is lengthened or widened

**Decided by the owner, Harrison Rubin, on 30 September 2026 (D-1019):** he is the
retention owner for this history, and so decides its period, whether snapshots
may exist, and how a legal hold could reach it. He gave no period, so nothing
was lengthened and **no retention schedule is approved**: the defaults below
stand until he states one. What this store does in the meantime, as the safest
thing the repository supports:

- **Period.** 30 days, at most 90, and 0 turns it off. Unchanged.
- **Snapshots.** Off. A snapshot exists only where a policy turns it on, and none
  does. Unchanged.
- **Legal hold.** The history lives only on the student's own device, is never
  synced and so is never in anything Semester or a school could hold. It is
  therefore outside #1012's hold and is not meant to be reached by one. If a
  hold is ever to cover it, that needs a server-side copy, which does not exist
  and is not proposed here. Whether counsel is asked is his call.
- **Deletion.** The student's own deletion always wins, and Erase from this
  device clears it.

The five questions below stay as the list of what a change must decide. Nothing
in this directory claims counsel, institutional or legal approval.

1. **What retention, and what a school may require.** Thirty and ninety days are
   engineering defaults. The owner decides whether a student's own device needs a
   rule at all, and what a school may require.
2. **Whether snapshots may exist.** Recomputing an answer needs the inputs, and
   inputs about a student's degree progress may be an education record once a
   school holds them. The owner decides whether, what, and for how long; off
   until he does.
3. **Whether there is an institutional history.** It would need its own
   retention, student access and deletion rights, and an answer to how it meets
   a legal hold (#1012 has merged one; it does not reach a history kept only on a
   student's device) when a student asks for deletion. The owner decides; this
   store honours the student's deletion and is never held.
4. **How a school's ceiling is set and by whom.** Through the tenant contract or
   the Configuration Studio, never by the school's own administrator alone.
5. **Whether the fingerprint may be kept at all.** It is treated as personal
   data here; counsel may decide it should not exist.
