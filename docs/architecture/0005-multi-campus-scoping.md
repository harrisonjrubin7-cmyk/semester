# 0005 · Campus scoping via an admin-written `schools` table

**Status:** **Accepted.** Landed as `20260921170000_schools.sql` (#664). Verified
on `e4cf671`: `schools`, `profiles.school_id`, `claim_school()`,
`private.school_of()` and `private.same_school()` are all present in
`supabase/migrations/`.

This record was filed at *Proposed* first, and the reason is worth keeping. Its
first draft said "Accepted, landed today" on the strength of #664's commit
message read out of a CI listing — while #664 was still open. It was demoted to
Proposed after checking `supabase/migrations/` one object at a time, and promoted
back only after #664 actually merged and the same check passed. **Both readings
came from the same PR; only one of them came from the schema.**

## Decision

A `schools` table, written only by an administrator, and a `school_id` on
`profiles` that **its own subject cannot write**. The only way to set it is
`claim_school()`, which reads the address the server confirmed.

## Why the column is unwritable by the person it describes

This is the whole of the decision. If a student could
`update profiles set school_id`, the column would be a self-declaration — the
same strength as the client-side domain check it replaces, only written down
more formally. A longer way of recording what somebody typed is not
verification.

So the UPDATE privilege on that one column is revoked from both API roles, and
`claim_school()` is the single legitimate writer.

**A column privilege rather than a trigger**, and the reason is worth keeping: a
definer function cannot step over its own trigger without
`alter table … disable trigger`, which is DDL, is not session-local, and would
open the column to every other connection for as long as it were off. The first
draft did exactly that.

## Why no university is seeded

Not one row. Seeding Vanderbilt would put one university's name into the schema
every other university has to live in — which is precisely what a multi-campus
model exists to avoid. A test asserts the migration contains no `insert`, with
comments stripped first.

## What this pays back

`20260901000300_classmates_schools.sql` removed the `@vanderbilt.edu` test from
`verified_student()`, because a per-school check inside a policy refused every
student at every other university outright. That was correct and it said what it
cost: a Vanderbilt student used to know everyone in a room held a vanderbilt.edu
mailbox, and afterwards did not. This table is where the strength goes back.

## The ordering constraint, which matters more than the table

`verified_student()` is **not** re-tightened yet, and must not be. Every profile
has `school_id` null the moment the migration runs, so a policy requiring a
claimed school would empty every existing room instantly — refusing every
student, which is the exact failure the earlier migration was written to end.

The order that works:

1. The table lands. ← **done** (`20260921170000_schools.sql`)
2. An administrator adds the schools.
3. The screen offers the claim.
4. *Then* the policy tightens, and refuses strangers rather than everybody.

`private.school_of()` and `private.same_school()` are what step 4 will read, and
what every campus-scoped table in Phases 4–12 should scope against **from its
first migration** rather than by retrofit.

## A sharp edge, recorded

The domain is read from the **last** `@` on both sides. A quoted local part may
contain one, so a naive `split_part(addr, '@', 2)` on `"a@b"@vanderbilt.edu`
yields `b"`. It fails closed, but for a reason nobody could diagnose from a
screen saying "that address is not one Vanderbilt publishes".
