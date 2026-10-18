# C8 investigation: audit pseudonyms and erasure

Written 4 Oct 2026 for finding C8 in [08](08-FINDINGS-AND-RECONCILIATION.md). **No migration was built.** This note says why, so the next person does not redo the reading. Whether pseudonymous audit hashes must be unlinkable after erasure is counsel's question (P-08 in [07](07-COUNSEL-REVIEW-QUEUE.md), **[COUNSEL REQUIRED]**); nothing here is a legal claim.

## What the finding is

`private.role_audit_sha256(text)` is `sha256(value)` in hex, no salt, no key (`20260924213000_role_grant_audit.sql`). Anyone who holds an erased person's UUID can compute it and select the rows that carry it.

## Where the hash is stored

The hash of a user id sits in `*_sha256` columns of these tables (49 call sites across 13 migrations):

| Table | Columns | Can an update reach it? |
|---|---|---|
| `role_grant_audit_event` | `subject_`, `grantor_`, `actor_sha256` | No. Trigger refuses every update; delete only after 3 years inside `sweep_audit_retention` |
| `moderation_audit_event` | `reporter_`, `about_`, `actor_sha256` | Same |
| `audit_event` | `object_`, `actor_sha256` | Same |
| `support_access_event` | `student_`, `supporter_`, `actor_sha256` | No. Trigger refuses everything, no retention exception at all |
| `community_case_events`, `community_volunteer_events`, `community_escalations`, `community_escalation_agreement_events`, `community_safety_entries`, `community_identity_grants`, `community_detector_rules` | actor, requester, decider, grantee, volunteer hashes | Event tables (`*_events`, `safety_entries`): no update or delete grant. Escalations, identity grants and detector rules are ordinary mutable rows, so a scrub could reach those, but they are operational state, not audit |

`audit_event` also carries pseudonyms from the productivity commands and reads (`20261004123000`, `20261004180000`).

## What the chains and seals cover

Nothing that matters here. The ledger chains (`20260930110000_ledger_chains.sql`, `20260930150000_ledger_chain_seals.sql`) hash the academic-record and student-account ledgers and exclude the person columns. The console audit chain uses its own hash function. None of them hash a `role_audit_sha256` value, so a scrub would not break a chain. The obstacle is not the chains.

## Why option (b), scrub on erasure, is not safe to build

D-1198 could scrub `tenant_policy_audit_event` because that table has no immutability trigger. Every table above does. The only sanctioned write to an immutable audit table is the retention sweep's *delete of a row older than 3 years* (`private.audit_purge_allowed`). There is no sanctioned update. An in-place scrub therefore needs a new carve-out in at least four trigger functions (an `erase` flag permitting an update of the `*_sha256` columns), which loosens the immutability the sweep deliberately kept narrow. One of the four, `support_access_event`, is the FERPA 99.32 disclosure record that `20260929030000_retention_sweeps.sql` says must be kept as long as the education records it is about. Whether erasure may alter it is a legal question this repository cannot answer. Deleting the rows instead is worse: it removes the record of who read a student's signals.

## Why option (a), a keyed hash, is not the smallest safe change

- The function takes text and cannot tell a user id from a token (`trust_room`), a task id (productivity) or a prefixed string (`'escalation:' ...`, `'vault:' ...`). Changing it changes all 49 call sites at once, including the ones that are not people.
- Readers compare stored hashes with `role_audit_sha256(auth.uid()::text)` (`support_access` grant lookups, the community `me_hash` reads, and about twenty check assertions). New events under a new hash stop matching old rows, so a reader would need to match both, for up to three years, or silently lose history.
- A global key held in the database does not make an erased person unlinkable to whoever holds the key. A per-person key, deleted at erasure, does, but it needs a key table, a lookup in every reader, and an erasure hook, and still leaves every existing row on the old hash. That is a design, with a data migration it cannot do without the update path above.
- The old rows are the tail either way: up to three years for the three swept tables, and indefinitely for `support_access_event` and the community history.

## Decision for the owner and counsel

1. Counsel decides whether a pseudonymous hash of an id is personal data that erasure must remove or break (P-08). If it is not, C8 is documentation: say plainly that a holder of the id can recompute the pseudonym and find events until the 3-year sweep.
2. If it must be unlinkable, the smallest route is per-person keyed pseudonyms for new events (key deleted at erasure) plus a deliberate, reviewed carve-out for the old rows. That change touches immutable tables, so it should be the owner's decision on counsel's advice, not an agent's.
3. `support_access_event` needs its own answer, because FERPA points the other way.
